import { timingSafeEqual } from 'node:crypto';
import type { Config } from '@netlify/functions';
import { getFirebaseAdminApp } from '../../src/lib/firebase-admin';
import {
  hashNoraRedTeamWorkerToken,
} from '../../src/lib/nora-red-team/jobRunner';
import { executeScheduledNoraRedTeamSuite } from '../../src/lib/nora-red-team/suiteRunner';
import { NoraRedTeamSuiteStore } from '../../src/lib/nora-red-team/suiteStore';

function secureHashMatch(left: string, right: string): boolean {
  if (!left || !right || left.length !== right.length) return false;
  return timingSafeEqual(Buffer.from(left), Buffer.from(right));
}

function bridgeOrigin(): string {
  return (process.env.OPENAI_BRIDGE_FALLBACK_ORIGIN
    || process.env.URL
    || process.env.NEXT_PUBLIC_SITE_URL
    || 'https://fitwithpulse.ai').replace(/\/+$/, '');
}

export default async function handler(request: Request): Promise<void> {
  if (request.method !== 'POST') {
    throw new Error('Method not allowed.');
  }
  const workerToken = request.headers.get('x-pulsecheck-internal-worker') || '';
  const body = await request.json().catch(() => ({})) as { suiteId?: string };
  const suiteId = String(body.suiteId || '');
  if (!/^nrt-suite-\d{8}(?:-[a-z0-9]{1,12})?$/.test(suiteId) || !workerToken) {
    throw new Error('Invalid suite worker request.');
  }

  const app = getFirebaseAdminApp(false);
  const suiteStore = new NoraRedTeamSuiteStore(app.firestore());
  const suite = await suiteStore.get(suiteId);
  if (!suite || !secureHashMatch(suite.workerTokenHash, hashNoraRedTeamWorkerToken(workerToken))) {
    throw new Error('Suite worker authorization failed.');
  }

  await executeScheduledNoraRedTeamSuite({
    app,
    suiteId,
    bridgeOrigin: bridgeOrigin(),
    featureId: process.env.NORA_RED_TEAM_BRIDGE_FEATURE_ID?.trim() || 'noraRedTeam',
    firebaseProjectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim() || 'quicklifts-dd3f1',
    firebaseApiKey:
      process.env.FIREBASE_WEB_API_KEY?.trim() ||
      process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.trim() ||
      '',
    targetModel: process.env.NORA_RED_TEAM_TARGET_MODEL?.trim() || 'gpt-4o-mini',
    agentModel: process.env.NORA_RED_TEAM_AGENT_MODEL?.trim() || 'gpt-4o-mini',
    build: process.env.COMMIT_REF?.trim()
      || process.env.DEPLOY_ID?.trim()
      || process.env.NEXT_PUBLIC_COMMIT_SHA?.trim()
      || 'scheduled',
  });
}

export const config: Config = {
  background: true,
};
