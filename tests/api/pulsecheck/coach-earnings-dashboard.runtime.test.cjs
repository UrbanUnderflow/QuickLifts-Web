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
    /context\.legacyCoachId === currentUser\.id/,
    'a legacy roster coach should inherit an unset revenue recipient'
  );
  assert.match(
    dashboardSource,
    /get-pulsecheck-coach-earnings/,
    'the live earnings tab should use the protected server-side earnings route'
  );
  assert.match(
    dashboardSource,
    /get-pulsecheck-coach-earnings[\s\S]*teamId=\$\{encodeURIComponent\(teamId\)\}/,
    'earnings requests should carry the explicitly selected dashboard team'
  );
  assert.match(
    dashboardSource,
    /body: JSON\.stringify\(\{\s*teamId,/,
    'payout requests should revalidate the explicitly selected team'
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
    /\(draft\.referralKickbackEnabled \|\| draft\.parentAssessmentReferralKickbackEnabled \|\| draft\.coachReferralKickbackEnabled\) &&\s*!draft\.revenueRecipientUserId/,
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

test('provisioning exposes athlete subscription pricing and saves through the protected Stripe manager', () => {
  const provisioningSource = read('src/pages/admin/pulsecheckProvisioning.tsx');

  assert.match(
    provisioningSource,
    /Sell PulseCheck through athlete invites/,
    'the Team Commercial Config card should expose the subscription toggle'
  );
  assert.match(
    provisioningSource,
    /Athlete Monthly Price/,
    'the provisioning dashboard should expose the coach-set monthly price'
  );
  assert.match(
    provisioningSource,
    /manage-pulsecheck-athlete-subscription-offer/,
    'subscription changes should use the protected Stripe offer manager'
  );
  assert.match(
    provisioningSource,
    /Authorization: `Bearer \$\{idToken\}`/,
    'the Stripe offer manager request should be authenticated'
  );
  assert.match(
    provisioningSource,
    /athleteAppSubscriptionEnabled: team\.commercialConfig\.athleteAppSubscriptionEnabled/,
    'the browser should not advertise a new active offer before Stripe succeeds'
  );
});
