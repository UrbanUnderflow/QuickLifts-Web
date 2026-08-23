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
  assert.match(home, /<EngagementCoverageTile/);

  assert.match(sharedCards, /Team Coherence/);
  assert.match(sharedCards, /methodologyVersion/);
  assert.match(sharedCards, /Wellbeing/);
  assert.match(sharedCards, /Recovery/);
  assert.match(sharedCards, /Showing Up/);
  assert.match(sharedCards, /Engagement coverage/);
  assert.match(sharedCards, /Context coverage/);
  assert.match(sharedCards, /Checked in/);
  assert.match(sharedCards, /Device worn/);
  assert.match(sharedCards, /Mental modules/);
});

test('profile check-in windows use the same canonical selected-team scorecard as Showing Up', () => {
  const dashboard = read('src/pages/coach/dashboard.tsx');

  assert.match(dashboard, /<AthleteProfileDrawer[\s\S]*?coachId=\{coachId \|\| ''\}[\s\S]*?teamId=\{teamContext\?\.teamId \|\| ''\}[\s\S]*?organizationId=\{teamContext\?\.organizationId \|\| ''\}/);
  assert.match(dashboard, /loadAthleteTeamScorecard\(athlete\.id, normalizedTeamId, idToken\)/);
  assert.match(dashboard, /component\.key === 'scheduled_check_ins' \|\| component\.key === 'showing_up'/);
  assert.match(dashboard, /buildDailyCheckInPointsFromScorecard\(showingUpDayStates, 30\)/);
  assert.match(dashboard, /const buildDailyCheckInPointsFromReadiness = \([\s\S]*?details: AthleteReadinessDailyDetail\[\][\s\S]*?checkInCompleted === true/);
  assert.match(dashboard, /const buildDailySentimentPoints = \([\s\S]*?hasSignal: messages > 0/);
  assert.doesNotMatch(dashboard, /buildDailyCheckInPointsFrom(?:Scorecard|Readiness)\(history/);
  assert.match(dashboard, /observedDays < days/);
  assert.match(dashboard, /scorableDays\.filter\(\(day\) => day\.state === 'complete'\)/);
  assert.match(dashboard, /Engagement snapshot/);
  assert.match(dashboard, /Device coverage/);
  assert.doesNotMatch(dashboard, /Adherence snapshot|Device adherence/);
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
  assert.match(home, /getCoachReadinessSnapshotForWorkspace\(/);
  assert.match(home, /teamId:\s*normalizedTeamID/);
  assert.match(home, /organizationId:\s*normalizedOrganizationID/);
  assert.doesNotMatch(home, /getAthleteReadinessDailyDetails\(/);
  assert.match(
    home,
    /if \(!normalizedCoachID \|\| !normalizedTeamID \|\| !normalizedOrganizationID\)/,
    'live card inputs must fail closed when the complete workspace is unavailable'
  );
});

test('live athlete readiness cards receive shared readiness and scorecard evidence without refetching it', () => {
  const dashboard = read('src/pages/coach/dashboard.tsx');
  const card = read('src/components/AthleteReadinessCard.tsx');

  assert.match(
    dashboard,
    /<AthleteReadinessCard[\s\S]*?teamId=\{teamId\}[\s\S]*?organizationId=\{organizationId\}/
  );
  assert.match(dashboard, /readinessSnapshot=\{liveReadinessByAthlete\?\.\[a\.id\]\}/);
  assert.match(dashboard, /scorecardResponse=\{liveScorecardByAthlete\?\.\[a\.id\]\}/);
  assert.match(dashboard, /sentimentHistory:\s*a\.sentimentHistory/);
  assert.match(dashboard, /mergeAthleteReadinessSnapshot\(/);
  assert.match(card, /readinessSnapshot\?: AthleteReadinessWorkspaceSnapshot/);
  assert.match(card, /scorecardResponse\?: CoachScorecardResponse \| null/);
  assert.match(card, /sentimentHistory\?: DailySentimentRecord\[\]/);
  assert.match(card, /const readinessDetails = demo \? \[\] : readinessSnapshot\?\.details \?\? null/);
  assert.match(card, /const historyByDate = new Map/);
  assert.match(card, /historyRecord\?\.sentimentScore/);
  assert.doesNotMatch(card, /getCoachReadinessSnapshotForWorkspace\(/);
  assert.doesNotMatch(card, /getAthleteReadinessDailyDetails\(/);
  assert.doesNotMatch(card, /getDailySentimentHistory\(/);
  assert.doesNotMatch(card, /get-pulsecheck-scorecard/);
  assert.match(
    card,
    /const checkInCompleted = demo \? demoHas : detail\?\.checkInCompleted === true;/,
    'live check-in completion must never fall back to unscoped sentiment history'
  );
  assert.match(
    card,
    /const moduleAssignedCount = demo \? \(has \? 3 : 0\) : detail\?\.moduleAssignedCount \?\? 0;/
  );
  assert.match(card, /: detail\?\.moduleCompletedCount \?\? 0;/);
  assert.match(card, /readinessAvailability\?\.modules === 'unavailable'/);
  assert.match(card, /Device data unavailable/);
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
  assert.match(dashboard, /replaceCoachDashboardUrlQuery\(\{ teamId: initialTeam\.context\.teamId \}\)/);
  assert.match(dashboard, /replaceCoachDashboardUrlQuery\(\{ teamId \}\)/);
  assert.match(dashboard, /window\.history\.replaceState\(window\.history\.state, '', nextUrl\)/);
});

test('web coach readiness settles scoped evidence lanes independently and preserves unavailable state', () => {
  const service = read('src/api/firebase/coach/service.ts');
  const builder = read('src/api/firebase/coach/readinessWorkspace.ts');
  const scopedLoader = section(
    service,
    'async getCoachReadinessSnapshotForWorkspace(',
    'async getAthleteReadinessDailyDetails('
  );

  assert.match(scopedLoader, /collection\(db, PULSECHECK_MORNING_CHECKINS_COLLECTION\)/);
  assert.match(scopedLoader, /where\(documentId\(\), 'in', documentIDs\)/);
  assert.match(scopedLoader, /where\('teamId', '==', workspace\.teamId\)/);
  assert.match(scopedLoader, /where\('organizationId', '==', workspace\.organizationId\)/);
  assert.match(scopedLoader, /collection\(db, PULSECHECK_DAILY_ASSIGNMENTS_COLLECTION\)/);
  assert.match(scopedLoader, /where\('coachId', '==', normalizedCoachID\)/);
  assert.match(scopedLoader, /where\('athleteId', '==', normalizedAthleteID\)/);
  assert.match(scopedLoader, /collection\(db, PULSECHECK_NORA_CONVERSATIONS_COLLECTION\)/);
  assert.match(scopedLoader, /collection\(db, SIM_COMPLETIONS_ROOT/);
  assert.match(scopedLoader, /collection\(db, IOS_MENTAL_COMPLETIONS_ROOT/);
  assert.match(scopedLoader, /collection\(db, SIM_SESSIONS_ROOT/);
  assert.match(scopedLoader, /Promise\.allSettled/);
  assert.match(scopedLoader, /availabilityFor\(\[0\]\)/);
  assert.match(scopedLoader, /modules: availabilityFor\(\[1, 4, 5, 6\]\)/);

  assert.match(builder, /pulseCheckRecordMatchesWorkspace\(row\.data, scope\)/);
  assert.match(builder, /cleanString\(row\.data\.coachId\) !== coachId/);
  assert.match(builder, /const latestByLineage = new Map/);
  assert.match(builder, /completed:\s*status === 'completed' \|\| row\.data\.completedAt != null/);
  assert.match(builder, /matchesWorkspaceOrUnscopedSelf/);
  assert.match(builder, /conversationMatchesWorkspace/);
  assert.match(builder, /allowUnscopedRosterEvidence/);
  assert.match(service, /allowUnscopedRosterEvidence:\s*true/);
});

test('web device-wear input uses the same exact workspace and local 14 calendar days as the universal app', () => {
  const records = read('src/api/firebase/healthContextSourceRecord.ts');
  const monitor = read('src/api/firebase/pulsecheckDeviceMonitor.ts');
  const dashboard = read('src/pages/coach/dashboard.tsx');
  const card = read('src/components/AthleteReadinessCard.tsx');
  const indexes = JSON.parse(read('firestore.indexes.json'));

  assert.match(records, /where\('teamId', '==', workspace\.teamId\)/);
  assert.match(records, /where\('organizationId', '==', workspace\.organizationId\)/);
  assert.match(records, /orderBy\('observedAt', workspace \? 'asc' : 'desc'\)/);
  assert.match(records, /if \(options\.indexIndependent && !workspace\)/);
  assert.match(records, /where\('athleteUserId', '==', scopedAthleteId\)/);
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
  assert.match(monitor, /max:\s*MAX_RECORDS_PER_ATHLETE/);
  assert.match(monitor, /indexIndependent:\s*allowUnscopedSelf/);
  assert.match(monitor, /date\.setHours\(0, 0, 0, 0\)/);
  assert.match(monitor, /windowDateKeys:\s*windowDateKeys \|\| undefined/);
  assert.match(monitor, /HEALTH_CONTEXT_SNAPSHOTS_COLLECTION = 'health-context-snapshots'/);
  assert.match(monitor, /const allowUnscopedCompatibleEvidence = allowUnscopedSelf \|\| allowUnscopedRosterEvidence/);
  assert.match(monitor, /const sourceRecordWorkspace = allowUnscopedSelf \? undefined : workspace/);
  assert.match(monitor, /loadSnapshotWearableCoverageDays\([\s\S]*?membership\.userId,[\s\S]*?windowDateKeys,[\s\S]*?workspace,[\s\S]*?allowUnscopedCompatibleEvidence/);
  assert.match(monitor, /loadWearableSourceStatuses\([\s\S]*?membership\.userId,[\s\S]*?workspace,[\s\S]*?allowUnscopedCompatibleEvidence/);
  assert.match(
    monitor,
    /records\.filter\(\(record\) => allowUnscopedSelf \|\| matchesWorkspaceOrUnscopedSelf\([\s\S]*?workspace,[\s\S]*?false/
  );
  assert.match(monitor, /return loadDeviceStatusesForMemberships\([\s\S]*?workspace \|\| undefined,[\s\S]*?true/);
  assert.match(monitor, /snapshotHasWearableCoverage\(data\)/);
  assert.match(monitor, /attributeRecordsByMeasuredSource/);
  assert.match(monitor, /return recordHasMeasuredData\(record\) \? \[record\] : \[\]/);
  assert.match(monitor, /const fieldSources = asRecord\(payload\.fieldSources\)/);
  assert.match(monitor, /devices\.some\(\(device\) => device\.dailyPresence\[dayIndex\]\)/);
  assert.match(monitor, /evidenceState:\s*AthleteDeviceEvidenceState/);
  assert.match(monitor, /const hasReadableDeviceEvidence = recordsLoad\.value\.length > 0/);
  assert.match(monitor, /!hasReadableDeviceEvidence\s*\? 'unavailable'/);
  assert.match(monitor, /matchesWorkspaceOrUnscopedSelf/);
  assert.match(dashboard, /const reportingDevices = deviceList\.filter\(\(device\) => device\.wearDaysCovered > 0\)/);
  assert.match(dashboard, /Tracked measurements/);
  assert.match(dashboard, /Connected integrations have no measured data/);
  assert.match(card, /const hasUnattributedWearDays = devicePresence\.some/);
  assert.match(card, /label: 'Wearable data'/);
  assert.match(card, /connectedSources\.filter\(\(source\) => source\.wearDaysCovered > 0\)/);
  assert.match(card, /device\.wearDaysCovered > 0/);
  assert.match(card, /Connected integrations · no measured data/);
  assert.doesNotMatch(monitor, /activeRecordCountsAsPresence/);
});
