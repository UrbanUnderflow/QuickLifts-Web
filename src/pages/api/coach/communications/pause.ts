import type { NextApiRequest, NextApiResponse } from 'next';
import { authorizeDashboardRequest } from '../../../../lib/coach-dashboard/auth';
import { DashboardAccessError, validTeamId } from '../../../../lib/coach-dashboard/access';
import { pauseContact } from '../../../../lib/coach-communications/consent';
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control','private, no-store');
  if (req.method !== 'POST') return res.status(405).end();
  if (!validTeamId(req.body?.teamId) || !validTeamId(req.body?.athleteId)) return res.status(400).json({ error:'Choose an athlete.' });
  let identity; try { identity = await authorizeDashboardRequest(req); } catch { return res.status(401).end(); }
  try { return res.json(await pauseContact(identity.db, identity.uid, req.body.teamId, req.body.athleteId)); }
  catch(e) { return res.status(e instanceof DashboardAccessError ? e.status : 503).json({ error: e instanceof DashboardAccessError ? e.message : 'Could not pause texts.' }); }
}
