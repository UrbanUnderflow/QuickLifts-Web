import {
  collection,
  deleteDoc,
  doc,
  documentId,
  endAt,
  getDoc,
  getDocs,
  orderBy,
  query,
  setDoc,
  startAt,
  where,
} from 'firebase/firestore';

import type { Firestore } from 'firebase/firestore';

import {
  ATHLETE_MENTAL_PROGRESS_COLLECTION,
  PULSECHECK_DAILY_ASSIGNMENTS_COLLECTION,
  SIM_CHECKINS_ROOT,
  SIM_COMPLETIONS_ROOT,
  SIM_MODULES_COLLECTION,
  SIM_VARIANTS_COLLECTION,
} from './collections';
import { athleteProgressService } from './athleteProgressService';
import { assignmentOrchestratorService } from './assignmentOrchestratorService';
import { completionService } from './completionService';
import { simModuleLibraryService } from './exerciseLibraryService';
import { BiggestChallenge, ExerciseCategory } from './types';

const E2E_HISTORY_COLLECTION = 'history';
const USERS_COLLECTION = 'users';
const COACHES_COLLECTION = 'coaches';
const COACH_ATHLETES_COLLECTION = 'coachAthletes';
const COACH_REFERRALS_COLLECTION = 'coachReferrals';
const COACH_NOTIFICATIONS_COLLECTION = 'coach-notifications';
const PULSECHECK_ORGANIZATIONS_COLLECTION = 'pulsecheck-organizations';
const PULSECHECK_TEAMS_COLLECTION = 'pulsecheck-teams';
const PULSECHECK_TEAM_MEMBERSHIPS_COLLECTION = 'pulsecheck-team-memberships';
const PULSECHECK_ORGANIZATION_MEMBERSHIPS_COLLECTION = 'pulsecheck-organization-memberships';
const PULSECHECK_LEGACY_MIGRATIONS_COLLECTION = 'pulsecheck-legacy-roster-migrations';
const REFERRAL_CODE_LOOKUP_COLLECTION = 'referralCodeLookup';

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function sanitizeNamespace(namespace: string) {
  const normalized = slugify(namespace || 'e2e-registry');
  return normalized || 'e2e-registry';
}

function buildPrefix(namespace: string) {
  return `${sanitizeNamespace(namespace)}-`;
}

function buildFixtureName(sourceName: string) {
  return `[E2E] ${sourceName}`;
}

function buildNamespacedId(namespace: string, sourceId: string) {
  return `${buildPrefix(namespace)}${sourceId}`;
}

function buildLegacyRosterFixtureIds(namespace: string) {
  const prefix = buildPrefix(namespace);
  const label = sanitizeNamespace(namespace).replace(/-/g, ' ');
  return {
    namespace: sanitizeNamespace(namespace),
    coachId: `${prefix}coach`,
    athleteOneId: `${prefix}athlete-a`,
    athleteTwoId: `${prefix}athlete-b`,
    coachEmail: `${prefix}coach@pulse.test`,
    athleteOneEmail: `${prefix}athlete-a@pulse.test`,
    athleteTwoEmail: `${prefix}athlete-b@pulse.test`,
    coachDisplayName: `E2E Legacy Coach ${label}`,
    athleteOneName: `E2E Legacy Athlete A ${label}`,
    athleteTwoName: `E2E Legacy Athlete B ${label}`,
    coachReferralCode: sanitizeNamespace(namespace).replace(/-/g, '').slice(0, 12).toUpperCase() || 'E2ELEGACY',
    existingOrganizationId: `${prefix}org`,
    existingTeamId: `${prefix}team`,
    existingOrganizationName: `E2E Existing Org ${label}`,
    existingTeamName: `E2E Existing Team ${label}`,
    connectionOneId: `${prefix}link-a`,
    connectionTwoId: `${prefix}link-b`,
  };
}

function buildAdminWorkspaceFixtureIds(namespace: string) {
  const prefix = buildPrefix(namespace);
  const label = sanitizeNamespace(namespace).replace(/-/g, ' ');

  return {
    namespace: sanitizeNamespace(namespace),
    organizationId: `${prefix}org`,
    teamId: `${prefix}team`,
    organizationName: `E2E Workspace Org ${label}`,
    teamName: `E2E Workspace Team ${label}`,
  };
}

function buildAthleteJourneyFixtureIds(namespace: string) {
  const workspace = buildAdminWorkspaceFixtureIds(`${namespace}-journey`);
  const prefix = buildPrefix(namespace);

  return {
    namespace: sanitizeNamespace(namespace),
    referralCode: sanitizeNamespace(namespace).replace(/-/g, '').slice(0, 12).toUpperCase() || 'PULSEE2E',
    organizationId: workspace.organizationId,
    teamId: workspace.teamId,
    coachAthleteLinkId: `${prefix}coach-athlete-link`,
  };
}

async function listPrefixedDocIds(db: Firestore, collectionName: string, prefix: string) {
  const snap = await getDocs(
    query(
      collection(db, collectionName),
      orderBy(documentId()),
      startAt(prefix),
      endAt(`${prefix}\uf8ff`)
    )
  );

  return snap.docs.map((entry) => entry.id);
}

async function deleteVariantHistory(db: Firestore, variantId: string) {
  const historySnap = await getDocs(collection(db, SIM_VARIANTS_COLLECTION, variantId, E2E_HISTORY_COLLECTION));
  await Promise.all(historySnap.docs.map((entry) => deleteDoc(entry.ref)));
}

async function cleanupRegistryFixtures(db: Firestore, namespace: string) {
  const prefix = buildPrefix(namespace);

  const [moduleIds, variantIds] = await Promise.all([
    listPrefixedDocIds(db, SIM_MODULES_COLLECTION, prefix),
    listPrefixedDocIds(db, SIM_VARIANTS_COLLECTION, prefix),
  ]);

  await Promise.all(moduleIds.map((id) => deleteDoc(doc(db, SIM_MODULES_COLLECTION, id))));

  for (const variantId of variantIds) {
    await deleteVariantHistory(db, variantId);
    await deleteDoc(doc(db, SIM_VARIANTS_COLLECTION, variantId));
  }

  return {
    namespace: sanitizeNamespace(namespace),
    deletedModules: moduleIds.length,
    deletedVariants: variantIds.length,
  };
}

