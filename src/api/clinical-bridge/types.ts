export type ClinicalBridgeProvider = 'auntedna';

export type ClinicalEscalationTier = 'low' | 'moderate' | 'critical' | 0 | 1 | 2 | 3;

export type ClinicalConsentStatus =
  | 'not_required_low_acuity'
  | 'pending'
  | 'opted_in'
  | 'declined'
  | 'emergency_safety_basis';

export type ClinicalAppState =
  | 'normal'
  | 'protective'
  | 'reduced_functionality'
  | 'clinician_monitored';

export type ClinicalReturnToTrainingStatus =
  | 'not_cleared'
  | 'pending_review'
  | 'cleared';

export type ClinicalBridgeResponse<T = unknown> = {
  success: boolean;
  data?: T;
  error?: {
    code?: string;
    message: string;
  } | null;
  requestId?: string;
  httpStatus?: number | null;
  durationMs?: number | null;
};

export type ClinicalAthleteIdentity = {
  externalId: string;
  displayName?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  organizationId?: string;
  teamId?: string;
};

export type ClinicalEscalationInput = {
  escalationRecordId: string;
  pulseUserId: string;
  pulseConversationId?: string;
  athlete: {
    userId: string;
    displayName?: string;
    email?: string;
  };
  tier: ClinicalEscalationTier;
  category: string;
  triggerContent?: string;
  classificationReason?: string;
  conversationSummary?: string;
  escalationTimestamp?: number;
  pulseApiCallback?: string;
};

export type ClinicalCareState = {
  athleteId?: string;
  externalId?: string;
  watchList?: boolean;
  appState?: ClinicalAppState;
  returnToTrainingStatus?: ClinicalReturnToTrainingStatus;
};

export type ClinicalBridgeSmokeAction =
  | 'health'
  | 'status'
  | 'care-state'
  | 'athlete-upsert'
  | 'escalation-create'
  | 'resolve'
  | 'smoke-read'
  | 'smoke-write'
  | 'chat-scenario';

export type ClinicalChatScenarioRecentMessage = {
  isFromUser: boolean;
  content: string;
};

export type ClinicalChatScenarioInput = {
  message: string;
  expectedTier: number;
  recentMessages?: ClinicalChatScenarioRecentMessage[];
  consent?: boolean;
};

export type ClinicalChatScenarioClassification = {
  tier?: number | null;
  category?: string | null;
  reason?: string | null;
  explanation?: string | null;
  confidence?: number | null;
  shouldEscalate?: boolean;
  requiresClinicalHandoff?: boolean;
  [key: string]: unknown;
};

export type ClinicalChatScenarioOutcome = {
  escalationRecordId?: string | null;
  escalationId?: string | null;
  consentRequired?: boolean;
  consent?: string | null;
  consentStatus?: string | null;
  handoffStatus?: string | null;
  status?: string | null;
  clinicalReferenceId?: string | null;
  providerRequestId?: string | null;
  partnerWriteAttempted?: boolean;
  partnerWriteAllowed?: boolean;
  [key: string]: unknown;
};

export type ClinicalChatScenarioResponse = {
  message: string;
  assistantMessage: string;
  expectedTier: number;
  actualTier: number | null;
  matchedExpectation: boolean | null;
  classification?: ClinicalChatScenarioClassification | null;
  outcome?: ClinicalChatScenarioOutcome | null;
};

export type ClinicalBridgeSmokeRequest = {
  action: ClinicalBridgeSmokeAction;
  allowWrites?: boolean;
  athlete?: {
    externalId?: string;
    displayName?: string;
    email?: string;
    organizationId?: string;
    teamId?: string;
  };
  escalation?: {
    escalationRecordId?: string;
    tier?: number;
    category?: string;
    conversationId?: string;
  };
  escalationId?: string;
  status?: string;
  chat?: ClinicalChatScenarioInput;
};

export type ClinicalBridgeSmokeResult = {
  name: string;
  ok: boolean;
  success: boolean;
  skipped?: boolean;
  httpStatus?: number | null;
  status?: string | null;
  requestId?: string | null;
  clinicalReferenceId?: string | null;
  endpoint?: string | null;
  durationMs?: number | null;
  data?: unknown;
  request?: unknown;
  error?: {
    code?: string;
    message: string;
  } | null;
};

export type ClinicalBridgeSmokeResponse = {
  success: boolean;
  action: ClinicalBridgeSmokeAction;
  allowWrites: boolean;
  provider: ClinicalBridgeProvider;
  baseUrl: string;
  hasApiKey: boolean;
  credentialMode?: string;
  writeSafety?: {
    allowed: boolean;
    reason: string;
  };
  callbackUrl: string;
  chat?: ClinicalChatScenarioResponse | null;
  results: ClinicalBridgeSmokeResult[];
};
