import type { Timestamp } from 'firebase/firestore';

export type PulseCheckOrganizationStatus = 'draft' | 'provisioning' | 'ready-for-activation' | 'active' | 'archived' | 'implementation-hold';
export type PulseCheckTeamStatus = 'draft' | 'provisioning' | 'ready-for-activation' | 'active' | 'paused' | 'archived';
export type PulseCheckStudyPosture = 'operational' | 'pilot' | 'research-eligible';
export type PulseCheckPilotStatus = 'draft' | 'active' | 'paused' | 'completed' | 'archived';
export type PulseCheckPilotStudyMode = 'operational' | 'pilot' | 'research';
export type PulseCheckPilotCohortStatus = 'draft' | 'active' | 'paused' | 'archived';
export type PulseCheckPilotEnrollmentStatus = 'pending-consent' | 'active' | 'withdrawn';
export type PulseCheckClinicianBridgeMode = 'none' | 'optional' | 'required';
export type PulseCheckInvitePolicy = 'admin-only' | 'admin-and-staff' | 'admin-staff-and-coaches';
export type PulseCheckClinicianProfileType = 'individual' | 'group' | 'provider';
export type PulseCheckClinicianProfileSource = 'pulsecheck-local' | 'auntedna';
export type PulseCheckClinicianProfileSyncStatus = 'pending-sync' | 'synced' | 'sync-failed';
export type PulseCheckInviteLinkStatus = 'active' | 'redeemed' | 'revoked';
export type PulseCheckInviteLinkType = 'admin-activation' | 'clinician-onboarding' | 'team-access';
export type PulseCheckOrganizationMembershipRole = 'org-admin' | 'implementation-observer';
export type PulseCheckOperatingRole = 'admin-only' | 'admin-plus-coach' | 'admin-plus-support-staff';
export type PulseCheckRosterVisibilityScope = 'team' | 'assigned' | 'none';
export type PulseCheckAthleteEntryOnboardingStep = 'name' | 'consent' | 'research-consent' | 'starting-point' | 'complete';
export type PulseCheckResearchConsentStatus = 'not-required' | 'pending' | 'accepted' | 'declined';
export type PulseCheckTeamCommercialModel = 'athlete-pay' | 'team-plan';
export type PulseCheckTeamPlanStatus = 'inactive' | 'active';
export type PulseCheckRevenueRecipientRole = 'team-admin' | 'coach' | 'organization-owner';
export type PulseCheckTeamMembershipRole =
  | 'team-admin'
  | 'coach'
  | 'performance-staff'
  | 'support-staff'
  | 'clinician'
  | 'athlete';

export interface PulseCheckTeamCommercialConfig {
  commercialModel: PulseCheckTeamCommercialModel;
  teamPlanStatus: PulseCheckTeamPlanStatus;
  referralKickbackEnabled: boolean;
  referralRevenueSharePct: number;
  revenueRecipientRole: PulseCheckRevenueRecipientRole;
  revenueRecipientUserId?: string;
  billingOwnerUserId?: string;
  billingCustomerId?: string;
  teamPlanActivatedAt?: Timestamp | null;
  teamPlanExpiresAt?: Timestamp | null;
}

export interface PulseCheckTeamCommercialSnapshot extends PulseCheckTeamCommercialConfig {
  sourceOrganizationId: string;
  sourceTeamId: string;
  inviteToken?: string;
  teamPlanBypassesPaywall: boolean;
}

export const getDefaultPulseCheckTeamCommercialConfig = (): PulseCheckTeamCommercialConfig => ({
  commercialModel: 'athlete-pay',
  teamPlanStatus: 'inactive',
  referralKickbackEnabled: false,
  referralRevenueSharePct: 0,
  revenueRecipientRole: 'team-admin',
  revenueRecipientUserId: '',
  billingOwnerUserId: '',
  billingCustomerId: '',
  teamPlanActivatedAt: null,
  teamPlanExpiresAt: null,
});

