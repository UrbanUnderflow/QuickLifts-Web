const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '../../..');
const demoRoutePath = path.join(repoRoot, 'src/pages/coach-report-demo/[sportId].tsx');
const coachReportViewPath = path.join(repoRoot, 'src/components/coach-reports/CoachReportView.tsx');
const hostedReportRoutePath = path.join(repoRoot, 'src/pages/coach-reports/[teamId]/[reportId].tsx');

const coachSurfaceForbiddenTerms = [
  'reviewerOnly',
  'thresholdTrace',
  'sourceProvenance',
  'unsuppressedSignals',
  'confidenceTier',
  'high_confidence',
  'stable confidence',
  'emerging confidence',
  'directional',
  'degraded',
  'simEvidenceCount',
  'rmssdMs',
  'externalLoadAU',
];

test('public coach-report demo route only renders static demo fixtures', () => {
  const source = fs.readFileSync(demoRoutePath, 'utf8');

  assert.match(source, /COACH_REPORT_DEMO_EXAMPLES/, 'demo route must read from the static demo fixture map');
  assert.match(source, /assertCoachReportDemoSource/, 'demo route must assert the fixture source before rendering');
  assert.doesNotMatch(source, /from ['"]firebase\/firestore['"]/, 'demo route must not import Firestore');
  assert.doesNotMatch(source, /from ['"][^'"]*pulsecheckCoachReport/i, 'demo route must not import stored-report services');
  assert.doesNotMatch(source, /collection\(|doc\(|getDoc\(|onSnapshot\(/, 'demo route must not contain Firestore read calls');
});

test('CoachReportView has a coach-surface-only prop contract', () => {
  const source = fs.readFileSync(coachReportViewPath, 'utf8');

  assert.match(source, /export type \{ CoachReportCoachSurface \}/, 'view must expose the coach-surface report contract');
  assert.match(source, /interface CoachReportViewProps[\s\S]*report: CoachReportCoachSurface/, 'view props must accept only coach-surface report data');
  for (const term of coachSurfaceForbiddenTerms) {
    assert.equal(source.includes(term), false, `view must not accept or render internal term: ${term}`);
  }
  assert.doesNotMatch(source, /missingInputs/, 'view must not accept or render reviewer-only missing-input fields');
});

test('hosted coach report route renders only the coach surface', () => {
  const source = fs.readFileSync(hostedReportRoutePath, 'utf8');

  assert.match(source, /pulsecheckCoachReportService\.getReport\(teamId,\s*reportId\)/, 'hosted route should load the scoped stored report');
  assert.match(source, /hydrateCoachSurfaceMeta/, 'hosted route should adapt only the coach-facing report data');
  assert.match(source, /<CoachReportView\s+report=\{coachSurface\}\s+sport=\{sport\}/, 'hosted route should render the coach surface through CoachReportView');

  for (const term of coachSurfaceForbiddenTerms) {
    assert.equal(source.includes(term), false, `hosted route must not read or render internal term: ${term}`);
  }
  assert.doesNotMatch(source, /missingInputs|threshold trace|source provenance/i, 'hosted route must not surface reviewer/audit wording');
});
