'use strict';

const {
  resolveApprovalEvents,
} = require('./missionApprovals');

const READINESS_SIGNAL_STATES = new Set(['missing', 'pending', 'verified', 'failed', 'waived', 'expired', 'revoked']);
const STAGE_GATE_STATUSES = new Set(['passed', 'blocked', 'speculative', 'waived']);
const SIDE_EFFECT_CLASSES = new Set(['reversible-prepare', 'internal-durable', 'external-durable']);
const CREDIT_BUCKETS = new Set(['execution', 'commercial', 'none']);
const SPECULATIVE_LIFECYCLE_STATES = new Set([
  'none',
  'scheduled',
  'speculative-created',
  'converted',
  'retire-required',
  'retired',
  'expired',
  'cleanup-failed',
]);
const CLEANUP_STATES = new Set([
  'none',
  'scheduled',
  'retire-required',
  'retired',
  'expired',
  'converted',
  'cleanup-failed',
]);
const STAGE_REGRESSION_DIRECTIONS = new Set(['forward', 'backward', 'stable']);

function normalizeText(value) {
  return String(value || '').trim();
}

function getMissionOsHelpers() {
  try {
    return require('./missionOsV2');
  } catch (_) {
    return {};
  }
}

function normalizeMissionPolicySafe(value = {}) {
  const helpers = getMissionOsHelpers();
  if (typeof helpers.normalizeMissionPolicy === 'function') {
    return helpers.normalizeMissionPolicy(value);
  }
  return value || {};
}

function compileProofPacketSafe(packet) {
  const helpers = getMissionOsHelpers();
  if (typeof helpers.compileProofPacket === 'function') {
    return helpers.compileProofPacket(packet);
  }
  return {
    status: 'dry-run-failed',
    errors: ['compileProofPacket unavailable during readiness evaluation.'],
    compiledProofPacketHash: '',
  };
}

function toMillisSafe(value) {
  const helpers = getMissionOsHelpers();
  if (typeof helpers.toMillis === 'function') {
    return helpers.toMillis(value);
  }
  if (!value) return 0;
  if (typeof value?.toDate === 'function') {
    try { return value.toDate().getTime(); } catch (_) { return 0; }
  }
  if (value instanceof Date) return value.getTime();
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeState(value, fallback = 'pending') {
  const normalized = String(value || '').trim().toLowerCase();
  return READINESS_SIGNAL_STATES.has(normalized) ? normalized : fallback;
}

function normalizeStageGateStatus(value, fallback = 'blocked') {
  const normalized = String(value || '').trim().toLowerCase();
  return STAGE_GATE_STATUSES.has(normalized) ? normalized : fallback;
}

function normalizeSideEffectClass(value, fallback = 'reversible-prepare') {
  const normalized = String(value || '').trim().toLowerCase();
  return SIDE_EFFECT_CLASSES.has(normalized) ? normalized : fallback;
}

function normalizeCreditBucket(value, fallback = 'none') {
  const normalized = String(value || '').trim().toLowerCase();
  return CREDIT_BUCKETS.has(normalized) ? normalized : fallback;
}

function normalizeSpeculativeLifecycleState(value, fallback = 'none') {
  const normalized = String(value || '').trim().toLowerCase();
  return SPECULATIVE_LIFECYCLE_STATES.has(normalized) ? normalized : fallback;
}

function normalizeCleanupState(value, fallback = 'none') {
  const normalized = String(value || '').trim().toLowerCase();
  return CLEANUP_STATES.has(normalized) ? normalized : fallback;
}

function normalizeStageRegressionDirection(value, fallback = 'stable') {
  const normalized = String(value || '').trim().toLowerCase();
  return STAGE_REGRESSION_DIRECTIONS.has(normalized) ? normalized : fallback;
}

function slugify(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 96) || 'signal';
}

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function buildStageIndex(stageGraph = []) {
  const stages = ensureArray(stageGraph)
    .map((stage, index) => ({
      ...stage,
      id: normalizeText(stage?.id) || `stage-${index + 1}`,
      ordinal: Number(stage?.ordinal ?? index + 1) || index + 1,
      entrySignalIds: ensureArray(stage?.entrySignalIds).map(normalizeText).filter(Boolean),
      regressionSignalIds: ensureArray(stage?.regressionSignalIds).map(normalizeText).filter(Boolean),
    }))
    .sort((a, b) => a.ordinal - b.ordinal);

  const byId = new Map(stages.map((stage) => [stage.id, stage]));
  return { stages, byId };
}

