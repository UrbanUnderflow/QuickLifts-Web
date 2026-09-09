import { randomBytes } from 'node:crypto';
import type { NextApiRequest, NextApiResponse } from 'next';
import { requireNoraTestingRequest } from '../../../../../lib/nora-red-team/access';
import { getFirebaseAdminApp } from '../../../../../lib/firebase-admin';
import { NoraScenarioLibrary } from '../../../../../lib/nora-red-team/library';
import { NoraRedTeamHistoryStore } from '../../../../../lib/nora-red-team/historyStore';
import { NoraRedTeamSuiteStore } from '../../../../../lib/nora-red-team/suiteStore';
import {
  buildNoraRedTeamSuiteScenarios,
  createNoraRedTeamSuiteRecord,
  executeScheduledNoraRedTeamSuite,
} from '../../../../../lib/nora-red-team/suiteRunner';
import { catalogFingerprint } from '../../../../../lib/nora-red-team/catalogIdentity';
import { resolveNoraFirebaseApiKey } from '../../../../../lib/nora-red-team/runtimeConfig';
import { hashNoraRedTeamWorkerToken } from '../../../../../lib/nora-red-team/jobRunner';
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST')
    return res.status(405).json({ error: 'Method not allowed.' });
  const identity = await requireNoraTestingRequest(req);
  if (!identity)
    return res.status(401).json({ error: 'Admin authorization is required.' });
  const dev = req.headers['x-pulsecheck-firebase-mode'] === 'dev';
  const target = req.body?.target || 'staging_chat';
  if (
    !['policy_sandbox', 'staging_chat'].includes(target) ||
    (target === 'staging_chat' && !dev)
  )
    return res
      .status(400)
      .json({ error: 'Real staging checks require the development database.' });
  const app = getFirebaseAdminApp(dev);
  const db = app.firestore();
  const store = new NoraRedTeamSuiteStore(db);
  try {
    const latest = await store.latest();
    if (
      latest &&
      ['queued', 'running'].includes(latest.status) &&
      Date.now() - Date.parse(latest.createdAt) < 15 * 60 * 1000
    )
      return res
        .status(409)
        .json({ error: 'A daily check is already running.' });
    const scenarios = buildNoraRedTeamSuiteScenarios(
      await new NoraRedTeamHistoryStore(db).listEnabledRegressions(),
      await new NoraScenarioLibrary(db).approved(),
    );
    const build =
      process.env.COMMIT_REF || process.env.NEXT_PUBLIC_COMMIT_SHA || 'local';
    const suiteId = `nrt-suite-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${randomBytes(5).toString('hex')}`;
    const token = randomBytes(32).toString('hex');
    const targetModel = process.env.NORA_RED_TEAM_TARGET_MODEL || 'gpt-4o-mini';
    const agentModel = process.env.NORA_RED_TEAM_AGENT_MODEL || 'gpt-4o';
    await store.createIfMissing({
      ...createNoraRedTeamSuiteRecord({
        suiteId,
        scenarioIds: scenarios.map((s) => s.key),
        workerTokenHash: hashNoraRedTeamWorkerToken(token),
        build,
        scheduled: false,
      }),
      scenarios,
      target,
      firebaseMode: dev ? 'dev' : 'prod',
      catalogFingerprint: catalogFingerprint(scenarios.map((s) => s.scenario)),
      targetModel,
      agentModel,
    });
    const origin = (
      process.env.URL ||
      process.env.NEXT_PUBLIC_SITE_URL ||
      'https://fitwithpulse.ai'
    ).replace(/\/$/, '');
    if (process.env.NODE_ENV === 'development') {
      void executeScheduledNoraRedTeamSuite({
        app,
        suiteId,
        bridgeOrigin: origin,
        featureId: process.env.NORA_RED_TEAM_BRIDGE_FEATURE_ID || 'noraRedTeam',
        firebaseProjectId:
          app.options.projectId ||
          (dev ? 'quicklifts-dev-01' : 'quicklifts-dd3f1'),
        firebaseApiKey: resolveNoraFirebaseApiKey(dev),
        targetModel,
        agentModel,
        build,
      });
    } else {
      const response = await fetch(
        `${origin}/.netlify/functions/nora-red-team-scheduled-suite-background`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-pulsecheck-internal-worker': token,
            'x-pulsecheck-firebase-mode': dev ? 'dev' : 'prod',
          },
          body: JSON.stringify({ suiteId }),
        },
      );
      if (!response.ok) {
        await store.update(suiteId, {
          status: 'failed',
          completedAt: new Date().toISOString(),
          error: 'The daily check worker could not start.',
          workerTokenHash: '',
        });
        throw new Error('The daily check worker could not start.');
      }
    }
    return res.status(202).json({ suiteId });
  } catch (error) {
    return res.status(409).json({
      error:
        error instanceof Error
          ? error.message
          : 'The daily check could not start.',
    });
  }
}