async function findVariantByName(db: Firestore, sourceName: string) {
  const snap = await getDocs(collection(db, SIM_VARIANTS_COLLECTION));
  const match = snap.docs.find((entry) => entry.data()?.name === sourceName);
  if (!match) {
    throw new Error(`Unable to find sim-variant named "${sourceName}" for E2E fixture cloning.`);
  }
  return match;
}

async function cloneVariantFixtureByName(db: Firestore, sourceName: string, namespace: string) {
  const sourceDoc = await findVariantByName(db, sourceName);
  const sourceData = sourceDoc.data() || {};
  const fixtureId = buildNamespacedId(namespace, sourceDoc.id);
  const fixtureModuleId = buildNamespacedId(namespace, sourceData?.moduleDraft?.moduleId || sourceDoc.id);
  const fixtureName = buildFixtureName(sourceData?.name || sourceName);
  const now = Date.now();

  const fixtureData = {
    ...sourceData,
    name: fixtureName,
    moduleDraft: {
      ...(sourceData.moduleDraft || {}),
      moduleId: fixtureModuleId,
      name: fixtureName,
    },
    publishedModuleId: null,
    publishedAt: null,
    publishedSnapshot: null,
    buildArtifact: null,
    buildMeta: null,
    buildStatus: 'not_built',
    syncStatus: 'in_sync',
    sourceFingerprint: null,
    lastBuiltFingerprint: null,
    lastPublishedFingerprint: null,
    createdAt: now,
    updatedAt: now,
  };

  await setDoc(doc(db, SIM_VARIANTS_COLLECTION, fixtureId), fixtureData);

  return {
    namespace: sanitizeNamespace(namespace),
    sourceVariantId: sourceDoc.id,
    variantId: fixtureId,
    variantName: fixtureName,
    moduleId: fixtureModuleId,
  };
}

async function seedLegacyCoachRosterFixture(
  db: Firestore,
  namespace: string,
  mode: 'new-container' | 'existing-team'
) {
  const fixture = buildLegacyRosterFixtureIds(namespace);
  const now = Date.now();

  await setDoc(
    doc(db, USERS_COLLECTION, fixture.coachId),
    {
      email: fixture.coachEmail,
      displayName: fixture.coachDisplayName,
      username: fixture.coachDisplayName.toLowerCase().replace(/[^a-z0-9]+/g, ''),
      activeCoachAccount: true,
      createdAt: now,
      updatedAt: now,
    },
    { merge: true }
  );

  await setDoc(
    doc(db, COACHES_COLLECTION, fixture.coachId),
    {
      userId: fixture.coachId,
      email: fixture.coachEmail,
      username: fixture.coachDisplayName,
      referralCode: fixture.coachReferralCode,
      subscriptionStatus: 'partner',
      userType: 'partner',
      createdAt: now,
      updatedAt: now,
    },
    { merge: true }
  );

  await Promise.all([
    setDoc(
      doc(db, USERS_COLLECTION, fixture.athleteOneId),
      {
        email: fixture.athleteOneEmail,
        displayName: fixture.athleteOneName,
        username: fixture.athleteOneName.toLowerCase().replace(/[^a-z0-9]+/g, ''),
        createdAt: now,
        updatedAt: now,
      },
      { merge: true }
    ),
    setDoc(
      doc(db, USERS_COLLECTION, fixture.athleteTwoId),
      {
        email: fixture.athleteTwoEmail,
        displayName: fixture.athleteTwoName,
        username: fixture.athleteTwoName.toLowerCase().replace(/[^a-z0-9]+/g, ''),
        createdAt: now,
        updatedAt: now,
      },
      { merge: true }
    ),
  ]);

  await Promise.all([
    setDoc(
      doc(db, COACH_ATHLETES_COLLECTION, fixture.connectionOneId),
      {
        coachId: fixture.coachId,
        athleteUserId: fixture.athleteOneId,
        status: 'active',
        linkedAt: now,
        updatedAt: now,
      },
      { merge: true }
    ),
    setDoc(
      doc(db, COACH_ATHLETES_COLLECTION, fixture.connectionTwoId),
      {
        coachId: fixture.coachId,
        athleteUserId: fixture.athleteTwoId,
        status: 'active',
        linkedAt: now,
        updatedAt: now,
      },
      { merge: true }
    ),
  ]);

  if (mode === 'existing-team') {
    await Promise.all([
      setDoc(
        doc(db, PULSECHECK_ORGANIZATIONS_COLLECTION, fixture.existingOrganizationId),
        {
          displayName: fixture.existingOrganizationName,
          legalName: fixture.existingOrganizationName,
          organizationType: 'other',
          status: 'active',
          defaultStudyPosture: 'operational',
          defaultClinicianBridgeMode: 'none',
          createdAt: now,
          updatedAt: now,
        },
        { merge: true }
      ),
      setDoc(
        doc(db, PULSECHECK_TEAMS_COLLECTION, fixture.existingTeamId),
        {
          organizationId: fixture.existingOrganizationId,
          displayName: fixture.existingTeamName,
          teamType: 'other',
          sportOrProgram: 'Existing legacy migration team',
          status: 'active',
          defaultInvitePolicy: 'admin-staff-and-coaches',
          createdAt: now,
          updatedAt: now,
        },
        { merge: true }
      ),
      setDoc(
        doc(db, PULSECHECK_ORGANIZATION_MEMBERSHIPS_COLLECTION, `${fixture.existingOrganizationId}_${fixture.coachId}`),
        {
          organizationId: fixture.existingOrganizationId,
          userId: fixture.coachId,
          email: fixture.coachEmail,
          role: 'implementation-observer',
          status: 'active',
          createdAt: now,
          updatedAt: now,
        },
        { merge: true }
      ),
      setDoc(
        doc(db, PULSECHECK_TEAM_MEMBERSHIPS_COLLECTION, `${fixture.existingTeamId}_${fixture.coachId}`),
        {
          organizationId: fixture.existingOrganizationId,
          teamId: fixture.existingTeamId,
          userId: fixture.coachId,
          email: fixture.coachEmail,
          role: 'coach',
          title: 'Coach',
          permissionSetId: 'pulsecheck-coach-v1',
          rosterVisibilityScope: 'team',
          allowedAthleteIds: [],
          onboardingStatus: 'complete',
          createdAt: now,
          updatedAt: now,
        },
        { merge: true }
      ),
      setDoc(
        doc(db, PULSECHECK_TEAM_MEMBERSHIPS_COLLECTION, `${fixture.existingTeamId}_${fixture.athleteOneId}`),
        {
          organizationId: fixture.existingOrganizationId,
          teamId: fixture.existingTeamId,
          userId: fixture.athleteOneId,
          email: fixture.athleteOneEmail,
          role: 'athlete',
          permissionSetId: 'pulsecheck-athlete-v1',
          rosterVisibilityScope: 'none',
          allowedAthleteIds: [],
          onboardingStatus: 'pending-consent',
          athleteOnboarding: {
            productConsentAccepted: false,
            productConsentAcceptedAt: null,
            productConsentVersion: '',
            researchConsentStatus: 'not-required',
            eligibleForResearchDataset: false,
            enrollmentMode: 'product-only',
            targetPilotId: '',
            targetPilotName: '',
            targetCohortId: '',
            targetCohortName: '',
            baselinePathStatus: 'pending',
            baselinePathwayId: '',
          },
          createdAt: now,
          updatedAt: now,
        },
        { merge: true }
      ),
    ]);
  }

  return {
    ...fixture,
    mode,
  };
}