function compareStagePositions(stageGraph = [], leftStageId, rightStageId) {
  const { stages, byId } = buildStageIndex(stageGraph);
  const left = byId.get(normalizeText(leftStageId)) || null;
  const right = byId.get(normalizeText(rightStageId)) || null;
  if (!left || !right) return 0;
  if (left.ordinal === right.ordinal) return 0;
  return left.ordinal > right.ordinal ? 1 : -1;
}

function resolveStage(stageGraph = [], stageId) {
  const { stages, byId } = buildStageIndex(stageGraph);
  const resolved = byId.get(normalizeText(stageId)) || null;
  return {
    stage: resolved,
    stages,
    stageIndex: resolved ? stages.findIndex((item) => item.id === resolved.id) : -1,
  };
}

function buildFallbackProofPacket(signal = {}, options = {}) {
  const signalId = normalizeText(signal.id) || `readiness-${slugify(signal.label || signal.successEvent || signal.sourceOfTruth || 'signal')}`;
  const sourceOfTruth = normalizeText(signal.sourceOfTruth || signal.sourceType || options.sourceOfTruth || 'runtime') || 'runtime';
  const sourceQueryId = `${signalId}-source`;
  const metricRefId = `${signalId}-metric`;
  const sourceQuery = {
    id: sourceQueryId,
    sourceType: sourceOfTruth,
    label: normalizeText(signal.successEvent || signal.label || 'readiness signal'),
    commandOrPath: normalizeText(signal.sourceRef || signal.query || signal.command || signal.path || signal.successEvent || signal.label || signalId),
    expectedSignal: normalizeText(signal.expectedSignal || signal.successEvent || signal.label || signalId) || signalId,
    comparator: normalizeText(signal.comparator || 'exists') || 'exists',
    expectedValue: signal.expectedValue ?? true,
    requiredForPass: true,
    evaluationCadence: normalizeText(signal.evaluationCadence || 'instant') || 'instant',
    aggregation: normalizeText(signal.aggregation || 'latest') || 'latest',
    sourceHint: sourceOfTruth,
  };
  return {
    policyRefs: signal.policyRefs || options.policyRefs || {
      missionPolicyId: normalizeText(options.missionPolicyId) || 'mission-playbook-v1',
      domainPolicyId: normalizeText(options.domainPolicyId) || 'mission-readiness-v1',
      scoreCalibrationPackId: normalizeText(options.scoreCalibrationPackId) || 'mission-readiness-score-v1',
    },
    identity: signal.identity || {
      id: signalId,
      label: normalizeText(signal.label || signal.successEvent || signalId),
      sourceOfTruth,
      signalType: normalizeText(signal.signalType || signalId),
    },
    sourceQueries: signal.sourceQueries || [sourceQuery],
    metricRefs: signal.metricRefs || [{
      id: metricRefId,
      label: normalizeText(signal.metricLabel || signal.label || signal.successEvent || signalId),
      sourceQueryId,
      aggregation: normalizeText(signal.aggregation || 'latest') || 'latest',
      comparator: normalizeText(signal.comparator || 'exists') || 'exists',
      expectedValue: signal.expectedValue ?? true,
      requiredForPass: true,
      unit: normalizeText(signal.unit || 'boolean') || 'boolean',
    }],
    qualificationCriteria: signal.qualificationCriteria || [],
    successCriteria: signal.successCriteria || [{
      id: `${signalId}-success`,
      label: normalizeText(signal.successEvent || signal.label || 'Readiness success'),
      metricRefId,
      comparator: normalizeText(signal.comparator || 'exists') || 'exists',
      expectedValue: signal.expectedValue ?? true,
      requiredForPass: true,
    }],
    failureCriteria: signal.failureCriteria || [],
    expiryCriteria: signal.expiryCriteria || [],
    businessEffectCriteria: signal.businessEffectCriteria || [],
    observationWindow: normalizeText(signal.observationWindow || options.observationWindow || 'immediate') || 'immediate',
    evaluationCadence: normalizeText(signal.evaluationCadence || 'instant') || 'instant',
    ownerReviewer: normalizeText(signal.ownerReviewer || options.ownerReviewer || 'mission-supervisor') || 'mission-supervisor',
    attributionExpected: normalizeText(signal.attributionExpected || options.attributionExpected || 'directly-caused') || 'directly-caused',
    primaryMetricRefId: metricRefId,
    evidenceRequirements: signal.evidenceRequirements || [{
      id: `${signalId}-evidence`,
      sourceQueryId,
      minimumRecords: 1,
      snapshotRequired: true,
      freshnessWindowHours: 24,
    }],
    compileChecks: signal.compileChecks || [],
    guardrails: signal.guardrails || [],
    notes: normalizeText(signal.notes || signal.description || signal.label || signal.successEvent || signalId),
  };
}

