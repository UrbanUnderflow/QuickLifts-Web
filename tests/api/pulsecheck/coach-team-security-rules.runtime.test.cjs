const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const repoRoot = path.resolve(__dirname, '../../..');
const read = (relativePath) =>
  fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

test('Firestore makes every coach/mobile security collection explicit', () => {
  const rules = read('firestore.rules');
  for (const collectionName of [
    'admin-settings',
    'athlete-mental-progress',
    'clinical-bridge-smoke-test-runs',
    'coachAthletes',
    'coach-notifications',
    'coach-nora-vault',
    'coach-athlete-conversations',
    'coach-athlete-messages',
    'coachScheduleImportJobs',
    'coach-team-schedule',
    'dailySentimentAnalysis',
    'escalation-conditions',
    'escalation-records',
    'health-context-source-records',
    'health-context-source-status',
    'mental-curriculum-assignments',
    'mental-exercises',
    'mental-recommendations',
    'pulsecheck-assessment-purchases',
    'pulsecheck-clinical-escalations',
    'pulsecheck-clinical-webhook-events',
    'pulsecheck-coach-payout-requests',
    'pulsecheck-coach-payout-states',
    'pulsecheck-coach-service-orders',
    'pulsecheck-coach-services',
    'pulsecheck-daily-assignments',
    'pulsecheck-morning-checkins',
    'pulsecheck-referral-attributions',
    'pulsecheck-team-memberships',
    'sim-modules',
    'sim-completions',
    'stripeConnect',
    'teams',
    'transactions',
    'users',
  ]) {
    assert.match(
      rules,
      new RegExp(`'${collectionName.replaceAll('-', '\\-')}'`),
      `${collectionName} must not fall through to the signed-in compatibility rule`
    );
  }
});

