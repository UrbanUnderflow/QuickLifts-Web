const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const repoRoot = path.resolve(__dirname, '../../..');
const read = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

test('coach referral navigation and cards follow the team commercial switches', () => {
  const dashboardSource = read('src/pages/coach/dashboard.tsx');

  assert.match(
    dashboardSource,
    /referralKickbackEnabled[\s\S]*parentAssessmentReferralKickbackEnabled[\s\S]*coachReferralKickbackEnabled/,
    'all three commercial referral switches should contribute to referral visibility'
  );
  assert.match(
    dashboardSource,
    /case 'referrals':[\s\S]*return referralLinksEnabled/,
    'the Referral Links tab should disappear when no referral program is enabled'
  );
  assert.match(
    dashboardSource,
    /showAthleteReferrals && \(/,
    'the athlete referral card should be hidden when its program is disabled'
  );
  assert.match(
    dashboardSource,
    /showParentAssessmentReferrals && \(/,
    'the parent assessment card should be hidden when its program is disabled'
  );
  assert.match(
    dashboardSource,
    /showCoachReferrals && \(/,
    'the coach referral card should be hidden when its program is disabled'
  );
});

test('athlete invites use the dashboard team context and bridge legacy coaches', () => {
  const dashboardSource = read('src/pages/coach/dashboard.tsx');
  const coachServiceSource = read('src/api/firebase/coach/service.ts');

  assert.match(
    dashboardSource,
    /coachService\.resolveOperatingContext\(coachId\)/,
    'the dashboard should resolve a missing legacy operating context before enabling team actions'
  );
  assert.match(
    dashboardSource,
    /<AthleteInviteSection[\s\S]*teamContext=\{teamContext\}/,
    'athlete invites should consume the shared dashboard team context'
  );
  assert.match(
    coachServiceSource,
    /async resolveOperatingContext\(coachId: string\)[\s\S]*return this\.ensureCoachOperatingContext\(coachId\)/,
    'the public dashboard resolver should reuse the existing legacy bridge'
  );
});
