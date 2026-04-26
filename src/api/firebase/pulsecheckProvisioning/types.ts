import type { Timestamp } from 'firebase/firestore';

export type PulseCheckOrganizationStatus = 'draft' | 'provisioning' | 'ready-for-activation' | 'active' | 'archived' | 'implementation-hold';
export type PulseCheckTeamStatus = 'draft' | 'provisioning' | 'ready-for-activation' | 'active' | 'paused' | 'archived';
export type PulseCheckStudyPosture = 'operational' | 'pilot' | 'research-eligible';
export type PulseCheckPilotStatus = 'draft' | 'active' | 'paused' | 'completed' | 'archived';
export type PulseCheckPilotStudyMode = 'operational' | 'pilot' | 'research';
export type PulseCheckPilotCohortStatus = 'draft' | 'active' | 'paused' | 'archived';
export type PulseCheckPilotEnrollmentStatus = 'pending-consent' | 'active' | 'withdrawn';
export type PulseCheckClinicianBridgeMode = 'none' | 'optional' | 'required';
export type PulseCheckTeamEscalationRoute = 'hotline' | 'clinician';
export type PulseCheckInvitePolicy = 'admin-only' | 'admin-and-staff' | 'admin-staff-and-coaches';
export type PulseCheckClinicianProfileType = 'individual' | 'group' | 'provider';
export type PulseCheckClinicianProfileSource = 'pulsecheck-local' | 'auntedna';
export type PulseCheckClinicianProfileSyncStatus = 'pending-sync' | 'synced' | 'sync-failed';
export type PulseCheckInviteLinkStatus = 'active' | 'redeemed' | 'revoked';
export type PulseCheckInviteLinkType = 'admin-activation' | 'clinician-onboarding' | 'team-access';
export type PulseCheckInviteLinkRedemptionMode = 'single-use' | 'general';
export type PulseCheckInviteActivityEventType =
  | 'page-view'
  | 'authenticated-view'
  | 'redeem-started'
  | 'redeem-succeeded'
  | 'redeem-failed'
  | 'follow-up-requested';
export type PulseCheckInviteActivityEmailSource = 'authenticated-user' | 'manual-follow-up' | 'unknown';
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

const parseConsentVersionNumber = (version?: string): number => {
  const normalized = String(version || '').trim().toLowerCase();
  const match = normalized.match(/(\d+)/);
  return match ? Number(match[1]) || 0 : 0;
};

const LEGACY_DEFAULT_PULSECHECK_REQUIRED_CONSENT_IDS = [
  'pulsecheck-team-participation-v1',
  'pulsecheck-data-privacy-v1',
];

