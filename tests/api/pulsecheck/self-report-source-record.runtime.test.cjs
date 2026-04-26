'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const helper = require('../../../netlify/functions/utils/self-report-source-record');

// ──────────────────────────────────────────────────────────────────────────────
// In-memory Firestore mock — just enough surface for the helper.
// ──────────────────────────────────────────────────────────────────────────────

function createMockDb() {
  const collections = new Map();

  const collection = (name) => {
    if (!collections.has(name)) {
      collections.set(name, new Map());
    }
    const docs = collections.get(name);
    return {
      _docs: docs,
      doc: (id) => ({
        async get() {
          if (!docs.has(id)) return { exists: false, data: () => undefined };
          return { exists: true, data: () => docs.get(id) };
        },
        async set(value, options) {
          if (options?.merge && docs.has(id)) {
            docs.set(id, { ...docs.get(id), ...value });
          } else {
            docs.set(id, { ...value });
          }
          return undefined;
        },
      }),
    };
  };

  return {
    collection,
    _collections: collections,
  };
}

function getRecords(db) {
  const map = db._collections.get(helper.HEALTH_CONTEXT_SOURCE_RECORDS_COLLECTION);
  return map ? Array.from(map.values()) : [];
}

// ──────────────────────────────────────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────────────────────────────────────

test('buildSelfReportPayloads — sleep quality 5 maps to sleepEfficiencyProxy 1.0', () => {
  const { recoveryPayload, behavioralPayload } = helper.buildSelfReportPayloads({
    sleepQuality: 5,
    energyLevel: 4,
    stressLevel: 2,
  });
  assert.equal(recoveryPayload.sleepEfficiencyProxy, 1);
  assert.equal(recoveryPayload.sleepQualityScore, 5);
  assert.equal(behavioralPayload.energyScore, 4);
  assert.equal(behavioralPayload.stressScore, 2);
});

test('buildSelfReportPayloads — readinessScore (0-100) wins over energyLevel for readinessScoreProxy', () => {
  const { behavioralPayload } = helper.buildSelfReportPayloads({
    readinessScore: 75,
    energyLevel: 5,
  });
  assert.equal(behavioralPayload.readinessScoreProxy, 75);
});

test('buildSelfReportPayloads — clamps out-of-range numeric inputs', () => {
  const { recoveryPayload, behavioralPayload } = helper.buildSelfReportPayloads({
    sleepQuality: 99,
    energyLevel: -10,
    stressLevel: 50,
    perceivedRpe: 999,
  });
  assert.equal(recoveryPayload.sleepQualityScore, 5);
  assert.equal(behavioralPayload.energyScore, 1);
  assert.equal(behavioralPayload.stressScore, 5);
  assert.equal(behavioralPayload.perceivedRpeYesterday, 10);
});

test('buildSelfReportPayloads — empty input returns empty payloads', () => {
  const { recoveryPayload, behavioralPayload } = helper.buildSelfReportPayloads({});
  assert.deepEqual(recoveryPayload, {});
  assert.deepEqual(behavioralPayload, {});
});

test('athleteHasConnectedWearable — returns false when status doc is missing', async () => {
  const db = createMockDb();
  const result = await helper.athleteHasConnectedWearable(db, 'athlete-1');
  assert.equal(result, false);
});

test('athleteHasConnectedWearable — returns true when oura connected_synced', async () => {
  const db = createMockDb();
  db.collection(helper.HEALTH_CONTEXT_SOURCE_STATUS_COLLECTION).doc('athlete-1').set({
    sourceStatuses: { oura: 'connected_synced' },
  });
  const result = await helper.athleteHasConnectedWearable(db, 'athlete-1');
  assert.equal(result, true);
});

test('athleteHasConnectedWearable — returns false when oura status is connected_stale', async () => {
  const db = createMockDb();
  db.collection(helper.HEALTH_CONTEXT_SOURCE_STATUS_COLLECTION).doc('athlete-1').set({
    sourceStatuses: { oura: 'connected_stale' },
  });
  const result = await helper.athleteHasConnectedWearable(db, 'athlete-1');
  assert.equal(result, false);
});

test('athleteHasConnectedWearable — accepts object-shaped source status entries', async () => {
  const db = createMockDb();
  db.collection(helper.HEALTH_CONTEXT_SOURCE_STATUS_COLLECTION).doc('athlete-1').set({
    sourceStatuses: { apple_health: { status: 'connected_synced' } },
  });
  const result = await helper.athleteHasConnectedWearable(db, 'athlete-1');
  assert.equal(result, true);
});

