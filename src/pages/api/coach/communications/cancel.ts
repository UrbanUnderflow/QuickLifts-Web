import type { NextApiRequest, NextApiResponse } from 'next';
import { authorizeDashboardRequest } from '../../../../lib/coach-dashboard/auth';
import { DashboardAccessError, validTeamId } from '../../../../lib/coach-dashboard/access';
import { cancelBatch } from '../../../../lib/coach-communications/queue';
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control','private, no-store');
  if (req.method !== 'POST') return res.status(405).end();
  if (!validTeamId(req.body?.teamId) || !validTeamId(req.body?.batchId)) return res.status(400).json({ error:'Choose a group.' });
  let identity; try { identity = await authorizeDashboardRequest(req); } catch { return res.status(401).end(); }
  try { return res.json(await cancelBatch(identity.db, identity.uid, req.body.teamId, req.body.batchId)); }
  catch(e) { return res.status(e instanceof DashboardAccessError ? e.status : 503).json({ error: e instanceof DashboardAccessError ? e.message : 'Could not cancel queued texts.' }); }
}
