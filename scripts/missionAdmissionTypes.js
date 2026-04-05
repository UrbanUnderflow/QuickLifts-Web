'use strict';

const OUTCOME_GRAPH_STATUSES = Object.freeze(['valid', 'invalid']);
const SIDE_EFFECT_CLASSES = Object.freeze(['reversible-prepare', 'internal-durable', 'external-durable']);
const CREDIT_BUCKETS = Object.freeze(['none', 'execution', 'commercial']);
const STAGE_GATE_STATUSES = Object.freeze(['passed', 'blocked', 'speculative', 'waived']);
const SCORE_GATE_STATUSES = Object.freeze(['passed', 'failed']);
const EXECUTE_GATE_MODES = Object.freeze(['strict', 'allow-speculative']);
const SCORE_GATE_MODES = Object.freeze(['credited-and-net', 'credited-only', 'net-only']);
const SPECULATIVE_LIFECYCLE_STATES = Object.freeze([
  'none',
  'scheduled',
  'speculative-created',
  'converted',
  'retire-required',
  'retired',
  'expired',
  'cleanup-failed',
]);
const APPROVAL_DECISIONS = Object.freeze(['approved', 'rejected', 'expired', 'revoked']);
const PROOF_EVALUATION_MODES = Object.freeze(['instant', 'windowed']);

function normalizeString(value, fallback = '') {
  return String(value == null ? fallback : value).trim();
}

function normalizeArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeEnum(value, allowed, fallback) {
  const normalized = normalizeString(value, fallback).toLowerCase();
  return allowed.includes(normalized) ? normalized : fallback;
}

function normalizeSideEffectClass(value) {
  return normalizeEnum(value, SIDE_EFFECT_CLASSES, 'reversible-prepare');
}

function normalizeCreditBucket(value) {
  return normalizeEnum(value, CREDIT_BUCKETS, 'none');
}

function normalizeStageGateStatus(value) {
  return normalizeEnum(value, STAGE_GATE_STATUSES, 'blocked');
}

function normalizeScoreGateStatus(value) {
  return normalizeEnum(value, SCORE_GATE_STATUSES, 'failed');
}

function normalizeExecuteGateMode(value) {
  return normalizeEnum(value, EXECUTE_GATE_MODES, 'strict');
}

function normalizeScoreGateMode(value) {
  return normalizeEnum(value, SCORE_GATE_MODES, 'credited-and-net');
}

function normalizeSpeculativeLifecycleState(value) {
  return normalizeEnum(value, SPECULATIVE_LIFECYCLE_STATES, 'none');
}

function normalizeProofEvaluationMode(value) {
  return normalizeEnum(value, PROOF_EVALUATION_MODES, 'instant');
}

function normalizePlaybookStage(stage = {}) {
  const id = normalizeString(stage.id || stage.stageId || stage.key);
  return {
    id,
    label: normalizeString(stage.label || stage.name || id),
    ordinal: Number(stage.ordinal || stage.index || 0) || 0,
    entrySignalIds: normalizeArray(stage.entrySignalIds || stage.requiredReadinessSignalIds)
      .map((item) => normalizeString(item))
      .filter(Boolean),
    regressionSignalIds: normalizeArray(stage.regressionSignalIds)
      .map((item) => normalizeString(item))
      .filter(Boolean),
    unlockActionTypes: normalizeArray(stage.unlockActionTypes)
      .map((item) => normalizeString(item))
      .filter(Boolean),
    notes: normalizeString(stage.notes),
  };
}

function normalizeActionPolicy(policy = {}) {
  const actionType = normalizeString(policy.actionType || policy.id || policy.key);
  return {
    id: normalizeString(policy.id) || actionType,
    actionType,
    label: normalizeString(policy.label || actionType),
    description: normalizeString(policy.description),
    sideEffectClass: normalizeSideEffectClass(policy.sideEffectClass),
    requiredStageId: normalizeString(policy.requiredStageId || policy.stageId),
    requiredReadinessSignalIds: normalizeArray(policy.requiredReadinessSignalIds || policy.readinessSignalIds)
      .map((item) => normalizeString(item))
      .filter(Boolean),
    requiredApprovalTypes: normalizeArray(policy.requiredApprovalTypes)
      .map((item) => normalizeString(item))
      .filter(Boolean),
    allowSpeculative: Boolean(policy.allowSpeculative),
    defaultCreditMode: normalizeCreditBucket(policy.defaultCreditMode),
    cleanupTTLHours: Number(policy.cleanupTTLHours || 0) || 0,
    blockReasonCode: normalizeString(policy.blockReasonCode),
    blockReasonDetail: normalizeString(policy.blockReasonDetail),
    notes: normalizeString(policy.notes),
  };
}

