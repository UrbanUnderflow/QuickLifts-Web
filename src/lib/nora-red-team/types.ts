export const NORA_RED_TEAM_VERSION = '0.5.3';
export const NORA_RED_TEAM_CONTRACT_VERSION = '2026.08.20';

export type NoraRedTeamTarget = 'policy_sandbox' | 'staging_chat';

export type NoraRedTeamLane =
  | 'performance'
  | 'health_data'
  | 'coach_handoff'
  | 'app_support'
  | 'clinical_care'
  | 'critical_safety'
  | 'closure';

export type NoraRedTeamSeverity = 'none' | 'minor' | 'major' | 'critical';
export type NoraRedTeamVerdict = 'pass' | 'fail' | 'review';
export type NoraRedTeamEscalationTier = 0 | 1 | 2 | 3;
export type NoraRedTeamEscalationModal = 'none' | 'tier_2_consent' | 'tier_3_critical';
export type NoraRedTeamDimension =
  | 'lane_choice'
  | 'safety'
  | 'privacy'
  | 'tool_truthfulness'
  | 'voice';

export type NoraRedTeamCheckType =
  | 'lane_is'
  | 'lane_sequence_is'
  | 'escalation_tier_is'
  | 'escalation_modal_is'
  | 'escalation_handoff_workflow_is'
  | 'response_includes_any'
  | 'response_excludes_all'
  | 'response_excludes_unnegated'
  | 'simulated_tool_outcome_is'
  | 'max_questions'
  | 'max_words';

export type NoraRedTeamCheckScope = 'first' | 'last' | 'all';

export interface NoraRedTeamScenarioCheck {
  id: string;
  label: string;
  dimension: NoraRedTeamDimension;
  severity: Exclude<NoraRedTeamSeverity, 'none'>;
  type: NoraRedTeamCheckType;
  scope: NoraRedTeamCheckScope;
  terms?: string[];
  expectedLane?: NoraRedTeamLane;
  expectedLaneSequence?: NoraRedTeamLane[];
  expectedTier?: NoraRedTeamEscalationTier;
  expectedModal?: NoraRedTeamEscalationModal;
  expectedHandoffWorkflow?: 'none' | 'tier_2_pending_consent' | 'tier_3_started';
  expectedTool?: string;
  expectedToolOutcome?: NoraRedTeamToolOutcome;
  expectedToolConfirmation?: boolean;
  expectedToolAttempts?: number;
  expectedDuplicatePrevented?: boolean;
  maximum?: number;
}

export type NoraRedTeamToolOutcome =
  | 'not_called'
  | 'blocked'
  | 'failed'
  | 'pending_consent'
  | 'succeeded';

export interface NoraRedTeamSimulatedTool {
  tool: string;
  authorization: 'allowed' | 'denied' | 'not_requested';
  outcome: NoraRedTeamToolOutcome;
  sideEffect: 'none';
  confirmation: boolean;
  confirmationId?: string;
  attemptCount?: number;
  duplicatePrevented?: boolean;
  idempotencyKey?: string;
  workflow?: string;
  nextStep?: string;
}

export interface NoraRedTeamScenario {
  id: string;
  familyId: string;
  familyLabel: string;
  title: string;
  description: string;
  risk: Exclude<NoraRedTeamSeverity, 'none'>;
  expectedLane: NoraRedTeamLane;
  expectedEscalationTier: NoraRedTeamEscalationTier;
  seedAthleteMessage: string;
  fixedFinalAthleteMessage?: string;
  additionalAthleteMessages?: string[];
  syntheticHealthData?: {
    label: string;
    value: string;
    observedAt: string;
    freshness: string;
    missingness: string;
  };
  syntheticContext: string;
  attackGoal: string;
  contractRules: string[];
  checks: NoraRedTeamScenarioCheck[];
  simulatedTool?: NoraRedTeamSimulatedTool;
}

export interface NoraRedTeamAttack {
  attackSummary: string;
  technique: string;
  followUpMessage: string;
}

export interface NoraRedTeamEscalationResult {
  tier: NoraRedTeamEscalationTier;
  category: string;
  reason: string;
  explanation: string;
  confidence: number;
  shouldEscalate: boolean;
  classificationFamily: string;
  classificationSource: string;
  requiresCoachReview: boolean;
  requiresClinicalHandoff: boolean;
  modal: NoraRedTeamEscalationModal;
  consentRequired: boolean;
  recordWouldBeCreated: boolean;
  consentWorkflowWouldStart: boolean;
  safetyModeWouldActivate: boolean;
  handoffWouldStart: boolean;
  coachNotificationWouldStart: boolean;
  simulationOnly: true;
  conditionSource: 'production_firestore';
  conditionCount: number;
  model: string;
  durationMs: number;
}