function normalizeReadinessSignal(input = {}, options = {}) {
  const now = options.now instanceof Date ? options.now : new Date();
  const rawProofPacket = input.proofPacket || input.proofTemplate || null;
  const state = normalizeState(input.state, input.verified === true || input.passed === true ? 'verified' : 'pending');
  const sideEffectClass = normalizeSideEffectClass(input.sideEffectClass, options.sideEffectClass || 'reversible-prepare');
  const creditBucket = normalizeCreditBucket(input.creditBucket, options.creditBucket || (sideEffectClass === 'external-durable' ? 'commercial' : 'execution'));
  const cleanupState = normalizeCleanupState(input.cleanupState, 'none');
  const speculativeLifecycleState = normalizeSpeculativeLifecycleState(input.speculativeLifecycleState, input.speculative ? 'speculative-created' : 'none');
  const proofPacket = rawProofPacket ? rawProofPacket : buildFallbackProofPacket(input, options);
  const compileResult = proofPacket.compileResult || compileProofPacketSafe(proofPacket);
  proofPacket.compileResult = compileResult;
  const nowMs = toMillisSafe(now);
  const verifiedAt = input.verifiedAt || (state === 'verified' ? now : null);
  const expiresAt = input.expiresAt || null;
  const expired = state === 'expired' || (expiresAt && toMillisSafe(expiresAt) > 0 && toMillisSafe(expiresAt) <= nowMs);

  let resolvedState = state;
  if (compileResult.status === 'dry-run-failed') resolvedState = 'failed';
  else if (expired) resolvedState = 'expired';
  else if (state === 'waived') resolvedState = 'waived';
  else if (state === 'revoked') resolvedState = 'revoked';
  else if (state === 'failed') resolvedState = 'failed';
  else if (state === 'verified' && compileResult.status === 'dry-run-passed') resolvedState = 'verified';
  else if (state === 'pending' && compileResult.status === 'dry-run-passed') resolvedState = 'pending';

  return {
    id: normalizeText(input.id) || undefined,
    label: normalizeText(input.label) || normalizeText(input.successEvent) || normalizeText(input.name) || 'Readiness signal',
    state: resolvedState,
    sourceOfTruth: normalizeText(input.sourceOfTruth || input.sourceType) || 'runtime',
    successEvent: normalizeText(input.successEvent || input.label) || null,
    failureEvent: normalizeText(input.failureEvent) || null,
    sideEffectClass,
    creditBucket,
    speculative: Boolean(input.speculative || speculativeLifecycleState !== 'none'),
    speculativeLifecycleState,
    cleanupState,
    cleanupBy: input.cleanupBy || null,
    requiredStageId: normalizeText(input.requiredStageId) || null,
    stageId: normalizeText(input.stageId) || null,
    requiredApprovalTypes: ensureArray(input.requiredApprovalTypes).map(normalizeText).filter(Boolean),
    requiredApprovalScopeType: normalizeText(input.requiredApprovalScopeType) || null,
    requiredApprovalScopeId: normalizeText(input.requiredApprovalScopeId) || null,
    missionId: normalizeText(input.missionId) || null,
    proofPacket,
    proofCompileStatus: compileResult.status,
    proofCompileErrors: compileResult.errors || [],
    compiledProofPacketHash: compileResult.compiledProofPacketHash,
    verifiedAt,
    expiresAt,
    revokedAt: input.revokedAt || null,
    reason: normalizeText(input.reason) || null,
    metadata: input.metadata || {},
    sourceSnapshot: input.sourceSnapshot || null,
  };
}