const DEFAULT_PULSECHECK_REQUIRED_CONSENTS_BY_STUDY_MODE: Record<PulseCheckPilotStudyMode, PulseCheckRequiredConsentDocument[]> = {
  research: [
    {
      id: 'pulsecheck-research-study-consent-v1',
      title: 'PulseCheck Research Study Consent',
      body:
        [
          'You are being invited to take part in a research study involving PulseCheck and AuntEdna, which are supporting this study in partnership with your institution. The purpose of this study is to understand how PulseCheck tools, check-ins, and support workflows function during this team-based study and whether they are useful, usable, and acceptable to participants.',
          'If you choose to participate, you may be asked to complete check-ins, use PulseCheck training features, connect approved wearable or health data sources, and allow the study team to review information generated during your participation. This may include check-ins, readiness signals, activity logs, session completion, connected health data you choose to share, survey responses, and support workflow events during the study period.',
          'Your participation is voluntary. You may choose not to participate or may stop participating at any time. Stopping participation will not affect any rights or benefits to which you are otherwise entitled, except that data already collected may still be used to the extent allowed by law and approved study procedures.',
          'Possible risks include loss of privacy, unauthorized access to data, mistaken interpretation of incomplete or inaccurate data, discomfort from questions or recommendations, and the possibility that some product features or support workflows may not function as intended during the study. There may also be risks related to sharing information digitally.',
          'You may or may not receive direct benefit from participating. The study may help researchers, staff, and product teams better understand how to improve the platform and related support workflows.',
          'If coaches, staff, clinicians, AuntEdna, or other support partners will receive participant-level information during this study, the study materials should identify what they may receive and why before participation begins.',
          'Participation in this study does not waive any legal rights. Nothing in this consent releases the investigators, sponsor, institution, Pulse Intelligence Labs, Inc., AuntEdna, or their agents from responsibility where such a release is not allowed by law.',
          'If you have questions about the study, contact Tremaine Grant at PulseCheck (tre@fitwithpulse.ai) or Dr. Tracey at AuntEdna (tracey@auntedna.ai). If you have questions about your rights as a participant, contact the IRB or research office identified in the study materials.',
        ].join('\n\n'),
      version: 'v3',
    },
    {
      id: 'pulsecheck-research-data-authorization-v1',
      title: 'Research Data Authorization and Privacy Notice',
      body:
        [
          'By agreeing to participate, you authorize the study team to collect and use the categories of data described in this disclosure for the stated study purposes.',
          'These categories may include app check-ins and survey responses, session activity and completion data, readiness and support workflow data, connected wearable or health data you choose to authorize, and team or pilot participation metadata.',
          'If this study uses education records, school records, health records, wearable data, or support workflow data, the study materials should identify what categories of information may be disclosed, the purpose of the disclosure, and the people or organizations that may receive the information, including PulseCheck personnel, AuntEdna personnel, your institution, and approved school, operational, or clinical partners involved in the study.',
          'Access to identifiable information should be limited to authorized study personnel and approved operational, school, or clinical recipients described by the study, which may include PulseCheck and AuntEdna when they are operating or supporting the study workflow. Data may also be analyzed in de-identified or aggregated form when allowed by the study and applicable law.',
          'Consumer health apps and wearable integrations are not automatically covered by HIPAA. If a covered provider, covered entity, or business associate is involved in a specific data flow, additional authorization or privacy notice may apply and should be provided separately.',
          'Questions about research data use should be directed to Tremaine Grant at PulseCheck (tre@fitwithpulse.ai) or Dr. Tracey at AuntEdna (tracey@auntedna.ai). Questions about participant rights or institutional review should be directed to the IRB or research office identified in the study materials.',
        ].join('\n\n'),
      version: 'v3',
    },
  ],
  pilot: [
    {
      id: 'pulsecheck-pilot-participation-notice-v1',
      title: 'PulseCheck Pilot Participation Notice',
      body:
        [
          'You are being invited to take part in a PulseCheck pilot connected to your team and operated by PulseCheck in partnership with AuntEdna. This pilot is voluntary. You may choose not to participate or stop participating at any time.',
          'If you stop participating or withdraw from the pilot, no new pilot data should be collected from your future pilot activity after that point. Information already collected before your withdrawal may still be retained and used to the extent allowed by law, institutional policy, and the pilot procedures described to you.',
          'Because this is a pilot, some features, workflows, recommendations, alerts, and support pathways operated by PulseCheck and AuntEdna may change while the pilot is active. Some parts of the experience may be incomplete, experimental, or still being evaluated.',
          'PulseCheck is not emergency response, not crisis care, and not a substitute for medical care, mental health treatment, or emergency services. If you believe you are in immediate danger, may harm yourself or someone else, or need urgent help, call 911, call or text 988, contact local emergency services, or use the crisis or care resources provided by your school right away.',
          'Crisis handoff during the pilot. If the pilot system detects a sustained pattern that meets a critical-tier threshold, the app will gate to a crisis-resource screen that prominently displays 988 (Suicide & Crisis Lifeline), 741741 (Crisis Text Line), and 911. The app will inform you that your team\'s designated clinician staff member has been notified by email and, where a phone number is on file, by text message. PulseCheck does not initiate contact with 988, 911, or any emergency line on your behalf — you remain in control of any call or text. The clinician staff member named in your team\'s pilot configuration applies clinical judgment and may reach out to you, your designated emergency contact, or your school\'s on-site support staff per their standing protocol. By participating, you acknowledge and authorize this notification flow for the duration of the pilot. If at any time you would prefer your designated emergency contact be notified instead of (or in addition to) the team clinician, tell your team admin and they can update your pilot configuration.',
          'Potential risks include privacy and security risks associated with digital systems, the possibility of incomplete or inaccurate data, mistaken interpretation, or product workflows that do not operate exactly as intended during the pilot. The crisis handoff workflow may also generate false-positive notifications; the human clinician applies judgment before any in-person follow-up.',
          'You may or may not receive a direct benefit from participating. The pilot may help teams, staff, product groups, and AuntEdna support teams understand how to improve the platform and related support workflows.',
          'Nothing in this notice waives any legal rights or releases Pulse Intelligence Labs, Inc., AuntEdna, your institution, or any other party from responsibility where such a release is not allowed by law.',
          'If you have questions about the pilot, contact Tremaine Grant at PulseCheck (tre@fitwithpulse.ai), Dr. Tracey at AuntEdna (tracey@auntedna.ai), or your team admin.',
        ].join('\n\n'),
      version: 'v5',
    },
    {
      id: 'pulsecheck-pilot-privacy-and-data-use-v1',
      title: 'PulseCheck Pilot Privacy and Data Use',
      body:
        [
          'PulseCheck and AuntEdna may use the information you share in the app, plus any health or wearable connections you choose to authorize, to operate the pilot experience and improve the product and support workflows connected to it.',
          'This may include check-ins, readiness or recovery signals, session activity, survey responses, escalation or support workflow events, and connected wearable or health data that you choose to authorize during the pilot.',
          'PulseCheck may share pilot-related information with authorized staff who support your team and, where applicable, with AuntEdna and connected care or support partners involved in the pilot workflow. Sharing should be limited to the minimum information needed to operate, review, and improve the pilot.',
          'Crisis-tier escalation sharing. If the pilot system detects a critical-tier signal, PulseCheck will share the minimum information needed for clinical follow-up with the team\'s designated clinician staff member: athlete name, team, signal evidence summary, and timestamp. This sharing is the basis for the clinician applying judgment about next steps. PulseCheck does not share crisis-tier information with 988, 911, or any emergency line on your behalf — those services remain athlete-initiated.',
          'If the pilot uses education records or other school-linked data, the pilot materials should identify what categories of records may be disclosed, the purpose of the disclosure, and the person or class of people or organizations that may receive the information, such as authorized university athletics staff, sports medicine or support staff, PulseCheck personnel, AuntEdna personnel, or approved support partners involved in the pilot workflow.',
          'Pilot data may be retained for the period needed to operate, review, document, secure, and improve the pilot, and to satisfy applicable law, institutional policy, contractual obligations, and audit or security requirements. If you withdraw, previously collected information may still be retained and used as allowed by law and policy, and de-identified or aggregated information may continue to be used for pilot review, internal reporting, or product improvement.',
          'Consumer app and wearable data are not automatically protected by HIPAA in every workflow. If a covered provider, covered entity, or business associate, including AuntEdna when it is operating within a covered care or support workflow, is involved in a specific data flow, additional notice or authorization may apply.',
          'Questions about pilot data use should be directed to Tremaine Grant at PulseCheck (tre@fitwithpulse.ai), Dr. Tracey at AuntEdna (tracey@auntedna.ai), or your team admin.',
        ].join('\n\n'),
      version: 'v5',
    },
  ],
  operational: [
    {
      id: 'pulsecheck-operational-participation-notice-v1',
      title: 'PulseCheck Participation Notice',
      body:
        [
          'Your team or organization is using PulseCheck, together with AuntEdna where applicable, as part of its current operational support and performance workflow. This notice explains the current-use experience and the information needed to operate it.',
          'PulseCheck may use check-ins, readiness signals, session activity, survey responses, and other information you provide in the app to support day-to-day workflows tied to this program, including workflows supported by AuntEdna when it is participating in the program.',
          'Some features, support pathways, and operational workflows may change over time as the system is maintained and improved.',
          'Potential risks include privacy and security risks associated with digital systems, incomplete or inaccurate data, mistaken interpretation, or workflow errors that may require staff follow-up.',
          'Nothing in this notice waives any legal rights or releases Pulse Intelligence Labs, Inc., AuntEdna, your institution, or any other party from responsibility where such a release is not allowed by law.',
          'If you have questions about this program, contact Tremaine Grant at PulseCheck (tre@fitwithpulse.ai), Dr. Tracey at AuntEdna (tracey@auntedna.ai), or your program administrator.',
        ].join('\n\n'),
      version: 'v3',
    },
    {
      id: 'pulsecheck-operational-privacy-and-sharing-v1',
      title: 'PulseCheck Operational Privacy and Sharing',
      body:
        [
          'PulseCheck may collect and use the information you provide in the app, plus any wearable or health data you choose to authorize, to operate current support, performance, and coordination workflows for your team or organization, including workflows supported by AuntEdna where applicable.',
          'Authorized staff may view the minimum information needed to operate those workflows, respond to concerns, and improve the service. This may include check-ins, readiness trends, session activity, support workflow events, approved connected-data summaries, and AuntEdna-supported care or support coordination information when AuntEdna is part of the workflow.',
          'If education records, school-linked data, or support-program records are used, the operational materials should identify what categories of information are used, the purpose of the use or disclosure, and the people or organizations that may receive the information, which may include PulseCheck personnel, AuntEdna personnel, and authorized school or support-program staff.',
          'Consumer apps and wearable integrations are not automatically HIPAA-covered in every workflow. If a covered provider, covered entity, or business associate, including AuntEdna when it is operating inside a covered care or support workflow, is involved in a specific data flow, additional notice or authorization may apply.',
          'Questions about operational data use or sharing should be directed to Tremaine Grant at PulseCheck (tre@fitwithpulse.ai), Dr. Tracey at AuntEdna (tracey@auntedna.ai), or your program administrator.',
        ].join('\n\n'),
      version: 'v3',
    },
  ],
};

