import { catalogFingerprint, scenarioFingerprint } from './catalogIdentity';
import type { ReleaseCandidate } from './releaseGate';
import type { NoraRedTeamSuiteScenario } from './suiteRunner';
import {
  NORA_RED_TEAM_CONTRACT_VERSION,
  NORA_RED_TEAM_VERSION,
  type NoraRedTeamHistoryRecord,
  type NoraRedTeamSuiteRecord,
  type NoraRedTeamTarget,
} from './types';

/** Recount only evidence linked to this exact catalog, candidate and target. */
export function validateNoraRedTeamSuiteEvidence(input: {
  suite: NoraRedTeamSuiteRecord | null;
  target: NoraRedTeamTarget;
  expected: ReleaseCandidate;
  scenarios: readonly NoraRedTeamSuiteScenario[];
  records: readonly {
    id: string;
    record: NoraRedTeamHistoryRecord | undefined;
  }[];
}): NoraRedTeamSuiteRecord | null {
  const { suite, target, expected, scenarios, records } = input;
  if (!suite) return null;
  const invalid = (): NoraRedTeamSuiteRecord => ({
    ...suite,
    scenarioIds: Array.isArray(suite.scenarioIds) ? suite.scenarioIds : [],
    completedScenarioIds: Array.isArray(suite.completedScenarioIds) ? suite.completedScenarioIds : [],
    passed: 0,
    review: Math.max(1, Array.isArray(suite.scenarioIds) ? suite.scenarioIds.length : 0),
  });
  const keys = new Set(scenarios.map((entry) => entry.key));
  const byScenario = new Map(scenarios.map((entry) => [entry.scenario.id, entry.scenario]));
  const matchesKeys = (ids: unknown): ids is string[] =>
    Array.isArray(ids) &&
    ids.length === keys.size &&
    new Set(ids).size === ids.length &&
    ids.every((id) => keys.has(id));
  const fingerprint = catalogFingerprint(scenarios.map((entry) => entry.scenario));
  if (
    !keys.size ||
    keys.size !== scenarios.length ||
    byScenario.size !== scenarios.length ||
    !matchesKeys(suite.scenarioIds) ||
    !matchesKeys(suite.completedScenarioIds) ||
    suite.version !== NORA_RED_TEAM_VERSION ||
    suite.contractVersion !== NORA_RED_TEAM_CONTRACT_VERSION ||
    suite.target !== target ||
    suite.build !== expected.build ||
    expected.catalogFingerprint !== fingerprint ||
    suite.catalogFingerprint !== fingerprint ||
    suite.targetModel !== expected.targetModel ||
    suite.agentModel !== expected.agentModel ||
    !Array.isArray(suite.runIds) ||
    suite.runIds.length !== scenarios.length ||
    new Set(suite.runIds).size !== suite.runIds.length ||
    records.length !== suite.runIds.length ||
    new Set(records.map((row) => row.id)).size !== records.length ||
    records.some((row) => !suite.runIds!.includes(row.id))
  ) return invalid();

  let passed = 0;
  let review = 0;
  let failed = 0;
  const seen = new Set<string>();
  const platform = target === 'staging_chat' ? 'web-staging-chat' : 'web-admin-policy-sandbox';
  for (const { id, record: history } of records) {
    const run = history?.run;
    const scenario = history && byScenario.get(history.scenarioId);
    if (
      !history ||
      !run ||
      !scenario ||
      seen.has(history.scenarioId) ||
      history.runId !== id ||
      run.runId !== id ||
      run.scenarioId !== history.scenarioId ||
      !['pass', 'fail', 'review'].includes(history.verdict) ||
      history.verdict !== run.verdict ||
      run.version !== NORA_RED_TEAM_VERSION ||
      run.contractVersion !== NORA_RED_TEAM_CONTRACT_VERSION ||
      run.platform !== platform ||
      run.build !== expected.build ||
      run.targetModel !== expected.targetModel ||
      run.agentModel !== expected.agentModel ||
      run.scenarioFingerprint !== scenarioFingerprint(scenario) ||
      !run.usefulness
    ) {
      failed++;
      continue;
    }
    seen.add(history.scenarioId);
    if (history.verdict === 'fail' || history.review?.state === 'needs_fix') {
      failed++;
    } else if (
      (run.humanReviewRequired || history.verdict === 'review' || history.review?.state === 'needs_owner') &&
      history.review?.state !== 'complete'
    ) {
      review++;
    } else {
      passed++;
    }
  }
  return { ...suite, passed, review, failed };
}
