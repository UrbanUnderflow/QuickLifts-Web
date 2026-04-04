'use strict';

const crypto = require('crypto');
const {
  buildAdmissionDecision,
  deriveBusinessDebtScore,
  deriveCommercialMovementScore,
  deriveExecutionScore,
  normalizeCreditBucket,
  normalizeExecuteGateMode,
  normalizeScoreGateMode,
  normalizeSideEffectClass,
} = require('./missionAdmissionTypes');
const {
  buildCanaryMissionInstancePolicy,
  resolveMissionPlaybook,
  resolveMissionInstancePolicy,
} = require('./missionPolicies');
const {
  buildAdmissionReadinessDecision,
  compareStagePositions,
  normalizeCleanupState,
  resolveStage,
} = require('./missionReadiness');

const MISSION_SYSTEM_VERSION = 2;
const DEFAULT_MISSION_MODE = 'execute';
const DEFAULT_PLANNER_MODE = 'single';
const DEFAULT_STALL_WINDOW_MINUTES = 30;
const DEFAULT_MAX_ACTIVE_TASKS_PER_AGENT = 1;
const DEFAULT_MAX_QUEUED_EXECUTE_TASKS_PER_AGENT = 1;
const DEFAULT_MAX_QUEUED_EXPLORE_TASKS_PER_AGENT = 1;
const DEFAULT_SPOT_CHECK_SAMPLE_RATE = 0.2;
const DEFAULT_TASK_EXPIRY_HOURS = 72;
const DEFAULT_PLANNER_MIN_CREDITED_SCORE = 12;
const DEFAULT_PLANNER_MIN_NET_SCORE = 0;
const DEFAULT_EXECUTE_GATE_MODE = 'strict';
const DEFAULT_SCORE_GATE_MODE = 'credited-and-net';
const DEFAULT_MAX_LEARNING_INVALIDATION_WIP_PCT = 0.25;
const DEFAULT_MAX_WAIVED_CREDIT_PCT = 50;
const DEFAULT_ALLOW_WAIVED_CREDIT = false;
const DEFAULT_ALLOW_NEGATIVE_NET_SCORE = true;
const DEFAULT_CLAMP_CREDITED_SCORE = true;
const DEFAULT_HARD_FAILURE_NET_HANDLING = 'force-debt';
const DEFAULT_HARD_FAILURE_DEBT_FLOOR = 1;
const DEFAULT_SCORE_VERSION = 'outcome-rubric-v1.0';
const OUTCOME_COLLECTION = 'agent-outcomes';

const AUTO_GENERATED_SOURCES = new Set([
  'self-assigned-idle',
  'self-assigned-mission',
  'nora-task-manager',
  'telemetry-auto-assign',
]);

const EXEC_EXCLUDED_STATUSES = new Set([
  'quarantined',
  'needs-spec',
  'needs-review',
  'canceled',
  'blocked',
]);

const ACTIVE_TASK_STATUSES = new Set(['todo', 'in-progress']);
const CORRECTION_SOURCES = new Set(['validation-gate', 'human-spot-check', 'system-correction']);
const HIGH_IMPACT_TASK_CLASSES = new Set(['execute-unit', 'delivery', 'correction']);
const OUTCOME_CLASSES = new Set(['terminal', 'enabling', 'learning', 'invalidation', 'constraint']);
const OUTCOME_DOMAINS = new Set([
  'revenue',
  'pipeline',
  'partnerships',
  'distribution',
  'activation',
  'retention',
  'credibility',
  'system-operations',
  'data',
  'service-quality',
]);
const OUTCOME_STATUSES = new Set([
  'planned',
  'executing',
  'artifact-verified',
  'observing',
  'confirmed',
  'canceled',
  'superseded',
  'failed',
  'reversed',
  'expired',
  'waived',
]);
const OUTCOME_SOURCE_OF_TRUTH = new Set([
  'repo',
  'firestore',
  'http',
  'calendar',
  'billing',
  'crm',
  'analytics',
  'ad-platform',
  'manual-review',
  'runtime',
]);
const OUTCOME_OBSERVATION_WINDOWS = new Set(['immediate', '72h', '14d', '30d', 'renewal-cycle', 'custom']);
const OUTCOME_EVALUATION_CADENCE = new Set(['instant', 'hourly', 'daily', 'manual']);
const OUTCOME_COMPARATORS = new Set([
  'eq',
  'neq',
  'gt',
  'gte',
  'lt',
  'lte',
  'contains',
  'in',
  'not-in',
  'exists',
  'not-exists',
  'matches',
  'changed-by',
  'stays-true-for-window',
]);
const OUTCOME_AGGREGATIONS = new Set(['latest', 'count', 'sum', 'avg', 'min', 'max', 'ratio', 'distinct-count']);
const OUTCOME_ROLLUP_MODES = new Set(['all-required-children', 'any-child', 'weighted']);
const ATTRIBUTION_VALUES = new Set(['directly-caused', 'materially-assisted', 'influenced', 'prepared']);
const ATTRIBUTION_MULTIPLIERS = {
  'directly-caused': 1,
  'materially-assisted': 0.7,
  influenced: 0.4,
  prepared: 0.2,
};
const CLASS_MULTIPLIERS = {
  terminal: 1,
  enabling: 0.75,
  learning: 0.6,
  invalidation: 0.6,
  constraint: 1,
};
const ACTION_SIGNAL_EMISSIONS = Object.freeze({
  'target-research': ['target-identity-locked'],
  'contact-path-confirmation': ['contact-route-confirmed'],
  'outreach-asset-creation': ['outreach-asset-ready'],
  'send-outreach': ['outreach-sent'],
  'confirm-interest': ['interest-confirmed'],
  'confirm-owner-email': ['owner-email-confirmed'],
  'create-activation-link': ['activation-link-created'],
  'send-activation-link': ['activation-link-sent'],
  'confirm-redemption': ['activation-link-redeemed'],
  'verify-downstream-invite-readiness': ['downstream-invite-ready'],
});
const ACTION_TYPE_NAME_RULES = [
  { actionType: 'target-research', pattern: /lock .*target|target brief|organization brief/i },
  { actionType: 'preprovision-org-team-shell', pattern: /provision .*initial team shell|create .*organization and (?:its|the) first team|org\/team shell/i },
  { actionType: 'verify-downstream-invite-readiness', pattern: /verify .*proof path|downstream invite readiness|readiness contract/i },
  { actionType: 'create-activation-link', pattern: /admin activation handoff|admin-activation invite|generate .*activation/i },
  { actionType: 'send-activation-link', pattern: /send .*activation/i },
  { actionType: 'confirm-redemption', pattern: /confirm .*admin activation|redeem .*admin activation|real admin activation/i },
  { actionType: 'confirm-interest', pattern: /confirm .*interest|record .*interest|interest confirmation|target .*interested/i },
  { actionType: 'confirm-owner-email', pattern: /confirm .*owner email|owner email confirmation|verify .*owner email|bind .*owner email/i },
  { actionType: 'contact-path-confirmation', pattern: /contact path|contact route|confirm .*email|owner email/i },
  { actionType: 'outreach-asset-creation', pattern: /invite package|handoff package|outreach asset|messaging package/i },
  { actionType: 'send-outreach', pattern: /send outreach|deliver outreach/i },
  { actionType: 'reserve-admin-membership', pattern: /reserve admin membership|reserved admin/i },
];
const ACTION_TYPE_RULES = [
  { actionType: 'verify-downstream-invite-readiness', pattern: /source-of-truth proof|proof path|invite readiness|readiness contract/i },
  { actionType: 'create-activation-link', pattern: /admin-activation invite|admin activation handoff|activation link/i },
  { actionType: 'confirm-redemption', pattern: /redeem(?:ed)? .*admin activation|confirm .*admin activation|real admin activation/i },
  { actionType: 'preprovision-org-team-shell', pattern: /provision .*organization|organization and initial team shell|initial team shell|org\/team shell|first team with the correct team type/i },
  { actionType: 'target-research', pattern: /lock .*target|target brief|organization brief|fit rationale/i },
  { actionType: 'confirm-interest', pattern: /confirm .*interest|record .*interest|interest confirmation|target .*interested/i },
  { actionType: 'confirm-owner-email', pattern: /confirm .*owner email|owner email confirmation|verify .*owner email|bind .*owner email/i },
  { actionType: 'contact-path-confirmation', pattern: /contact path|contact route|confirm .*email|owner email/i },
  { actionType: 'outreach-asset-creation', pattern: /invite package|handoff package|outreach asset|messaging package/i },
  { actionType: 'send-activation-link', pattern: /send .*activation/i },
  { actionType: 'send-outreach', pattern: /send outreach|deliver outreach/i },
  { actionType: 'reserve-admin-membership', pattern: /reserve admin membership|reserved admin/i },
];