test('writeSelfReportSourceRecords — writes recovery + behavioral docs with deterministic ids', async () => {
  const db = createMockDb();
  const result = await helper.writeSelfReportSourceRecords(db, {
    userId: 'athlete-1',
    sourceDate: '2026-04-25',
    timezone: 'America/New_York',
    confidenceLabel: 'emerging',
    answers: {
      readinessScore: 80,
      energyLevel: 4,
      stressLevel: 2,
      sleepQuality: 5,
    },
  });
  assert.equal(result.written.length, 2);
  assert.ok(result.written.includes('athlete-1_pulsecheck_self_report_recovery_2026-04-25'));
  assert.ok(result.written.includes('athlete-1_pulsecheck_self_report_behavioral_2026-04-25'));

  const records = getRecords(db);
  assert.equal(records.length, 2);
  for (const record of records) {
    assert.equal(record.athleteUserId, 'athlete-1');
    assert.equal(record.sourceFamily, 'pulsecheck_self_report');
    assert.equal(record.payloadVersion, '1.0');
    assert.equal(record.status, 'active');
    assert.equal(record.timezone, 'America/New_York');
    assert.equal(record.provenance.mode, 'self_reported');
    assert.equal(record.provenance.confidenceLabel, 'emerging');
  }
});

test('writeSelfReportSourceRecords — skips empty-payload domains', async () => {
  const db = createMockDb();
  const result = await helper.writeSelfReportSourceRecords(db, {
    userId: 'athlete-1',
    sourceDate: '2026-04-25',
    answers: {
      sleepQuality: 4, // recovery present
      // no energy/stress/rpe → behavioral empty
    },
  });
  assert.equal(result.written.length, 1);
  assert.ok(result.written[0].includes('recovery'));
  assert.ok(result.skipped.includes('behavioral_no_data'));
});

test('syncSelfReportFromCheckin — uses emerging confidence when athlete has no wearable', async () => {
  const db = createMockDb();
  const result = await helper.syncSelfReportFromCheckin(db, {
    userId: 'athlete-1',
    sourceDate: '2026-04-25',
    timezone: 'UTC',
    energyLevel: 4,
    stressLevel: 2,
    sleepQuality: 5,
  });
  assert.equal(result.hasWearable, false);
  assert.equal(result.confidenceLabel, 'emerging');
  assert.equal(result.written.length, 2);
});

test('syncSelfReportFromCheckin — downgrades to directional confidence when wearable present', async () => {
  const db = createMockDb();
  db.collection(helper.HEALTH_CONTEXT_SOURCE_STATUS_COLLECTION).doc('athlete-1').set({
    sourceStatuses: { oura: 'connected_synced' },
  });
  const result = await helper.syncSelfReportFromCheckin(db, {
    userId: 'athlete-1',
    sourceDate: '2026-04-25',
    energyLevel: 4,
    stressLevel: 3,
    sleepQuality: 4,
  });
  assert.equal(result.hasWearable, true);
  assert.equal(result.confidenceLabel, 'directional');
});

test('syncSelfReportFromCheckin — never throws even on bad input (non-blocking)', async () => {
  const db = createMockDb();
  const result = await helper.syncSelfReportFromCheckin(db, {
    userId: '',
    sourceDate: '',
  });
  assert.deepEqual(result.written, []);
  assert.ok(result.skipped.includes('missing_required_fields'));
});

test('writeSelfReportSourceRecords — record dedupeKey is canonical and matches Oura adapter format', async () => {
  const db = createMockDb();
  await helper.writeSelfReportSourceRecords(db, {
    userId: 'athlete-1',
    sourceDate: '2026-04-25',
    answers: { sleepQuality: 4 },
  });
  const records = getRecords(db);
  assert.equal(records[0].dedupeKey, 'athlete-1|pulsecheck_self_report|recovery|2026-04-25');
});

test('writeSelfReportSourceRecords — re-writing the same date overwrites the same doc id (idempotent)', async () => {
  const db = createMockDb();
  await helper.writeSelfReportSourceRecords(db, {
    userId: 'athlete-1',
    sourceDate: '2026-04-25',
    answers: { sleepQuality: 3 },
  });
  await helper.writeSelfReportSourceRecords(db, {
    userId: 'athlete-1',
    sourceDate: '2026-04-25',
    answers: { sleepQuality: 5 },
  });
  const records = getRecords(db);
  assert.equal(records.length, 1);
  assert.equal(records[0].payload.sleepQualityScore, 5);
});
