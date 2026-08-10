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
