import type { NextApiRequest, NextApiResponse } from 'next';
import { authorizeDashboardRequest } from '../../../../lib/coach-dashboard/auth';
import { DashboardAccessError, validTeamId } from '../../../../lib/coach-dashboard/access';
import { loadInbox, transportReady } from '../../../../lib/coach-communications/service';
import { enqueueBatch } from '../../../../lib/coach-communications/queue';
export const config = { api: { bodyParser: { sizeLimit: '16kb' } } };
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'private, no-store');
  if (!['GET','POST'].includes(req.method || '')) { res.setHeader('Allow','GET, POST'); return res.status(405).end(); }
  const { teamId } = req.query;
  if (!validTeamId(teamId)) return res.status(400).json({ notQueued: true, error: 'Choose a valid team.' });
  let identity;
  try { identity = await authorizeDashboardRequest(req); } catch { return res.status(401).json({ notQueued: true, error: 'Sign in to communicate with your team.' }); }
  try {
    const mode = req.headers['x-pulsecheck-firebase-mode'];
    if (req.method === 'GET') return res.status(200).json(await loadInbox(identity.db, identity.uid, teamId, mode, typeof req.query.cursor === 'string' ? req.query.cursor : undefined));
    if (!transportReady(mode)) return res.status(503).json({ notQueued: true, error: 'Texting setup is pending. No messages were sent.' });
    return res.status(202).json(await enqueueBatch(identity.db, identity.uid, teamId, req.body));
  } catch (error) {
    return res.status(error instanceof DashboardAccessError ? error.status : 503).json({ notQueued: error instanceof DashboardAccessError, error: error instanceof DashboardAccessError ? error.message : 'Messaging is unavailable. Refresh the inbox to check send status before trying again.' });
  }
}