async function seedPulseCheckAdminWorkspaceFixture(
  db: Firestore,
  namespace: string,
  adminUserId: string,
  adminEmail: string
) {
  const fixture = buildAdminWorkspaceFixtureIds(namespace);
  const now = Date.now();
  const normalizedEmail = (adminEmail || '').trim().toLowerCase();
  const displayName = normalizedEmail.split('@')[0] || 'e2e-admin';

  if (!adminUserId || !normalizedEmail) {
    throw new Error('An admin user id and email are required to seed a PulseCheck workspace fixture.');
  }

  await Promise.all([
    setDoc(
      doc(db, USERS_COLLECTION, adminUserId),
      {
        email: normalizedEmail,
        displayName,
        username: displayName.replace(/[^a-z0-9]+/g, ''),
        updatedAt: now,
      },
      { merge: true }
    ),
    setDoc(
      doc(db, PULSECHECK_ORGANIZATIONS_COLLECTION, fixture.organizationId),
      {
        displayName: fixture.organizationName,
        legalName: fixture.organizationName,
        organizationType: 'other',
        status: 'active',
        implementationOwnerUserId: adminUserId,
        implementationOwnerEmail: normalizedEmail,
        primaryCustomerAdminName: displayName,
        primaryCustomerAdminEmail: normalizedEmail,
        defaultStudyPosture: 'operational',
        defaultClinicianBridgeMode: 'none',
        createdAt: now,
        updatedAt: now,
      },
      { merge: true }
    ),
    setDoc(
      doc(db, PULSECHECK_TEAMS_COLLECTION, fixture.teamId),
      {
        organizationId: fixture.organizationId,
        displayName: fixture.teamName,
        teamType: 'other',
        sportOrProgram: 'E2E PulseCheck Workspace',
        defaultAdminName: displayName,
        defaultAdminEmail: normalizedEmail,
        status: 'active',
        defaultInvitePolicy: 'admin-staff-and-coaches',
        createdAt: now,
        updatedAt: now,
      },
      { merge: true }
    ),
    setDoc(
      doc(db, PULSECHECK_ORGANIZATION_MEMBERSHIPS_COLLECTION, `${fixture.organizationId}_${adminUserId}`),
      {
        organizationId: fixture.organizationId,
        userId: adminUserId,
        email: normalizedEmail,
        role: 'org-admin',
        status: 'active',
        grantedAt: now,
        createdAt: now,
        updatedAt: now,
      },
      { merge: true }
    ),
    setDoc(
      doc(db, PULSECHECK_TEAM_MEMBERSHIPS_COLLECTION, `${fixture.teamId}_${adminUserId}`),
      {
        organizationId: fixture.organizationId,
        teamId: fixture.teamId,
        userId: adminUserId,
        email: normalizedEmail,
        role: 'team-admin',
        title: 'Team Admin',
        permissionSetId: 'pulsecheck-team-admin-v1',
        rosterVisibilityScope: 'team',
        allowedAthleteIds: [],
        onboardingStatus: 'complete',
        postActivationCompletedAt: now,
        grantedAt: now,
        createdAt: now,
        updatedAt: now,
      },
      { merge: true }
    ),
  ]);

  return {
    ...fixture,
    adminUserId,
    adminEmail: normalizedEmail,
  };
}

