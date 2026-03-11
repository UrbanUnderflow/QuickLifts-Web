import type { Timestamp } from 'firebase/firestore';

export type PulseCheckOrganizationStatus = 'draft' | 'provisioning' | 'ready-for-activation' | 'active' | 'archived' | 'implementation-hold';
export type PulseCheckTeamStatus = 'draft' | 'provisioning' | 'ready-for-activation' | 'active' | 'paused' | 'archived';
export type PulseCheckStudyPosture = 'operational' | 'pilot' | 'research-eligible';
export type PulseCheckClinicianBridgeMode = 'none' | 'optional' | 'required';
export type PulseCheckInvitePolicy = 'admin-only' | 'admin-and-staff' | 'admin-staff-and-coaches';
export type PulseCheckClinicianProfileType = 'individual' | 'group' | 'provider';
export type PulseCheckClinicianProfileSource = 'pulsecheck-local' | 'auntedna';
export type PulseCheckClinicianProfileSyncStatus = 'pending-sync' | 'synced' | 'sync-failed';
export type PulseCheckInviteLinkStatus = 'active' | 'redeemed' | 'revoked';
export type PulseCheckInviteLinkType = 'admin-activation' | 'clinician-onboarding';
export type PulseCheckOrganizationMembershipRole = 'org-admin' | 'implementation-observer';
export type PulseCheckTeamMembershipRole =
  | 'team-admin'
  | 'coach'
  | 'performance-staff'
  | 'support-staff'
  | 'clinician';

export interface PulseCheckAdminContact {
  name?: string;
  email: string;
}

export interface PulseCheckOrganization {
  id: string;
  displayName: string;
  legalName: string;
  organizationType: string;
  status: PulseCheckOrganizationStatus;
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
  status?: PulseCheckOrganizationStatus;
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
  siteLabel?: string;
  defaultAdminName?: string;
  defaultAdminEmail?: string;
  status: PulseCheckTeamStatus;
  defaultInvitePolicy: PulseCheckInvitePolicy;
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
  siteLabel?: string;
  defaultAdminName?: string;
  defaultAdminEmail?: string;
  status?: PulseCheckTeamStatus;
  defaultInvitePolicy: PulseCheckInvitePolicy;
  defaultClinicianProfileId?: string;
  defaultClinicianExternalProfileId?: string;
  defaultClinicianProfileName?: string;
  defaultClinicianProfileType?: PulseCheckClinicianProfileType;
  defaultClinicianProfileSource?: PulseCheckClinicianProfileSource;
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
  clinicianProfileId?: string;
  targetEmail?: string;
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
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export interface PulseCheckTeamMembership {
  id: string;
  organizationId: string;
  teamId: string;
  userId: string;
  email?: string;
  role: PulseCheckTeamMembershipRole;
  title?: string;
  permissionSetId?: string;
  onboardingStatus?: 'pending' | 'complete';
  grantedByInviteToken?: string;
  grantedAt?: Timestamp | null;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export interface RedeemPulseCheckAdminActivationResult {
  organizationId: string;
  organizationName: string;
  teamId: string;
  teamName: string;
  organizationMembershipId: string;
  teamMembershipId: string;
}