function resolveReadinessSignals(signals = [], options = {}) {
  const missionPolicy = normalizeMissionPolicySafe(options.missionPolicy || {});
  const now = options.now instanceof Date ? options.now : new Date();
  const normalizedSignals = ensureArray(signals).map((signal) => normalizeReadinessSignal(signal, options));
  const approvalResolution = resolveApprovalEvents(options.approvalEvents || [], {
    ...options,
    now,
    requiredApprovalTypes: options.requiredApprovalTypes || Array.from(new Set(
      normalizedSignals.flatMap((signal) => ensureArray(signal.requiredApprovalTypes))
    )),
  });

  return normalizedSignals.map((signal) => {
    let state = signal.state;
    if (signal.proofCompileStatus === 'dry-run-failed') {
      state = 'failed';
    } else if (signal.state === 'verified' && signal.proofCompileStatus === 'dry-run-passed') {
      state = 'verified';
    } else if (signal.state === 'pending' && signal.proofCompileStatus === 'dry-run-passed') {
      state = 'pending';
    }

    const approvedTypes = ensureArray(signal.requiredApprovalTypes).filter((type) => approvalResolution.approvedApprovalTypes.includes(type));
    const blockedTypes = ensureArray(signal.requiredApprovalTypes).filter((type) => approvalResolution.blockedApprovalTypes.includes(type));
    const missingApprovalTypes = ensureArray(signal.requiredApprovalTypes).filter((type) => approvalResolution.missingApprovalTypes.includes(type));
    if (blockedTypes.length > 0) state = 'failed';
    else if (missingApprovalTypes.length > 0 && state === 'verified') state = 'pending';

    const expired = state === 'expired' || (signal.expiresAt && toMillisSafe(signal.expiresAt) > 0 && toMillisSafe(signal.expiresAt) <= toMillisSafe(now));
    if (expired) state = 'expired';

    const waived = state === 'waived';
    const compiledAt = now;

    return {
      ...signal,
      state,
      approvedApprovalTypes: approvedTypes,
      blockedApprovalTypes: blockedTypes,
      missingApprovalTypes,
      approvalResolution,
      wasWaived: waived,
      verified: state === 'verified',
      failed: state === 'failed',
      expired,
      compileResult: signal.proofPacket?.compileResult || { status: signal.proofCompileStatus, errors: signal.proofCompileErrors },
      compiledAt,
      resolvedAt: now,
      ready: state === 'verified' || state === 'waived',
    };
  });
}

