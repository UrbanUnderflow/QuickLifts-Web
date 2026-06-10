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
} = require('../auntedna-callback').__test;

function signedEvent(rawBody, secret) {
  const signature = crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex');
  return { headers: { 'x-auntedna-signature': `sha256=${signature}` } };
}

test('verifyWebhookSignature accepts a valid HMAC hex signature', () => {
  process.env.AUNTEDNA_WEBHOOK_SECRET = 'test-secret';
  const rawBody = JSON.stringify({ webhookEventId: 'evt-1' });
  const result = verifyWebhookSignature(signedEvent(rawBody, 'test-secret'), rawBody);
  assert.equal(result.ok, true);
  assert.equal(result.mode, 'hmac_sha256_hex');
});

test('verifyWebhookSignature rejects a tampered body', () => {
  process.env.AUNTEDNA_WEBHOOK_SECRET = 'test-secret';
  const rawBody = JSON.stringify({ webhookEventId: 'evt-1' });
  const result = verifyWebhookSignature(signedEvent(rawBody, 'test-secret'), rawBody + 'tampered');
  assert.equal(result.ok, false);
  assert.equal(result.mode, 'invalid_signature');
});

test('verifyWebhookSignature fails closed when the secret is unset outside mock mode', () => {
  delete process.env.AUNTEDNA_WEBHOOK_SECRET;
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
  assert.equal(normalized.auntEdnaCaseId, 'ae-case-9');
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
  assert.equal(normalized.auntEdnaCaseId, 'ae-case-2');
  assert.equal(normalized.statusCategory, 'closed');
});

test('toUnixSeconds handles seconds, milliseconds, and ISO strings', () => {
  assert.equal(toUnixSeconds(1765432100), 1765432100);
  assert.equal(toUnixSeconds(1765432100000), 1765432100);
  assert.equal(toUnixSeconds('2025-12-11T06:28:20.000Z'), 1765434500);
  assert.equal(toUnixSeconds('not-a-date'), null);
  assert.equal(toUnixSeconds(undefined), null);
});

test('buildEscalationMirror writes only the coarse auntEdnaCase map plus activity timestamp', () => {
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
  assert.deepEqual(Object.keys(mirror).sort(), ['auntEdnaCase', 'auntEdnaCaseId', 'incidentLastActivityAt']);
  assert.equal(mirror.auntEdnaCaseId, 'ae-case-9');
  assert.equal(mirror.incidentLastActivityAt, 1765432200);
  assert.equal(mirror.auntEdnaCase.statusCategory, 'created');
  assert.equal(mirror.auntEdnaCase.createdAt, 1765432100);
  assert.equal(mirror.auntEdnaCase.lastEventId, 'evt-1');
});

test('buildEscalationMirror flags follow-up for triage and clears it on booking/resolution', () => {
  const triage = buildEscalationMirror(
    normalizeWebhookEvent({ event: 'triage.requested', webhookEventId: 'e1', pulseEscalationId: 'esc-1' }),
    100,
  );
  assert.equal(triage.auntEdnaCase.followUpRequired, true);

  const booked = buildEscalationMirror(
    normalizeWebhookEvent({ event: 'appointment.booked', webhookEventId: 'e2', pulseEscalationId: 'esc-1' }),
    200,
  );
  assert.equal(booked.auntEdnaCase.followUpRequired, false);
  assert.equal(booked.auntEdnaCase.appointmentBookedAt, 200);

  const resolved = buildEscalationMirror(
    normalizeWebhookEvent({ event: 'case.resolved', webhookEventId: 'e3', pulseEscalationId: 'esc-1' }),
    300,
  );
  assert.equal(resolved.auntEdnaCase.followUpRequired, false);
  assert.equal(resolved.auntEdnaCase.resolvedAt, 300);
});

test('buildEventDocId sanitizes slashes in partner event ids', () => {
  assert.equal(buildEventDocId('evt/with/slashes'), 'auntedna_evt_with_slashes');
});
