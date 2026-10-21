const test = require('node:test');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { AuntEdnaClinicalBridge } = require('../../../netlify/functions/lib/clinical-bridge');
const {
  getDailySnapshotWindow, deliverAthleticMindSnapshot, verifiedDestination, verifiedReceipt, DELIVERY_COLLECTION, WATERMARK_COLLECTION,
} = require('../../../netlify/functions/lib/athleticmind-snapshot-delivery');

function memoryDb(initial) {
  const records = new Map(Object.entries(initial).map(([key, value]) => [key, structuredClone(value)]));
  let queue = Promise.resolve();
  const reference = key => ({ key, async get() { return { exists: records.has(key), data: () => structuredClone(records.get(key)) }; } });
  return {
    records,
    collection(name) { return { doc: id => reference(`${name}/${id}`) }; },
    runTransaction(callback) {
      const run = queue.then(() => callback({
        get: ref => ref.get(),
        set(ref, value, options) { records.set(ref.key, structuredClone(options?.merge ? { ...records.get(ref.key), ...value } : value)); },
      }));
      queue = run.catch(() => {});
      return run;
    },
  };
}
const now = Date.parse('2026-10-11T18:00:00Z');
const receiver = { status: 'verified', baseUrl: 'https://partner-api.manasinsights.me/partner', path: '/verified-synthetic-contract', contractVersion: 'athleticmind-snapshot-v2', verifiedBy: 'synthetic-operator', verifiedAt: '2026-10-10T00:00:00Z' };
const config = { enabled: true, timeZone: 'America/New_York', cutoff: '00:00', receiver };
const bridgeConfig = { provider: 'auntedna', baseUrl: receiver.baseUrl, apiKey: 'ae_pk_live_synthetic_fixture', credentialMode: 'live' };
const env = { ATHLETICMIND_SNAPSHOT_PUSH_ENABLED: 'true', CLINICAL_BRIDGE_SNAPSHOT_PATH: receiver.path };
const input = { teamId: 'synthetic-team', athleteId: 'synthetic-athlete', now };
function fixture(extra = {}) {
  return memoryDb({
    'pulsecheck-teams/synthetic-team': { organizationId: 'synthetic-org', snapshotDelivery: structuredClone(config) },
    'pulsecheck-organizations/synthetic-org': { productBrand: 'athleticmind' },
    ...extra,
  });
}
function dependencies(overrides = {}) {
  const result = {
    env, bridgeConfig, clock: () => now,
    checkEligibility: async () => ({ eligible: true, scope: { teamId: input.teamId, athleteId: input.athleteId, organizationId: 'synthetic-org', membershipId: 'synthetic-membership' }, consent: { id: 'synthetic-consent', version: 'v2', eventId: 'synthetic-event', acceptedAt: '2026-10-08T04:00:00Z', documentHash: 'synthetic-document-hash' } }),
    assemble: async (_db, options) => ({ eligible: true, snapshot: { snapshotId: 'synthetic-snapshot', synthetic: false } }),
    // In-memory transport simulates the verified production response contract;
    // this fixture never instantiates a network-capable bridge.
    bridgeFactory: () => ({ request: async (_method, _path, snapshot) => ({ success: true, ok: true, httpStatus: 200, data: { snapshotId: snapshot.snapshotId, receiptId: 'synthetic-receipt', status: 'accepted' } }) }),
    ...overrides,
  };
  const assemble = result.assemble;
  result.assemble = async (db, options) => {
    const assembled = await assemble(db, options);
    if (assembled.snapshot) assembled.snapshot = {
      checkIns: [], noraMessages: [], journalEntries: [], journalWithdrawals: [], supportStatus: [], onboarding: { responses: {} },
      schemaVersion: 'athleticmind-snapshot-v2',
      scope: { teamId: options.teamId, athleteId: options.athleteId, organizationId: 'synthetic-org', membershipId: 'synthetic-membership' },
      window: { start: options.windowStart, end: options.windowEnd },
      consent: { id: 'synthetic-consent', version: 'v2', eventId: 'synthetic-event', acceptedAt: '2026-10-08T04:00:00Z', documentHash: 'synthetic-document-hash' },
      ...assembled.snapshot,
    };
    if (assembled.snapshot && !/^[a-f0-9]{64}$/.test(assembled.snapshot.snapshotId)) assembled.snapshot.snapshotId = createHash('sha256').update(assembled.snapshot.snapshotId).digest('hex');
    return assembled;
  };
  return result;
}
const watermarks = db => [...db.records.keys()].filter(key => key.startsWith(`${WATERMARK_COLLECTION}/`));
const jobs = db => [...db.records.entries()].filter(([key]) => key.startsWith(`${DELIVERY_COLLECTION}/`)).map(([, value]) => value);
const scopeId = createHash('sha256').update('synthetic-team\nsynthetic-athlete').digest('hex');

