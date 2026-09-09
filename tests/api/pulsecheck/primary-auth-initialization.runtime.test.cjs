const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const test = require('node:test');
const vm = require('node:vm');
const { JSDOM } = require('jsdom');
const ts = require('typescript');

const repoRoot = path.resolve(__dirname, '../../..');
// Node's default Firebase entry uses different persistence defaults. Exercise
// the installed browser SDK that runs on the actual sign-in page.
const firebaseAuthRequire = createRequire(require.resolve('firebase/auth'));
const browserAuthPath = path.join(
  path.dirname(firebaseAuthRequire.resolve('@firebase/auth/package.json')),
  'dist/browser-cjs/index.js'
);
const browserAuth = require(browserAuthPath);
const { initializeApp, deleteApp } = createRequire(browserAuthPath)('@firebase/app');

const loadTypeScript = (relativePath, imports, globals = {}) => {
  const filename = path.join(repoRoot, relativePath);
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: filename,
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(output, {
    module,
    exports: module.exports,
    require(name) {
      assert.ok(Object.hasOwn(imports, name), `Unexpected import: ${name}`);
      return imports[name];
    },
    ...globals,
  }, { filename });
  return module.exports;
};

const observeSettlement = async (promise, milliseconds) => {
  let timer;
  try {
    return await Promise.race([
      promise.then(() => 'resolved'),
      new Promise(resolve => {
        timer = setTimeout(() => resolve('pending'), milliseconds);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
};

const installStalledBrowserStorage = t => {
  const dom = new JSDOM('', { url: 'https://fitwithpulse.test/admin' });
  Object.defineProperty(dom.window.navigator, 'userAgent', {
    value: 'Mozilla/5.0 Chrome/128.0.0.0 Safari/537.36',
  });
  const openedDatabases = [];
  const indexedDB = {
    open(name) {
      openedDatabases.push(name);
      // A browser can leave an IndexedDB open request pending indefinitely.
      return { addEventListener() {} };
    },
  };
  const replacements = {
    window: dom.window,
    document: dom.window.document,
    navigator: dom.window.navigator,
    location: dom.window.location,
    localStorage: dom.window.localStorage,
    sessionStorage: dom.window.sessionStorage,
    indexedDB,
    fetch: () => { throw new Error('Unexpected network request in auth initialization test'); },
  };
  const originals = new Map();
  for (const [name, value] of Object.entries(replacements)) {
    originals.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
  }
  t.after(() => {
    for (const [name, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
    }
    dom.window.close();
  });
  return { openedDatabases, window: dom.window };
};

let nextApp = 0;
const createTestApp = t => {
  const app = initializeApp({
    apiKey: 'fake-primary-auth-regression-key',
    authDomain: 'auth.fitwithpulse.test',
    projectId: 'primary-auth-regression',
  }, `primary-auth-regression-${++nextApp}`);
  t.after(() => deleteApp(app));
  return app;
};

test('default browser getAuth blocks readiness and queued persistence when IndexedDB stalls', async t => {
  const { openedDatabases } = installStalledBrowserStorage(t);
  const auth = browserAuth.getAuth(createTestApp(t));
  const results = await Promise.all([
    observeSettlement(auth.authStateReady(), 75),
    observeSettlement(browserAuth.setPersistence(auth, browserAuth.browserLocalPersistence), 75),
  ]);

  assert.ok(openedDatabases.length > 0, 'The legacy path must exercise IndexedDB');
  assert.deepEqual(results, ['pending', 'pending']);
});

for (const isRemoteLoginSession of [false, true]) {
  const mode = isRemoteLoginSession ? 'SESSION' : 'LOCAL';
  test(`primary auth initializes with ${mode} storage despite stalled IndexedDB`, async t => {
    const { openedDatabases, window } = installStalledBrowserStorage(t);
    const { initializeBrowserAuth } = loadTypeScript(
      'src/api/firebase/initializeBrowserAuth.ts',
      { 'firebase/auth': browserAuth }
    );
    const auth = initializeBrowserAuth(createTestApp(t), isRemoteLoginSession);
    assert.equal(await observeSettlement(auth.authStateReady(), 1000), 'resolved');
    assert.equal(auth.currentUser, null);

    // Inspect the SDK's selected backend before changing persistence so the
    // remote-login case also guards the tab-only startup choice.
    const persistence = auth.persistenceManager.persistence;
    assert.equal(persistence.type, mode);
    const storageKey = `primary-auth-storage-check-${mode}`;
    await persistence._set(storageKey, 'test-value');
    const selectedStorage = isRemoteLoginSession ? window.sessionStorage : window.localStorage;
    const otherStorage = isRemoteLoginSession ? window.localStorage : window.sessionStorage;
    assert.equal(selectedStorage.getItem(storageKey), JSON.stringify('test-value'));
    assert.equal(otherStorage.getItem(storageKey), null);
    await persistence._remove(storageKey);

    assert.ok(auth._popupRedirectResolver instanceof browserAuth.browserPopupRedirectResolver);
    assert.equal(await observeSettlement(
      browserAuth.setPersistence(auth, browserAuth.browserLocalPersistence),
      1000
    ), 'resolved');
    assert.deepEqual(openedDatabases, []);
  });
}

const loadAuthMethods = ({ persistencePromise, signIn, scheduledTimers, clearedTimers }) =>
  loadTypeScript('src/api/firebase/auth/methods.ts', {
    'firebase/auth': {
      browserLocalPersistence: { type: 'LOCAL' },
      setPersistence: () => persistencePromise,
      signInWithEmailAndPassword: signIn,
    },
    'firebase/firestore': {},
    '../config': { auth: {}, db: {} },
    './username': {},
    '../user': {},
    '../../../utils/appVersioning': {},
    './accountLinking': {},
    '../../../utils/authSessionCleanup': { clearStalePulseAuthKeys() {} },
  }, {
    setTimeout(callback, delay) {
      const timer = { callback, delay };
      scheduledTimers.push(timer);
      return timer;
    },
    clearTimeout(timer) { clearedTimers.push(timer); },
  }).authMethods;

test('a persistence timeout rejects the attempt and never submits credentials after late recovery', async () => {
  let resolvePersistence;
  const persistencePromise = new Promise(resolve => { resolvePersistence = resolve; });
  const credentialCalls = [];
  const scheduledTimers = [];
  const clearedTimers = [];
  const authMethods = loadAuthMethods({
    persistencePromise,
    signIn: (...args) => { credentialCalls.push(args); },
    scheduledTimers,
    clearedTimers,
  });

  const attempt = authMethods.signInWithEmail('test@example.com', 'fake-test-password');
  const rejection = assert.rejects(attempt, { code: 'pulse/auth-timeout' });
  assert.equal(scheduledTimers.length, 1);
  assert.equal(scheduledTimers[0].delay, 10000);
  scheduledTimers[0].callback();
  await rejection;
  assert.deepEqual(clearedTimers, scheduledTimers);
  assert.equal(credentialCalls.length, 0);

  resolvePersistence();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(credentialCalls.length, 0, 'A timed-out attempt must remain canceled');
});

test('ready persistence submits credentials once and clears the startup timeout', async () => {
  const credentialCalls = [];
  const credential = { user: { uid: 'test-user' } };
  const scheduledTimers = [];
  const clearedTimers = [];
  const authMethods = loadAuthMethods({
    persistencePromise: Promise.resolve(),
    signIn: (...args) => {
      credentialCalls.push(args);
      return Promise.resolve(credential);
    },
    scheduledTimers,
    clearedTimers,
  });

  assert.equal(await authMethods.signInWithEmail('test@example.com', 'fake-test-password'), credential);
  assert.equal(credentialCalls.length, 1);
  assert.deepEqual(credentialCalls[0].slice(1), ['test@example.com', 'fake-test-password']);
  assert.deepEqual(clearedTimers, scheduledTimers);
});