function toMillis(value) {
  if (!value) return 0;
  if (typeof value?.toDate === 'function') {
    try { return value.toDate().getTime(); } catch (_) { return 0; }
  }
  if (value instanceof Date) return value.getTime();
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeText(value) {
  return String(value || '').trim();
}

function normalizeOutcomeClass(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return OUTCOME_CLASSES.has(normalized) ? normalized : 'enabling';
}

function normalizeOutcomeDomain(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return OUTCOME_DOMAINS.has(normalized) ? normalized : 'system-operations';
}

function normalizeOutcomeStatus(value, fallback = 'planned') {
  const normalized = String(value || '').trim().toLowerCase();
  return OUTCOME_STATUSES.has(normalized) ? normalized : fallback;
}

function normalizeSourceOfTruth(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return OUTCOME_SOURCE_OF_TRUTH.has(normalized) ? normalized : 'runtime';
}

function normalizeObservationWindow(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return OUTCOME_OBSERVATION_WINDOWS.has(normalized) ? normalized : 'immediate';
}

function normalizeEvaluationCadence(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return OUTCOME_EVALUATION_CADENCE.has(normalized) ? normalized : 'instant';
}

function normalizeComparator(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return OUTCOME_COMPARATORS.has(normalized) ? normalized : 'eq';
}

function normalizeAggregation(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return OUTCOME_AGGREGATIONS.has(normalized) ? normalized : 'latest';
}

function normalizeAttribution(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return ATTRIBUTION_VALUES.has(normalized) ? normalized : 'directly-caused';
}

function normalizeRollupMode(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return OUTCOME_ROLLUP_MODES.has(normalized) ? normalized : 'all-required-children';
}

function normalizeMissionPolicy(rawMission = {}, overrides = {}) {
  const systemVersion = Number(
    overrides.systemVersion ??
    rawMission.systemVersion ??
    1
  ) || 1;
  const mode = String(overrides.mode || rawMission.mode || (systemVersion >= MISSION_SYSTEM_VERSION ? DEFAULT_MISSION_MODE : 'explore')).toLowerCase();
  const rawExecuteGateMode = String(overrides.executeGateMode || rawMission.executeGateMode || '').toLowerCase();
  const rawScoreGateMode = String(overrides.scoreGateMode || rawMission.scoreGateMode || '').toLowerCase();
  const scoreGateMode = normalizeScoreGateMode(
    rawScoreGateMode ||
    (['credited-and-net', 'credited-only', 'net-only'].includes(rawExecuteGateMode) ? rawExecuteGateMode : DEFAULT_SCORE_GATE_MODE)
  );
  const executeGateMode = normalizeExecuteGateMode(
    ['strict', 'allow-speculative'].includes(rawExecuteGateMode)
      ? rawExecuteGateMode
      : (Boolean(overrides.canary ?? rawMission.canary) ? 'allow-speculative' : DEFAULT_EXECUTE_GATE_MODE)
  );
  const basePolicy = {
    ...rawMission,
    ...overrides,
    systemVersion,
    mode: mode === 'explore' ? 'explore' : 'execute',
    plannerMode: String(overrides.plannerMode || rawMission.plannerMode || DEFAULT_PLANNER_MODE).toLowerCase() || DEFAULT_PLANNER_MODE,
    stallWindowMinutes: Number(overrides.stallWindowMinutes || rawMission.stallWindowMinutes || DEFAULT_STALL_WINDOW_MINUTES) || DEFAULT_STALL_WINDOW_MINUTES,
    maxActiveTasksPerAgent: Number(overrides.maxActiveTasksPerAgent || rawMission.maxActiveTasksPerAgent || DEFAULT_MAX_ACTIVE_TASKS_PER_AGENT) || DEFAULT_MAX_ACTIVE_TASKS_PER_AGENT,
    maxQueuedExecuteTasksPerAgent: Number(overrides.maxQueuedExecuteTasksPerAgent || rawMission.maxQueuedExecuteTasksPerAgent || DEFAULT_MAX_QUEUED_EXECUTE_TASKS_PER_AGENT) || DEFAULT_MAX_QUEUED_EXECUTE_TASKS_PER_AGENT,
    maxQueuedExploreTasksPerAgent: Number(overrides.maxQueuedExploreTasksPerAgent || rawMission.maxQueuedExploreTasksPerAgent || DEFAULT_MAX_QUEUED_EXPLORE_TASKS_PER_AGENT) || DEFAULT_MAX_QUEUED_EXPLORE_TASKS_PER_AGENT,
    plannerMinimumCreditedScore: Number(overrides.plannerMinimumCreditedScore ?? rawMission.plannerMinimumCreditedScore ?? DEFAULT_PLANNER_MIN_CREDITED_SCORE) || DEFAULT_PLANNER_MIN_CREDITED_SCORE,
    plannerMinimumNetScore: Number(overrides.plannerMinimumNetScore ?? rawMission.plannerMinimumNetScore ?? DEFAULT_PLANNER_MIN_NET_SCORE) || DEFAULT_PLANNER_MIN_NET_SCORE,
    executeGateMode,
    scoreGateMode,
    maxLearningInvalidationWipPct: Number(overrides.maxLearningInvalidationWipPct ?? rawMission.maxLearningInvalidationWipPct ?? DEFAULT_MAX_LEARNING_INVALIDATION_WIP_PCT) || DEFAULT_MAX_LEARNING_INVALIDATION_WIP_PCT,
    allowWaivedCredit: Boolean(overrides.allowWaivedCredit ?? rawMission.allowWaivedCredit ?? DEFAULT_ALLOW_WAIVED_CREDIT),
    maxWaivedCreditPct: Number(overrides.maxWaivedCreditPct ?? rawMission.maxWaivedCreditPct ?? DEFAULT_MAX_WAIVED_CREDIT_PCT) || DEFAULT_MAX_WAIVED_CREDIT_PCT,
    allowNegativeNetScore: Boolean(overrides.allowNegativeNetScore ?? rawMission.allowNegativeNetScore ?? DEFAULT_ALLOW_NEGATIVE_NET_SCORE),
    clampCreditedScoreAtZero: Boolean(overrides.clampCreditedScoreAtZero ?? rawMission.clampCreditedScoreAtZero ?? DEFAULT_CLAMP_CREDITED_SCORE),
    hardFailureNetHandling: String(overrides.hardFailureNetHandling || rawMission.hardFailureNetHandling || DEFAULT_HARD_FAILURE_NET_HANDLING).toLowerCase() || DEFAULT_HARD_FAILURE_NET_HANDLING,
    hardFailureDebtFloor: Number(overrides.hardFailureDebtFloor ?? rawMission.hardFailureDebtFloor ?? DEFAULT_HARD_FAILURE_DEBT_FLOOR) || DEFAULT_HARD_FAILURE_DEBT_FLOOR,
    canary: Boolean(overrides.canary ?? rawMission.canary),
  };
  const instancePolicy = basePolicy.canary
    ? buildCanaryMissionInstancePolicy(basePolicy, overrides)
    : resolveMissionInstancePolicy(basePolicy, overrides);

  return {
    ...basePolicy,
    playbookId: instancePolicy.playbookId || normalizeText(basePolicy.playbookId),
    playbookVersion: Number(instancePolicy.playbookVersion || basePolicy.playbookVersion || 0) || 0,
    playbookFamily: instancePolicy.playbookFamily || normalizeText(basePolicy.playbookFamily),
    currentStageId: instancePolicy.currentStageId || normalizeText(basePolicy.currentStageId),
    currentStageOrdinal: Number(instancePolicy.currentStageOrdinal || basePolicy.currentStageOrdinal || 0) || 0,
    readinessSignals: Array.isArray(instancePolicy.readinessSignals) ? instancePolicy.readinessSignals : (Array.isArray(basePolicy.readinessSignals) ? basePolicy.readinessSignals : []),
    speculativeActionsAllowed: Array.isArray(instancePolicy.speculativeActionsAllowed) ? instancePolicy.speculativeActionsAllowed : (Array.isArray(basePolicy.speculativeActionsAllowed) ? basePolicy.speculativeActionsAllowed : []),
    requiredApprovals: Array.isArray(instancePolicy.requiredApprovals) ? instancePolicy.requiredApprovals : (Array.isArray(basePolicy.requiredApprovals) ? basePolicy.requiredApprovals : []),
    commercialPrimaryDomain: instancePolicy.commercialPrimaryDomain || normalizeText(basePolicy.commercialPrimaryDomain),
    cleanupTTLHours: Number(instancePolicy.cleanupTTLHours || basePolicy.cleanupTTLHours || 0) || 0,
    allowSpeculative: Boolean(instancePolicy.allowSpeculative || executeGateMode === 'allow-speculative'),
    targetEntityPolicy: instancePolicy.targetEntityPolicy || basePolicy.targetEntityPolicy || {},
  };
}

function isMissionSystemV2(mission) {
  return Number(mission?.systemVersion || 0) >= MISSION_SYSTEM_VERSION;
}

function isExecuteMissionActive(mission) {
  const policy = normalizeMissionPolicy(mission || {});
  return isMissionSystemV2(policy) && String(policy.status || '').toLowerCase() === 'active' && policy.mode === 'execute';
}

function isExploreMissionActive(mission) {
  const policy = normalizeMissionPolicy(mission || {});
  return isMissionSystemV2(policy) && String(policy.status || '').toLowerCase() === 'active' && policy.mode === 'explore';
}

function isAutoGeneratedTask(task) {
  return AUTO_GENERATED_SOURCES.has(String(task?.source || '').toLowerCase());
}

function isCorrectionTask(task) {
  const source = String(task?.source || '').toLowerCase();
  const taskClass = String(task?.taskClass || '').toLowerCase();
  const name = String(task?.name || '');
  return CORRECTION_SOURCES.has(source) || taskClass === 'correction' || /^\s*\[correction\]/i.test(name);
}

function isDependencyTask(task) {
  const taskClass = String(task?.taskClass || '').toLowerCase();
  return taskClass === 'dependency-unblocker' || taskClass === 'dependency';
}

function isExpiredTask(task, now = Date.now()) {
  const expiresAtMs = toMillis(task?.expiresAt);
  return expiresAtMs > 0 && expiresAtMs <= now;
}

function isLegacyExecuteTask(task) {
  return String(task?.mode || '').toLowerCase() === 'execute' && Number(task?.specVersion || 0) < MISSION_SYSTEM_VERSION;
}

function normalizePriority(priority) {
  const value = String(priority || '').toLowerCase();
  if (value === 'high' || value === 'urgent') return 3;
  if (value === 'low') return 1;
  return 2;
}

function normalizeArtifactKind(kind) {
  const value = String(kind || '').trim().toLowerCase();
  if (['repo_file', 'runtime_change', 'firestore_change', 'api_behavior', 'external_action', 'content_asset'].includes(value)) {
    return value;
  }
  return '';
}

function normalizeCheckKind(kind) {
  const value = String(kind || '').trim().toLowerCase();
  if (['shell', 'file', 'firestore', 'http', 'manual-spot-check'].includes(value)) {
    return value;
  }
  return '';
}

function buildObjectiveId(raw, fallback = 'OBJECTIVE') {
  const normalized = String(raw || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48);
  return normalized || fallback;
}

function extractTargets(text) {
  const source = String(text || '');
  const matches = new Set();
  const fileRx = /\b(?:src|docs|scripts|functions|PulseCommand|QuickLifts-Web|public|pages|components)\/[A-Za-z0-9_./-]+\.[A-Za-z0-9]+/g;
  const apiRx = /\b\/api\/[A-Za-z0-9/_-]+\b/g;
  const firestoreRx = /\b(?:agent-tasks|agent-deliverables|agent-presence|company-config\/mission-status|company-config\/north-star|mission-runs\/[A-Za-z0-9_-]+)\b/g;
  const uiRx = /\b[A-Z][A-Za-z0-9]+(?:View|Panel|Card|Service|Controller|Page|Screen|Component)\b/g;

  for (const rx of [fileRx, apiRx, firestoreRx, uiRx]) {
    const found = source.match(rx) || [];
    for (const item of found) matches.add(item);
  }

  return Array.from(matches).slice(0, 6);
}

function inferTaskActionType(task = {}) {
  const explicit = normalizeText(task?.actionType);
  if (explicit) return explicit;
  const name = normalizeText(task?.name);
  for (const rule of ACTION_TYPE_NAME_RULES) {
    if (rule.pattern.test(name)) return rule.actionType;
  }
  const text = [name, task?.description, task?.taskClass].filter(Boolean).join('\n');
  for (const rule of ACTION_TYPE_RULES) {
    if (rule.pattern.test(text)) return rule.actionType;
  }
  return 'unspecified-execute-action';
}

function deriveEmittedReadinessSignalIds(actionType) {
  const key = normalizeText(actionType);
  return Array.isArray(ACTION_SIGNAL_EMISSIONS[key]) ? ACTION_SIGNAL_EMISSIONS[key] : [];
}

function inferSideEffectClass(task, artifactSpec) {
  const actionType = inferTaskActionType(task);
  if (actionType === 'send-outreach' || actionType === 'send-activation-link') {
    return 'external-durable';
  }
  const artifactKind = normalizeArtifactKind(artifactSpec?.kind);
  if (artifactKind === 'external_action') return 'external-durable';
  if (artifactKind === 'firestore_change' || artifactKind === 'runtime_change' || artifactKind === 'api_behavior') {
    return 'internal-durable';
  }
  return 'reversible-prepare';
}

function resolveActionPolicy(playbook, actionType, task, missionPolicy, artifactSpec) {
  const normalizedActionType = normalizeText(actionType) || inferTaskActionType(task);
  const matchedPolicy = Array.isArray(playbook?.actionPolicies)
    ? playbook.actionPolicies.find((policy) => normalizeText(policy?.actionType) === normalizedActionType)
    : null;
  if (matchedPolicy) return matchedPolicy;
  return {
    id: normalizedActionType || 'unspecified-execute-action',
    actionType: normalizedActionType || 'unspecified-execute-action',
    label: normalizeText(task?.name) || normalizedActionType || 'Execute action',
    description: normalizeText(task?.description),
    sideEffectClass: inferSideEffectClass(task, artifactSpec),
    requiredStageId: normalizeText(missionPolicy?.currentStageId),
    requiredReadinessSignalIds: [],
    requiredApprovalTypes: [],
    allowSpeculative: inferSideEffectClass(task, artifactSpec) !== 'external-durable',
    defaultCreditMode: inferSideEffectClass(task, artifactSpec) === 'external-durable' ? 'commercial' : 'execution',
    cleanupTTLHours: Number(missionPolicy?.cleanupTTLHours || 0) || 0,
  };
}

function buildScoreGateStatus(taskFields, missionPolicy) {
  return passesExecuteGate(taskFields, missionPolicy) ? 'passed' : 'failed';
}

function buildTaskAdmission(task, options = {}) {
  const missionPolicy = normalizeMissionPolicy(options.missionPolicy || {});
  const playbook = missionPolicy.playbookId ? resolveMissionPlaybook(missionPolicy) : null;
  const artifactSpec = options.artifactSpec || task?.artifactSpec || inferArtifactSpec(task);
  const actionType = normalizeText(options.actionType || task?.actionType || inferTaskActionType(task));
  const actionPolicy = resolveActionPolicy(playbook, actionType, task, missionPolicy, artifactSpec);
  const speculativeActionsAllowed = Array.isArray(missionPolicy.speculativeActionsAllowed)
    ? missionPolicy.speculativeActionsAllowed.map((item) => normalizeText(item)).filter(Boolean)
    : [];
  const allowSpeculativeForAction = Boolean(
    actionPolicy.allowSpeculative &&
    (
      missionPolicy.allowSpeculative ||
      speculativeActionsAllowed.includes(actionType)
    )
  );
  const emittedReadinessSignalIds = Array.from(new Set(
    (Array.isArray(options.emittedReadinessSignalIds) ? options.emittedReadinessSignalIds : deriveEmittedReadinessSignalIds(actionType))
      .map((item) => normalizeText(item))
      .filter(Boolean)
  ));
  const requiredStage = resolveStage(playbook?.stageGraph || [], actionPolicy.requiredStageId).stage;
  const currentStage = resolveStage(playbook?.stageGraph || [], missionPolicy.currentStageId).stage;
  let effectiveRequiredStageId = normalizeText(actionPolicy.requiredStageId || missionPolicy.currentStageId);
  if (requiredStage && currentStage && compareStagePositions(playbook?.stageGraph || [], currentStage.id, requiredStage.id) < 0) {
    const stageEntrySignals = Array.isArray(requiredStage.entrySignalIds) ? requiredStage.entrySignalIds : [];
    const advancesIntoRequiredStage =
      stageEntrySignals.length > 0 &&
      stageEntrySignals.every((signalId) => emittedReadinessSignalIds.includes(signalId)) &&
      compareStagePositions(playbook?.stageGraph || [], currentStage.id, requiredStage.id) === -1;
    if (advancesIntoRequiredStage) {
      effectiveRequiredStageId = currentStage.id;
    }
  }
  const requiredReadinessSignalIds = (Array.isArray(actionPolicy.requiredReadinessSignalIds) ? actionPolicy.requiredReadinessSignalIds : [])
    .map((item) => normalizeText(item))
    .filter((item) => item && !emittedReadinessSignalIds.includes(item));
  const readinessDecision = buildAdmissionReadinessDecision({
    readinessSignals: missionPolicy.readinessSignals,
    stageGraph: playbook?.stageGraph || [],
    currentStageId: missionPolicy.currentStageId,
    requiredStageId: effectiveRequiredStageId,
    requiredReadinessSignalIds,
    approvalEvents: options.approvalEvents || missionPolicy.approvalEvents || [],
    requiredApprovalTypes: actionPolicy.requiredApprovalTypes || [],
    actionPolicy,
    missionPolicy,
    sideEffectClass: actionPolicy.sideEffectClass || inferSideEffectClass(task, artifactSpec),
    speculative: false,
    allowSpeculative: allowSpeculativeForAction,
    scoreItems: [{
      id: task?.id || normalizeText(task?.name) || actionType || 'task',
      creditedOutcomeScore: Number(options.expectedCreditedScore ?? task?.expectedCreditedScore ?? 0) || 0,
      netOutcomeScore: Number(options.expectedNetScore ?? task?.expectedNetScore ?? options.expectedCreditedScore ?? 0) || 0,
      businessDebtScore: 0,
    }],
    creditMode: actionPolicy.defaultCreditMode,
    commercialCreditEligible: true,
    cleanupBy: null,
    now: options.now instanceof Date ? options.now : new Date(),
  });
  const scoreGateStatus = buildScoreGateStatus(
    {
      expectedCreditedScore: Number(options.expectedCreditedScore ?? task?.expectedCreditedScore ?? 0) || 0,
      expectedNetScore: Number(options.expectedNetScore ?? task?.expectedNetScore ?? 0) || 0,
      expectedOutcomeScore: Number(options.expectedOutcomeScore ?? task?.expectedOutcomeScore ?? 0) || 0,
      proofCompileStatus: options.proofCompileStatus || task?.proofCompileStatus,
    },
    missionPolicy
  );
  const stageGate = readinessDecision.stageGate || {};
  const lifecycle = readinessDecision.lifecycle || {};
  const creditBucket = normalizeCreditBucket(readinessDecision.creditBucket || 'none');
  const speculative = Boolean(stageGate.status === 'speculative');
  const commercialCreditEligible = creditBucket === 'commercial' && !speculative;
  return {
    playbookId: missionPolicy.playbookId || '',
    playbookVersion: Number(missionPolicy.playbookVersion || 0) || 0,
    actionType,
    actionPolicy,
    sideEffectClass: normalizeSideEffectClass(readinessDecision.sideEffectClass || actionPolicy.sideEffectClass || inferSideEffectClass(task, artifactSpec)),
    creditBucket,
    speculative,
    commercialCreditEligible,
    emittedReadinessSignalIds,
    requiredReadinessSignalIds,
    requiredStageId: effectiveRequiredStageId || '',
    currentStageId: normalizeText(stageGate.currentStageId || missionPolicy.currentStageId),
    stageGateStatus: normalizeText(stageGate.status || 'blocked'),
    stageBlockReason: normalizeText(stageGate.blockReasonDetail || stageGate.blockReasonCode),
    readinessSignals: Array.isArray(readinessDecision.readinessSignals) ? readinessDecision.readinessSignals : (Array.isArray(missionPolicy.readinessSignals) ? missionPolicy.readinessSignals : []),
    cleanupBy: lifecycle.cleanupBy || null,
    cleanupState: normalizeCleanupState(lifecycle.cleanupState || 'none'),
    admissionDecision: buildAdmissionDecision({
      missionId: normalizeText(task?.missionId || options.missionId || missionPolicy.missionId),
      playbookId: missionPolicy.playbookId,
      playbookVersion: missionPolicy.playbookVersion,
      taskId: normalizeText(task?.id),
      outcomeId: normalizeText(task?.outcomeId || options.outcomeId),
      proofCompileStatus: String(options.proofCompileStatus || task?.proofCompileStatus || '').toLowerCase() === 'dry-run-passed' ? 'passed' : 'failed',
      stageGateStatus: stageGate.status,
      scoreGateStatus,
      sideEffectClass: stageGate.sideEffectClass || actionPolicy.sideEffectClass,
      creditBucket,
      speculative,
      commercialCreditEligible,
      currentStageId: stageGate.currentStageId || missionPolicy.currentStageId,
      requiredStageId: effectiveRequiredStageId,
      satisfiedReadinessSignalIds: stageGate.satisfiedReadinessSignalIds,
      missingReadinessSignalIds: stageGate.missingReadinessSignalIds,
      requiredApprovalEventIds: stageGate.requiredApprovalEventIds,
      cleanupBy: lifecycle.cleanupBy,
      cleanupState: lifecycle.cleanupState,
      admitExecuteTask: String(options.proofCompileStatus || task?.proofCompileStatus || '').toLowerCase() === 'dry-run-passed'
        && stageGate.status !== 'blocked'
        && scoreGateStatus === 'passed',
      blockReasonCode: stageGate.blockReasonCode,
      blockReasonDetail: stageGate.blockReasonDetail,
    }),
  };
}

function inferArtifactSpec(task) {
  const text = [task?.name, task?.description].filter(Boolean).join('\n');
  const targets = extractTargets(text);
  const firstTarget = targets[0] || '';

  let kind = '';
  if (firstTarget.startsWith('/api/')) {
    kind = 'api_behavior';
  } else if (firstTarget.includes('/') && /\.[A-Za-z0-9]+$/.test(firstTarget)) {
    kind = 'repo_file';
  } else if (/agent-tasks|agent-deliverables|agent-presence|company-config/.test(firstTarget)) {
    kind = 'firestore_change';
  } else if (/landing page|ui|component|screen|panel|dashboard/i.test(text)) {
    kind = 'runtime_change';
  } else if (/doc|brief|memo|copy|content|narrative|messaging/i.test(text)) {
    kind = 'content_asset';
  } else {
    kind = 'runtime_change';
  }

  const successDefinition = firstTarget
    ? `Deliver the planned change touching ${firstTarget} and satisfy the acceptance checks.`
    : `Deliver the planned change and satisfy the acceptance checks.`;

  return {
    kind,
    targets: targets.length > 0 ? targets : [String(task?.name || 'deliverable').slice(0, 80)],
    successDefinition,
    mustTouchRepo: kind !== 'firestore_change' && kind !== 'external_action',
    impactScope: kind === 'content_asset' ? 'supporting' : 'user-facing',
  };
}

function inferAcceptanceChecks(task, artifactSpec) {
  const targets = Array.isArray(artifactSpec?.targets) ? artifactSpec.targets : [];
  const firstTarget = String(targets[0] || '').trim();
  const checks = [];

  if (artifactSpec?.kind === 'repo_file' && firstTarget) {
    checks.push({
      kind: 'file',
      label: `Artifact exists: ${firstTarget}`,
      commandOrPath: firstTarget,
      expectedSignal: 'File exists and is readable.',
    });
    checks.push({
      kind: 'manual-spot-check',
      label: `Review behavior linked to ${firstTarget}`,
      commandOrPath: firstTarget,
      expectedSignal: 'Human spot-check confirms the change delivers the intended behavior.',
    });
    return checks;
  }

  if (artifactSpec?.kind === 'api_behavior' && firstTarget) {
    checks.push({
      kind: 'http',
      label: `Endpoint responds: ${firstTarget}`,
      commandOrPath: firstTarget,
      expectedSignal: 'Endpoint returns a successful response for the intended scenario.',
    });
    checks.push({
      kind: 'manual-spot-check',
      label: `Confirm API outcome for ${firstTarget}`,
      commandOrPath: firstTarget,
      expectedSignal: 'Response payload shows the expected new behavior.',
    });
    return checks;
  }

  if (artifactSpec?.kind === 'firestore_change' && firstTarget) {
    checks.push({
      kind: 'firestore',
      label: `Firestore target updated: ${firstTarget}`,
      commandOrPath: firstTarget,
      expectedSignal: 'Document or collection reflects the intended change.',
    });
    checks.push({
      kind: 'manual-spot-check',
      label: `Confirm downstream effect of ${firstTarget}`,
      commandOrPath: firstTarget,
      expectedSignal: 'Human spot-check confirms the change drives the intended system outcome.',
    });
    return checks;
  }

  checks.push({
    kind: 'shell',
    label: 'Repo changed during execution',
    commandOrPath: 'git status --short',
    expectedSignal: 'Relevant task artifacts appear in the working tree or commit output.',
  });
  checks.push({
    kind: 'manual-spot-check',
    label: 'Confirm intended impact',
    commandOrPath: firstTarget || String(task?.name || '').slice(0, 120),
    expectedSignal: 'Human spot-check confirms the change is real and aligned to the objective.',
  });
  return checks;
}

function slugifyKey(value, fallback = 'unknown') {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized || fallback;
}

function extractVersion(value, fallback = 'v1') {
  const match = String(value || '').match(/(v\d+(?:\.\d+)*)$/i);
  return match?.[1] || fallback;
}

function inferOutcomeDomain(task, artifactSpec = {}) {
  const text = [task?.name, task?.description, task?.northStarObjective, task?.northStarObjectiveLink]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (/partnership|referral partner|channel partner/.test(text)) return 'partnerships';
  if (/meeting|calendar|intro|buyer|prospect|lead|proposal|pipeline/.test(text)) return 'pipeline';
  if (/revenue|billing|contract|paid|deal|mrr|checkout|invoice|proposal/.test(text)) return 'revenue';
  if (/campaign|ad set|creative|landing page|distribution|audience/.test(text)) return 'distribution';
  if (/activation|onboarding|aha|first value|signup/.test(text)) return 'activation';
  if (/retention|renewal|churn|reactivation|save/.test(text)) return 'retention';
  if (/testimonial|case study|credibility|proof asset|social proof/.test(text)) return 'credibility';
  if (/service quality|sla|latency|hallucination|accuracy|compliance/.test(text)) return 'service-quality';
  if (artifactSpec?.kind === 'firestore_change' || /schema|pipeline|backfill|dataset|analytics|enrichment|record/.test(text)) return 'data';
  return 'system-operations';
}

function inferOutcomeClass(task, artifactSpec = {}, outcomeDomain = 'system-operations') {
  const taskClass = String(task?.taskClass || '').toLowerCase();
  const text = [task?.name, task?.description].filter(Boolean).join(' ').toLowerCase();

  if (String(task?.mode || '').toLowerCase() === 'explore') return 'learning';
  if (/invalidate|rule out|kill test|disprove|sunset/.test(text)) return 'invalidation';
  if (taskClass === 'correction' || /reliability|compliance|guardrail|quality|hallucination/.test(text)) return 'constraint';
  if (
    artifactSpec?.kind === 'external_action' ||
    /meeting booked|accepted meeting|contract active|billing active|renewed|campaign live|proposal sent|customer activated/.test(text)
  ) {
    return 'terminal';
  }
  if (['pipeline', 'revenue', 'partnerships', 'distribution', 'activation', 'retention', 'credibility'].includes(outcomeDomain) && /launch|activate|ship live|go live/.test(text)) {
    return 'terminal';
  }
  return 'enabling';
}

function inferOutcomeRole(outcomeClass) {
  return outcomeClass === 'terminal' ? 'primary' : 'supporting';
}

function inferObservationWindow(outcomeClass, outcomeDomain) {
  if (outcomeClass === 'learning' || outcomeClass === 'invalidation') return 'immediate';
  if (outcomeDomain === 'distribution' || outcomeDomain === 'activation') return '72h';
  if (outcomeDomain === 'revenue') return '14d';
  if (outcomeDomain === 'retention') return '30d';
  if (outcomeDomain === 'service-quality') return '14d';
  return 'immediate';
}

function observationWindowToDays(window) {
  switch (normalizeObservationWindow(window)) {
    case '72h': return 3;
    case '14d': return 14;
    case '30d': return 30;
    case 'renewal-cycle': return 30;
    case 'custom': return 7;
    case 'immediate':
    default:
      return 0;
  }
}

function observationWindowToMs(window, customDays = 0) {
  const normalized = normalizeObservationWindow(window);
  if (normalized === 'custom' && customDays > 0) {
    return customDays * 24 * 60 * 60 * 1000;
  }
  return observationWindowToDays(normalized) * 24 * 60 * 60 * 1000;
}

function outcomeClassMultiplier(outcomeClass, missionCritical = false) {
  const normalized = normalizeOutcomeClass(outcomeClass);
  if (normalized === 'constraint' && !missionCritical) return 0.5;
  return CLASS_MULTIPLIERS[normalized] || 1;
}

function buildOutcomePolicyRefs(task, outcomeClass, outcomeDomain, missionPolicy = {}) {
  const mode = String(missionPolicy?.mode || DEFAULT_MISSION_MODE).toLowerCase();
  const versionSuffix = `v${Number(missionPolicy?.systemVersion || MISSION_SYSTEM_VERSION)}`;
  const refs = {
    missionPolicyId: normalizeText(task?.proofPacket?.policyRefs?.missionPolicyId) || `mission-policy-${mode}-${versionSuffix}`,
    domainPolicyId: normalizeText(task?.proofPacket?.policyRefs?.domainPolicyId) || `domain-policy-${outcomeDomain}-${versionSuffix}`,
    scoreCalibrationPackId: normalizeText(task?.proofPacket?.policyRefs?.scoreCalibrationPackId) || `score-pack-${outcomeDomain}-${outcomeClass}-${versionSuffix}`,
    benchmarkPolicyIds: Array.isArray(task?.proofPacket?.policyRefs?.benchmarkPolicyIds) && task.proofPacket.policyRefs.benchmarkPolicyIds.length > 0
      ? task.proofPacket.policyRefs.benchmarkPolicyIds.filter(Boolean)
      : [`benchmarks-${outcomeDomain}-${versionSuffix}`],
    riskPolicyId: normalizeText(task?.proofPacket?.policyRefs?.riskPolicyId) || `risk-policy-${outcomeDomain}-${versionSuffix}`,
    qualityPolicyId: normalizeText(task?.proofPacket?.policyRefs?.qualityPolicyId) || `quality-policy-${outcomeDomain}-${versionSuffix}`,
  };

  if (['pipeline', 'partnerships', 'revenue'].includes(outcomeDomain)) {
    refs.icpPolicyId = normalizeText(task?.proofPacket?.policyRefs?.icpPolicyId) || `icp-policy-${outcomeDomain}-${versionSuffix}`;
  }
  if (outcomeDomain === 'revenue') {
    refs.revenuePolicyId = normalizeText(task?.proofPacket?.policyRefs?.revenuePolicyId) || `revenue-policy-${versionSuffix}`;
  }
  if (outcomeDomain === 'service-quality') {
    refs.servicePolicyId = normalizeText(task?.proofPacket?.policyRefs?.servicePolicyId) || `service-policy-${versionSuffix}`;
  }

  return refs;
}

function buildOutcomeIdentityContract(task, outcomeClass, outcomeDomain) {
  const taskKey = slugifyKey(task?.name || task?.objectiveId || 'outcome');
  const missionKey = slugifyKey(task?.missionId || 'mission');
  const objectiveKey = slugifyKey(task?.objectiveId || task?.northStarObjectiveLink || task?.northStarObjective || 'objective');
  return {
    externalEventKeyTemplate: normalizeText(task?.proofPacket?.identity?.externalEventKeyTemplate) || `${missionKey}:${objectiveKey}:${taskKey}`,
    dedupeKeyTemplate: normalizeText(task?.proofPacket?.identity?.dedupeKeyTemplate) || `${objectiveKey}:${outcomeDomain}:${taskKey}`,
    canonicalAccountIdTemplate: normalizeText(task?.proofPacket?.identity?.canonicalAccountIdTemplate) || `${missionKey}:${outcomeDomain}`,
    canonicalContactIdTemplate: normalizeText(task?.proofPacket?.identity?.canonicalContactIdTemplate) || `${objectiveKey}:${taskKey}`,
    canonicalObjectIdTemplates: Array.isArray(task?.proofPacket?.identity?.canonicalObjectIdTemplates)
      ? task.proofPacket.identity.canonicalObjectIdTemplates.filter(Boolean)
      : Array.from(new Set((task?.artifactSpec?.targets || []).map((target) => slugifyKey(target)).filter(Boolean))).slice(0, 4),
    allowSupersession: Boolean(task?.proofPacket?.identity?.allowSupersession ?? outcomeClass === 'terminal'),
  };
}

function sourceOfTruthForCheck(check) {
  const kind = normalizeCheckKind(check?.kind);
  if (kind === 'file' || kind === 'shell') return 'repo';
  if (kind === 'firestore') return 'firestore';
  if (kind === 'http') return 'http';
  if (kind === 'manual-spot-check') return 'manual-review';
  return 'runtime';
}

function buildSourceQueryForCheck(check, index, artifactSpec) {
  const kind = normalizeCheckKind(check?.kind);
  const commandOrPath = normalizeText(check?.commandOrPath);
  const id = `check-source-${index + 1}`;
  const base = {
    id,
    sourceOfTruth: sourceOfTruthForCheck(check),
    locationType: 'report',
    notes: normalizeText(check?.label) || `Acceptance check ${index + 1}`,
  };

  if (kind === 'file') {
    return { ...base, locationType: 'doc', path: commandOrPath, objectType: artifactSpec?.kind || 'repo_file' };
  }
  if (kind === 'firestore') {
    const segments = commandOrPath.split('/').filter(Boolean);
    return {
      ...base,
      locationType: segments.length >= 2 && segments.length % 2 === 0 ? 'doc' : 'collection',
      path: commandOrPath,
      collection: segments[0] || commandOrPath,
      objectType: 'firestore-target',
    };
  }
  if (kind === 'http') {
    return { ...base, locationType: 'api-endpoint', endpoint: commandOrPath, objectType: artifactSpec?.kind || 'api_behavior' };
  }
  if (kind === 'shell') {
    return { ...base, locationType: 'report', objectType: 'shell-check', path: commandOrPath };
  }
  return { ...base, locationType: 'report', objectType: 'manual-review' };
}

function buildMetricRefForCheck(check, sourceQueryId, index) {
  const kind = normalizeCheckKind(check?.kind);
  let fieldPath = 'result';
  let unit = 'string';
  if (kind === 'file' || kind === 'firestore') {
    fieldPath = 'exists';
    unit = 'boolean';
  } else if (kind === 'http') {
    fieldPath = 'status';
    unit = 'count';
  } else if (kind === 'manual-spot-check') {
    fieldPath = 'review';
    unit = 'boolean';
  } else if (kind === 'shell') {
    fieldPath = 'output';
    unit = 'string';
  }
  return {
    id: `metric-${index + 1}`,
    sourceQueryId,
    fieldPath,
    aggregation: 'latest',
    unit,
  };
}

function buildPredicateForCheck(check, metricRefId, index, requiredForPass = true) {
  const kind = normalizeCheckKind(check?.kind);
  let comparator = 'exists';
  let expectedValue = true;
  if (kind === 'http') {
    comparator = 'gte';
    expectedValue = 200;
  } else if (kind === 'shell') {
    comparator = 'exists';
    expectedValue = true;
  } else if (kind === 'manual-spot-check') {
    comparator = 'eq';
    expectedValue = true;
  }
  return {
    id: `predicate-${index + 1}`,
    label: normalizeText(check?.label) || `Acceptance predicate ${index + 1}`,
    metricRefId,
    comparator,
    expectedValue,
    requiredForPass,
  };
}

function buildCompileChecks() {
  return [
    { id: 'resolve-policy', kind: 'resolve-policy', required: true },
    { id: 'resolve-query', kind: 'resolve-query', required: true },
    { id: 'resolve-metric', kind: 'resolve-metric', required: true },
    { id: 'schema-sample', kind: 'schema-sample', required: true },
    { id: 'timezone-check', kind: 'timezone-check', required: true },
  ];
}

function stableHash(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function compileProofPacket(proofPacket) {
  const packet = proofPacket || {};
  const errors = [];
  const sourceQueries = Array.isArray(packet.sourceQueries) ? packet.sourceQueries : [];
  const metricRefs = Array.isArray(packet.metricRefs) ? packet.metricRefs : [];
  const sourceIds = new Set(sourceQueries.map((item) => String(item?.id || '').trim()).filter(Boolean));
  const metricIds = new Set(metricRefs.map((item) => String(item?.id || '').trim()).filter(Boolean));
  const predicateSets = [
    ...(Array.isArray(packet.qualificationCriteria) ? packet.qualificationCriteria : []),
    ...(Array.isArray(packet.successCriteria) ? packet.successCriteria : []),
    ...(Array.isArray(packet.failureCriteria) ? packet.failureCriteria : []),
    ...(Array.isArray(packet.expiryCriteria) ? packet.expiryCriteria : []),
    ...(Array.isArray(packet.businessEffectCriteria) ? packet.businessEffectCriteria : []),
  ];
  const evidenceRequirements = Array.isArray(packet.evidenceRequirements) ? packet.evidenceRequirements : [];

  if (!packet?.policyRefs?.missionPolicyId) errors.push('Missing mission policy ref.');
  if (!packet?.policyRefs?.domainPolicyId) errors.push('Missing domain policy ref.');
  if (!packet?.policyRefs?.scoreCalibrationPackId) errors.push('Missing score calibration pack ref.');
  if (sourceQueries.length === 0) errors.push('Proof packet requires at least one source query.');
  if (metricRefs.length === 0) errors.push('Proof packet requires at least one metric ref.');
  if (!String(packet.primaryMetricRefId || '').trim()) errors.push('Missing primary metric ref id.');
  if (String(packet.primaryMetricRefId || '').trim() && !metricIds.has(String(packet.primaryMetricRefId).trim())) {
    errors.push(`Primary metric ref ${packet.primaryMetricRefId} does not exist.`);
  }

  for (const metricRef of metricRefs) {
    if (!sourceIds.has(String(metricRef?.sourceQueryId || '').trim())) {
      errors.push(`Metric ref ${metricRef?.id || 'unknown'} references missing source query ${metricRef?.sourceQueryId || 'unknown'}.`);
    }
  }

  for (const predicate of predicateSets) {
    if (!metricIds.has(String(predicate?.metricRefId || '').trim())) {
      errors.push(`Predicate ${predicate?.id || predicate?.label || 'unknown'} references missing metric ref ${predicate?.metricRefId || 'unknown'}.`);
    }
  }

  for (const evidenceRequirement of evidenceRequirements) {
    if (!sourceIds.has(String(evidenceRequirement?.sourceQueryId || '').trim())) {
      errors.push(`Evidence requirement ${evidenceRequirement?.id || 'unknown'} references missing source query ${evidenceRequirement?.sourceQueryId || 'unknown'}.`);
    }
  }

  const compilePayload = {
    policyRefs: packet.policyRefs,
    identity: packet.identity,
    sourceQueries,
    metricRefs,
    qualificationCriteria: packet.qualificationCriteria,
    successCriteria: packet.successCriteria,
    failureCriteria: packet.failureCriteria,
    expiryCriteria: packet.expiryCriteria,
    businessEffectCriteria: packet.businessEffectCriteria,
    observationWindow: packet.observationWindow,
    evaluationCadence: packet.evaluationCadence,
    ownerReviewer: packet.ownerReviewer,
    attributionExpected: packet.attributionExpected,
    primaryMetricRefId: packet.primaryMetricRefId,
    evidenceRequirements,
    compileChecks: packet.compileChecks,
    guardrails: packet.guardrails,
  };

  return {
    status: errors.length > 0 ? 'dry-run-failed' : 'dry-run-passed',
    compiledAt: new Date().toISOString(),
    dryRunAt: new Date().toISOString(),
    compiledProofPacketHash: stableHash(compilePayload),
    errors,
  };
}

function buildResolvedPolicySnapshot(policyRefs) {
  return {
    missionPolicyVersion: extractVersion(policyRefs?.missionPolicyId, 'v2'),
    domainPolicyVersion: extractVersion(policyRefs?.domainPolicyId, 'v1'),
    scoreCalibrationPackVersion: extractVersion(policyRefs?.scoreCalibrationPackId, 'v1'),
    benchmarkPolicyVersions: Object.fromEntries(
      (Array.isArray(policyRefs?.benchmarkPolicyIds) ? policyRefs.benchmarkPolicyIds : [])
        .filter(Boolean)
        .map((policyId) => [policyId, extractVersion(policyId, 'v1')])
    ),
    riskPolicyVersion: extractVersion(policyRefs?.riskPolicyId, 'v1'),
    qualityPolicyVersion: extractVersion(policyRefs?.qualityPolicyId, 'v1'),
    frozenAt: new Date(),
  };
}

function calculateOutcomeScore(task, options = {}) {
  const missionPolicy = normalizeMissionPolicy(options.missionPolicy || {});
  const outcomeClass = normalizeOutcomeClass(options.outcomeClass || task?.outcomeClass);
  const outcomeDomain = normalizeOutcomeDomain(options.outcomeDomain || task?.outcomeDomain);
  const attribution = normalizeAttribution(options.attribution || task?.expectedAttribution || task?.proofPacket?.attributionExpected);
  const observationWindow = normalizeObservationWindow(options.observationWindow || task?.proofPacket?.observationWindow);
  const impactScope = String(options.impactScope || task?.artifactSpec?.impactScope || '').toLowerCase();
  const priorityScore = Number(options.priorityScore ?? task?.priorityScore ?? 20) || 20;
  const hardFailure = options.hardFailure === true;
  const missionCritical = options.missionCritical === true || outcomeClass === 'constraint';

  let impact = outcomeClass === 'terminal' ? 20 : outcomeClass === 'constraint' ? 14 : outcomeClass === 'enabling' ? 12 : 8;
  if (['revenue', 'pipeline', 'partnerships'].includes(outcomeDomain)) impact += 3;
  if (['distribution', 'activation', 'retention'].includes(outcomeDomain)) impact += 2;
  if (impactScope === 'user-facing' || impactScope === 'external') impact += 1;
  if (priorityScore >= 30) impact += 1;
  impact = Math.max(0, Math.min(25, impact));

  let evidenceStrength = Math.min(20, 10 + Math.max(0, (Array.isArray(task?.acceptanceChecks) ? task.acceptanceChecks.length : 0) * 2));
  if (String(options.proofCompileStatus || task?.proofCompileStatus || '').toLowerCase() === 'dry-run-passed') {
    evidenceStrength = Math.min(20, evidenceStrength + 3);
  }
  if (options.verificationPassed === true) {
    evidenceStrength = Math.min(20, evidenceStrength + 2);
  }
  if (hardFailure) evidenceStrength = Math.max(0, evidenceStrength - 6);

  let causalConfidence = outcomeClass === 'terminal' ? 11 : outcomeClass === 'enabling' ? 9 : 8;
  if (String(task?.taskClass || '').toLowerCase() === 'correction') causalConfidence += 1;
  if (options.verificationPassed === true) causalConfidence += 1;
  if (hardFailure) causalConfidence = Math.max(0, causalConfidence - 4);
  causalConfidence = Math.max(0, Math.min(15, causalConfidence));

  let timeToSignal = 10;
  if (observationWindow === '72h') timeToSignal = 8;
  else if (observationWindow === '14d') timeToSignal = 5;
  else if (observationWindow === '30d') timeToSignal = 3;
  else if (observationWindow === 'renewal-cycle' || observationWindow === 'custom') timeToSignal = 1;

  let strategicLeverage = outcomeClass === 'enabling' ? 8 : 6;
  if (['data', 'system-operations', 'service-quality'].includes(outcomeDomain)) strategicLeverage += 1;
  if (impactScope === 'internal') strategicLeverage += 1;
  strategicLeverage = Math.max(0, Math.min(10, strategicLeverage));

  let valueQuality = outcomeClass === 'learning' || outcomeClass === 'invalidation' ? 7 : 8;
  if (['revenue', 'pipeline', 'partnerships'].includes(outcomeDomain)) valueQuality += 1;
  if (hardFailure) valueQuality = Math.max(0, valueQuality - 4);
  valueQuality = Math.max(0, Math.min(10, valueQuality));

  let riskPenalty = 0;
  if (options.guardrailFailed === true) riskPenalty = -25;
  else if (options.spotCheckRequired === true && options.verificationPassed !== true) riskPenalty = -10;
  else if (hardFailure) riskPenalty = -15;

  const rawScore = impact + evidenceStrength + causalConfidence + timeToSignal + strategicLeverage + valueQuality + riskPenalty;
  const classMultiplier = outcomeClassMultiplier(outcomeClass, missionCritical);
  const attributionMultiplier = ATTRIBUTION_MULTIPLIERS[attribution] || 1;
  const finalOutcomeScore = rawScore * classMultiplier * attributionMultiplier;

  const hardFailureTriggered = hardFailure || evidenceStrength < 12 || valueQuality < 6 || options.guardrailFailed === true;
  const prePolicyNetOutcomeScore = hardFailureTriggered
    ? (
        missionPolicy.hardFailureNetHandling === 'force-debt'
          ? Math.min(finalOutcomeScore, -Math.max(Number(missionPolicy.hardFailureDebtFloor || 1), 1))
          : Math.min(finalOutcomeScore, 0)
      )
    : finalOutcomeScore;
  const netOutcomeScore = missionPolicy.allowNegativeNetScore ? prePolicyNetOutcomeScore : Math.max(prePolicyNetOutcomeScore, 0);
  const creditedOutcomeScore = missionPolicy.clampCreditedScoreAtZero ? Math.max(netOutcomeScore, 0) : netOutcomeScore;
  const businessDebtScore = missionPolicy.allowNegativeNetScore ? Math.abs(Math.min(netOutcomeScore, 0)) : 0;

  return {
    impact,
    evidenceStrength,
    causalConfidence,
    timeToSignal,
    strategicLeverage,
    valueQuality,
    riskPenalty,
    rawScore,
    classMultiplier,
    attributionMultiplier,
    finalOutcomeScore,
    creditedOutcomeScore,
    netOutcomeScore,
    businessDebtScore,
    hardFailure: hardFailureTriggered,
  };
}

function buildOutcomeProofPacket(task, missionPolicy = {}, outcomeClass, outcomeDomain, artifactSpec, acceptanceChecks) {
  const policyRefs = buildOutcomePolicyRefs(task, outcomeClass, outcomeDomain, missionPolicy);
  const observationWindow = inferObservationWindow(outcomeClass, outcomeDomain);
  const sourceQueries = acceptanceChecks.map((check, index) => buildSourceQueryForCheck(check, index, artifactSpec));
  const metricRefs = acceptanceChecks.map((check, index) => buildMetricRefForCheck(check, sourceQueries[index].id, index));
  const successCriteria = acceptanceChecks.map((check, index) => buildPredicateForCheck(check, metricRefs[index].id, index, true));
  const businessEffectCriteria = metricRefs.length > 1
    ? [buildPredicateForCheck(acceptanceChecks[metricRefs.length - 1], metricRefs[metricRefs.length - 1].id, metricRefs.length, outcomeClass === 'terminal')]
    : [];
  const evidenceRequirements = sourceQueries.map((query, index) => ({
    id: `evidence-${index + 1}`,
    sourceQueryId: query.id,
    minimumRecords: 1,
    snapshotRequired: true,
    freshnessWindowHours: observationWindow === 'immediate' ? 24 : 72,
  }));
  const proofPacket = {
    policyRefs,
    identity: buildOutcomeIdentityContract(task, outcomeClass, outcomeDomain),
    sourceQueries,
    metricRefs,
    qualificationCriteria: [],
    successCriteria,
    failureCriteria: [],
    expiryCriteria: [],
    businessEffectCriteria,
    observationWindow,
    observationWindowDays: observationWindowToDays(observationWindow),
    evaluationCadence: observationWindow === 'immediate' ? 'instant' : 'daily',
    ownerReviewer: normalizeText(task?.assignee || task?.agentId || task?.plannerSource || 'nora'),
    attributionExpected: normalizeAttribution(task?.expectedAttribution || 'directly-caused'),
    primaryMetricRefId: metricRefs[0]?.id || '',
    secondaryMetricRefIds: metricRefs.slice(1).map((item) => item.id),
    evidenceRequirements,
    compileChecks: buildCompileChecks(),
    guardrails: [],
    notes: normalizeText(task?.artifactSpec?.successDefinition || task?.description),
  };

  const compileResult = compileProofPacket(proofPacket);
  proofPacket.compileResult = compileResult;
  return proofPacket;
}

function buildOutcomeEvidenceFromChecks(checks = [], status = 'confirmed', observedAt = new Date()) {
  return checks.map((check, index) => ({
    id: `evidence-${index + 1}`,
    sourceType: sourceOfTruthForCheck(check),
    sourceRef: normalizeText(check?.commandOrPath) || normalizeText(check?.label) || `check-${index + 1}`,
    observedValue: typeof check?.output === 'string' && check.output.length > 0
      ? check.output
      : Boolean(check?.passed),
    observedAt,
    qualifies: Boolean(check?.passed),
    notes: normalizeText(check?.label),
  }));
}

function buildOutcomeRecord(task, options = {}) {
  const missionPolicy = normalizeMissionPolicy(options.missionPolicy || {});
  const artifactSpec = options.artifactSpec || task?.artifactSpec || inferArtifactSpec(task);
  const acceptanceChecks = Array.isArray(options.acceptanceChecks || task?.acceptanceChecks)
    ? (options.acceptanceChecks || task.acceptanceChecks)
    : inferAcceptanceChecks(task, artifactSpec);
  const outcomeClass = normalizeOutcomeClass(options.outcomeClass || task?.outcomeClass || inferOutcomeClass(task, artifactSpec, options.outcomeDomain || task?.outcomeDomain || inferOutcomeDomain(task, artifactSpec)));
  const outcomeDomain = normalizeOutcomeDomain(options.outcomeDomain || task?.outcomeDomain || inferOutcomeDomain(task, artifactSpec));
  const objectiveId = buildObjectiveId(options.objectiveId || task?.objectiveId || task?.northStarObjectiveLink || task?.northStarObjective || task?.name, 'OBJECTIVE');
  const outcomeId = normalizeText(options.outcomeId || task?.outcomeId) || `${slugifyKey(task?.missionId || 'mission')}-${slugifyKey(objectiveId)}-${slugifyKey(task?.name || 'outcome')}`;
  const proofPacket = options.proofPacket || task?.proofPacket || buildOutcomeProofPacket({ ...task, artifactSpec, acceptanceChecks }, missionPolicy, outcomeClass, outcomeDomain, artifactSpec, acceptanceChecks);
  const compileResult = proofPacket.compileResult || compileProofPacket(proofPacket);
  proofPacket.compileResult = compileResult;
  const playbookId = normalizeText(options.playbookId || task?.playbookId || missionPolicy.playbookId);
  const playbookVersion = Number(options.playbookVersion || task?.playbookVersion || missionPolicy.playbookVersion || 0) || 0;
  const sideEffectClass = normalizeSideEffectClass(options.sideEffectClass || task?.sideEffectClass || inferSideEffectClass(task, artifactSpec));
  const creditBucket = normalizeCreditBucket(options.creditBucket || task?.creditBucket || 'none');
  const speculative = Boolean(options.speculative ?? task?.speculative);
  const commercialCreditEligible = Boolean(
    options.commercialCreditEligible ??
    task?.commercialCreditEligible ??
    (creditBucket === 'commercial' && !speculative)
  );
  const stageGateStatus = normalizeText(options.stageGateStatus || task?.stageGateStatus || '');
  const stageBlockReason = normalizeText(options.stageBlockReason || task?.stageBlockReason || '');
  const baseScore = options.score || calculateOutcomeScore(
    {
      ...task,
      acceptanceChecks,
      artifactSpec,
      priorityScore: options.priorityScore ?? task?.priorityScore,
      proofCompileStatus: compileResult.status,
      expectedAttribution: options.expectedAttribution || task?.expectedAttribution,
      outcomeClass,
      outcomeDomain,
      proofPacket,
    },
    {
      missionPolicy,
      outcomeClass,
      outcomeDomain,
      proofCompileStatus: compileResult.status,
      observationWindow: proofPacket.observationWindow,
      priorityScore: options.priorityScore ?? task?.priorityScore,
    }
  );
  const score = {
    ...baseScore,
    creditBucket,
    sideEffectClass,
    stageGateStatus,
    speculative,
    commercialCreditEligible,
  };
  const parentOutcomeId = normalizeText(options.parentOutcomeId || task?.parentOutcomeId);
  const dependencyEdges = Array.isArray(options.dependencyEdges) ? options.dependencyEdges : [];
  const now = options.now instanceof Date ? options.now : new Date();
  const identity = proofPacket.identity || buildOutcomeIdentityContract(task, outcomeClass, outcomeDomain);

  return {
    id: outcomeId,
    missionId: normalizeText(task?.missionId || options.missionId),
    objectiveId,
    title: normalizeText(options.title || task?.name) || 'Untitled outcome',
    summary: normalizeText(options.summary || artifactSpec?.successDefinition || task?.description) || 'Outcome linked to execute task.',
    playbookId: playbookId || undefined,
    playbookVersion: playbookVersion || undefined,
    actionType: normalizeText(options.actionType || task?.actionType) || undefined,
    stageAtCreation: normalizeText(options.stageAtCreation || task?.currentStageId || missionPolicy.currentStageId) || undefined,
    currentStageId: normalizeText(options.currentStageId || task?.currentStageId || missionPolicy.currentStageId) || undefined,
    sideEffectClass,
    creditBucket,
    speculative,
    commercialCreditEligible,
    cleanupBy: options.cleanupBy || task?.cleanupBy || null,
    cleanupState: normalizeCleanupState(options.cleanupState || task?.cleanupState || 'none'),
    stageGateStatus: stageGateStatus || undefined,
    stageBlockReason: stageBlockReason || undefined,
    readinessSignals: Array.isArray(options.readinessSignals || task?.readinessSignals)
      ? (options.readinessSignals || task.readinessSignals)
      : [],
    admissionDecision: options.admissionDecision || task?.admissionDecision || null,
    outcomeClass,
    outcomeDomain,
    status: normalizeOutcomeStatus(options.status || task?.outcomeStatus || 'planned'),
    proofPacket,
    policyRefs: proofPacket.policyRefs,
    resolvedPolicySnapshot: buildResolvedPolicySnapshot(proofPacket.policyRefs),
    scoredWithVersion: DEFAULT_SCORE_VERSION,
    rescoreRunId: normalizeText(options.rescoreRunId || task?.rescoreRunId),
    proofCompileStatus: compileResult.status,
    proofCompileErrors: compileResult.errors || [],
    compiledProofPacketHash: compileResult.compiledProofPacketHash,
    parentOutcomeId: parentOutcomeId || undefined,
    childOutcomeIds: Array.isArray(options.childOutcomeIds) ? options.childOutcomeIds.filter(Boolean) : [],
    blockedByOutcomeIds: Array.isArray(options.blockedByOutcomeIds) ? options.blockedByOutcomeIds.filter(Boolean) : [],
    dependencyEdges,
    rollupMode: normalizeRollupMode(options.rollupMode || 'all-required-children'),
    rollupThresholdPct: Number(options.rollupThresholdPct || 100) || 100,
    allowRollupOnlyConfirmation: Boolean(options.allowRollupOnlyConfirmation),
    externalEventKey: identity.externalEventKeyTemplate,
    dedupeKey: identity.dedupeKeyTemplate,
    canonicalAccountId: identity.canonicalAccountIdTemplate || undefined,
    canonicalContactId: identity.canonicalContactIdTemplate || undefined,
    canonicalObjectIds: Array.isArray(identity.canonicalObjectIdTemplates) ? identity.canonicalObjectIdTemplates.filter(Boolean) : [],
    supersedesOutcomeId: normalizeText(options.supersedesOutcomeId || task?.supersedesOutcomeId) || undefined,
    attributionActual: normalizeAttribution(options.attributionActual || task?.expectedAttribution || proofPacket.attributionExpected),
    contributorLedger: Array.isArray(options.contributorLedger) && options.contributorLedger.length > 0
      ? options.contributorLedger
      : [{
          contributorId: slugifyKey(task?.assignee || task?.agentId || 'system'),
          contributorType: 'agent',
          role: 'executor',
          attribution: normalizeAttribution(options.attributionActual || task?.expectedAttribution || proofPacket.attributionExpected),
          shareWeight: 1,
          evidenceRefs: [],
        }],
    score,
    primaryTaskIds: Array.isArray(options.primaryTaskIds) && options.primaryTaskIds.length > 0
      ? options.primaryTaskIds.filter(Boolean)
      : (task?.id ? [task.id] : []),
    supportingTaskIds: Array.isArray(options.supportingTaskIds) ? options.supportingTaskIds.filter(Boolean) : [],
    deliverableIds: Array.isArray(options.deliverableIds) ? options.deliverableIds.filter(Boolean) : [],
    sourceEvidence: Array.isArray(options.sourceEvidence) ? options.sourceEvidence : [],
    guardrailStatus: options.guardrailStatus || 'clear',
    waiver: options.waiver || null,
    expectedSignalWindow: proofPacket.observationWindow,
    createdAt: options.createdAt || now,
    updatedAt: options.updatedAt || now,
  };
}

function buildTaskOutcomeFields(task, executeContract, missionPolicy = {}) {
  const proofPacket = executeContract.proofPacket;
  const compileResult = proofPacket?.compileResult || compileProofPacket(proofPacket);
  const outcomeRecord = buildOutcomeRecord(
    {
      ...task,
      outcomeId: executeContract.outcomeId,
      objectiveId: executeContract.objectiveId,
      artifactSpec: executeContract.artifactSpec,
      acceptanceChecks: executeContract.acceptanceChecks,
      expectedAttribution: executeContract.expectedAttribution,
      outcomeClass: executeContract.outcomeClass,
      outcomeDomain: executeContract.outcomeDomain,
      missionId: task?.missionId,
      assignee: task?.assignee,
    },
    {
      missionPolicy,
      outcomeId: executeContract.outcomeId,
      proofPacket,
      outcomeClass: executeContract.outcomeClass,
      outcomeDomain: executeContract.outcomeDomain,
      primaryTaskIds: task?.id ? [task.id] : [],
      status: executeContract.outcomeStatus,
      parentOutcomeId: executeContract.parentOutcomeId,
      supersedesOutcomeId: executeContract.supersedesOutcomeId,
      playbookId: executeContract.playbookId,
      playbookVersion: executeContract.playbookVersion,
      actionType: executeContract.actionType,
      currentStageId: executeContract.currentStageId,
      sideEffectClass: executeContract.sideEffectClass,
      creditBucket: executeContract.creditBucket,
      stageGateStatus: executeContract.stageGateStatus,
      stageBlockReason: executeContract.stageBlockReason,
      speculative: executeContract.speculative,
      commercialCreditEligible: executeContract.commercialCreditEligible,
      cleanupBy: executeContract.cleanupBy,
      cleanupState: executeContract.cleanupState,
      readinessSignals: executeContract.readinessSignals,
      admissionDecision: executeContract.admissionDecision,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
  );

  return {
    outcomeId: outcomeRecord.id,
    parentOutcomeId: outcomeRecord.parentOutcomeId || '',
    supersedesOutcomeId: outcomeRecord.supersedesOutcomeId || '',
    outcomeClass: outcomeRecord.outcomeClass,
    outcomeDomain: outcomeRecord.outcomeDomain,
    outcomeRole: executeContract.outcomeRole,
    proofPacket,
    policyRefs: proofPacket.policyRefs,
    expectedAttribution: executeContract.expectedAttribution,
    expectedOutcomeScore: Math.round(outcomeRecord.score.finalOutcomeScore * 100) / 100,
    expectedImpactScore: outcomeRecord.score.impact,
    expectedCreditedScore: Math.round(outcomeRecord.score.creditedOutcomeScore * 100) / 100,
    expectedNetScore: Math.round(outcomeRecord.score.netOutcomeScore * 100) / 100,
    proofCompileStatus: compileResult.status,
    proofCompileErrors: compileResult.errors || [],
    compiledProofPacketHash: compileResult.compiledProofPacketHash,
    expectedSignalWindow: proofPacket.observationWindow,
    outcomeStatus: normalizeOutcomeStatus(executeContract.outcomeStatus || 'planned'),
    playbookId: outcomeRecord.playbookId || '',
    playbookVersion: outcomeRecord.playbookVersion || 0,
    actionType: outcomeRecord.actionType || '',
    currentStageId: outcomeRecord.currentStageId || '',
    sideEffectClass: outcomeRecord.sideEffectClass || '',
    creditBucket: outcomeRecord.creditBucket || '',
    stageGateStatus: outcomeRecord.stageGateStatus || '',
    stageBlockReason: outcomeRecord.stageBlockReason || '',
    speculative: Boolean(outcomeRecord.speculative),
    cleanupBy: outcomeRecord.cleanupBy || null,
    cleanupState: outcomeRecord.cleanupState || 'none',
    readinessSignals: Array.isArray(outcomeRecord.readinessSignals) ? outcomeRecord.readinessSignals : [],
    commercialCreditEligible: Boolean(outcomeRecord.commercialCreditEligible),
    admissionDecision: outcomeRecord.admissionDecision || null,
    emittedReadinessSignalIds: Array.isArray(executeContract.emittedReadinessSignalIds) ? executeContract.emittedReadinessSignalIds : [],
    outcomeRecord,
  };
}

function passesExecuteGate(task, mission) {
  const missionPolicy = normalizeMissionPolicy(mission || {});
  if (String(task?.proofCompileStatus || '').toLowerCase() !== 'dry-run-passed') return false;
  const credited = Number(task?.expectedCreditedScore ?? task?.expectedOutcomeScore ?? 0);
  const net = Number(task?.expectedNetScore ?? credited);
  switch (missionPolicy.scoreGateMode || DEFAULT_SCORE_GATE_MODE) {
    case 'credited-only':
      return credited >= missionPolicy.plannerMinimumCreditedScore;
    case 'net-only':
      return net >= missionPolicy.plannerMinimumNetScore;
    case 'credited-and-net':
    default:
      return credited >= missionPolicy.plannerMinimumCreditedScore && net >= missionPolicy.plannerMinimumNetScore;
  }
}

function buildOutcomeEvaluation(task, outcome, options = {}) {
  const missionPolicy = normalizeMissionPolicy(options.missionPolicy || {});
  const checks = Array.isArray(options.checks) ? options.checks : [];
  const passed = options.passed === true;
  const spotCheckRequired = options.spotCheckRequired === true;
  const checkedAt = options.checkedAt instanceof Date ? options.checkedAt : new Date();
  const proofPacket = outcome?.proofPacket || task?.proofPacket || {};
  const observationWindow = normalizeObservationWindow(proofPacket?.observationWindow);
  const observationDurationMs = observationWindowToMs(observationWindow, Number(proofPacket?.observationWindowDays || 0));
  const score = calculateOutcomeScore(
    {
      ...task,
      proofPacket,
      expectedAttribution: outcome?.attributionActual || task?.expectedAttribution,
      outcomeClass: outcome?.outcomeClass || task?.outcomeClass,
      outcomeDomain: outcome?.outcomeDomain || task?.outcomeDomain,
      acceptanceChecks: task?.acceptanceChecks,
      artifactSpec: task?.artifactSpec,
      proofCompileStatus: task?.proofCompileStatus,
    },
    {
      missionPolicy,
      outcomeClass: outcome?.outcomeClass || task?.outcomeClass,
      outcomeDomain: outcome?.outcomeDomain || task?.outcomeDomain,
      observationWindow,
      verificationPassed: passed,
      hardFailure: !passed,
      spotCheckRequired,
    }
  );
  const enrichedScore = {
    ...score,
    creditBucket: normalizeCreditBucket(outcome?.creditBucket || task?.creditBucket || 'none'),
    sideEffectClass: normalizeSideEffectClass(outcome?.sideEffectClass || task?.sideEffectClass || 'reversible-prepare'),
    stageGateStatus: normalizeText(outcome?.stageGateStatus || task?.stageGateStatus || ''),
    speculative: Boolean(outcome?.speculative ?? task?.speculative),
    commercialCreditEligible: Boolean(
      outcome?.commercialCreditEligible ??
      task?.commercialCreditEligible ??
      normalizeCreditBucket(outcome?.creditBucket || task?.creditBucket || 'none') === 'commercial'
    ),
  };

  let status = passed ? 'artifact-verified' : 'failed';
  let confirmedAt = null;
  let observationStartedAt = null;
  let expiresAt = null;

  if (passed) {
    if (observationDurationMs > 0) {
      status = 'observing';
      observationStartedAt = checkedAt;
      expiresAt = new Date(checkedAt.getTime() + observationDurationMs);
    } else {
      status = 'confirmed';
      confirmedAt = checkedAt;
    }
  }

  return {
    status,
    score: enrichedScore,
    sourceEvidence: buildOutcomeEvidenceFromChecks(checks, status, checkedAt),
    guardrailStatus: !passed ? 'failed' : 'clear',
    artifactVerifiedAt: passed ? checkedAt : null,
    outcomeObservationStartedAt: observationStartedAt,
    outcomeConfirmedAt: confirmedAt,
    expiresAt,
    updatedAt: checkedAt,
  };
}

function summarizeMissionOutcomes(outcomes = []) {
  const summary = {
    plannedOutcomeCount: 0,
    observingOutcomeCount: 0,
    confirmedOutcomeCount: 0,
    reversedOutcomeCount: 0,
    waivedOutcomeCount: 0,
    canceledOutcomeCount: 0,
    supersededOutcomeCount: 0,
    dedupedOutcomeCount: 0,
    guardrailFailureCount: 0,
    terminalOutcomeScore: 0,
    enablingOutcomeScore: 0,
    learningOutcomeScore: 0,
    invalidationOutcomeScore: 0,
    constraintOutcomeScore: 0,
    creditedOutcomeScore: 0,
    netOutcomeScore: 0,
    businessDebtScore: 0,
    waivedCreditedScore: 0,
    executionScore: 0,
    commercialMovementScore: 0,
    speculativeOutcomeCount: 0,
  };

  for (const outcome of outcomes) {
    const status = normalizeOutcomeStatus(outcome?.status);
    const outcomeClass = normalizeOutcomeClass(outcome?.outcomeClass);
    const score = outcome?.score || {};
    summary.plannedOutcomeCount += 1;
    if (status === 'observing') summary.observingOutcomeCount += 1;
    if (status === 'confirmed') summary.confirmedOutcomeCount += 1;
    if (status === 'reversed') summary.reversedOutcomeCount += 1;
    if (status === 'waived') summary.waivedOutcomeCount += 1;
    if (status === 'canceled') summary.canceledOutcomeCount += 1;
    if (status === 'superseded') summary.supersededOutcomeCount += 1;
    if (outcome?.guardrailStatus === 'failed') summary.guardrailFailureCount += 1;
    const credited = Number(score?.creditedOutcomeScore || 0);
    const net = Number(score?.netOutcomeScore || 0);
    const debt = Number(score?.businessDebtScore || 0);
    summary.creditedOutcomeScore += credited;
    summary.netOutcomeScore += net;
    summary.businessDebtScore += debt;
    if (status === 'waived') summary.waivedCreditedScore += credited;
    if (outcome?.speculative) summary.speculativeOutcomeCount += 1;
    if (outcomeClass === 'terminal') summary.terminalOutcomeScore += credited;
    if (outcomeClass === 'enabling') summary.enablingOutcomeScore += credited;
    if (outcomeClass === 'learning') summary.learningOutcomeScore += credited;
    if (outcomeClass === 'invalidation') summary.invalidationOutcomeScore += credited;
    if (outcomeClass === 'constraint') summary.constraintOutcomeScore += credited;
  }

  summary.executionScore = deriveExecutionScore(outcomes);
  summary.commercialMovementScore = deriveCommercialMovementScore(outcomes);
  summary.businessDebtScore = deriveBusinessDebtScore(outcomes);

  return summary;
}

function advanceOutcomeObservation(outcome, now = Date.now()) {
  if (normalizeOutcomeStatus(outcome?.status) !== 'observing') return null;
  const expiresAtMs = toMillis(outcome?.expiresAt);
  if (!expiresAtMs || expiresAtMs > now) return null;
  return {
    status: 'confirmed',
    confirmedAt: new Date(now),
    updatedAt: new Date(now),
  };
}

function hasValidTaskContract(task) {
  const artifactSpec = task?.artifactSpec || {};
  const acceptanceChecks = Array.isArray(task?.acceptanceChecks) ? task.acceptanceChecks : [];
  if (!normalizeArtifactKind(artifactSpec.kind)) return false;
  if (acceptanceChecks.length < 2) return false;

  const normalizedChecks = acceptanceChecks
    .map((check) => ({
      kind: normalizeCheckKind(check?.kind),
      label: normalizeText(check?.label),
      commandOrPath: normalizeText(check?.commandOrPath),
      expectedSignal: normalizeText(check?.expectedSignal),
    }))
    .filter((check) => check.kind && check.label && check.commandOrPath);

  if (normalizedChecks.length < 2) return false;

  const automated = normalizedChecks.filter((check) => check.kind !== 'manual-spot-check');
  if (automated.length < 1) return false;

  const proofPacket = task?.proofPacket;
  if (proofPacket) {
    const compileResult = proofPacket.compileResult || compileProofPacket(proofPacket);
    if (String(compileResult.status || '').toLowerCase() !== 'dry-run-passed') return false;
  }

  return true;
}

function buildExecuteTaskContract(task, options = {}) {
  const missionPolicy = normalizeMissionPolicy(options.missionPolicy || {});
  const objectiveId = buildObjectiveId(options.objectiveId || task?.objectiveId || task?.northStarObjectiveLink || task?.northStarObjective || task?.name, options.fallbackObjectiveId || 'OBJECTIVE');
  const artifactSpec = normalizeArtifactKind(task?.artifactSpec?.kind)
    ? {
        kind: normalizeArtifactKind(task.artifactSpec.kind),
        targets: Array.isArray(task.artifactSpec.targets) ? task.artifactSpec.targets.filter(Boolean) : [],
        successDefinition: normalizeText(task.artifactSpec.successDefinition) || `Deliver the planned artifact for ${task?.name || 'task'}.`,
        mustTouchRepo: Boolean(task.artifactSpec.mustTouchRepo),
        impactScope: normalizeText(task.artifactSpec.impactScope) || 'user-facing',
      }
    : inferArtifactSpec(task);

  const acceptanceChecks = (Array.isArray(task?.acceptanceChecks) ? task.acceptanceChecks : inferAcceptanceChecks(task, artifactSpec))
    .map((check) => ({
      kind: normalizeCheckKind(check?.kind),
      label: normalizeText(check?.label),
      commandOrPath: normalizeText(check?.commandOrPath),
      expectedSignal: normalizeText(check?.expectedSignal),
    }))
    .filter((check) => check.kind && check.label && check.commandOrPath);

  const outcomeDomain = normalizeOutcomeDomain(options.outcomeDomain || task?.outcomeDomain || inferOutcomeDomain(task, artifactSpec));
  const outcomeClass = normalizeOutcomeClass(options.outcomeClass || task?.outcomeClass || inferOutcomeClass(task, artifactSpec, outcomeDomain));
  const outcomeRole = normalizeText(options.outcomeRole || task?.outcomeRole || inferOutcomeRole(outcomeClass)) || 'supporting';
  const outcomeId = normalizeText(options.outcomeId || task?.outcomeId) || `${slugifyKey(task?.missionId || 'mission')}-${slugifyKey(objectiveId)}-${slugifyKey(task?.name || 'task')}`;
  const expectedAttribution = normalizeAttribution(options.expectedAttribution || task?.expectedAttribution || 'directly-caused');
  const proofPacket = task?.proofPacket || buildOutcomeProofPacket(
    {
      ...task,
      objectiveId,
      artifactSpec,
      acceptanceChecks,
      expectedAttribution,
      assignee: task?.assignee || options.assignee,
    },
    missionPolicy,
    outcomeClass,
    outcomeDomain,
    artifactSpec,
    acceptanceChecks
  );
  const compileResult = proofPacket.compileResult || compileProofPacket(proofPacket);
  proofPacket.compileResult = compileResult;
  const projectedScore = calculateOutcomeScore(
    {
      ...task,
      acceptanceChecks,
      artifactSpec,
      priorityScore: options.priorityScore ?? task?.priorityScore,
      proofCompileStatus: compileResult.status,
      expectedAttribution,
      outcomeClass,
      outcomeDomain,
      proofPacket,
    },
    {
      missionPolicy,
      outcomeClass,
      outcomeDomain,
      proofCompileStatus: compileResult.status,
      observationWindow: proofPacket.observationWindow,
      priorityScore: options.priorityScore ?? task?.priorityScore,
    }
  );
  const base = {
    specVersion: MISSION_SYSTEM_VERSION,
    mode: 'execute',
    plannerSource: options.plannerSource || task?.plannerSource || 'mission-supervisor',
    taskClass: options.taskClass || task?.taskClass || 'execute-unit',
    objectiveId,
    artifactSpec,
    acceptanceChecks,
    dependencyIds: Array.isArray(task?.dependencyIds) ? task.dependencyIds.filter(Boolean) : [],
    verificationPolicy: task?.verificationPolicy || {
      automatedAuthority: true,
      humanSpotCheck: 'exceptions-and-sample',
      sampleRate: DEFAULT_SPOT_CHECK_SAMPLE_RATE,
    },
    priorityScore: Number(task?.priorityScore || options.priorityScore || (normalizePriority(task?.priority) * 10)) || 20,
    expiresAt: task?.expiresAt || new Date(Date.now() + (options.expiresInHours || DEFAULT_TASK_EXPIRY_HOURS) * 60 * 60 * 1000),
    quarantineReason: task?.quarantineReason || '',
    quarantinedAt: task?.quarantinedAt || null,
    verificationResult: task?.verificationResult || null,
    outcomeId,
    parentOutcomeId: normalizeText(options.parentOutcomeId || task?.parentOutcomeId),
    supersedesOutcomeId: normalizeText(options.supersedesOutcomeId || task?.supersedesOutcomeId),
    outcomeClass,
    outcomeDomain,
    outcomeRole,
    proofPacket,
    policyRefs: proofPacket.policyRefs,
    expectedAttribution,
    proofCompileStatus: compileResult.status,
    proofCompileErrors: compileResult.errors || [],
    compiledProofPacketHash: compileResult.compiledProofPacketHash,
    expectedSignalWindow: proofPacket.observationWindow,
    outcomeStatus: normalizeOutcomeStatus(task?.outcomeStatus || options.outcomeStatus || 'planned'),
    expectedOutcomeScore: Math.round(projectedScore.finalOutcomeScore * 100) / 100,
    expectedImpactScore: projectedScore.impact,
    expectedCreditedScore: Math.round(projectedScore.creditedOutcomeScore * 100) / 100,
    expectedNetScore: Math.round(projectedScore.netOutcomeScore * 100) / 100,
  };
  const admission = buildTaskAdmission(
    {
      ...task,
      ...base,
      missionId: task?.missionId || options.missionId,
      outcomeId,
    },
    {
      missionPolicy,
      missionId: task?.missionId || options.missionId,
      artifactSpec,
      proofCompileStatus: compileResult.status,
      expectedCreditedScore: projectedScore.creditedOutcomeScore,
      expectedNetScore: projectedScore.netOutcomeScore,
      expectedOutcomeScore: projectedScore.finalOutcomeScore,
      actionType: task?.actionType || options.actionType,
      now: options.now instanceof Date ? options.now : new Date(),
    }
  );
  Object.assign(base, {
    playbookId: admission.playbookId,
    playbookVersion: admission.playbookVersion,
    actionType: admission.actionType,
    sideEffectClass: admission.sideEffectClass,
    creditBucket: admission.creditBucket,
    speculative: admission.speculative,
    commercialCreditEligible: admission.commercialCreditEligible,
    currentStageId: admission.currentStageId,
    requiredStageId: admission.requiredStageId,
    requiredReadinessSignalIds: admission.requiredReadinessSignalIds,
    emittedReadinessSignalIds: admission.emittedReadinessSignalIds,
    stageGateStatus: admission.stageGateStatus,
    stageBlockReason: admission.stageBlockReason,
    readinessSignals: admission.readinessSignals,
    cleanupBy: admission.cleanupBy,
    cleanupState: admission.cleanupState,
    admissionDecision: admission.admissionDecision,
  });
  const taskOutcomeFields = buildTaskOutcomeFields(
    {
      ...task,
      objectiveId,
      artifactSpec,
      acceptanceChecks,
      missionId: task?.missionId || options.missionId,
      assignee: task?.assignee || options.assignee,
    },
    base,
    missionPolicy
  );
  const hasContract = hasValidTaskContract({
    artifactSpec: base.artifactSpec,
    acceptanceChecks: base.acceptanceChecks,
    proofPacket: base.proofPacket,
  });
  const executeGatePassed = hasContract && taskOutcomeFields.admissionDecision?.admitExecuteTask === true;

  return {
    ...base,
    ...taskOutcomeFields,
    hasContract,
    executeGatePassed,
  };
}

function buildExploreTaskMetadata(task, options = {}) {
  return {
    specVersion: MISSION_SYSTEM_VERSION,
    mode: 'explore',
    plannerSource: options.plannerSource || task?.plannerSource || 'worker-self',
    taskClass: options.taskClass || task?.taskClass || 'explore-brief',
    objectiveId: buildObjectiveId(options.objectiveId || task?.objectiveId || task?.focusObjective || task?.northStarObjective || task?.name, 'EXPLORE'),
    artifactSpec: task?.artifactSpec || null,
    acceptanceChecks: Array.isArray(task?.acceptanceChecks) ? task.acceptanceChecks : [],
    dependencyIds: Array.isArray(task?.dependencyIds) ? task.dependencyIds.filter(Boolean) : [],
    verificationPolicy: task?.verificationPolicy || {
      automatedAuthority: false,
      humanSpotCheck: 'manual',
      sampleRate: 0,
    },
    priorityScore: Number(task?.priorityScore || options.priorityScore || (normalizePriority(task?.priority) * 10)) || 10,
    expiresAt: task?.expiresAt || new Date(Date.now() + (options.expiresInHours || DEFAULT_TASK_EXPIRY_HOURS) * 60 * 60 * 1000),
    quarantineReason: task?.quarantineReason || '',
    quarantinedAt: task?.quarantinedAt || null,
    verificationResult: task?.verificationResult || null,
  };
}

function shouldQuarantineTask(task, presenceByAgent = {}, now = Date.now()) {
  if (!isAutoGeneratedTask(task)) return false;
  const status = String(task?.status || '').toLowerCase();
  if (status !== 'todo' && status !== 'needs-review') return false;
  const updatedAtMs = toMillis(task?.updatedAt || task?.createdAt);
  if (updatedAtMs && (now - updatedAtMs) < 2 * 60 * 60 * 1000) return false;

  const assignee = String(task?.assignee || '').trim().toLowerCase();
  const matchingPresence = Object.values(presenceByAgent).find((presence) => {
    const taskId = String(presence?.currentTaskId || '').trim();
    const taskName = String(presence?.currentTask || '').trim();
    if (taskId && taskId === String(task?.id || '')) return true;
    if (taskName && taskName === String(task?.name || '')) return true;
    return String(presence?.displayName || '').trim().toLowerCase() === assignee && String(presence?.status || '').toLowerCase() === 'working';
  });

  return !matchingPresence;
}

function getTaskQueueRank(task, mission) {
  if (isCorrectionTask(task)) return 0;
  if (isExecuteMissionActive(mission) && String(task?.mode || '').toLowerCase() === 'execute' && Number(task?.specVersion || 0) >= MISSION_SYSTEM_VERSION) {
    return 1;
  }
  if (isDependencyTask(task)) return 2;
  if (String(task?.mode || '').toLowerCase() === 'explore' || !task?.mode) return 3;
  return 4;
}

function compareTaskCandidates(a, b, mission) {
  const rankDiff = getTaskQueueRank(a, mission) - getTaskQueueRank(b, mission);
  if (rankDiff !== 0) return rankDiff;

  const priorityDiff = Number(b?.priorityScore || normalizePriority(b?.priority) * 10) - Number(a?.priorityScore || normalizePriority(a?.priority) * 10);
  if (priorityDiff !== 0) return priorityDiff;

  const aUpdated = toMillis(a?.updatedAt || a?.createdAt);
  const bUpdated = toMillis(b?.updatedAt || b?.createdAt);
  if (aUpdated !== bUpdated) return bUpdated - aUpdated;

  return toMillis(b?.createdAt) - toMillis(a?.createdAt);
}

function isTaskRunnable(task, mission, now = Date.now()) {
  const status = String(task?.status || '').toLowerCase();
  if (!ACTIVE_TASK_STATUSES.has(status)) return false;
  if (EXEC_EXCLUDED_STATUSES.has(status)) return false;
  if (task?.runnerBlocked) return false;
  if (isExpiredTask(task, now)) return false;

  if (!isExecuteMissionActive(mission)) {
    return status === 'todo' || status === 'in-progress';
  }

  if (isCorrectionTask(task)) return true;
  if (String(task?.mode || '').toLowerCase() !== 'execute') return false;
  if (Number(task?.specVersion || 0) < MISSION_SYSTEM_VERSION) return false;
  if (!hasValidTaskContract(task)) return false;
  if (task?.admissionDecision && task.admissionDecision.admitExecuteTask === false) return false;
  return passesExecuteGate(task, mission);
}

async function recordMissionRunEvent(db, FieldValue, missionId, eventType, payload = {}) {
  if (!missionId || !db) return null;

  const counters = {};
  switch (String(eventType || '').toLowerCase()) {
    case 'created-task':
      counters.createdTaskCount = FieldValue.increment(1);
      break;
    case 'quarantined-task':
      counters.quarantinedTaskCount = FieldValue.increment(1);
      break;
    case 'verified-auto':
      counters.verifiedAutoCount = FieldValue.increment(1);
      break;
    case 'verified-human':
      counters.verifiedHumanCount = FieldValue.increment(1);
      break;
    case 'rejected':
      counters.rejectedCount = FieldValue.increment(1);
      break;
    case 'stall-pause':
      counters.stallPauseCount = FieldValue.increment(1);
      break;
    case 'corrective-loop':
      counters.correctiveLoopCount = FieldValue.increment(1);
      break;
    case 'planned-outcome':
      counters.plannedOutcomeCount = FieldValue.increment(1);
      break;
    case 'observing-outcome':
      counters.observingOutcomeCount = FieldValue.increment(1);
      break;
    case 'confirmed-outcome':
      counters.confirmedOutcomeCount = FieldValue.increment(1);
      break;
    case 'reversed-outcome':
      counters.reversedOutcomeCount = FieldValue.increment(1);
      break;
    case 'waived-outcome':
      counters.waivedOutcomeCount = FieldValue.increment(1);
      break;
    case 'canceled-outcome':
      counters.canceledOutcomeCount = FieldValue.increment(1);
      break;
    case 'superseded-outcome':
      counters.supersededOutcomeCount = FieldValue.increment(1);
      break;
    case 'guardrail-failure':
      counters.guardrailFailureCount = FieldValue.increment(1);
      break;
    default:
      break;
  }

  const runRef = db.collection('mission-runs').doc(missionId);
  await runRef.set({
    missionId,
    updatedAt: FieldValue.serverTimestamp(),
    startedAt: payload.startedAt || FieldValue.serverTimestamp(),
    ...counters,
  }, { merge: true });

  const eventRef = runRef.collection('events').doc();
  await eventRef.set({
    type: eventType,
    missionId,
    ...payload,
    createdAt: FieldValue.serverTimestamp(),
  });

  return eventRef.id;
}

module.exports = {
  ACTIVE_TASK_STATUSES,
  AUTO_GENERATED_SOURCES,
  CORRECTION_SOURCES,
  DEFAULT_MAX_ACTIVE_TASKS_PER_AGENT,
  DEFAULT_MAX_LEARNING_INVALIDATION_WIP_PCT,
  DEFAULT_MAX_QUEUED_EXECUTE_TASKS_PER_AGENT,
  DEFAULT_MAX_QUEUED_EXPLORE_TASKS_PER_AGENT,
  DEFAULT_MAX_WAIVED_CREDIT_PCT,
  DEFAULT_MISSION_MODE,
  DEFAULT_PLANNER_MODE,
  DEFAULT_PLANNER_MIN_CREDITED_SCORE,
  DEFAULT_PLANNER_MIN_NET_SCORE,
  DEFAULT_SCORE_GATE_MODE,
  DEFAULT_SPOT_CHECK_SAMPLE_RATE,
  DEFAULT_STALL_WINDOW_MINUTES,
  DEFAULT_EXECUTE_GATE_MODE,
  EXEC_EXCLUDED_STATUSES,
  HIGH_IMPACT_TASK_CLASSES,
  MISSION_SYSTEM_VERSION,
  OUTCOME_COLLECTION,
  OUTCOME_CLASSES,
  OUTCOME_DOMAINS,
  OUTCOME_STATUSES,
  OUTCOME_SOURCE_OF_TRUTH,
  OUTCOME_OBSERVATION_WINDOWS,
  buildExecuteTaskContract,
  buildExploreTaskMetadata,
  buildObjectiveId,
  buildOutcomeEvaluation,
  buildOutcomeEvidenceFromChecks,
  buildOutcomePolicyRefs,
  buildOutcomeProofPacket,
  buildOutcomeRecord,
  buildTaskAdmission,
  buildResolvedPolicySnapshot,
  buildTaskOutcomeFields,
  compareTaskCandidates,
  compileProofPacket,
  passesExecuteGate,
  extractTargets,
  inferOutcomeClass,
  inferOutcomeDomain,
  getTaskQueueRank,
  hasValidTaskContract,
  inferAcceptanceChecks,
  inferArtifactSpec,
  inferTaskActionType,
  isAutoGeneratedTask,
  isCorrectionTask,
  isDependencyTask,
  isExecuteMissionActive,
  isExploreMissionActive,
  isExpiredTask,
  isLegacyExecuteTask,
  isMissionSystemV2,
  isTaskRunnable,
  normalizeMissionPolicy,
  normalizeOutcomeClass,
  normalizeOutcomeDomain,
  normalizeOutcomeStatus,
  recordMissionRunEvent,
  summarizeMissionOutcomes,
  advanceOutcomeObservation,
  shouldQuarantineTask,
  toMillis,
};