test('daily local midnight covers spring and autumn DST days exactly', () => {
  const spring = getDailySnapshotWindow({ timeZone: 'America/New_York' }, '2026-03-09T12:00:00Z');
  assert.equal(spring.windowStart, '2026-03-08T05:00:00.000Z');
  assert.equal(spring.windowEnd, '2026-03-09T04:00:00.000Z');
  assert.equal(Date.parse(spring.windowEnd) - Date.parse(spring.windowStart), 23 * 3600000);
  const autumn = getDailySnapshotWindow({ timeZone: 'America/New_York' }, '2026-11-02T12:00:00Z');
  assert.equal(Date.parse(autumn.windowEnd) - Date.parse(autumn.windowStart), 25 * 3600000);
});
test('cutoff resolves DST gap forward, fold first occurrence, and non-hour offsets', () => {
  assert.equal(getDailySnapshotWindow({ timeZone: 'America/New_York', cutoff: '02:30' }, '2026-03-08T12:00:00Z').windowEnd, '2026-03-08T07:00:00.000Z');
  assert.equal(getDailySnapshotWindow({ timeZone: 'America/New_York', cutoff: '01:30' }, '2026-11-01T12:00:00Z').windowEnd, '2026-11-01T05:30:00.000Z');
  assert.equal(getDailySnapshotWindow({ timeZone: 'Asia/Kathmandu', cutoff: '00:00' }, now).windowEnd, '2026-10-10T18:15:00.000Z');
  assert.throws(() => getDailySnapshotWindow({}, now), /time zone/);
  assert.throws(() => getDailySnapshotWindow({ timeZone: 'UTC', cutoff: '24:00' }, now), /cutoff/);
});
test('push is disabled without every explicit program and destination gate', async () => {
  for (const altered of [
    { env: {} }, { env: { ...env, CLINICAL_BRIDGE_SNAPSHOT_PATH: '' } },
    { bridgeConfig: { ...bridgeConfig, credentialMode: 'test' } },
    { bridgeConfig: { ...bridgeConfig, baseUrl: 'https://placeholder.invalid' } },
  ]) {
    const db = fixture();
    const result = await deliverAthleticMindSnapshot(db, input, dependencies({ ...altered, assemble: () => { throw new Error('Must never assemble'); } }));
    assert.equal(result.status, 'disabled');
    assert.equal(jobs(db).length, 0);
  }
  assert.equal(verifiedDestination({ ...config, enabled: false }, bridgeConfig, env), null);
  assert.equal(verifiedDestination({ ...config, receiver: { ...receiver, verifiedAt: null } }, bridgeConfig, env), null);
});
test('dedicated snapshot URL and key reach only the verified snapshot receiver without changing clinical config', async () => {
  const snapshotReceiver = { ...receiver, baseUrl: 'https://snapshot-api.manasinsights.me', path: '/daily-snapshots' };
  const snapshotEnv = {
    ...env,
    ATHLETICMIND_SNAPSHOT_PUSH_BASE_URL: snapshotReceiver.baseUrl,
    ATHLETICMIND_SNAPSHOT_PUSH_PATH: snapshotReceiver.path,
    ATHLETICMIND_SNAPSHOT_PUSH_API_KEY: 'synthetic-dedicated-receiver-key',
    ATHLETICMIND_SNAPSHOT_PUSH_CREDENTIAL_MODE: 'live',
  };
  const originalClinicalConfig = structuredClone(bridgeConfig);
  const db = fixture({ 'pulsecheck-teams/synthetic-team': { organizationId: 'synthetic-org', snapshotDelivery: { ...config, receiver: snapshotReceiver } } });
  let sent = 0;
  const result = await deliverAthleticMindSnapshot(db, input, dependencies({
    env: snapshotEnv,
    bridgeFactory: transportConfig => new AuntEdnaClinicalBridge(transportConfig, async (url, options) => {
      sent++;
      assert.equal(url, `${snapshotReceiver.baseUrl}${snapshotReceiver.path}`);
      assert.equal(options.headers.Authorization, 'Bearer synthetic-dedicated-receiver-key');
      assert.notEqual(options.headers.Authorization, `Bearer ${bridgeConfig.apiKey}`);
      const snapshot = JSON.parse(options.body);
      return { ok: true, status: 200, text: async () => JSON.stringify({ success: true, data: { snapshotId: snapshot.snapshotId, receiptId: 'synthetic-receipt', status: 'accepted' } }) };
    }),
  }));
  assert.equal(result.status, 'delivered');
  assert.equal(sent, 1);
  assert.deepEqual(bridgeConfig, originalClinicalConfig);
  assert.equal(JSON.stringify([...db.records]).includes(snapshotEnv.ATHLETICMIND_SNAPSHOT_PUSH_API_KEY), false);
});
test('partial, non-live, unverified, or disabled dedicated configuration never falls back to clinical credentials', async () => {
  const dedicated = {
    ...env,
    ATHLETICMIND_SNAPSHOT_PUSH_BASE_URL: receiver.baseUrl,
    ATHLETICMIND_SNAPSHOT_PUSH_PATH: receiver.path,
    ATHLETICMIND_SNAPSHOT_PUSH_API_KEY: 'synthetic-dedicated-receiver-key',
    ATHLETICMIND_SNAPSHOT_PUSH_CREDENTIAL_MODE: 'live',
  };
  const invalid = [
    { ...dedicated, ATHLETICMIND_SNAPSHOT_PUSH_API_KEY: '' },
    { ...dedicated, ATHLETICMIND_SNAPSHOT_PUSH_API_KEY: 'ae_pk_test_synthetic' },
    { ...dedicated, ATHLETICMIND_SNAPSHOT_PUSH_CREDENTIAL_MODE: 'test' },
    { ...dedicated, ATHLETICMIND_SNAPSHOT_PUSH_BASE_URL: 'http://partner-api.manasinsights.me/partner' },
    { ...dedicated, ATHLETICMIND_SNAPSHOT_PUSH_PATH: '/unverified' },
    { ...dedicated, ATHLETICMIND_SNAPSHOT_PUSH_ENABLED: 'false' },
  ];
  for (const key of Object.keys(dedicated).filter(key => key.startsWith('ATHLETICMIND_SNAPSHOT_PUSH_') && key !== 'ATHLETICMIND_SNAPSHOT_PUSH_ENABLED')) {
    const partial = { ...dedicated };
    delete partial[key];
    invalid.push(partial);
  }
  for (const invalidEnv of invalid) {
    const db = fixture();
    assert.equal((await deliverAthleticMindSnapshot(db, input, dependencies({
      env: invalidEnv,
      assemble: () => { throw new Error('Must never assemble'); },
      bridgeFactory: () => { throw new Error('Must never construct transport'); },
    }))).status, 'disabled');
    assert.equal(jobs(db).length, 0);
  }
  assert.equal(verifiedDestination({ ...config, enabled: false }, bridgeConfig, dedicated), null);
  assert.equal(verifiedDestination({ ...config, receiver: { ...receiver, status: 'pending' } }, bridgeConfig, dedicated), null);
});
test('PulseCheck display override and missing product never activate export', async () => {
  for (const organization of [{ productBrand: 'pulsecheck', appBranding: { pulsecheck: 'athleticmind' } }, {}]) {
    const db = fixture({ 'pulsecheck-organizations/synthetic-org': organization });
    assert.equal((await deliverAthleticMindSnapshot(db, input, dependencies())).reason, 'athleticmind_program_required');
    assert.equal(jobs(db).length, 0);
  }
});
test('only a matching verified real receipt advances watermark and repeated due run does not send', async () => {
  const db = fixture();
  let sent = 0;
  let assembledWindow;
  const deps = dependencies({
    assemble: async (_db, options) => { assembledWindow = options; return { eligible: true, snapshot: { snapshotId: 'snapshot-1', synthetic: false } }; },
    bridgeFactory: () => ({ request: async (method, path, snapshot, options) => {
      sent++;
      assert.equal(method, 'POST');
      assert.equal(path, receiver.path);
      assert.equal(options.headers['Idempotency-Key'], snapshot.snapshotId);
      return { success: true, ok: true, httpStatus: 201, data: { snapshotId: snapshot.snapshotId, receiptId: 'receipt-1', status: 'stored' } };
    } }),
  });
  assert.equal((await deliverAthleticMindSnapshot(db, input, deps)).status, 'delivered');
  assert.equal(assembledWindow.windowStart, '2026-10-08T04:00:00.000Z');
  assert.equal(db.records.get(`${WATERMARK_COLLECTION}/${scopeId}`).deliveredThrough, '2026-10-11T04:00:00.000Z');
  assert.equal((await deliverAthleticMindSnapshot(db, input, deps)).status, 'already_current');
  assert.equal(sent, 1);
});
test('failed receipt retries immutable payload and same idempotency key', async () => {
  const db = fixture();
  let builds = 0;
  let sends = 0;
  const ids = [];
  const deps = dependencies({
    assemble: async () => ({ eligible: true, snapshot: { snapshotId: `snapshot-${++builds}`, synthetic: false } }),
    bridgeFactory: () => ({ request: async (_m, _p, snapshot, options) => {
      ids.push(options.headers['Idempotency-Key']);
      return { success: true, ok: true, httpStatus: 200, data: { snapshotId: ++sends === 1 ? 'wrong-id' : snapshot.snapshotId, receiptId: 'receipt', status: 'accepted' } };
    } }),
  });
  assert.equal((await deliverAthleticMindSnapshot(db, input, deps)).status, 'failed');
  assert.equal(watermarks(db).length, 0);
  assert.equal((await deliverAthleticMindSnapshot(db, input, deps)).status, 'delivered');
  assert.equal(builds, 2);
  assert.deepEqual(ids, ['snapshot-1', 'snapshot-1'].map(id => createHash('sha256').update(id).digest('hex')));
});
test('concurrent same-window workers cannot dispatch twice', async () => {
  const db = fixture();
  let release;
  let entered;
  const ready = new Promise(resolve => { entered = resolve; });
  const blocked = new Promise(resolve => { release = resolve; });
  const deps = dependencies({ assemble: async () => { entered(); await blocked; return { eligible: true, snapshot: { snapshotId: 'snapshot-1', synthetic: false } }; } });
  const first = deliverAthleticMindSnapshot(db, input, deps);
  await ready;
  assert.equal((await deliverAthleticMindSnapshot(db, input, deps)).status, 'busy');
  release();
  assert.equal((await first).status, 'delivered');
  assert.equal(jobs(db)[0].attempts, 1);
});
test('synthetic success and ineligible snapshots cannot advance durable watermark', async () => {
  const db = fixture();
  const result = await deliverAthleticMindSnapshot(db, input, dependencies({
    mode: 'synthetic', env: {},
    assemble: async () => ({ eligible: true, snapshot: { snapshotId: 'synthetic-snapshot', synthetic: true } }),
    syntheticTransport: async snapshot => ({ success: true, ok: true, httpStatus: 200, data: { snapshotId: snapshot.snapshotId, receiptId: 'mock-receipt', status: 'accepted' } }),
  }));
  assert.equal(result.status, 'simulated');
  assert.equal(watermarks(db).length, 0);
  const ineligible = fixture();
  const denied = await deliverAthleticMindSnapshot(ineligible, input, dependencies({ assemble: async () => ({ eligible: false, reasonCodes: ['current_consent_required'] }) }));
  assert.equal(denied.status, 'blocked');
  assert.equal(watermarks(ineligible).length, 0);
  assert.equal(verifiedReceipt({ success: true, ok: true, httpStatus: 200, data: { snapshotId: 'id', receiptId: 'receipt', status: 'accepted' } }, 'id', 'synthetic'), false);
});
test('outages beyond seven days require backfill without assembling or advancing', async () => {
  const db = fixture({ [`${WATERMARK_COLLECTION}/${scopeId}`]: { deliveredThrough: '2026-09-01T04:00:00Z', consentEventId: 'synthetic-event', organizationId: 'synthetic-org', teamId: input.teamId, athleteId: input.athleteId } });
  const result = await deliverAthleticMindSnapshot(db, input, dependencies({ assemble: () => { throw new Error('Must not skip outage'); } }));
  assert.equal(result.reason, 'operator_backfill_required');
  assert.equal(jobs(db).length, 0);
  assert.equal(db.records.get(`${WATERMARK_COLLECTION}/${scopeId}`).deliveredThrough, '2026-09-01T04:00:00Z');
});

