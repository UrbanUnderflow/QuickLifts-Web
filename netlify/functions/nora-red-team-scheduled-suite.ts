import { NoraScenarioLibrary } from '../../src/lib/nora-red-team/library';
import { catalogFingerprint } from '../../src/lib/nora-red-team/catalogIdentity';
import { randomBytes } from 'node:crypto';
import type { Handler } from '@netlify/functions';
import { getFirebaseAdminApp } from '../../src/lib/firebase-admin';
import { NoraRedTeamHistoryStore } from '../../src/lib/nora-red-team/historyStore';
import { hashNoraRedTeamWorkerToken } from '../../src/lib/nora-red-team/jobRunner';
import {
  buildNoraRedTeamSuiteScenarios,
  createNoraRedTeamScheduledSuiteId,
  createNoraRedTeamSuiteRecord,
  resolveNoraRedTeamScheduledBuild,
} from '../../src/lib/nora-red-team/suiteRunner';
import { NoraRedTeamSuiteStore } from '../../src/lib/nora-red-team/suiteStore';

function deploymentOrigin(): string {
  return (process.env.URL || process.env.NEXT_PUBLIC_SITE_URL || 'https://fitwithpulse.ai').replace(/\/+$/, '');
}

export const handler: Handler = async () => {
  const app = getFirebaseAdminApp(true);
  const firestore = app.firestore();
  // Keep the approved catalog in its existing workspace; execute fixtures in development.
  const catalogFirestore = getFirebaseAdminApp(false).firestore();
  const historyStore = new NoraRedTeamHistoryStore(catalogFirestore);
  const suiteStore = new NoraRedTeamSuiteStore(firestore);
  const regressions = await historyStore.listEnabledRegressions();
  const scenarios = buildNoraRedTeamSuiteScenarios(regressions, await new NoraScenarioLibrary(catalogFirestore).approved());
  const now = new Date();
  const build = resolveNoraRedTeamScheduledBuild({
    commitRef: process.env.COMMIT_REF,
    deployId: process.env.DEPLOY_ID,
    publicCommitSha: process.env.NEXT_PUBLIC_COMMIT_SHA,
  }, now);
  const suiteId = createNoraRedTeamScheduledSuiteId(now, build);
  const workerToken = randomBytes(32).toString('hex');
  const created = await suiteStore.createIfMissing({ ...createNoraRedTeamSuiteRecord({
    suiteId,
    scenarioIds: scenarios.map(({ key }) => key),
    workerTokenHash: hashNoraRedTeamWorkerToken(workerToken),
    build,
    scheduled: true,
    now,
  }), scenarios, firebaseMode:'dev', target:'staging_chat', catalogFingerprint:catalogFingerprint(scenarios.map(s=>s.scenario)), targetModel:process.env.NORA_RED_TEAM_TARGET_MODEL || 'gpt-4o-mini', agentModel:process.env.NORA_RED_TEAM_AGENT_MODEL || 'gpt-4o' });

  if (!created) {
    console.info('[nora-red-team] Scheduled suite already exists for this date.', { suiteId });
    return { statusCode: 200, body: JSON.stringify({ ok: true, suiteId, duplicate: true }) };
  }

  const response = await fetch(
    `${deploymentOrigin()}/.netlify/functions/nora-red-team-scheduled-suite-background`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-pulsecheck-firebase-mode': 'dev',
        'x-pulsecheck-internal-worker': workerToken,
      },
      body: JSON.stringify({ suiteId }),
    },
  );
  if (!response.ok && response.status !== 202) {
    await suiteStore.update(suiteId, {
      status: 'failed',
      completedAt: new Date().toISOString(),
      workerTokenHash: '',
      error: `The suite background worker returned HTTP ${response.status}.`,
    });
    throw new Error(`Nora Red Team background dispatch returned HTTP ${response.status}.`);
  }

  console.info('[nora-red-team] Scheduled suite queued.', {
    suiteId,
    scenarioCount: scenarios.length,
  });
  return { statusCode: 202, body: JSON.stringify({ ok: true, suiteId }) };
};
