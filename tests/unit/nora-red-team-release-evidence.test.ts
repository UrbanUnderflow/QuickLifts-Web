import assert from 'node:assert/strict';
import test from 'node:test';
import { catalogFingerprint, scenarioFingerprint } from '../../src/lib/nora-red-team/catalogIdentity';
import { validateNoraRedTeamSuiteEvidence } from '../../src/lib/nora-red-team/releaseEvidence';
import { evaluateNoraRedTeamReleaseGate } from '../../src/lib/nora-red-team/releaseGate';
import { NORA_RED_TEAM_SCENARIOS } from '../../src/lib/nora-red-team/scenarios';
import { buildNoraRedTeamSuiteScenarios } from '../../src/lib/nora-red-team/suiteRunner';
import {
  NORA_RED_TEAM_CONTRACT_VERSION,
  NORA_RED_TEAM_VERSION,
  type NoraRedTeamHistoryRecord,
  type NoraRedTeamRun,
  type NoraRedTeamSuiteRecord,
  type NoraRedTeamTarget,
} from '../../src/lib/nora-red-team/types';

function fixture(target: NoraRedTeamTarget = 'policy_sandbox') {
  const source = NORA_RED_TEAM_SCENARIOS[0];
  const scenarios = buildNoraRedTeamSuiteScenarios([{
    scenarioId: source.id,
    sourceRunId: 'original-critical-1234567890',
    promotedAt: '2026-11-05T10:00:00Z',
    promotedBy: 'owner@example.test',
    enabled: true,
    scenario: source,
  }]);
  const expected = {
    build: 'a'.repeat(40),
    catalogFingerprint: catalogFingerprint(scenarios.map((entry) => entry.scenario)),
    targetModel: 'target',
    agentModel: 'judge',
  };
  const records = scenarios.map(({ scenario }, index) => {
    const id = `run-${index}`;
    const run = {
      runId: id,
      version: NORA_RED_TEAM_VERSION,
      contractVersion: NORA_RED_TEAM_CONTRACT_VERSION,
      scenarioId: scenario.id,
      platform: target === 'staging_chat' ? 'web-staging-chat' : 'web-admin-policy-sandbox',
      build: expected.build,
      targetModel: expected.targetModel,
      agentModel: expected.agentModel,
      scenarioFingerprint: scenarioFingerprint(scenario),
      usefulness: { verdict: 'pass', turns: [] },
      verdict: 'pass',
      humanReviewRequired: false,
    } as unknown as NoraRedTeamRun;
    const record = { runId: id, scenarioId: scenario.id, verdict: 'pass', run } as NoraRedTeamHistoryRecord;
    return { id, record };
  });
  const suite: NoraRedTeamSuiteRecord = {
    suiteId: 'synthetic-suite',
    version: NORA_RED_TEAM_VERSION,
    contractVersion: NORA_RED_TEAM_CONTRACT_VERSION,
    target,
    ...expected,
    status: 'completed',
    scheduled: false,
    createdAt: '2026-11-05T12:00:00Z',
    startedAt: '2026-11-05T12:00:00Z',
    completedAt: '2026-11-05T12:01:00Z',
    scenarioIds: scenarios.map((entry) => entry.key),
    completedScenarioIds: scenarios.map((entry) => entry.key),
    runIds: records.map((row) => row.id),
    passed: records.length,
    review: 0,
    failed: 0,
    openCriticalBlockers: 0,
    error: null,
  };
  return { suite, target, expected, scenarios, records };
}

function assertRejected(input: Parameters<typeof validateNoraRedTeamSuiteEvidence>[0]) {
  const result = validateNoraRedTeamSuiteEvidence(input);
  assert.ok(result);
  assert.ok(result.passed !== input.scenarios.length || result.failed !== 0 || result.review !== 0);
}

test('both targets accept every exact scheduled entry, including a distinct promoted regression, in any run order', () => {
  for (const target of ['policy_sandbox', 'staging_chat'] as const) {
    const input = fixture(target);
    input.records.reverse(); // Worker completion order is independent of catalog order.
    const result = validateNoraRedTeamSuiteEvidence(input)!;
    assert.equal(result.passed, input.scenarios.length);
    assert.equal(result.failed, 0);
    assert.equal(result.review, 0);
    assert.notEqual(input.scenarios[0].scenario.id, input.scenarios.at(-1)!.scenario.id);
    assert.match(input.scenarios.at(-1)!.key, /^regression:/);
  }
});

