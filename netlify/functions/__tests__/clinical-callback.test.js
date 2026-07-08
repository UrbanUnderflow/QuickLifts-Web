const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const firebaseConfigPath = require.resolve('../config/firebase');
require.cache[firebaseConfigPath] = {
  id: firebaseConfigPath,
  filename: firebaseConfigPath,
  loaded: true,
  exports: {
    initializeFirebaseAdmin: () => ({}),
    admin: {},
    headers: {},
  },
};

const {
  buildEscalationMirror,
  buildEventDocId,
  normalizeWebhookEvent,
  toUnixSeconds,
  verifyWebhookSignature,
} = require('../clinical-callback').__test;

function signedEvent(rawBody, secret) {
  const signature = crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex');
  return { headers: { 'x-auntedna-signature': `sha256=${signature}` } };
}

test('verifyWebhookSignature accepts a valid HMAC hex signature', () => {
  process.env.CLINICAL_BRIDGE_WEBHOOK_SECRET = 'test-secret';
  const rawBody = JSON.stringify({ webhookEventId: 'evt-1' });
  const result = verifyWebhookSignature(signedEvent(rawBody, 'test-secret'), rawBody);
  assert.equal(result.ok, true);
  assert.equal(result.mode, 'hmac_sha256_hex');
});

test('verifyWebhookSignature rejects a tampered body', () => {
  process.env.CLINICAL_BRIDGE_WEBHOOK_SECRET = 'test-secret';
  const rawBody = JSON.stringify({ webhookEventId: 'evt-1' });
  const result = verifyWebhookSignature(signedEvent(rawBody, 'test-secret'), rawBody + 'tampered');
  assert.equal(result.ok, false);
  assert.equal(result.mode, 'invalid_signature');
});

test('verifyWebhookSignature fails closed when the secret is unset outside mock mode', () => {
  delete process.env.CLINICAL_BRIDGE_WEBHOOK_SECRET;
  delete process.env.AUNTEDNA_MOCK;
  const result = verifyWebhookSignature({ headers: {} }, '{}');
  assert.equal(result.ok, false);
  assert.equal(result.mode, 'not_configured');

  process.env.AUNTEDNA_MOCK = 'true';
  const mockResult = verifyWebhookSignature({ headers: {} }, '{}');
  assert.equal(mockResult.ok, true);
  assert.equal(mockResult.mode, 'mock_unsigned');
  delete process.env.AUNTEDNA_MOCK;
});

test('normalizeWebhookEvent extracts allow-listed fields and drops everything else', () => {
  const normalized = normalizeWebhookEvent({
    event: 'clinician.assigned',
    webhookEventId: 'evt-42',
    pulseEscalationId: 'esc-1',
    auntEdnaCaseId: 'ae-case-9',
    assignmentLabel: 'Campus Support Lane',
    timestamp: 1765432100000,
    clinicalNotes: 'should never persist',
  });
  assert.equal(normalized.eventType, 'clinician.assigned');
  assert.equal(normalized.webhookEventId, 'evt-42');
  assert.equal(normalized.pulseEscalationId, 'esc-1');
  assert.equal(normalized.clinicalCaseId, 'ae-case-9');
  assert.equal(normalized.assignmentLabel, 'Campus Support Lane');
  assert.equal(normalized.statusCategory, 'assigned');
  assert.equal(normalized.occurredAt, 1765432100);
  assert.equal('clinicalNotes' in normalized, false);
});

test('normalizeWebhookEvent reads fields nested under data and maps event type to status category', () => {
  const normalized = normalizeWebhookEvent({
    eventType: 'case.resolved',
    data: { webhookEventId: 'evt-7', caseId: 'ae-case-2', status: 'closed' },
  });
  assert.equal(normalized.webhookEventId, 'evt-7');
  assert.equal(normalized.clinicalCaseId, 'ae-case-2');
  assert.equal(normalized.statusCategory, 'closed');
});

