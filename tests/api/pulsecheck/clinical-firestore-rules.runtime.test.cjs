const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const repoRoot = path.resolve(__dirname, '../../..');
const rules = fs.readFileSync(path.join(repoRoot, 'firestore.rules'), 'utf8');
const clinicalStaffPage = fs.readFileSync(
  path.join(repoRoot, 'src/pages/staff/clinical-escalations.tsx'),
  'utf8'
);
const safetyWriters = [
  'netlify/functions/clinical-callback.js',
  'netlify/functions/pulsecheck-escalation.js',
  'netlify/functions/record-clinical-escalation.js',
  'src/api/firebase/pulsecheckClinicalEscalation.ts',
].map((relativePath) => ({
  relativePath,
  source: fs.readFileSync(path.join(repoRoot, relativePath), 'utf8'),
}));
const firestoreIndexes = JSON.parse(
  fs.readFileSync(path.join(repoRoot, 'firestore.indexes.json'), 'utf8')
);

test('clinical and escalation collections cannot use the signed-in compatibility fallback', () => {
  for (const collectionName of [
    'clinical-bridge-smoke-test-runs',
    'escalation-conditions',
    'pulsecheck-athlete-safety-state',
    'pulsecheck-clinical-escalations',
    'pulsecheck-clinical-webhook-events',
  ]) {
    assert.match(
      rules,
      new RegExp(`'${collectionName}'`),
      `${collectionName} must be included in isExplicitlyRuledCollection`
    );
  }
});

test('private athlete safety state is owner/admin/scoped-clinician readable and client-write-denied', () => {
  assert.match(
    rules,
    /match \/pulsecheck-athlete-safety-state\/\{athleteUserId\}[\s\S]*request\.auth\.uid == athleteUserId[\s\S]*pcCanAccessClinicalTeamAthlete\([\s\S]*resource\.data\.teamId[\s\S]*athleteUserId[\s\S]*allow create, update, delete: if false;/
  );
});

test('clinical safety writers target the private safety collection instead of root user documents', () => {
  for (const { relativePath, source } of safetyWriters) {
    assert.match(
      source,
      /pulsecheck-athlete-safety-state/,
      `${relativePath} must target the private safety collection`
    );
    assert.doesNotMatch(
      source,
      /collection\(['"]users['"]\)\.doc\([^)]*\)\.(?:set|update)|doc\(db,\s*USERS_COLLECTION[^)]*\)[\s\S]{0,120}(?:setDoc|updateDoc)/,
      `${relativePath} must not write clinical safety state to users/{uid}`
    );
  }
});

test('clinical audit collections are admin-readable and reject all client writes', () => {
  for (const [collectionName, documentName] of [
    ['pulsecheck-clinical-webhook-events', 'eventId'],
    ['clinical-bridge-smoke-test-runs', 'runId'],
  ]) {
    assert.match(
      rules,
      new RegExp(
        `match \\/${collectionName.replaceAll('-', '\\-')}\\/\\{${documentName}\\}`
          + '[\\s\\S]*?allow read: if isAdminUser\\(\\);'
          + '[\\s\\S]*?allow create, update, delete: if false;'
      )
    );
  }
});

test('clinical escalation clients have bounded reads and acknowledgement-only writes', () => {
  assert.match(
    rules,
    /function pcCanAccessClinicalEscalation\(data\)[\s\S]*pcCanAccessClinicalTeamAthlete/
  );
  assert.match(
    rules,
    /function pcClinicalEscalationAcknowledgementUpdateIsValid\(\)[\s\S]*affectedKeys\(\)\.hasOnly\(\[[\s\S]*'acknowledgedAt'[\s\S]*'acknowledgedByUserId'[\s\S]*'deliveryStatus'[\s\S]*request\.resource\.data\.acknowledgedByUserId == request\.auth\.uid/
  );
  assert.doesNotMatch(
    rules,
    /function pcClinicalEscalationResolutionUpdateIsValid\(/
  );
  assert.match(
    rules,
    /match \/pulsecheck-clinical-escalations\/\{escalationId\}[\s\S]*allow create: if false;[\s\S]*allow update: if pcClinicalEscalationAcknowledgementUpdateIsValid\(\)[\s\S]*allow delete: if false;/
  );
  assert.doesNotMatch(
    rules,
    /allow update: if[\s\S]{0,200}pcClinicalEscalationResolutionUpdateIsValid/
  );
});

test('native acknowledgements are owner-bound, minimal, and append-only', () => {
  assert.match(
    rules,
    /function pcAthleteClinicalAcknowledgementCreateIsValid\(escalationId\)[\s\S]*get\(escalationPath\)\.data\.athleteUserId == request\.auth\.uid[\s\S]*keys\(\)\.hasOnly\(\[[\s\S]*'athleteUserId'[\s\S]*'acknowledgedAt'[\s\S]*request\.resource\.data\.athleteUserId == request\.auth\.uid/
  );
  assert.match(
    rules,
    /match \/athleteAcknowledgements\/\{acknowledgementId\}[\s\S]*allow create: if pcAthleteClinicalAcknowledgementCreateIsValid[\s\S]*allow read, update, delete: if false;/
  );
});

test('users cannot create or change server-owned crisis and clinical care state', () => {
  for (const field of [
    'clinicalCareState',
    'crisisWallActive',
    'crisisWallActivatedAt',
    'crisisWallActiveEscalationId',
    'crisisWallClearReason',
    'crisisWallClearedAt',
    'crisisWallClearedByUserId',
    'crisisWallReason',
  ]) {
    assert.match(rules, new RegExp(`'${field}'`));
  }
  assert.match(
    rules,
    /function isCanonicalRootUserCreate\(userId\)[\s\S]*!hasServerOwnedClinicalStateFields\(request\.resource\.data\)/
  );
  assert.match(
    rules,
    /function isCanonicalRootUserUpdate\(userId\)[\s\S]*!changesServerOwnedClinicalStateFields\(\)/
  );
});

test('escalation conditions remain admin-managed', () => {
  assert.match(
    rules,
    /match \/escalation-conditions\/\{conditionId\}[\s\S]*allow read, create, update, delete: if isAdminUser\(\);/
  );
});

test('clinical staff queue queries constrain both team and athlete before reading', () => {
  assert.match(
    clinicalStaffPage,
    /where\('teamId', '==', scope\.teamId\)[\s\S]*where\('athleteUserId', '==', scope\.athleteUserId\)/
  );
  assert.match(
    clinicalStaffPage,
    /buildClinicalEscalationQueueQueryScopes\([\s\S]*permission\.isAdmin/
  );
  assert.doesNotMatch(
    clinicalStaffPage,
    /\.filter\(\(row\) => allowed === 'all'/
  );
});

test('clinical queue composite indexes are checked in for admin and scoped queries', () => {
  const clinicalIndexes = firestoreIndexes.indexes
    .filter((index) => index.collectionGroup === 'pulsecheck-clinical-escalations')
    .map((index) => index.fields.map((field) => `${field.fieldPath}:${field.order}`));
  const hasIndex = (expectedFields) => clinicalIndexes.some(
    (fields) => JSON.stringify(fields) === JSON.stringify(expectedFields)
  );

  assert.equal(hasIndex([
    'deliveryStatus:ASCENDING',
    'detectedAt:DESCENDING',
  ]), true);
  assert.equal(hasIndex([
    'teamId:ASCENDING',
    'athleteUserId:ASCENDING',
    'deliveryStatus:ASCENDING',
    'detectedAt:DESCENDING',
  ]), true);
});
