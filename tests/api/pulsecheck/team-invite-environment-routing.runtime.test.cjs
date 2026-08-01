const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const pagePath = path.resolve(
  __dirname,
  '../../../src/pages/PulseCheck/team-invite/[token].tsx'
);
const source = fs.readFileSync(pagePath, 'utf8');
const serverHandler = source.slice(source.indexOf('export const getServerSideProps'));

test('team invite SSR keeps invite, team, and organization reads in one Firebase environment', () => {
  assert.match(
    serverHandler,
    /const forceDevFirebase = query\.devFirebase === ['"]1['"];/,
    'the signed link query must choose the Firebase environment before any invite read'
  );
  assert.match(
    serverHandler,
    /getFirebaseAdminApp\(forceDevFirebase\)/,
    'the selected Admin app must follow the invite environment'
  );
  assert.match(
    serverHandler,
    /const firestore = admin\.firestore\(adminApp\);/,
    'all related document reads must share the selected Admin Firestore instance'
  );
  assert.match(
    serverHandler,
    /let invite = await firestore\s*\.collection\(['"]pulsecheck-invite-links['"]\)/,
    'the invite must load from the selected environment'
  );
  assert.match(
    serverHandler,
    /firestore\.collection\(['"]pulsecheck-organizations['"]\)/,
    'the organization must load from the same environment as the invite'
  );
  assert.match(
    serverHandler,
    /firestore\.collection\(['"]pulsecheck-teams['"]\)/,
    'live team commercialization must load from the same environment as the invite'
  );
  assert.doesNotMatch(
    serverHandler,
    /admin\.firestore\(\)\s*\.collection\(/,
    'default Admin Firestore reads would silently mix production data into a development invite'
  );
});