test('a partial suite cannot borrow the fingerprint of the full current catalog to pass release', () => {
  const input = fixture();
  input.suite.scenarioIds = input.suite.scenarioIds.slice(0, 1);
  input.suite.completedScenarioIds = [...input.suite.scenarioIds];
  input.suite.runIds = input.suite.runIds!.slice(0, 1);
  input.suite.passed = 1;
  input.records = input.records.slice(0, 1);
  const result = validateNoraRedTeamSuiteEvidence(input)!;
  const gate = evaluateNoraRedTeamReleaseGate({
    latestSuite: result,
    stagingSuite: validateNoraRedTeamSuiteEvidence(fixture('staging_chat')),
    expected: input.expected,
    openCriticalBlockers: 0,
    pendingHumanReviews: result.review,
    deviceEvidenceComplete: true,
    now: new Date('2026-11-05T12:02:00Z'),
  });
  assert.equal(gate.releaseReady, false);
});

test('scheduled keys must be exact, unique and complete rather than substituted or collapsed regression IDs', () => {
  for (const change of [
    (input: ReturnType<typeof fixture>) => { input.suite.scenarioIds[0] = 'catalog:unrelated'; },
    (input: ReturnType<typeof fixture>) => { input.suite.scenarioIds[0] = input.suite.scenarioIds[1]; },
    (input: ReturnType<typeof fixture>) => { input.suite.completedScenarioIds.pop(); },
    (input: ReturnType<typeof fixture>) => { input.suite.completedScenarioIds[0] = 'catalog:unrelated'; },
    (input: ReturnType<typeof fixture>) => { input.suite.scenarioIds[input.scenarios.length - 1] = input.scenarios[0].key; },
    (input: ReturnType<typeof fixture>) => { input.scenarios.push(input.scenarios[0]); },
    (input: ReturnType<typeof fixture>) => { input.scenarios[1] = { ...input.scenarios[1], scenario: input.scenarios[0].scenario }; },
  ]) {
    const input = fixture();
    change(input);
    assertRejected(input);
  }
});

test('missing, extra, duplicated and substituted linked documents fail closed', () => {
  for (const change of [
    (input: ReturnType<typeof fixture>) => { input.records.pop(); },
    (input: ReturnType<typeof fixture>) => { input.records.push(input.records[0]); },
    (input: ReturnType<typeof fixture>) => { input.records[1] = input.records[0]; },
    (input: ReturnType<typeof fixture>) => { input.records[0].id = 'unlinked-document'; },
    (input: ReturnType<typeof fixture>) => { input.suite.runIds![1] = input.suite.runIds![0]; },
    (input: ReturnType<typeof fixture>) => { input.suite.runIds = undefined; },
  ]) {
    const input = fixture();
    change(input);
    assertRejected(input);
  }
  const input = fixture();
  assertRejected({ ...input, records: input.records.map((row, index) => index ? row : { id: row.id, record: undefined }) });
});

test('document, history and embedded run identities must agree on each distinct current scenario', () => {
  for (const change of [
    (input: ReturnType<typeof fixture>) => { input.records[0].record.runId = 'borrowed-run'; },
    (input: ReturnType<typeof fixture>) => { input.records[0].record.run.runId = 'borrowed-run'; },
    (input: ReturnType<typeof fixture>) => { input.records[0].record.run.scenarioId = 'unrelated'; },
    (input: ReturnType<typeof fixture>) => { input.records[0].record.scenarioId = 'unrelated'; },
    (input: ReturnType<typeof fixture>) => {
      const last = input.records.at(-1)!.record;
      last.scenarioId = input.records[0].record.scenarioId;
      last.run = { ...input.records[0].record.run, runId: last.runId };
    },
  ]) {
    const input = fixture();
    change(input);
    assertRejected(input);
  }
});