test('toUnixSeconds handles seconds, milliseconds, and ISO strings', () => {
  assert.equal(toUnixSeconds(1765432100), 1765432100);
  assert.equal(toUnixSeconds(1765432100000), 1765432100);
  assert.equal(toUnixSeconds('2025-12-11T06:28:20.000Z'), 1765434500);
  assert.equal(toUnixSeconds('not-a-date'), null);
  assert.equal(toUnixSeconds(undefined), null);
});

test('buildEscalationMirror writes only the coarse clinicalCase map plus activity timestamp', () => {
  const mirror = buildEscalationMirror(
    normalizeWebhookEvent({
      event: 'escalation.created',
      webhookEventId: 'evt-1',
      pulseEscalationId: 'esc-1',
      auntEdnaCaseId: 'ae-case-9',
      occurredAt: 1765432100,
    }),
    1765432200,
  );
  assert.deepEqual(Object.keys(mirror).sort(), ['clinicalCase', 'clinicalCaseId', 'incidentLastActivityAt']);
  assert.equal(mirror.clinicalCaseId, 'ae-case-9');
  assert.equal(mirror.incidentLastActivityAt, 1765432200);
  assert.equal(mirror.clinicalCase.statusCategory, 'created');
  assert.equal(mirror.clinicalCase.createdAt, 1765432100);
  assert.equal(mirror.clinicalCase.lastEventId, 'evt-1');
});

test('buildEscalationMirror flags follow-up for triage and clears it on booking/resolution', () => {
  const triage = buildEscalationMirror(
    normalizeWebhookEvent({ event: 'triage.requested', webhookEventId: 'e1', pulseEscalationId: 'esc-1' }),
    100,
  );
  assert.equal(triage.clinicalCase.followUpRequired, true);

  const booked = buildEscalationMirror(
    normalizeWebhookEvent({ event: 'appointment.booked', webhookEventId: 'e2', pulseEscalationId: 'esc-1' }),
    200,
  );
  assert.equal(booked.clinicalCase.followUpRequired, false);
  assert.equal(booked.clinicalCase.appointmentBookedAt, 200);

  const resolved = buildEscalationMirror(
    normalizeWebhookEvent({ event: 'case.resolved', webhookEventId: 'e3', pulseEscalationId: 'esc-1' }),
    300,
  );
  assert.equal(resolved.clinicalCase.followUpRequired, false);
  assert.equal(resolved.clinicalCase.resolvedAt, 300);
});

test('buildEscalationMirror mirrors watchlist and check-in workflow state without clinical content', () => {
  const watchlist = buildEscalationMirror(
    normalizeWebhookEvent({
      event: 'watchlist.entered',
      webhookEventId: 'evt-watch-1',
      pulseEscalationId: 'esc-1',
      caseId: 'ae-case-1',
      clinicalSummary: 'should never persist',
    }),
    400,
  );
  assert.equal(watchlist.clinicalCase.watchList, true);
  assert.equal(watchlist.clinicalCase.appState, 'protective');
  assert.equal(watchlist.clinicalCase.returnToTrainingStatus, 'not_cleared');
  assert.equal(watchlist.clinicalCase.watchListEnteredAt, 400);
  assert.equal('clinicalSummary' in watchlist.clinicalCase, false);

  const cleared = buildEscalationMirror(
    normalizeWebhookEvent({ event: 'watchlist.cleared_for_training', webhookEventId: 'evt-watch-2' }),
    500,
  );
  assert.equal(cleared.clinicalCase.returnToTrainingStatus, 'cleared');
  assert.equal(cleared.clinicalCase.followUpRequired, false);

  const missed = buildEscalationMirror(
    normalizeWebhookEvent({ event: 'checkin.missed', webhookEventId: 'evt-checkin-1' }),
    600,
  );
  assert.equal(missed.clinicalCase.checkInMissedAt, 600);
  assert.equal(missed.clinicalCase.followUpRequired, true);
});

test('buildEventDocId sanitizes slashes in partner event ids', () => {
  assert.equal(buildEventDocId('evt/with/slashes'), 'clinical_evt_with_slashes');
});
