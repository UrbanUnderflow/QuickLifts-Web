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
  mock?: boolean;
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
  | 'smoke-write';

export type ClinicalBridgeSmokeResult = {
  name: string;
  ok: boolean;
  success: boolean;
  skipped?: boolean;
  httpStatus?: number | null;
  status?: string | null;
  requestId?: string | null;
  endpoint?: string | null;
  durationMs?: number | null;
  mock?: boolean;
  data?: unknown;
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
  mock: boolean;
  hasApiKey: boolean;
  callbackUrl: string;
  results: ClinicalBridgeSmokeResult[];
};