function normalizeReadinessSignalTemplate(signal = {}) {
  const id = normalizeString(signal.id || signal.signalId || signal.key);
  return {
    id,
    label: normalizeString(signal.label || id),
    proofTemplateId: normalizeString(signal.proofTemplateId || signal.proofId || id),
    evaluationMode: normalizeProofEvaluationMode(signal.evaluationMode),
    freshnessMinutes: Number(signal.freshnessMinutes || 0) || 0,
    expiresAfterMinutes: Number(signal.expiresAfterMinutes || 0) || 0,
    requiredForActionTypes: normalizeArray(signal.requiredForActionTypes)
      .map((item) => normalizeString(item))
      .filter(Boolean),
    sourceOfTruth: normalizeString(signal.sourceOfTruth),
    successEvent: normalizeString(signal.successEvent),
    metricRefId: normalizeString(signal.metricRefId),
    predicateId: normalizeString(signal.predicateId),
    notes: normalizeString(signal.notes),
  };
}

function normalizeResolvedReadinessSignal(signal = {}) {
  const id = normalizeString(signal.id || signal.signalId || signal.key);
  return {
    id,
    label: normalizeString(signal.label || id),
    state: normalizeEnum(signal.state, ['missing', 'pending', 'verified', 'failed', 'waived', 'expired', 'revoked'], 'missing'),
    proofTemplateId: normalizeString(signal.proofTemplateId || signal.proofId || id),
    sourceOfTruth: normalizeString(signal.sourceOfTruth),
    successEvent: normalizeString(signal.successEvent),
    verifiedAt: signal.verifiedAt || null,
    expiresAt: signal.expiresAt || null,
    evidenceRef: normalizeString(signal.evidenceRef),
    evidenceRefs: normalizeArray(signal.evidenceRefs)
      .map((item) => normalizeString(item))
      .filter(Boolean),
    freshnessMinutes: Number(signal.freshnessMinutes || 0) || 0,
    notes: normalizeString(signal.notes),
  };
}

function normalizeApprovalEvent(event = {}) {
  const id = normalizeString(event.id || event.approvalEventId);
  return {
    id,
    missionId: normalizeString(event.missionId),
    approvalType: normalizeString(event.approvalType || event.type),
    scopeType: normalizeEnum(event.scopeType, ['task', 'outcome', 'stage', 'action'], 'task'),
    scopeId: normalizeString(event.scopeId),
    decision: normalizeEnum(event.decision, APPROVAL_DECISIONS, 'approved'),
    approverId: normalizeString(event.approverId || event.reviewerId),
    createdAt: event.createdAt || null,
    effectiveUntil: event.effectiveUntil || null,
    rationale: normalizeString(event.rationale),
    metadata: event.metadata && typeof event.metadata === 'object' ? { ...event.metadata } : {},
  };
}

function normalizeMissionPlaybook(playbook = {}) {
  const stageGraph = normalizeArray(playbook.stageGraph).map(normalizePlaybookStage).filter((stage) => stage.id);
  const actionPolicies = normalizeArray(playbook.actionPolicies).map(normalizeActionPolicy).filter((policy) => policy.actionType);
  const readinessSignalTemplates = normalizeArray(playbook.readinessSignalTemplates)
    .map(normalizeReadinessSignalTemplate)
    .filter((signal) => signal.id);

  return {
    id: normalizeString(playbook.id),
    family: normalizeString(playbook.family || playbook.playbookFamily),
    version: Number(playbook.version || playbook.playbookVersion || 1) || 1,
    description: normalizeString(playbook.description),
    primaryDomain: normalizeString(playbook.primaryDomain || 'activation'),
    stageGraph: stageGraph.sort((a, b) => a.ordinal - b.ordinal),
    actionPolicies,
    readinessSignalTemplates,
    defaultOutcomeTemplateIds: normalizeArray(playbook.defaultOutcomeTemplateIds)
      .map((item) => normalizeString(item))
      .filter(Boolean),
    defaultProofTemplateIds: normalizeArray(playbook.defaultProofTemplateIds)
      .map((item) => normalizeString(item))
      .filter(Boolean),
    cleanupRules: normalizeArray(playbook.cleanupRules)
      .map((item) => ({
        id: normalizeString(item.id || item.key),
        actionType: normalizeString(item.actionType),
        lifecycleState: normalizeSpeculativeLifecycleState(item.lifecycleState),
        cleanupTTLHours: Number(item.cleanupTTLHours || 0) || 0,
        notes: normalizeString(item.notes),
      }))
      .filter((rule) => rule.id || rule.actionType),
    notes: normalizeString(playbook.notes),
    versionTag: normalizeString(playbook.versionTag),
  };
}

