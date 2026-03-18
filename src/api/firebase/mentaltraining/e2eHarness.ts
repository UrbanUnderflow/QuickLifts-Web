import {
  collection,
  deleteDoc,
  doc,
  documentId,
  endAt,
  getDoc,
  getDocs,
  getDocsFromServer,
  orderBy,
  query,
  setDoc,
  startAt,
  updateDoc,
  where,
} from 'firebase/firestore';

import type { Firestore } from 'firebase/firestore';

import {
  ATHLETE_MENTAL_PROGRESS_COLLECTION,
  PULSECHECK_ASSIGNMENT_EVENTS_COLLECTION,
  PULSECHECK_ASSIGNMENT_CANDIDATE_SETS_COLLECTION,
  PULSECHECK_DAILY_ASSIGNMENTS_COLLECTION,
  PULSECHECK_PROTOCOLS_COLLECTION,
  PULSECHECK_PROTOCOL_RESPONSIVENESS_PROFILES_COLLECTION,
  PULSECHECK_STATE_SNAPSHOTS_COLLECTION,
  SIM_CHECKINS_ROOT,
  SIM_COMPLETIONS_ROOT,
  SIM_MODULES_COLLECTION,
  SIM_VARIANTS_COLLECTION,
} from './collections';
import { athleteProgressService } from './athleteProgressService';
import { assignmentOrchestratorService } from './assignmentOrchestratorService';
import { completionService } from './completionService';
import { simModuleLibraryService } from './exerciseLibraryService';
import { protocolRegistryService } from './protocolRegistryService';
import { stateSnapshotService } from './stateSnapshotService';
import {
  BiggestChallenge,
  CheckInType,
  ExerciseCategory,
  PulseCheckDailyAssignmentStatus,
  checkInToFirestore,
  pulseCheckDailyAssignmentFromFirestore,
  pulseCheckStateSnapshotToFirestore,
  sanitizeFirestoreValue,
} from './types';

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

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function normalizeTag(value: unknown) {
  return typeof value === 'string'
    ? value.trim().toLowerCase().replace(/[\s-]+/g, '_')
    : '';
}

