const fs = require('node:fs');
const path = require('node:path');
const {
  after,
  before,
  beforeEach,
  test,
} = require('node:test');
const {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} = require('@firebase/rules-unit-testing');
const {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
} = require('firebase/firestore');

const repoRoot = path.resolve(__dirname, '../../..');
const projectId = 'demo-pulsecheck-clinical-rules';
const organizationId = 'org-1';
const otherOrganizationId = 'org-2';
const teamId = 'team-1';
const otherTeamId = 'team-2';
const athleteId = 'athlete-1';
const otherAthleteId = 'athlete-2';
const clinicianId = 'clinician-1';
const otherClinicianId = 'clinician-2';
const coachId = 'coach-1';
const adminId = 'platform-admin';
const adminEmail = 'platform-admin@fitwithpulse.test';
const escalationId = 'clinical-escalation-1';

let testEnv;

function canonicalUserData(userId, email) {
  return {
    id: userId,
    email,
    createdAt: Timestamp.fromMillis(Date.UTC(2026, 7, 5, 12)),
    lifetimePulsePoints: 0,
    categoryPoints: {},
    creator: false,
    username: userId.replace(/[^a-z0-9_.-]/g, '').slice(0, 20),
    displayName: 'Test Athlete',
    birthdate: null,
    profileImage: null,
    registrationComplete: true,
    level: 'novice',
    subscriptionType: 'Beta User',
    subscriptionPlatform: 'ios',
    checkinsPrivacy: 'privateOnly',
    legalAcceptance: {
      termsVersion: 'v1',
      privacyVersion: 'v1',
      acceptedAt: Timestamp.fromMillis(Date.UTC(2026, 7, 5, 12)),
      acceptanceMethod: 'test',
      termsPath: '/terms',
      privacyPath: '/privacy',
    },
    crisisWallActive: true,
    crisisWallActivatedAt: Timestamp.fromMillis(Date.UTC(2026, 7, 5, 12, 5)),
    crisisWallActiveEscalationId: escalationId,
    crisisWallReason: 'clinical_safety_handoff',
    clinicalCareState: {
      appState: 'protective',
      returnToTrainingStatus: 'not_cleared',
    },
  };
}

async function seedBaseData(db) {
  await Promise.all([
    setDoc(doc(db, 'admin', adminEmail), {role: 'admin'}),
    setDoc(doc(db, 'pulsecheck-organizations', organizationId), {status: 'active'}),
    setDoc(doc(db, 'pulsecheck-organizations', otherOrganizationId), {status: 'active'}),
    setDoc(doc(db, 'pulsecheck-teams', teamId), {
      organizationId,
      status: 'active',
    }),
    setDoc(doc(db, 'pulsecheck-teams', otherTeamId), {
      organizationId: otherOrganizationId,
      status: 'active',
    }),
    setDoc(doc(db, 'pulsecheck-team-memberships', `${teamId}_${athleteId}`), {
      userId: athleteId,
      teamId,
      organizationId,
      role: 'athlete',
      status: 'active',
    }),
    setDoc(doc(db, 'pulsecheck-team-memberships', `${otherTeamId}_${otherAthleteId}`), {
      userId: otherAthleteId,
      teamId: otherTeamId,
      organizationId: otherOrganizationId,
      role: 'athlete',
      status: 'active',
    }),
    setDoc(doc(db, 'pulsecheck-team-memberships', `${teamId}_${clinicianId}`), {
      userId: clinicianId,
      teamId,
      organizationId,
      role: 'clinician',
      status: 'active',
      staffCapabilities: ['athletic_trainer'],
      rosterVisibilityScope: 'team',
    }),
    setDoc(doc(db, 'pulsecheck-team-memberships', `${otherTeamId}_${otherClinicianId}`), {
      userId: otherClinicianId,
      teamId: otherTeamId,
      organizationId: otherOrganizationId,
      role: 'clinician',
      status: 'active',
      staffCapabilities: ['athletic_trainer'],
      rosterVisibilityScope: 'team',
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
    setDoc(doc(db, 'pulsecheck-clinical-escalations', escalationId), {
      athleteUserId: athleteId,
      teamId,
      organizationId,
      tier: 3,
      deliveryStatus: 'clinician_paged',
      detectedAt: 1_754_395_200,
      evidence: [{label: 'synthetic rules test'}],
    }),
    setDoc(doc(db, 'pulsecheck-clinical-escalations', 'other-team-escalation'), {
      athleteUserId: otherAthleteId,
      teamId: otherTeamId,
      organizationId: otherOrganizationId,
      tier: 3,
      deliveryStatus: 'clinician_paged',
      detectedAt: 1_754_395_200,
      evidence: [{label: 'synthetic rules test'}],
    }),
    setDoc(doc(db, 'pulsecheck-clinical-webhook-events', 'event-1'), {
      eventType: 'clinician.assigned',
      processingStatus: 'processed',
    }),
    setDoc(doc(db, 'pulsecheck-athlete-safety-state', athleteId), {
      athleteUserId: athleteId,
      teamId,
      watchListActive: true,
      appState: 'protective',
      returnToTrainingStatus: 'not_cleared',
      crisisWallActive: true,
      crisisWallActiveEscalationId: escalationId,
      crisisWallReason: 'clinical_safety_handoff',
    }),
    setDoc(doc(db, 'clinical-bridge-smoke-test-runs', 'run-1'), {
      action: 'health',
      createdAtEpoch: 1_754_395_200,
    }),
    setDoc(doc(db, 'escalation-conditions', 'tier-3-condition'), {
      tier: 3,
      title: 'Critical safety concern',
      isActive: true,
    }),
    setDoc(
      doc(db, 'users', athleteId),
      canonicalUserData(athleteId, 'athlete-1@fitwithpulse.test')
    ),
  ]);
}

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
    await seedBaseData(context.firestore());
  });
});