export interface NoraRedTeamEscalationClassifierInput {
  athleteMessage: string;
  recentMessages: Array<{ isFromUser: boolean; content: string }>;
  conversationId: string;
}

export interface NoraRedTeamEscalationClassifierOutput {
  escalation: NoraRedTeamEscalationResult;
  usage: NoraRedTeamUsage;
}

export type NoraRedTeamEscalationClassifier = (
  input: NoraRedTeamEscalationClassifierInput,
) => Promise<NoraRedTeamEscalationClassifierOutput>;

export interface NoraRedTeamTurn {
  turn: number;
  athleteMessage: string;
  noraResponse: string;
  lane: NoraRedTeamLane;
  escalation: NoraRedTeamEscalationResult;
  escalationBoundaryApplied: boolean;
  generationAttempts: number;
  usedFallback: boolean;
  guardrailIntervened: boolean;
  preDeliveryFailureIds: string[];
  deterministicScore: number;
  deterministicFailureIds: string[];
}

export interface NoraRedTeamCheckResult {
  id: string;
  label: string;
  dimension: NoraRedTeamDimension;
  severity: Exclude<NoraRedTeamSeverity, 'none'>;
  passed: boolean;
  evidence: string;
}

export interface NoraRedTeamFinding {
  dimension: NoraRedTeamDimension;
  title: string;
  evidence: string;
  contractRule: string;
  severity: Exclude<NoraRedTeamSeverity, 'none'>;
}

export interface NoraRedTeamDimensionScores {
  laneChoice: number;
  safety: number;
  privacy: number;
  toolTruthfulness: number;
  voice: number;
}

export interface NoraRedTeamJudgeResult {
  verdict: NoraRedTeamVerdict;
  severity: NoraRedTeamSeverity;
  confidence: number;
  actualLane: NoraRedTeamLane;
  summary: string;
  humanReviewRequired: boolean;
  dimensionScores: NoraRedTeamDimensionScores;
  findings: NoraRedTeamFinding[];
}

export interface NoraRedTeamAdjudication {
  decision: 'uphold' | 'overturn' | 'human_review';
  severity: NoraRedTeamSeverity;
  rationale: string;
  disputedFinding: string;
}

export interface NoraRedTeamAgentTrace {
  role:
    | 'scenario_generator'
    | 'attacker'
    | 'athlete_simulator'
    | 'nora_target'
    | 'safety_classifier'
    | 'judge'
    | 'adjudicator'
    | 'human_reviewer';
  mode: 'curated' | 'deterministic' | 'model' | 'mixed' | 'human';
  status: 'completed' | 'required' | 'not_required';
  model?: string;
  durationMs: number;
  summary: string;
}

export interface NoraRedTeamUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface NoraRedTeamRun {
  runId: string;
  version: string;
  contractVersion: string;
  scenarioId: string;
  scenarioTitle: string;
  familyId: string;
  familyLabel: string;
  expectedLane: NoraRedTeamLane;
  randomSeed: number;
  platform: 'web-admin-policy-sandbox' | 'web-staging-chat';
  build: string;
  targetModel: string;
  agentModel: string;
  promptConfigVersion: string;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  verdict: NoraRedTeamVerdict;
  severity: NoraRedTeamSeverity;
  releaseBlocking: boolean;
  humanReviewRequired: boolean;
  humanReview: {
    status: 'not_required' | 'pending' | 'confirmed' | 'inconclusive';
    reviewedAt: string | null;
    reviewerEmail: string | null;
  };
  attack: NoraRedTeamAttack;
  turns: NoraRedTeamTurn[];
  checkResults: NoraRedTeamCheckResult[];
  judge: NoraRedTeamJudgeResult;
  adjudication: NoraRedTeamAdjudication | null;
  agentTrace: NoraRedTeamAgentTrace[];
  simulatedTools: NoraRedTeamSimulatedTool[];
  usage: NoraRedTeamUsage;
  stagingEvidence?: {
    syntheticUserId: string;
    anonymousRequestDenied: boolean;
    crossAccountRequestDenied: boolean;
    stateSnapshotRead: boolean;
    conversationWriteObserved: boolean;
    escalationRecordWriteObserved: boolean;
    coachHandoffWriteObserved: boolean;
    coachHandoffWriteCount: number;
    safetyStateWriteObserved: boolean;
    tier2ClinicalRoutingLocked: boolean;
    externalSideEffects: false;
    cleanupCompleted: boolean;
  };
  scenarioSnapshot?: NoraRedTeamScenario;
  scenarioFingerprint?: string;
  usefulness?: { verdict: NoraRedTeamVerdict; turns: Array<{ turn: number; appropriate: boolean; helpful: boolean; concern: string }> };
  evidencePolicy: {
    syntheticOnly: true;
    productionWrites: false;
    responseStorage: false;
    applicationPersistence: boolean;
    persistenceScope: 'none' | 'temporary_job_state' | 'protected_history';
    retentionEndsAt: string | null;
    chainOfThoughtStored: false;
    stagingWrites?: boolean;
    externalSideEffects?: false;
  };
}

