const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const repoRoot = path.resolve(__dirname, '../../..');

const read = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

test('standalone Firebase auth pages bypass the global AuthWrapper gate', () => {
  const authWrapper = read('src/components/AuthWrapper.tsx');

  assert.match(
    authWrapper,
    /const isStandaloneAuthRoute =[\s\S]*normalizedCheckoutBridgePath === '\/pipelists'[\s\S]*normalizedCheckoutBridgePath === '\/simpbudget'/,
    'PipeLists and SimpBudget should be recognized as standalone-auth routes',
  );
  assert.match(
    authWrapper,
    /if \(isStandaloneAuthRoute\) \{[\s\S]*setShowSignInModal\(false\);[\s\S]*dispatch\(setLoading\(false\)\);[\s\S]*setAuthChecked\(true\);[\s\S]*return;/,
    'standalone-auth routes should not wait on the main Firebase auth listener',
  );
  assert.match(
    authWrapper,
    /if \(isStandaloneAuthRoute\) \{[\s\S]*return <>\{children\}<\/>;/,
    'standalone-auth routes should render their own sign-in or workspace UI immediately',
  );
  assert.match(
    authWrapper,
    /isCheckoutBridgeRoute \|\| isStandaloneAuthRoute/,
    'standalone-auth routes should not open the generic sign-in modal from query params',
  );
});

test('passive public pages render while Firebase auth initializes', () => {
  const authWrapper = read('src/components/AuthWrapper.tsx');

  assert.match(
    authWrapper,
    /const isPassivePublicRoute =[\s\S]*isPublicRoute\(router\.asPath \|\| router\.pathname\)[\s\S]*!routeWantsAuthModal/,
    'public routes without explicit signin/signup should be classified as passive public routes',
  );
  assert.match(
    authWrapper,
    /if \(isPassivePublicRoute\) \{[\s\S]*return <>\{children\}<\/>;/,
    'passive public routes should render children instead of waiting on the auth spinner',
  );
  assert.match(
    authWrapper,
    /protected pages and explicit[\s\S]*\?signin\/\?signup routes keep the normal gate/,
    'the bypass comment should preserve the protected-route and explicit-auth intent',
  );
});

test('PipeLists login controls recover when standalone auth readiness stalls', () => {
  const pipeLists = read('src/pages/PipeLists.tsx');

  assert.match(
    pipeLists,
    /const \[authReadyTimedOut, setAuthReadyTimedOut\] = useState\(false\)/,
    'PipeLists should track a stalled standalone auth readiness callback',
  );
  assert.match(
    pipeLists,
    /setTimeout\(\(\) => setAuthReadyTimedOut\(true\), 2500\)/,
    'PipeLists should unlock sign-in attempts after a short auth readiness delay',
  );
  assert.match(
    pipeLists,
    /const canAttemptAuth = authReady \|\| authReadyTimedOut/,
    'login buttons should use a recoverable auth attempt state',
  );
  assert.doesNotMatch(
    pipeLists,
    /disabled=\{!authReady\}/,
    'Google sign-in buttons should not stay disabled solely because authReady is false',
  );
  assert.doesNotMatch(
    pipeLists,
    /disabled=\{!authReady \|\| sendingMagicLink\}/,
    'magic link buttons should not stay disabled solely because authReady is false',
  );
});
