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

test('dashboard links to latest report and archive', () => {
  const dashboardSource = read('src/pages/coach/dashboard.tsx');
  assert.match(dashboardSource, /Latest Sports Intelligence Report/);
  assert.match(dashboardSource, /\/coach\/sports-intelligence-reports/);
  assert.match(dashboardSource, /latestSportsIntelligenceReport\.href/);
});

test('coach report access queries are scoped by team', () => {
  const accessSource = read('src/api/firebase/pulsecheckCoachReportAccess.ts');
  assert.match(accessSource, /collection\(db, 'teams', teamId, COACH_REPORTS_COLLECTION\)/);
  assert.match(accessSource, /where\('teamId', '==', teamId\)/);
  assert.doesNotMatch(accessSource, /collectionGroup/);
});
