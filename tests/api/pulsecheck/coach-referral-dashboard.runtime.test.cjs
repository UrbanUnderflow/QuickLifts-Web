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
  const athleteInviteSection = dashboardSource.slice(
    dashboardSource.indexOf('const AthleteInviteSection'),
    dashboardSource.indexOf('const RosterSection')
  );

  assert.match(
    dashboardSource,
    /coachService\.resolveOperatingContext\(currentUser\.id\)/,
    'the dashboard should resolve a missing legacy operating context before enabling team actions'
  );
  assert.match(
    dashboardSource,
    /<AthleteInviteSection[\s\S]*teamContext=\{teamContext\}/,
    'athlete invites should consume the shared dashboard team context'
  );
  assert.match(
    dashboardSource,
    /createManagedAthleteInvite[\s\S]*manage-pulsecheck-athlete-invite/,
    'athlete invite creation should use the authenticated server mutation route'
  );
  assert.match(
    dashboardSource,
    /JSON\.stringify\(\{ action: 'create', mode: 'general', \.\.\.input \}\)/,
    'the coach dashboard should only request the reusable team invite'
  );
  assert.match(
    athleteInviteSection,
    /const copyLink = \(\) => shareTeamLink\(false\);[\s\S]*const inviteAthlete = \(\) => shareTeamLink\(true\);/,
    'copy and invite actions should resolve the same reusable team link'
  );
  assert.doesNotMatch(
    athleteInviteSection,
    /single-use|pending personal|inviteOpen|recipientName/,
    'the coach surface should not create or display personal athlete invites'
  );
  assert.match(
    coachServiceSource,
    /resolve-pulsecheck-coach-operating-context/,
    'the public dashboard resolver should use the authenticated server bridge'
  );
  assert.match(
    coachServiceSource,
    /persistedMemberships[\s\S]*membership\.id === `\$\{teamId\}_\$\{coachId\}`/,
    'the browser should re-read the canonical membership before enabling invite context'
  );
});
