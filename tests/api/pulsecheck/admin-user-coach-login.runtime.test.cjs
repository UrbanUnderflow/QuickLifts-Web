const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const repoRoot = path.resolve(__dirname, '../../..');
const usersAdminSource = fs.readFileSync(
  path.join(repoRoot, 'src/pages/admin/users.tsx'),
  'utf8'
);
const remoteLoginSource = fs.readFileSync(
  path.join(repoRoot, 'src/pages/remote-login.tsx'),
  'utf8'
);
const adminBannerSource = fs.readFileSync(
  path.join(repoRoot, 'src/components/admin/AdminNavBanner.tsx'),
  'utf8'
);

test('user management can impersonate a user directly into the PulseCheck coach dashboard', () => {
  assert.match(
    usersAdminSource,
    /pulseCheckCoach:\s*\{[\s\S]*destination:\s*'\/coach\/dashboard'/,
    'the PulseCheck coach login target should land on the coach dashboard'
  );
  assert.match(
    usersAdminSource,
    /handleRemoteLogin\(user,\s*'pulseCheckCoach'\)/,
    'the admin action should use the PulseCheck coach login target'
  );
  assert.match(
    usersAdminSource,
    /next=\$\{encodeURIComponent\(remoteLoginTarget\.destination\)\}/,
    'the remote-login URL should preserve the selected destination'
  );
  assert.doesNotMatch(
    usersAdminSource,
    /customToken.*remote-login\?token|userId=\$\{targetUser\.id\}/s,
    'the admin page should not put reusable Firebase custom tokens into remote-login URLs'
  );
  assert.match(
    remoteLoginSource,
    /browserSessionPersistence/,
    'remote-login should scope impersonation to tab session persistence'
  );
  assert.match(
    remoteLoginSource,
    /setPersistence\(auth,\s*browserSessionPersistence\)/,
    'remote-login should set session persistence before custom-token sign-in'
  );
  assert.match(
    remoteLoginSource,
    /consume-remote-login-token/,
    'remote-login should consume one-time remote-login tokens in the target tab'
  );
  assert.match(
    remoteLoginSource,
    /replaceState/,
    'remote-login should remove the token from browser history before sign-in'
  );
  assert.match(
    adminBannerSource,
    /signOutAndClearPulseAuthState\(auth\)/,
    'admin sign-out should clear Firebase auth storage, not only call signOut(auth)'
  );
  assert.match(
    usersAdminSource,
    /NEXT_PUBLIC_REMOTE_LOGIN_FUNCTION_BASE_URL/,
    'local development should support routing privileged impersonation calls through a credentialed server'
  );
  assert.match(
    usersAdminSource,
    /Log in to PulseCheck Coach Dashboard as/,
    'the new action should be clearly identified for admins'
  );
});
