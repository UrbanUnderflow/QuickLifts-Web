const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildAdmissionDecision,
} = require('../../../scripts/missionAdmissionTypes');
const {
  EXTERNAL_ACCOUNT_ACTIVATION_PLAYBOOK_ID,
  getMissionPlaybook,
} = require('../../../scripts/missionPlaybooks');
const {
  buildCanaryMissionInstancePolicy,
} = require('../../../scripts/missionPolicies');
const {
  buildAdmissionReadinessDecision,
  evaluateStageRegression,
} = require('../../../scripts/missionReadiness');

function makeVerifiedSignal(id, overrides = {}) {
  return {
    id,
    label: id,
    state: 'verified',
    sourceOfTruth: 'firestore',
    successEvent: `${id} verified`,
    verifiedAt: new Date('2026-04-04T12:00:00.000Z'),
    ...overrides,
  };
}

test('external account activation playbook exposes ordered stages and cleanup rules', () => {
  const playbook = getMissionPlaybook(EXTERNAL_ACCOUNT_ACTIVATION_PLAYBOOK_ID);

  assert.ok(playbook);
  assert.equal(playbook.id, EXTERNAL_ACCOUNT_ACTIVATION_PLAYBOOK_ID);
  assert.equal(playbook.version, 1);
  assert.equal(playbook.versionTag, 'v1.1');
  assert.equal(playbook.stageGraph[0].id, 'target-selected');
  assert.equal(playbook.stageGraph.at(-1).id, 'container-ready');
  assert.ok(playbook.cleanupRules.some((rule) => rule.actionType === 'preprovision-org-team-shell'));
});

test('buildCanaryMissionInstancePolicy seeds readiness and speculative actions from the playbook', () => {
  const policy = buildCanaryMissionInstancePolicy({
    missionId: 'mission-alpha',
    canary: true,
  });

  assert.equal(policy.playbookId, EXTERNAL_ACCOUNT_ACTIVATION_PLAYBOOK_ID);
  assert.equal(policy.executeGateMode, 'allow-speculative');
  assert.ok(policy.readinessSignals.some((signal) => signal.id === 'interest-confirmed'));
  assert.ok(policy.speculativeActionsAllowed.includes('preprovision-org-team-shell'));
  assert.ok(policy.speculativeActionsAllowed.includes('reserve-admin-membership'));
});

test('external account activation playbook includes explicit interest and owner-email confirmation actions', () => {
  const playbook = getMissionPlaybook(EXTERNAL_ACCOUNT_ACTIVATION_PLAYBOOK_ID);
  const confirmInterest = playbook.actionPolicies.find((policy) => policy.actionType === 'confirm-interest');
  const confirmOwnerEmail = playbook.actionPolicies.find((policy) => policy.actionType === 'confirm-owner-email');

  assert.ok(confirmInterest);
  assert.equal(confirmInterest.requiredStageId, 'outreach-sent');
  assert.deepEqual(confirmInterest.requiredReadinessSignalIds, ['outreach-sent']);
  assert.equal(confirmInterest.defaultCreditMode, 'commercial');

  assert.ok(confirmOwnerEmail);
  assert.equal(confirmOwnerEmail.requiredStageId, 'interest-confirmed');
  assert.deepEqual(confirmOwnerEmail.requiredReadinessSignalIds, ['interest-confirmed']);
  assert.equal(confirmOwnerEmail.defaultCreditMode, 'execution');
});

test('buildAdmissionDecision maps score gate results into execute admission', () => {
  const speculativePass = buildAdmissionDecision({
    proofCompileStatus: 'passed',
    outcomeGraphStatus: 'valid',
    stageGateStatus: 'speculative',
    scoreGateStatus: 'passed',
  });

  assert.equal(speculativePass.stageGateStatus, 'speculative');
  assert.equal(speculativePass.admitExecuteTask, true);

  const scoreFailed = buildAdmissionDecision({
    proofCompileStatus: 'passed',
    outcomeGraphStatus: 'valid',
    stageGateStatus: 'passed',
    scoreGateStatus: 'failed',
  });

  assert.equal(scoreFailed.stageGateStatus, 'passed');
  assert.equal(scoreFailed.scoreGateStatus, 'failed');
  assert.equal(scoreFailed.admitExecuteTask, false);
});

