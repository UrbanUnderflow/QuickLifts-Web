const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildFallbackProofPacket,
  buildSpeculativeLifecycleSnapshot,
  evaluateStageGate,
  mapScoreBuckets,
  normalizeReadinessSignal,
  resolveReadinessSignals,
  transitionSpeculativeLifecycle,
} = require('../../../scripts/missionReadiness');

function makeSignal(overrides = {}) {
  return {
    id: 'interest-confirmed',
    label: 'Interest confirmed',
    state: 'verified',
    sourceOfTruth: 'crm',
    successEvent: 'target explicitly confirms interest',
    verifiedAt: new Date('2026-04-04T12:00:00.000Z'),
    ...overrides,
  };
}

function makeStageGraph() {
  return [
    { id: 'target-selected', ordinal: 1, entrySignalIds: ['target-identity-locked'] },
    { id: 'interest-confirmed', ordinal: 2, entrySignalIds: ['interest-confirmed'] },
    { id: 'activation-ready', ordinal: 3, entrySignalIds: ['activation-link-created'] },
  ];
}

test('normalizeReadinessSignal compiles fallback proof packets and fails invalid proof packets', () => {
  const compiled = normalizeReadinessSignal(makeSignal({
    state: 'pending',
    proofPacket: buildFallbackProofPacket({
      id: 'owner-email-confirmed',
      label: 'Owner email confirmed',
      sourceOfTruth: 'crm',
      successEvent: 'verified owner email exists',
    }),
  }));

  assert.equal(compiled.proofCompileStatus, 'dry-run-passed');
  assert.equal(compiled.state, 'pending');
  assert.ok(compiled.compiledProofPacketHash);

  const broken = normalizeReadinessSignal(makeSignal({
    state: 'verified',
    proofPacket: {
      policyRefs: {
        missionPolicyId: 'mission-playbook-v1',
        domainPolicyId: 'mission-readiness-v1',
        scoreCalibrationPackId: 'mission-readiness-score-v1',
      },
      sourceQueries: [{ id: 'source-1', sourceType: 'crm', query: 'crm/account-1' }],
      metricRefs: [{ id: 'metric-1', sourceQueryId: 'missing-source', aggregation: 'latest' }],
      successCriteria: [{ id: 'success-1', metricRefId: 'metric-1', comparator: 'exists', expectedValue: true }],
      evidenceRequirements: [{ id: 'evidence-1', sourceQueryId: 'missing-source' }],
      primaryMetricRefId: 'metric-1',
    },
  }));

  assert.equal(broken.proofCompileStatus, 'dry-run-failed');
  assert.equal(broken.state, 'failed');
  assert.match(broken.proofCompileErrors.join('\n'), /missing source query/i);
});

test('evaluateStageGate returns passed, blocked, and speculative states', () => {
  const stageGraph = makeStageGraph();
  const verifiedSignal = resolveReadinessSignals([makeSignal()], {
    missionPolicy: { executeGateMode: 'strict' },
    now: new Date('2026-04-04T12:30:00.000Z'),
  });

  const passed = evaluateStageGate({
    stageGraph,
    currentStageId: 'interest-confirmed',
    requiredStageId: 'interest-confirmed',
    resolvedReadinessSignals: verifiedSignal,
    requiredReadinessSignalIds: ['interest-confirmed'],
    actionPolicy: { sideEffectClass: 'internal-durable' },
    missionPolicy: { executeGateMode: 'strict' },
    sideEffectClass: 'internal-durable',
    now: new Date('2026-04-04T12:30:00.000Z'),
  });

  assert.equal(passed.status, 'passed');
  assert.deepEqual(passed.missingReadinessSignalIds, []);

  const blocked = evaluateStageGate({
    stageGraph,
    currentStageId: 'interest-confirmed',
    requiredStageId: 'activation-ready',
    resolvedReadinessSignals: verifiedSignal,
    requiredReadinessSignalIds: ['activation-link-created'],
    actionPolicy: { sideEffectClass: 'external-durable', allowSpeculative: false },
    missionPolicy: { executeGateMode: 'strict' },
    sideEffectClass: 'external-durable',
    now: new Date('2026-04-04T12:30:00.000Z'),
  });

  assert.equal(blocked.status, 'blocked');
  assert.equal(blocked.blockReasonCode, 'stage-not-reached');
  assert.deepEqual(blocked.missingReadinessSignalIds, ['activation-link-created']);

  const speculative = evaluateStageGate({
    stageGraph,
    currentStageId: 'target-selected',
    requiredStageId: 'interest-confirmed',
    resolvedReadinessSignals: resolveReadinessSignals([makeSignal({ state: 'pending' })], {
      missionPolicy: { executeGateMode: 'allow-speculative' },
      now: new Date('2026-04-04T12:30:00.000Z'),
    }),
    requiredReadinessSignalIds: ['interest-confirmed'],
    actionPolicy: { sideEffectClass: 'internal-durable', allowSpeculative: true },
    missionPolicy: { executeGateMode: 'allow-speculative' },
    sideEffectClass: 'internal-durable',
    allowSpeculative: true,
    speculative: true,
    now: new Date('2026-04-04T12:30:00.000Z'),
  });

  assert.equal(speculative.status, 'speculative');
  assert.equal(speculative.blockReasonCode, 'stage-not-reached');
});

