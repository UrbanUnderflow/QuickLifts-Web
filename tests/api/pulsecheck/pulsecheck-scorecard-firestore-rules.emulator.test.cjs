const fs = require('node:fs');
const path = require('node:path');
const {after, before, beforeEach, test} = require('node:test');
const {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} = require('@firebase/rules-unit-testing');
const {
  deleteDoc,
  doc,
  getDoc,
  setDoc,
  updateDoc,
} = require('firebase/firestore');

const repoRoot = path.resolve(__dirname, '../../..');
const projectId = 'demo-pulsecheck-scorecard-rules';
const athleteId = 'athlete-1';
const otherAthleteId = 'athlete-2';
const coachId = 'coach-1';
const adminEmail = 'platform-admin@fitwithpulse.test';
const organizationId = 'org-1';
const teamId = 'team-1';

let testEnv;

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId,
    firestore: {
      rules: fs.readFileSync(path.join(repoRoot, 'firestore.rules'), 'utf8'),
    },
  });
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await Promise.all([
      setDoc(doc(db, 'admin', adminEmail), {role: 'admin'}),
      setDoc(doc(db, 'pulsecheck-organizations', organizationId), {status: 'active'}),
      setDoc(doc(db, 'pulsecheck-teams', teamId), {
        organizationId,
        status: 'active',
      }),
      setDoc(doc(db, 'pulsecheck-team-memberships', `${teamId}_${athleteId}`), {
        userId: athleteId,
        teamId,
        organizationId,
        role: 'athlete',
        status: 'active',
      }),
      setDoc(doc(db, 'pulsecheck-team-memberships', `${teamId}_${coachId}`), {
        userId: coachId,
        teamId,
        organizationId,
        role: 'coach',
        status: 'active',
        staffCapabilities: ['coaching'],
        rosterVisibilityScope: 'team',
      }),
      setDoc(doc(db, 'pulsecheck-scorecards', `${athleteId}_v2`), {
        athleteUserId: athleteId,
        autonomic: {
          hrv: {currentValue: 52, laneId: 'whoop_rmssd_sleep_v1'},
        },
      }),
      setDoc(doc(db, 'health-context-snapshots', `${athleteId}_daily_2026-08-16`), {
        athleteUserId: athleteId,
        dateKey: '2026-08-16',
        sleepDurationHours: 7.5,
      }),
      setDoc(doc(db, 'health-context-snapshots', `${athleteId}_staff_2026-08-15`), {
        athleteUserId: athleteId,
        teamId,
        organizationId,
        dateKey: '2026-08-15',
        sleepDurationHours: 7.25,
      }),
    ]);
  });
});

after(async () => {
  await testEnv.cleanup();
});

test('raw scorecards are admin-only and all client writes are denied', async () => {
  const athleteDb = testEnv.authenticatedContext(athleteId).firestore();
  const coachDb = testEnv.authenticatedContext(coachId).firestore();
  const adminDb = testEnv.authenticatedContext('platform-admin', {email: adminEmail}).firestore();
  const scorecard = (db) => doc(db, 'pulsecheck-scorecards', `${athleteId}_v2`);

  await assertFails(getDoc(scorecard(athleteDb)));
  await assertFails(getDoc(scorecard(coachDb)));
  await assertSucceeds(getDoc(scorecard(adminDb)));
  await assertFails(updateDoc(scorecard(adminDb), {methodologyVersion: 'forged'}));
  await assertFails(deleteDoc(scorecard(adminDb)));
  await assertFails(setDoc(doc(adminDb, 'pulsecheck-scorecards', 'forged'), {
    athleteUserId: athleteId,
  }));
});

test('athletes can read and update only their own unscoped health snapshot', async () => {
  const athleteDb = testEnv.authenticatedContext(athleteId).firestore();
  const otherDb = testEnv.authenticatedContext(otherAthleteId).firestore();
  const snapshot = (db) => doc(db, 'health-context-snapshots', `${athleteId}_daily_2026-08-16`);

  await assertSucceeds(getDoc(snapshot(athleteDb)));
  await assertFails(getDoc(snapshot(otherDb)));
  await assertSucceeds(updateDoc(snapshot(athleteDb), {sleepDurationHours: 8}));
  await assertFails(updateDoc(snapshot(otherDb), {sleepDurationHours: 8}));
});

test('athletes cannot attach team or organization scope to their health data', async () => {
  const athleteDb = testEnv.authenticatedContext(athleteId).firestore();
  const existing = doc(athleteDb, 'health-context-snapshots', `${athleteId}_daily_2026-08-16`);
  const newSnapshot = doc(athleteDb, 'health-context-snapshots', `${athleteId}_daily_2026-08-14`);

  await assertFails(updateDoc(existing, {teamId, organizationId}));
  await assertFails(setDoc(newSnapshot, {
    athleteUserId: athleteId,
    teamId,
    organizationId,
    dateKey: '2026-08-14',
  }));
});

test('care-team reads require a server-scoped row and active roster relationship', async () => {
  const coachDb = testEnv.authenticatedContext(coachId).firestore();
  const scoped = doc(coachDb, 'health-context-snapshots', `${athleteId}_staff_2026-08-15`);
  const unscoped = doc(coachDb, 'health-context-snapshots', `${athleteId}_daily_2026-08-16`);

  await assertSucceeds(getDoc(scoped));
  await assertFails(getDoc(unscoped));
});