function evaluateStageGate({
  stageGraph = [],
  currentStageId,
  requiredStageId,
  resolvedReadinessSignals = [],
  requiredReadinessSignalIds = [],
  approvalEvents = [],
  requiredApprovalTypes = [],
  actionPolicy = {},
  missionPolicy = {},
  now = new Date(),
  speculative = false,
  sideEffectClass,
  allowSpeculative,
} = {}) {
  const policy = normalizeMissionPolicySafe(missionPolicy || {});
  const stageIndex = buildStageIndex(stageGraph);
  const currentStage = resolveStage(stageGraph, currentStageId).stage;
  const requiredStage = resolveStage(stageGraph, requiredStageId).stage || currentStage;
  const currentOrdinal = currentStage?.ordinal || 0;
  const requiredOrdinal = requiredStage?.ordinal || 0;
  const normalizedReadiness = ensureArray(resolvedReadinessSignals);
  const requiredIds = ensureArray(requiredReadinessSignalIds).map(normalizeText).filter(Boolean);
  const readyById = new Map(normalizedReadiness.map((signal) => [normalizeText(signal.id), signal]));
  const satisfiedReadinessSignalIds = [];
  const waivedReadinessSignalIds = [];
  const missingReadinessSignalIds = [];
  const expiredReadinessSignalIds = [];
  const blockedReadinessSignalIds = [];

  for (const signalId of requiredIds) {
    const signal = readyById.get(signalId);
    if (!signal) {
      missingReadinessSignalIds.push(signalId);
      continue;
    }
    if (signal.state === 'verified') {
      satisfiedReadinessSignalIds.push(signalId);
      continue;
    }
    if (signal.state === 'waived') {
      waivedReadinessSignalIds.push(signalId);
      continue;
    }
    if (signal.state === 'expired') {
      expiredReadinessSignalIds.push(signalId);
      continue;
    }
    if (signal.state === 'failed' || signal.state === 'revoked') {
      blockedReadinessSignalIds.push(signalId);
      continue;
    }
    missingReadinessSignalIds.push(signalId);
  }

  const approvalResolution = approvalEvents.length > 0 || requiredApprovalTypes.length > 0
    ? resolveApprovalEvents(approvalEvents, {
        ...policy,
        now,
        scopeType: actionPolicy?.requiredApprovalScopeType || actionPolicy?.approvalScopeType || 'mission',
        scopeId: actionPolicy?.requiredApprovalScopeId || actionPolicy?.approvalScopeId || undefined,
        requiredApprovalTypes,
      })
    : {
        status: 'approved',
        requiredApprovalTypes: [],
        approvedApprovalTypes: [],
        missingApprovalTypes: [],
        blockedApprovalTypes: [],
        expiredApprovalTypes: [],
        revokedApprovalTypes: [],
        rejectedApprovalTypes: [],
        activeApprovalEventIds: [],
        resolvedByType: {},
      };

  const stageSatisfied = requiredOrdinal === 0 || currentOrdinal >= requiredOrdinal;
  const readinessSatisfied = missingReadinessSignalIds.length === 0 && blockedReadinessSignalIds.length === 0 && expiredReadinessSignalIds.length === 0;
  const approvalSatisfied = approvalResolution.status === 'approved';
  const policyAllowsSpeculative = Boolean(
    allowSpeculative ??
    actionPolicy?.allowSpeculative ??
    policy.executeGateMode === 'allow-speculative'
  );

  let status = 'blocked';
  let blockReasonCode = 'stage-gate-blocked';
  if (!stageSatisfied) {
    status = policyAllowsSpeculative && normalizeSideEffectClass(sideEffectClass, actionPolicy?.sideEffectClass || 'reversible-prepare') !== 'external-durable'
      ? 'speculative'
      : 'blocked';
    blockReasonCode = 'stage-not-reached';
  } else if (!readinessSatisfied) {
    status = policyAllowsSpeculative && normalizeSideEffectClass(sideEffectClass, actionPolicy?.sideEffectClass || 'reversible-prepare') !== 'external-durable'
      ? 'speculative'
      : 'blocked';
    blockReasonCode = missingReadinessSignalIds.length > 0 ? 'missing-readiness-signals' : 'readiness-failed';
  } else if (!approvalSatisfied) {
    status = policyAllowsSpeculative && normalizeSideEffectClass(sideEffectClass, actionPolicy?.sideEffectClass || 'reversible-prepare') !== 'external-durable'
      ? 'speculative'
      : 'blocked';
    blockReasonCode = 'approval-gate-blocked';
  } else if (waivedReadinessSignalIds.length > 0 || approvalResolution.status === 'approved' && approvalResolution.approvedApprovalTypes.length > 0 && approvalResolution.missingApprovalTypes.length === 0 && approvalResolution.blockedApprovalTypes.length === 0 && waivedReadinessSignalIds.length > 0) {
    status = 'waived';
    blockReasonCode = 'waived-exception';
  } else {
    status = 'passed';
    blockReasonCode = '';
  }

  const requiredApprovalEventIds = approvalResolution.activeApprovalEventIds || [];
  const activeSideEffectClass = normalizeSideEffectClass(sideEffectClass || actionPolicy?.sideEffectClass || 'reversible-prepare');
  const targetStage = requiredStage || currentStage || stageIndex.stages[0] || null;

  return {
    status: normalizeStageGateStatus(status),
    blockReasonCode: normalizeText(blockReasonCode) || undefined,
    blockReasonDetail: status === 'blocked'
      ? (missingReadinessSignalIds.length > 0
          ? `Missing readiness signals: ${missingReadinessSignalIds.join(', ')}`
          : blockedReadinessSignalIds.length > 0
            ? `Blocked readiness signals: ${blockedReadinessSignalIds.join(', ')}`
            : approvalResolution.status !== 'approved'
              ? `Approval gate status: ${approvalResolution.status}`
              : 'Stage gate blocked.'
        )
      : undefined,
    currentStageId: currentStage?.id || normalizeText(currentStageId) || undefined,
    requiredStageId: targetStage?.id || normalizeText(requiredStageId) || undefined,
    currentStageOrdinal: currentStage?.ordinal || 0,
    requiredStageOrdinal: targetStage?.ordinal || 0,
    satisfiedReadinessSignalIds,
    waivedReadinessSignalIds,
    missingReadinessSignalIds,
    expiredReadinessSignalIds,
    blockedReadinessSignalIds,
    requiredApprovalTypes: ensureArray(requiredApprovalTypes).map(normalizeText).filter(Boolean),
    requiredApprovalEventIds,
    approvalResolution,
    sideEffectClass: activeSideEffectClass,
    speculative: Boolean(speculative),
    stageGraph: stageIndex.stages,
    stageOrdinalDelta: (currentStage?.ordinal || 0) - (targetStage?.ordinal || 0),
  };
}

function deriveCreditBucket({
  sideEffectClass,
  speculative,
  stageGateStatus,
  commercialCreditEligible,
  creditBucket,
  creditMode,
  actionPolicy = {},
} = {}) {
  const normalizedSideEffectClass = normalizeSideEffectClass(sideEffectClass, actionPolicy.sideEffectClass || 'reversible-prepare');
  const normalizedStageGateStatus = normalizeStageGateStatus(stageGateStatus, 'blocked');
  const normalizedCreditMode = normalizeText(creditMode || actionPolicy.defaultCreditMode || '').toLowerCase();
  const explicitBucket = normalizeCreditBucket(creditBucket, 'none');

  if (normalizedStageGateStatus === 'blocked') return 'none';
  if (explicitBucket !== 'none') return explicitBucket;
  if (normalizedCreditMode === 'none') return 'none';
  if (normalizedCreditMode === 'commercial') {
    if (speculative && normalizedSideEffectClass === 'external-durable') return 'none';
    if (commercialCreditEligible === false) return 'none';
    return 'commercial';
  }
  if (normalizedCreditMode === 'execution') return 'execution';

  if (speculative) {
    if (normalizedSideEffectClass === 'external-durable') return 'none';
    return 'execution';
  }

  if (normalizedSideEffectClass === 'external-durable') {
    if (commercialCreditEligible === false) return 'none';
    return 'commercial';
  }

  return 'execution';
}

