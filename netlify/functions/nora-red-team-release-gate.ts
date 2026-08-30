import { createHash, timingSafeEqual } from 'node:crypto';
import { getFirebaseAdminApp } from '../../src/lib/firebase-admin';
import { NoraRedTeamHistoryStore } from '../../src/lib/nora-red-team/historyStore';
import { evaluateNoraRedTeamReleaseGate } from '../../src/lib/nora-red-team/releaseGate';
import { NoraRedTeamSuiteStore } from '../../src/lib/nora-red-team/suiteStore';

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
const RELEASE_GATE_TOKEN_SHA256 = '618846e51e171c0597d5279593a69059481da87ec1f8d624d3578791dad57d43';

function secureSecretMatch(actual: string, expectedHash: string): boolean {
  if (!actual || !/^[a-f0-9]{64}$/.test(expectedHash)) return false;
  const actualHash = createHash('sha256').update(actual).digest();
  const expected = Buffer.from(expectedHash, 'hex');
  return actualHash.length === expected.length && timingSafeEqual(actualHash, expected);
}

export default async function handler(request: Request): Promise<Response> {
  if (!['GET', 'POST'].includes(request.method)) {
    return jsonResponse(405, { error: 'Method not allowed.' });
  }
  const authorization = request.headers.get('authorization') || '';
  const actual = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
  if (!secureSecretMatch(actual, RELEASE_GATE_TOKEN_SHA256)) {
    return jsonResponse(401, { error: 'Release gate authorization failed.' });
  }

  const firestore = getFirebaseAdminApp(false).firestore();
  const [latestSuite, openCriticalBlockers] = await Promise.all([
    new NoraRedTeamSuiteStore(firestore).latest(),
    new NoraRedTeamHistoryStore(firestore).countOpenCriticalBlockers(),
  ]);
  const maxAgeDays = Math.max(1, Math.min(30, Number(process.env.NORA_RED_TEAM_RELEASE_MAX_AGE_DAYS) || 8));
  const gate = evaluateNoraRedTeamReleaseGate({
    latestSuite,
    openCriticalBlockers,
    maxSuiteAgeMs: maxAgeDays * 24 * 60 * 60 * 1000,
  });
  return jsonResponse(200, gate);
}
