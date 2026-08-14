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
    /const isStandaloneAuthRoute =[\s\S]*normalizedCheckoutBridgePath === '\/pipelists'[\s\S]*normalizedCheckoutBridgePath === '\/simpbudget'[\s\S]*normalizedCheckoutBridgePath === '\/noranotetaker'/,
    'PipeLists, SimpBudget, and NoraNotetaker should be recognized as standalone-auth routes',
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

test('NoraNotetaker uses the SimpBudget Firebase account tree', () => {
  const noraNotetaker = read('src/pages/NoraNotetaker.tsx');
  const simpBudgetRules = read('firestore.simpbudget.rules');

  assert.match(
    noraNotetaker,
    /const SIMPBUDGET_USERS_COLLECTION = 'simpbudget-users'/,
    'NoraNotetaker should store user-scoped data in the SimpBudget users collection',
  );
  assert.match(
    noraNotetaker,
    /const NORA_MEETINGS_SUBCOLLECTION = 'noraNotetakerMeetings'/,
    'NoraNotetaker should keep meeting notes in its own user subcollection',
  );
  assert.match(
    noraNotetaker,
    /collection\(simpBudgetDb, SIMPBUDGET_USERS_COLLECTION, uid, NORA_MEETINGS_SUBCOLLECTION\)/,
    'NoraNotetaker should read and write through the standalone SimpBudget Firestore app',
  );
  assert.match(
    simpBudgetRules,
    /match \/\{document=\*\*\} \{[\s\S]*allow read, write: if isOwner\(userId\);[\s\S]*\}/,
    'SimpBudget rules should allow owned nested app subcollections under simpbudget-users/{uid}',
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

test('PipeLists Google login falls back to redirect when the popup is blocked or closed', () => {
  const pipeLists = read('src/pages/PipeLists.tsx');

  assert.match(
    pipeLists,
    /browserPopupRedirectResolver/,
    'PipeLists popup sign-in should use Firebase browser popup resolver when it uses popups',
  );
  assert.match(
    pipeLists,
    /const isProductionHost = window\.location\.hostname === 'fitwithpulse\.ai' \|\| window\.location\.hostname\.endsWith\('\.netlify\.app'\)/,
    'production PipeLists should prefer redirect sign-in over a popup',
  );
  assert.match(
    pipeLists,
    /const shouldRetryGoogleSignInWithRedirect = \(error: unknown\) =>/,
    'PipeLists should classify recoverable popup failures',
  );
  assert.match(
    pipeLists,
    /code === 'auth\/popup-closed-by-user'[\s\S]*code === 'auth\/cancelled-popup-request'[\s\S]*code === 'auth\/popup-blocked'/,
    'PipeLists should recover from the Firebase popup failure codes users see in Chrome',
  );
  assert.match(
    pipeLists,
    /if \(shouldRetryGoogleSignInWithRedirect\(error\)\) \{[\s\S]*await signInWithRedirect\(simpBudgetAuth, provider\)/,
    'PipeLists should fall back to redirect sign-in after a popup failure',
  );
  assert.match(
    pipeLists,
    /const \[isGoogleSignInStarting, setIsGoogleSignInStarting\] = useState\(false\)/,
    'PipeLists should prevent repeated Google sign-in clicks while auth is starting',
  );
});