export type NoraRedTeamJobStatus =
  | 'queued'
  | 'running'
  | 'cancelling'
  | 'cancelled'
  | 'completed'
  | 'failed';

export type NoraRedTeamJobStage =
  | 'queued'
  | 'loading_policy'
  | 'generating_attack'
  | 'running_nora'
  | 'judging'
  | 'adjudicating'
  | 'finalizing'
  | 'completed'
  | 'cancelling'
  | 'cancelled'
  | 'failed';

export interface NoraRedTeamRunLimits {
  maxDurationMs: number;
  requestTimeoutMs: number;
  maxModelCalls: number;
  maxRetriesPerRequest: number;
  maxTotalTokens: number;
}

export interface NoraRedTeamJobProgress {
  stage: NoraRedTeamJobStage;
  percent: number;
  message: string;
  modelCalls: number;
  retryCount: number;
  usage: NoraRedTeamUsage;
  updatedAt: string;
}

export interface NoraRedTeamJobError {
  code: string;
  message: string;
  detail?: string;
}

export interface NoraRedTeamJob {
  jobId: string;
  scenarioId: string;
  randomSeed: number;
  target: NoraRedTeamTarget;
  status: NoraRedTeamJobStatus;
  progress: NoraRedTeamJobProgress;
  limits: NoraRedTeamRunLimits;
  storage: 'memory' | 'temporary_firestore';
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  expiresAt: string;
  cancelRequested: boolean;
  run: NoraRedTeamRun | null;
  error: NoraRedTeamJobError | null;
}

export interface NoraRedTeamRunRequest {
  scenarioId: string;
  randomSeed: number;
  target?: NoraRedTeamTarget;
}

export interface NoraRedTeamRunResponse {
  run: NoraRedTeamRun;
}

export interface NoraRedTeamJobResponse {
  job: NoraRedTeamJob;
}

export type NoraRedTeamReleaseStatus = 'clear' | 'blocking' | 'resolved';

export interface NoraRedTeamHistoryRecord {
  runId: string;
  scenarioId: string;
  scenarioTitle: string;
  verdict: NoraRedTeamVerdict;
  severity: NoraRedTeamSeverity;
  completedAt: string;
  ownerEmail: string;
  firebaseMode: 'prod' | 'dev';
  createdAt: string;
  updatedAt: string;
  releaseStatus: NoraRedTeamReleaseStatus;
  releaseResolvedAt: string | null;
  releaseResolutionRunId: string | null;
  promotedRegression: boolean;
  promotedAt: string | null;
  promotedBy: string | null;
  review?: {
    safe: 'yes' | 'no' | 'unsure';
    helpful: 'yes' | 'no' | 'unsure';
    note: string;
    reviewerEmail: string;
    reviewedAt: string;
    ownerEmail: string;
    state: 'complete' | 'needs_owner' | 'needs_fix';
  };
  run: NoraRedTeamRun;
}

export interface NoraRedTeamRegressionCase {
  scenarioId: string;
  sourceRunId: string;
  promotedAt: string;
  promotedBy: string;
  enabled: boolean;
  scenario: NoraRedTeamScenario;
}

export interface NoraRedTeamHistoryResponse {
  history: NoraRedTeamHistoryRecord[];
  openCriticalBlockers: number;
  promotedRegressionCount: number;
  latestSuite: NoraRedTeamSuiteRecord | null;
}

export interface NoraRedTeamSuiteRecord {
  suiteId: string;
  version: string;
  contractVersion: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  scheduled: boolean;
  target?: NoraRedTeamTarget;
  catalogFingerprint?: string;
  targetModel?: string;
  agentModel?: string;
  runIds?: string[];
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  scenarioIds: string[];
  completedScenarioIds: string[];
  passed: number;
  failed: number;
  review: number;
  openCriticalBlockers: number;
  build: string;
  error: string | null;
}

export interface NoraRedTeamReleaseGateResult {
  releaseReady: boolean;
  checkedAt: string;
  latestSuite: NoraRedTeamSuiteRecord | null;
  openCriticalBlockers: number;
  reasons: string[];
}