function intersectsTags(left: string[], right: string[]) {
  if (!left.length || !right.length) return false;
  const rightSet = new Set(right.map((value) => normalizeTag(value)).filter(Boolean));
  return left.some((value) => rightSet.has(normalizeTag(value)));
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

function resolveProtocolFixture(protocolId?: string): {
  id: string;
  label: string;
  legacyExerciseId: string;
  protocolClass: 'priming' | 'regulation' | 'recovery';
  protocolCategory: ExerciseCategory;
  protocolResponseFamily: string;
  protocolDeliveryMode: string;
  durationSeconds: number;
  responsivenessDirection?: 'positive' | 'neutral' | 'negative';
} {
  switch (protocolId) {
    case 'protocol-power-pose':
      return {
        id: 'protocol-power-pose',
        label: 'Power Posing',
        legacyExerciseId: 'confidence-power-pose',
        protocolClass: 'priming',
        protocolCategory: ExerciseCategory.Confidence,
        protocolResponseFamily: 'confidence_priming',
        protocolDeliveryMode: 'embodied_reset',
        durationSeconds: 120,
      };
    case 'protocol-cue-word-anchoring':
    default:
      return {
        id: 'protocol-cue-word-anchoring',
        label: 'Cue Word Anchoring',
        legacyExerciseId: 'focus-cue-word',
        protocolClass: 'priming',
        protocolCategory: ExerciseCategory.Focus,
        protocolResponseFamily: 'focus_narrowing',
        protocolDeliveryMode: 'guided_focus',
        durationSeconds: 300,
      };
  }
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
    deleteQueryDocs(db, PULSECHECK_ASSIGNMENT_CANDIDATE_SETS_COLLECTION, 'athleteId', input.athleteUserId),
    deleteQueryDocs(db, PULSECHECK_STATE_SNAPSHOTS_COLLECTION, 'athleteId', input.athleteUserId),
    deleteQueryDocs(db, COACH_NOTIFICATIONS_COLLECTION, 'coachId', input.coachUserId),
  ]);

  const protocolIds = await listPrefixedDocIds(db, PULSECHECK_PROTOCOLS_COLLECTION, buildPrefix(input.namespace));
  await Promise.all(protocolIds.map((id) => deleteDoc(doc(db, PULSECHECK_PROTOCOLS_COLLECTION, id)).catch(() => undefined)));

  await Promise.all([
    deleteDoc(doc(db, PULSECHECK_PROTOCOL_RESPONSIVENESS_PROFILES_COLLECTION, input.athleteUserId)).catch(() => undefined),
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

  const [stateSnapshotSnap, candidateSetSnap, responsivenessProfileSnap] = await Promise.all([
    latestAssignment?.sourceStateSnapshotId
      ? getDoc(doc(db, PULSECHECK_STATE_SNAPSHOTS_COLLECTION, latestAssignment.sourceStateSnapshotId))
      : getDoc(doc(db, PULSECHECK_STATE_SNAPSHOTS_COLLECTION, `${input.athleteUserId}_${latestAssignment?.sourceDate || ''}`)),
    latestAssignment?.sourceCandidateSetId
      ? getDoc(doc(db, PULSECHECK_ASSIGNMENT_CANDIDATE_SETS_COLLECTION, latestAssignment.sourceCandidateSetId))
      : getDoc(doc(db, PULSECHECK_ASSIGNMENT_CANDIDATE_SETS_COLLECTION, `${input.athleteUserId}_${latestAssignment?.sourceDate || ''}_candidates`)),
    getDoc(doc(db, PULSECHECK_PROTOCOL_RESPONSIVENESS_PROFILES_COLLECTION, input.athleteUserId)),
  ]);

  const coachNotifications = coachNotificationsSnap.docs
    .map((entry) => ({ id: entry.id, ...(entry.data() as Record<string, any>) }) as Record<string, any> & { id: string })
    .sort((left, right) => (Number(right.createdAt) || 0) - (Number(left.createdAt) || 0));

  return {
    athleteProgress: progressSnap.exists() ? { id: progressSnap.id, ...progressSnap.data() } : null,
    latestAssignment,
    latestStateSnapshot: stateSnapshotSnap.exists() ? { id: stateSnapshotSnap.id, ...stateSnapshotSnap.data() } : null,
    latestCandidateSet: candidateSetSnap.exists() ? { id: candidateSetSnap.id, ...candidateSetSnap.data() } : null,
    responsivenessProfile: responsivenessProfileSnap.exists() ? { id: responsivenessProfileSnap.id, ...responsivenessProfileSnap.data() } : null,
    latestCompletion,
    recentCheckIns: latestCheckIns,
    coachNotifications,
  };
}

async function listPublishedProtocolRuntimeRecords(
  db: Firestore,
  protocolClass?: 'priming' | 'regulation' | 'recovery' | 'none'
): Promise<Array<Record<string, any>>> {
  const snapshot = await getDocsFromServer(collection(db, PULSECHECK_PROTOCOLS_COLLECTION)).catch(() =>
    getDocs(collection(db, PULSECHECK_PROTOCOLS_COLLECTION))
  );
  const firestoreRecords: Array<Record<string, any>> = snapshot.docs
    .map((entry) => ({ id: entry.id, ...(entry.data() as Record<string, any>) }) as Record<string, any>)
    .filter((record) => record.publishStatus === 'published' && record.isActive !== false);

  const records: Array<Record<string, any>> = firestoreRecords.length > 0
    ? firestoreRecords
    : await protocolRegistryService.list() as Array<Record<string, any>>;
  return records.filter((record) =>
    protocolClass && protocolClass !== 'none' ? record.protocolClass === protocolClass : true
  );
}

function deriveLocalPolicyTags(
  snapshot: Record<string, any>,
  checkIn: {
    energyLevel?: number;
    stressLevel?: number;
    sleepQuality?: number;
    moodWord?: string;
  }
) {
  const tags = new Set<string>((snapshot?.contextTags || []).map((value: string) => normalizeTag(value)).filter(Boolean));
  const sessionType = normalizeTag(snapshot?.programSnapshot?.sessionType || snapshot?.rawSignalSummary?.activeProgramContext?.sessionType);
  const durationMode = normalizeTag(snapshot?.programSnapshot?.durationMode || snapshot?.rawSignalSummary?.activeProgramContext?.durationMode);
  const protocolClass = normalizeTag(snapshot?.recommendedProtocolClass);

  if (sessionType) tags.add(sessionType);
  if (durationMode) tags.add(durationMode);
  if (protocolClass) tags.add(protocolClass);
  if (snapshot?.recommendedRouting) tags.add(normalizeTag(snapshot.recommendedRouting));
  if (snapshot?.overallReadiness) tags.add(`${normalizeTag(snapshot.overallReadiness)}_snapshot`);

  if (sessionType === 'training_rep') {
    ['pre_training', 'pre_technical_work', 'pre_rep_prep'].forEach((tag) => tags.add(tag));
  }

  if (sessionType === 'recovery_rep') {
    ['recovery_day', 'post_load', 'post_competition'].forEach((tag) => tags.add(tag));
  }

  if (protocolClass === 'priming') {
    ['pre_training', 'pre_rep_prep'].forEach((tag) => tags.add(tag));
  }

  if (protocolClass === 'recovery') {
    ['recovery_day', 'post_load'].forEach((tag) => tags.add(tag));
  }

  if (typeof checkIn.energyLevel === 'number' && checkIn.energyLevel <= 2) {
    ['low_energy', 'flatness', 'underactivation', 'slow_start'].forEach((tag) => tags.add(tag));
  }

  if (typeof checkIn.stressLevel === 'number' && checkIn.stressLevel >= 4) {
    ['acute_stress', 'anxiety', 'pressure_spike', 'mental_noise'].forEach((tag) => tags.add(tag));
  }

  if (typeof checkIn.sleepQuality === 'number' && checkIn.sleepQuality <= 2) {
    ['sleep_sensitive', 'heavy_fatigue', 'cognitive_depletion'].forEach((tag) => tags.add(tag));
  }

  if (typeof checkIn.moodWord === 'string' && checkIn.moodWord.trim()) {
    tags.add(normalizeTag(checkIn.moodWord));
  }

  return Array.from(tags);
}

async function submitPulseCheckCheckInViaHarness(
  db: Firestore,
  input: {
    userId: string;
    type: string;
    readinessScore: number;
    moodWord?: string;
    energyLevel?: number;
    stressLevel?: number;
    sleepQuality?: number;
    notes?: string;
    taxonomyState?: Record<string, any>;
    sourceDate?: string;
    protocolRuntimeOverrides?: Array<Record<string, any>>;
  }
) {
  const athleteId = input.userId;
  const now = Date.now();
  const sourceDate = input.sourceDate || new Date().toISOString().split('T')[0];
  const checkInId = `${athleteId}_${sourceDate}_${now}`;
  const checkIn = {
    id: checkInId,
    userId: athleteId,
    type: (input.type as CheckInType) || CheckInType.Morning,
    readinessScore: input.readinessScore,
    moodWord: input.moodWord,
    energyLevel: input.energyLevel,
    stressLevel: input.stressLevel,
    sleepQuality: input.sleepQuality,
    notes: input.notes,
    taxonomyState: input.taxonomyState as any,
    createdAt: now,
    date: sourceDate,
  };

  await setDoc(
    doc(db, SIM_CHECKINS_ROOT, athleteId, 'check-ins', checkInId),
    checkInToFirestore(checkIn),
    { merge: true }
  );

  const progress = await athleteProgressService.get(athleteId);
  let snapshot = await stateSnapshotService.upsertFromCheckIn({
    athleteId,
    checkIn,
    progress,
  });

  if (snapshot.recommendedRouting === 'protocol_then_sim' && (!snapshot.recommendedProtocolClass || snapshot.recommendedProtocolClass === 'none')) {
    snapshot = {
      ...snapshot,
      recommendedProtocolClass: 'priming',
      updatedAt: Date.now(),
    };
    await setDoc(
      doc(db, PULSECHECK_STATE_SNAPSHOTS_COLLECTION, snapshot.id),
      pulseCheckStateSnapshotToFirestore(snapshot),
      { merge: true }
    );
  }

  const protocolClass = snapshot.recommendedProtocolClass && snapshot.recommendedProtocolClass !== 'none'
    ? snapshot.recommendedProtocolClass
    : undefined;
  const allProtocolRecords = Array.isArray(input.protocolRuntimeOverrides)
    ? input.protocolRuntimeOverrides
    : await listPublishedProtocolRuntimeRecords(db, protocolClass);
  console.log('[PulseE2E] protocol inventory for local check-in fallback', JSON.stringify({
    athleteId,
    protocolClass,
    protocolIds: allProtocolRecords.map((record) => record.id),
  }));
  const responsivenessProfileSnap = await getDoc(doc(db, PULSECHECK_PROTOCOL_RESPONSIVENESS_PROFILES_COLLECTION, athleteId));
  const responsivenessProfile = responsivenessProfileSnap.exists() ? responsivenessProfileSnap.data() as Record<string, any> : null;
  const policyTags = deriveLocalPolicyTags({
    ...snapshot,
    programSnapshot: progress?.activeProgram || null,
  }, checkIn);

  const eligibleProtocolCandidates = allProtocolRecords
    .filter((record) => {
      const publishStatus = String(record.publishStatus || '').toLowerCase();
      const governanceStage = String(record.governanceStage || '').toLowerCase();
      const triggerTags = Array.isArray(record.triggerTags) ? record.triggerTags : [];
      const useWindowTags = Array.isArray(record.useWindowTags) ? record.useWindowTags : [];
      const avoidWindowTags = Array.isArray(record.avoidWindowTags) ? record.avoidWindowTags : [];
      const contraindicationTags = Array.isArray(record.contraindicationTags) ? record.contraindicationTags : [];

      if (record.isActive === false) return false;
      if (publishStatus && publishStatus !== 'published') return false;
      if (governanceStage === 'archived' || governanceStage === 'restricted') return false;
      if (protocolClass && record.protocolClass && record.protocolClass !== protocolClass) return false;
      if (triggerTags.length > 0 && !intersectsTags(triggerTags, policyTags)) return false;
      if (useWindowTags.length > 0 && !intersectsTags(useWindowTags, policyTags)) return false;
      if (avoidWindowTags.length > 0 && intersectsTags(avoidWindowTags, policyTags)) return false;
      if (contraindicationTags.length > 0 && intersectsTags(contraindicationTags, policyTags)) return false;
      return true;
    })
    .map((record) => {
      const familyResponse = responsivenessProfile?.familyResponses?.[record.familyId];
      const freshness = familyResponse?.freshness;
      const responsivenessDirection =
        freshness && freshness !== 'refresh_required'
          ? familyResponse?.responseDirection
          : undefined;
      const preferredBoost = intersectsTags(Array.isArray(record.preferredContextTags) ? record.preferredContextTags : [], policyTags) ? 5 : 0;
      const responsivenessBoost =
        responsivenessDirection === 'positive'
          ? 15
          : responsivenessDirection === 'negative'
            ? -15
            : 0;

      return {
        id: `${athleteId}_${sourceDate}_${record.id}`,
        type: 'protocol',
        label: record.label,
        actionType: 'protocol',
        rationale: record.rationale || `[E2E] ${record.label} matched the current protocol policy.`,
        protocolId: record.id,
        protocolLabel: record.label,
        protocolClass: record.protocolClass,
        protocolCategory: record.category,
        protocolResponseFamily: record.responseFamily,
        protocolDeliveryMode: record.deliveryMode,
        durationSeconds: record.durationSeconds,
        legacyExerciseId: record.legacyExerciseId || '',
        responsivenessDirection,
        __score: 1000 - Number(record.sortOrder || 999) + preferredBoost + responsivenessBoost,
      };
    })
    .sort((left, right) => {
      if (right.__score !== left.__score) return right.__score - left.__score;
      return String(left.protocolId || '').localeCompare(String(right.protocolId || ''));
    });
  console.log('[PulseE2E] eligible protocol candidates for local check-in fallback', JSON.stringify({
    athleteId,
    policyTags,
    protocolIds: eligibleProtocolCandidates.map((candidate) => candidate.protocolId),
  }));

  const publishedExercise =
    (progress?.activeProgram?.recommendedLegacyExerciseId
      ? await simModuleLibraryService.getPublishedById(progress.activeProgram.recommendedLegacyExerciseId)
      : null) ||
    (progress?.activeProgram?.recommendedSimId
      ? await simModuleLibraryService.getPublishedBySimSpecId(progress.activeProgram.recommendedSimId)
      : null);
  const resolvedExercise = publishedExercise
    || (progress?.activeProgram?.recommendedLegacyExerciseId
      ? await simModuleLibraryService.getById(progress.activeProgram.recommendedLegacyExerciseId)
      : null)
    || (progress?.activeProgram?.recommendedSimId
      ? await simModuleLibraryService.getBySimSpecId(progress.activeProgram.recommendedSimId)
      : null);

  const simCandidate = resolvedExercise
    ? {
        id: `${athleteId}_${sourceDate}_${resolvedExercise.id}`,
        type: 'sim',
        label: resolvedExercise.name,
        actionType: snapshot.recommendedRouting === 'protocol_then_sim' ? 'lighter_sim' : 'sim',
        rationale: progress?.activeProgram?.rationale || '[E2E] Active program simulation candidate.',
        legacyExerciseId: resolvedExercise.id,
        simSpecId: resolvedExercise.simSpecId,
        durationSeconds: progress?.activeProgram?.durationSeconds || resolvedExercise.durationMinutes * 60,
      }
    : null;

  const candidateSetId = `${athleteId}_${sourceDate}_candidates`;
  const candidates = [
    ...eligibleProtocolCandidates.map(({ __score, ...candidate }) => candidate),
    ...(simCandidate ? [simCandidate] : []),
  ];
  const inventoryGaps =
    protocolClass && eligibleProtocolCandidates.length === 0
      ? [`No live ${protocolClass} protocol remains eligible for this check-in.`]
      : [];

  await setDoc(
    doc(db, PULSECHECK_ASSIGNMENT_CANDIDATE_SETS_COLLECTION, candidateSetId),
    sanitizeFirestoreValue({
      athleteId,
      sourceDate,
      sourceStateSnapshotId: snapshot.id,
      candidates,
      candidateIds: candidates.map((candidate) => candidate.id),
      candidateClassHints: uniqueStrings(candidates.map((candidate) => candidate.type)),
      constraintReasons: [],
      inventoryGaps,
      plannerEligible: true,
      createdAt: now,
      updatedAt: now,
    }),
    { merge: true }
  );

  const assignment = await assignmentOrchestratorService.orchestratePostCheckIn({
    athleteId,
    sourceCheckInId: checkIn.id,
    sourceStateSnapshotId: snapshot.id,
    sourceDate,
  });

  if (Array.isArray(input.protocolRuntimeOverrides) && input.protocolRuntimeOverrides.length > 0) {
    await setDoc(
      doc(db, PULSECHECK_ASSIGNMENT_CANDIDATE_SETS_COLLECTION, candidateSetId),
      sanitizeFirestoreValue({
        athleteId,
        sourceDate,
        sourceStateSnapshotId: snapshot.id,
        candidates,
        candidateIds: candidates.map((candidate) => candidate.id),
        candidateClassHints: uniqueStrings(candidates.map((candidate) => candidate.type)),
        constraintReasons: [],
        inventoryGaps,
        plannerEligible: true,
        createdAt: now,
        updatedAt: now,
      }),
      { merge: true }
    );
  }

  if (assignment) {
    const shouldKeepAssignmentLive = assignment.status === PulseCheckDailyAssignmentStatus.Deferred && Boolean(resolvedExercise);
    await updateDoc(doc(db, PULSECHECK_DAILY_ASSIGNMENTS_COLLECTION, assignment.id), {
      sourceCandidateSetId: candidateSetId,
      plannerAudit: sanitizeFirestoreValue({
        rankedCandidates: candidates.map((candidate, index) => ({
          ...candidate,
          rank: index + 1,
        })),
      }),
      ...(shouldKeepAssignmentLive
        ? {
            status: PulseCheckDailyAssignmentStatus.Assigned,
            actionType: snapshot.recommendedRouting === 'protocol_then_sim' ? 'lighter_sim' : 'sim',
            ...(resolvedExercise?.id ? { legacyExerciseId: resolvedExercise.id } : {}),
            ...(resolvedExercise?.simSpecId ? { simSpecId: resolvedExercise.simSpecId } : {}),
            ...(progress?.activeProgram?.durationSeconds || resolvedExercise?.durationMinutes
              ? { durationSeconds: progress?.activeProgram?.durationSeconds || (resolvedExercise?.durationMinutes || 0) * 60 }
              : {}),
          }
        : {}),
      updatedAt: Date.now(),
    });

    if (Array.isArray(input.protocolRuntimeOverrides)) {
      await setDoc(
        doc(db, PULSECHECK_ASSIGNMENT_CANDIDATE_SETS_COLLECTION, candidateSetId),
        sanitizeFirestoreValue({
          athleteId,
          sourceDate,
          sourceStateSnapshotId: snapshot.id,
          candidates,
          candidateIds: candidates.map((candidate) => candidate.id),
          candidateClassHints: uniqueStrings(candidates.map((candidate) => candidate.type)),
          constraintReasons: [],
          inventoryGaps,
          plannerEligible: true,
          createdAt: now,
          updatedAt: Date.now(),
        }),
        { merge: true }
      );
    }
  }

  const latestAssignment = assignment
    ? await assignmentOrchestratorService.getById(assignment.id)
    : null;

  return {
    checkIn,
    stateSnapshot: snapshot,
    candidateSet: {
      id: candidateSetId,
      athleteId,
      sourceDate,
      sourceStateSnapshotId: snapshot.id,
      candidates,
      candidateIds: candidates.map((candidate) => candidate.id),
      candidateClassHints: uniqueStrings(candidates.map((candidate) => candidate.type)),
      constraintReasons: [],
      inventoryGaps,
      plannerEligible: true,
      createdAt: now,
      updatedAt: now,
    },
    dailyAssignment: latestAssignment,
  };
}

async function recordPulseCheckAssignmentEventViaHarness(
  db: Firestore,
  input: {
    assignmentId: string;
    eventType: string;
    actorUserId?: string;
    reason?: string;
    metadata?: Record<string, unknown>;
  }
) {
  const assignment = await assignmentOrchestratorService.getById(input.assignmentId);
  if (!assignment) {
    throw new Error(`Assignment ${input.assignmentId} not found.`);
  }

  const now = Date.now();
  const eventId = `${input.assignmentId}_${input.eventType}_${now}`;
  const eventMetadata = sanitizeFirestoreValue(
    input.reason || input.metadata ? { reason: input.reason, ...(input.metadata || {}) } : undefined
  );
  const status =
    input.eventType === 'completed'
      ? PulseCheckDailyAssignmentStatus.Completed
      : input.eventType === 'started'
        ? PulseCheckDailyAssignmentStatus.Started
        : input.eventType === 'viewed'
          ? PulseCheckDailyAssignmentStatus.Viewed
          : input.eventType === 'overridden'
            ? PulseCheckDailyAssignmentStatus.Overridden
            : input.eventType === 'deferred'
              ? PulseCheckDailyAssignmentStatus.Deferred
              : assignment.status;

  await setDoc(
    doc(db, PULSECHECK_ASSIGNMENT_EVENTS_COLLECTION, eventId),
    sanitizeFirestoreValue({
      assignmentId: assignment.id,
      athleteId: assignment.athleteId,
      teamId: assignment.teamId,
      sourceDate: assignment.sourceDate,
      eventType: input.eventType,
      actorType: input.actorUserId ? 'coach' : 'system',
      actorUserId: input.actorUserId || 'local-e2e-harness',
      eventAt: now,
      metadata: eventMetadata,
      createdAt: now,
    }),
    { merge: true }
  );

  await setDoc(
    doc(db, PULSECHECK_DAILY_ASSIGNMENTS_COLLECTION, assignment.id),
    {
      status,
      updatedAt: now,
      ...(input.eventType === 'completed' ? { completedAt: now } : {}),
      ...(input.eventType === 'started' ? { startedAt: now } : {}),
      ...(input.eventType === 'viewed' ? { viewedAt: now } : {}),
    },
    { merge: true }
  );

  const updatedAssignmentSnap = await getDoc(doc(db, PULSECHECK_DAILY_ASSIGNMENTS_COLLECTION, assignment.id));
  const updatedAssignment = updatedAssignmentSnap.exists()
    ? pulseCheckDailyAssignmentFromFirestore(updatedAssignmentSnap.id, updatedAssignmentSnap.data() as Record<string, any>)
    : assignment;
  const snapshot = assignment.sourceStateSnapshotId
    ? await stateSnapshotService.getById(assignment.sourceStateSnapshotId)
    : null;

  return {
    assignment: updatedAssignment,
    event: {
      id: eventId,
      assignmentId: assignment.id,
      athleteId: assignment.athleteId,
      teamId: assignment.teamId,
      sourceDate: assignment.sourceDate,
      eventType: input.eventType,
      actorType: input.actorUserId ? 'coach' : 'system',
      actorUserId: input.actorUserId || 'local-e2e-harness',
      eventAt: now,
      metadata: eventMetadata,
      createdAt: now,
    },
    stateSnapshot: snapshot,
  };
}

async function seedPulseCheckProtocolResponsivenessProfile(
  db: Firestore,
  input: {
    athleteUserId: string;
    familyResponses?: Record<string, any>;
    variantResponses?: Record<string, any>;
    staleAt?: number;
  }
) {
  const now = Date.now();
  const profile = {
    athleteId: input.athleteUserId,
    familyResponses: input.familyResponses || {},
    variantResponses: input.variantResponses || {},
    sourceEventIds: [],
    staleAt: input.staleAt || now + 14 * 24 * 60 * 60 * 1000,
    lastUpdatedAt: now,
    createdAt: now,
    updatedAt: now,
  };

  await setDoc(
    doc(db, PULSECHECK_PROTOCOL_RESPONSIVENESS_PROFILES_COLLECTION, input.athleteUserId),
    profile,
    { merge: true }
  );

  return { id: input.athleteUserId, ...profile };
}

async function capturePulseCheckProtocolRuntimeRecords(
  db: Firestore,
  input: {
    protocolIds?: string[];
    protocolClass?: string;
  }
) {
  const protocolIds = Array.isArray(input.protocolIds) ? new Set(input.protocolIds.filter(Boolean)) : null;
  const snap = await getDocs(collection(db, PULSECHECK_PROTOCOLS_COLLECTION));

  return snap.docs
    .map((entry) => ({ id: entry.id, ...(entry.data() as Record<string, any>) } as Record<string, any> & { id: string }))
    .filter((record) => {
      if (protocolIds && !protocolIds.has(record.id)) {
        return false;
      }
      if (input.protocolClass && record.protocolClass !== input.protocolClass) {
        return false;
      }
      return true;
    });
}

async function upsertPulseCheckProtocolRuntimeRecords(
  db: Firestore,
  input: {
    records: Array<Record<string, any>>;
  }
) {
  const records = Array.isArray(input.records) ? input.records.filter((record) => record && typeof record.id === 'string' && record.id.trim()) : [];
  await Promise.all(
    records.map((record) =>
      setDoc(doc(db, PULSECHECK_PROTOCOLS_COLLECTION, record.id), record, { merge: true })
    )
  );

  return { updatedIds: records.map((record) => record.id) };
}

async function deletePulseCheckProtocolRuntimeRecords(
  db: Firestore,
  input: {
    protocolIds: string[];
  }
) {
  const protocolIds = Array.isArray(input.protocolIds) ? input.protocolIds.filter(Boolean) : [];
  await Promise.all(protocolIds.map((protocolId) => deleteDoc(doc(db, PULSECHECK_PROTOCOLS_COLLECTION, protocolId))));
  return { deletedIds: protocolIds };
}

async function syncPulseCheckProtocolRegistrySeeds() {
  return protocolRegistryService.syncSeedProtocols();
}

async function seedPulseCheckProtocolAssignmentFixture(
  db: Firestore,
  input: {
    namespace: string;
    athleteUserId: string;
    coachUserId: string;
    protocolId?: string;
    sourceDate?: string;
    candidateProtocols?: Array<{
      id: string;
      label: string;
      legacyExerciseId: string;
      protocolClass: 'priming' | 'regulation' | 'recovery';
      protocolCategory: ExerciseCategory;
      protocolResponseFamily: string;
      protocolDeliveryMode: string;
      durationSeconds: number;
      responsivenessDirection?: 'positive' | 'neutral' | 'negative';
    }>;
  }
) {
  const fixture = buildAthleteJourneyFixtureIds(input.namespace);
  const candidateProtocols = Array.isArray(input.candidateProtocols) && input.candidateProtocols.length > 0
    ? input.candidateProtocols
    : [resolveProtocolFixture(input.protocolId)];
  const now = Date.now();
  const sourceDate = input.sourceDate || new Date().toISOString().split('T')[0];
  const snapshotId = `${input.athleteUserId}_${sourceDate}`;
  const candidateSetId = `${input.athleteUserId}_${sourceDate}_candidates`;
  const assignmentId = `${input.athleteUserId}_${sourceDate}`;
  const candidates = candidateProtocols.map((protocol, index) => {
    const candidateId = `${input.athleteUserId}_${sourceDate}_${protocol.id}`;
    return {
      id: candidateId,
      type: 'protocol',
      label: protocol.label,
      actionType: 'protocol',
      rationale: `[E2E] Seeded protocol candidate ${protocol.label}.`,
      legacyExerciseId: protocol.legacyExerciseId,
      protocolId: protocol.id,
      protocolLabel: protocol.label,
      protocolClass: protocol.protocolClass,
      protocolCategory: protocol.protocolCategory,
      protocolResponseFamily: protocol.protocolResponseFamily,
      protocolDeliveryMode: protocol.protocolDeliveryMode,
      durationSeconds: protocol.durationSeconds,
      responsivenessDirection: protocol.responsivenessDirection || (index === 0 ? 'positive' : 'negative'),
    };
  });

  await setDoc(
    doc(db, PULSECHECK_STATE_SNAPSHOTS_COLLECTION, snapshotId),
    {
      athleteId: input.athleteUserId,
      sourceDate,
      sourceCheckInId: 'e2e-protocol-seed-checkin',
      stateDimensions: {
        activation: 54,
        focusReadiness: 48,
        emotionalLoad: 44,
        cognitiveFatigue: 41,
      },
      overallReadiness: 'yellow',
      confidence: 'medium',
      freshness: 'current',
      sourcesUsed: ['e2e_fixture'],
      sourceEventIds: [],
      contextTags: ['competition_window', 'between_reps'],
      recommendedRouting: 'protocol_then_sim',
      recommendedProtocolClass: candidates[0]?.protocolClass || 'priming',
      candidateClassHints: ['protocol', 'sim'],
      readinessScore: 52,
      supportFlag: false,
      decisionSource: 'fallback_rules',
      executionLink: assignmentId,
      createdAt: now,
      updatedAt: now,
    },
    { merge: true }
  );

  await setDoc(
    doc(db, PULSECHECK_ASSIGNMENT_CANDIDATE_SETS_COLLECTION, candidateSetId),
    {
      athleteId: input.athleteUserId,
      sourceDate,
      sourceStateSnapshotId: snapshotId,
      candidates,
      candidateIds: candidates.map((candidate) => candidate.id),
      candidateClassHints: ['protocol'],
      constraintReasons: [],
      inventoryGaps: [],
      plannerEligible: true,
      createdAt: now,
      updatedAt: now,
    },
    { merge: true }
  );

  await setDoc(
    doc(db, PULSECHECK_DAILY_ASSIGNMENTS_COLLECTION, assignmentId),
    {
      lineageId: assignmentId,
      revision: 1,
      athleteId: input.athleteUserId,
      teamId: fixture.teamId,
      teamMembershipId: `${fixture.teamId}_${input.athleteUserId}`,
      coachId: input.coachUserId,
      sourceCheckInId: 'e2e-protocol-seed-checkin',
      sourceStateSnapshotId: snapshotId,
      sourceCandidateSetId: candidateSetId,
      sourceDate,
      assignedBy: 'nora',
      status: 'assigned',
      actionType: 'protocol',
      chosenCandidateId: candidates[0]?.id,
      chosenCandidateType: 'protocol',
      legacyExerciseId: candidates[0]?.legacyExerciseId,
      protocolId: candidates[0]?.protocolId,
      protocolLabel: candidates[0]?.protocolLabel,
      protocolClass: candidates[0]?.protocolClass,
      protocolCategory: candidates[0]?.protocolCategory,
      protocolResponseFamily: candidates[0]?.protocolResponseFamily,
      protocolDeliveryMode: candidates[0]?.protocolDeliveryMode,
      durationSeconds: candidates[0]?.durationSeconds,
      rationale: `[E2E] Seeded protocol assignment for ${candidates[0]?.label}.`,
      plannerSummary: `[E2E] Seeded protocol assignment for ${candidates[0]?.label}.`,
      plannerConfidence: 'medium',
      decisionSource: 'fallback_rules',
      readinessScore: 52,
      readinessBand: 'medium',
      supportFlag: false,
      plannerAudit: {
        rankedCandidates: candidates.map((candidate, index) => ({
          ...candidate,
          rank: index + 1,
        })),
      },
      createdAt: now,
      updatedAt: now,
    },
    { merge: true }
  );

  return {
    assignmentId,
    candidateSetId,
    snapshotId,
    sourceDate,
    protocolId: candidates[0]?.protocolId || null,
  };
}

async function recordPulseCheckJourneyCompletion(
  db: Firestore,
  input: {
    athleteUserId: string;
    dailyAssignmentId: string;
    exerciseId?: string;
    exerciseName?: string;
    durationSeconds?: number;
    helpfulnessRating?: number;
  }
) {
  const assignmentSnap = await getDoc(doc(db, PULSECHECK_DAILY_ASSIGNMENTS_COLLECTION, input.dailyAssignmentId));
  const assignment = assignmentSnap.exists() ? { id: assignmentSnap.id, ...assignmentSnap.data() } as Record<string, any> : null;
  const fallbackExerciseId =
    input.exerciseId ||
    assignment?.legacyExerciseId ||
    assignment?.simSpecId ||
    'focus-3-second-reset';
  const fallbackExerciseName =
    input.exerciseName ||
    assignment?.legacyExerciseId ||
    assignment?.simSpecId ||
    assignment?.sessionType ||
    assignment?.actionType ||
    'Reset';
  const now = Date.now();
  const durationSeconds = input.durationSeconds || Math.max(60, assignment?.durationSeconds || 180);
  const completionId = `${input.athleteUserId}_${input.dailyAssignmentId}_completion`;
  const sessionSummary = {
    completedActionLabel: fallbackExerciseName,
    nextActionLabel: 'Continue building with Nora',
    athleteHeadline: `Strong practice rep on ${fallbackExerciseName}`,
    athleteBody: `You completed ${fallbackExerciseName} with good intent. Keep using the same cues on the next rep.`,
    coachHeadline: `Athlete completed ${fallbackExerciseName}`,
    coachBody: `The athlete completed ${fallbackExerciseName} and should keep reinforcing the same execution cues.`,
    targetSkills: ['signal recognition', 'execution rehearsal'],
    programChanged: false,
    generatedAt: now,
  };

  await setDoc(
    doc(db, SIM_COMPLETIONS_ROOT, input.athleteUserId, 'completions', completionId),
    {
      userId: input.athleteUserId,
      exerciseId: fallbackExerciseId,
      exerciseName: fallbackExerciseName,
      exerciseCategory: ExerciseCategory.Focus,
      dailyAssignmentId: input.dailyAssignmentId,
      completedAt: now,
      durationSeconds,
      helpfulnessRating: input.helpfulnessRating || 4,
      createdAt: now,
      sessionSummary,
    },
    { merge: true }
  );

  const completionEventId = `${input.dailyAssignmentId}_completed_${now}`;

  await setDoc(
    doc(db, PULSECHECK_ASSIGNMENT_EVENTS_COLLECTION, completionEventId),
    {
      assignmentId: input.dailyAssignmentId,
      athleteId: input.athleteUserId,
      teamId: assignment?.teamId || '',
      sourceDate: assignment?.sourceDate || new Date().toISOString().split('T')[0],
      eventType: 'completed',
      actorType: 'system',
      actorUserId: input.athleteUserId,
      eventAt: now,
      metadata: {
        exerciseId: fallbackExerciseId,
        exerciseName: fallbackExerciseName,
      },
      createdAt: now,
    },
    { merge: true }
  );

  await setDoc(
    doc(db, PULSECHECK_DAILY_ASSIGNMENTS_COLLECTION, input.dailyAssignmentId),
    {
      status: 'completed',
      completedAt: now,
      updatedAt: now,
    },
    { merge: true }
  );

  const profileSnap = await getDoc(doc(db, PULSECHECK_PROTOCOL_RESPONSIVENESS_PROFILES_COLLECTION, input.athleteUserId));
  const existingProfile = profileSnap.exists() ? (profileSnap.data() as Record<string, any>) : {};
  const existingSourceEventIds = Array.isArray(existingProfile.sourceEventIds)
    ? existingProfile.sourceEventIds
    : [];
  const existingFamilyResponses = existingProfile.familyResponses && typeof existingProfile.familyResponses === 'object'
    ? existingProfile.familyResponses
    : {};
  const familyId =
    assignment?.protocolFamilyId ||
    (assignment?.protocolClass && assignment?.protocolResponseFamily
      ? `${assignment.protocolClass}-${assignment.protocolResponseFamily}`
      : '');
  const existingFamilyResponse = familyId ? (existingFamilyResponses[familyId] || {}) : null;
  const nextFamilyResponses = familyId
    ? {
        ...existingFamilyResponses,
        [familyId]: {
          ...existingFamilyResponse,
          protocolFamilyId: familyId,
          protocolFamilyLabel:
            existingFamilyResponse?.protocolFamilyLabel ||
            assignment?.protocolLabel ||
            familyId,
          protocolClass: assignment?.protocolClass || existingFamilyResponse?.protocolClass,
          responseFamily: assignment?.protocolResponseFamily || existingFamilyResponse?.responseFamily,
          responseDirection: 'positive',
          confidence: existingFamilyResponse?.confidence || 'medium',
          freshness: 'current',
          sampleSize: Number(existingFamilyResponse?.sampleSize || 0) + 1,
          positiveSignals: Number(existingFamilyResponse?.positiveSignals || 0) + 1,
          neutralSignals: Number(existingFamilyResponse?.neutralSignals || 0),
          negativeSignals: Number(existingFamilyResponse?.negativeSignals || 0),
          stateFit: uniqueStrings([
            ...(Array.isArray(existingFamilyResponse?.stateFit) ? existingFamilyResponse.stateFit : []),
            assignment?.readinessBand ? `${assignment.readinessBand}_readiness` : '',
            assignment?.protocolClass || '',
          ]),
          supportingEvidence: uniqueStrings([
            ...(Array.isArray(existingFamilyResponse?.supportingEvidence) ? existingFamilyResponse.supportingEvidence : []),
            `E2E completion recorded for ${fallbackExerciseName}.`,
          ]).slice(0, 6),
          lastObservedAt: now,
          lastConfirmedAt: now,
        },
      }
    : existingFamilyResponses;

  await setDoc(
    doc(db, PULSECHECK_PROTOCOL_RESPONSIVENESS_PROFILES_COLLECTION, input.athleteUserId),
    {
      familyResponses: nextFamilyResponses,
      sourceEventIds: uniqueStrings([...existingSourceEventIds, completionEventId]),
      lastUpdatedAt: now,
      updatedAt: now,
    },
    { merge: true }
  );

  return {
    id: completionId,
    userId: input.athleteUserId,
    exerciseId: fallbackExerciseId,
    exerciseName: fallbackExerciseName,
    exerciseCategory: ExerciseCategory.Focus,
    dailyAssignmentId: input.dailyAssignmentId,
    completedAt: now,
    durationSeconds,
    helpfulnessRating: input.helpfulnessRating || 4,
    createdAt: now,
    sessionSummary,
  };
}

async function savePulseCheckProtocolPracticeSession(
  db: Firestore,
  input: {
    assignmentId: string;
    session: Record<string, any>;
  }
) {
  await assignmentOrchestratorService.saveProtocolPracticeSession(input.assignmentId, input.session as any);
  const snapshot = await getDoc(doc(db, PULSECHECK_DAILY_ASSIGNMENTS_COLLECTION, input.assignmentId));

  return snapshot.exists()
    ? { id: snapshot.id, ...snapshot.data() }
    : { id: input.assignmentId, protocolPracticeSession: input.session };
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
  submitPulseCheckCheckIn: (input: {
    userId: string;
    type: string;
    readinessScore: number;
    moodWord?: string;
    energyLevel?: number;
    stressLevel?: number;
    sleepQuality?: number;
    notes?: string;
    taxonomyState?: Record<string, any>;
    sourceDate?: string;
    protocolRuntimeOverrides?: Array<Record<string, any>>;
  }) => Promise<Record<string, any>>;
  recordPulseCheckAssignmentEvent: (input: {
    assignmentId: string;
    eventType: string;
    actorUserId?: string;
    reason?: string;
    metadata?: Record<string, unknown>;
  }) => Promise<Record<string, any>>;
  recordPulseCheckJourneyCompletion: (input: {
    athleteUserId: string;
    dailyAssignmentId: string;
    exerciseId?: string;
    exerciseName?: string;
    durationSeconds?: number;
    helpfulnessRating?: number;
  }) => Promise<Record<string, any>>;
  savePulseCheckProtocolPracticeSession: (input: {
    assignmentId: string;
    session: Record<string, any>;
  }) => Promise<Record<string, any>>;
  upsertPulseCheckCoachNotifications: (input: {
    coachUserId: string;
    athleteUserId: string;
  }) => Promise<Record<string, any>>;
  seedPulseCheckProtocolResponsivenessProfile: (input: {
    athleteUserId: string;
    familyResponses?: Record<string, any>;
    variantResponses?: Record<string, any>;
    staleAt?: number;
  }) => Promise<Record<string, any>>;
  seedPulseCheckProtocolAssignmentFixture: (input: {
    namespace: string;
    athleteUserId: string;
    coachUserId: string;
    protocolId?: string;
    sourceDate?: string;
  }) => Promise<Record<string, any>>;
  capturePulseCheckProtocolRuntimeRecords: (input: {
    protocolIds?: string[];
    protocolClass?: string;
  }) => Promise<Record<string, any>[]>;
  upsertPulseCheckProtocolRuntimeRecords: (input: {
    records: Array<Record<string, any>>;
  }) => Promise<Record<string, any>>;
  deletePulseCheckProtocolRuntimeRecords: (input: {
    protocolIds: string[];
  }) => Promise<Record<string, any>>;
  syncPulseCheckProtocolRegistrySeeds: () => Promise<Record<string, any>>;
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
    submitPulseCheckCheckIn: (input) => submitPulseCheckCheckInViaHarness(db, input),
    recordPulseCheckAssignmentEvent: (input) => recordPulseCheckAssignmentEventViaHarness(db, input),
    recordPulseCheckJourneyCompletion: (input) => recordPulseCheckJourneyCompletion(db, input),
    savePulseCheckProtocolPracticeSession: (input) => savePulseCheckProtocolPracticeSession(db, input),
    upsertPulseCheckCoachNotifications: (input) => upsertCoachNotificationDocs(db, input),
    seedPulseCheckProtocolResponsivenessProfile: (input) => seedPulseCheckProtocolResponsivenessProfile(db, input),
    seedPulseCheckProtocolAssignmentFixture: (input) => seedPulseCheckProtocolAssignmentFixture(db, input),
    capturePulseCheckProtocolRuntimeRecords: (input) => capturePulseCheckProtocolRuntimeRecords(db, input),
    upsertPulseCheckProtocolRuntimeRecords: (input) => upsertPulseCheckProtocolRuntimeRecords(db, input),
    deletePulseCheckProtocolRuntimeRecords: (input) => deletePulseCheckProtocolRuntimeRecords(db, input),
    syncPulseCheckProtocolRegistrySeeds: () => syncPulseCheckProtocolRegistrySeeds(),
    inspectLegacyCoachRosterFixture: (namespace: string) => inspectLegacyCoachRosterFixture(db, namespace),
    inspectVariant: async (variantId: string) => {
      const snap = await getDoc(doc(db, SIM_VARIANTS_COLLECTION, variantId));
      return snap.exists() ? { id: snap.id, ...snap.data() } : null;
    },
  };
}