const ALL_DEFAULT_PULSECHECK_REQUIRED_CONSENT_IDS = new Set<string>([
  ...LEGACY_DEFAULT_PULSECHECK_REQUIRED_CONSENT_IDS,
  ...Object.values(DEFAULT_PULSECHECK_REQUIRED_CONSENTS_BY_STUDY_MODE).flatMap((consents) => consents.map((consent) => consent.id)),
]);

export const getDefaultPulseCheckRequiredConsents = (
  studyMode: PulseCheckPilotStudyMode = 'operational'
): PulseCheckRequiredConsentDocument[] =>
  (DEFAULT_PULSECHECK_REQUIRED_CONSENTS_BY_STUDY_MODE[studyMode] || DEFAULT_PULSECHECK_REQUIRED_CONSENTS_BY_STUDY_MODE.operational)
    .map((consent) => ({ ...consent }));

export const mergePulseCheckRequiredConsents = (
  studyMode: PulseCheckPilotStudyMode = 'operational',
  customConsents?: PulseCheckRequiredConsentDocument[] | null
): PulseCheckRequiredConsentDocument[] => {
  const merged = new Map<string, PulseCheckRequiredConsentDocument>();
  const defaultsById = new Map<string, PulseCheckRequiredConsentDocument>();
  const currentDefaultIds = new Set<string>();

  getDefaultPulseCheckRequiredConsents(studyMode).forEach((consent) => {
    merged.set(consent.id, consent);
    defaultsById.set(consent.id, consent);
    currentDefaultIds.add(consent.id);
  });

  (customConsents || []).forEach((consent) => {
    if (ALL_DEFAULT_PULSECHECK_REQUIRED_CONSENT_IDS.has(consent.id) && !currentDefaultIds.has(consent.id)) {
      return;
    }
    const defaultConsent = defaultsById.get(consent.id);
    if (
      defaultConsent
      && parseConsentVersionNumber(consent.version) < parseConsentVersionNumber(defaultConsent.version)
    ) {
      return;
    }
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

export interface PulseCheckOrganizationImplementationMetadata {
  provisioningPath: 'pulsecheck-hierarchy' | 'legacy-coach-roster' | 'manual';
  legacySignupPathUsed: boolean;
  canaryTarget: boolean;
  selectedTargetLeadId?: string;
  selectedTargetEvidenceIds?: string[];
  sourceBriefPath?: string;
  firstPlannedTeamName?: string;
  ownerContactStatus?: 'unverified' | 'pending-confirmation' | 'confirmed';
  provisionedBy?: string;
  provisionedAt?: Timestamp | null;
  notes?: string;
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
  implementationMetadata?: PulseCheckOrganizationImplementationMetadata;
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
  implementationMetadata?: PulseCheckOrganizationImplementationMetadata;
  primaryCustomerAdminName?: string;
  primaryCustomerAdminEmail?: string;
  additionalAdminContacts?: PulseCheckAdminContact[];
  defaultStudyPosture: PulseCheckStudyPosture;
  defaultClinicianBridgeMode: PulseCheckClinicianBridgeMode;
  notes?: string;
}

export interface PulseCheckTeamImplementationMetadata {
  provisioningPath: 'pulsecheck-hierarchy' | 'legacy-coach-roster' | 'manual';
  legacySignupPathUsed: boolean;
  canaryTarget: boolean;
  selectedTargetLeadId?: string;
  selectedTargetEvidenceIds?: string[];
  sourceBriefPath?: string;
  routingDefaultsMode?: 'organization-default-optional' | 'organization-default-required' | 'team-clinician-profile' | 'team-hotline';
  invitePosture?: PulseCheckInvitePolicy;
  provisionedBy?: string;
  provisionedAt?: Timestamp | null;
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
  defaultEscalationRoute: PulseCheckTeamEscalationRoute;
  defaultClinicianProfileId?: string;
  defaultClinicianExternalProfileId?: string;
  defaultClinicianProfileName?: string;
  defaultClinicianProfileType?: PulseCheckClinicianProfileType;
  defaultClinicianProfileSource?: PulseCheckClinicianProfileSource;
  implementationMetadata?: PulseCheckTeamImplementationMetadata;
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
  defaultEscalationRoute: PulseCheckTeamEscalationRoute;
  defaultClinicianProfileId?: string;
  defaultClinicianExternalProfileId?: string;
  defaultClinicianProfileName?: string;
  defaultClinicianProfileType?: PulseCheckClinicianProfileType;
  defaultClinicianProfileSource?: PulseCheckClinicianProfileSource;
  implementationMetadata?: PulseCheckTeamImplementationMetadata;
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
  redemptionMode?: PulseCheckInviteLinkRedemptionMode;
  redemptionCount?: number;
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

export interface PulseCheckInviteActivity {
  id: string;
  token: string;
  inviteId: string;
  eventType: PulseCheckInviteActivityEventType;
  organizationId: string;
  teamId: string;
  pilotId?: string;
  cohortId?: string;
  inviteStatus: PulseCheckInviteLinkStatus;
  redemptionMode?: PulseCheckInviteLinkRedemptionMode;
  teamMembershipRole?: PulseCheckTeamMembershipRole;
  sessionId?: string;
  userId?: string;
  email?: string;
  emailSource?: PulseCheckInviteActivityEmailSource;
  source?: 'browser';
  pageUrl?: string;
  userAgent?: string;
  ipHash?: string;
  errorMessage?: string;
  needsFollowUp?: boolean;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export interface PulseCheckProvisioningHandoffMetadata {
  state: 'reserved-pending-activation' | 'claimed';
  handoffKey: string;
  targetOwnerName?: string;
  targetOwnerEmail?: string;
  sourceBriefPath?: string;
  selectedTargetLeadId?: string;
  selectedTargetEvidenceIds?: string[];
  reservedBy?: string;
  reservedAt?: Timestamp | null;
  notes?: string;
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
  handoffMetadata?: PulseCheckProvisioningHandoffMetadata;
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
  handoffMetadata?: PulseCheckProvisioningHandoffMetadata;
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
  redemptionMode?: PulseCheckInviteLinkRedemptionMode;
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
