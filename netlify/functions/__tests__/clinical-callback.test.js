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
  buildUserCareStateMirror,
  normalizeWebhookEvent,
  shouldApplyUserCareStateMirror,
  toUnixSeconds,
  verifyWebhookSignature,
} = require('../clinical-callback').__test;

function signedEvent(rawBody, secret) {
  const timestamp = String(Math.round(Date.now() / 1000));
  const signature = crypto.createHmac('sha256', secret).update(`${timestamp}.${rawBody}`, 'utf8').digest('hex');
  return { headers: { 'x-auntedna-signature': `t=${timestamp},v1=${signature}` } };
}

test('verifyWebhookSignature accepts the MANAS timestamped t/v1 signature', () => {
  process.env.CLINICAL_BRIDGE_WEBHOOK_SECRET = 'test-secret';
  const rawBody = JSON.stringify({ webhookEventId: 'evt-1' });
  const result = verifyWebhookSignature(signedEvent(rawBody, 'test-secret'), rawBody);
  assert.equal(result.ok, true);
  assert.equal(result.mode, 'timestamped_hmac_sha256');
});

test('verifyWebhookSignature rejects a tampered body', () => {
  process.env.CLINICAL_BRIDGE_WEBHOOK_SECRET = 'test-secret';
  const rawBody = JSON.stringify({ webhookEventId: 'evt-1' });
  const result = verifyWebhookSignature(signedEvent(rawBody, 'test-secret'), rawBody + 'tampered');
  assert.equal(result.ok, false);
  assert.equal(result.mode, 'invalid_signature');
});

test('verifyWebhookSignature fails closed when the secret is unset', () => {
  delete process.env.CLINICAL_BRIDGE_WEBHOOK_SECRET;
  const result = verifyWebhookSignature({ headers: {} }, '{}');
  assert.equal(result.ok, false);
  assert.equal(result.mode, 'not_configured');
});

test('verifyWebhookSignature rejects a valid signature outside the replay window', () => {
  process.env.CLINICAL_BRIDGE_WEBHOOK_SECRET = 'test-secret';
  const rawBody = JSON.stringify({ webhookEventId: 'evt-stale' });
  const timestamp = String(Math.round(Date.now() / 1000) - 600);
  const signature = crypto.createHmac('sha256', 'test-secret').update(`${timestamp}.${rawBody}`, 'utf8').digest('hex');
  const result = verifyWebhookSignature({
    headers: { 'x-auntedna-signature': `t=${timestamp},v1=${signature}` },
  }, rawBody);
  assert.equal(result.ok, false);
  assert.equal(result.mode, 'stale_timestamp');
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
  assert.equal(toUnixSeconds('1765432100'), 1765432100);
  assert.equal(toUnixSeconds('2025-12-11T06:28:20.000Z'), 1765434500);
  assert.equal(toUnixSeconds({ seconds: 1765432100 }), 1765432100);
  assert.equal(toUnixSeconds({ toMillis: () => 1765432100000 }), 1765432100);
  assert.equal(toUnixSeconds('not-a-date'), null);
  assert.equal(toUnixSeconds(undefined), null);
});

test('buildUserCareStateMirror activates and clears the native crisis wall from watch-list events', () => {
  const entered = buildUserCareStateMirror(
    normalizeWebhookEvent({
      event: 'watchlist.entered',
      webhookEventId: 'evt-entered',
      pulseEscalationId: 'esc-1',
      pulseUserId: 'athlete-1',
    }),
    {},
    700,
  );
  assert.equal(entered.athleteUserId, 'athlete-1');
  assert.equal(entered.crisisWallActive, true);
  assert.equal(entered.crisisWallActiveEscalationId, 'esc-1');

  const removed = buildUserCareStateMirror(
    normalizeWebhookEvent({
      event: 'watchlist.removed',
      webhookEventId: 'evt-removed',
      pulseUserId: 'athlete-1',
    }),
    {},
    800,
  );
  assert.equal(removed.crisisWallActive, false);
  assert.equal(removed.crisisWallClearReason, 'clinical_watchlist_removed');
  assert.equal(removed.crisisWallActiveEscalationId, null);
  assert.equal(removed.crisisWallReason, null);
});

test('out-of-order care-state events cannot regress a newer protective state', () => {
  const newerProtectiveState = {
    crisisWallActive: true,
    clinicalCareStateOccurredAt: 900,
  };
  const olderRemoval = {
    crisisWallActive: false,
    clinicalCareStateOccurredAt: 800,
  };
  const sameTimeRemoval = {
    crisisWallActive: false,
    clinicalCareStateOccurredAt: 900,
  };
  const newerRemoval = {
    crisisWallActive: false,
    clinicalCareStateOccurredAt: 901,
  };

  assert.equal(shouldApplyUserCareStateMirror(newerProtectiveState, olderRemoval), false);
  assert.equal(shouldApplyUserCareStateMirror(newerProtectiveState, sameTimeRemoval), false);
  assert.equal(shouldApplyUserCareStateMirror(newerProtectiveState, newerRemoval), true);
  assert.equal(
    shouldApplyUserCareStateMirror(
      { crisisWallActive: false, clinicalCareStateOccurredAt: 900 },
      { crisisWallActive: true, clinicalCareStateOccurredAt: 900 },
    ),
    true,
  );
});

test('buildUserCareStateMirror carries only trusted athlete/team routing fields into private safety state', () => {
  const mirror = buildUserCareStateMirror(
    normalizeWebhookEvent({
      event: 'crisis.invoked',
      webhookEventId: 'evt-crisis',
      pulseEscalationId: 'esc-2',
      pulseUserId: 'athlete-1',
    }),
    { teamId: 'team-1', clinicalNotes: 'must never cross the boundary' },
    900,
  );

  assert.equal(mirror.athleteUserId, 'athlete-1');
  assert.equal(mirror.teamId, 'team-1');
  assert.equal(mirror.crisisWallActive, true);
  assert.equal('clinicalNotes' in mirror, false);
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