async function cleanupLegacyCoachRosterFixtures(db: Firestore, namespace: string) {
  const fixture = buildLegacyRosterFixtureIds(namespace);
  const teamMembershipsToDelete = new Set<string>();
  const organizationMembershipsToDelete = new Set<string>();
  const teamIdsToDelete = new Set<string>([fixture.existingTeamId]);
  const organizationIdsToDelete = new Set<string>([fixture.existingOrganizationId]);

  const [legacyTeamsSnap, legacyOrganizationsSnap, legacyMembershipsSnap, migrationSnap] = await Promise.all([
    getDocs(query(collection(db, PULSECHECK_TEAMS_COLLECTION), where('legacyCoachId', '==', fixture.coachId))),
    getDocs(query(collection(db, PULSECHECK_ORGANIZATIONS_COLLECTION), where('legacyCoachId', '==', fixture.coachId))),
    getDocs(query(collection(db, PULSECHECK_TEAM_MEMBERSHIPS_COLLECTION), where('legacyCoachId', '==', fixture.coachId))),
    getDocs(query(collection(db, PULSECHECK_LEGACY_MIGRATIONS_COLLECTION), where('coachId', '==', fixture.coachId))),
  ]);

  legacyTeamsSnap.docs.forEach((entry) => teamIdsToDelete.add(entry.id));
  legacyOrganizationsSnap.docs.forEach((entry) => organizationIdsToDelete.add(entry.id));
  legacyMembershipsSnap.docs.forEach((entry) => teamMembershipsToDelete.add(entry.id));

  for (const teamId of teamIdsToDelete) {
    if (!teamId) continue;
    teamMembershipsToDelete.add(`${teamId}_${fixture.coachId}`);
    teamMembershipsToDelete.add(`${teamId}_${fixture.athleteOneId}`);
    teamMembershipsToDelete.add(`${teamId}_${fixture.athleteTwoId}`);
  }

  for (const organizationId of organizationIdsToDelete) {
    if (!organizationId) continue;
    organizationMembershipsToDelete.add(`${organizationId}_${fixture.coachId}`);
  }

  await Promise.all([
    ...Array.from(teamMembershipsToDelete).map(async (id) => {
      const ref = doc(db, PULSECHECK_TEAM_MEMBERSHIPS_COLLECTION, id);
      const snap = await getDoc(ref);
      if (snap.exists()) await deleteDoc(ref);
    }),
    ...Array.from(organizationMembershipsToDelete).map(async (id) => {
      const ref = doc(db, PULSECHECK_ORGANIZATION_MEMBERSHIPS_COLLECTION, id);
      const snap = await getDoc(ref);
      if (snap.exists()) await deleteDoc(ref);
    }),
    ...legacyTeamsSnap.docs.map((entry) => deleteDoc(entry.ref)),
    ...legacyOrganizationsSnap.docs.map((entry) => deleteDoc(entry.ref)),
    ...migrationSnap.docs.map((entry) => deleteDoc(entry.ref)),
  ]);

  await Promise.all([
    ...Array.from(teamIdsToDelete).map(async (id) => {
      const ref = doc(db, PULSECHECK_TEAMS_COLLECTION, id);
      const snap = await getDoc(ref);
      if (snap.exists()) await deleteDoc(ref);
    }),
    ...Array.from(organizationIdsToDelete).map(async (id) => {
      const ref = doc(db, PULSECHECK_ORGANIZATIONS_COLLECTION, id);
      const snap = await getDoc(ref);
      if (snap.exists()) await deleteDoc(ref);
    }),
  ]);

  await Promise.all([
    deleteDoc(doc(db, COACH_ATHLETES_COLLECTION, fixture.connectionOneId)).catch(() => undefined),
    deleteDoc(doc(db, COACH_ATHLETES_COLLECTION, fixture.connectionTwoId)).catch(() => undefined),
    deleteDoc(doc(db, COACH_REFERRALS_COLLECTION, `${fixture.coachId}_${fixture.athleteOneId}`)).catch(() => undefined),
    deleteDoc(doc(db, COACH_REFERRALS_COLLECTION, `${fixture.coachId}_${fixture.athleteTwoId}`)).catch(() => undefined),
    deleteDoc(doc(db, COACHES_COLLECTION, fixture.coachId)).catch(() => undefined),
    deleteDoc(doc(db, USERS_COLLECTION, fixture.coachId)).catch(() => undefined),
    deleteDoc(doc(db, USERS_COLLECTION, fixture.athleteOneId)).catch(() => undefined),
    deleteDoc(doc(db, USERS_COLLECTION, fixture.athleteTwoId)).catch(() => undefined),
  ]);

  return {
    namespace: fixture.namespace,
    coachId: fixture.coachId,
    deletedTeams: Array.from(teamIdsToDelete).filter(Boolean).length,
    deletedOrganizations: Array.from(organizationIdsToDelete).filter(Boolean).length,
    deletedTeamMemberships: Array.from(teamMembershipsToDelete).filter(Boolean).length,
  };
}

async function inspectLegacyCoachRosterFixture(db: Firestore, namespace: string) {
  const fixture = buildLegacyRosterFixtureIds(namespace);
  const [legacyTeamsSnap, legacyOrganizationsSnap, legacyMembershipsSnap, migrationSnap] = await Promise.all([
    getDocs(query(collection(db, PULSECHECK_TEAMS_COLLECTION), where('legacyCoachId', '==', fixture.coachId))),
    getDocs(query(collection(db, PULSECHECK_ORGANIZATIONS_COLLECTION), where('legacyCoachId', '==', fixture.coachId))),
    getDocs(query(collection(db, PULSECHECK_TEAM_MEMBERSHIPS_COLLECTION), where('legacyCoachId', '==', fixture.coachId))),
    getDocs(query(collection(db, PULSECHECK_LEGACY_MIGRATIONS_COLLECTION), where('coachId', '==', fixture.coachId))),
  ]);

  const explicitDocs = await Promise.all([
    getDoc(doc(db, PULSECHECK_ORGANIZATIONS_COLLECTION, fixture.existingOrganizationId)),
    getDoc(doc(db, PULSECHECK_TEAMS_COLLECTION, fixture.existingTeamId)),
    getDoc(doc(db, PULSECHECK_TEAM_MEMBERSHIPS_COLLECTION, `${fixture.existingTeamId}_${fixture.coachId}`)),
    getDoc(doc(db, PULSECHECK_TEAM_MEMBERSHIPS_COLLECTION, `${fixture.existingTeamId}_${fixture.athleteOneId}`)),
    getDoc(doc(db, PULSECHECK_TEAM_MEMBERSHIPS_COLLECTION, `${fixture.existingTeamId}_${fixture.athleteTwoId}`)),
  ]);

  return {
    fixture,
    legacyOrganizations: legacyOrganizationsSnap.docs.map((entry) => ({ id: entry.id, ...entry.data() })),
    legacyTeams: legacyTeamsSnap.docs.map((entry) => ({ id: entry.id, ...entry.data() })),
    legacyAthleteMemberships: legacyMembershipsSnap.docs.map((entry) => ({ id: entry.id, ...entry.data() })),
    migrationEntries: migrationSnap.docs.map((entry) => ({ id: entry.id, ...entry.data() })),
    explicitExistingOrganization: explicitDocs[0].exists() ? { id: explicitDocs[0].id, ...explicitDocs[0].data() } : null,
    explicitExistingTeam: explicitDocs[1].exists() ? { id: explicitDocs[1].id, ...explicitDocs[1].data() } : null,
    explicitCoachMembership: explicitDocs[2].exists() ? { id: explicitDocs[2].id, ...explicitDocs[2].data() } : null,
    explicitAthleteOneMembership: explicitDocs[3].exists() ? { id: explicitDocs[3].id, ...explicitDocs[3].data() } : null,
    explicitAthleteTwoMembership: explicitDocs[4].exists() ? { id: explicitDocs[4].id, ...explicitDocs[4].data() } : null,
  };
}

