const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');

const source = fs.readFileSync(path.resolve(__dirname, '../../../src/components/SignInModal.tsx'), 'utf8');
const ast = ts.createSourceFile('SignInModal.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const declarations = new Map();
function collect(node) {
  if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
    declarations.set(node.name.text, `const ${node.getText(ast)};`);
  }
  ts.forEachChild(node, collect);
}
collect(ast);

// Run the production handlers with deterministic timers and service responses.
// No Firebase calls, emails, browser storage, or production accounts are used.
const handlerCode = ts.transpileModule([
  ...['AUTH_STEP_TIMEOUT_MS', 'withAuthTimeout', 'handleSubmit', 'submitForm'].map(name => declarations.get(name)),
  'globalThis.submit = handleSubmit;',
].join('\n'), { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText;

const deferred = () => {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
};
const flush = () => new Promise(resolve => setImmediate(resolve));

function harness(overrides = {}) {
  const timers = new Map();
  const calls = [];
  let nextTimerId = 0;
  const user = { uid: 'test-user', email: 'test@example.com' };
  const profile = { id: user.uid, email: user.email, username: 'test-user', subscriptionType: 'unsubscribed' };
  const context = {
    Error,
    console: { log() {}, error() {} },
    setTimeout(callback) { const id = ++nextTimerId; timers.set(id, callback); return id; },
    clearTimeout(id) { timers.delete(id); },
    isLoading: false,
    authAttemptInProgress: { current: false },
    signUpStep: 'initial', isSignUp: false, emailAuthMode: 'password',
    email: user.email, password: 'test-password', inviteCode: '', hasAcceptedLegal: true,
    isAthleticMindHubFlow: false, shouldBypassSubscriptionGate: true,
    auth: { currentUser: null },
    SubscriptionType: { unsubscribed: 'unsubscribed' },
    setIsLoading(value) { context.loading = value; },
    setError(value) { context.error = value; },
    setShowError() {}, setErrors() {}, setIsSignUp() {}, setSignUpStep() {},
    setMagicLinkSent(value) { context.magicLinkSent = value; },
    onSignInError(error) { calls.push(['error', error.message]); },
    onSignUpError(error) { calls.push(['error', error.message]); },
    onClose() { calls.push(['close']); },
    router: { push(route) { calls.push(['route', route]); } },
    authService: {
      async signInWithEmail() { calls.push(['password']); return { user }; },
      async sendMagicLink() { calls.push(['magic']); },
    },
    async linkRememberedProviderCredential() { calls.push(['link']); },
    async assertAccountIsCanonical() { calls.push(['canonical']); return user; },
    userService: {
      async fetchUserFromFirestore() { calls.push(['profile']); return profile; },
      async getBetaUserAccess() { calls.push(['beta']); return false; },
    },
    userHasAcceptedCurrentLegal() { return true; },
    needsAthleticCouncilProfile() { return false; },
    openLegalAcceptanceStep() { calls.push(['legal']); },
    async handleSignInSuccess() { calls.push(['success']); },
    ...overrides,
  };
  vm.runInNewContext(handlerCode, context);
  return {
    context, calls, user,
    submit: () => context.submit({ preventDefault() {} }),
    expire() {
      assert.equal(timers.size, 1, 'the active auth stage has one recovery timer');
      [...timers.values()][0]();
    },
    timers,
  };
}

test('hung password sign-in releases controls and a late result cannot start account checks', async () => {
  const pending = deferred();
  let attempts = 0;
  const h = harness({ authService: { signInWithEmail() { attempts++; return pending.promise; } } });
  const first = h.submit();
  await h.submit();
  assert.equal(attempts, 1, 'same-render repeated submits share the active attempt lock');
  assert.equal(h.context.loading, true);
  h.expire();
  await first;
  assert.equal(h.context.loading, false);
  assert.equal(h.context.authAttemptInProgress.current, false);
  assert.match(h.context.error, /Sign-in is taking too long/);
  pending.resolve({ user: h.user });
  await flush();
  assert.deepEqual(h.calls.map(call => call[0]), ['error']);
  assert.equal(h.timers.size, 0);
});

test('hung canonical lookup releases controls and never starts a profile fetch after recovery', async () => {
  const pending = deferred();
  const h = harness({ assertAccountIsCanonical: () => pending.promise });
  const attempt = h.submit();
  await flush();
  h.expire();
  await attempt;
  assert.equal(h.context.loading, false);
  pending.resolve(h.user);
  await flush();
  assert.equal(h.calls.some(call => call[0] === 'profile'), false);
  assert.equal(h.calls.some(call => call[0] === 'success'), false);
});

test('hung magic-link send reports recovery without claiming a link was sent', async () => {
  const pending = deferred();
  const h = harness({ emailAuthMode: 'magic', authService: { sendMagicLink: () => pending.promise } });
  const attempt = h.submit();
  h.expire();
  await attempt;
  assert.equal(h.context.loading, false);
  assert.match(h.context.error, /Sending the magic link is taking too long/);
  pending.resolve();
  await flush();
  assert.equal(h.context.magicLinkSent, undefined);
});

test('invalid credentials release the attempt lock for another submission', async () => {
  const h = harness({ authService: { async signInWithEmail() { throw new Error('Invalid credentials'); } } });
  await h.submit();
  assert.equal(h.context.loading, false);
  assert.equal(h.context.error, 'Invalid credentials');
  h.context.authService.signInWithEmail = async () => ({ user: h.user });
  await h.submit();
  assert.equal(h.calls.some(call => call[0] === 'success'), true);
});

test('admin root keeps subscription bypass while legal acceptance still gates sign-in', async () => {
  for (const asPath of ['/admin', '/admin?view=users', '/admin/users']) {
    const route = { router: { pathname: asPath.split('?')[0], asPath } };
    vm.runInNewContext(`${declarations.get('isOnAdminPage')} globalThis.isAdmin = isOnAdminPage;`, route);
    assert.equal(route.isAdmin, true);
    const h = harness({ shouldBypassSubscriptionGate: route.isAdmin });
    await h.submit();
    assert.equal(h.calls.some(call => call[0] === 'success'), true);
    assert.equal(h.calls.some(call => call[0] === 'route'), false);
  }
  const h = harness({ userHasAcceptedCurrentLegal: () => false });
  await h.submit();
  assert.equal(h.calls.some(call => call[0] === 'legal'), true);
  assert.equal(h.calls.some(call => call[0] === 'success'), false);
});