test('retry rechecks current eligibility before sending the frozen envelope', async () => {
  const db = fixture();
  let eligible = true;
  let sends = 0;
  const deps = dependencies({
    assemble: async () => ({ eligible, reasonCodes: eligible ? [] : ['consent_revoked'], snapshot: { snapshotId: 'snapshot-1', synthetic: false } }),
    bridgeFactory: () => ({ request: async () => { sends++; throw new Error('synthetic outage'); } }),
  });
  assert.equal((await deliverAthleticMindSnapshot(db, input, deps)).status, 'failed');
  eligible = false;
  assert.equal((await deliverAthleticMindSnapshot(db, input, deps)).status, 'blocked');
  assert.equal(sends, 1);
  assert.equal(watermarks(db).length, 0);
});

test('initial activation covers acceptance history or requires bounded backfill, never yesterday by default', async () => {
  const db = fixture();
  let requested;
  await deliverAthleticMindSnapshot(db, input, dependencies({ assemble: async (_db, options) => { requested = options; return { eligible: true, snapshot: { snapshotId: 'first', synthetic: false } }; } }));
  assert.equal(requested.windowStart, '2026-10-08T04:00:00.000Z');
  const old = fixture();
  assert.equal((await deliverAthleticMindSnapshot(old, input, dependencies({
    checkEligibility: async () => ({ eligible: true, consent: { eventId: 'synthetic-event', acceptedAt: '2026-09-01T00:00:00Z' } }),
  }))).reason, 'operator_backfill_required');
  assert.equal(jobs(old).length, 0);
  assert.equal((await deliverAthleticMindSnapshot(fixture(), input, dependencies({
    checkEligibility: async () => ({ eligible: true, consent: { eventId: 'synthetic-event', acceptedAt: '2026-10-11T12:00:00Z' } }),
  }))).status, 'not_due');
});

