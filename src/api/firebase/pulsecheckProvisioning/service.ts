import { addDoc, arrayUnion, collection, doc, getDoc, getDocs, orderBy, query, runTransaction, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore';
import { auth, db } from '../config';
import type {
  CompletePulseCheckAthleteOnboardingInput,
  CreatePulseCheckTeamAccessInviteInput,
  CreatePulseCheckOrganizationInput,
  CreatePulseCheckTeamInput,
  PulseCheckAdminContact,
  PulseCheckOrganization,
  PulseCheckAuntEdnaClinicianProfile,
  PulseCheckInviteLinkType,
  PulseCheckRosterVisibilityScope,
  PulseCheckNotificationPreferences,
  PulseCheckOrganizationStatus,
  PulseCheckTeam,
  PulseCheckTeamMembership,
  PulseCheckTeamMembershipRole,
  PulseCheckTeamStatus,
  PulseCheckInviteLink,
  PulseCheckInviteLinkStatus,
  RedeemPulseCheckAdminActivationResult,
  RedeemPulseCheckTeamInviteResult,
  SavePulseCheckAdultMemberSetupInput,
  SavePulseCheckPostActivationSetupInput,
  UpdatePulseCheckTeamMembershipAccessInput,
  UpsertPulseCheckAuntEdnaClinicianProfileInput,
} from './types';

const ORGANIZATIONS_COLLECTION = 'pulsecheck-organizations';
const TEAMS_COLLECTION = 'pulsecheck-teams';
const CLINICIAN_PROFILES_COLLECTION = 'pulsecheck-auntedna-clinician-profiles';
const INVITE_LINKS_COLLECTION = 'pulsecheck-invite-links';
const ORGANIZATION_MEMBERSHIPS_COLLECTION = 'pulsecheck-organization-memberships';
const TEAM_MEMBERSHIPS_COLLECTION = 'pulsecheck-team-memberships';

const normalizeString = (value?: string) => value?.trim() || '';
const normalizeEmail = (value?: string) => normalizeString(value).toLowerCase();
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
  researchConsentStatus: 'not-required' as const,
  eligibleForResearchDataset: false,
  enrollmentMode: 'product-only' as const,
  baselinePathStatus: 'pending' as const,
  baselinePathwayId: '',
});
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

const toInviteLink = (id: string, data: Record<string, any>): PulseCheckInviteLink => ({
  id,
  inviteType: (data.inviteType as PulseCheckInviteLinkType) || 'admin-activation',
  status: (data.status as PulseCheckInviteLinkStatus) || 'active',
  organizationId: data.organizationId || '',
  teamId: data.teamId || '',
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
        message.includes('Failed to redeem'));

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
        const leftTime = left.createdAt && 'seconds' in left.createdAt ? Number(left.createdAt.seconds) : 0;
        const rightTime = right.createdAt && 'seconds' in right.createdAt ? Number(right.createdAt.seconds) : 0;
        return rightTime - leftTime;
      });
  },

  async listUserTeamMemberships(userId: string): Promise<PulseCheckTeamMembership[]> {
    const snapshot = await getDocs(query(collection(db, TEAM_MEMBERSHIPS_COLLECTION), where('userId', '==', normalizeString(userId))));
    return snapshot.docs.map((docSnap) => toTeamMembership(docSnap.id, docSnap.data() as Record<string, any>));
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
    const activationUrl = `${baseUrl}/PulseCheck/admin-activation/${token}`;

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
    const activationUrl = `${baseUrl}/PulseCheck/clinician-onboarding/${token}`;

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
    const baseUrl =
      typeof window !== 'undefined'
        ? window.location.origin
        : process.env.NEXT_PUBLIC_SITE_URL || 'https://fitwithpulse.ai';
    const activationUrl = `${baseUrl}/PulseCheck/team-invite/${token}`;

    const existingActiveLinks = await getDocs(collection(db, INVITE_LINKS_COLLECTION));
    const linksToRevoke = existingActiveLinks.docs.filter((snapshot) => {
      const link = snapshot.data() as Record<string, any>;
      return (
        (link.teamId || '') === normalizedTeamId &&
        (link.teamMembershipRole || '') === normalizedRole &&
        normalizeEmail(link.targetEmail || '') === normalizedTargetEmail &&
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
    await updateDoc(membershipRef, {
      athleteOnboarding: {
        productConsentAccepted: true,
        productConsentAcceptedAt: serverTimestamp(),
        productConsentVersion: normalizeString(input.consentVersion),
        researchConsentStatus: 'not-required',
        eligibleForResearchDataset: false,
        enrollmentMode: 'product-only',
        baselinePathStatus: 'ready',
        baselinePathwayId: normalizeString(input.baselinePathwayId),
      },
      onboardingStatus: 'complete',
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
          body: JSON.stringify({ token: normalizeString(token) }),
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
              athleteOnboarding:
                teamMembershipRole === 'athlete'
                  ? defaultAthleteOnboardingState()
                  : null,
              onboardingStatus: teamMembershipRole === 'athlete' ? 'pending-consent' : 'pending-profile',
              grantedByInviteToken: token,
              grantedAt: serverTimestamp(),
              createdAt: serverTimestamp(),
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
            teamMembershipId: teamMembershipRef.id,
            teamMembershipRole,
            invitedTitle,
          } satisfies RedeemPulseCheckTeamInviteResult;
        });
      }
    );
  },
};
