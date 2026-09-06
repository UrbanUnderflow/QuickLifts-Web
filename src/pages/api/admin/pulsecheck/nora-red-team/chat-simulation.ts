import { localModelAuthorization } from '../../../../../lib/nora-red-team/localModelAuthorization';
import { localTestingApp, LOCAL_TESTER_UID, requireLocalTester } from '../../../../../lib/nora-red-team/localTesting';
import type { NextApiRequest, NextApiResponse } from 'next';
import { requireNoraTestingRequest } from '../../../../../lib/nora-red-team/access';
import { createNoraRedTeamBridgeClient } from '../../../../../lib/nora-red-team/modelClient';
import { runChatSimulation, reviewChatSimulation, validateSimulationMessages } from '../../../../../lib/nora-red-team/chatSimulation';
export const config = { api: { bodyParser: { sizeLimit: '160kb' } } };
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST.' });
  try {
    const localTester = await requireLocalTester(req);
    if (!localTester && !(await requireNoraTestingRequest(req))) return res.status(403).json({ error: 'Nora testing access is required.' });
    if (req.body?.syntheticOnly !== true || !validateSimulationMessages(req.body?.messages)) return res.status(400).json({ error: 'Use fictional examples, with up to 16 turns and 4,000 characters per message.' });
    const client = createNoraRedTeamBridgeClient({ authorization: localTester ? await localModelAuthorization() : String(req.headers.authorization || ''), bridgeOrigin: process.env.NEXT_PUBLIC_SITE_URL || 'https://fitwithpulse.ai', featureId: 'noraRedTeam', firebaseMode: localTester ? 'prod' : req.headers['x-pulsecheck-firebase-mode'] === 'dev' ? 'dev' : 'prod' });
    if (req.body.reviewOnly === true) {
      if (typeof req.body.reply !== 'string' || !req.body.reply.trim() || req.body.reply.length > 8000) return res.status(400).json({error:'A reply is required for review.'});
      return res.json(await reviewChatSimulation(client, req.body.messages, req.body.reply));
    }
    let mealContext = '';
    if (localTester) { const meals=await localTestingApp().firestore().collection(`users/${LOCAL_TESTER_UID}/mealLogs`).orderBy('createdAt','desc').limit(5).get(); mealContext=JSON.stringify(meals.docs.map(d=>({name:d.data().name,servingSize:d.data().servingSize,createdAt:d.data().createdAt}))); }
    return res.json(await runChatSimulation(client, req.body.messages, mealContext, Boolean(localTester)));
  } catch (error) { if (error instanceof Error && error.message.startsWith('APP_RUNTIME_UNAVAILABLE:')) return res.status(503).json({ error: error.message.replace('APP_RUNTIME_UNAVAILABLE: ', '') }); return res.status(500).json({ error: 'The chat could not finish. Your message is ready to retry.' }); }
}