test('oversized, cross-scope, synthetic live, and changed-consent envelopes cannot be delivered', async () => {
  for (const snapshot of [
    { huge: 'x'.repeat(512 * 1024) },
    { scope: { teamId: 'other-team', athleteId: input.athleteId, organizationId: 'synthetic-org', membershipId: 'membership' } },
    { synthetic: true },
    { schemaVersion: 'unknown' },
  ]) {
    let sent = false;
    const db = fixture();
    const result = await deliverAthleticMindSnapshot(db, input, dependencies({
      assemble: async () => ({ eligible: true, snapshot: { snapshotId: 'snapshot', synthetic: false, ...snapshot } }),
      bridgeFactory: () => ({ request: async () => { sent = true; throw new Error('Must not send'); } }),
    }));
    assert.equal(result.status, 'failed');
    assert.equal(sent, false);
    assert.equal(watermarks(db).length, 0);
  }
  const db = fixture();
  let currentEvent = 'original-event';
  let sends = 0;
  const deps = dependencies({
    checkEligibility: async () => ({ eligible: true, scope: { teamId: input.teamId, athleteId: input.athleteId, organizationId: 'synthetic-org', membershipId: 'synthetic-membership' }, consent: { id: 'consent', version: 'v2', documentHash: 'hash', acceptedAt: '2026-10-08T04:00:00Z', eventId: currentEvent } }),
    assemble: async () => ({ eligible: true, snapshot: { snapshotId: 'snapshot', synthetic: false, consent: { id: 'consent', version: 'v2', documentHash: 'hash', acceptedAt: '2026-10-08T04:00:00Z', eventId: currentEvent } } }),
    bridgeFactory: () => ({ request: async () => { sends++; throw new Error('synthetic outage'); } }),
  });
  await deliverAthleticMindSnapshot(db, input, deps);
  currentEvent = 'new-event';
  assert.equal((await deliverAthleticMindSnapshot(db, input, deps)).reason, 'consent_changed');
  assert.equal(sends, 1);
  assert.equal(watermarks(db).length, 0);
});

