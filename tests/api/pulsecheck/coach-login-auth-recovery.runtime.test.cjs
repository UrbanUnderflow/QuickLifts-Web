const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const repoRoot = path.resolve(__dirname, '../../..');
const coachLoginSource = fs.readFileSync(
  path.join(repoRoot, 'src/pages/coach/login.tsx'),
  'utf8',
);

test('coach Google sign-in recovers from hung auth and account checks', () => {
  assert.match(
    coachLoginSource,
    /GOOGLE_AUTH_TIMEOUT_MS\s*=\s*45000/,
    'coach Google sign-in should have a finite timeout instead of leaving the button spinning forever',
  );
  assert.match(
    coachLoginSource,
    /withTimeout\(\s*authService\.signInWithGoogle\(\)/,
    'coach Google sign-in should bound the Firebase popup promise',
  );
  assert.match(
    coachLoginSource,
    /withTimeout\(\s*rejectAccidentalNewSocialLogin\(result\)/,
    'coach Google sign-in should bound post-popup account linking checks',
  );
  assert.match(
    coachLoginSource,
    /withTimeout\(\s*ensureFirestoreUser\(user\)/,
    'coach Google sign-in should bound the coach workspace user check',
  );
  assert.match(
    coachLoginSource,
    /case 'pulse\/auth-timeout':[\s\S]*Google sign-in is taking too long/,
    'coach Google sign-in should show a readable timeout error',
  );
  assert.match(
    coachLoginSource,
    /const handleGoogleSignIn = async \(\) => \{[\s\S]*\} finally \{[\s\S]*setPending\(null\);[\s\S]*\};/,
    'coach Google sign-in should always clear its loading state',
  );
});