async function deleteNestedDocsByParent(
  db: Firestore,
  parentCollection: string,
  parentId: string,
  nestedCollection: string
) {
  const nestedSnap = await getDocs(collection(db, parentCollection, parentId, nestedCollection));
  await Promise.all(nestedSnap.docs.map((entry) => deleteDoc(entry.ref).catch(() => undefined)));
}

async function deleteQueryDocs(
  db: Firestore,
  collectionName: string,
  fieldName: string,
  value: string
) {
  const snap = await getDocs(query(collection(db, collectionName), where(fieldName, '==', value)));
  await Promise.all(snap.docs.map((entry) => deleteDoc(entry.ref).catch(() => undefined)));
}

async function seedPulseCheckAthleteJourneyFixture(
  db: Firestore,
  input: {
    namespace: string;
    adminUserId: string;
    adminEmail: string;
    coachUserId: string;
    coachEmail: string;
    athleteUserId: string;
    athleteEmail: string;
  }
) {
  const fixture = buildAthleteJourneyFixtureIds(input.namespace);
  const now = Date.now();

  if (!input.adminUserId || !input.adminEmail || !input.coachUserId || !input.coachEmail || !input.athleteUserId || !input.athleteEmail) {
    throw new Error('Admin, coach, and athlete ids/emails are required to seed the PulseCheck athlete journey fixture.');
  }

  await seedPulseCheckAdminWorkspaceFixture(db, `${input.namespace}-journey`, input.adminUserId, input.adminEmail);
  await simModuleLibraryService.seedExercises().catch(() => undefined);

  const normalizedCoachEmail = input.coachEmail.trim().toLowerCase();
  const normalizedAthleteEmail = input.athleteEmail.trim().toLowerCase();
  const [existingCoachUserSnap, existingAthleteUserSnap] = await Promise.all([
    getDoc(doc(db, USERS_COLLECTION, input.coachUserId)),
    getDoc(doc(db, USERS_COLLECTION, input.athleteUserId)),
  ]);
  const coachDisplayName =
    (existingCoachUserSnap.exists() ? existingCoachUserSnap.data()?.displayName || existingCoachUserSnap.data()?.username : null) ||
    normalizedCoachEmail.split('@')[0] ||
    'pulse-coach';
  const athleteDisplayName =
    (existingAthleteUserSnap.exists() ? existingAthleteUserSnap.data()?.displayName || existingAthleteUserSnap.data()?.username : null) ||
    normalizedAthleteEmail.split('@')[0] ||
    'pulse-athlete';

  await Promise.all([
    setDoc(
      doc(db, USERS_COLLECTION, input.coachUserId),
      {
        email: normalizedCoachEmail,
        displayName: coachDisplayName,
        username: coachDisplayName.replace(/[^a-z0-9]+/g, ''),
        activeCoachAccount: true,
        role: 'coach',
        updatedAt: now,
      },
      { merge: true }
    ),
    setDoc(
      doc(db, USERS_COLLECTION, input.athleteUserId),
      {
        email: normalizedAthleteEmail,
        displayName: athleteDisplayName,
        username: athleteDisplayName.replace(/[^a-z0-9]+/g, ''),
        role: 'athlete',
        linkedCoachId: input.coachUserId,
        updatedAt: now,
      },
      { merge: true }
    ),
    setDoc(
      doc(db, COACHES_COLLECTION, input.coachUserId),
      {
        userId: input.coachUserId,
        email: normalizedCoachEmail,
        username: coachDisplayName,
        referralCode: fixture.referralCode,
        subscriptionStatus: 'partner',
        userType: 'partner',
        earningsAccess: true,
        createdAt: now,
        updatedAt: now,
      },
      { merge: true }
    ),
    setDoc(
      doc(db, REFERRAL_CODE_LOOKUP_COLLECTION, fixture.referralCode),
      {
        referralCode: fixture.referralCode,
        coachId: input.coachUserId,
        createdAt: now,
        updatedAt: now,
      },
      { merge: true }
    ),
    setDoc(
      doc(db, COACH_ATHLETES_COLLECTION, fixture.coachAthleteLinkId),
      {
        coachId: input.coachUserId,
        athleteUserId: input.athleteUserId,
        status: 'active',
        linkedAt: now,
        updatedAt: now,
      },
      { merge: true }
    ),
    setDoc(
      doc(db, COACH_REFERRALS_COLLECTION, `${input.coachUserId}_${input.athleteUserId}`),
      {
        referrerCoachId: input.coachUserId,
        referredCoachId: input.athleteUserId,
        referredCoachEmail: normalizedAthleteEmail,
        referralCode: fixture.referralCode,
        createdAt: now,
        updatedAt: now,
      },
      { merge: true }
    ),
    setDoc(
      doc(db, PULSECHECK_TEAM_MEMBERSHIPS_COLLECTION, `${fixture.teamId}_${input.coachUserId}`),
      {
        organizationId: fixture.organizationId,
        teamId: fixture.teamId,
        userId: input.coachUserId,
        email: normalizedCoachEmail,
        role: 'coach',
        title: 'Coach',
        permissionSetId: 'pulsecheck-coach-v1',
        rosterVisibilityScope: 'team',
        allowedAthleteIds: [],
        onboardingStatus: 'complete',
        grantedAt: now,
        createdAt: now,
        updatedAt: now,
      },
      { merge: true }
    ),
    setDoc(
      doc(db, PULSECHECK_TEAM_MEMBERSHIPS_COLLECTION, `${fixture.teamId}_${input.athleteUserId}`),
      {
        organizationId: fixture.organizationId,
        teamId: fixture.teamId,
        userId: input.athleteUserId,
        email: normalizedAthleteEmail,
        role: 'athlete',
        permissionSetId: 'pulsecheck-athlete-v1',
        rosterVisibilityScope: 'none',
        allowedAthleteIds: [],
        onboardingStatus: 'complete',
        legacyCoachId: input.coachUserId,
        athleteOnboarding: {
          productConsentAccepted: true,
          productConsentAcceptedAt: now,
          productConsentVersion: 'e2e-v1',
          researchConsentStatus: 'not-required',
          eligibleForResearchDataset: false,
          enrollmentMode: 'product-only',
          targetPilotId: '',
          targetPilotName: '',
          targetCohortId: '',
          targetCohortName: '',
          baselinePathStatus: 'complete',
          baselinePathwayId: 'pulsecheck-core-baseline-v1',
        },
        createdAt: now,
        updatedAt: now,
      },
      { merge: true }
    ),
  ]);

  await athleteProgressService.initialize(input.athleteUserId, input.coachUserId);
  const progress = await athleteProgressService.saveBaselineAssessment(input.athleteUserId, {
    mentalTrainingExperience: 'self_tried',
    currentPracticeFrequency: 'weekly',
    arousalControlRating: 2,
    focusRating: 3,
    confidenceRating: 3,
    visualizationRating: 2,
    resilienceRating: 3,
    pressureResponse: 'anxious_push_through',
    setbackRecovery: 'struggle_same_day',
    biggestChallenge: BiggestChallenge.PreCompetitionAnxiety,
  });

  await setDoc(
    doc(db, ATHLETE_MENTAL_PROGRESS_COLLECTION, input.athleteUserId),
    {
      coachId: input.coachUserId,
      assessmentNeeded: false,
      updatedAt: Date.now(),
    },
    { merge: true }
  );

  return {
    ...fixture,
    athleteUserId: input.athleteUserId,
    athleteEmail: normalizedAthleteEmail,
    coachUserId: input.coachUserId,
    coachEmail: normalizedCoachEmail,
    activeProgram: progress.activeProgram,
  };
}