test('overlapping next-day delivery carries late source revisions without mutating prior receipt', async () => {
  const db = fixture();
  const sent = [];
  let revision = 'revision-1';
  const deps = dependencies({
    assemble: async (_db, options) => ({ eligible: true, snapshot: { snapshotId: `snapshot-${revision}`, synthetic: false, checkIns: [{ sourceId: 'same-checkin', revision, eventAt: '2026-10-09T12:00:00Z', sourceIngestedAt: revision === 'revision-1' ? '2026-10-09T12:00:00Z' : '2026-10-11T17:00:00Z' }] } }),
    bridgeFactory: () => ({ request: async (_m, _p, snapshot) => {
      sent.push(structuredClone(snapshot));
      return { success: true, ok: true, httpStatus: 200, data: { snapshotId: snapshot.snapshotId, receiptId: `receipt-${revision}`, status: 'accepted' } };
    } }),
  });
  assert.equal((await deliverAthleticMindSnapshot(db, input, deps)).status, 'delivered');
  revision = 'revision-2';
  assert.equal((await deliverAthleticMindSnapshot(db, { ...input, now: now + 86400000 }, deps)).status, 'delivered');
  assert.equal(sent[1].window.start, '2026-10-09T04:00:00.000Z');
  assert.equal(sent[0].checkIns[0].revision, 'revision-1');
  assert.equal(sent[1].checkIns[0].sourceId, sent[0].checkIns[0].sourceId);
  assert.equal(sent[1].checkIns[0].revision, 'revision-2');
  assert.equal(jobs(db).filter(job => job.status === 'delivered').length, 2);
});

