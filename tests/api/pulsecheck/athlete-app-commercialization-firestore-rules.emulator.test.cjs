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
const projectId = 'demo-pulsecheck-athlete-app-commercialization';
const organizationId = 'org-1';
const teamId = 'team-1';
const coachId = 'coach-1';
const athleteId = 'athlete-1';
const otherAthleteId = 'athlete-2';
const adminId = 'platform-admin';
const adminEmail = 'platform-admin@fitwithpulse.test';

const protectedDocuments = [
  ['pulsecheck-athlete-app-offers', teamId],
  ['pulsecheck-athlete-app-entitlements', `${teamId}_${athleteId}`],
  ['pulsecheck-athlete-app-revenue-events', 'invoice-1'],
  ['pulsecheck-athlete-app-checkouts', 'checkout-session-1'],
  ['pulsecheck-athlete-app-checkout-locks', `${teamId}_${athleteId}`],
  ['pulsecheck-athlete-app-invite-checkout-locks', 'invite-1'],
  ['pulsecheck-athlete-app-commercialization', teamId],
];

let testEnv;

async function seedCommercializationTruth(db) {
  await Promise.all([
    setDoc(doc(db, 'admin', adminEmail), {role: 'admin'}),
    setDoc(doc(db, 'pulsecheck-organizations', organizationId), {
      status: 'active',
    }),
    setDoc(doc(db, 'pulsecheck-teams', teamId), {
      organizationId,
      status: 'active',
    }),
    setDoc(doc(db, 'pulsecheck-team-memberships', `${teamId}_${coachId}`), {
      userId: coachId,
      teamId,
      organizationId,
      role: 'coach',
      status: 'active',
      staffCapabilities: ['coaching'],
    }),
    setDoc(doc(db, 'pulsecheck-team-memberships', `${teamId}_${athleteId}`), {
      userId: athleteId,
      teamId,
      organizationId,
      role: 'athlete',
      status: 'active',
    }),
    setDoc(doc(db, 'pulsecheck-athlete-app-offers', teamId), {
      offerId: teamId,
      teamId,
      organizationId,
      enabled: true,
      status: 'active',
      monthlyPriceCents: 1999,
      revenueRecipientUserId: coachId,
    }),
    setDoc(
      doc(
        db,
        'pulsecheck-athlete-app-entitlements',
        `${teamId}_${athleteId}`
      ),
      {
        userId: athleteId,
        teamId,
        organizationId,
        status: 'active',
        active: true,
        currentPeriodEndEpochSeconds: 2_000_000_000,
      }
    ),
    setDoc(
      doc(
        db,
        'pulsecheck-athlete-app-entitlements',
        `${teamId}_${otherAthleteId}`
      ),
      {
        userId: otherAthleteId,
        teamId,
        organizationId,
        status: 'active',
        active: true,
        currentPeriodEndEpochSeconds: 2_000_000_000,
      }
    ),
    setDoc(doc(db, 'pulsecheck-athlete-app-revenue-events', 'invoice-1'), {
      userId: athleteId,
      teamId,
      organizationId,
      revenueRecipientUserId: coachId,
      stripeInvoiceId: 'invoice-1',
      status: 'paid',
      grossRevenueCents: 1999,
      coachNetCents: 670,
    }),
    setDoc(doc(db, 'pulsecheck-athlete-app-checkouts', 'checkout-session-1'), {
      userId: athleteId,
      teamId,
      inviteToken: 'invite-1',
      status: 'pending',
    }),
    setDoc(
      doc(db, 'pulsecheck-athlete-app-checkout-locks', `${teamId}_${athleteId}`),
      {
        userId: athleteId,
        teamId,
        inviteToken: 'invite-1',
        status: 'reserved',
      }
    ),
    setDoc(doc(db, 'pulsecheck-athlete-app-invite-checkout-locks', 'invite-1'), {
      userId: athleteId,
      teamId,
      inviteToken: 'invite-1',
      status: 'reserved',
    }),
    setDoc(doc(db, 'pulsecheck-athlete-app-commercialization', teamId), {
      teamId,
      organizationId,
      enabled: true,
    }),
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
    await seedCommercializationTruth(context.firestore());
  });
});

after(async () => {
  await testEnv.cleanup();
});

test('an athlete cannot read, forge, alter, or delete an entitlement', async () => {
  const db = testEnv.authenticatedContext(athleteId).firestore();
  const ownEntitlement = doc(
    db,
    'pulsecheck-athlete-app-entitlements',
    `${teamId}_${athleteId}`
  );
  const otherEntitlement = doc(
    db,
    'pulsecheck-athlete-app-entitlements',
    `${teamId}_${otherAthleteId}`
  );
  const forgedEntitlement = doc(
    db,
    'pulsecheck-athlete-app-entitlements',
    `${teamId}_${athleteId}_forged`
  );

  await assertFails(getDoc(ownEntitlement));
  await assertFails(getDoc(otherEntitlement));
  await assertFails(updateDoc(ownEntitlement, {active: false}));
  await assertFails(deleteDoc(ownEntitlement));
  await assertFails(setDoc(forgedEntitlement, {
    userId: athleteId,
    teamId,
    organizationId,
    status: 'active',
    active: true,
    currentPeriodEndEpochSeconds: 4_000_000_000,
  }));
});

test('internal commercialization records are unreadable to athlete, coach, and admin clients', async () => {
  const clientDatabases = [
    testEnv.authenticatedContext(athleteId).firestore(),
    testEnv.authenticatedContext(coachId).firestore(),
    testEnv.authenticatedContext(adminId, {email: adminEmail}).firestore(),
  ];

  for (const db of clientDatabases) {
    for (const [collectionName, documentId] of protectedDocuments) {
      await assertFails(getDoc(doc(db, collectionName, documentId)));
    }
  }
});

test('every internal commercialization collection rejects client mutations', async () => {
  const clientDatabases = [
    testEnv.authenticatedContext(athleteId).firestore(),
    testEnv.authenticatedContext(coachId).firestore(),
    testEnv.authenticatedContext(adminId, {email: adminEmail}).firestore(),
  ];

  for (const [actorIndex, db] of clientDatabases.entries()) {
    for (const [collectionName, documentId] of protectedDocuments) {
      await assertFails(updateDoc(
        doc(db, collectionName, documentId),
        {status: `forged-${actorIndex}`}
      ));
      await assertFails(deleteDoc(doc(db, collectionName, documentId)));
      await assertFails(setDoc(
        doc(db, collectionName, `forged-${actorIndex}`),
        {userId: athleteId, teamId, status: 'active', active: true}
      ));
    }
  }
});