function mapScoreBuckets(items = [], options = {}) {
  const buckets = {
    executionScore: 0,
    commercialMovementScore: 0,
    creditedOutcomeScore: 0,
    netOutcomeScore: 0,
    businessDebtScore: 0,
    itemCount: 0,
    commercialItemCount: 0,
    executionItemCount: 0,
    noneItemCount: 0,
    byBucket: {
      execution: [],
      commercial: [],
      none: [],
    },
  };

  for (const item of ensureArray(items)) {
    const score = item?.score || item || {};
    const creditBucket = deriveCreditBucket({
      sideEffectClass: item?.sideEffectClass || score?.sideEffectClass || options.sideEffectClass,
      speculative: item?.speculative ?? score?.speculative ?? options.speculative ?? false,
      stageGateStatus: item?.stageGateStatus || score?.stageGateStatus || options.stageGateStatus || 'passed',
      commercialCreditEligible: item?.commercialCreditEligible ?? score?.commercialCreditEligible ?? options.commercialCreditEligible,
      creditBucket: item?.creditBucket || score?.creditBucket || options.creditBucket,
      creditMode: item?.creditMode || score?.creditMode || options.creditMode,
      actionPolicy: item?.actionPolicy || score?.actionPolicy || options.actionPolicy || {},
    });
    const credited = Number(score?.creditedOutcomeScore ?? item?.creditedOutcomeScore ?? 0) || 0;
    const net = Number(score?.netOutcomeScore ?? item?.netOutcomeScore ?? 0) || 0;
    const debt = Number(score?.businessDebtScore ?? item?.businessDebtScore ?? 0) || 0;
    const bucketEntry = {
      id: item?.id,
      creditBucket,
      creditedOutcomeScore: credited,
      netOutcomeScore: net,
      businessDebtScore: debt,
    };

    buckets.itemCount += 1;
    buckets.creditedOutcomeScore += credited;
    buckets.netOutcomeScore += net;
    buckets.businessDebtScore += debt;
    buckets.byBucket[creditBucket].push(bucketEntry);

    if (creditBucket === 'commercial') {
      buckets.commercialItemCount += 1;
      buckets.executionScore += credited;
      buckets.commercialMovementScore += net;
    } else if (creditBucket === 'execution') {
      buckets.executionItemCount += 1;
      buckets.executionScore += credited;
    } else {
      buckets.noneItemCount += 1;
    }
  }

  return buckets;
}

function transitionSpeculativeLifecycle(currentState = 'none', event = {}) {
  const state = normalizeSpeculativeLifecycleState(currentState, 'none');
  const type = normalizeText(event.type || event.action || event.transition || '').toLowerCase();
  const now = event.at || event.timestamp || new Date();
  const cleanupBy = event.cleanupBy || null;

  switch (type) {
    case 'schedule':
    case 'scheduled':
      return { state: 'scheduled', updatedAt: now, cleanupBy, reason: normalizeText(event.reason) || undefined };
    case 'create':
    case 'created':
    case 'speculative-created':
      return { state: 'speculative-created', updatedAt: now, cleanupBy, reason: normalizeText(event.reason) || undefined };
    case 'convert':
    case 'converted':
      return { state: 'converted', updatedAt: now, cleanupBy: null, reason: normalizeText(event.reason) || undefined };
    case 'retire-required':
    case 'retire':
      return { state: 'retire-required', updatedAt: now, cleanupBy: cleanupBy || event.retireBy || null, reason: normalizeText(event.reason) || undefined };
    case 'retired':
      return { state: 'retired', updatedAt: now, cleanupBy: cleanupBy || null, reason: normalizeText(event.reason) || undefined };
    case 'expired':
      return { state: 'expired', updatedAt: now, cleanupBy: cleanupBy || null, reason: normalizeText(event.reason) || undefined };
    case 'cleanup-failed':
      return { state: 'cleanup-failed', updatedAt: now, cleanupBy: cleanupBy || null, reason: normalizeText(event.reason) || undefined };
    default:
      return { state, updatedAt: now, cleanupBy, reason: normalizeText(event.reason) || undefined };
  }
}

