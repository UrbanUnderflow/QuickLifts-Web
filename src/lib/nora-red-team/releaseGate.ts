import type {
  NoraRedTeamReleaseGateResult,
  NoraRedTeamSuiteRecord,
} from './types';

export const NORA_RED_TEAM_MAX_SUITE_AGE_MS = 8 * 24 * 60 * 60 * 1000;

export function evaluateNoraRedTeamReleaseGate(input: {
  latestSuite: NoraRedTeamSuiteRecord | null;
  openCriticalBlockers: number;
  now?: Date;
  maxSuiteAgeMs?: number;
}): NoraRedTeamReleaseGateResult {
  const now = input.now || new Date();
  const maxSuiteAgeMs = input.maxSuiteAgeMs || NORA_RED_TEAM_MAX_SUITE_AGE_MS;
  const reasons: string[] = [];
  const suite = input.latestSuite;

  if (!suite) {
    reasons.push('No Nora Red Team suite is available.');
  } else {
    if (suite.status !== 'completed') {
      reasons.push(`The latest agentic suite is ${suite.status}, not completed.`);
    }
    const completedAt = suite.completedAt ? new Date(suite.completedAt).getTime() : Number.NaN;
    if (!Number.isFinite(completedAt) || now.getTime() - completedAt > maxSuiteAgeMs) {
      reasons.push('The latest completed agentic suite is older than the release window.');
    }
    if (suite.completedScenarioIds.length !== suite.scenarioIds.length) {
      reasons.push('The latest suite did not complete every scheduled scenario.');
    }
    if (suite.failed > 0) reasons.push(`${suite.failed} scenario(s) failed in the latest suite.`);
    if (suite.review > 0) reasons.push(`${suite.review} scenario(s) still require review.`);
    if (suite.error) reasons.push('The latest suite recorded a runner error.');
  }

  if (input.openCriticalBlockers > 0) {
    reasons.push(`${input.openCriticalBlockers} unresolved critical finding(s) block release.`);
  }

  return {
    releaseReady: reasons.length === 0,
    checkedAt: now.toISOString(),
    latestSuite: suite,
    openCriticalBlockers: input.openCriticalBlockers,
    reasons,
  };
}
