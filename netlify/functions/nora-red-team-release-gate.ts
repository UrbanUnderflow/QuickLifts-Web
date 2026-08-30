import { timingSafeEqual } from 'node:crypto';
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

function secureSecretMatch(actual: string, expected: string): boolean {
  if (!actual || !expected || actual.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
}

export default async function handler(request: Request): Promise<Response> {
  if (!['GET', 'POST'].includes(request.method)) {
    return jsonResponse(405, { error: 'Method not allowed.' });
  }
  const expected = process.env.NORA_RED_TEAM_RELEASE_GATE_TOKEN?.trim() || '';
  if (!expected) {
    return jsonResponse(503, { error: 'Release gate token is not configured.' });
  }
  const authorization = request.headers.get('authorization') || '';
  const actual = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
  if (!secureSecretMatch(actual, expected)) {
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
