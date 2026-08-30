import { timingSafeEqual } from 'node:crypto';
import type { Handler } from '@netlify/functions';
import { getFirebaseAdminApp } from '../../src/lib/firebase-admin';
import { NoraRedTeamHistoryStore } from '../../src/lib/nora-red-team/historyStore';
import { evaluateNoraRedTeamReleaseGate } from '../../src/lib/nora-red-team/releaseGate';
import { NoraRedTeamSuiteStore } from '../../src/lib/nora-red-team/suiteStore';

function headerValue(headers: Record<string, string | undefined>, name: string): string {
  return headers[name] || headers[name.toLowerCase()] || '';
}

function secureSecretMatch(actual: string, expected: string): boolean {
  if (!actual || !expected || actual.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
}

export const handler: Handler = async (event) => {
  if (!['GET', 'POST'].includes(event.httpMethod)) {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed.' }) };
  }
  const expected = process.env.NORA_RED_TEAM_RELEASE_GATE_TOKEN?.trim() || '';
  if (!expected) {
    return { statusCode: 503, body: JSON.stringify({ error: 'Release gate token is not configured.' }) };
  }
  const authorization = headerValue(event.headers, 'authorization');
  const actual = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
  if (!secureSecretMatch(actual, expected)) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Release gate authorization failed.' }) };
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
  return {
    statusCode: 200,
    headers: { 'Cache-Control': 'no-store', 'Content-Type': 'application/json' },
    body: JSON.stringify(gate),
  };
};
