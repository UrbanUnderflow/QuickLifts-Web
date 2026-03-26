const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildNoraBiometricBriefNotification,
  buildNoraDailyReflectionNotification,
  buildNoraPushMessage,
  normalizeStringMap,
  resolveAthleteFirstName,
} = require('../pulsecheck-notification-utils');

test('resolveAthleteFirstName prefers preferredName and falls back cleanly', () => {
  assert.equal(resolveAthleteFirstName({ preferredName: 'Jordan Lee' }), 'Jordan');
  assert.equal(resolveAthleteFirstName({ displayName: 'Sam Carter' }), 'Sam');
  assert.equal(resolveAthleteFirstName({ username: 'athlete_sam' }), 'athlete_sam');
  assert.equal(resolveAthleteFirstName({}), '');
});

test('buildNoraBiometricBriefNotification creates Nora DM copy and routing payload', () => {
  const notification = buildNoraBiometricBriefNotification({
    athleteName: 'Jordan',
    snapshotDateKey: '2026-03-24',
    observedDateKey: '2026-03-24',
  });

  assert.equal(notification.title, 'Nora');
  assert.equal(notification.subtitle, 'Biometric brief ready');
  assert.match(notification.body, /Hey Jordan, your biometric brief is ready/i);
  assert.equal(notification.notificationType, 'BIOMETRIC_BRIEF_READY');
  assert.equal(notification.data.type, 'BIOMETRIC_BRIEF_READY');
  assert.equal(notification.data.route, 'nora_chat');
  assert.equal(notification.data.snapshotDateKey, '2026-03-24');
});

test('buildNoraDailyReflectionNotification creates end-of-day Nora DM copy', () => {
  const notification = buildNoraDailyReflectionNotification({
    athleteName: 'Avery',
    localDate: '2026-03-24',
  });

  assert.equal(notification.title, 'Nora');
  assert.equal(notification.subtitle, 'End-of-day check-in');
  assert.match(notification.body, /Hey Avery, how was your day/i);
  assert.equal(notification.notificationType, 'DAILY_REFLECTION');
  assert.equal(notification.data.type, 'DAILY_REFLECTION');
  assert.equal(notification.data.dmKind, 'end_of_day_reflection');
  assert.equal(notification.data.localDate, '2026-03-24');
});

test('normalizeStringMap drops nullish values and stringifies the rest', () => {
  assert.deepEqual(
    normalizeStringMap({
      keepString: 'ready',
      keepNumber: 12,
      keepBoolean: false,
      skipNull: null,
      skipUndefined: undefined,
    }),
    {
      keepString: 'ready',
      keepNumber: '12',
      keepBoolean: 'false',
    }
  );
});

test('buildNoraPushMessage adds Nora DM APNS metadata', () => {
  const message = buildNoraPushMessage({
    fcmToken: 'token_123',
    title: 'Nora',
    subtitle: 'Biometric brief ready',
    body: "Hey, your biometric brief is ready. Let's talk about it.",
    data: {
      type: 'BIOMETRIC_BRIEF_READY',
      prompt: 'Hey Nora, walk me through my biometric brief.',
    },
  });

  assert.equal(message.token, 'token_123');
  assert.equal(message.notification.title, 'Nora');
  assert.equal(message.apns.headers['apns-push-type'], 'alert');
  assert.equal(message.apns.payload.aps['thread-id'], 'nora-dm');
  assert.equal(message.apns.payload.aps.category, 'NORA_DM');
  assert.equal(message.apns.payload.aps.alert.subtitle, 'Biometric brief ready');
  assert.equal(message.data.type, 'BIOMETRIC_BRIEF_READY');
});
