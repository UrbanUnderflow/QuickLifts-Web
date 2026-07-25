const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const repoRoot = path.resolve(__dirname, '../../..');
const read = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

test('coach dashboard resolves legacy revenue recipients and securely loads live member earnings', () => {
  const dashboardSource = read('src/pages/coach/dashboard.tsx');

  assert.match(
    dashboardSource,
    /team\?\.legacyCoachId === currentUser\.id/,
    'a legacy roster coach should inherit an unset revenue recipient'
  );
  assert.match(
    dashboardSource,
    /get-pulsecheck-coach-earnings/,
    'the live earnings tab should use the protected server-side earnings route'
  );
  assert.doesNotMatch(
    dashboardSource,
    /getDoc\(doc\(db, 'subscriptions'/,
    'the coach browser should not directly read private athlete subscription documents'
  );
  assert.match(
    dashboardSource,
    /Transaction history/,
    'the live earnings tab should identify the complete member transaction list'
  );
  assert.match(
    dashboardSource,
    /payment\.shareAmount/,
    'each paid invoice should show the coach share'
  );
});

test('commercial config save fills a safe recipient or requires an explicit selection', () => {
  const provisioningSource = read('src/pages/admin/pulsecheckProvisioning.tsx');

  assert.match(
    provisioningSource,
    /draft\.referralKickbackEnabled && !draft\.revenueRecipientUserId/,
    'enabled referral revenue should never save silently without a recipient'
  );
  assert.match(
    provisioningSource,
    /team\.legacyCoachId/,
    'legacy roster teams should prefer their legacy coach as recipient'
  );
  assert.match(
    provisioningSource,
    /Select the staff member who should receive this team’s referral revenue/,
    'ambiguous teams should require the admin to choose a recipient'
  );
});