async function cleanupPulseCheckAthleteJourneyFixture(
  db: Firestore,
  input: {
    namespace: string;
    athleteUserId: string;
    coachUserId: string;
  }
) {
  const fixture = buildAthleteJourneyFixtureIds(input.namespace);

  await Promise.all([
    deleteNestedDocsByParent(db, SIM_CHECKINS_ROOT, input.athleteUserId, 'check-ins'),
    deleteNestedDocsByParent(db, SIM_COMPLETIONS_ROOT, input.athleteUserId, 'completions'),
    deleteQueryDocs(db, PULSECHECK_DAILY_ASSIGNMENTS_COLLECTION, 'athleteId', input.athleteUserId),
    deleteQueryDocs(db, COACH_NOTIFICATIONS_COLLECTION, 'coachId', input.coachUserId),
  ]);

  await Promise.all([
    deleteDoc(doc(db, ATHLETE_MENTAL_PROGRESS_COLLECTION, input.athleteUserId)).catch(() => undefined),
    deleteDoc(doc(db, COACH_ATHLETES_COLLECTION, fixture.coachAthleteLinkId)).catch(() => undefined),
    deleteDoc(doc(db, COACH_REFERRALS_COLLECTION, `${input.coachUserId}_${input.athleteUserId}`)).catch(() => undefined),
    deleteDoc(doc(db, REFERRAL_CODE_LOOKUP_COLLECTION, fixture.referralCode)).catch(() => undefined),
    deleteDoc(doc(db, PULSECHECK_TEAM_MEMBERSHIPS_COLLECTION, `${fixture.teamId}_${input.coachUserId}`)).catch(() => undefined),
    deleteDoc(doc(db, PULSECHECK_TEAM_MEMBERSHIPS_COLLECTION, `${fixture.teamId}_${input.athleteUserId}`)).catch(() => undefined),
    deleteDoc(doc(db, PULSECHECK_ORGANIZATION_MEMBERSHIPS_COLLECTION, `${fixture.organizationId}_${input.coachUserId}`)).catch(() => undefined),
    deleteDoc(doc(db, PULSECHECK_ORGANIZATION_MEMBERSHIPS_COLLECTION, `${fixture.organizationId}_${input.athleteUserId}`)).catch(() => undefined),
    deleteDoc(doc(db, PULSECHECK_TEAMS_COLLECTION, fixture.teamId)).catch(() => undefined),
    deleteDoc(doc(db, PULSECHECK_ORGANIZATIONS_COLLECTION, fixture.organizationId)).catch(() => undefined),
  ]);

  return {
    namespace: fixture.namespace,
    athleteUserId: input.athleteUserId,
    coachUserId: input.coachUserId,
  };
}

