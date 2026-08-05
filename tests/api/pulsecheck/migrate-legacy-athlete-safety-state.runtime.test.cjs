const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const repoRoot = path.resolve(__dirname, '../../..');
const scriptPath = path.join(repoRoot, 'scripts/migrateLegacyAthleteSafetyState.js');
const scriptSource = fs.readFileSync(scriptPath, 'utf8');
const {
  LEGACY_USER_FIELDS,
  buildPrivateSafetyState,
  parseArgs,
} = require(scriptPath);

test('legacy safety migration is dry-run by default and caps its scan', () => {
  const defaults = parseArgs([]);
  const apply = parseArgs(['--apply', '--limit=50000', '--user-id=athlete-1']);

  assert.equal(defaults.apply, false);
  assert.equal(defaults.limit, 250);
  assert.equal(apply.apply, true);
  assert.equal(apply.limit, 1000);
  assert.equal(apply.userId, 'athlete-1');
});

test('legacy safety migration copies only allow-listed coarse state', () => {
  const privateState = buildPrivateSafetyState('athlete-1', {
    crisisWallActive: true,
    crisisWallReason: 'clinical_watchlist_active',
    clinicalCareState: {
      watchList: true,
      appState: 'protective',
      returnToTrainingStatus: 'not_cleared',
      clinicalNotes: 'must not migrate',
    },
    email: 'public-profile@example.test',
    clinicalNotes: 'must not migrate',
  }, 'team-1');

  assert.deepEqual(privateState, {
    athleteUserId: 'athlete-1',
    teamId: 'team-1',
    crisisWallActive: true,
    crisisWallReason: 'clinical_watchlist_active',
    watchListActive: true,
    appState: 'protective',
    returnToTrainingStatus: 'not_cleared',
  });
});

test('legacy safety migration deletes only named fields and never deletes documents', () => {
  assert.deepEqual(LEGACY_USER_FIELDS, [
    'clinicalCareState',
    'crisisWallActive',
    'crisisWallActivatedAt',
    'crisisWallActiveEscalationId',
    'crisisWallClearReason',
    'crisisWallClearedAt',
    'crisisWallClearedByUserId',
    'crisisWallReason',
  ]);
  assert.doesNotMatch(scriptSource, /batch\.delete\s*\(|(?:userDoc|userRef|safetyRef)\.delete\s*\(/);
  assert.match(scriptSource, /batch\.update\(userDoc\.ref, buildLegacyFieldDeletion\(\)\)/);
});
