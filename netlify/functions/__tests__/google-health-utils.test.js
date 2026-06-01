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
  buildAuthorizeUrl,
  buildConnectionDocId,
  normalizeScopes,
  toConnectionStatus,
} = require('../google-health-utils');

test('normalizeScopes accepts full Google Health scopes and short suffixes', () => {
  assert.deepEqual(
    normalizeScopes([
      'https://www.googleapis.com/auth/googlehealth.sleep.readonly',
      'activity_and_fitness.readonly',
      'not-a-real-scope',
      'sleep.readonly',
    ]),
    [
      'https://www.googleapis.com/auth/googlehealth.sleep.readonly',
      'https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly',
    ]
  );
});

test('normalizeScopes falls back to the default read-only Google Health scope set', () => {
  assert.deepEqual(normalizeScopes(['unknown']), [
    'https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly',
    'https://www.googleapis.com/auth/googlehealth.health_metrics_and_measurements.readonly',
    'https://www.googleapis.com/auth/googlehealth.sleep.readonly',
    'https://www.googleapis.com/auth/googlehealth.profile.readonly',
  ]);
});

test('buildAuthorizeUrl requests offline Google OAuth consent for Google Health', () => {
  const authorizeUrl = new URL(buildAuthorizeUrl({
    clientId: 'client-id',
    redirectUri: 'https://fitwithpulse.ai/.netlify/functions/google-health-callback',
    scopes: ['https://www.googleapis.com/auth/googlehealth.sleep.readonly'],
    state: 'state-token',
  }));

  assert.equal(authorizeUrl.origin, 'https://accounts.google.com');
  assert.equal(authorizeUrl.pathname, '/o/oauth2/v2/auth');
  assert.equal(authorizeUrl.searchParams.get('client_id'), 'client-id');
  assert.equal(authorizeUrl.searchParams.get('redirect_uri'), 'https://fitwithpulse.ai/.netlify/functions/google-health-callback');
  assert.equal(authorizeUrl.searchParams.get('response_type'), 'code');
  assert.equal(authorizeUrl.searchParams.get('access_type'), 'offline');
  assert.equal(authorizeUrl.searchParams.get('include_granted_scopes'), 'true');
  assert.equal(authorizeUrl.searchParams.get('prompt'), 'consent');
  assert.equal(authorizeUrl.searchParams.get('state'), 'state-token');
  assert.equal(authorizeUrl.searchParams.get('scope'), 'https://www.googleapis.com/auth/googlehealth.sleep.readonly');
});

test('toConnectionStatus returns a token-free Fitbit status contract', () => {
  const status = toConnectionStatus({
    status: 'connected',
    grantedScopes: ['scope-one'],
    requestedScopes: ['scope-two'],
    connectedAt: 123,
    accessToken: 'private-access-token',
    refreshToken: 'private-refresh-token',
    healthUserId: 'health-user-id',
    legacyUserId: 'legacy-user-id',
    lastImportedDomains: ['recovery', 'activity'],
  });

  assert.equal(status.connected, true);
  assert.equal(status.provider, 'google_health');
  assert.equal(status.sourceFamily, 'fitbit');
  assert.equal(status.healthUserId, 'health-user-id');
  assert.deepEqual(status.lastImportedDomains, ['recovery', 'activity']);
  assert.equal(Object.prototype.hasOwnProperty.call(status, 'accessToken'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(status, 'refreshToken'), false);
});

test('buildConnectionDocId keeps Google Health connections product-shareable', () => {
  assert.equal(buildConnectionDocId('athlete-1'), 'athlete-1_google_health');
});
