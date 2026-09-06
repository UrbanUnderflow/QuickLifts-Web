import type { NextApiRequest, NextApiResponse } from 'next';
import { requireNoraTestingRequest } from '../../../../../lib/nora-red-team/access';
import { getFirebaseAdminApp } from '../../../../../lib/firebase-admin';
import {
  NoraScenarioLibrary,
  generateScenarioDraft,
  draftScenario,
} from '../../../../../lib/nora-red-team/library';
import { NORA_RED_TEAM_SCENARIOS } from '../../../../../lib/nora-red-team/scenarios';
import { createNoraRedTeamBridgeClient } from '../../../../../lib/nora-red-team/modelClient';
export const config = { api: { bodyParser: { sizeLimit: '16kb' } } };
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  res.setHeader('Cache-Control', 'no-store');
  if (!['GET', 'POST', 'PATCH'].includes(req.method || ''))
    return res.status(405).json({ error: 'Method not allowed.' });
  const identity = await requireNoraTestingRequest(req);
  if (!identity)
    return res.status(401).json({ error: 'Admin authorization is required.' });
  const email = identity.email.toLowerCase();
  const dev = req.headers['x-pulsecheck-firebase-mode'] === 'dev';
  const db = getFirebaseAdminApp(dev).firestore();
  const library = new NoraScenarioLibrary(db, getFirebaseAdminApp(false).firestore());
  try {
    if (req.method === 'GET')
      return res.json({
        drafts: await library.list(),
        ownerEmail: await library.owner(),
      });
    if (req.method === 'POST') {
      const description = String(req.body.description || '').trim();
      if (description.length < 12 || description.length > 2000)
        return res
          .status(400)
          .json({ error: 'Describe the situation in 12 to 2,000 characters.' });
      const client = createNoraRedTeamBridgeClient({
        authorization: String(req.headers.authorization),
        bridgeOrigin:
          process.env.OPENAI_BRIDGE_FALLBACK_ORIGIN ||
          process.env.NEXT_PUBLIC_SITE_URL ||
          'https://fitwithpulse.ai',
        featureId: process.env.NORA_RED_TEAM_BRIDGE_FEATURE_ID || 'noraRedTeam',
        firebaseMode: dev ? 'dev' : 'prod',
      });
      const draft = await generateScenarioDraft(
        client,
        process.env.NORA_RED_TEAM_AGENT_MODEL || 'gpt-4o',
        description,
        email,
      );
      await library.saveDraft(draft);
      return res.status(201).json({ draft });
    }
    const id = String(req.body.id || '');
    if (!/^custom-[a-f0-9-]{36}$/.test(id))
      return res.status(400).json({ error: 'Choose a saved draft.' });
    if (req.body.action === 'approve')
      return res.json({
        draft: await library.update(id, req.body.revision, email, {}, true),
      });
    const current = await library.get(id);
    if (!current)
      return res.status(404).json({ error: 'Draft was not found.' });
    const base = NORA_RED_TEAM_SCENARIOS.find(
      (s) => s.id === current.baseScenarioId,
    )!;
    const scenario = draftScenario(base, req.body.scenario, id);
    return res.json({
      draft: await library.update(id, req.body.revision, email, {
        scenario,
        resolution: String(req.body.resolution || '').slice(0, 2000),
      }),
    });
  } catch (error) {
    return res.status(409).json({
      error:
        error instanceof Error
          ? error.message
          : 'The scenario could not be saved.',
    });
  }
}
