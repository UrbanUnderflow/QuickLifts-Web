const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const repoRoot = path.resolve(__dirname, '../../..');
const read = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

const section = (source, start, end) => {
  const startIndex = source.indexOf(start);
  assert.notEqual(startIndex, -1, `missing section start: ${start}`);
  const endIndex = source.indexOf(end, startIndex + start.length);
  assert.notEqual(endIndex, -1, `missing section end: ${end}`);
  return source.slice(startIndex, endIndex);
};

test('web coach readiness keeps the canonical three summary cards and two metric cards', () => {
  const dashboard = read('src/pages/coach/dashboard.tsx');
  const home = section(dashboard, 'const HomeSection:', '// Athlete Alerts');
  const sharedCards = section(dashboard, 'const StatTile:', 'const LoadingBlock:');

  assert.match(home, /label="Total Athletes"/);
  assert.match(home, /label="Optimal"/);
  assert.match(home, /label="Needs Attention"/);
  assert.match(home, /<CoherenceTile/);
  assert.match(home, /<AdherenceTile/);

  assert.match(sharedCards, /Coherence/);
  assert.match(sharedCards, /14-day pattern/);
  assert.match(sharedCards, /Showing up/);
  assert.match(sharedCards, /Training/);
  assert.match(sharedCards, /Feeling good/);
  assert.match(sharedCards, /Adherence/);
  assert.match(sharedCards, /Daily habits/);
  assert.match(sharedCards, /Checked in/);
  assert.match(sharedCards, /Device worn/);
  assert.match(sharedCards, /Mental modules/);
});

