const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const repoRoot = path.resolve(__dirname, '../../..');

const read = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

const coachSurfaceFiles = [
  'src/pages/coach/dashboard.tsx',
  'src/pages/coach/sports-intelligence-reports.tsx',
];

const bannedCoachTerms = [
  /\bACWR\b/,
  /\bacwr\b/,
  /\bload_au\b/,
  /\bhigh_confidence\b/,
  /\bdegraded\b/,
  /\bconfidenceTier\b/,
  /\brmssdMs\b/,
  /\bexternalLoadAU\b/,
];

test('coach Sports Intelligence surfaces expose report access without technical wording', () => {
  for (const file of coachSurfaceFiles) {
    const source = read(file);
    for (const bannedTerm of bannedCoachTerms) {
      assert.equal(
        bannedTerm.test(source),
        false,
        `${file} should not expose ${bannedTerm} on the coach surface`
      );
    }
  }
});

test('dashboard renders the delivered report archive and opens scoped report links', () => {
  const dashboardSource = read('src/pages/coach/dashboard.tsx');
  assert.match(dashboardSource, /Every Sports Intelligence report delivered to your team/);
  assert.match(
    dashboardSource,
    /listSentSportsIntelligenceReportsForTeam\(teamId, teamName \|\| 'Team'\)/
  );
  assert.match(dashboardSource, /teamId=\{teamContext\?\.teamId\}/);
  assert.match(dashboardSource, /pathname:\s*report\.href/);
});

test('coach report access queries are scoped by team', () => {
  const accessSource = read('src/api/firebase/pulsecheckCoachReportAccess.ts');
  const detailSource = read('src/pages/coach-reports/[teamId]/[reportId].tsx');
  assert.match(accessSource, /collection\(db, 'teams', teamId, COACH_REPORTS_COLLECTION\)/);
  assert.match(accessSource, /COACH_REPORTS_COLLECTION = 'coachReportViews'/);
  assert.match(accessSource, /where\('teamId', '==', teamId\)/);
  assert.match(accessSource, /where\('reviewStatus', 'in', \['published', 'sent'\]\)/);
  assert.match(accessSource, /resolveAuthorizedCoachReportTeam/);
  assert.match(accessSource, /team\.status !== 'active'/);
  assert.match(accessSource, /organization\.status !== 'active'/);
  assert.match(detailSource, /resolveAuthorizedCoachReportTeam\(currentUser\.id, teamId\)/);
  assert.match(detailSource, /pulsecheckCoachReportService\.getCoachView/);
  assert.doesNotMatch(detailSource, /pulsecheckCoachReportService\.getReport/);
  assert.doesNotMatch(accessSource, /collectionGroup/);
});

test('dashboard selection fail-closes and scopes roster/readiness to one active team', () => {
  const dashboardSource = read('src/pages/coach/dashboard.tsx');
  const coachServiceSource = read('src/api/firebase/coach/service.ts');
  const provisioningSource = read('src/api/firebase/pulsecheckProvisioning/service.ts');
  const provisioningTypes = read('src/api/firebase/pulsecheckProvisioning/types.ts');

  assert.match(dashboardSource, /aria-label="Active team"/);
  assert.match(dashboardSource, /if \(!membership\) return \[\]/);
  assert.match(dashboardSource, /team\.status !== 'active'/);
  assert.match(dashboardSource, /organization\.status !== 'active'/);
  assert.match(
    dashboardSource,
    /coachService\.getConnectedAthletesForTeam\(\s*currentUser\.id,\s*selectedTeamAccess\.context\.teamId\s*\)/
  );
  assert.match(
    dashboardSource,
    /coachEscalations\.filter\(\(record\) => selectedAthleteIds\.has\(record\.userId\)\)/
  );
  assert.match(
    coachServiceSource,
    /membership\.teamId === normalizedTeamId/,
    'the data service must enforce the selected team instead of relying on UI filtering'
  );
  assert.match(provisioningSource, /status: data\.status \|\| undefined/);
  assert.match(provisioningSource, /revokedAt: data\.revokedAt \|\| null/);
  assert.match(
    provisioningTypes,
    /membership\.revokedAt != null[\s\S]*status === '' \|\| status === 'active'/
  );
  assert.match(
    dashboardSource,
    /isActivePulseCheckTeamMembership\(membership\)/
  );
  assert.match(
    dashboardSource,
    /membership\.teamId === teamId[\s\S]*membership\.organizationId === organizationId[\s\S]*isActivePulseCheckTeamMembership\(membership\)/
  );
  assert.doesNotMatch(
    dashboardSource,
    /memberships\.find\(\(m\) => m\.role !== 'athlete'\)/
  );
  assert.match(
    coachServiceSource,
    /isActivePulseCheckTeamMembership\(membership\)/
  );
});

test('dashboard deep links and secondary surfaces stay on the selected team', () => {
  const dashboardSource = read('src/pages/coach/dashboard.tsx');
  const scheduleSource = read('src/components/coach/ScheduleBoard.tsx');
  const scheduleService = read('src/api/firebase/coach/coachScheduleService.ts');
  const coachServices = read('src/api/firebase/pulsecheckCoachServices.ts');

  assert.match(dashboardSource, /const isViewKey/);
  assert.match(dashboardSource, /query: \{ \.\.\.router\.query, view: nextView \}/);
  assert.match(
    dashboardSource,
    /isViewKey\(rawView\)[\s\S]*navItems\.some\(\(item\) => item\.key === rawView\)/
  );
  assert.match(
    dashboardSource,
    /athleteById\.has\(row\.athleteId\)[\s\S]*row\.teamId === teamId[\s\S]*row\.organizationId === organizationId/
  );
  assert.match(
    dashboardSource,
    /listForCoachTeam\(coachId, teamId, organizationId\)/
  );
  assert.match(
    scheduleSource,
    /getEvents\(coachId, teamId, organizationId\)/
  );
  assert.match(
    scheduleSource,
    /allowedAthleteIds\.has\(conversation\.athleteId\)/
  );
  assert.match(scheduleService, /where\('teamId', '==', teamId\)/);
  assert.match(coachServices, /async listForCoachTeam/);
});
