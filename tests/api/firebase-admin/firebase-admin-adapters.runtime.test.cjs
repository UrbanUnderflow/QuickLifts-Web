const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Module = require('node:module');
const { spawnSync } = require('node:child_process');

const repoRoot = '/Users/tremainegrant/Documents/GitHub/QuickLifts-Web';
const netlifyConfigPath = path.join(repoRoot, 'netlify/functions/config/firebase.js');

function findFileRecursive(rootDir, fileName) {
  const stack = [rootDir];

  while (stack.length > 0) {
    const current = stack.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const nextPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(nextPath);
        continue;
      }
      if (entry.isFile() && entry.name === fileName) {
        return nextPath;
      }
    }
  }

  return null;
}

function compileSrcFirebaseAdminRuntime() {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ql-firebase-admin-runtime-'));
  const compileArgs = [
    'tsc',
    '--module', 'commonjs',
    '--target', 'es2020',
    '--moduleResolution', 'node',
    '--esModuleInterop',
    '--allowJs',
    '--skipLibCheck',
    '--pretty', 'false',
    '--outDir', outDir,
    path.join(repoRoot, 'src/lib/firebase-admin.ts'),
  ];

  const result = spawnSync('npx', compileArgs, {
    cwd: repoRoot,
    encoding: 'utf8',
  });

  const candidatePath = findFileRecursive(outDir, 'firebase-admin.js');
  if (!candidatePath) {
    throw new Error(
      `Failed to compile src/lib/firebase-admin.ts:\n${result.stderr || result.stdout || 'Unknown tsc failure'}`
    );
  }

  return {
    outDir,
    compiledPath: candidatePath,
  };
}

function withModuleMocks(mocks, loadFn) {
  const originalLoad = Module._load;

  Module._load = function patchedLoad(request, parent, isMain) {
    if (Object.prototype.hasOwnProperty.call(mocks, request)) {
      return mocks[request];
    }
    return originalLoad.call(this, request, parent, isMain);
  };

  try {
    return loadFn();
  } finally {
    Module._load = originalLoad;
  }
}