export const derivePulseCheckTeamPlanBypass = (
  commercialConfig?: Partial<PulseCheckTeamCommercialConfig> | null
): boolean => commercialConfig?.commercialModel === 'team-plan' && commercialConfig?.teamPlanStatus === 'active';

export interface PulseCheckNotificationPreferences {
  email: boolean;
  sms: boolean;
  push: boolean;
  weeklyDigest: boolean;
}

export interface PulseCheckRequiredConsentDocument {
  id: string;
  title: string;
  body: string;
  version: string;
}

const DEFAULT_PULSECHECK_REQUIRED_CONSENTS: PulseCheckRequiredConsentDocument[] = [
  {
    id: 'pulsecheck-team-participation-v1',
    title: 'PulseCheck Team Participation',
    body:
      [
        'Your coaching staff invited you into PulseCheck so they can support you more clearly across training.',
        'When you join, PulseCheck may share the check-ins you complete, the readiness trends you create, and the session activity you log with the staff who support your team.',
        'That helps your staff notice patterns, follow up with you, and keep your support connected to what is actually happening in training.',
        'Read this through, and if anything feels unclear, ask your staff before you agree.',
      ].join('\n\n'),
    version: 'v1',
  },
  {
    id: 'pulsecheck-data-privacy-v1',
    title: 'PulseCheck Privacy and Data Use',
    body:
      [
        'PulseCheck uses the information you share in the app, plus any health or wearable connections you approve, to run your team experience.',
        'That can include things like your check-ins, recovery trends, readiness signals, session activity, and the information you choose to connect.',
        'We use that information to support your experience in PulseCheck and the permissions you approve here.',
        'If you want a copy for your records, you can save this agreement as a PDF before you continue.',
      ].join('\n\n'),
    version: 'v1',
  },
];

export const getDefaultPulseCheckRequiredConsents = (): PulseCheckRequiredConsentDocument[] =>
  DEFAULT_PULSECHECK_REQUIRED_CONSENTS.map((consent) => ({ ...consent }));

export const mergePulseCheckRequiredConsents = (
  customConsents?: PulseCheckRequiredConsentDocument[] | null
): PulseCheckRequiredConsentDocument[] => {
  const merged = new Map<string, PulseCheckRequiredConsentDocument>();

  getDefaultPulseCheckRequiredConsents().forEach((consent) => {
    merged.set(consent.id, consent);
  });

  (customConsents || []).forEach((consent) => {
    merged.set(consent.id, consent);
  });

  return Array.from(merged.values());
};

export interface PulseCheckAthleteOnboardingState {
  productConsentAccepted: boolean;
  productConsentAcceptedAt?: Timestamp | null;
  productConsentVersion?: string;
  entryOnboardingStep?: PulseCheckAthleteEntryOnboardingStep;
  entryOnboardingName?: string;
  researchConsentStatus?: PulseCheckResearchConsentStatus;
  researchConsentVersion?: string;
  researchConsentRespondedAt?: Timestamp | null;
  eligibleForResearchDataset?: boolean;
  enrollmentMode?: 'product-only' | 'pilot' | 'research';
  targetPilotId?: string;
  targetPilotName?: string;
  targetCohortId?: string;
  targetCohortName?: string;
  requiredConsents?: PulseCheckRequiredConsentDocument[];
  completedConsentIds?: string[];
  baselinePathStatus?: 'pending' | 'ready' | 'started' | 'complete';
  baselinePathwayId?: string;
}

export interface PulseCheckAdminContact {
  name?: string;
  email: string;
}

