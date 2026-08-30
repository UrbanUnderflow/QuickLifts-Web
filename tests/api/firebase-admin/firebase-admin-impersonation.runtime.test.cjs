const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '../../..');
const credentialSourcePath = path.join(repoRoot, 'src/lib/server/firebase/credential-source.js');
const appRegistryPath = path.join(repoRoot, 'src/lib/server/firebase/app-registry.js');

const envKeys = [
  'NODE_ENV',
  'DEV_FIREBASE_CLIENT_EMAIL',
  'DEV_FIREBASE_IMPERSONATE_SERVICE_ACCOUNT',
  'DEV_FIREBASE_PRIVATE_KEY',
  'DEV_FIREBASE_PROJECT_ID',
  'DEV_FIREBASE_SECRET_KEY',
  'DEV_FIREBASE_SERVICE_ACCOUNT',
  'FIREBASE_CLIENT_EMAIL',
  'FIREBASE_PRIVATE_KEY',
  'FIREBASE_PROJECT_ID',
  'FIREBASE_SECRET_KEY',
  'FIREBASE_SERVICE_ACCOUNT',
  'FIREBASE_SERVICE_ACCOUNT_KEY',
  'NEXT_PUBLIC_DEV_FIREBASE_PROJECT_ID',
  'NEXT_PUBLIC_E2E_FORCE_DEV_FIREBASE',
];

function withEnv(values, run) {
  const previous = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));
  try {
    envKeys.forEach((key) => delete process.env[key]);
    Object.entries(values).forEach(([key, value]) => {
      process.env[key] = value;
    });
    return run();
  } finally {
    envKeys.forEach((key) => {
      if (previous[key] == null) delete process.env[key];
      else process.env[key] = previous[key];
    });
  }
}

function withoutConsoleNoise(run) {
  const original = { info: console.info, warn: console.warn, error: console.error };
  console.info = () => {};
  console.warn = () => {};
  console.error = () => {};
  try {
    return run();
  } finally {
    console.info = original.info;
    console.warn = original.warn;
    console.error = original.error;
  }
}

test('dev Firebase resolves to a short-lived impersonated identity without a second private key', () => {
  withEnv({
    DEV_FIREBASE_PROJECT_ID: 'quicklifts-dev-contract',
    DEV_FIREBASE_IMPERSONATE_SERVICE_ACCOUNT: 'nora-runner@quicklifts-dev-contract.iam.gserviceaccount.com',
    FIREBASE_PROJECT_ID: 'quicklifts-prod-contract',
    FIREBASE_CLIENT_EMAIL: 'source@quicklifts-prod-contract.iam.gserviceaccount.com',
    FIREBASE_SECRET_KEY: '-----BEGIN PRIVATE KEY-----\nsource\n-----END PRIVATE KEY-----\n',
  }, () => {
    delete require.cache[credentialSourcePath];
    const { resolveFirebaseAdminCredential } = require(credentialSourcePath);
    const resolved = resolveFirebaseAdminCredential({ mode: 'dev' });

    assert.equal(resolved.source, 'dev:service-account-impersonation');
    assert.equal(resolved.projectId, 'quicklifts-dev-contract');
    assert.equal(resolved.clientEmail, 'nora-runner@quicklifts-dev-contract.iam.gserviceaccount.com');
    assert.equal(resolved.privateKey, null);
    assert.equal(resolved.sourceCredential.clientEmail, 'source@quicklifts-prod-contract.iam.gserviceaccount.com');
    assert.match(resolved.sourceCredential.privateKey, /BEGIN PRIVATE KEY/);
  });
});

test('Firebase Admin exchanges the production identity for a short-lived dev credential', async () => {
  await withEnv({
    NODE_ENV: 'production',
    DEV_FIREBASE_PROJECT_ID: 'quicklifts-dev-contract',
    DEV_FIREBASE_IMPERSONATE_SERVICE_ACCOUNT: 'nora-runner@quicklifts-dev-contract.iam.gserviceaccount.com',
    FIREBASE_PROJECT_ID: 'quicklifts-prod-contract',
    FIREBASE_CLIENT_EMAIL: 'source@quicklifts-prod-contract.iam.gserviceaccount.com',
    FIREBASE_SECRET_KEY: '-----BEGIN PRIVATE KEY-----\nsource\n-----END PRIVATE KEY-----\n',
  }, async () => {
    const state = { jwtOptions: null, impersonatedOptions: null, initializeOptions: null };
    const firebaseAdmin = {
      apps: [],
      credential: {
        cert() {
          throw new Error('The dev app must not use a copied private key.');
        },
        applicationDefault() {
          throw new Error('The production runtime must fail closed instead of using ambient credentials.');
        },
      },
      app() {
        throw new Error('No default app');
      },
      initializeApp(options, name) {
        state.initializeOptions = options;
        const app = { name: name || '[DEFAULT]', options };
        this.apps.push(app);
        return app;
      },
    };
    class JWT {
      constructor(options) {
        state.jwtOptions = options;
      }
    }
    class Impersonated {
      constructor(options) {
        state.impersonatedOptions = options;
      }
      async getAccessToken() {
        return { token: 'short-lived-test-token' };
      }
    }

    const originalLoad = Module._load;
    Module._load = function patchedLoad(request, parent, isMain) {
      if (request === 'firebase-admin') return firebaseAdmin;
      if (request === 'google-auth-library') return { Impersonated, JWT };
      return originalLoad.call(this, request, parent, isMain);
    };

    try {
      delete require.cache[credentialSourcePath];
      delete require.cache[appRegistryPath];
      const registry = withoutConsoleNoise(() => require(appRegistryPath));
      const app = withoutConsoleNoise(() => registry.getNamedFirebaseAdminApp({
        mode: 'dev',
        appName: 'pulsecheck-dev-admin',
        runtime: 'test',
        allowApplicationDefault: false,
        failClosed: true,
      }));

      assert.equal(app.name, 'pulsecheck-dev-admin');
      assert.equal(state.initializeOptions.projectId, 'quicklifts-dev-contract');
      assert.equal(state.jwtOptions.email, 'source@quicklifts-prod-contract.iam.gserviceaccount.com');
      assert.equal(
        state.impersonatedOptions.targetPrincipal,
        'nora-runner@quicklifts-dev-contract.iam.gserviceaccount.com',
      );
      assert.deepEqual(await state.initializeOptions.credential.getAccessToken(), {
        access_token: 'short-lived-test-token',
        expires_in: 3300,
      });
    } finally {
      Module._load = originalLoad;
      delete require.cache[credentialSourcePath];
      delete require.cache[appRegistryPath];
    }
  });
});