test('current suite metadata cannot make old rules, another platform, build, model or scenario run acceptable', () => {
  const mutations: Partial<NoraRedTeamRun>[] = [
    { version: 'old' },
    { contractVersion: 'old' },
    { platform: 'web-staging-chat' },
    { build: 'b'.repeat(40) },
    { targetModel: 'different-target' },
    { agentModel: 'different-agent' },
    { scenarioFingerprint: 'different-scenario-content' },
    { usefulness: undefined },
  ];
  for (const patch of mutations) {
    const input = fixture();
    Object.assign(input.records[0].record.run, patch);
    assertRejected(input);
  }
  const staging = fixture('staging_chat');
  staging.records[0].record.run.platform = 'web-admin-policy-sandbox';
  assertRejected(staging);
});

test('suite metadata itself must belong to the exact current candidate, catalog, rules and target', () => {
  for (const patch of [
    { version: 'old' },
    { contractVersion: 'old' },
    { target: 'staging_chat' as const },
    { build: 'b'.repeat(40) },
    { catalogFingerprint: 'another-catalog' },
    { targetModel: 'different-target' },
    { agentModel: 'different-agent' },
  ]) {
    const input = fixture();
    Object.assign(input.suite, patch);
    assertRejected(input);
  }
  const input = fixture();
  input.expected.catalogFingerprint = 'claimed-catalog';
  input.suite.catalogFingerprint = 'claimed-catalog';
  assertRejected(input);
});

test('recounting preserves failed results and required human review until review is complete', () => {
  for (const [patch, counts] of [
    [{ verdict: 'fail' }, [1, 0]],
    [{ review: { state: 'needs_fix' } }, [1, 0]],
    [{ verdict: 'review' }, [0, 1]],
    [{ review: { state: 'needs_owner' } }, [0, 1]],
  ] as const) {
    const input = fixture();
    Object.assign(input.records[0].record, patch);
    if ('verdict' in patch) input.records[0].record.run.verdict = patch.verdict;
    const result = validateNoraRedTeamSuiteEvidence(input)!;
    assert.deepEqual([result.failed, result.review], counts);
  }
  const input = fixture();
  input.records[0].record.run.humanReviewRequired = true;
  assert.equal(validateNoraRedTeamSuiteEvidence(input)!.review, 1);
  input.records[0].record.review = { state: 'complete' } as NoraRedTeamHistoryRecord['review'];
  assert.equal(validateNoraRedTeamSuiteEvidence(input)!.passed, input.scenarios.length);
  input.records[0].record.verdict = 'fail';
  input.records[0].record.run.verdict = 'fail';
  assert.equal(validateNoraRedTeamSuiteEvidence(input)!.failed, 1);
});

test('divergent or invalid stored verdicts cannot be counted as a passing reviewed run', () => {
  for (const [verdict, embedded] of [
    ['pass', 'fail'],
    ['pass', 'review'],
    ['review', 'pass'],
    ['unknown', 'unknown'],
  ]) {
    const input = fixture();
    Object.assign(input.records[0].record, { verdict, review: { state: 'complete' } });
    Object.assign(input.records[0].record.run, { verdict: embedded });
    assertRejected(input);
  }
});

test('malformed scheduled arrays produce failing evidence that the release gate can safely evaluate', () => {
  const input = fixture();
  Object.assign(input.suite, { scenarioIds: undefined, completedScenarioIds: null });
  const result = validateNoraRedTeamSuiteEvidence(input)!;
  assert.deepEqual(result.scenarioIds, []);
  assert.deepEqual(result.completedScenarioIds, []);
  assert.equal(evaluateNoraRedTeamReleaseGate({
    latestSuite: result,
    stagingSuite: validateNoraRedTeamSuiteEvidence(fixture('staging_chat')),
    expected: input.expected,
    openCriticalBlockers: 0,
    pendingHumanReviews: result.review,
    deviceEvidenceComplete: true,
    now: new Date('2026-11-05T12:02:00Z'),
  }).releaseReady, false);
});

test('missing suite remains missing rather than becoming passing evidence', () => {
  assert.equal(validateNoraRedTeamSuiteEvidence({ ...fixture(), suite: null, records: [] }), null);
});
