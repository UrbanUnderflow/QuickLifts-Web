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

const googleHealthUtilsPath = require.resolve('../google-health-utils');
const googleSecretManagerUtilsPath = require.resolve('../google-secret-manager-utils');

async function withFreshGoogleHealthUtils({ env = {}, secretManager } = {}, callback) {
  const envKeys = [
    'GOOGLE_HEALTH_CLIENT_ID',
    'GOOGLE_HEALTH_CLIENT_SECRET',
    'GOOGLE_HEALTH_OAUTH_SECRET_NAME',
    'GOOGLE_HEALTH_SECRET_MANAGER_PROJECT_ID',
    'GOOGLE_HEALTH_ALLOW_ENV_CREDENTIALS_FALLBACK',
    'GOOGLE_SECRET_MANAGER_PROJECT_ID',
    'NODE_ENV',
    'CONTEXT',
    'NETLIFY',
  ];
  const previousEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));

  for (const key of envKeys) {
    delete process.env[key];
  }
  Object.entries(env).forEach(([key, value]) => {
    process.env[key] = value;
  });

  delete require.cache[googleHealthUtilsPath];
  delete require.cache[googleSecretManagerUtilsPath];
  require.cache[googleSecretManagerUtilsPath] = {
    id: googleSecretManagerUtilsPath,
    filename: googleSecretManagerUtilsPath,
    loaded: true,
    exports: secretManager,
  };

  try {
    const utils = require('../google-health-utils');
    return await callback(utils);
  } finally {
    delete require.cache[googleHealthUtilsPath];
    delete require.cache[googleSecretManagerUtilsPath];
    Object.entries(previousEnv).forEach(([key, value]) => {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    });
  }
}

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

test('getOauthCredentials reads the Fitbit OAuth client from Secret Manager first', async () => {
  const calls = [];

  await withFreshGoogleHealthUtils({
    env: {
      NODE_ENV: 'development',
      GOOGLE_HEALTH_CLIENT_ID: 'env-client-id',
      GOOGLE_HEALTH_CLIENT_SECRET: 'env-client-secret',
    },
    secretManager: {
      getSecretManagerSecret: async (secretName, options) => {
        calls.push({ secretName, options });
        return JSON.stringify({
          client_id: 'secret-client-id',
          client_secret: 'secret-client-secret',
        });
      },
    },
  }, async ({ getOauthCredentials }) => {
    assert.deepEqual(await getOauthCredentials(), {
      clientId: 'secret-client-id',
      clientSecret: 'secret-client-secret',
    });
  });

  assert.deepEqual(calls, [{
    secretName: 'GOOGLE_HEALTH_OAUTH_CLIENT',
    options: { projectId: 'quicklifts-dd3f1' },
  }]);
});

test('getOauthCredentials falls back to env credentials when Secret Manager is unavailable', async () => {
  await withFreshGoogleHealthUtils({
    env: {
      NODE_ENV: 'development',
      GOOGLE_HEALTH_CLIENT_ID: 'env-client-id',
      GOOGLE_HEALTH_CLIENT_SECRET: 'env-client-secret',
    },
    secretManager: {
      getSecretManagerSecret: async () => {
        throw new Error('Secret unavailable');
      },
    },
  }, async ({ getOauthCredentials }) => {
    assert.deepEqual(await getOauthCredentials(), {
      clientId: 'env-client-id',
      clientSecret: 'env-client-secret',
    });
  });
});

test('getOauthCredentials does not fall back to env credentials in production', async () => {
  await withFreshGoogleHealthUtils({
    env: {
      NODE_ENV: 'production',
      GOOGLE_HEALTH_CLIENT_ID: 'env-client-id',
      GOOGLE_HEALTH_CLIENT_SECRET: 'env-client-secret',
    },
    secretManager: {
      getSecretManagerSecret: async () => {
        throw new Error('Secret unavailable');
      },
    },
  }, async ({ getOauthCredentials }) => {
    await assert.rejects(getOauthCredentials(), (error) => {
      assert.equal(error.errorCode, 'GOOGLE_HEALTH_CONFIG_UNAVAILABLE');
      return true;
    });
  });
});
