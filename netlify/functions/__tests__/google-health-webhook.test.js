const test = require('node:test');
const assert = require('node:assert/strict');

const firebaseConfigPath = require.resolve('../config/firebase');
require.cache[firebaseConfigPath] = {
  id: firebaseConfigPath,
  filename: firebaseConfigPath,
  loaded: true,
  exports: {
    initializeFirebaseAdmin: () => ({}),
    admin: {},
  },
};

const googleHealthUtilsPath = require.resolve('../google-health-utils');
require.cache[googleHealthUtilsPath] = {
  id: googleHealthUtilsPath,
  filename: googleHealthUtilsPath,
  loaded: true,
  exports: {
    RESPONSE_HEADERS: {},
  },
};

const {
  civilDateToDateKey,
  normalizeNotification,
  parseTinkSignatureHeader,
  verifyWebhookAuthorization,
} = require('../google-health-webhook').__test;

test('civilDateToDateKey converts Google Health civil date objects', () => {
  assert.equal(civilDateToDateKey({ date: { year: 2026, month: 3, day: 7 } }), '2026-03-07');
});

test('normalizeNotification extracts user, data type, operation, and snapshot date', () => {
  const notification = normalizeNotification({
    data: {
      healthUserId: 'health_user_123',
      operation: 'UPSERT',
      dataType: 'steps',
      clientProvidedSubscriptionName: 'subscription-name',
      intervals: [
        {
          civilDateTimeInterval: {
            startDateTime: {
              date: { year: 2026, month: 3, day: 7 },
              time: { hours: 17, minutes: 29 },
            },
          },
        },
      ],
    },
  });

  assert.deepEqual(notification, {
    healthUserId: 'health_user_123',
    dataType: 'steps',
    operation: 'UPSERT',
    subscriptionName: 'subscription-name',
    dateKey: '2026-03-07',
  });
});

test('verifyWebhookAuthorization accepts configured endpoint authorization', () => {
  const previous = process.env.GOOGLE_HEALTH_WEBHOOK_AUTHORIZATION;
  process.env.GOOGLE_HEALTH_WEBHOOK_AUTHORIZATION = 'Bearer local-secret';
  try {
    const result = verifyWebhookAuthorization({
      headers: { authorization: 'Bearer local-secret' },
    });
    assert.equal(result.ok, true);
    assert.equal(result.mode, 'endpoint_authorization');
  } finally {
    if (previous === undefined) {
      delete process.env.GOOGLE_HEALTH_WEBHOOK_AUTHORIZATION;
    } else {
      process.env.GOOGLE_HEALTH_WEBHOOK_AUTHORIZATION = previous;
    }
  }
});

test('parseTinkSignatureHeader extracts the prefix key id and DER body', () => {
  const header = Buffer.concat([
    Buffer.from([1, 0, 0, 0, 7]),
    Buffer.from([0x30, 0x44, 0x02, 0x20]),
  ]).toString('base64');

  const parsed = parseTinkSignatureHeader(header);
  assert.equal(parsed.outputPrefixType, 1);
  assert.equal(parsed.keyId, 7);
  assert.deepEqual(Array.from(parsed.signatureDer), [0x30, 0x44, 0x02, 0x20]);
});