function normalizeMissionInstancePolicy(policy = {}) {
  const readinessSignals = normalizeArray(policy.readinessSignals)
    .map(normalizeResolvedReadinessSignal)
    .filter((signal) => signal.id);

  return {
    missionId: normalizeString(policy.missionId),
    playbookId: normalizeString(policy.playbookId),
    playbookVersion: Number(policy.playbookVersion || 0) || 0,
    playbookFamily: normalizeString(policy.playbookFamily),
    currentStageId: normalizeString(policy.currentStageId),
    currentStageOrdinal: Number(policy.currentStageOrdinal || 0) || 0,
    readinessSignals,
    speculativeActionsAllowed: normalizeArray(policy.speculativeActionsAllowed)
      .map((item) => normalizeString(item))
      .filter(Boolean),
    requiredApprovals: normalizeArray(policy.requiredApprovals)
      .map((item) => normalizeString(item))
      .filter(Boolean),
    commercialPrimaryDomain: normalizeString(policy.commercialPrimaryDomain || 'activation'),
    cleanupTTLHours: Number(policy.cleanupTTLHours || 24) || 24,
    executeGateMode: normalizeExecuteGateMode(policy.executeGateMode),
    scoreGateMode: normalizeScoreGateMode(policy.scoreGateMode),
    canary: Boolean(policy.canary),
    allowSpeculative: Boolean(policy.allowSpeculative),
    targetEntityPolicy: policy.targetEntityPolicy && typeof policy.targetEntityPolicy === 'object'
      ? { ...policy.targetEntityPolicy }
      : {},
    notes: normalizeString(policy.notes),
  };
}

function buildAdmissionDecision(decision = {}) {
  const stageGateStatus = normalizeStageGateStatus(decision.stageGateStatus || decision.playbookGateStatus);
  const scoreGateStatus = normalizeScoreGateStatus(decision.scoreGateStatus);
  const sideEffectClass = normalizeSideEffectClass(decision.sideEffectClass);
  const creditBucket = normalizeCreditBucket(decision.creditBucket);
  const speculative = Boolean(decision.speculative);
  const commercialCreditEligible = Boolean(
    decision.commercialCreditEligible ??
    (creditBucket === 'commercial' && !speculative)
  );

  return {
    admissionVersion: 1,
    missionId: normalizeString(decision.missionId),
    playbookId: normalizeString(decision.playbookId),
    playbookVersion: Number(decision.playbookVersion || 0) || 0,
    taskId: normalizeString(decision.taskId),
    outcomeId: normalizeString(decision.outcomeId),
    outcomeGraphStatus: normalizeEnum(decision.outcomeGraphStatus, OUTCOME_GRAPH_STATUSES, 'valid'),
    proofCompileStatus: normalizeEnum(decision.proofCompileStatus, ['passed', 'failed'], 'failed'),
    playbookGateStatus: stageGateStatus,
    stageGateStatus,
    scoreGateStatus,
    sideEffectClass,
    creditBucket,
    speculative,
    commercialCreditEligible,
    currentStageId: normalizeString(decision.currentStageId),
    requiredStageId: normalizeString(decision.requiredStageId),
    satisfiedReadinessSignalIds: normalizeArray(decision.satisfiedReadinessSignalIds)
      .map((item) => normalizeString(item))
      .filter(Boolean),
    missingReadinessSignalIds: normalizeArray(decision.missingReadinessSignalIds)
      .map((item) => normalizeString(item))
      .filter(Boolean),
    requiredApprovalEventIds: normalizeArray(decision.requiredApprovalEventIds)
      .map((item) => normalizeString(item))
      .filter(Boolean),
    cleanupBy: decision.cleanupBy || null,
    cleanupState: normalizeSpeculativeLifecycleState(decision.cleanupState),
    admitExecuteTask: Boolean(decision.admitExecuteTask ?? (
      normalizeEnum(decision.outcomeGraphStatus, OUTCOME_GRAPH_STATUSES, 'valid') === 'valid' &&
      normalizeEnum(decision.proofCompileStatus, ['passed', 'failed'], 'failed') === 'passed' &&
      stageGateStatus !== 'blocked' &&
      scoreGateStatus === 'passed'
    )),
    blockReasonCode: normalizeString(decision.blockReasonCode),
    blockReasonDetail: normalizeString(decision.blockReasonDetail),
    notes: normalizeString(decision.notes),
  };
}

