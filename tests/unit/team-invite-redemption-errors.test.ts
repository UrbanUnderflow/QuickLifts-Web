import assert from 'node:assert/strict';
import test from 'node:test';

import {
  TEAM_INVITE_REDEMPTION_ERROR_DEFINITIONS,
  normalizeTeamInviteRedemptionError,
  serializeTeamInviteRedemptionError,
  teamInviteRedemptionError,
} from '../../src/lib/server/pulsecheck/teamInviteRedemptionErrors';

test('every team invite redemption error has a stable safe response contract', () => {
  for (const [code, definition] of Object.entries(
    TEAM_INVITE_REDEMPTION_ERROR_DEFINITIONS
  )) {
    assert.match(code, /^[A-Z][A-Z0-9_]+$/);
    assert.ok(definition.statusCode >= 400 && definition.statusCode <= 599);
    assert.ok(definition.message.length >= 20);
    assert.equal(definition.message.includes('@'), false);
    assert.equal(definition.message.toLowerCase().includes('token'), false);

    const payload = serializeTeamInviteRedemptionError(
      teamInviteRedemptionError(
        code as keyof typeof TEAM_INVITE_REDEMPTION_ERROR_DEFINITIONS
      )
    );
    assert.deepEqual(payload, {
      code,
      message: definition.message,
      error: definition.message,
      retryable: definition.retryable,
    });
  }
});

test('known Firebase authentication failures become a safe authentication response', () => {
  const error = normalizeTeamInviteRedemptionError({
    code: 'auth/id-token-expired',
    message: 'sensitive provider detail',
  });

  assert.equal(error.code, 'AUTH_INVALID');
  assert.equal(error.statusCode, 401);
  assert.equal(error.message.includes('sensitive provider detail'), false);
});

test('unexpected server failures never expose their original message', () => {
  const error = normalizeTeamInviteRedemptionError(
    new Error('Firestore project, document path, and credential detail')
  );

  assert.equal(error.code, 'REDEMPTION_FAILED');
  assert.equal(error.statusCode, 500);
  assert.equal(error.message.includes('Firestore'), false);
  assert.match(error.message, /server problem/i);
});

test('enrollment rejection messages explain the required corrective action', () => {
  assert.match(
    TEAM_INVITE_REDEMPTION_ERROR_DEFINITIONS.ORGANIZATION_ACTIVATION_REQUIRED.message,
    /finish the pulsecheck activation link/i
  );
  assert.match(
    TEAM_INVITE_REDEMPTION_ERROR_DEFINITIONS.TEAM_ACTIVATION_REQUIRED.message,
    /finish the pulsecheck activation link/i
  );
  assert.match(
    TEAM_INVITE_REDEMPTION_ERROR_DEFINITIONS.PILOT_INACTIVE.message,
    /reopen enrollment/i
  );
  assert.match(
    TEAM_INVITE_REDEMPTION_ERROR_DEFINITIONS.PILOT_ENROLLMENT_ENDED.message,
    /extend the end date and reopen enrollment/i
  );
  assert.match(
    TEAM_INVITE_REDEMPTION_ERROR_DEFINITIONS.PILOT_SCHEDULE_INVALID.message,
    /correct the schedule/i
  );
  assert.match(
    TEAM_INVITE_REDEMPTION_ERROR_DEFINITIONS.ENROLLMENT_COHORT_CONFLICT.message,
    /already enrolled.*another cohort/i
  );
});