test('resolveReadinessSignals enforces required approval events before signals count as ready', () => {
  const approved = resolveReadinessSignals([
    makeSignal({
      id: 'activation-link-created',
      requiredApprovalTypes: ['mission-owner'],
    }),
  ], {
    missionPolicy: { executeGateMode: 'strict' },
    requiredApprovalTypes: ['mission-owner'],
    approvalEvents: [{
      id: 'approval-1',
      approvalType: 'mission-owner',
      scopeType: 'mission',
      decision: 'approved',
      createdAt: new Date('2026-04-04T11:00:00.000Z'),
      effectiveUntil: new Date('2026-04-05T11:00:00.000Z'),
    }],
    now: new Date('2026-04-04T12:30:00.000Z'),
  });

  assert.equal(approved[0].state, 'verified');
  assert.deepEqual(approved[0].approvedApprovalTypes, ['mission-owner']);

  const blocked = resolveReadinessSignals([
    makeSignal({
      id: 'activation-link-created',
      requiredApprovalTypes: ['mission-owner'],
    }),
  ], {
    missionPolicy: { executeGateMode: 'strict' },
    requiredApprovalTypes: ['mission-owner'],
    approvalEvents: [{
      id: 'approval-2',
      approvalType: 'mission-owner',
      scopeType: 'mission',
      decision: 'rejected',
      createdAt: new Date('2026-04-04T11:00:00.000Z'),
    }],
    now: new Date('2026-04-04T12:30:00.000Z'),
  });

  assert.equal(blocked[0].state, 'failed');
  assert.deepEqual(blocked[0].blockedApprovalTypes, ['mission-owner']);
});

test('mapScoreBuckets keeps execution score separate from commercial movement score', () => {
  const summary = mapScoreBuckets([
    {
      id: 'internal-shell',
      score: { creditedOutcomeScore: 12, netOutcomeScore: 9, businessDebtScore: 0 },
      sideEffectClass: 'internal-durable',
      stageGateStatus: 'passed',
      speculative: false,
      actionPolicy: { defaultCreditMode: 'execution' },
    },
    {
      id: 'activation-send',
      score: { creditedOutcomeScore: 10, netOutcomeScore: 8, businessDebtScore: 1 },
      sideEffectClass: 'external-durable',
      stageGateStatus: 'passed',
      speculative: false,
      actionPolicy: { defaultCreditMode: 'commercial' },
    },
    {
      id: 'speculative-send',
      score: { creditedOutcomeScore: 6, netOutcomeScore: 6, businessDebtScore: 0 },
      sideEffectClass: 'external-durable',
      stageGateStatus: 'speculative',
      speculative: true,
      actionPolicy: { defaultCreditMode: 'commercial' },
    },
  ]);

  assert.equal(summary.executionScore, 22);
  assert.equal(summary.commercialMovementScore, 8);
  assert.equal(summary.businessDebtScore, 1);
  assert.equal(summary.commercialItemCount, 1);
  assert.equal(summary.noneItemCount, 1);
});

test('speculative lifecycle transitions drive cleanup state changes', () => {
  const scheduled = transitionSpeculativeLifecycle('none', {
    type: 'schedule',
    at: new Date('2026-04-04T12:00:00.000Z'),
    cleanupBy: new Date('2026-04-11T12:00:00.000Z'),
  });
  assert.equal(scheduled.state, 'scheduled');

  const created = transitionSpeculativeLifecycle(scheduled.state, {
    type: 'speculative-created',
    at: new Date('2026-04-04T12:05:00.000Z'),
    cleanupBy: new Date('2026-04-11T12:00:00.000Z'),
  });
  assert.equal(created.state, 'speculative-created');

  const retireRequired = buildSpeculativeLifecycleSnapshot({
    speculative: true,
    speculativeLifecycleState: created.state,
    stageGateStatus: 'speculative',
    cleanupBy: new Date('2026-04-11T12:00:00.000Z'),
    stageRegression: { direction: 'backward', toStageId: 'target-selected' },
    now: new Date('2026-04-05T12:00:00.000Z'),
  });

  assert.equal(retireRequired.cleanupState, 'retire-required');
  assert.equal(retireRequired.cleanupRequired, true);

  const retired = transitionSpeculativeLifecycle('retire-required', {
    type: 'retired',
    at: new Date('2026-04-05T14:00:00.000Z'),
  });
  assert.equal(retired.state, 'retired');
});