function withPatchedEnv(patch, run) {
  const keys = [
    'NODE_ENV',
    'NEXT_PUBLIC_E2E_FORCE_DEV_FIREBASE',
    'NEXT_PUBLIC_DEV_FIREBASE_PROJECT_ID',
    'FIREBASE_PROJECT_ID',
    'FIREBASE_SERVICE_ACCOUNT',
    'FIREBASE_PRIVATE_KEY',
    'FIREBASE_SECRET_KEY',
    'FIREBASE_PRIVATE_KEY_1',
    'FIREBASE_PRIVATE_KEY_2',
    'FIREBASE_PRIVATE_KEY_3',
    'FIREBASE_PRIVATE_KEY_4',
    'FIREBASE_CLIENT_EMAIL',
    'DEV_FIREBASE_PROJECT_ID',
    'DEV_FIREBASE_PRIVATE_KEY',
    'DEV_FIREBASE_SECRET_KEY',
    'DEV_FIREBASE_CLIENT_EMAIL',
  ];

  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));

  try {
    for (const key of keys) {
      if (Object.prototype.hasOwnProperty.call(patch, key)) {
        const value = patch[key];
        if (value == null) {
          delete process.env[key];
        } else {
          process.env[key] = value;
        }
      } else {
        delete process.env[key];
      }
    }
    return run();
  } finally {
    for (const key of keys) {
      const value = previous[key];
      if (value == null) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

function withMutedConsole(run) {
  const original = {
    log: console.log,
    warn: console.warn,
    error: console.error,
  };

  console.log = () => {};
  console.warn = () => {};
  console.error = () => {};

  try {
    return run();
  } finally {
    console.log = original.log;
    console.warn = original.warn;
    console.error = original.error;
  }
}

function createFirebaseAdminMock() {
  const state = {
    initializeCalls: [],
    certCalls: [],
    applicationDefaultCalls: 0,
    firestoreCalls: [],
  };
  const apps = [];
  const firestoreByApp = new Map();

  function makeFirestore(appName) {
    if (!firestoreByApp.has(appName)) {
      const firestore = {
        appName,
        collection(name) {
          return `${this.appName}:${name}`;
        },
        doc(docPath) {
          return `${this.appName}:doc:${docPath}`;
        },
      };
      firestoreByApp.set(appName, firestore);
    }
    return firestoreByApp.get(appName);
  }

  function findApp(name) {
    return apps.find((app) => app.name === name) || null;
  }

  function createApp(name, options) {
    return {
      name,
      options,
      firestore() {
        state.firestoreCalls.push(name);
        return makeFirestore(name);
      },
      auth() {
        return {
          appName: name,
          async verifyIdToken(token) {
            return { uid: `${name}:uid`, token };
          },
        };
      },
    };
  }

  const admin = {
    apps,
    credential: {
      cert(serviceAccount) {
        state.certCalls.push(serviceAccount);
        return { kind: 'cert', serviceAccount };
      },
      applicationDefault() {
        state.applicationDefaultCalls += 1;
        return { kind: 'applicationDefault' };
      },
    },
    initializeApp(options, name) {
      const appName = name || '[DEFAULT]';
      if (findApp(appName)) {
        throw new Error(`Duplicate app: ${appName}`);
      }
      const app = createApp(appName, options || {});
      apps.push(app);
      state.initializeCalls.push({ name: appName, options: options || {} });
      return app;
    },
    app(name) {
      const appName = name || '[DEFAULT]';
      const existing = findApp(appName);
      if (!existing) {
        throw new Error(`Missing app: ${appName}`);
      }
      return existing;
    },
  };

  const firestore = (app) => {
    if (app) {
      return app.firestore();
    }
    return admin.app().firestore();
  };
  firestore.FieldValue = {
    serverTimestamp() {
      return 'server-timestamp';
    },
  };

  admin.firestore = firestore;
  admin.auth = (app) => (app ? app.auth() : admin.app().auth());

  return { admin, state };
}

function createFirebaseAdminRegistryMock(admin) {
  const state = {
    defaultCalls: [],
    namedCalls: [],
  };

  const APP_NAMES = {
    prod: 'pulsecheck-prod-admin',
    dev: 'pulsecheck-dev-admin',
  };

  function ensureDefaultFirebaseAdminApp(options = {}) {
    state.defaultCalls.push(options);
    try {
      return admin.app();
    } catch (_error) {
      return admin.initializeApp({ fromRegistry: 'default', options });
    }
  }

  function getNamedFirebaseAdminApp(options = {}) {
    state.namedCalls.push(options);
    const appName = options.appName || (options.mode === 'dev' ? APP_NAMES.dev : APP_NAMES.prod);
    try {
      return admin.app(appName);
    } catch (_error) {
      return admin.initializeApp({ fromRegistry: 'named', options }, appName);
    }
  }

  return {
    registry: {
      APP_NAMES,
      admin,
      ensureDefaultFirebaseAdminApp,
      getNamedFirebaseAdminApp,
    },
    state,
  };
}

function loadSrcFirebaseAdminModule(firebaseAdminMock, firebaseAdminRegistryMock) {
  const { outDir, compiledPath } = compileSrcFirebaseAdminRuntime();
  for (const cacheKey of Object.keys(require.cache)) {
    if (cacheKey.startsWith(outDir)) {
      delete require.cache[cacheKey];
    }
  }

  return withModuleMocks(
    {
      'firebase-admin': firebaseAdminMock,
      './server/firebase/app-registry': firebaseAdminRegistryMock,
    },
    () => withMutedConsole(() => require(compiledPath))
  );
}

function loadNetlifyFirebaseConfig(firebaseAdminMock, firebaseAdminRegistryMock) {
  delete require.cache[netlifyConfigPath];

  return withModuleMocks(
    {
      'firebase-admin': firebaseAdminMock,
      '../../../src/lib/server/firebase/app-registry': firebaseAdminRegistryMock,
    },
    () => withMutedConsole(() => require(netlifyConfigPath))
  );
}

test('src/lib/firebase-admin initializes the default app and exposes the dev named-app contract', () => {
  withPatchedEnv(
    {
      NODE_ENV: 'test',
      NEXT_PUBLIC_E2E_FORCE_DEV_FIREBASE: 'false',
      NEXT_PUBLIC_DEV_FIREBASE_PROJECT_ID: 'quicklifts-dev-contract',
      FIREBASE_PROJECT_ID: 'quicklifts-prod-contract',
      FIREBASE_CLIENT_EMAIL: 'firebase-adminsdk@test.quicklifts',
      FIREBASE_SECRET_KEY: '"line-1\\nline-2"',
      FIREBASE_SERVICE_ACCOUNT: null,
      FIREBASE_PRIVATE_KEY: null,
      FIREBASE_PRIVATE_KEY_1: null,
      FIREBASE_PRIVATE_KEY_2: null,
      FIREBASE_PRIVATE_KEY_3: null,
      FIREBASE_PRIVATE_KEY_4: null,
    },
    () => {
      const { admin, state } = createFirebaseAdminMock();
      const { registry, state: registryState } = createFirebaseAdminRegistryMock(admin);
      const runtime = loadSrcFirebaseAdminModule(admin, registry);
      const exportedAdmin = runtime.default;

      assert.equal(typeof exportedAdmin.app, 'function');
      assert.equal(exportedAdmin.default, admin);
      assert.equal(typeof runtime.getFirebaseAdminApp, 'function');
      assert.equal(registryState.defaultCalls.length, 1);
      assert.deepEqual(registryState.defaultCalls[0], {
        mode: 'prod',
        runtime: 'next-api',
        allowApplicationDefault: true,
        failClosed: false,
      });
      assert.equal(state.initializeCalls.length, 1);
      assert.equal(state.initializeCalls[0].name, '[DEFAULT]');

      const defaultApp = runtime.getFirebaseAdminApp();
      const devApp = runtime.getFirebaseAdminApp(true);
      const devAppAgain = runtime.getFirebaseAdminApp(true);

      assert.equal(defaultApp.name, '[DEFAULT]');
      assert.equal(exportedAdmin.app().name, '[DEFAULT]');
      assert.equal(devApp.name, 'pulsecheck-dev-admin');
      assert.equal(devAppAgain, devApp);
      assert.deepEqual(registryState.defaultCalls[1], {
        mode: 'prod',
        runtime: 'next-api',
        allowApplicationDefault: true,
        failClosed: false,
      });
      assert.deepEqual(registryState.namedCalls[0], {
        mode: 'dev',
        appName: 'pulsecheck-dev-admin',
        runtime: 'next-api',
        allowApplicationDefault: true,
        failClosed: false,
      });
      assert.equal(registryState.namedCalls.length, 2);
      assert.equal(state.initializeCalls.length, 2);
    }
  );
});

test('src/lib/firebase-admin honors NEXT_PUBLIC_E2E_FORCE_DEV_FIREBASE for default app selection', () => {
  withPatchedEnv(
    {
      NODE_ENV: 'test',
      NEXT_PUBLIC_E2E_FORCE_DEV_FIREBASE: 'true',
      NEXT_PUBLIC_DEV_FIREBASE_PROJECT_ID: 'quicklifts-dev-e2e',
      FIREBASE_PROJECT_ID: null,
      FIREBASE_CLIENT_EMAIL: null,
      FIREBASE_SECRET_KEY: null,
      FIREBASE_SERVICE_ACCOUNT: null,
      FIREBASE_PRIVATE_KEY: null,
      FIREBASE_PRIVATE_KEY_1: null,
      FIREBASE_PRIVATE_KEY_2: null,
      FIREBASE_PRIVATE_KEY_3: null,
      FIREBASE_PRIVATE_KEY_4: null,
    },
    () => {
      const { admin, state } = createFirebaseAdminMock();
      const { registry, state: registryState } = createFirebaseAdminRegistryMock(admin);
      const runtime = loadSrcFirebaseAdminModule(admin, registry);

      assert.equal(runtime.getFirebaseAdminApp().name, '[DEFAULT]');
      assert.equal(registryState.defaultCalls.length, 2);
      assert.deepEqual(registryState.defaultCalls[0], {
        mode: 'dev',
        runtime: 'next-api',
        allowApplicationDefault: true,
        failClosed: false,
      });
      assert.equal(state.initializeCalls.length, 1);
      assert.equal(state.initializeCalls[0].name, '[DEFAULT]');
    }
  );
});

test('netlify/functions/config/firebase.js preserves export shape, headers, routing, and default db behavior', () => {
  withPatchedEnv(
    {
      NODE_ENV: 'test',
      FIREBASE_PROJECT_ID: 'quicklifts-prod-contract',
      FIREBASE_CLIENT_EMAIL: 'firebase-adminsdk@test.quicklifts',
      FIREBASE_SECRET_KEY: 'raw-prod-private-key',
      DEV_FIREBASE_PROJECT_ID: 'quicklifts-dev-contract',
      DEV_FIREBASE_CLIENT_EMAIL: null,
      DEV_FIREBASE_SECRET_KEY: null,
      DEV_FIREBASE_PRIVATE_KEY: null,
    },
    () => {
      const { admin, state } = createFirebaseAdminMock();
      const { registry, state: registryState } = createFirebaseAdminRegistryMock(admin);
      const runtime = loadNetlifyFirebaseConfig(admin, registry);

      assert.equal(runtime.admin, admin);
      assert.equal(typeof runtime.db.collection, 'function');
      assert.equal(typeof runtime.convertTimestamp, 'function');
      assert.equal(typeof runtime.isDevMode, 'function');
      assert.equal(typeof runtime.initializeFirebaseAdmin, 'function');
      assert.equal(typeof runtime.getFirebaseAdminApp, 'function');
      assert.deepEqual(runtime.headers, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      });

      assert.equal(state.initializeCalls.length, 1);
      assert.equal(state.initializeCalls[0].name, '[DEFAULT]');
      assert.deepEqual(registryState.defaultCalls[0], {
        mode: 'prod',
        runtime: 'netlify-function',
        allowApplicationDefault: true,
        failClosed: false,
      });

      const forcedDevRequest = {
        headers: {
          'x-force-dev-firebase': '1',
        },
      };
      const aliasedDevRequest = {
        headers: {
          'X-PulseCheck-Dev-Firebase': 'true',
        },
      };
      const localhostRequest = {
        headers: {
          origin: 'http://localhost:3000',
        },
      };
      const prodRequest = {
        headers: {
          origin: 'https://fitwithpulse.ai',
          referer: 'https://fitwithpulse.ai/admin',
        },
      };

      assert.equal(runtime.isDevMode(forcedDevRequest), true);
      assert.equal(runtime.isDevMode(aliasedDevRequest), true);
      assert.equal(runtime.isDevMode(localhostRequest), true);
      assert.equal(runtime.isDevMode(prodRequest), false);

      assert.equal(withMutedConsole(() => runtime.initializeFirebaseAdmin(forcedDevRequest)), admin);

      const devApp = runtime.getFirebaseAdminApp(forcedDevRequest);
      const prodApp = runtime.getFirebaseAdminApp(prodRequest);

      assert.equal(devApp.name, 'pulsecheck-dev-admin');
      assert.equal(prodApp.name, 'pulsecheck-prod-admin');
      assert.equal(runtime.getFirebaseAdminApp(forcedDevRequest), devApp);
      assert.equal(runtime.getFirebaseAdminApp(prodRequest), prodApp);
      assert.ok(registryState.namedCalls.length >= 5);
      assert.deepEqual(registryState.namedCalls[0], {
        mode: 'dev',
        appName: 'pulsecheck-dev-admin',
        runtime: 'netlify-function',
        allowApplicationDefault: true,
        failClosed: false,
      });
      assert.deepEqual(registryState.namedCalls[1], {
        mode: 'dev',
        appName: 'pulsecheck-dev-admin',
        runtime: 'netlify-function',
        allowApplicationDefault: true,
        failClosed: false,
      });
      assert.deepEqual(registryState.namedCalls[2], {
        mode: 'prod',
        appName: 'pulsecheck-prod-admin',
        runtime: 'netlify-function',
        allowApplicationDefault: true,
        failClosed: false,
      });
      assert.equal(registryState.defaultCalls.length, 1);

      assert.equal(runtime.db.collection('users'), '[DEFAULT]:users');
      assert.equal(admin.firestore(devApp).collection('users'), 'pulsecheck-dev-admin:users');
      assert.equal(admin.firestore(prodApp).collection('users'), 'pulsecheck-prod-admin:users');

      assert.equal(runtime.convertTimestamp(1700000000), new Date(1700000000 * 1000).toISOString());
      assert.equal(
        runtime.convertTimestamp(new Date('2026-03-29T00:00:00.000Z')),
        '2026-03-29T00:00:00.000Z'
      );
      assert.equal(runtime.convertTimestamp(null), null);
    }
  );
});