export interface PulseCheckOrganization {
  id: string;
  displayName: string;
  legalName: string;
  organizationType: string;
  invitePreviewImageUrl?: string;
  status: PulseCheckOrganizationStatus;
  legacySource?: 'legacy-coach-roster';
  legacyCoachId?: string;
  implementationOwnerUserId?: string;
  implementationOwnerEmail?: string;
  primaryCustomerAdminName?: string;
  primaryCustomerAdminEmail?: string;
  additionalAdminContacts?: PulseCheckAdminContact[];
  defaultStudyPosture: PulseCheckStudyPosture;
  defaultClinicianBridgeMode: PulseCheckClinicianBridgeMode;
  notes?: string;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export interface CreatePulseCheckOrganizationInput {
  displayName: string;
  legalName: string;
  organizationType: string;
  invitePreviewImageUrl?: string;
  status?: PulseCheckOrganizationStatus;
  legacySource?: 'legacy-coach-roster';
  legacyCoachId?: string;
  implementationOwnerUserId?: string;
  implementationOwnerEmail?: string;
  primaryCustomerAdminName?: string;
  primaryCustomerAdminEmail?: string;
  additionalAdminContacts?: PulseCheckAdminContact[];
  defaultStudyPosture: PulseCheckStudyPosture;
  defaultClinicianBridgeMode: PulseCheckClinicianBridgeMode;
  notes?: string;
}

export interface PulseCheckTeam {
  id: string;
  organizationId: string;
  displayName: string;
  teamType: string;
  sportOrProgram: string;
  invitePreviewImageUrl?: string;
  legacySource?: 'legacy-coach-roster';
  legacyCoachId?: string;
  siteLabel?: string;
  defaultAdminName?: string;
  defaultAdminEmail?: string;
  status: PulseCheckTeamStatus;
  defaultInvitePolicy: PulseCheckInvitePolicy;
  commercialConfig: PulseCheckTeamCommercialConfig;
  defaultClinicianProfileId?: string;
  defaultClinicianExternalProfileId?: string;
  defaultClinicianProfileName?: string;
  defaultClinicianProfileType?: PulseCheckClinicianProfileType;
  defaultClinicianProfileSource?: PulseCheckClinicianProfileSource;
  notes?: string;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export interface CreatePulseCheckTeamInput {
  organizationId: string;
  displayName: string;
  teamType: string;
  sportOrProgram: string;
  invitePreviewImageUrl?: string;
  legacySource?: 'legacy-coach-roster';
  legacyCoachId?: string;
  siteLabel?: string;
  defaultAdminName?: string;
  defaultAdminEmail?: string;
  status?: PulseCheckTeamStatus;
  defaultInvitePolicy: PulseCheckInvitePolicy;
  commercialConfig: PulseCheckTeamCommercialConfig;
  defaultClinicianProfileId?: string;
  defaultClinicianExternalProfileId?: string;
  defaultClinicianProfileName?: string;
  defaultClinicianProfileType?: PulseCheckClinicianProfileType;
  defaultClinicianProfileSource?: PulseCheckClinicianProfileSource;
  notes?: string;
}

export interface PulseCheckPilot {
  id: string;
  organizationId: string;
  teamId: string;
  name: string;
  objective?: string;
  status: PulseCheckPilotStatus;
  studyMode: PulseCheckPilotStudyMode;
  ownerInternalUserId?: string;
  ownerInternalEmail?: string;
  checkpointCadence?: string;
  startAt?: Timestamp | null;
  endAt?: Timestamp | null;
  requiredConsents?: PulseCheckRequiredConsentDocument[];
  notes?: string;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export interface CreatePulseCheckPilotInput {
  organizationId: string;
  teamId: string;
  name: string;
  objective?: string;
  status?: PulseCheckPilotStatus;
  studyMode: PulseCheckPilotStudyMode;
  ownerInternalUserId?: string;
  ownerInternalEmail?: string;
  checkpointCadence?: string;
  startAt?: Timestamp | Date | null;
  endAt?: Timestamp | Date | null;
  requiredConsents?: PulseCheckRequiredConsentDocument[];
  notes?: string;
}

export interface PulseCheckPilotCohort {
  id: string;
  organizationId: string;
  teamId: string;
  pilotId: string;
  name: string;
  cohortType?: string;
  assignmentRule?: string;
  reportingTags?: string[];
  status: PulseCheckPilotCohortStatus;
  notes?: string;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export interface PulseCheckPilotEnrollment {
  id: string;
  organizationId: string;
  teamId: string;
  pilotId: string;
  cohortId?: string;
  userId: string;
  teamMembershipId: string;
  studyMode: PulseCheckPilotStudyMode;
  enrollmentMode: 'pilot' | 'research';
  status: PulseCheckPilotEnrollmentStatus;
  productConsentAccepted: boolean;
  productConsentAcceptedAt?: Timestamp | null;
  productConsentVersion?: string;
  researchConsentStatus: PulseCheckResearchConsentStatus;
  researchConsentVersion?: string;
  researchConsentRespondedAt?: Timestamp | null;
  requiredConsentIds?: string[];
  completedConsentIds?: string[];
  eligibleForResearchDataset: boolean;
  grantedByInviteToken?: string;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export interface CreatePulseCheckPilotCohortInput {
  organizationId: string;
  teamId: string;
  pilotId: string;
  name: string;
  cohortType?: string;
  assignmentRule?: string;
  reportingTags?: string[];
  status?: PulseCheckPilotCohortStatus;
  notes?: string;
}

export interface PulseCheckAuntEdnaClinicianProfile {
  id: string;
  externalProfileId?: string;
  auntEdnaProfileId?: string;
  displayName: string;
  organizationName?: string;
  email?: string;
  profileType: PulseCheckClinicianProfileType;
  source: PulseCheckClinicianProfileSource;
  syncStatus: PulseCheckClinicianProfileSyncStatus;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export interface UpsertPulseCheckAuntEdnaClinicianProfileInput {
  externalProfileId?: string;
  auntEdnaProfileId?: string;
  displayName: string;
  organizationName?: string;
  email?: string;
  profileType: PulseCheckClinicianProfileType;
  source?: PulseCheckClinicianProfileSource;
  syncStatus?: PulseCheckClinicianProfileSyncStatus;
}

export interface PulseCheckAthleteClinicianOverride {
  id: string;
  teamId: string;
  athleteId: string;
  clinicianProfileId: string;
  clinicianProfileName: string;
  clinicianProfileType: PulseCheckClinicianProfileType;
  source: 'auntedna';
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export interface PulseCheckInviteLink {
  id: string;
  inviteType: PulseCheckInviteLinkType;
  status: PulseCheckInviteLinkStatus;
  organizationId: string;
  teamId: string;
  pilotId?: string;
  pilotName?: string;
  cohortId?: string;
  cohortName?: string;
  clinicianProfileId?: string;
  teamMembershipRole?: PulseCheckTeamMembershipRole;
  invitedTitle?: string;
  recipientName?: string;
  targetEmail?: string;
  commercialSnapshot?: PulseCheckTeamCommercialSnapshot;
  token: string;
  activationUrl: string;
  createdByUserId?: string;
  createdByEmail?: string;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
  redeemedByUserId?: string;
  redeemedByEmail?: string;
  redeemedAt?: Timestamp | null;
}

export interface PulseCheckOrganizationMembership {
  id: string;
  organizationId: string;
  userId: string;
  email?: string;
  role: PulseCheckOrganizationMembershipRole;
  status: 'active';
  grantedByInviteToken?: string;
  grantedAt?: Timestamp | null;
  commercialAccess?: PulseCheckTeamCommercialSnapshot;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export interface PulseCheckTeamMembership {
  id: string;
  organizationId: string;
  teamId: string;
  userId: string;
  email?: string;
  legacySource?: 'coach-athletes';
  legacyCoachId?: string;
  legacyConnectionId?: string;
  legacyLinkedAt?: Timestamp | null;
  role: PulseCheckTeamMembershipRole;
  title?: string;
  permissionSetId?: string;
  operatingRole?: PulseCheckOperatingRole;
  rosterVisibilityScope?: PulseCheckRosterVisibilityScope;
  allowedAthleteIds?: string[];
  notificationPreferences?: PulseCheckNotificationPreferences;
  athleteOnboarding?: PulseCheckAthleteOnboardingState;
  onboardingStatus?: 'pending' | 'pending-profile' | 'profile-complete' | 'pending-consent' | 'complete';
  postActivationCompletedAt?: Timestamp | null;
  grantedByInviteToken?: string;
  grantedAt?: Timestamp | null;
  commercialAccess?: PulseCheckTeamCommercialSnapshot;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export interface PulseCheckLegacyCoachRosterAthlete {
  legacyConnectionId: string;
  athleteUserId: string;
  athleteDisplayName: string;
  athleteEmail?: string;
  linkedAt?: Timestamp | Date | null;
  updatedAt?: Timestamp | Date | null;
  alreadyOnTargetTeam: boolean;
}

export interface PulseCheckLegacyCoachRosterCandidate {
  coachId: string;
  coachDisplayName: string;
  coachEmail?: string;
  coachReferralCode?: string;
  athleteCount: number;
  athletes: PulseCheckLegacyCoachRosterAthlete[];
  existingOrganizationId?: string;
  existingOrganizationName?: string;
  existingTeamId?: string;
  existingTeamName?: string;
  existingTeamMembershipRole?: PulseCheckTeamMembershipRole;
}

export interface MigrateLegacyCoachRosterInput {
  coachId: string;
  organizationName?: string;
  teamName?: string;
}

export interface PulseCheckLegacyCoachRosterMigrationResult {
  migrationId: string;
  coachId: string;
  coachDisplayName: string;
  organizationId: string;
  organizationName: string;
  teamId: string;
  teamName: string;
  createdOrganization: boolean;
  createdTeam: boolean;
  migratedAthleteCount: number;
  alreadyPresentAthleteCount: number;
  retiredLegacyConnectionCount: number;
  unresolvedLegacyConnectionCount: number;
}

export interface RedeemPulseCheckAdminActivationResult {
  organizationId: string;
  organizationName: string;
  teamId: string;
  teamName: string;
  organizationMembershipId: string;
  teamMembershipId: string;
}

export interface CreatePulseCheckTeamAccessInviteInput {
  organizationId: string;
  teamId: string;
  teamMembershipRole: PulseCheckTeamMembershipRole;
  revokeExistingMatchingLinks?: boolean;
  pilotId?: string;
  cohortId?: string;
  pilotName?: string;
  cohortName?: string;
  targetEmail?: string;
  recipientName?: string;
  invitedTitle?: string;
  createdByUserId?: string;
  createdByEmail?: string;
}

export interface SavePulseCheckPostActivationSetupInput {
  organizationId: string;
  teamId: string;
  teamMembershipId: string;
  displayName: string;
  title: string;
  operatingRole: PulseCheckOperatingRole;
  notificationPreferences: PulseCheckNotificationPreferences;
  profileImageUrl?: string;
}

export interface SavePulseCheckAdultMemberSetupInput {
  teamMembershipId: string;
  title: string;
  notificationPreferences: PulseCheckNotificationPreferences;
}

export interface CompletePulseCheckAthleteOnboardingInput {
  teamMembershipId: string;
  consentVersion: string;
  baselinePathwayId: string;
  completedConsentIds?: string[];
  researchConsentStatus?: PulseCheckResearchConsentStatus;
  researchConsentVersion?: string;
}

export interface SavePulseCheckAthleteOnboardingProgressInput {
  teamMembershipId: string;
  entryOnboardingStep: PulseCheckAthleteEntryOnboardingStep;
  entryOnboardingName?: string;
  productConsentAccepted?: boolean;
  completedConsentIds?: string[];
  researchConsentStatus?: PulseCheckResearchConsentStatus;
}

export interface UpdatePulseCheckTeamMembershipAccessInput {
  teamMembershipId: string;
  rosterVisibilityScope: PulseCheckRosterVisibilityScope;
  allowedAthleteIds?: string[];
  permissionSetId?: string;
}

export interface RedeemPulseCheckTeamInviteResult {
  organizationId: string;
  organizationName: string;
  teamId: string;
  teamName: string;
  pilotId?: string;
  cohortId?: string;
  teamMembershipId: string;
  teamMembershipRole: PulseCheckTeamMembershipRole;
  invitedTitle?: string;
  commercialSnapshot?: PulseCheckTeamCommercialSnapshot;
  teamPlanBypassesPaywall?: boolean;
}
