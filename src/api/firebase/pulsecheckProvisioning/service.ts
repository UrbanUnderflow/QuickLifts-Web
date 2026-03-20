import { addDoc, arrayUnion, collection, doc, getDoc, getDocs, orderBy, query, runTransaction, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore';
import { auth, db } from '../config';
import type {
  CompletePulseCheckAthleteOnboardingInput,
  CreatePulseCheckPilotCohortInput,
  CreatePulseCheckPilotInput,
  CreatePulseCheckTeamAccessInviteInput,
  CreatePulseCheckOrganizationInput,
  CreatePulseCheckTeamInput,
  PulseCheckAdminContact,
  PulseCheckOrganizationMembership,
  PulseCheckOrganization,
  PulseCheckAuntEdnaClinicianProfile,
  PulseCheckInviteLinkType,
  PulseCheckPilot,
  PulseCheckPilotCohort,
  PulseCheckPilotEnrollment,
  PulseCheckPilotEnrollmentStatus,
  PulseCheckPilotCohortStatus,
  PulseCheckPilotStatus,
  PulseCheckPilotStudyMode,
  PulseCheckResearchConsentStatus,
  PulseCheckRosterVisibilityScope,
  PulseCheckNotificationPreferences,
  PulseCheckOrganizationStatus,
  PulseCheckTeam,
  PulseCheckTeamMembership,
  PulseCheckTeamMembershipRole,
  PulseCheckTeamStatus,
  PulseCheckInviteLink,
  PulseCheckInviteLinkStatus,
  PulseCheckLegacyCoachRosterCandidate,
  PulseCheckLegacyCoachRosterMigrationResult,
  RedeemPulseCheckAdminActivationResult,
  RedeemPulseCheckTeamInviteResult,
  SavePulseCheckAdultMemberSetupInput,
  SavePulseCheckPostActivationSetupInput,
  UpdatePulseCheckTeamMembershipAccessInput,
  UpsertPulseCheckAuntEdnaClinicianProfileInput,
  MigrateLegacyCoachRosterInput,
  SavePulseCheckAthleteOnboardingProgressInput,
} from './types';

const ORGANIZATIONS_COLLECTION = 'pulsecheck-organizations';
const TEAMS_COLLECTION = 'pulsecheck-teams';
const PILOTS_COLLECTION = 'pulsecheck-pilots';
const PILOT_COHORTS_COLLECTION = 'pulsecheck-pilot-cohorts';
const PILOT_ENROLLMENTS_COLLECTION = 'pulsecheck-pilot-enrollments';
const CLINICIAN_PROFILES_COLLECTION = 'pulsecheck-auntedna-clinician-profiles';
const INVITE_LINKS_COLLECTION = 'pulsecheck-invite-links';
const ORGANIZATION_MEMBERSHIPS_COLLECTION = 'pulsecheck-organization-memberships';
const TEAM_MEMBERSHIPS_COLLECTION = 'pulsecheck-team-memberships';
const LEGACY_ROSTER_MIGRATIONS_COLLECTION = 'pulsecheck-legacy-roster-migrations';
const USERS_COLLECTION = 'users';
const COACHES_COLLECTION = 'coaches';
const COACH_ATHLETES_COLLECTION = 'coachAthletes';

const normalizeString = (value?: string) => value?.trim() || '';
const normalizeEmail = (value?: string) => normalizeString(value).toLowerCase();
const shouldStampDevFirebaseLinks = () =>
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' || window.localStorage.getItem('forceDevFirebase') === 'true');
const shouldUseLocalRedeemFallback = () =>
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' ||
    window.localStorage.getItem('forceDevFirebase') === 'true' ||
    process.env.NEXT_PUBLIC_E2E_FORCE_DEV_FIREBASE === 'true');
const defaultNotificationPreferences = (): PulseCheckNotificationPreferences => ({
  email: true,
  sms: false,
  push: true,
  weeklyDigest: true,
});
const defaultAthleteOnboardingState = () => ({
  productConsentAccepted: false,
  productConsentAcceptedAt: null,
  productConsentVersion: '',
  entryOnboardingStep: 'name' as const,
  entryOnboardingName: '',
  researchConsentStatus: 'not-required' as const,
  researchConsentVersion: '',
  researchConsentRespondedAt: null,
  eligibleForResearchDataset: false,
  enrollmentMode: 'product-only' as const,
  targetPilotId: '',
  targetPilotName: '',
  targetCohortId: '',
  targetCohortName: '',
  baselinePathStatus: 'pending' as const,
  baselinePathwayId: '',
});
const buildPilotEnrollmentId = (pilotId: string, userId: string) => `${normalizeString(pilotId)}_${normalizeString(userId)}`;
const resolveResearchConsentStatusForStudyMode = (
  studyMode: PulseCheckPilotStudyMode | null,
  currentStatus?: unknown
): PulseCheckResearchConsentStatus => {
  const normalizedCurrentStatus = normalizeString(String(currentStatus || '')) as PulseCheckResearchConsentStatus;
  if (normalizedCurrentStatus === 'accepted' || normalizedCurrentStatus === 'declined') {
    return normalizedCurrentStatus;
  }

  if (studyMode === 'research') {
    return normalizedCurrentStatus === 'pending' ? 'pending' : 'pending';
  }

  return 'not-required';
};
const buildAthleteOnboardingFromInvite = (
  invite: Record<string, any>,
  currentState?: Record<string, any> | null,
  pilotStudyMode: PulseCheckPilotStudyMode | null = null
) => {
  const pilotId = normalizeString(invite.pilotId);
  const cohortId = normalizeString(invite.cohortId);
  const researchConsentStatus = resolveResearchConsentStatusForStudyMode(pilotStudyMode, currentState?.researchConsentStatus);
  const isResearchMode = pilotStudyMode === 'research';

  return {
    ...defaultAthleteOnboardingState(),
    ...(currentState || {}),
    productConsentAccepted: Boolean(currentState?.productConsentAccepted),
    productConsentAcceptedAt: currentState?.productConsentAcceptedAt || null,
    productConsentVersion: normalizeString(currentState?.productConsentVersion),
    entryOnboardingStep: currentState?.entryOnboardingStep || 'name',
    entryOnboardingName: normalizeString(currentState?.entryOnboardingName),
    researchConsentStatus,
    researchConsentVersion: normalizeString(currentState?.researchConsentVersion),
    researchConsentRespondedAt: currentState?.researchConsentRespondedAt || null,
    eligibleForResearchDataset:
      researchConsentStatus === 'accepted'
        ? true
        : isResearchMode
          ? false
          : Boolean(currentState?.eligibleForResearchDataset),
    enrollmentMode:
      pilotId || cohortId
        ? isResearchMode
          ? researchConsentStatus === 'declined'
            ? 'pilot'
            : 'research'
          : 'pilot'
        : currentState?.enrollmentMode || 'product-only',
    targetPilotId: pilotId || normalizeString(currentState?.targetPilotId),
    targetPilotName: normalizeString(invite.pilotName) || normalizeString(currentState?.targetPilotName),
    targetCohortId: cohortId || normalizeString(currentState?.targetCohortId),
    targetCohortName: normalizeString(invite.cohortName) || normalizeString(currentState?.targetCohortName),
    baselinePathStatus: currentState?.baselinePathStatus || 'pending',
    baselinePathwayId: normalizeString(currentState?.baselinePathwayId),
  };
};
const normalizeAdminContacts = (value: unknown): PulseCheckAdminContact[] => {
  if (!Array.isArray(value)) return [];

  return value.reduce<PulseCheckAdminContact[]>((acc, entry) => {
    if (!entry || typeof entry !== 'object') return acc;

    const candidate = entry as Record<string, unknown>;
    const email = normalizeString(typeof candidate.email === 'string' ? candidate.email : '');
    if (!email) return acc;

    acc.push({
      name: normalizeString(typeof candidate.name === 'string' ? candidate.name : ''),
      email,
    });

    return acc;
  }, []);
};

const toOrganization = (id: string, data: Record<string, any>): PulseCheckOrganization => ({
  id,
  displayName: data.displayName || '',
  legalName: data.legalName || '',
  organizationType: data.organizationType || '',
  status: (data.status as PulseCheckOrganizationStatus) || 'provisioning',
  legacySource: data.legacySource || undefined,
  legacyCoachId: data.legacyCoachId || '',
  implementationOwnerUserId: data.implementationOwnerUserId || '',
  implementationOwnerEmail: data.implementationOwnerEmail || '',
  primaryCustomerAdminName: data.primaryCustomerAdminName || '',
  primaryCustomerAdminEmail: data.primaryCustomerAdminEmail || '',
  additionalAdminContacts: normalizeAdminContacts(data.additionalAdminContacts),
  defaultStudyPosture: data.defaultStudyPosture || 'operational',
  defaultClinicianBridgeMode: data.defaultClinicianBridgeMode || 'none',
  notes: data.notes || '',
  createdAt: data.createdAt || null,
  updatedAt: data.updatedAt || null,
});

const toTeam = (id: string, data: Record<string, any>): PulseCheckTeam => ({
  id,
  organizationId: data.organizationId || '',
  displayName: data.displayName || '',
  teamType: data.teamType || '',
  sportOrProgram: data.sportOrProgram || '',
  legacySource: data.legacySource || undefined,
  legacyCoachId: data.legacyCoachId || '',
  siteLabel: data.siteLabel || '',
  defaultAdminName: data.defaultAdminName || '',
  defaultAdminEmail: data.defaultAdminEmail || '',
  status: (data.status as PulseCheckTeamStatus) || 'provisioning',
  defaultInvitePolicy: data.defaultInvitePolicy || 'admin-only',
  defaultClinicianProfileId: data.defaultClinicianProfileId || '',
  defaultClinicianExternalProfileId: data.defaultClinicianExternalProfileId || '',
  defaultClinicianProfileName: data.defaultClinicianProfileName || '',
  defaultClinicianProfileType: data.defaultClinicianProfileType || 'group',
  defaultClinicianProfileSource: data.defaultClinicianProfileSource || 'pulsecheck-local',
  notes: data.notes || '',
  createdAt: data.createdAt || null,
  updatedAt: data.updatedAt || null,
});