after(async () => {
  await testEnv.cleanup();
});

test('escalation conditions are admin-only', async () => {
  const athleteDb = testEnv.authenticatedContext(athleteId, {
    email: 'athlete-1@fitwithpulse.test',
  }).firestore();
  const adminDb = testEnv.authenticatedContext(adminId, {email: adminEmail}).firestore();
  const conditionPath = ['escalation-conditions', 'tier-3-condition'];

  await assertFails(getDoc(doc(athleteDb, ...conditionPath)));
  await assertFails(updateDoc(doc(athleteDb, ...conditionPath), {isActive: false}));
  await assertSucceeds(getDoc(doc(adminDb, ...conditionPath)));
  await assertSucceeds(updateDoc(doc(adminDb, ...conditionPath), {isActive: false}));
});

test('webhook receipts and smoke runs are admin-readable and client-write-denied', async () => {
  const athleteDb = testEnv.authenticatedContext(athleteId).firestore();
  const adminDb = testEnv.authenticatedContext(adminId, {email: adminEmail}).firestore();
  const targets = [
    ['pulsecheck-clinical-webhook-events', 'event-1'],
    ['clinical-bridge-smoke-test-runs', 'run-1'],
  ];

  for (const target of targets) {
    await assertFails(getDoc(doc(athleteDb, ...target)));
    await assertSucceeds(getDoc(doc(adminDb, ...target)));
    await assertFails(updateDoc(doc(adminDb, ...target), {forged: true}));
    await assertFails(deleteDoc(doc(adminDb, ...target)));
    await assertFails(setDoc(doc(adminDb, target[0], 'forged'), {forged: true}));
  }
});

test('clinical escalation reads are limited to admins and the scoped clinical team', async () => {
  const adminDb = testEnv.authenticatedContext(adminId, {email: adminEmail}).firestore();
  const clinicianDb = testEnv.authenticatedContext(clinicianId).firestore();
  const otherClinicianDb = testEnv.authenticatedContext(otherClinicianId).firestore();
  const coachDb = testEnv.authenticatedContext(coachId).firestore();
  const athleteDb = testEnv.authenticatedContext(athleteId).firestore();
  const target = doc(clinicianDb, 'pulsecheck-clinical-escalations', escalationId);

  await assertSucceeds(getDoc(doc(adminDb, 'pulsecheck-clinical-escalations', escalationId)));
  await assertSucceeds(getDoc(target));
  await assertFails(getDoc(doc(otherClinicianDb, 'pulsecheck-clinical-escalations', escalationId)));
  await assertFails(getDoc(doc(coachDb, 'pulsecheck-clinical-escalations', escalationId)));
  await assertFails(getDoc(doc(athleteDb, 'pulsecheck-clinical-escalations', escalationId)));
});

test('private athlete safety state has bounded reads and no client writes', async () => {
  const anonymousDb = testEnv.unauthenticatedContext().firestore();
  const ownerDb = testEnv.authenticatedContext(athleteId).firestore();
  const otherAthleteDb = testEnv.authenticatedContext(otherAthleteId).firestore();
  const clinicianDb = testEnv.authenticatedContext(clinicianId).firestore();
  const otherClinicianDb = testEnv.authenticatedContext(otherClinicianId).firestore();
  const coachDb = testEnv.authenticatedContext(coachId).firestore();
  const adminDb = testEnv.authenticatedContext(adminId, {email: adminEmail}).firestore();
  const target = (database) => doc(database, 'pulsecheck-athlete-safety-state', athleteId);

  await assertFails(getDoc(target(anonymousDb)));
  await assertSucceeds(getDoc(target(ownerDb)));
  await assertFails(getDoc(target(otherAthleteDb)));
  await assertSucceeds(getDoc(target(clinicianDb)));
  await assertFails(getDoc(target(otherClinicianDb)));
  await assertFails(getDoc(target(coachDb)));
  await assertSucceeds(getDoc(target(adminDb)));

  for (const database of [ownerDb, clinicianDb, adminDb]) {
    await assertFails(updateDoc(target(database), {crisisWallActive: false}));
    await assertFails(deleteDoc(target(database)));
    await assertFails(setDoc(
      doc(database, 'pulsecheck-athlete-safety-state', 'forged-athlete'),
      {athleteUserId: 'forged-athlete', crisisWallActive: false}
    ));
  }
});