test('unverified path, private IP, and placeholder destinations cannot activate network delivery', () => {
  for (const baseUrl of ['https://127.0.0.1/partner', 'https://10.1.2.3/partner', 'https://[::1]/partner', 'https://local.invalid/partner', 'http://partner-api.manasinsights.me/partner']) {
    assert.equal(verifiedDestination({ ...config, receiver: { ...receiver, baseUrl } }, { ...bridgeConfig, baseUrl }, env), null);
  }
  assert.equal(verifiedDestination({ ...config, receiver: { ...receiver, contractVersion: 'unreviewed' } }, bridgeConfig, env), null);
});

test('frozen push retries cannot resurrect restricted sources, old revisions, or deleted onboarding answers', async () => {
  for (const change of ['removed', 'revision', 'onboarding']) {
    const db = fixture();
    let changed = false, sends = 0;
    const deps = dependencies({
      assemble: async () => ({ eligible: true, snapshot: {
        snapshotId: 'snapshot', synthetic: false,
        noraMessages: changed && change === 'removed' ? [] : [{ sourceId: 'conversation/message', revision: changed && change === 'revision' ? 'r2' : 'r1', text: 'Synthetic private reflection' }],
        onboarding: { responses: changed && change === 'onboarding' ? {} : { synthetic: 'answer' } },
      } }),
      bridgeFactory: () => ({ request: async () => { sends++; throw new Error('synthetic transport outage'); } }),
    });
    assert.equal((await deliverAthleticMindSnapshot(db, input, deps)).status, 'failed');
    changed = true;
    const blocked = await deliverAthleticMindSnapshot(db, input, deps);
    assert.equal(blocked.status, 'blocked');
    assert.equal(blocked.reason, 'snapshot_sources_changed');
    assert.equal(sends, 1);
    assert.equal(watermarks(db).length, 0);
  }
});

test('a withdrawal during outbox preparation blocks transport and watermark advancement', async () => {
  const db = fixture();
  let checks = 0, sends = 0;
  const deps = dependencies();
  const original = deps.checkEligibility;
  deps.checkEligibility = async () => ({ ...await original(), eligible: ++checks === 1 });
  deps.bridgeFactory = () => ({ request: async () => { sends++; throw new Error('must not deliver'); } });
  assert.equal((await deliverAthleticMindSnapshot(db, input, deps)).reason, 'consent_changed');
  assert.equal(sends, 0);
  assert.equal(watermarks(db).length, 0);
});

test('frozen journal push blocks edited or withdrawn journal revisions without advancing watermark', async () => {
  for (const removed of [false, true]) {
    const db = fixture(); let changed = false, sends = 0;
    const deps = dependencies({ mode: 'synthetic', env: {}, assemble: async () => ({ eligible: true, snapshot: { snapshotId: 'journal-snapshot', synthetic: true, journalEntries: changed && removed ? [] : [{ sourceId: 'synthetic-journal', revision: changed ? 'changed' : 'original' }] } }), syntheticTransport: async () => { sends++; throw new Error('Synthetic lost response'); } });
    assert.equal((await deliverAthleticMindSnapshot(db, input, deps)).status, 'failed');
    changed = true;
    assert.equal((await deliverAthleticMindSnapshot(db, input, deps)).reason, 'snapshot_sources_changed');
    assert.equal(sends, 1); assert.equal(watermarks(db).length, 0);
  }
});
