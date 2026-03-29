const test = require('node:test');
const assert = require('node:assert/strict');

const {
  classifyMessagingFailure,
} = require('../pulsecheck-notification-utils');

test('classifyMessagingFailure flags Firebase third-party auth errors as console-config issues', () => {
  const failure = classifyMessagingFailure({
    code: 'messaging/third-party-auth-error',
    message: 'Request is missing required authentication credential.',
  });

  assert.deepEqual(failure, {
    failureCategory: 'apns_or_fcm_credential_misconfigured',
    errorCode: 'messaging/third-party-auth-error',
    message: 'Request is missing required authentication credential.',
    needsConsoleConfig: true,
    recommendedAction: 'Check Firebase Cloud Messaging APNs credentials for the PulseCheck iOS app in Firebase console.',
  });
});

test('classifyMessagingFailure falls back to an unknown bucket for other messaging errors', () => {
  const failure = classifyMessagingFailure({
    code: 'messaging/internal-error',
    message: 'Internal messaging failure.',
  });

  assert.equal(failure.failureCategory, 'unknown_messaging_failure');
  assert.equal(failure.errorCode, 'messaging/internal-error');
  assert.equal(failure.needsConsoleConfig, false);
  assert.equal(failure.recommendedAction, null);
});