test('readiness, device, sentiment, escalation, and user policies are explicit and scoped', () => {
  const rules = read('firestore.rules');

  assert.match(
    rules,
    /match \/users\/\{userId\}[\s\S]*allow create: if isCanonicalRootUserCreate\(userId\)[\s\S]*allow update: if isSafeOwnPulseCheckPushMetadataUpdate\(userId\)[\s\S]*isCanonicalRootUserUpdate\(userId\)/
  );
  assert.match(
    rules,
    /!\('stripeCustomerIds' in request\.resource\.data\)/
  );
  assert.match(
    rules,
    /request\.resource\.data\.stripeCustomerIds[\s\S]*== resource\.data\.stripeCustomerIds/
  );
  assert.match(
    rules,
    /function isCanonicalRootUserUpdate\(userId\)[\s\S]*request\.auth\.uid == userId/
  );
  assert.match(rules, /match \/admin-settings\/\{document=\*\*\}/);
  assert.match(rules, /match \/coachAthletes\/\{connectionId\}/);
  assert.match(
    rules,
    /match \/pulsecheck-morning-checkins\/\{checkInId\}[\s\S]*allow create: if isAdminUser\(\)[\s\S]*affectedKeys\(\)\.hasOnly\(\[\s*'energyReset'/
  );
  assert.match(
    rules,
    /match \/dailySentimentAnalysis\/\{sentimentId\}[\s\S]*pcCanAccessCareTeamAthlete[\s\S]*allow create, update, delete: if isAdminUser\(\)/
  );
  assert.match(
    rules,
    /match \/health-context-source-records\/\{recordId\}[\s\S]*request\.resource\.data\.athleteUserId == request\.auth\.uid[\s\S]*!\('teamId' in request\.resource\.data\)/
  );
  assert.match(
    rules,
    /match \/health-context-source-status\/\{statusId\}[\s\S]*statusId == request\.auth\.uid \+ '_'[\s\S]*allow delete: if isAdminUser\(\)/
  );
  assert.match(
    rules,
    /match \/escalation-records\/\{escalationId\}[\s\S]*pcCanAccessClinicalTeamAthlete[\s\S]*allow create, update, delete: if isAdminUser\(\)/
  );
  assert.match(
    rules,
    /match \/escalation-conditions\/\{conditionId\}[\s\S]*allow read, create, update, delete: if isAdminUser\(\)/
  );
  assert.match(
    rules,
    /match \/pulsecheck-clinical-escalations\/\{escalationId\}[\s\S]*allow update: if pcClinicalEscalationAcknowledgementUpdateIsValid\(\)[\s\S]*match \/athleteAcknowledgements\/\{acknowledgementId\}/
  );
  assert.doesNotMatch(rules, /pcClinicalEscalationResolutionUpdateIsValid/);
  assert.match(
    rules,
    /match \/pulsecheck-clinical-webhook-events\/\{eventId\}[\s\S]*allow read: if isAdminUser\(\)[\s\S]*allow create, update, delete: if false/
  );
  assert.match(
    rules,
    /match \/clinical-bridge-smoke-test-runs\/\{runId\}[\s\S]*allow read: if isAdminUser\(\)[\s\S]*allow create, update, delete: if false/
  );
  assert.match(
    rules,
    /function changesServerOwnedClinicalStateFields\(\)[\s\S]*'clinicalCareState'[\s\S]*'crisisWallActive'[\s\S]*!changesServerOwnedClinicalStateFields\(\)/
  );
});

test('team members cannot self-grant sponsored or paid commercial access', () => {
  const rules = read('firestore.rules');
  const teamRule = rules.match(
    /match \/pulsecheck-teams\/\{teamId\}[\s\S]*?pcCanManageTeam\(teamId\)[\s\S]*?affectedKeys\(\)\.hasOnly\(\[([\s\S]*?)\]\)/
  );

  assert.ok(teamRule, 'the bounded team-admin update rule must remain explicit');
  assert.doesNotMatch(
    teamRule[1],
    /commercialConfig/,
    'commercialConfig contains access-granting billing fields and must stay server-owned'
  );
});

test('native readiness loaders require exact modern team and organization scope', () => {
  const repository = read(
    '../PulseCheck/PulseCheck/CoachDashboard/Data/FirebaseCoachDashboardRepository.swift'
  );
  const mentalService = read(
    '../PulseCheck/PulseCheck/CoachDashboard/MentalTraining/CoachMentalTrainingService.swift'
  );
  const morning = read('netlify/functions/record-morning-checkin.ts');
  const evening = read('netlify/functions/record-evening-checkin.ts');

  assert.match(
    repository,
    /static func readinessRecordBelongsToSelectedWorkspace[\s\S]*string\(data\["teamId"\]\) == teamAccess\.teamID[\s\S]*string\(data\["organizationId"\]\) == teamAccess\.organizationID/
  );
  assert.match(
    repository,
    /collection\("pulsecheck-morning-checkins"\)[\s\S]*whereField\("teamId", isEqualTo: teamAccess\.teamID\)[\s\S]*"organizationId",[\s\S]*isEqualTo: teamAccess\.organizationID/
  );
  assert.match(
    repository,
    /collection\("dailySentimentAnalysis"\)[\s\S]*whereField\("teamId", isEqualTo: teamAccess\.teamID\)[\s\S]*"organizationId",[\s\S]*isEqualTo: teamAccess\.organizationID/
  );
  assert.match(
    repository,
    /collection\("health-context-source-records"\)[\s\S]*whereField\("teamId", isEqualTo: teamAccess\.teamID\)[\s\S]*collection\("health-context-source-status"\)[\s\S]*whereField\("teamId", isEqualTo: teamAccess\.teamID\)/
  );
  assert.match(
    repository,
    /collection\("escalation-records"\)[\s\S]*whereField\("coachId", isEqualTo: coachID\)[\s\S]*whereField\("teamId", isEqualTo: teamAccess\.teamID\)/
  );
  assert.match(
    repository,
    /guard Self\.hasModernDashboardScope\(teamAccess\)/
  );
  assert.match(
    mentalService,
    /collection\(Collection\.recommendations\)[\s\S]*whereField\("teamId", isEqualTo: context\.teamAccess\.teamID\)[\s\S]*"organizationId",[\s\S]*isEqualTo: context\.teamAccess\.organizationID[\s\S]*whereField\("status", isEqualTo: "pending"\)/
  );
  assert.match(
    mentalService,
    /collection\(Collection\.assignments\)[\s\S]*whereField\("teamId", isEqualTo: context\.teamAccess\.teamID\)[\s\S]*"organizationId",[\s\S]*isEqualTo: context\.teamAccess\.organizationID/
  );
  assert.match(morning, /resolveUnambiguousAthleteScope\(db, auth\.uid\)/);
  assert.match(morning, /checkInWrite\.organizationId = organizationId/);
  assert.match(evening, /resolveUnambiguousAthleteScope\(db, auth\.uid\)/);
  assert.match(evening, /\? \{ teamId, organizationId \}/);
});

test('native scoped dashboard queries have committed composite indexes', () => {
  const indexes = JSON.parse(read('firestore.indexes.json')).indexes;
  const hasIndex = (collectionGroup, fieldPaths) => indexes.some(
    (index) => index.collectionGroup === collectionGroup
      && fieldPaths.every(
        (fieldPath) => index.fields.some((field) => field.fieldPath === fieldPath)
      )
  );
  const hasExactIndex = (collectionGroup, fields) => indexes.some(
    (index) => index.collectionGroup === collectionGroup
      && index.fields.length === fields.length
      && fields.every(({fieldPath, order}, fieldIndex) => (
        index.fields[fieldIndex].fieldPath === fieldPath
          && index.fields[fieldIndex].order === order
      ))
  );

  assert.equal(
    hasIndex('pulsecheck-morning-checkins', [
      'teamId',
      'organizationId',
      '__name__',
    ]),
    true
  );
  assert.equal(
    hasIndex('dailySentimentAnalysis', [
      'userId',
      'teamId',
      'organizationId',
    ]),
    true
  );
  assert.equal(
    hasIndex('health-context-source-records', [
      'athleteUserId',
      'teamId',
      'organizationId',
      'status',
      'observedAt',
    ]),
    true
  );
  assert.equal(
    hasExactIndex('health-context-source-records', [
      {fieldPath: 'athleteUserId', order: 'ASCENDING'},
      {fieldPath: 'organizationId', order: 'ASCENDING'},
      {fieldPath: 'status', order: 'ASCENDING'},
      {fieldPath: 'teamId', order: 'ASCENDING'},
      {fieldPath: 'observedAt', order: 'ASCENDING'},
    ]),
    true
  );
  assert.equal(
    hasIndex('health-context-source-status', [
      'athleteUserId',
      'teamId',
      'organizationId',
    ]),
    true
  );
  assert.equal(
    hasIndex('escalation-records', [
      'coachId',
      'teamId',
      'organizationId',
      'userId',
      'tier',
    ]),
    true
  );
  assert.equal(
    hasIndex('mental-recommendations', [
      'coachId',
      'teamId',
      'organizationId',
      'status',
    ]),
    true
  );
  assert.equal(
    hasIndex('mental-curriculum-assignments', [
      'athleteId',
      'teamId',
      'organizationId',
      'status',
    ]),
    true
  );
});

test('team workspaces, reports, messaging, and payment truth fail closed', () => {
  const rules = read('firestore.rules');

  assert.match(
    rules,
    /match \/coach-team-schedule\/\{eventId\}[\s\S]*pcTeamScopedDataIsActive\(request\.resource\.data\)/
  );
  assert.match(
    rules,
    /match \/pulsecheck-coach-services\/\{serviceId\}[\s\S]*request\.resource\.data\.teamId == resource\.data\.teamId/
  );
  assert.match(
    rules,
    /match \/pulsecheck-coach-services\/\{serviceId\}[\s\S]*allow create:[\s\S]*request\.resource\.data\.serviceType == 'one_time'/
  );
  assert.match(
    rules,
    /match \/pulsecheck-coach-services\/\{serviceId\}[\s\S]*allow update:[\s\S]*resource\.data\.serviceType == 'one_time'[\s\S]*request\.resource\.data\.serviceType == resource\.data\.serviceType/
  );
  assert.match(
    rules,
    /resource\.data\.serviceType == 'subscription'[\s\S]*request\.resource\.data\.serviceType == resource\.data\.serviceType[\s\S]*resource\.data\.status == 'active'[\s\S]*request\.resource\.data\.status == 'inactive'/
  );
  assert.match(
    rules,
    /request\.resource\.data\.diff\(resource\.data\)\.affectedKeys\(\)\.hasOnly\(\[\s*'status',\s*'updatedAt'\s*\]\)/
  );
  assert.match(
    rules,
    /match \/pulsecheck-team-memberships\/\{membershipId\}[\s\S]*pcIsSafeOwnMembershipUpdate/
  );
  assert.match(
    rules,
    /match \/teams\/\{teamId\}[\s\S]*match \/coachReports\/\{reportId\}[\s\S]*allow read, create, update, delete: if isAdminUser/
  );
  assert.match(
    rules,
    /match \/coachReportViews\/\{reportId\}[\s\S]*resource\.data\.reviewStatus in \['published', 'sent'\]/
  );
  assert.match(rules, /match \/coach-athlete-conversations\/\{conversationId\}/);
  assert.match(rules, /match \/coach-athlete-messages\/\{messageId\}/);
  assert.match(
    rules,
    /match \/pulsecheck-coach-service-orders\/\{orderId\}[\s\S]*allow read, create, update, delete: if isAdminUser/
  );
  assert.match(
    rules,
    /match \/pulsecheck-coach-payout-requests\/\{requestId\}[\s\S]*allow read, create, update, delete: if isAdminUser/
  );
  assert.match(
    rules,
    /match \/pulsecheck-coach-payout-states\/\{stateId\}[\s\S]*allow read, create, update, delete: if isAdminUser/
  );
  assert.match(
    rules,
    /match \/stripeConnect\/\{userId\}[\s\S]*allow read, create, update, delete: if isAdminUser/
  );
  assert.match(
    rules,
    /match \/pulsecheck-assessment-purchases\/\{purchaseId\}[\s\S]*resource\.data\.purchaserUserId == request\.auth\.uid[\s\S]*allow create, update, delete: if isAdminUser/
  );
  assert.match(
    rules,
    /match \/pulsecheck-referral-attributions\/\{attributionId\}[\s\S]*allow read, create, update, delete: if isAdminUser/
  );
  assert.match(
    rules,
    /match \/transactions\/\{transactionId\}[\s\S]*allow read, create, update, delete: if isAdminUser/
  );
  assert.match(
    rules,
    /match \/coachScheduleImportJobs\/\{jobId\}[\s\S]*allow read, create, update, delete: if false/
  );
});

test('Nora vault and notifications fail closed to their owner/team contracts', () => {
  const rules = read('firestore.rules');

  assert.match(rules, /match \/coach-nora-vault\/\{entryId\}/);
  assert.match(rules, /pcHasActiveTeamMembership\(resource\.data\.teamId\)/);
  assert.match(rules, /pcCanUseNora\(request\.resource\.data\.teamId\)/);
  assert.match(
    rules,
    /resource\.data\.teamId == 'legacy:' \+ request\.auth\.uid[\s\S]*pcHasValidLegacyCoachProfile/
  );
  assert.match(rules, /match \/coach-notifications\/\{notificationId\}/);
  assert.match(rules, /allow create, delete: if false/);
  assert.match(
    rules,
    /affectedKeys\(\)\.hasOnly\(\[[\s\S]*'read'[\s\S]*'archived'[\s\S]*'updatedAt'/
  );
});

test('mental training rules bind coach writes to a team and athlete self-assignments to a recommendation', () => {
  const rules = read('firestore.rules');

  assert.match(
    rules,
    /function pcIsValidAthleteSelfAssignment\(\)[\s\S]*exists\(pcRecommendationPath/
  );
  assert.match(
    rules,
    /request\.resource\.data\.coachId == recommendation\.coachId/
  );
  assert.match(rules, /recommendation\.status == 'pending'/);
  assert.match(
    rules,
    /request\.resource\.data\.exerciseId == recommendation\.exerciseId/
  );
  assert.match(
    rules,
    /request\.resource\.data\.teamId == recommendation\.teamId/
  );
  assert.match(
    rules,
    /request\.resource\.data\.organizationId == recommendation\.organizationId/
  );
  assert.match(
    rules,
    /match \/mental-recommendations\/\{recommendationId\}[\s\S]*allow read:[\s\S]*pcDataMatchesTeamOrganization\(\s*resource\.data,\s*resource\.data\.teamId/
  );
  assert.match(
    rules,
    /match \/mental-curriculum-assignments\/\{assignmentId\}[\s\S]*allow read:[\s\S]*pcDataMatchesTeamOrganization\(\s*resource\.data,\s*resource\.data\.teamId/
  );
  assert.match(
    rules,
    /pcStaffUserCanAccessTeamAthlete\(\s*recommendation\.coachId,\s*recommendation\.teamId,\s*request\.auth\.uid/
  );
  assert.match(
    rules,
    /pcCanAccessTeamAthlete\(\s*request\.resource\.data\.teamId,\s*request\.resource\.data\.athleteId/
  );
  assert.match(
    rules,
    /function pcProgressAssociationIsValid\(data, athleteId\)/
  );
  assert.match(rules, /match \/sim-modules\/\{moduleId\}[\s\S]*allow read: if isSignedIn\(\)/);
  assert.match(rules, /match \/mental-exercises\/\{exerciseId\}[\s\S]*allow create, update, delete: if isAdminUser\(\)/);
});

test('Storage uses raw team-scoped Nora folders and owner-only bounded profile images', () => {
  const rules = read('storage.rules');
  const vaultService = read('src/api/firebase/coach/noraVaultService.ts');

  assert.match(
    rules,
    /match \/coach-nora-vault\/\{coachId\}\/\{teamId\}\/\{fileName\}/
  );
  assert.match(rules, /pcCanUseNora\(teamId\)/);
  assert.match(rules, /pcHasValidLegacyCoachProfile\(coachId, teamId\)/);
  assert.match(rules, /function pcIsLegacyEncodedFolder\(teamId\)/);
  assert.match(
    vaultService,
    /coach-nora-vault\/\$\{coachId\}\/\$\{teamId\}\/\$\{fileName\}/
  );
  assert.match(rules, /match \/profile-images\/\{userId\}\/\{fileName\}/);
  assert.match(rules, /request\.resource\.size <= 10 \* 1024 \* 1024/);
  assert.match(rules, /request\.resource\.contentType\.matches\('image\/\.\*'\)/);
});