function evaluateStageRegression({
  stageGraph = [],
  currentStageId,
  resolvedReadinessSignals = [],
  now = new Date(),
} = {}) {
  const { stages } = buildStageIndex(stageGraph);
  if (stages.length === 0) {
    return {
      direction: 'stable',
      fromStageId: normalizeText(currentStageId) || undefined,
      toStageId: normalizeText(currentStageId) || undefined,
      triggerSignalId: undefined,
      reason: 'No stage graph available.',
      blockedActionTypeIds: [],
      regressionSignalIds: [],
      evaluatedAt: now,
    };
  }

  const currentStage = resolveStage(stageGraph, currentStageId).stage || stages[0];
  const normalizedSignals = ensureArray(resolvedReadinessSignals);
  const failedSignals = normalizedSignals.filter((signal) => ['failed', 'expired', 'revoked'].includes(normalizeText(signal?.state).toLowerCase()));
  const stateBySignalId = new Map(normalizedSignals.map((signal) => [normalizeText(signal?.id), signal]));

  const satisfiedStageIds = stages
    .filter((stage) => stage.entrySignalIds.every((signalId) => {
      const signal = stateBySignalId.get(signalId);
      return signal && ['verified', 'waived'].includes(normalizeText(signal.state).toLowerCase());
    }))
    .map((stage) => stage.id);

  const highestSatisfiedStage = stages
    .filter((stage) => satisfiedStageIds.includes(stage.id))
    .sort((a, b) => b.ordinal - a.ordinal)[0] || stages[0];

  if (!failedSignals.length && highestSatisfiedStage.id === currentStage.id) {
    return {
      direction: 'stable',
      fromStageId: currentStage.id,
      toStageId: currentStage.id,
      triggerSignalId: undefined,
      reason: 'Current stage remains valid.',
      blockedActionTypeIds: [],
      regressionSignalIds: [],
      evaluatedAt: now,
    };
  }

  const triggerSignal = failedSignals[0] || null;
  const direction = highestSatisfiedStage.ordinal < currentStage.ordinal ? 'backward' : 'forward';
  const blockedActionTypeIds = stages
    .filter((stage) => stage.ordinal > highestSatisfiedStage.ordinal)
    .flatMap((stage) => ensureArray(stage.actionTypeIds).map(normalizeText))
    .filter(Boolean);

  return {
    direction: normalizeStageRegressionDirection(direction, 'stable'),
    fromStageId: currentStage.id,
    toStageId: highestSatisfiedStage.id,
    triggerSignalId: triggerSignal ? normalizeText(triggerSignal.id) || undefined : undefined,
    reason: triggerSignal
      ? `Readiness signal ${normalizeText(triggerSignal.id) || 'unknown'} regressed.`
      : `Highest satisfied stage remains ${highestSatisfiedStage.id}.`,
    blockedActionTypeIds,
    regressionSignalIds: failedSignals.map((signal) => normalizeText(signal.id)).filter(Boolean),
    evaluatedAt: now,
  };
}

function deriveCleanupState({
  speculativeLifecycleState = 'none',
  stageRegression = null,
  cleanupBy = null,
  now = new Date(),
} = {}) {
  const lifecycleState = normalizeSpeculativeLifecycleState(speculativeLifecycleState, 'none');
  const cleanupByMs = toMillisSafe(cleanupBy);
  const nowMs = toMillisSafe(now);
  const regressionDirection = normalizeText(stageRegression?.direction || 'stable').toLowerCase();

  if (lifecycleState === 'none') {
    return {
      state: 'none',
      cleanupRequired: false,
      cleanupBy: cleanupBy || null,
      reason: 'Not speculative.',
    };
  }

  if (lifecycleState === 'converted' || lifecycleState === 'retired' || lifecycleState === 'cleanup-failed') {
    return {
      state: normalizeCleanupState(lifecycleState, lifecycleState),
      cleanupRequired: false,
      cleanupBy: cleanupBy || null,
      reason: lifecycleState,
    };
  }

  if (regressionDirection === 'backward') {
    return {
      state: 'retire-required',
      cleanupRequired: true,
      cleanupBy: cleanupBy || null,
      reason: 'Stage regression requires retirement or conversion cleanup.',
    };
  }

  if (cleanupByMs > 0 && cleanupByMs <= nowMs) {
    return {
      state: 'expired',
      cleanupRequired: true,
      cleanupBy: cleanupBy || null,
      reason: 'Cleanup TTL elapsed.',
    };
  }

  if (lifecycleState === 'scheduled' || lifecycleState === 'speculative-created') {
    return {
      state: 'scheduled',
      cleanupRequired: true,
      cleanupBy: cleanupBy || null,
      reason: 'Speculative artifact still pending cleanup or conversion.',
    };
  }

  return {
    state: normalizeCleanupState(lifecycleState, 'none'),
    cleanupRequired: lifecycleState === 'retire-required' || lifecycleState === 'expired',
    cleanupBy: cleanupBy || null,
    reason: 'Derived from speculative lifecycle.',
  };
}

