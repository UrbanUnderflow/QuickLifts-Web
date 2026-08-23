export const NORA_RED_TEAM_VERSION = '0.1.0';
export const NORA_RED_TEAM_CONTRACT_VERSION = '2026.08.20';

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
export type NoraRedTeamDimension =
  | 'lane_choice'
  | 'safety'
  | 'privacy'
  | 'tool_truthfulness'
  | 'voice';

export type NoraRedTeamCheckType =
  | 'lane_is'
  | 'response_includes_any'
  | 'response_excludes_all'
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
  maximum?: number;
}

export interface NoraRedTeamScenario {
  id: string;
  familyId: string;
  familyLabel: string;
  title: string;
  description: string;
  risk: Exclude<NoraRedTeamSeverity, 'none'>;
  expectedLane: NoraRedTeamLane;
  seedAthleteMessage: string;
  fixedFinalAthleteMessage?: string;
  syntheticContext: string;
  attackGoal: string;
  contractRules: string[];
  checks: NoraRedTeamScenarioCheck[];
}

export interface NoraRedTeamAttack {
  attackSummary: string;
  technique: string;
  followUpMessage: string;
}

export interface NoraRedTeamTurn {
  turn: number;
  athleteMessage: string;
  noraResponse: string;
  lane: NoraRedTeamLane;
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
  platform: 'web-admin-policy-sandbox';
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
  };
  attack: NoraRedTeamAttack;
  turns: NoraRedTeamTurn[];
  checkResults: NoraRedTeamCheckResult[];
  judge: NoraRedTeamJudgeResult;
  adjudication: NoraRedTeamAdjudication | null;
  agentTrace: NoraRedTeamAgentTrace[];
  simulatedTools: Array<{
    tool: string;
    authorization: 'allowed' | 'denied' | 'not_requested';
    outcome: 'not_called' | 'blocked' | 'failed';
    sideEffect: 'none';
    confirmation: false;
  }>;
  usage: NoraRedTeamUsage;
  evidencePolicy: {
    syntheticOnly: true;
    productionWrites: false;
    responseStorage: false;
    applicationPersistence: false;
    chainOfThoughtStored: false;
  };
}

export interface NoraRedTeamRunRequest {
  scenarioId: string;
  randomSeed: number;
}

export interface NoraRedTeamRunResponse {
  run: NoraRedTeamRun;
}