test('playbook action policies enforce approval events for durable sends', () => {
  const playbook = getMissionPlaybook();
  const actionPolicy = playbook.actionPolicies.find((policy) => policy.actionType === 'send-activation-link');

  const blocked = buildAdmissionReadinessDecision({
    readinessSignals: [
      makeVerifiedSignal('activation-link-created'),
      makeVerifiedSignal('owner-email-confirmed', { sourceOfTruth: 'crm' }),
    ],
    stageGraph: playbook.stageGraph,
    currentStageId: 'activation-link-created',
    requiredStageId: actionPolicy.requiredStageId,
    requiredReadinessSignalIds: actionPolicy.requiredReadinessSignalIds,
    requiredApprovalTypes: actionPolicy.requiredApprovalTypes,
    actionPolicy,
    missionPolicy: { executeGateMode: 'strict' },
    sideEffectClass: actionPolicy.sideEffectClass,
    allowSpeculative: actionPolicy.allowSpeculative,
    scoreItems: [{
      score: { creditedOutcomeScore: 14, netOutcomeScore: 11, businessDebtScore: 0 },
      sideEffectClass: actionPolicy.sideEffectClass,
      actionPolicy,
    }],
    now: new Date('2026-04-04T13:00:00.000Z'),
  });

  assert.equal(blocked.stageGate.status, 'blocked');
  assert.equal(blocked.stageGate.blockReasonCode, 'approval-gate-blocked');
  assert.deepEqual(blocked.stageGate.requiredApprovalTypes, ['mission-owner']);

  const approved = buildAdmissionReadinessDecision({
    readinessSignals: [
      makeVerifiedSignal('activation-link-created'),
      makeVerifiedSignal('owner-email-confirmed', { sourceOfTruth: 'crm' }),
    ],
    stageGraph: playbook.stageGraph,
    currentStageId: 'activation-link-created',
    requiredStageId: actionPolicy.requiredStageId,
    requiredReadinessSignalIds: actionPolicy.requiredReadinessSignalIds,
    requiredApprovalTypes: actionPolicy.requiredApprovalTypes,
    approvalEvents: [{
      id: 'approval-1',
      approvalType: 'mission-owner',
      scopeType: 'mission',
      decision: 'approved',
      createdAt: new Date('2026-04-04T12:30:00.000Z'),
      effectiveUntil: new Date('2026-04-05T12:30:00.000Z'),
    }],
    actionPolicy,
    missionPolicy: { executeGateMode: 'strict' },
    sideEffectClass: actionPolicy.sideEffectClass,
    allowSpeculative: actionPolicy.allowSpeculative,
    scoreItems: [{
      score: { creditedOutcomeScore: 14, netOutcomeScore: 11, businessDebtScore: 0 },
      sideEffectClass: actionPolicy.sideEffectClass,
      actionPolicy,
    }],
    now: new Date('2026-04-04T13:00:00.000Z'),
  });

  assert.equal(approved.stageGate.status, 'passed');
  assert.deepEqual(approved.stageGate.requiredApprovalEventIds, ['approval-1']);
  assert.equal(approved.creditBucket, 'commercial');
});

test('evaluateStageRegression rolls missions backward when a later-stage signal regresses', () => {
  const playbook = getMissionPlaybook();

  const regression = evaluateStageRegression({
    stageGraph: playbook.stageGraph,
    currentStageId: 'activation-sent',
    resolvedReadinessSignals: [
      makeVerifiedSignal('target-identity-locked', { sourceOfTruth: 'crm' }),
      makeVerifiedSignal('contact-route-confirmed', { sourceOfTruth: 'crm' }),
      makeVerifiedSignal('outreach-asset-ready', { sourceOfTruth: 'repo' }),
      makeVerifiedSignal('outreach-sent', { sourceOfTruth: 'crm' }),
      makeVerifiedSignal('interest-confirmed', { sourceOfTruth: 'crm' }),
      makeVerifiedSignal('owner-email-confirmed', { sourceOfTruth: 'crm' }),
      makeVerifiedSignal('activation-link-created'),
      {
        id: 'activation-link-sent',
        label: 'activation-link-sent',
        state: 'revoked',
        sourceOfTruth: 'firestore',
        successEvent: 'activation-link-sent revoked',
        revokedAt: new Date('2026-04-04T13:30:00.000Z'),
      },
    ],
    now: new Date('2026-04-04T14:00:00.000Z'),
  });

  assert.equal(regression.direction, 'backward');
  assert.equal(regression.fromStageId, 'activation-sent');
  assert.equal(regression.toStageId, 'activation-link-created');
  assert.equal(regression.triggerSignalId, 'activation-link-sent');
});