async function inspectPulseCheckAthleteJourneyState(
  db: Firestore,
  input: {
    athleteUserId: string;
    coachUserId: string;
  }
) {
  const [progressSnap, latestAssignment, latestCompletion, latestCheckIns, coachNotificationsSnap] = await Promise.all([
    getDoc(doc(db, ATHLETE_MENTAL_PROGRESS_COLLECTION, input.athleteUserId)),
    assignmentOrchestratorService.getLatestForAthlete(input.athleteUserId),
    completionService.getLatestCompletion(input.athleteUserId),
    completionService.getCheckIns(input.athleteUserId, 3),
    getDocs(query(collection(db, COACH_NOTIFICATIONS_COLLECTION), where('coachId', '==', input.coachUserId))),
  ]);

  const coachNotifications = coachNotificationsSnap.docs
    .map((entry) => ({ id: entry.id, ...(entry.data() as Record<string, any>) }) as Record<string, any> & { id: string })
    .sort((left, right) => (Number(right.createdAt) || 0) - (Number(left.createdAt) || 0));

  return {
    athleteProgress: progressSnap.exists() ? { id: progressSnap.id, ...progressSnap.data() } : null,
    latestAssignment,
    latestCompletion,
    recentCheckIns: latestCheckIns,
    coachNotifications,
  };
}

async function recordPulseCheckJourneyCompletion(
  input: {
    athleteUserId: string;
    dailyAssignmentId: string;
    exerciseId?: string;
    exerciseName?: string;
    durationSeconds?: number;
    helpfulnessRating?: number;
  }
) {
  const resolved = await assignmentOrchestratorService.resolveExercise(input.dailyAssignmentId);
  const assignment = resolved?.assignment || await assignmentOrchestratorService.getById(input.dailyAssignmentId);
  const exercise = resolved?.exercise;
  const fallbackExerciseId =
    input.exerciseId ||
    exercise?.id ||
    assignment?.legacyExerciseId ||
    assignment?.simSpecId ||
    'focus-3-second-reset';
  const fallbackExerciseName =
    input.exerciseName ||
    exercise?.name ||
    assignment?.legacyExerciseId ||
    assignment?.simSpecId ||
    assignment?.sessionType ||
    assignment?.actionType ||
    'Reset';

  return completionService.recordCompletion({
    userId: input.athleteUserId,
    exerciseId: fallbackExerciseId,
    exerciseName: fallbackExerciseName,
    exerciseCategory: exercise?.category || ExerciseCategory.Focus,
    dailyAssignmentId: input.dailyAssignmentId,
    durationSeconds: input.durationSeconds || Math.max(60, assignment?.durationSeconds || 180),
    helpfulnessRating: input.helpfulnessRating || 4,
  });
}

async function upsertCoachNotificationDocs(
  db: Firestore,
  input: {
    coachUserId: string;
    athleteUserId: string;
  }
) {
  const state = await inspectPulseCheckAthleteJourneyState(db, input);
  const athleteDoc = await getDoc(doc(db, USERS_COLLECTION, input.athleteUserId));
  const athleteName =
    (athleteDoc.exists() ? athleteDoc.data()?.displayName || athleteDoc.data()?.username : null) || 'Athlete';
  const now = Date.now();

  if (state.latestAssignment) {
    const assignment = state.latestAssignment;
    const assignmentLabel = assignment.simSpecId || assignment.legacyExerciseId || assignment.sessionType || assignment.actionType;
    await setDoc(
      doc(db, COACH_NOTIFICATIONS_COLLECTION, `pulsecheck_nora_auto_assignment_${assignment.id}`),
      {
        coachId: input.coachUserId,
        athleteId: input.athleteUserId,
        type: 'pulsecheck_nora_auto_assignment',
        category: 'athlete',
        title: assignment.actionType === 'defer' ? 'Pulse Check paused today\'s task' : 'Nora assigned today\'s task',
        message: `${athleteName}: Nora ${assignmentLabel}. Review or override in Mental Training.`,
        actionRequired: assignment.actionType !== 'defer',
        read: false,
        archived: false,
        sourceId: assignment.id,
        target: 'coach_mental_training',
        webUrl: '/coach/mentalGames?tab=assignments',
        metadata: {
          sourceDate: assignment.sourceDate || new Date().toISOString().split('T')[0],
          actionType: assignment.actionType || 'sim',
        },
        createdAt: now,
        updatedAt: now,
      },
      { merge: true }
    );
  }

  if (state.latestCompletion?.sessionSummary) {
    const summary = state.latestCompletion.sessionSummary;
    await setDoc(
      doc(db, COACH_NOTIFICATIONS_COLLECTION, `pulsecheck_session_update_${state.latestCompletion.id}`),
      {
        coachId: input.coachUserId,
        athleteId: input.athleteUserId,
        type: 'pulsecheck_session_update',
        category: 'athlete',
        title: summary.programChanged ? 'Pulse Check updated the next rep' : 'Pulse Check logged a completed rep',
        message: `${athleteName}: ${summary.coachBody || 'A new session update is ready in Mental Training.'}`,
        actionRequired: Boolean(summary.programChanged),
        read: false,
        archived: false,
        sourceId: state.latestCompletion.id,
        target: 'coach_mental_training',
        webUrl: '/coach/mentalGames',
        metadata: {
          dailyAssignmentId: state.latestCompletion.dailyAssignmentId || '',
          completedActionLabel: summary.completedActionLabel || '',
          nextActionLabel: summary.nextActionLabel || '',
          programChanged: Boolean(summary.programChanged),
        },
        createdAt: now,
        updatedAt: now,
      },
      { merge: true }
    );
  }

  return inspectPulseCheckAthleteJourneyState(db, input);
}