function buildSpeculativeLifecycleSnapshot({
  speculative = false,
  speculativeLifecycleState,
  stageGateStatus,
  cleanupBy,
  stageRegression = null,
  now = new Date(),
} = {}) {
  const normalizedState = normalizeSpeculativeLifecycleState(
    speculativeLifecycleState,
    speculative ? 'speculative-created' : 'none'
  );
  const cleanupState = deriveCleanupState({
    speculativeLifecycleState: normalizedState,
    stageRegression,
    cleanupBy,
    now,
  });

  return {
    speculative: Boolean(speculative || normalizedState !== 'none'),
    lifecycleState: normalizedState,
    cleanupState: cleanupState.state,
    cleanupRequired: cleanupState.cleanupRequired,
    cleanupBy: cleanupState.cleanupBy,
    stageGateStatus: normalizeStageGateStatus(stageGateStatus, 'blocked'),
    stageRegression,
    updatedAt: now,
  };
}

function buildAdmissionReadinessDecision({
  readinessSignals = [],
  stageGraph = [],
  currentStageId,
  requiredStageId,
  requiredReadinessSignalIds = [],
  approvalEvents = [],
  requiredApprovalTypes = [],
  actionPolicy = {},
  missionPolicy = {},
  sideEffectClass,
  speculative = false,
  allowSpeculative,
  scoreItems = [],
  creditMode,
  commercialCreditEligible,
  cleanupBy,
  now = new Date(),
} = {}) {
  const resolvedSignals = resolveReadinessSignals(readinessSignals, {
    missionPolicy,
    approvalEvents,
    requiredApprovalTypes,
    now,
  });
  const stageGate = evaluateStageGate({
    stageGraph,
    currentStageId,
    requiredStageId,
    resolvedReadinessSignals: resolvedSignals,
    requiredReadinessSignalIds,
    approvalEvents,
    requiredApprovalTypes,
    actionPolicy,
    missionPolicy,
    sideEffectClass,
    speculative,
    allowSpeculative,
    now,
  });
  const creditBucket = deriveCreditBucket({
    sideEffectClass: stageGate.sideEffectClass || sideEffectClass,
    speculative,
    stageGateStatus: stageGate.status,
    commercialCreditEligible,
    creditBucket: actionPolicy?.creditBucket,
    creditMode,
    actionPolicy,
  });
  const scoreSummary = mapScoreBuckets(scoreItems, {
    sideEffectClass,
    speculative,
    stageGateStatus: stageGate.status,
    commercialCreditEligible,
    creditBucket,
    creditMode,
    actionPolicy,
  });
  const lifecycle = buildSpeculativeLifecycleSnapshot({
    speculative,
    speculativeLifecycleState: stageGate.status === 'speculative' ? 'speculative-created' : 'none',
    stageGateStatus: stageGate.status,
    cleanupBy,
    now,
  });

  return {
    readinessSignals: resolvedSignals,
    stageGate,
    creditBucket,
    scoreSummary,
    lifecycle,
    admitExecuteTask: stageGate.status !== 'blocked',
  };
}

module.exports = {
  CLEANUP_STATES,
  CREDIT_BUCKETS,
  READINESS_SIGNAL_STATES,
  SIDE_EFFECT_CLASSES,
  SPECULATIVE_LIFECYCLE_STATES,
  STAGE_GATE_STATUSES,
  STAGE_REGRESSION_DIRECTIONS,
  buildAdmissionReadinessDecision,
  buildFallbackProofPacket,
  buildSpeculativeLifecycleSnapshot,
  compareStagePositions,
  deriveCleanupState,
  deriveCreditBucket,
  evaluateStageGate,
  evaluateStageRegression,
  mapScoreBuckets,
  normalizeCleanupState,
  normalizeCreditBucket,
  normalizeReadinessSignal,
  normalizeSpeculativeLifecycleState,
  normalizeSideEffectClass,
  normalizeStageGateStatus,
  normalizeStageRegressionDirection,
  resolveReadinessSignals,
  resolveStage,
  transitionSpeculativeLifecycle,
};