test('web coach readiness resolves one selected-team roster and passes its exact workspace to every card input', () => {
  const dashboard = read('src/pages/coach/dashboard.tsx');
  const home = section(dashboard, 'const HomeSection:', '// Athlete Alerts');

  assert.match(
    dashboard,
    /coachService\.getConnectedAthletesForTeam\(\s*currentUser\.id,\s*selectedTeamAccess\.context\.teamId\s*\)/
  );
  assert.match(
    dashboard,
    /loadAthleteDeviceStatuses\([\s\S]*?teamId:\s*selectedTeamAccess\.context\.teamId,[\s\S]*?organizationId:\s*selectedTeamAccess\.context\.organizationId/
  );
  assert.match(home, /getCoachReadinessDailyDetailsForWorkspace\(/);
  assert.match(home, /teamId:\s*normalizedTeamID/);
  assert.match(home, /organizationId:\s*normalizedOrganizationID/);
  assert.doesNotMatch(home, /getAthleteReadinessDailyDetails\(/);
  assert.match(
    home,
    /if \(!normalizedCoachID \|\| !normalizedTeamID \|\| !normalizedOrganizationID\)/,
    'live card inputs must fail closed when the complete workspace is unavailable'
  );
});

test('live athlete readiness cards fail closed to the same scoped evidence feed', () => {
  const dashboard = read('src/pages/coach/dashboard.tsx');
  const card = read('src/components/AthleteReadinessCard.tsx');

  assert.match(
    dashboard,
    /<AthleteReadinessCard[\s\S]*?teamId=\{teamId\}[\s\S]*?organizationId=\{organizationId\}/
  );
  assert.match(card, /getCoachReadinessDailyDetailsForWorkspace\(/);
  assert.match(card, /athlete\.id,\s*coachID,/);
  assert.match(card, /teamId:\s*normalizedTeamID/);
  assert.match(card, /organizationId:\s*normalizedOrganizationID/);
  assert.match(
    card,
    /if \(!coachID \|\| !normalizedTeamID \|\| !normalizedOrganizationID\) \{\s*setReadinessDetails\(\[\]\)/
  );
  assert.doesNotMatch(card, /getAthleteReadinessDailyDetails\(/);
  assert.match(
    card,
    /const checkInCompleted = demo \? signalHas : detail\?\.checkInCompleted === true;/,
    'live check-in completion must never fall back to unscoped sentiment history'
  );
  assert.match(
    card,
    /const moduleAssignedCount = demo \? \(has \? 3 : 0\) : detail\?\.moduleAssignedCount \?\? 0;/
  );
  assert.match(card, /: detail\?\.moduleCompletedCount \?\? 0;/);
});

test('team choices match native ordering and keep an explicit shareable selection', () => {
  const dashboard = read('src/pages/coach/dashboard.tsx');

  assert.match(
    dashboard,
    /Array\.from\(uniqueByTeam\.values\(\)\)\.sort\(\(left, right\) => \{[\s\S]*?left\.context\.teamName\.localeCompare\([\s\S]*?sensitivity: 'base'[\s\S]*?left\.context\.teamId\.localeCompare/
  );
  assert.match(
    dashboard,
    /activeAccesses\.find\(\(access\) => access\.context\.teamId === requestedTeamId\) \|\|\s*activeAccesses\[0\]/,
    'a valid teamId deep link must win over the sorted default'
  );
  assert.match(
    dashboard,
    /query: \{ \.\.\.router\.query, teamId: initialTeam\.context\.teamId \}/
  );
  assert.match(dashboard, /query: \{ \.\.\.router\.query, teamId \}/);
  assert.match(dashboard, /\{ shallow: true, scroll: false \}/);
});

test('web coach readiness reads only scoped morning check-ins and daily assignments for its 14-day evidence', () => {
  const service = read('src/api/firebase/coach/service.ts');
  const builder = read('src/api/firebase/coach/readinessWorkspace.ts');
  const scopedLoader = section(
    service,
    'async getCoachReadinessDailyDetailsForWorkspace(',
    'async getAthleteReadinessDailyDetails('
  );

  assert.match(scopedLoader, /collection\(db, PULSECHECK_MORNING_CHECKINS_COLLECTION\)/);
  assert.match(scopedLoader, /where\(documentId\(\), 'in', documentIDs\)/);
  assert.match(scopedLoader, /where\('teamId', '==', workspace\.teamId\)/);
  assert.match(scopedLoader, /where\('organizationId', '==', workspace\.organizationId\)/);
  assert.match(scopedLoader, /collection\(db, PULSECHECK_DAILY_ASSIGNMENTS_COLLECTION\)/);
  assert.match(scopedLoader, /where\('coachId', '==', normalizedCoachID\)/);
  assert.match(scopedLoader, /where\('athleteId', '==', normalizedAthleteID\)/);
  assert.equal(
    (scopedLoader.match(/collection\(db,/g) || []).length,
    2,
    'the scoped card loader should query only the two readiness evidence families'
  );

  assert.match(builder, /pulseCheckRecordMatchesWorkspace\(row\.data, scope\)/);
  assert.match(builder, /cleanString\(row\.data\.coachId\) !== coachId/);
  assert.match(builder, /const latestByLineage = new Map/);
  assert.match(builder, /completed:\s*status === 'completed' \|\| row\.data\.completedAt != null/);
});

test('web device-wear input uses the same exact workspace and local 14 calendar days as the universal app', () => {
  const records = read('src/api/firebase/healthContextSourceRecord.ts');
  const monitor = read('src/api/firebase/pulsecheckDeviceMonitor.ts');
  const indexes = JSON.parse(read('firestore.indexes.json'));

  assert.match(records, /where\('teamId', '==', workspace\.teamId\)/);
  assert.match(records, /where\('organizationId', '==', workspace\.organizationId\)/);
  assert.match(records, /orderBy\('observedAt', workspace \? 'asc' : 'desc'\)/);
  assert.equal(
    indexes.indexes.some(
      (index) =>
        index.collectionGroup === 'health-context-source-records' &&
        JSON.stringify(index.fields) === JSON.stringify([
          { fieldPath: 'athleteUserId', order: 'ASCENDING' },
          { fieldPath: 'organizationId', order: 'ASCENDING' },
          { fieldPath: 'status', order: 'ASCENDING' },
          { fieldPath: 'teamId', order: 'ASCENDING' },
          { fieldPath: 'observedAt', order: 'ASCENDING' },
        ])
    ),
    true,
    'the scoped source-record query must use its committed ASCENDING range index'
  );
  assert.match(monitor, /listHealthContextSourceRecordsForWindow[\s\S]*?workspace/);
  assert.match(monitor, /date\.setHours\(0, 0, 0, 0\)/);
  assert.match(monitor, /windowDateKeys:\s*windowDateKeys \|\| undefined/);
  assert.match(monitor, /activeRecordCountsAsPresence:\s*!!workspace/);
  assert.match(
    monitor,
    /metrics\.length === 0 && !activeRecordCountsAsPresence/,
    'an active scoped wearable source record must count on the same day as native'
  );
});