export interface PulseE2EHarness {
  ensureAdminRecord: (email: string) => Promise<{
    email: string;
    existed: boolean;
  }>;
  cleanupRegistryFixtures: (namespace: string) => Promise<{
    namespace: string;
    deletedModules: number;
    deletedVariants: number;
  }>;
  cloneVariantFixtureByName: (
    sourceName: string,
    namespace: string
  ) => Promise<{
    namespace: string;
    sourceVariantId: string;
    variantId: string;
    variantName: string;
    moduleId: string;
  }>;
  seedLegacyCoachRosterFixture: (
    namespace: string,
    mode: 'new-container' | 'existing-team'
  ) => Promise<{
    namespace: string;
    coachId: string;
    athleteOneId: string;
    athleteTwoId: string;
    coachEmail: string;
    athleteOneEmail: string;
    athleteTwoEmail: string;
    coachDisplayName: string;
    athleteOneName: string;
    athleteTwoName: string;
    coachReferralCode: string;
    existingOrganizationId: string;
    existingTeamId: string;
    existingOrganizationName: string;
    existingTeamName: string;
    connectionOneId: string;
    connectionTwoId: string;
    mode: 'new-container' | 'existing-team';
  }>;
  seedPulseCheckAdminWorkspaceFixture: (
    namespace: string,
    adminUserId: string,
    adminEmail: string
  ) => Promise<{
    namespace: string;
    organizationId: string;
    teamId: string;
    organizationName: string;
    teamName: string;
    adminUserId: string;
    adminEmail: string;
  }>;
  cleanupLegacyCoachRosterFixtures: (namespace: string) => Promise<{
    namespace: string;
    coachId: string;
    deletedTeams: number;
    deletedOrganizations: number;
    deletedTeamMemberships: number;
  }>;
  seedPulseCheckAthleteJourneyFixture: (input: {
    namespace: string;
    adminUserId: string;
    adminEmail: string;
    coachUserId: string;
    coachEmail: string;
    athleteUserId: string;
    athleteEmail: string;
  }) => Promise<{
    namespace: string;
    referralCode: string;
    organizationId: string;
    teamId: string;
    coachAthleteLinkId: string;
    athleteUserId: string;
    athleteEmail: string;
    coachUserId: string;
    coachEmail: string;
    activeProgram?: Record<string, any>;
  }>;
  cleanupPulseCheckAthleteJourneyFixture: (input: {
    namespace: string;
    athleteUserId: string;
    coachUserId: string;
  }) => Promise<{
    namespace: string;
    athleteUserId: string;
    coachUserId: string;
  }>;
  inspectPulseCheckAthleteJourneyState: (input: {
    athleteUserId: string;
    coachUserId: string;
  }) => Promise<Record<string, any>>;
  recordPulseCheckJourneyCompletion: (input: {
    athleteUserId: string;
    dailyAssignmentId: string;
    exerciseId?: string;
    exerciseName?: string;
    durationSeconds?: number;
    helpfulnessRating?: number;
  }) => Promise<Record<string, any>>;
  upsertPulseCheckCoachNotifications: (input: {
    coachUserId: string;
    athleteUserId: string;
  }) => Promise<Record<string, any>>;
  inspectLegacyCoachRosterFixture: (namespace: string) => Promise<Record<string, any>>;
  inspectVariant: (variantId: string) => Promise<Record<string, any> | null>;
}

declare global {
  interface Window {
    __pulseE2E?: PulseE2EHarness;
  }
}

export function installPulseE2EHarness(db: Firestore) {
  if (typeof window === 'undefined') return;
  if (window.__pulseE2E) return;

  window.__pulseE2E = {
    ensureAdminRecord: async (email: string) => {
      const normalizedEmail = (email || '').trim().toLowerCase();
      if (!normalizedEmail) {
        throw new Error('An email is required to create or verify a dev admin record.');
      }

      const adminRef = doc(db, 'admin', normalizedEmail);
      const existing = await getDoc(adminRef);

      if (!existing.exists()) {
        await setDoc(adminRef, {
          email: normalizedEmail,
          createdAt: Date.now(),
          addedBy: 'admin-function',
          permissions: ['all'],
          source: 'playwright-e2e-harness',
        });
      } else {
        const existingData = existing.data() || {};
        await setDoc(adminRef, {
          ...existingData,
          email: normalizedEmail,
          addedBy: existingData.addedBy || 'admin-function',
          permissions: Array.isArray(existingData.permissions) && existingData.permissions.length > 0
            ? existingData.permissions
            : ['all'],
          source: existingData.source || 'playwright-e2e-harness',
        }, { merge: true });
      }

      return {
        email: normalizedEmail,
        existed: existing.exists(),
      };
    },
    cleanupRegistryFixtures: (namespace: string) => cleanupRegistryFixtures(db, namespace),
    cloneVariantFixtureByName: (sourceName: string, namespace: string) =>
      cloneVariantFixtureByName(db, sourceName, namespace),
    seedLegacyCoachRosterFixture: (namespace: string, mode: 'new-container' | 'existing-team') =>
      seedLegacyCoachRosterFixture(db, namespace, mode),
    seedPulseCheckAdminWorkspaceFixture: (namespace: string, adminUserId: string, adminEmail: string) =>
      seedPulseCheckAdminWorkspaceFixture(db, namespace, adminUserId, adminEmail),
    cleanupLegacyCoachRosterFixtures: (namespace: string) => cleanupLegacyCoachRosterFixtures(db, namespace),
    seedPulseCheckAthleteJourneyFixture: (input) => seedPulseCheckAthleteJourneyFixture(db, input),
    cleanupPulseCheckAthleteJourneyFixture: (input) => cleanupPulseCheckAthleteJourneyFixture(db, input),
    inspectPulseCheckAthleteJourneyState: (input) => inspectPulseCheckAthleteJourneyState(db, input),
    recordPulseCheckJourneyCompletion: (input) => recordPulseCheckJourneyCompletion(input),
    upsertPulseCheckCoachNotifications: (input) => upsertCoachNotificationDocs(db, input),
    inspectLegacyCoachRosterFixture: (namespace: string) => inspectLegacyCoachRosterFixture(db, namespace),
    inspectVariant: async (variantId: string) => {
      const snap = await getDoc(doc(db, SIM_VARIANTS_COLLECTION, variantId));
      return snap.exists() ? { id: snap.id, ...snap.data() } : null;
    },
  };
}
