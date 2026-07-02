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

const whoopUtilsPath = require.resolve('../whoop-utils');
const googleSecretManagerUtilsPath = require.resolve('../google-secret-manager-utils');

async function withFreshWhoopUtils({ env = {}, secretManager } = {}, callback) {
  const envKeys = [
    'WHOOP_CLIENT_ID',
    'WHOOP_CLIENT_SECRET',
    'WHOOP_CLIENT_SECRET_NAME',
    'WHOOP_OAUTH_SECRET_NAME',
    'WHOOP_WEBHOOK_SECRET',
    'WHOOP_WEBHOOK_SECRET_NAME',
    'WHOOP_SECRET_MANAGER_PROJECT_ID',
    'WHOOP_ALLOW_ENV_CREDENTIALS_FALLBACK',
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

  delete require.cache[whoopUtilsPath];
  delete require.cache[googleSecretManagerUtilsPath];
  require.cache[googleSecretManagerUtilsPath] = {
    id: googleSecretManagerUtilsPath,
    filename: googleSecretManagerUtilsPath,
    loaded: true,
    exports: secretManager || {
      getSecretManagerSecret: async () => {
        throw new Error('Secret Manager mock not configured');
      },
    },
  };

  try {
    const utils = require('../whoop-utils');
    return await callback(utils);
  } finally {
    delete require.cache[whoopUtilsPath];
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

test('getOauthCredentials reads the WHOOP OAuth secret from Secret Manager first', async () => {
  const calls = [];

  await withFreshWhoopUtils({
    env: {
      NODE_ENV: 'development',
      WHOOP_CLIENT_ID: 'env-client-id',
      WHOOP_CLIENT_SECRET: 'env-client-secret',
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
    secretName: 'WHOOP_CLIENT_SECRET',
    options: { projectId: 'quicklifts-dd3f1' },
  }]);
});

test('getOauthCredentials accepts a raw Secret Manager client secret with the public WHOOP client id', async () => {
  await withFreshWhoopUtils({
    env: {
      NODE_ENV: 'production',
    },
    secretManager: {
      getSecretManagerSecret: async () => 'secret-manager-client-secret',
    },
  }, async ({ getOauthCredentials }) => {
    assert.deepEqual(await getOauthCredentials(), {
      clientId: '7eda3ec3-47c9-46a5-be57-6c4612bd9b82',
      clientSecret: 'secret-manager-client-secret',
    });
  });
});

test('getOauthCredentials falls back to env credentials for local development', async () => {
  await withFreshWhoopUtils({
    env: {
      NODE_ENV: 'development',
      WHOOP_CLIENT_ID: 'env-client-id',
      WHOOP_CLIENT_SECRET: 'env-client-secret',
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

test('getOauthCredentials does not fall back to env client secrets in production', async () => {
  await withFreshWhoopUtils({
    env: {
      NODE_ENV: 'production',
      WHOOP_CLIENT_ID: 'env-client-id',
      WHOOP_CLIENT_SECRET: 'env-client-secret',
    },
    secretManager: {
      getSecretManagerSecret: async () => {
        throw new Error('Secret unavailable');
      },
    },
  }, async ({ getOauthCredentials }) => {
    await assert.rejects(getOauthCredentials(), (error) => {
      assert.equal(error.errorCode, 'WHOOP_CONFIG_UNAVAILABLE');
      return true;
    });
  });
});
