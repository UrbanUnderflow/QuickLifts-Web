const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildExecuteTaskContract,
  buildOutcomeEvaluation,
  advanceOutcomeObservation,
  summarizeMissionOutcomes,
} = require('../../../scripts/missionOsV2');

function makeTask(overrides = {}) {
  return {
    id: 'task-1',
    missionId: 'mission-alpha',
    name: 'Launch qualified partnership campaign',
    description: 'Ship the partnership outreach automation and prove the live route works.',
    assignee: 'nora',
    priority: 'high',
    priorityScore: 34,
    northStarObjective: 'Book ICP-fit partner meetings',
    objectiveId: 'objective-partnerships',
    artifactSpec: {
      kind: 'runtime_change',
      targets: ['src/pages/admin/missionControl.tsx', 'company-config/mission-status'],
      successDefinition: 'Qualified partner workflow is live and observable.',
      mustTouchRepo: true,
      impactScope: 'external',
    },
    acceptanceChecks: [
      {
        kind: 'shell',
        label: 'Mission runtime loads',
        commandOrPath: 'npm run build',
        expectedSignal: 'Compiled successfully',
      },
      {
        kind: 'firestore',
        label: 'Partnership route evidence',
        commandOrPath: 'agent-outcomes/mission-alpha',
        expectedSignal: 'confirmed',
      },
    ],
    ...overrides,
  };
}

test('buildExecuteTaskContract compiles proof and passes execute gate for a strong execute task', () => {
  const contract = buildExecuteTaskContract(makeTask(), {
    missionPolicy: {
      mode: 'execute',
      plannerMinimumCreditedScore: 20,
      plannerMinimumNetScore: 20,
      executeGateMode: 'credited-and-net',
    },
    missionId: 'mission-alpha',
    assignee: 'nora',
  });

  assert.equal(contract.hasContract, true);
  assert.equal(contract.proofCompileStatus, 'dry-run-passed');
  assert.equal(contract.executeGatePassed, true);
  assert.ok(contract.outcomeId);
  assert.ok(contract.outcomeRecord);
  assert.equal(contract.outcomeRecord.proofCompileStatus, 'dry-run-passed');
  assert.equal(contract.outcomeRecord.outcomeClass, 'terminal');
});

test('buildExecuteTaskContract blocks execute admission when planner thresholds are too high', () => {
  const contract = buildExecuteTaskContract(makeTask({ priorityScore: 5 }), {
    missionPolicy: {
      mode: 'execute',
      plannerMinimumCreditedScore: 95,
      plannerMinimumNetScore: 95,
      executeGateMode: 'credited-and-net',
    },
    missionId: 'mission-alpha',
    assignee: 'nora',
  });

  assert.equal(contract.hasContract, true);
  assert.equal(contract.proofCompileStatus, 'dry-run-passed');
  assert.equal(contract.executeGatePassed, false);
  assert.ok(Number(contract.expectedCreditedScore) < 95);
});

test('buildOutcomeEvaluation confirms immediate outcomes and advances observing outcomes after expiry', () => {
  const immediateTask = makeTask({
    proofPacket: {
      policyRefs: {
        missionPolicyId: 'mission-policy-execute-v2',
        domainPolicyId: 'domain-policy-revenue-v1',
        scoreCalibrationPackId: 'score-pack-revenue-terminal-v1',
      },
      sourceQueries: [{ id: 'source-1', sourceType: 'shell', query: 'npm run build' }],
      metricRefs: [{ id: 'metric-1', sourceQueryId: 'source-1', aggregation: 'exists' }],
      successCriteria: [{ id: 'success-1', metricRefId: 'metric-1', comparator: 'exists', threshold: true }],
      businessEffectCriteria: [],
      evidenceRequirements: [{ id: 'evidence-1', sourceQueryId: 'source-1', minimumRecords: 1 }],
      primaryMetricRefId: 'metric-1',
      observationWindow: 'immediate',
    },
    proofCompileStatus: 'dry-run-passed',
    outcomeClass: 'terminal',
    outcomeDomain: 'revenue',
  });

  const confirmed = buildOutcomeEvaluation(
    immediateTask,
    {
      outcomeClass: 'terminal',
      outcomeDomain: 'revenue',
      proofPacket: immediateTask.proofPacket,
      attributionActual: 'directly-caused',
    },
    {
      missionPolicy: { allowNegativeNetScore: true },
      passed: true,
      checks: [{ label: 'Mission runtime loads', commandOrPath: 'npm run build', passed: true, output: 'ok' }],
      checkedAt: new Date('2026-04-04T12:00:00.000Z'),
    }
  );

  assert.equal(confirmed.status, 'confirmed');
  assert.ok(confirmed.outcomeConfirmedAt instanceof Date);

  const observingTask = makeTask({
    proofPacket: {
      ...immediateTask.proofPacket,
      observationWindow: '72h',
      observationWindowDays: 3,
    },
    proofCompileStatus: 'dry-run-passed',
    outcomeClass: 'terminal',
    outcomeDomain: 'pipeline',
  });

  const observing = buildOutcomeEvaluation(
    observingTask,
    {
      outcomeClass: 'terminal',
      outcomeDomain: 'pipeline',
      proofPacket: observingTask.proofPacket,
      attributionActual: 'directly-caused',
    },
    {
      missionPolicy: { allowNegativeNetScore: true },
      passed: true,
      checks: [{ label: 'Calendar event exists', commandOrPath: 'calendar/partner-meeting', passed: true, output: 'accepted' }],
      checkedAt: new Date('2026-04-04T12:00:00.000Z'),
    }
  );

  assert.equal(observing.status, 'observing');
  assert.ok(observing.expiresAt instanceof Date);

  const advanced = advanceOutcomeObservation({
    status: observing.status,
    expiresAt: observing.expiresAt,
  }, new Date('2026-04-08T12:00:00.000Z').getTime());

  assert.equal(advanced.status, 'confirmed');
  assert.ok(advanced.confirmedAt instanceof Date);
});

test('summarizeMissionOutcomes rolls up counts and credited/net/debt scores by class', () => {
  const summary = summarizeMissionOutcomes([
    {
      status: 'confirmed',
      outcomeClass: 'terminal',
      score: { creditedOutcomeScore: 42, netOutcomeScore: 42, businessDebtScore: 0 },
    },
    {
      status: 'observing',
      outcomeClass: 'enabling',
      score: { creditedOutcomeScore: 18, netOutcomeScore: 18, businessDebtScore: 0 },
    },
    {
      status: 'failed',
      outcomeClass: 'constraint',
      guardrailStatus: 'failed',
      score: { creditedOutcomeScore: 0, netOutcomeScore: -7, businessDebtScore: 7 },
    },
  ]);

  assert.equal(summary.plannedOutcomeCount, 3);
  assert.equal(summary.confirmedOutcomeCount, 1);
  assert.equal(summary.observingOutcomeCount, 1);
  assert.equal(summary.guardrailFailureCount, 1);
  assert.equal(summary.terminalOutcomeScore, 42);
  assert.equal(summary.enablingOutcomeScore, 18);
  assert.equal(summary.constraintOutcomeScore, 0);
  assert.equal(summary.creditedOutcomeScore, 60);
  assert.equal(summary.netOutcomeScore, 53);
  assert.equal(summary.businessDebtScore, 7);
});