const toPilot = (id: string, data: Record<string, any>): PulseCheckPilot => ({
  id,
  organizationId: data.organizationId || '',
  teamId: data.teamId || '',
  name: data.name || '',
  objective: data.objective || '',
  status: (data.status as PulseCheckPilotStatus) || 'draft',
  studyMode: data.studyMode || 'operational',
  ownerInternalUserId: data.ownerInternalUserId || '',
  ownerInternalEmail: data.ownerInternalEmail || '',
  checkpointCadence: data.checkpointCadence || '',
  startAt: data.startAt || null,
  endAt: data.endAt || null,
  notes: data.notes || '',
  createdAt: data.createdAt || null,
  updatedAt: data.updatedAt || null,
});

const toPilotCohort = (id: string, data: Record<string, any>): PulseCheckPilotCohort => ({
  id,
  organizationId: data.organizationId || '',
  teamId: data.teamId || '',
  pilotId: data.pilotId || '',
  name: data.name || '',
  cohortType: data.cohortType || '',
  assignmentRule: data.assignmentRule || '',
  reportingTags: Array.isArray(data.reportingTags) ? data.reportingTags : [],
  status: (data.status as PulseCheckPilotCohortStatus) || 'draft',
  notes: data.notes || '',
  createdAt: data.createdAt || null,
  updatedAt: data.updatedAt || null,
});

const toPilotEnrollment = (id: string, data: Record<string, any>): PulseCheckPilotEnrollment => ({
  id,
  organizationId: data.organizationId || '',
  teamId: data.teamId || '',
  pilotId: data.pilotId || '',
  cohortId: data.cohortId || '',
  userId: data.userId || '',
  teamMembershipId: data.teamMembershipId || '',
  studyMode: (data.studyMode as PulseCheckPilotStudyMode) || 'operational',
  enrollmentMode: data.enrollmentMode === 'research' ? 'research' : 'pilot',
  status: (data.status as PulseCheckPilotEnrollmentStatus) || 'pending-consent',
  productConsentAccepted: Boolean(data.productConsentAccepted),
  productConsentAcceptedAt: data.productConsentAcceptedAt || null,
  productConsentVersion: data.productConsentVersion || '',
  researchConsentStatus: (data.researchConsentStatus as PulseCheckResearchConsentStatus) || 'not-required',
  researchConsentVersion: data.researchConsentVersion || '',
  researchConsentRespondedAt: data.researchConsentRespondedAt || null,
  eligibleForResearchDataset: Boolean(data.eligibleForResearchDataset),
  grantedByInviteToken: data.grantedByInviteToken || '',
  createdAt: data.createdAt || null,
  updatedAt: data.updatedAt || null,
});

const toInviteLink = (id: string, data: Record<string, any>): PulseCheckInviteLink => ({
  id,
  inviteType: (data.inviteType as PulseCheckInviteLinkType) || 'admin-activation',
  status: (data.status as PulseCheckInviteLinkStatus) || 'active',
  organizationId: data.organizationId || '',
  teamId: data.teamId || '',
  pilotId: data.pilotId || '',
  pilotName: data.pilotName || '',
  cohortId: data.cohortId || '',
  cohortName: data.cohortName || '',
  clinicianProfileId: data.clinicianProfileId || '',
  teamMembershipRole: data.teamMembershipRole || undefined,
  invitedTitle: data.invitedTitle || '',
  recipientName: data.recipientName || '',
  targetEmail: data.targetEmail || '',
  token: data.token || id,
  activationUrl: data.activationUrl || '',
  createdByUserId: data.createdByUserId || '',
  createdByEmail: data.createdByEmail || '',
  createdAt: data.createdAt || null,
  updatedAt: data.updatedAt || null,
});

const toTeamMembership = (id: string, data: Record<string, any>): PulseCheckTeamMembership => ({
  id,
  organizationId: data.organizationId || '',
  teamId: data.teamId || '',
  userId: data.userId || '',
  email: data.email || '',
  legacySource: data.legacySource || undefined,
  legacyCoachId: data.legacyCoachId || '',
  legacyConnectionId: data.legacyConnectionId || '',
  legacyLinkedAt: data.legacyLinkedAt || null,
  role: (data.role as PulseCheckTeamMembershipRole) || 'coach',
  title: data.title || '',
  permissionSetId: data.permissionSetId || '',
  operatingRole: data.operatingRole || undefined,
  notificationPreferences: {
    ...defaultNotificationPreferences(),
    ...(data.notificationPreferences || {}),
  },
  rosterVisibilityScope: (data.rosterVisibilityScope as PulseCheckRosterVisibilityScope) || 'team',
  allowedAthleteIds: Array.isArray(data.allowedAthleteIds) ? data.allowedAthleteIds : [],
  athleteOnboarding: {
    ...defaultAthleteOnboardingState(),
    ...(data.athleteOnboarding || {}),
  },
  onboardingStatus: data.onboardingStatus || 'pending',
  postActivationCompletedAt: data.postActivationCompletedAt || null,
  grantedByInviteToken: data.grantedByInviteToken || '',
  grantedAt: data.grantedAt || null,
  createdAt: data.createdAt || null,
  updatedAt: data.updatedAt || null,
});

const toOrganizationMembership = (id: string, data: Record<string, any>): PulseCheckOrganizationMembership => ({
  id,
  organizationId: data.organizationId || '',
  userId: data.userId || '',
  email: data.email || '',
  role: data.role || 'org-admin',
  status: data.status || 'active',
  grantedByInviteToken: data.grantedByInviteToken || '',
  grantedAt: data.grantedAt || null,
  createdAt: data.createdAt || null,
  updatedAt: data.updatedAt || null,
});

const toClinicianProfile = (id: string, data: Record<string, any>): PulseCheckAuntEdnaClinicianProfile => ({
  id,
  externalProfileId: data.externalProfileId || '',
  auntEdnaProfileId: data.auntEdnaProfileId || '',
  displayName: data.displayName || '',
  organizationName: data.organizationName || '',
  email: data.email || '',
  profileType: data.profileType || 'group',
  source: data.source || 'pulsecheck-local',
  syncStatus: data.syncStatus || 'pending-sync',
  createdAt: data.createdAt || null,
  updatedAt: data.updatedAt || null,
});

const permissionSetByRole: Record<PulseCheckTeamMembershipRole, string> = {
  'team-admin': 'pulsecheck-team-admin-v1',
  coach: 'pulsecheck-coach-v1',
  'performance-staff': 'pulsecheck-performance-staff-v1',
  'support-staff': 'pulsecheck-support-staff-v1',
  clinician: 'pulsecheck-clinician-v1',
  athlete: 'pulsecheck-athlete-v1',
};

const coachRolePriority: Record<PulseCheckTeamMembershipRole, number> = {
  'team-admin': 0,
  coach: 1,
  'performance-staff': 2,
  'support-staff': 3,
  clinician: 4,
  athlete: 5,
};

const choosePrimaryOperatingMembership = (memberships: PulseCheckTeamMembership[]) =>
  [...memberships]
    .filter((membership) => membership.role !== 'athlete')
    .sort((left, right) => {
      const priorityDelta = (coachRolePriority[left.role] ?? 99) - (coachRolePriority[right.role] ?? 99);
      if (priorityDelta !== 0) return priorityDelta;

      const leftUpdated = toJsDate(left.updatedAt)?.getTime() || 0;
      const rightUpdated = toJsDate(right.updatedAt)?.getTime() || 0;
      return rightUpdated - leftUpdated;
    })[0] || null;

const toJsDate = (value: any): Date | null => {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value?.toDate === 'function') return value.toDate();
  if (typeof value === 'number') return new Date(value * 1000);
  return null;
};

const formatLegacyCoachRosterName = (coachName: string) => {
  const normalized = normalizeString(coachName);
  return normalized || 'Legacy Coach';
};
const buildLegacyRosterOrganizationName = (coachName: string) => `${formatLegacyCoachRosterName(coachName)} Coaching`;
const buildLegacyRosterTeamName = (coachName: string) => `${formatLegacyCoachRosterName(coachName)} Legacy Roster`;

const withLocalRedeemFallback = async <T>(
  serverAction: () => Promise<T>,
  fallbackAction: () => Promise<T>
): Promise<T> => {
  try {
    return await serverAction();
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    const canFallback =
      shouldUseLocalRedeemFallback() &&
      (message.includes('Could not load the default credentials') ||
        message.includes('Authenticated session required.') ||
        message.includes('Failed to redeem') ||
        message.includes('Firebase ID token has incorrect') ||
        message.includes('incorrect "aud"') ||
        message.includes('same Firebase project') ||
        message.includes('Invite not found.') ||
        message.includes('Organization not found.') ||
        message.includes('Team not found.'));

    if (!canFallback) {
      throw error;
    }

    console.warn('[PulseCheck provisioning] Falling back to client-side invite redemption:', message);
    return fallbackAction();
  }
};

