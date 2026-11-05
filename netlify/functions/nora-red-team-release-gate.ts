import { NoraScenarioLibrary } from '../../src/lib/nora-red-team/library';
import { catalogFingerprint } from '../../src/lib/nora-red-team/catalogIdentity';
import { buildNoraRedTeamSuiteScenarios } from '../../src/lib/nora-red-team/suiteRunner';
import type {
  NoraRedTeamSuiteRecord,
  NoraRedTeamHistoryRecord,
  NoraRedTeamTarget,
} from '../../src/lib/nora-red-team/types';
import { createHash, timingSafeEqual } from 'node:crypto';
import { getFirebaseAdminApp } from '../../src/lib/firebase-admin';
import { NoraRedTeamHistoryStore } from '../../src/lib/nora-red-team/historyStore';
import { evaluateNoraRedTeamReleaseGate } from '../../src/lib/nora-red-team/releaseGate';
import { validateNoraRedTeamSuiteEvidence } from '../../src/lib/nora-red-team/releaseEvidence';

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
  const expected = {
    build: candidate,
    catalogFingerprint: catalogFingerprint(scenarios.map((s) => s.scenario)),
    targetModel: process.env.NORA_RED_TEAM_TARGET_MODEL || 'gpt-4o-mini',
    agentModel: process.env.NORA_RED_TEAM_AGENT_MODEL || 'gpt-4o',
  };
  // Read the evidence by candidate and target; never substitute the newest unrelated build.
  async function evidence(
    db: typeof firestore,
    target: NoraRedTeamTarget,
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
    if (!suite) return null;
    if (
      !Array.isArray(suite.runIds) ||
      !suite.runIds.length ||
      !Array.isArray(suite.scenarioIds) ||
      suite.runIds.length !== suite.scenarioIds.length ||
      new Set(suite.runIds).size !== suite.runIds.length ||
      suite.runIds.some((id) => typeof id !== 'string' || !id || id.includes('/'))
    ) return validateNoraRedTeamSuiteEvidence({ suite, target, expected, scenarios, records: [] });
    const rows = await Promise.all(
      suite.runIds.map((id) =>
        db.collection('nora-red-team-run-history').doc(id).get(),
      ),
    );
    return validateNoraRedTeamSuiteEvidence({
      suite, target, expected, scenarios,
      records: rows.map((row, index) => ({
        id: suite.runIds![index],
        record: row.data() as NoraRedTeamHistoryRecord | undefined,
      })),
    });
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
    expected,
    pendingHumanReviews:
      (latestSuite?.review || 0) + (stagingSuite?.review || 0),
    deviceEvidenceComplete,
  });
  return jsonResponse(200, gate);
}