test('clinical queue queries constrain both the authorized team and athlete', async () => {
  const clinicianDb = testEnv.authenticatedContext(clinicianId).firestore();
  const adminDb = testEnv.authenticatedContext(adminId, {email: adminEmail}).firestore();
  const activeStatuses = ['pending', 'clinician_paged', 'clinician_acknowledged'];
  const broadQueue = (db) => query(
    collection(db, 'pulsecheck-clinical-escalations'),
    where('deliveryStatus', 'in', activeStatuses),
    orderBy('detectedAt', 'desc'),
    limit(50),
  );
  const scopedQueue = query(
    collection(clinicianDb, 'pulsecheck-clinical-escalations'),
    where('teamId', '==', teamId),
    where('athleteUserId', '==', athleteId),
    where('deliveryStatus', 'in', activeStatuses),
    orderBy('detectedAt', 'desc'),
    limit(50),
  );

  await assertFails(getDocs(broadQueue(clinicianDb)));
  await assertSucceeds(getDocs(scopedQueue));
  await assertSucceeds(getDocs(broadQueue(adminDb)));
});

test('clinical team client updates are limited to acknowledgement', async () => {
  const clinicianDb = testEnv.authenticatedContext(clinicianId).firestore();
  const target = doc(clinicianDb, 'pulsecheck-clinical-escalations', escalationId);

  await assertFails(updateDoc(target, {
    athleteUserId: otherAthleteId,
    evidence: [{label: 'forged'}],
  }));

  await assertSucceeds(updateDoc(target, {
    acknowledgedAt: serverTimestamp(),
    acknowledgedByUserId: clinicianId,
    deliveryStatus: 'clinician_acknowledged',
  }));

  await assertFails(updateDoc(target, {
    acknowledgedByUserId: otherClinicianId,
  }));

  await assertFails(updateDoc(target, {
    resolvedAt: serverTimestamp(),
    resolvedByUserId: clinicianId,
    resolutionNote: 'Reviewed through the clinical-team test workflow.',
    deliveryStatus: 'resolved',
  }));

  await assertFails(deleteDoc(target));
  await assertFails(setDoc(
    doc(clinicianDb, 'pulsecheck-clinical-escalations', 'client-created'),
    {athleteUserId: athleteId, teamId, tier: 3}
  ));
});

test('only the owning athlete can create a minimal acknowledgement record', async () => {
  const athleteDb = testEnv.authenticatedContext(athleteId).firestore();
  const otherAthleteDb = testEnv.authenticatedContext(otherAthleteId).firestore();
  const acknowledgement = doc(
    athleteDb,
    'pulsecheck-clinical-escalations',
    escalationId,
    'athleteAcknowledgements',
    'ack-1'
  );

  await assertSucceeds(setDoc(acknowledgement, {
    athleteUserId: athleteId,
    acknowledgedAt: serverTimestamp(),
  }));
  await assertFails(getDoc(acknowledgement));
  await assertFails(updateDoc(acknowledgement, {athleteUserId: otherAthleteId}));
  await assertFails(deleteDoc(acknowledgement));

  await assertFails(setDoc(doc(
    otherAthleteDb,
    'pulsecheck-clinical-escalations',
    escalationId,
    'athleteAcknowledgements',
    'forged-owner'
  ), {
    athleteUserId: otherAthleteId,
    acknowledgedAt: serverTimestamp(),
  }));

  await assertFails(setDoc(doc(
    athleteDb,
    'pulsecheck-clinical-escalations',
    escalationId,
    'athleteAcknowledgements',
    'extra-field'
  ), {
    athleteUserId: athleteId,
    acknowledgedAt: serverTimestamp(),
    note: 'extra client-authored content',
  }));
});

test('athletes cannot author or clear server-owned crisis and clinical care state', async () => {
  const athleteDb = testEnv.authenticatedContext(athleteId, {
    email: 'athlete-1@fitwithpulse.test',
  }).firestore();
  const userRef = doc(athleteDb, 'users', athleteId);

  await assertSucceeds(updateDoc(userRef, {displayName: 'Updated Test Athlete'}));
  await assertFails(updateDoc(userRef, {crisisWallActive: false}));
  await assertFails(updateDoc(userRef, {
    clinicalCareState: {
      appState: 'normal',
      returnToTrainingStatus: 'cleared',
    },
  }));

  const newUserId = 'athlete-3';
  const newUserDb = testEnv.authenticatedContext(newUserId, {
    email: 'athlete-3@fitwithpulse.test',
  }).firestore();
  await assertFails(setDoc(
    doc(newUserDb, 'users', newUserId),
    canonicalUserData(newUserId, 'athlete-3@fitwithpulse.test')
  ));
});
