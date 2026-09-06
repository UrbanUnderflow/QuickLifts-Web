import { NoraScenarioLibrary } from '../../src/lib/nora-red-team/library';
import {
  catalogFingerprint,
  scenarioFingerprint,
} from '../../src/lib/nora-red-team/catalogIdentity';
import { buildNoraRedTeamSuiteScenarios } from '../../src/lib/nora-red-team/suiteRunner';
import type {
  NoraRedTeamSuiteRecord,
  NoraRedTeamHistoryRecord,
} from '../../src/lib/nora-red-team/types';
import { createHash, timingSafeEqual } from 'node:crypto';
import { getFirebaseAdminApp } from '../../src/lib/firebase-admin';
import { NoraRedTeamHistoryStore } from '../../src/lib/nora-red-team/historyStore';
import { evaluateNoraRedTeamReleaseGate } from '../../src/lib/nora-red-team/releaseGate';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'Content-Type': 'application/json',
    },
  });
}

// Only the one-way digest is deployed. The raw gate token stays in GitHub and local credential storage.
const RELEASE_GATE_TOKEN_SHA256 =
  '618846e51e171c0597d5279593a69059481da87ec1f8d624d3578791dad57d43';

function secureSecretMatch(actual: string, expectedHash: string): boolean {
  if (!actual || !/^[a-f0-9]{64}$/.test(expectedHash)) return false;
  const actualHash = createHash('sha256').update(actual).digest();
  const expected = Buffer.from(expectedHash, 'hex');
  return (
    actualHash.length === expected.length &&
    timingSafeEqual(actualHash, expected)
  );
}

export default async function handler(request: Request): Promise<Response> {
  if (!['GET', 'POST'].includes(request.method)) {
    return jsonResponse(405, { error: 'Method not allowed.' });
  }
  const authorization = request.headers.get('authorization') || '';
  const actual = authorization.startsWith('Bearer ')
    ? authorization.slice(7).trim()
    : '';
  if (!secureSecretMatch(actual, RELEASE_GATE_TOKEN_SHA256)) {
    return jsonResponse(401, { error: 'Release gate authorization failed.' });
  }

  const firestore = getFirebaseAdminApp(false).firestore();
  const devStore = getFirebaseAdminApp(true).firestore();
  const candidate = new URL(request.url).searchParams.get('build') || '';
  if (!/^[a-f0-9]{40}$/i.test(candidate))
    return jsonResponse(400, { error: 'An exact release commit is required.' });
  const historyStore = new NoraRedTeamHistoryStore(firestore);
  const scenarios = buildNoraRedTeamSuiteScenarios(
    await historyStore.listEnabledRegressions(),
    await new NoraScenarioLibrary(firestore).approved(),
  );
  // Read the evidence by candidate and target; never substitute the newest unrelated build.
  async function evidence(
    db: typeof firestore,
    target: string,
  ): Promise<NoraRedTeamSuiteRecord | null> {
    const snapshots = await db
      .collection('nora-red-team-suite-history')
      .where('build', '==', candidate)
      .limit(100)
      .get();
    const suite = snapshots.docs
      .map((d) => d.data() as NoraRedTeamSuiteRecord)
      .filter((s) => s.target === target)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
    if (
      !suite ||
      !suite.runIds?.length ||
      suite.runIds.length !== suite.scenarioIds.length ||
      new Set(suite.runIds).size !== suite.runIds.length
    )
      return suite
        ? { ...suite, review: suite.scenarioIds.length || 1, passed: 0 }
        : null;
    const rows = await Promise.all(
      suite.runIds.map((id) =>
        db.collection('nora-red-team-run-history').doc(id).get(),
      ),
    );
    let passed = 0;
    let review = 0;
    let failed = 0;
    const seen = new Set<string>();
    for (const row of rows) {
      const h = row.data() as NoraRedTeamHistoryRecord | undefined;
      if (
        !h ||
        seen.has(h.scenarioId) ||
        h.run.build !== candidate ||
        h.run.targetModel !==
          (process.env.NORA_RED_TEAM_TARGET_MODEL || 'gpt-4o-mini') ||
        h.run.agentModel !==
          (process.env.NORA_RED_TEAM_AGENT_MODEL || 'gpt-4o') ||
        h.run.scenarioFingerprint !==
          scenarioFingerprint(
            scenarios.find((s) => s.scenario.id === h.scenarioId)?.scenario ||
              ({} as never),
          ) ||
        !h.run.usefulness
      ) {
        failed++;
        continue;
      }
      seen.add(h.scenarioId);
      if (h.verdict === 'fail' || h.review?.state === 'needs_fix') {
        failed++;
        continue;
      }
      if (
        (h.run.humanReviewRequired || h.verdict === 'review' || h.review?.state === 'needs_owner') &&
        h.review?.state !== 'complete'
      ) {
        review++;
        continue;
      }
      passed++;
    }
    return { ...suite, passed, review, failed };
  }
  const [
    latestSuite,
    stagingSuite,
    productionBlockers,
    developmentBlockers,
    deviceRows,
  ] = await Promise.all([
    evidence(firestore, 'policy_sandbox'),
    evidence(devStore, 'staging_chat'),
    historyStore.countOpenCriticalBlockers(),
    new NoraRedTeamHistoryStore(devStore).countOpenCriticalBlockers(),
    firestore
      .collection('nora-red-team-device-evidence')
      .where('build', '==', candidate)
      .get(),
  ]);
  const devices = deviceRows.docs
    .map((d) => d.data())
    .sort((a, b) => b.reviewedAt.localeCompare(a.reviewedAt));
  const deviceEvidenceComplete = ['ios', 'android'].every(
    (platform) =>
      devices.find((d) => d.platform === platform)?.passed === true &&
      Date.now() -
        Date.parse(devices.find((d) => d.platform === platform)?.reviewedAt) <
        2 * 86400000,
  );
  const gate = evaluateNoraRedTeamReleaseGate({
    latestSuite,
    stagingSuite,
    openCriticalBlockers: productionBlockers + developmentBlockers,
    expected: {
      build: candidate,
      catalogFingerprint: catalogFingerprint(scenarios.map((s) => s.scenario)),
      targetModel: process.env.NORA_RED_TEAM_TARGET_MODEL || 'gpt-4o-mini',
      agentModel: process.env.NORA_RED_TEAM_AGENT_MODEL || 'gpt-4o',
    },
    pendingHumanReviews:
      (latestSuite?.review || 0) + (stagingSuite?.review || 0),
    deviceEvidenceComplete,
  });
  return jsonResponse(200, gate);
}
