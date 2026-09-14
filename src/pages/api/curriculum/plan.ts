import type { NextApiRequest, NextApiResponse } from 'next';
import { authorizeLinearAthlete } from './runtime';
import { readLinearPlan } from '../../../api/firebase/dailyCurriculum/linearPlan';
export const createLinearPlanHandler = (deps: { authorize?: typeof authorizeLinearAthlete; read?: typeof readLinearPlan } = {}) => async (req: NextApiRequest, res: NextApiResponse) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  let identity: Awaited<ReturnType<typeof authorizeLinearAthlete>>;
  try { identity = await (deps.authorize || authorizeLinearAthlete)(req); } catch { return res.status(401).json({ error: 'Sign in to view your curriculum plan.' }); }
  try { return res.status(200).json(await (deps.read || readLinearPlan)(identity.db, identity.uid)); }
  catch { return res.status(503).json({ status: 'unavailable', reason: 'The curriculum plan could not load. Your progress has not changed.' }); }
};
export default createLinearPlanHandler();
