const test = require('node:test');
const assert = require('node:assert/strict');

const firebaseConfigPath = require.resolve('../config/firebase');
require.cache[firebaseConfigPath] = {
  id: firebaseConfigPath,
  filename: firebaseConfigPath,
  loaded: true,
  exports: {
    admin: {},
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  },
};

const {
  DEFAULT_SCOPES,
  DEFAULT_WHOOP_REDIRECT_URI,
  buildAuthorizeUrl,
  buildWebhookSignature,
  getRedirectUri,
  normalizeScopes,
  toConnectionStatus,
  verifyWebhookSignature,
} = require('../whoop-utils');

test('normalizeScopes keeps only WHOOP scopes PulseCheck can consume', () => {
  assert.deepEqual(
    normalizeScopes([
      'offline',
      'read:recovery',
      'read:sleep',
      'not-a-whoop-scope',
      'read:sleep',
    ]),
    ['offline', 'read:recovery', 'read:sleep']
  );
});

test('normalizeScopes falls back to the default WHOOP read scope set', () => {
  assert.deepEqual(normalizeScopes(['unknown']), DEFAULT_SCOPES);
});

test('buildAuthorizeUrl requests WHOOP OAuth code consent with offline scope', () => {
  const authorizeUrl = new URL(buildAuthorizeUrl({
    clientId: 'client-id',
    redirectUri: DEFAULT_WHOOP_REDIRECT_URI,
    scopes: ['offline', 'read:recovery', 'read:sleep'],
    state: 'state-token',
  }));

  assert.equal(authorizeUrl.origin, 'https://api.prod.whoop.com');
  assert.equal(authorizeUrl.pathname, '/oauth/oauth2/auth');
  assert.equal(authorizeUrl.searchParams.get('client_id'), 'client-id');
  assert.equal(authorizeUrl.searchParams.get('redirect_uri'), DEFAULT_WHOOP_REDIRECT_URI);
  assert.equal(authorizeUrl.searchParams.get('response_type'), 'code');
  assert.equal(authorizeUrl.searchParams.get('state'), 'state-token');
  assert.equal(authorizeUrl.searchParams.get('scope'), 'offline read:recovery read:sleep');
});

test('getRedirectUri defaults to the registered production WHOOP callback', () => {
  const previousRedirectUri = process.env.WHOOP_REDIRECT_URI;
  const previousUrl = process.env.URL;
  delete process.env.WHOOP_REDIRECT_URI;
  process.env.URL = 'https://deploy-preview-123--fitwithpulse.netlify.app';

  try {
    assert.equal(getRedirectUri(), DEFAULT_WHOOP_REDIRECT_URI);
  } finally {
    if (previousRedirectUri === undefined) {
      delete process.env.WHOOP_REDIRECT_URI;
    } else {
      process.env.WHOOP_REDIRECT_URI = previousRedirectUri;
    }

    if (previousUrl === undefined) {
      delete process.env.URL;
    } else {
      process.env.URL = previousUrl;
    }
  }
});

test('verifyWebhookSignature validates WHOOP timestamp-plus-body HMAC signatures', () => {
  const rawBody = JSON.stringify({ user_id: 42, type: 'recovery.updated', id: 'recovery-1' });
  const timestamp = '1782750000';
  const secret = 'webhook-secret';
  const signature = buildWebhookSignature({ timestamp, rawBody, secret });

  assert.equal(
    verifyWebhookSignature({
      rawBody,
      secret,
      headers: {
        'X-WHOOP-Signature': signature,
        'X-WHOOP-Signature-Timestamp': timestamp,
      },
    }),
    true
  );
  assert.equal(
    verifyWebhookSignature({
      rawBody: `${rawBody} `,
      secret,
      headers: {
        'X-WHOOP-Signature': signature,
        'X-WHOOP-Signature-Timestamp': timestamp,
      },
    }),
    false
  );
});

test('toConnectionStatus returns a token-free WHOOP connection contract', () => {
  const status = toConnectionStatus({
    status: 'connected',
    requestedScopes: ['read:recovery'],
    grantedScopes: ['read:recovery'],
    connectedAt: 123,
    updatedAt: 456,
    whoopUserId: 789,
    accessToken: 'private-access-token',
    refreshToken: 'private-refresh-token',
    lastImportedDomains: ['recovery', 'activity'],
  });

  assert.equal(status.connected, true);
  assert.equal(status.provider, 'whoop');
  assert.equal(status.sourceFamily, 'whoop');
  assert.equal(status.whoopUserId, 789);
  assert.deepEqual(status.lastImportedDomains, ['recovery', 'activity']);
  assert.equal(Object.prototype.hasOwnProperty.call(status, 'accessToken'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(status, 'refreshToken'), false);
});