function deriveCreditBucket({ sideEffectClass, speculative = false, allowSpeculative = false, stageGateStatus = 'passed', defaultCreditMode = 'none' } = {}) {
  const normalizedSideEffectClass = normalizeSideEffectClass(sideEffectClass);
  const normalizedStageGateStatus = normalizeStageGateStatus(stageGateStatus);
  if (normalizedStageGateStatus === 'blocked') return 'none';
  if (normalizedSideEffectClass === 'reversible-prepare') return defaultCreditMode === 'commercial' ? 'execution' : 'none';
  if (speculative && !allowSpeculative) return 'none';
  if (speculative && normalizedSideEffectClass === 'external-durable') return 'none';
  if (normalizedSideEffectClass === 'external-durable') return 'commercial';
  if (normalizedSideEffectClass === 'internal-durable') return defaultCreditMode === 'commercial' ? 'commercial' : 'execution';
  return normalizeCreditBucket(defaultCreditMode);
}

function deriveCommercialCreditEligible({ creditBucket, speculative = false } = {}) {
  return normalizeCreditBucket(creditBucket) === 'commercial' && !speculative;
}

function deriveExecutionScore(outcomes = []) {
  return normalizeArray(outcomes).reduce((sum, outcome) => {
    const score = Number(outcome?.score?.creditedOutcomeScore ?? outcome?.creditedOutcomeScore ?? 0) || 0;
    const bucket = normalizeCreditBucket(outcome?.creditBucket || outcome?.score?.creditBucket);
    return sum + (bucket === 'execution' || bucket === 'commercial' || score > 0 ? score : 0);
  }, 0);
}

function deriveCommercialMovementScore(outcomes = []) {
  return normalizeArray(outcomes).reduce((sum, outcome) => {
    const score = Number(outcome?.score?.netOutcomeScore ?? outcome?.netOutcomeScore ?? 0) || 0;
    const bucket = normalizeCreditBucket(outcome?.creditBucket || outcome?.score?.creditBucket);
    return sum + (bucket === 'commercial' ? score : 0);
  }, 0);
}

function deriveBusinessDebtScore(outcomes = []) {
  return normalizeArray(outcomes).reduce((sum, outcome) => {
    const debt = Number(outcome?.score?.businessDebtScore ?? outcome?.businessDebtScore ?? 0) || 0;
    return sum + debt;
  }, 0);
}

module.exports = {
  OUTCOME_GRAPH_STATUSES,
  SIDE_EFFECT_CLASSES,
  CREDIT_BUCKETS,
  STAGE_GATE_STATUSES,
  SCORE_GATE_STATUSES,
  EXECUTE_GATE_MODES,
  SCORE_GATE_MODES,
  SPECULATIVE_LIFECYCLE_STATES,
  APPROVAL_DECISIONS,
  PROOF_EVALUATION_MODES,
  normalizeString,
  normalizeArray,
  normalizeEnum,
  normalizeSideEffectClass,
  normalizeCreditBucket,
  normalizeStageGateStatus,
  normalizeScoreGateStatus,
  normalizeExecuteGateMode,
  normalizeScoreGateMode,
  normalizeSpeculativeLifecycleState,
  normalizeProofEvaluationMode,
  normalizePlaybookStage,
  normalizeActionPolicy,
  normalizeReadinessSignalTemplate,
  normalizeResolvedReadinessSignal,
  normalizeApprovalEvent,
  normalizeMissionPlaybook,
  normalizeMissionInstancePolicy,
  buildAdmissionDecision,
  deriveCreditBucket,
  deriveCommercialCreditEligible,
  deriveExecutionScore,
  deriveCommercialMovementScore,
  deriveBusinessDebtScore,
};