export const pulseCheckProvisioningService = {
  async listOrganizations(): Promise<PulseCheckOrganization[]> {
    const snapshot = await getDocs(query(collection(db, ORGANIZATIONS_COLLECTION), orderBy('createdAt', 'desc')));
    return snapshot.docs.map((docSnap) => toOrganization(docSnap.id, docSnap.data() as Record<string, any>));
  },

  async listTeams(): Promise<PulseCheckTeam[]> {
    const snapshot = await getDocs(query(collection(db, TEAMS_COLLECTION), orderBy('createdAt', 'desc')));
    return snapshot.docs.map((docSnap) => toTeam(docSnap.id, docSnap.data() as Record<string, any>));
  },

  async listPilots(): Promise<PulseCheckPilot[]> {
    const snapshot = await getDocs(query(collection(db, PILOTS_COLLECTION), orderBy('createdAt', 'desc')));
    return snapshot.docs.map((docSnap) => toPilot(docSnap.id, docSnap.data() as Record<string, any>));
  },

  async listPilotCohorts(): Promise<PulseCheckPilotCohort[]> {
    const snapshot = await getDocs(query(collection(db, PILOT_COHORTS_COLLECTION), orderBy('createdAt', 'desc')));
    return snapshot.docs.map((docSnap) => toPilotCohort(docSnap.id, docSnap.data() as Record<string, any>));
  },

  async listPilotEnrollments(): Promise<PulseCheckPilotEnrollment[]> {
    const snapshot = await getDocs(collection(db, PILOT_ENROLLMENTS_COLLECTION));
    return snapshot.docs
      .map((docSnap) => toPilotEnrollment(docSnap.id, docSnap.data() as Record<string, any>))
      .sort((left, right) => {
        const leftTime = toJsDate(left.createdAt)?.getTime() || 0;
        const rightTime = toJsDate(right.createdAt)?.getTime() || 0;
        return rightTime - leftTime;
      });
  },

  async listPilotEnrollmentsByPilot(pilotId: string): Promise<PulseCheckPilotEnrollment[]> {
    const snapshot = await getDocs(
      query(collection(db, PILOT_ENROLLMENTS_COLLECTION), where('pilotId', '==', normalizeString(pilotId)))
    );
    return snapshot.docs
      .map((docSnap) => toPilotEnrollment(docSnap.id, docSnap.data() as Record<string, any>))
      .sort((left, right) => {
        const leftTime = toJsDate(left.createdAt)?.getTime() || 0;
        const rightTime = toJsDate(right.createdAt)?.getTime() || 0;
        return rightTime - leftTime;
      });
  },

  async listClinicianProfiles(): Promise<PulseCheckAuntEdnaClinicianProfile[]> {
    const snapshot = await getDocs(query(collection(db, CLINICIAN_PROFILES_COLLECTION), orderBy('displayName', 'asc')));
    return snapshot.docs.map((docSnap) => toClinicianProfile(docSnap.id, docSnap.data() as Record<string, any>));
  },

  async listInviteLinks(): Promise<PulseCheckInviteLink[]> {
    const snapshot = await getDocs(query(collection(db, INVITE_LINKS_COLLECTION), orderBy('createdAt', 'desc')));
    return snapshot.docs.map((docSnap) => toInviteLink(docSnap.id, docSnap.data() as Record<string, any>));
  },

  async listTeamInviteLinks(teamId: string): Promise<PulseCheckInviteLink[]> {
    const snapshot = await getDocs(query(collection(db, INVITE_LINKS_COLLECTION), where('teamId', '==', normalizeString(teamId))));
    return snapshot.docs
      .map((docSnap) => toInviteLink(docSnap.id, docSnap.data() as Record<string, any>))
      .sort((left, right) => {
        const leftTime = toJsDate(left.createdAt)?.getTime() || 0;
        const rightTime = toJsDate(right.createdAt)?.getTime() || 0;
        return rightTime - leftTime;
      });
  },

  async listUserTeamMemberships(userId: string): Promise<PulseCheckTeamMembership[]> {
    const snapshot = await getDocs(query(collection(db, TEAM_MEMBERSHIPS_COLLECTION), where('userId', '==', normalizeString(userId))));
    return snapshot.docs.map((docSnap) => toTeamMembership(docSnap.id, docSnap.data() as Record<string, any>));
  },

  async listUserOrganizationMemberships(userId: string): Promise<PulseCheckOrganizationMembership[]> {
    const snapshot = await getDocs(
      query(collection(db, ORGANIZATION_MEMBERSHIPS_COLLECTION), where('userId', '==', normalizeString(userId)))
    );
    return snapshot.docs.map((docSnap) => toOrganizationMembership(docSnap.id, docSnap.data() as Record<string, any>));
  },

  async listTeamMemberships(teamId: string): Promise<PulseCheckTeamMembership[]> {
    const snapshot = await getDocs(query(collection(db, TEAM_MEMBERSHIPS_COLLECTION), where('teamId', '==', normalizeString(teamId))));
    return snapshot.docs
      .map((docSnap) => toTeamMembership(docSnap.id, docSnap.data() as Record<string, any>))
      .sort((left, right) => {
        if (left.role === 'team-admin' && right.role !== 'team-admin') return -1;
        if (left.role !== 'team-admin' && right.role === 'team-admin') return 1;
        return (left.email || '').localeCompare(right.email || '');
      });
  },

  async getOrganization(organizationId: string): Promise<PulseCheckOrganization | null> {
    const snapshot = await getDoc(doc(db, ORGANIZATIONS_COLLECTION, normalizeString(organizationId)));
    if (!snapshot.exists()) return null;
    return toOrganization(snapshot.id, snapshot.data() as Record<string, any>);
  },

  async getTeam(teamId: string): Promise<PulseCheckTeam | null> {
    const snapshot = await getDoc(doc(db, TEAMS_COLLECTION, normalizeString(teamId)));
    if (!snapshot.exists()) return null;
    return toTeam(snapshot.id, snapshot.data() as Record<string, any>);
  },

  async getPilot(pilotId: string): Promise<PulseCheckPilot | null> {
    const snapshot = await getDoc(doc(db, PILOTS_COLLECTION, normalizeString(pilotId)));
    if (!snapshot.exists()) return null;
    return toPilot(snapshot.id, snapshot.data() as Record<string, any>);
  },

  async getPilotEnrollment(pilotId: string, userId: string): Promise<PulseCheckPilotEnrollment | null> {
    const snapshot = await getDoc(doc(db, PILOT_ENROLLMENTS_COLLECTION, buildPilotEnrollmentId(pilotId, userId)));
    if (!snapshot.exists()) return null;
    return toPilotEnrollment(snapshot.id, snapshot.data() as Record<string, any>);
  },

  async listLegacyCoachRosterCandidates(): Promise<PulseCheckLegacyCoachRosterCandidate[]> {
    const coachAthleteSnapshot = await getDocs(collection(db, COACH_ATHLETES_COLLECTION));
    const activeLinks = coachAthleteSnapshot.docs.filter((docSnap) => {
      const data = docSnap.data() as Record<string, any>;
      return normalizeString(data.coachId) && normalizeString(data.athleteUserId) && normalizeString(data.status) !== 'disconnected';
    });

    const groupedByCoach = new Map<string, Array<{ id: string; data: Record<string, any> }>>();
    const athleteIds = new Set<string>();

    activeLinks.forEach((docSnap) => {
      const data = docSnap.data() as Record<string, any>;
      const coachId = normalizeString(data.coachId);
      const athleteUserId = normalizeString(data.athleteUserId);
      athleteIds.add(athleteUserId);

      const existing = groupedByCoach.get(coachId) || [];
      existing.push({ id: docSnap.id, data });
      groupedByCoach.set(coachId, existing);
    });

    const coachIds = [...groupedByCoach.keys()];
    const [coachDocs, coachUserDocs, athleteUserDocs, primaryMembershipEntries] = await Promise.all([
      Promise.all(
        coachIds.map(async (coachId) => {
          const snapshot = await getDoc(doc(db, COACHES_COLLECTION, coachId));
          return [coachId, snapshot.exists() ? (snapshot.data() as Record<string, any>) : null] as const;
        })
      ),
      Promise.all(
        coachIds.map(async (coachId) => {
          const snapshot = await getDoc(doc(db, USERS_COLLECTION, coachId));
          return [coachId, snapshot.exists() ? (snapshot.data() as Record<string, any>) : null] as const;
        })
      ),
      Promise.all(
        [...athleteIds].map(async (athleteUserId) => {
          const snapshot = await getDoc(doc(db, USERS_COLLECTION, athleteUserId));
          return [athleteUserId, snapshot.exists() ? (snapshot.data() as Record<string, any>) : null] as const;
        })
      ),
      Promise.all(
        coachIds.map(async (coachId) => {
          const memberships = await pulseCheckProvisioningService.listUserTeamMemberships(coachId);
          return [coachId, choosePrimaryOperatingMembership(memberships)] as const;
        })
      ),
    ]);

    const coachDocMap = new Map(coachDocs);
    const coachUserMap = new Map(coachUserDocs);
    const athleteUserMap = new Map(athleteUserDocs);
    const primaryMembershipMap = new Map(primaryMembershipEntries);

    const uniqueTeamIds = [...new Set(primaryMembershipEntries.map(([, membership]) => membership?.teamId).filter(Boolean))] as string[];
    const uniqueOrganizationIds = [
      ...new Set(primaryMembershipEntries.map(([, membership]) => membership?.organizationId).filter(Boolean)),
    ] as string[];

    const [teamEntries, organizationEntries, teamAthleteEntries] = await Promise.all([
      Promise.all(
        uniqueTeamIds.map(async (teamId) => [teamId, await pulseCheckProvisioningService.getTeam(teamId)] as const)
      ),
      Promise.all(
        uniqueOrganizationIds.map(async (organizationId) => [
          organizationId,
          await pulseCheckProvisioningService.getOrganization(organizationId),
        ] as const)
      ),
      Promise.all(
        uniqueTeamIds.map(async (teamId) => {
          const memberships = await pulseCheckProvisioningService.listTeamMemberships(teamId);
          return [
            teamId,
            new Set(memberships.filter((membership) => membership.role === 'athlete').map((membership) => membership.userId)),
          ] as const;
        })
      ),
    ]);

    const teamMap = new Map(teamEntries);
    const organizationMap = new Map(organizationEntries);
    const teamAthleteMap = new Map(teamAthleteEntries);

    return coachIds
      .map((coachId) => {
        const coachData = coachDocMap.get(coachId) || {};
        const coachUser = coachUserMap.get(coachId) || {};
        const primaryMembership = primaryMembershipMap.get(coachId) || null;
        const team = primaryMembership?.teamId ? teamMap.get(primaryMembership.teamId) : null;
        const organization = primaryMembership?.organizationId ? organizationMap.get(primaryMembership.organizationId) : null;
        const teamAthleteIds = primaryMembership?.teamId ? teamAthleteMap.get(primaryMembership.teamId) || new Set<string>() : new Set<string>();

        const dedupedAthletes = new Map<string, { id: string; data: Record<string, any> }>();
        (groupedByCoach.get(coachId) || []).forEach((entry) => {
          const athleteUserId = normalizeString(entry.data.athleteUserId);
          const existing = dedupedAthletes.get(athleteUserId);
          const existingUpdated = existing ? toJsDate(existing.data.updatedAt || existing.data.linkedAt)?.getTime() || 0 : 0;
          const nextUpdated = toJsDate(entry.data.updatedAt || entry.data.linkedAt)?.getTime() || 0;
          if (!existing || nextUpdated >= existingUpdated) {
            dedupedAthletes.set(athleteUserId, entry);
          }
        });

        const athletes = [...dedupedAthletes.values()]
          .map(({ id, data }) => {
            const athleteUserId = normalizeString(data.athleteUserId);
            const athleteUser = athleteUserMap.get(athleteUserId) || {};
            return {
              legacyConnectionId: id,
              athleteUserId,
              athleteDisplayName:
                normalizeString(athleteUser.displayName as string) ||
                normalizeString(athleteUser.username as string) ||
                normalizeString(athleteUser.email as string) ||
                athleteUserId,
              athleteEmail: normalizeEmail(athleteUser.email as string),
              linkedAt: data.linkedAt || null,
              updatedAt: data.updatedAt || null,
              alreadyOnTargetTeam: teamAthleteIds.has(athleteUserId),
            };
          })
          .sort((left, right) => left.athleteDisplayName.localeCompare(right.athleteDisplayName));

        return {
          coachId,
          coachDisplayName:
            normalizeString(coachUser.displayName as string) ||
            normalizeString(coachUser.username as string) ||
            normalizeString(coachData.username as string) ||
            normalizeString(coachUser.email as string) ||
            coachId,
          coachEmail: normalizeEmail((coachUser.email as string) || (coachData.email as string)),
          coachReferralCode: normalizeString(coachData.referralCode as string),
          athleteCount: athletes.length,
          athletes,
          existingOrganizationId: organization?.id || '',
          existingOrganizationName: organization?.displayName || '',
          existingTeamId: team?.id || '',
          existingTeamName: team?.displayName || '',
          existingTeamMembershipRole: primaryMembership?.role,
        } satisfies PulseCheckLegacyCoachRosterCandidate;
      })
      .sort((left, right) => right.athleteCount - left.athleteCount || left.coachDisplayName.localeCompare(right.coachDisplayName));
  },

  async migrateLegacyCoachRoster(input: MigrateLegacyCoachRosterInput): Promise<PulseCheckLegacyCoachRosterMigrationResult> {
    const coachId = normalizeString(input.coachId);
    if (!coachId) {
      throw new Error('Coach ID is required.');
    }

    const [candidateList, coachUserSnap] = await Promise.all([
      pulseCheckProvisioningService.listLegacyCoachRosterCandidates(),
      getDoc(doc(db, USERS_COLLECTION, coachId)),
    ]);
    const candidate = candidateList.find((entry) => entry.coachId === coachId);
    if (!candidate) {
      throw new Error('No active legacy roster was found for this coach.');
    }

    const coachUser = coachUserSnap.exists() ? (coachUserSnap.data() as Record<string, any>) : {};
    const coachEmail = candidate.coachEmail || normalizeEmail(coachUser.email as string);
    const coachName = formatLegacyCoachRosterName(candidate.coachDisplayName);
    const requestedOrganizationName = normalizeString(input.organizationName);
    const requestedTeamName = normalizeString(input.teamName);

    let organizationId = normalizeString(candidate.existingOrganizationId);
    let teamId = normalizeString(candidate.existingTeamId);
    let organizationName = normalizeString(candidate.existingOrganizationName);
    let teamName = normalizeString(candidate.existingTeamName);
    let createdOrganization = false;
    let createdTeam = false;

    if (!organizationId) {
      organizationName = requestedOrganizationName || buildLegacyRosterOrganizationName(coachName);
      organizationId = await pulseCheckProvisioningService.createOrganization({
        displayName: organizationName,
        legalName: organizationName,
        organizationType: 'other',
        status: 'active',
        legacySource: 'legacy-coach-roster',
        legacyCoachId: coachId,
        primaryCustomerAdminName: coachName,
        primaryCustomerAdminEmail: coachEmail,
        defaultStudyPosture: 'operational',
        defaultClinicianBridgeMode: 'none',
        notes: `Auto-created from legacy coach roster migration for ${coachName}.`,
      });
      createdOrganization = true;
    }

    if (!teamId) {
      teamName = requestedTeamName || buildLegacyRosterTeamName(coachName);
      teamId = await pulseCheckProvisioningService.createTeam({
        organizationId,
        displayName: teamName,
        teamType: 'other',
        sportOrProgram: 'Legacy coach roster',
        status: 'active',
        legacySource: 'legacy-coach-roster',
        legacyCoachId: coachId,
        defaultAdminName: coachName,
        defaultAdminEmail: coachEmail,
        defaultInvitePolicy: 'admin-staff-and-coaches',
        notes: `Auto-created from legacy coach roster migration for ${coachName}.`,
      });
      createdTeam = true;
    }

    if (!organizationName) {
      const organization = await pulseCheckProvisioningService.getOrganization(organizationId);
      organizationName = organization?.displayName || organizationId;
    }
    if (!teamName) {
      const team = await pulseCheckProvisioningService.getTeam(teamId);
      teamName = team?.displayName || teamId;
    }

    const organizationMembershipRef = doc(db, ORGANIZATION_MEMBERSHIPS_COLLECTION, `${organizationId}_${coachId}`);
    const teamMembershipRef = doc(db, TEAM_MEMBERSHIPS_COLLECTION, `${teamId}_${coachId}`);
    const [organizationMembershipSnap, teamMembershipSnap] = await Promise.all([
      getDoc(organizationMembershipRef),
      getDoc(teamMembershipRef),
    ]);
    const existingTeamMembership = teamMembershipSnap.exists() ? (teamMembershipSnap.data() as Record<string, any>) : {};
    const coachTeamRole =
      (normalizeString(existingTeamMembership.role) as PulseCheckTeamMembershipRole) ||
      (candidate.existingTeamId ? 'coach' : 'team-admin');
    const coachOrganizationRole = coachTeamRole === 'team-admin' ? 'org-admin' : 'implementation-observer';

    await Promise.all([
      setDoc(
        organizationMembershipRef,
        {
          organizationId,
          userId: coachId,
          email: coachEmail,
          role: coachOrganizationRole,
          status: 'active',
          grantedAt: organizationMembershipSnap.exists() ? organizationMembershipSnap.data()?.grantedAt || serverTimestamp() : serverTimestamp(),
          createdAt: organizationMembershipSnap.exists() ? organizationMembershipSnap.data()?.createdAt || serverTimestamp() : serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      ),
      setDoc(
        teamMembershipRef,
        {
          organizationId,
          teamId,
          userId: coachId,
          email: coachEmail,
          role: coachTeamRole,
          title: existingTeamMembership.title || (coachTeamRole === 'team-admin' ? 'Legacy Roster Coach' : 'Coach'),
          permissionSetId: existingTeamMembership.permissionSetId || permissionSetByRole[coachTeamRole],
          rosterVisibilityScope: existingTeamMembership.rosterVisibilityScope || 'team',
          allowedAthleteIds: existingTeamMembership.allowedAthleteIds || [],
          onboardingStatus: existingTeamMembership.onboardingStatus || 'pending-profile',
          createdAt: existingTeamMembership.createdAt || serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      ),
      setDoc(
        doc(db, TEAMS_COLLECTION, teamId),
        {
          status: 'active',
          ...(coachTeamRole === 'team-admin' ? { defaultAdminUserIds: arrayUnion(coachId) } : {}),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      ),
    ]);

    let migratedAthleteCount = 0;
    let alreadyPresentAthleteCount = 0;

    for (const athlete of candidate.athletes) {
      const athleteMembershipRef = doc(db, TEAM_MEMBERSHIPS_COLLECTION, `${teamId}_${athlete.athleteUserId}`);
      const athleteMembershipSnap = await getDoc(athleteMembershipRef);
      const existingAthleteMembership = athleteMembershipSnap.exists()
        ? (athleteMembershipSnap.data() as Record<string, any>)
        : {};

      if (athleteMembershipSnap.exists() && normalizeString(existingAthleteMembership.role) && existingAthleteMembership.role !== 'athlete') {
        alreadyPresentAthleteCount += 1;
        continue;
      }

      if (athleteMembershipSnap.exists()) {
        alreadyPresentAthleteCount += 1;
      } else {
        migratedAthleteCount += 1;
      }

      await setDoc(
        athleteMembershipRef,
        {
          organizationId,
          teamId,
          userId: athlete.athleteUserId,
          email: athlete.athleteEmail || '',
          role: 'athlete',
          permissionSetId: permissionSetByRole.athlete,
          rosterVisibilityScope: 'none',
          allowedAthleteIds: [],
          legacySource: 'coach-athletes',
          legacyCoachId: coachId,
          legacyConnectionId: athlete.legacyConnectionId,
          legacyLinkedAt: athlete.linkedAt || athlete.updatedAt || null,
          athleteOnboarding: existingAthleteMembership.athleteOnboarding || defaultAthleteOnboardingState(),
          onboardingStatus: existingAthleteMembership.onboardingStatus || 'pending-consent',
          createdAt: existingAthleteMembership.createdAt || serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    }

    await addDoc(collection(db, LEGACY_ROSTER_MIGRATIONS_COLLECTION), {
      coachId,
      coachDisplayName: coachName,
      organizationId,
      organizationName,
      teamId,
      teamName,
      createdOrganization,
      createdTeam,
      migratedAthleteCount,
      alreadyPresentAthleteCount,
      source: 'coach-athletes',
      athleteUserIds: candidate.athletes.map((athlete) => athlete.athleteUserId),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return {
      coachId,
      coachDisplayName: coachName,
      organizationId,
      organizationName,
      teamId,
      teamName,
      createdOrganization,
      createdTeam,
      migratedAthleteCount,
      alreadyPresentAthleteCount,
    };
  },

  async createClinicianProfile(input: UpsertPulseCheckAuntEdnaClinicianProfileInput): Promise<PulseCheckAuntEdnaClinicianProfile> {
    const payload = {
      externalProfileId: normalizeString(input.externalProfileId),
      auntEdnaProfileId: normalizeString(input.auntEdnaProfileId),
      displayName: normalizeString(input.displayName),
      organizationName: normalizeString(input.organizationName),
      email: normalizeString(input.email),
      profileType: input.profileType,
      source: input.source || 'pulsecheck-local',
      syncStatus: input.syncStatus || 'pending-sync',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    const docRef = await addDoc(collection(db, CLINICIAN_PROFILES_COLLECTION), payload);
    const createdSnapshot = await getDoc(docRef);
    return toClinicianProfile(docRef.id, (createdSnapshot.data() || payload) as Record<string, any>);
  },

  async upsertClinicianProfile(input: UpsertPulseCheckAuntEdnaClinicianProfileInput): Promise<string> {
    const profileId = normalizeString(input.externalProfileId || input.auntEdnaProfileId);
    const profileRef = doc(db, CLINICIAN_PROFILES_COLLECTION, profileId);

    await setDoc(
      profileRef,
      {
        externalProfileId: normalizeString(input.externalProfileId),
        auntEdnaProfileId: normalizeString(input.auntEdnaProfileId),
        displayName: normalizeString(input.displayName),
        organizationName: normalizeString(input.organizationName),
        email: normalizeString(input.email),
        profileType: input.profileType,
        source: input.source || 'auntedna',
        syncStatus: input.syncStatus || 'synced',
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    return profileId;
  },

  async createOrganization(input: CreatePulseCheckOrganizationInput): Promise<string> {
    const payload = {
      displayName: normalizeString(input.displayName),
      legalName: normalizeString(input.legalName),
      organizationType: normalizeString(input.organizationType),
      status: input.status || 'provisioning',
      legacySource: input.legacySource || null,
      legacyCoachId: normalizeString(input.legacyCoachId),
      implementationOwnerUserId: normalizeString(input.implementationOwnerUserId),
      implementationOwnerEmail: normalizeString(input.implementationOwnerEmail),
      primaryCustomerAdminName: normalizeString(input.primaryCustomerAdminName),
      primaryCustomerAdminEmail: normalizeString(input.primaryCustomerAdminEmail),
      additionalAdminContacts: normalizeAdminContacts(input.additionalAdminContacts),
      defaultStudyPosture: input.defaultStudyPosture,
      defaultClinicianBridgeMode: input.defaultClinicianBridgeMode,
      notes: normalizeString(input.notes),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    const docRef = await addDoc(collection(db, ORGANIZATIONS_COLLECTION), payload);
    return docRef.id;
  },

  async addOrganizationAdminContact(input: {
    organizationId: string;
    name?: string;
    email: string;
  }): Promise<void> {
    const organizationRef = doc(db, ORGANIZATIONS_COLLECTION, input.organizationId);
    const organizationSnapshot = await getDoc(organizationRef);
    if (!organizationSnapshot.exists()) {
      throw new Error('Organization not found');
    }

    const currentData = organizationSnapshot.data() as Record<string, unknown>;
    const currentContacts = normalizeAdminContacts(currentData.additionalAdminContacts);
    const nextEmail = normalizeString(input.email).toLowerCase();
    const primaryEmail = normalizeString(typeof currentData.primaryCustomerAdminEmail === 'string' ? currentData.primaryCustomerAdminEmail : '').toLowerCase();

    if (!nextEmail) {
      throw new Error('Admin email is required');
    }

    if (primaryEmail === nextEmail || currentContacts.some((contact) => contact.email.toLowerCase() === nextEmail)) {
      return;
    }

    await updateDoc(organizationRef, {
      additionalAdminContacts: [
        ...currentContacts,
        {
          name: normalizeString(input.name),
          email: normalizeString(input.email),
        },
      ],
      updatedAt: serverTimestamp(),
    });
  },

  async createTeam(input: CreatePulseCheckTeamInput): Promise<string> {
    const payload = {
      organizationId: normalizeString(input.organizationId),
      displayName: normalizeString(input.displayName),
      teamType: normalizeString(input.teamType),
      sportOrProgram: normalizeString(input.sportOrProgram),
      legacySource: input.legacySource || null,
      legacyCoachId: normalizeString(input.legacyCoachId),
      siteLabel: normalizeString(input.siteLabel),
      defaultAdminName: normalizeString(input.defaultAdminName),
      defaultAdminEmail: normalizeString(input.defaultAdminEmail),
      status: input.status || 'provisioning',
      defaultInvitePolicy: input.defaultInvitePolicy,
      defaultClinicianProfileId: normalizeString(input.defaultClinicianProfileId),
      defaultClinicianExternalProfileId: normalizeString(input.defaultClinicianExternalProfileId),
      defaultClinicianProfileName: normalizeString(input.defaultClinicianProfileName),
      defaultClinicianProfileType: input.defaultClinicianProfileType || 'group',
      defaultClinicianProfileSource: input.defaultClinicianProfileSource || 'pulsecheck-local',
      notes: normalizeString(input.notes),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    const docRef = await addDoc(collection(db, TEAMS_COLLECTION), payload);
    return docRef.id;
  },

  async createPilot(input: CreatePulseCheckPilotInput): Promise<string> {
    const payload = {
      organizationId: normalizeString(input.organizationId),
      teamId: normalizeString(input.teamId),
      name: normalizeString(input.name),
      objective: normalizeString(input.objective),
      status: input.status || 'draft',
      studyMode: input.studyMode,
      ownerInternalUserId: normalizeString(input.ownerInternalUserId),
      ownerInternalEmail: normalizeString(input.ownerInternalEmail),
      checkpointCadence: normalizeString(input.checkpointCadence),
      startAt: input.startAt || null,
      endAt: input.endAt || null,
      notes: normalizeString(input.notes),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    const docRef = await addDoc(collection(db, PILOTS_COLLECTION), payload);
    return docRef.id;
  },

  async createPilotCohort(input: CreatePulseCheckPilotCohortInput): Promise<string> {
    const payload = {
      organizationId: normalizeString(input.organizationId),
      teamId: normalizeString(input.teamId),
      pilotId: normalizeString(input.pilotId),
      name: normalizeString(input.name),
      cohortType: normalizeString(input.cohortType),
      assignmentRule: normalizeString(input.assignmentRule),
      reportingTags: (input.reportingTags || []).map((tag) => normalizeString(tag)).filter(Boolean),
      status: input.status || 'draft',
      notes: normalizeString(input.notes),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    const docRef = await addDoc(collection(db, PILOT_COHORTS_COLLECTION), payload);
    return docRef.id;
  },

  async createAdminActivationLink(input: {
    organizationId: string;
    teamId: string;
    targetEmail?: string;
    createdByUserId?: string;
    createdByEmail?: string;
  }): Promise<string> {
    const token = crypto.randomUUID();
    const baseUrl =
      typeof window !== 'undefined'
        ? window.location.origin
        : process.env.NEXT_PUBLIC_SITE_URL || 'https://fitwithpulse.ai';
    const activationUrl = `${baseUrl}/PulseCheck/admin-activation/${token}${shouldStampDevFirebaseLinks() ? '?devFirebase=1' : ''}`;

    const payload = {
      inviteType: 'admin-activation',
      status: 'active',
      organizationId: normalizeString(input.organizationId),
      teamId: normalizeString(input.teamId),
      targetEmail: normalizeString(input.targetEmail),
      token,
      activationUrl,
      createdByUserId: normalizeString(input.createdByUserId),
      createdByEmail: normalizeString(input.createdByEmail),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    const existingActiveLinks = await getDocs(collection(db, INVITE_LINKS_COLLECTION));
    const linksToRevoke = existingActiveLinks.docs.filter((snapshot) => {
      const link = snapshot.data() as Record<string, any>;
      return (
        (link.teamId || '') === normalizeString(input.teamId) &&
        (link.inviteType || '') === 'admin-activation' &&
        (link.targetEmail || '') === normalizeString(input.targetEmail) &&
        (link.status || '') === 'active'
      );
    });

    await Promise.all(
      linksToRevoke.map((snapshot) =>
        updateDoc(snapshot.ref, {
          status: 'revoked',
          updatedAt: serverTimestamp(),
        })
      )
    );

    const inviteDocRef = doc(db, INVITE_LINKS_COLLECTION, token);
    await setDoc(inviteDocRef, payload);

    await Promise.all([
      updateDoc(doc(db, ORGANIZATIONS_COLLECTION, input.organizationId), {
        status: 'ready-for-activation',
        updatedAt: serverTimestamp(),
      }),
      updateDoc(doc(db, TEAMS_COLLECTION, input.teamId), {
        status: 'ready-for-activation',
        updatedAt: serverTimestamp(),
      }),
    ]);

    return inviteDocRef.id;
  },

  async createClinicianOnboardingLink(input: {
    organizationId: string;
    teamId: string;
    clinicianProfileId: string;
    targetEmail?: string;
    createdByUserId?: string;
    createdByEmail?: string;
  }): Promise<string> {
    const token = crypto.randomUUID();
    const baseUrl =
      typeof window !== 'undefined'
        ? window.location.origin
        : process.env.NEXT_PUBLIC_SITE_URL || 'https://fitwithpulse.ai';
    const activationUrl = `${baseUrl}/PulseCheck/clinician-onboarding/${token}${shouldStampDevFirebaseLinks() ? '?devFirebase=1' : ''}`;

    const payload = {
      inviteType: 'clinician-onboarding',
      status: 'active',
      organizationId: normalizeString(input.organizationId),
      teamId: normalizeString(input.teamId),
      clinicianProfileId: normalizeString(input.clinicianProfileId),
      targetEmail: normalizeString(input.targetEmail),
      token,
      activationUrl,
      createdByUserId: normalizeString(input.createdByUserId),
      createdByEmail: normalizeString(input.createdByEmail),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    const existingActiveLinks = await getDocs(collection(db, INVITE_LINKS_COLLECTION));
    const linksToRevoke = existingActiveLinks.docs.filter((snapshot) => {
      const link = snapshot.data() as Record<string, any>;
      return (
        (link.teamId || '') === normalizeString(input.teamId) &&
        (link.clinicianProfileId || '') === normalizeString(input.clinicianProfileId) &&
        (link.inviteType || '') === 'clinician-onboarding' &&
        (link.status || '') === 'active'
      );
    });

    await Promise.all(
      linksToRevoke.map((snapshot) =>
        updateDoc(snapshot.ref, {
          status: 'revoked',
          updatedAt: serverTimestamp(),
        })
      )
    );

    const inviteDocRef = doc(db, INVITE_LINKS_COLLECTION, token);
    await setDoc(inviteDocRef, payload);

    return inviteDocRef.id;
  },

  async createTeamAccessInviteLink(input: CreatePulseCheckTeamAccessInviteInput): Promise<string> {
    const token = crypto.randomUUID();
    const normalizedTeamId = normalizeString(input.teamId);
    const normalizedRole = input.teamMembershipRole;
    const normalizedTargetEmail = normalizeEmail(input.targetEmail);
    const normalizedPilotId = normalizeString(input.pilotId);
    const normalizedCohortId = normalizeString(input.cohortId);
    const baseUrl =
      typeof window !== 'undefined'
        ? window.location.origin
        : process.env.NEXT_PUBLIC_SITE_URL || 'https://fitwithpulse.ai';
    const activationUrl = `${baseUrl}/PulseCheck/team-invite/${token}${shouldStampDevFirebaseLinks() ? '?devFirebase=1' : ''}`;

    const existingActiveLinks = await getDocs(collection(db, INVITE_LINKS_COLLECTION));
    const linksToRevoke = existingActiveLinks.docs.filter((snapshot) => {
      const link = snapshot.data() as Record<string, any>;
      return (
        (link.teamId || '') === normalizedTeamId &&
        (link.teamMembershipRole || '') === normalizedRole &&
        normalizeEmail(link.targetEmail || '') === normalizedTargetEmail &&
        (link.pilotId || '') === normalizedPilotId &&
        (link.cohortId || '') === normalizedCohortId &&
        (link.inviteType || '') === 'team-access' &&
        (link.status || '') === 'active'
      );
    });

    await Promise.all(
      linksToRevoke.map((snapshot) =>
        updateDoc(snapshot.ref, {
          status: 'revoked',
          updatedAt: serverTimestamp(),
        })
      )
    );

    const payload = {
      inviteType: 'team-access',
      status: 'active',
      organizationId: normalizeString(input.organizationId),
      teamId: normalizedTeamId,
      pilotId: normalizedPilotId,
      pilotName: normalizeString(input.pilotName),
      cohortId: normalizedCohortId,
      cohortName: normalizeString(input.cohortName),
      teamMembershipRole: normalizedRole,
      targetEmail: normalizedTargetEmail,
      recipientName: normalizeString(input.recipientName),
      invitedTitle: normalizeString(input.invitedTitle),
      token,
      activationUrl,
      createdByUserId: normalizeString(input.createdByUserId),
      createdByEmail: normalizeString(input.createdByEmail),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    const inviteDocRef = doc(db, INVITE_LINKS_COLLECTION, token);
    await setDoc(inviteDocRef, payload);
    return inviteDocRef.id;
  },

  async savePostActivationSetup(input: SavePulseCheckPostActivationSetupInput): Promise<void> {
    const membershipRef = doc(db, TEAM_MEMBERSHIPS_COLLECTION, normalizeString(input.teamMembershipId));
    await updateDoc(membershipRef, {
      title: normalizeString(input.title),
      operatingRole: input.operatingRole,
      notificationPreferences: {
        ...defaultNotificationPreferences(),
        ...(input.notificationPreferences || {}),
      },
      onboardingStatus: 'profile-complete',
      postActivationCompletedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  },

  async saveAdultMemberSetup(input: SavePulseCheckAdultMemberSetupInput): Promise<void> {
    const membershipRef = doc(db, TEAM_MEMBERSHIPS_COLLECTION, normalizeString(input.teamMembershipId));
    await updateDoc(membershipRef, {
      title: normalizeString(input.title),
      notificationPreferences: {
        ...defaultNotificationPreferences(),
        ...(input.notificationPreferences || {}),
      },
      onboardingStatus: 'complete',
      updatedAt: serverTimestamp(),
    });
  },

  async completeAthleteOnboarding(input: CompletePulseCheckAthleteOnboardingInput): Promise<void> {
    const membershipRef = doc(db, TEAM_MEMBERSHIPS_COLLECTION, normalizeString(input.teamMembershipId));
    const membershipSnap = await getDoc(membershipRef);
    const currentData = membershipSnap.exists() ? (membershipSnap.data() as Record<string, any>) : {};
    const currentAthleteOnboarding = (currentData.athleteOnboarding || {}) as Record<string, any>;
    const nextResearchConsentStatus = input.researchConsentStatus || currentAthleteOnboarding.researchConsentStatus || 'not-required';
    const nextEligibleForDataset = nextResearchConsentStatus === 'accepted';
    const pilotId = normalizeString(currentAthleteOnboarding.targetPilotId);
    const userId = normalizeString(currentData.userId);
    const pilotSnap = pilotId ? await getDoc(doc(db, PILOTS_COLLECTION, pilotId)) : null;
    const pilotStudyMode = pilotSnap?.exists() ? ((pilotSnap.data()?.studyMode as PulseCheckPilotStudyMode) || 'operational') : null;
    const pilotEnrollmentRef = pilotId && userId
      ? doc(db, PILOT_ENROLLMENTS_COLLECTION, buildPilotEnrollmentId(pilotId, userId))
      : null;
    const existingPilotEnrollmentSnap = pilotEnrollmentRef ? await getDoc(pilotEnrollmentRef) : null;
    const existingPilotEnrollment = existingPilotEnrollmentSnap?.exists()
      ? (existingPilotEnrollmentSnap.data() as Record<string, any>)
      : {};
    await updateDoc(membershipRef, {
      athleteOnboarding: {
        ...defaultAthleteOnboardingState(),
        ...currentAthleteOnboarding,
        productConsentAccepted: true,
        productConsentAcceptedAt: serverTimestamp(),
        productConsentVersion: normalizeString(input.consentVersion),
        researchConsentStatus: nextResearchConsentStatus,
        researchConsentVersion:
          nextResearchConsentStatus === 'accepted' || nextResearchConsentStatus === 'declined'
            ? normalizeString(input.researchConsentVersion)
            : normalizeString(currentAthleteOnboarding.researchConsentVersion),
        researchConsentRespondedAt:
          nextResearchConsentStatus === 'accepted' || nextResearchConsentStatus === 'declined'
            ? serverTimestamp()
            : currentAthleteOnboarding.researchConsentRespondedAt || null,
        eligibleForResearchDataset: nextEligibleForDataset,
        enrollmentMode:
          nextResearchConsentStatus === 'accepted'
            ? 'research'
            : currentAthleteOnboarding.targetPilotId
              ? 'pilot'
              : currentAthleteOnboarding.enrollmentMode || 'product-only',
        entryOnboardingStep: 'complete',
        baselinePathStatus: 'ready',
        baselinePathwayId: normalizeString(input.baselinePathwayId),
      },
      onboardingStatus: 'complete',
      updatedAt: serverTimestamp(),
    });

    if (pilotId && userId && pilotEnrollmentRef) {
      await setDoc(
        pilotEnrollmentRef,
        {
          organizationId: normalizeString(currentData.organizationId),
          teamId: normalizeString(currentData.teamId),
          pilotId,
          cohortId: normalizeString(currentAthleteOnboarding.targetCohortId),
          userId,
          teamMembershipId: normalizeString(input.teamMembershipId),
          studyMode: pilotStudyMode || 'operational',
          enrollmentMode: nextResearchConsentStatus === 'accepted' ? 'research' : 'pilot',
          status: 'active',
          productConsentAccepted: true,
          productConsentAcceptedAt: serverTimestamp(),
          productConsentVersion: normalizeString(input.consentVersion),
          researchConsentStatus: nextResearchConsentStatus,
          researchConsentVersion:
            nextResearchConsentStatus === 'accepted' || nextResearchConsentStatus === 'declined'
              ? normalizeString(input.researchConsentVersion)
              : normalizeString(existingPilotEnrollment.researchConsentVersion),
          researchConsentRespondedAt:
            nextResearchConsentStatus === 'accepted' || nextResearchConsentStatus === 'declined'
              ? serverTimestamp()
              : existingPilotEnrollment.researchConsentRespondedAt || null,
          eligibleForResearchDataset: nextEligibleForDataset,
          grantedByInviteToken: normalizeString(existingPilotEnrollment.grantedByInviteToken || currentData.grantedByInviteToken),
          createdAt: existingPilotEnrollment.createdAt || serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    }
  },

  async saveAthleteOnboardingProgress(input: SavePulseCheckAthleteOnboardingProgressInput): Promise<void> {
    const membershipRef = doc(db, TEAM_MEMBERSHIPS_COLLECTION, normalizeString(input.teamMembershipId));
    const membershipSnap = await getDoc(membershipRef);
    const currentData = membershipSnap.exists() ? (membershipSnap.data() as Record<string, any>) : {};
    const currentAthleteOnboarding = (currentData.athleteOnboarding || {}) as Record<string, any>;
    const nextResearchConsentStatus = input.researchConsentStatus || currentAthleteOnboarding.researchConsentStatus || 'not-required';
    const pilotId = normalizeString(currentAthleteOnboarding.targetPilotId);
    const userId = normalizeString(currentData.userId);
    const pilotSnap = pilotId ? await getDoc(doc(db, PILOTS_COLLECTION, pilotId)) : null;
    const pilotStudyMode = pilotSnap?.exists() ? ((pilotSnap.data()?.studyMode as PulseCheckPilotStudyMode) || 'operational') : null;
    const pilotEnrollmentRef = pilotId && userId
      ? doc(db, PILOT_ENROLLMENTS_COLLECTION, buildPilotEnrollmentId(pilotId, userId))
      : null;
    const existingPilotEnrollmentSnap = pilotEnrollmentRef ? await getDoc(pilotEnrollmentRef) : null;
    const existingPilotEnrollment = existingPilotEnrollmentSnap?.exists()
      ? (existingPilotEnrollmentSnap.data() as Record<string, any>)
      : {};

    await updateDoc(membershipRef, {
      athleteOnboarding: {
        ...defaultAthleteOnboardingState(),
        ...currentAthleteOnboarding,
        entryOnboardingStep: input.entryOnboardingStep,
        ...(typeof input.entryOnboardingName === 'string'
          ? { entryOnboardingName: normalizeString(input.entryOnboardingName) }
          : {}),
        ...(typeof input.productConsentAccepted === 'boolean'
          ? { productConsentAccepted: input.productConsentAccepted }
          : {}),
        ...(typeof input.researchConsentStatus === 'string'
          ? {
              researchConsentStatus: nextResearchConsentStatus,
              researchConsentRespondedAt:
                nextResearchConsentStatus === 'accepted' || nextResearchConsentStatus === 'declined'
                  ? serverTimestamp()
                  : currentAthleteOnboarding.researchConsentRespondedAt || null,
              eligibleForResearchDataset: nextResearchConsentStatus === 'accepted',
              enrollmentMode:
                nextResearchConsentStatus === 'accepted'
                  ? 'research'
                  : currentAthleteOnboarding.targetPilotId
                    ? 'pilot'
                    : currentAthleteOnboarding.enrollmentMode || 'product-only',
            }
          : {}),
      },
      onboardingStatus: input.entryOnboardingStep === 'complete' ? 'complete' : 'pending',
      updatedAt: serverTimestamp(),
    });

    if (pilotId && userId && pilotEnrollmentRef) {
      await setDoc(
        pilotEnrollmentRef,
        {
          organizationId: normalizeString(currentData.organizationId),
          teamId: normalizeString(currentData.teamId),
          pilotId,
          cohortId: normalizeString(currentAthleteOnboarding.targetCohortId),
          userId,
          teamMembershipId: normalizeString(input.teamMembershipId),
          studyMode: pilotStudyMode || 'operational',
          enrollmentMode:
            nextResearchConsentStatus === 'accepted'
              ? 'research'
              : currentAthleteOnboarding.targetPilotId
                ? 'pilot'
                : 'pilot',
          researchConsentStatus: nextResearchConsentStatus,
          researchConsentVersion:
            input.researchConsentStatus && (nextResearchConsentStatus === 'accepted' || nextResearchConsentStatus === 'declined')
              ? normalizeString(currentAthleteOnboarding.researchConsentVersion)
              : normalizeString(existingPilotEnrollment.researchConsentVersion),
          researchConsentRespondedAt:
            input.researchConsentStatus && (nextResearchConsentStatus === 'accepted' || nextResearchConsentStatus === 'declined')
              ? serverTimestamp()
              : existingPilotEnrollment.researchConsentRespondedAt || currentAthleteOnboarding.researchConsentRespondedAt || null,
          eligibleForResearchDataset: nextResearchConsentStatus === 'accepted',
          status:
            input.entryOnboardingStep === 'complete' || currentData.onboardingStatus === 'complete' || existingPilotEnrollment.status === 'active'
              ? 'active'
              : 'pending-consent',
          productConsentAccepted:
            typeof input.productConsentAccepted === 'boolean'
              ? input.productConsentAccepted
              : Boolean(existingPilotEnrollment.productConsentAccepted),
          productConsentAcceptedAt: existingPilotEnrollment.productConsentAcceptedAt || null,
          productConsentVersion: normalizeString(existingPilotEnrollment.productConsentVersion),
          grantedByInviteToken: normalizeString(existingPilotEnrollment.grantedByInviteToken || currentData.grantedByInviteToken),
          createdAt: existingPilotEnrollment.createdAt || serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    }
  },

  async updateAthleteBaselineStatus(input: {
    teamMembershipId: string;
    baselinePathStatus: 'pending' | 'ready' | 'started' | 'complete';
    baselinePathwayId?: string;
  }): Promise<void> {
    const membershipRef = doc(db, TEAM_MEMBERSHIPS_COLLECTION, normalizeString(input.teamMembershipId));
    const membershipSnap = await getDoc(membershipRef);
    const currentData = membershipSnap.exists() ? (membershipSnap.data() as Record<string, any>) : {};
    const currentAthleteOnboarding = (currentData.athleteOnboarding || {}) as Record<string, any>;

    await updateDoc(membershipRef, {
      athleteOnboarding: {
        ...defaultAthleteOnboardingState(),
        ...currentAthleteOnboarding,
        baselinePathStatus: input.baselinePathStatus,
        ...(input.baselinePathwayId ? { baselinePathwayId: normalizeString(input.baselinePathwayId) } : {}),
      },
      updatedAt: serverTimestamp(),
    });
  },

  async updateTeamMembershipAccess(input: UpdatePulseCheckTeamMembershipAccessInput): Promise<void> {
    const membershipRef = doc(db, TEAM_MEMBERSHIPS_COLLECTION, normalizeString(input.teamMembershipId));
    await updateDoc(membershipRef, {
      rosterVisibilityScope: input.rosterVisibilityScope,
      allowedAthleteIds: input.rosterVisibilityScope === 'assigned' ? [...(input.allowedAthleteIds || [])] : [],
      ...(input.permissionSetId ? { permissionSetId: normalizeString(input.permissionSetId) } : {}),
      updatedAt: serverTimestamp(),
    });
  },

  async revokeInviteLink(inviteId: string): Promise<void> {
    const inviteRef = doc(db, INVITE_LINKS_COLLECTION, normalizeString(inviteId));
    await updateDoc(inviteRef, {
      status: 'revoked',
      updatedAt: serverTimestamp(),
    });
  },

  async updateTeamInvitePolicy(teamId: string, defaultInvitePolicy: PulseCheckTeam['defaultInvitePolicy']): Promise<void> {
    const teamRef = doc(db, TEAMS_COLLECTION, normalizeString(teamId));
    await updateDoc(teamRef, {
      defaultInvitePolicy,
      updatedAt: serverTimestamp(),
    });
  },

  async redeemAdminActivationInvite(token: string): Promise<RedeemPulseCheckAdminActivationResult> {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error('You must be signed in to redeem this invite.');
    }

    return withLocalRedeemFallback(
      async () => {
        const idToken = await currentUser.getIdToken();
        const response = await fetch('/api/pulsecheck/admin-activation/redeem', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({ token: normalizeString(token) }),
        });

        const payload = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(payload?.error || 'Failed to redeem admin activation invite.');
        }

        return payload as RedeemPulseCheckAdminActivationResult;
      },
      async () => {
        const userId = currentUser.uid;
        const userEmail = normalizeEmail(currentUser.email || '');
        if (!userEmail) {
          throw new Error('Authenticated user must have an email address.');
        }

        return runTransaction(db, async (transaction) => {
          const inviteRef = doc(db, INVITE_LINKS_COLLECTION, normalizeString(token));
          const inviteSnap = await transaction.get(inviteRef);
          if (!inviteSnap.exists()) {
            throw new Error('Invite not found.');
          }

          const invite = inviteSnap.data() as Record<string, any>;
          if ((invite.inviteType || '') !== 'admin-activation') {
            throw new Error('Invite type is invalid for this route.');
          }
          if ((invite.status || '') !== 'active') {
            throw new Error('Invite is no longer active.');
          }

          const targetEmail = normalizeEmail(invite.targetEmail);
          if (targetEmail && targetEmail !== userEmail) {
            throw new Error(`This invite is restricted to ${invite.targetEmail}.`);
          }

          const organizationId = normalizeString(invite.organizationId);
          const teamId = normalizeString(invite.teamId);
          if (!organizationId || !teamId) {
            throw new Error('Invite is missing organization or team context.');
          }

          const organizationRef = doc(db, ORGANIZATIONS_COLLECTION, organizationId);
          const teamRef = doc(db, TEAMS_COLLECTION, teamId);
          const organizationMembershipRef = doc(db, ORGANIZATION_MEMBERSHIPS_COLLECTION, `${organizationId}_${userId}`);
          const teamMembershipRef = doc(db, TEAM_MEMBERSHIPS_COLLECTION, `${teamId}_${userId}`);

          const [organizationSnap, teamSnap] = await Promise.all([
            transaction.get(organizationRef),
            transaction.get(teamRef),
          ]);

          if (!organizationSnap.exists()) {
            throw new Error('Organization not found.');
          }
          if (!teamSnap.exists()) {
            throw new Error('Team not found.');
          }

          const organizationData = organizationSnap.data() as Record<string, any>;
          const teamData = teamSnap.data() as Record<string, any>;
          const organizationName = normalizeString(organizationData.displayName) || 'PulseCheck Organization';
          const teamName = normalizeString(teamData.displayName) || 'Initial Team';

          transaction.set(
            organizationMembershipRef,
            {
              organizationId,
              userId,
              email: userEmail,
              role: 'org-admin',
              status: 'active',
              grantedByInviteToken: token,
              grantedAt: serverTimestamp(),
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          );

          transaction.set(
            teamMembershipRef,
            {
              organizationId,
              teamId,
              userId,
              email: userEmail,
              role: 'team-admin',
              title: 'Organization Admin',
              permissionSetId: permissionSetByRole['team-admin'],
              rosterVisibilityScope: 'team',
              allowedAthleteIds: [],
              onboardingStatus: 'pending-profile',
              grantedByInviteToken: token,
              grantedAt: serverTimestamp(),
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          );

          transaction.set(
            organizationRef,
            {
              status: 'active',
              activatedByUserId: userId,
              activatedByEmail: userEmail,
              activatedAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          );

          transaction.set(
            teamRef,
            {
              status: 'active',
              activatedByUserId: userId,
              activatedByEmail: userEmail,
              activatedAt: serverTimestamp(),
              defaultAdminUserIds: arrayUnion(userId),
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          );

          transaction.set(
            inviteRef,
            {
              status: 'redeemed',
              redeemedByUserId: userId,
              redeemedByEmail: userEmail,
              redeemedAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          );

          return {
            organizationId,
            organizationName,
            teamId,
            teamName,
            organizationMembershipId: organizationMembershipRef.id,
            teamMembershipId: teamMembershipRef.id,
          } satisfies RedeemPulseCheckAdminActivationResult;
        });
      }
    );
  },

  async redeemTeamInvite(token: string): Promise<RedeemPulseCheckTeamInviteResult> {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error('You must be signed in to redeem this invite.');
    }

    return withLocalRedeemFallback(
      async () => {
        const idToken = await currentUser.getIdToken();
        const response = await fetch('/api/pulsecheck/team-invite/redeem', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({
            token: normalizeString(token),
            forceDevFirebase: shouldStampDevFirebaseLinks(),
          }),
        });

        const payload = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(payload?.error || 'Failed to redeem team invite.');
        }

        return payload as RedeemPulseCheckTeamInviteResult;
      },
      async () => {
        const userId = currentUser.uid;
        const userEmail = normalizeEmail(currentUser.email || '');
        if (!userEmail) {
          throw new Error('Authenticated user must have an email address.');
        }

        return runTransaction(db, async (transaction) => {
          const inviteRef = doc(db, INVITE_LINKS_COLLECTION, normalizeString(token));
          const inviteSnap = await transaction.get(inviteRef);
          if (!inviteSnap.exists()) {
            throw new Error('Invite not found.');
          }

          const invite = inviteSnap.data() as Record<string, any>;
          if ((invite.inviteType || '') !== 'team-access') {
            throw new Error('Invite type is invalid for this route.');
          }
          if ((invite.status || '') !== 'active') {
            throw new Error('Invite is no longer active.');
          }

          const targetEmail = normalizeEmail(invite.targetEmail);
          if (targetEmail && targetEmail !== userEmail) {
            throw new Error(`This invite is restricted to ${invite.targetEmail}.`);
          }

          const organizationId = normalizeString(invite.organizationId);
          const teamId = normalizeString(invite.teamId);
          const pilotId = normalizeString(invite.pilotId);
          const cohortId = normalizeString(invite.cohortId);
          const teamMembershipRole = normalizeString(invite.teamMembershipRole) as PulseCheckTeamMembershipRole;
          const invitedTitle = normalizeString(invite.invitedTitle);
          if (!organizationId || !teamId || !teamMembershipRole) {
            throw new Error('Invite is missing organization, team, or role context.');
          }

          const organizationRef = doc(db, ORGANIZATIONS_COLLECTION, organizationId);
          const teamRef = doc(db, TEAMS_COLLECTION, teamId);
          const organizationMembershipRef = doc(db, ORGANIZATION_MEMBERSHIPS_COLLECTION, `${organizationId}_${userId}`);
          const teamMembershipRef = doc(db, TEAM_MEMBERSHIPS_COLLECTION, `${teamId}_${userId}`);

          const [organizationSnap, teamSnap] = await Promise.all([
            transaction.get(organizationRef),
            transaction.get(teamRef),
          ]);
          const existingTeamMembershipSnap = await transaction.get(teamMembershipRef);
          let pilotStudyMode: PulseCheckPilotStudyMode | null = null;
          let existingPilotEnrollment: Record<string, any> = {};
          if (pilotId) {
            const pilotRef = doc(db, PILOTS_COLLECTION, pilotId);
            const pilotSnap = await transaction.get(pilotRef);
            if (!pilotSnap.exists()) {
              throw new Error('Pilot not found.');
            }
            pilotStudyMode = (pilotSnap.data()?.studyMode as PulseCheckPilotStudyMode) || 'operational';

            const pilotEnrollmentRef = doc(db, PILOT_ENROLLMENTS_COLLECTION, buildPilotEnrollmentId(pilotId, userId));
            const existingPilotEnrollmentSnap = await transaction.get(pilotEnrollmentRef);
            existingPilotEnrollment = existingPilotEnrollmentSnap.exists()
              ? (existingPilotEnrollmentSnap.data() as Record<string, any>)
              : {};
          }

          if (!organizationSnap.exists()) {
            throw new Error('Organization not found.');
          }
          if (!teamSnap.exists()) {
            throw new Error('Team not found.');
          }

          const organizationData = organizationSnap.data() as Record<string, any>;
          const teamData = teamSnap.data() as Record<string, any>;
          const organizationName = normalizeString(organizationData.displayName) || 'PulseCheck Organization';
          const teamName = normalizeString(teamData.displayName) || 'Team';
          const existingTeamMembership = existingTeamMembershipSnap.exists()
            ? (existingTeamMembershipSnap.data() as Record<string, any>)
            : {};
          const nextAthleteOnboarding =
            teamMembershipRole === 'athlete'
              ? buildAthleteOnboardingFromInvite(
                  invite,
                  existingTeamMembership.athleteOnboarding as Record<string, any> | undefined,
                  pilotStudyMode
                )
              : null;

          if (teamMembershipRole === 'team-admin') {
            transaction.set(
              organizationMembershipRef,
              {
                organizationId,
                userId,
                email: userEmail,
                role: 'org-admin',
                status: 'active',
                grantedByInviteToken: token,
                grantedAt: serverTimestamp(),
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
              },
              { merge: true }
            );

            transaction.set(
              teamRef,
              {
                defaultAdminUserIds: arrayUnion(userId),
                updatedAt: serverTimestamp(),
              },
              { merge: true }
            );
          }

          transaction.set(
            teamMembershipRef,
            {
              organizationId,
              teamId,
              userId,
              email: userEmail,
              role: teamMembershipRole,
              title: invitedTitle || null,
              permissionSetId: permissionSetByRole[teamMembershipRole] || 'pulsecheck-team-member-v1',
              rosterVisibilityScope: teamMembershipRole === 'athlete' ? 'none' : 'team',
              allowedAthleteIds: [],
              athleteOnboarding: nextAthleteOnboarding,
              onboardingStatus: teamMembershipRole === 'athlete' ? 'pending-consent' : 'pending-profile',
              grantedByInviteToken: token,
              grantedAt: serverTimestamp(),
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          );

          if (teamMembershipRole === 'athlete' && pilotId && nextAthleteOnboarding) {
            const pilotEnrollmentRef = doc(db, PILOT_ENROLLMENTS_COLLECTION, buildPilotEnrollmentId(pilotId, userId));

            transaction.set(
              pilotEnrollmentRef,
              {
                organizationId,
                teamId,
                pilotId,
                cohortId,
                userId,
                teamMembershipId: teamMembershipRef.id,
                studyMode: pilotStudyMode || 'operational',
                enrollmentMode: nextAthleteOnboarding.enrollmentMode === 'research' ? 'research' : 'pilot',
                status: (existingPilotEnrollment.status as PulseCheckPilotEnrollmentStatus) || 'pending-consent',
                productConsentAccepted: Boolean(existingPilotEnrollment.productConsentAccepted),
                productConsentAcceptedAt: existingPilotEnrollment.productConsentAcceptedAt || null,
                productConsentVersion: normalizeString(existingPilotEnrollment.productConsentVersion),
                researchConsentStatus: nextAthleteOnboarding.researchConsentStatus || 'not-required',
                researchConsentVersion: normalizeString(existingPilotEnrollment.researchConsentVersion),
                researchConsentRespondedAt: existingPilotEnrollment.researchConsentRespondedAt || null,
                eligibleForResearchDataset:
                  nextAthleteOnboarding.researchConsentStatus === 'accepted'
                    ? true
                    : Boolean(existingPilotEnrollment.eligibleForResearchDataset),
                grantedByInviteToken: token,
                createdAt: existingPilotEnrollment.createdAt || serverTimestamp(),
                updatedAt: serverTimestamp(),
              },
              { merge: true }
            );
          }

          transaction.set(
            inviteRef,
            {
              status: 'redeemed',
              redeemedByUserId: userId,
              redeemedByEmail: userEmail,
              redeemedAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          );

          return {
            organizationId,
            organizationName,
            teamId,
            teamName,
            pilotId,
            cohortId,
            teamMembershipId: teamMembershipRef.id,
            teamMembershipRole,
            invitedTitle,
          } satisfies RedeemPulseCheckTeamInviteResult;
        });
      }
    );
  },
};
