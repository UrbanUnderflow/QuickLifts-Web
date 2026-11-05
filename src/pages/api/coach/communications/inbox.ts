import type { NextApiRequest, NextApiResponse } from 'next';
import { authorizeDashboardRequest } from '../../../../lib/coach-dashboard/auth';
import { DashboardAccessError, validTeamId } from '../../../../lib/coach-dashboard/access';
import { loadUnifiedInbox, markUnifiedRead, retryUnifiedText, sendUnifiedMessage } from '../../../../lib/coach-communications/unified';
export const config = { api: { bodyParser: { sizeLimit: '16kb' } } };
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'private, no-store');
  if (!['GET', 'POST'].includes(req.method || '')) { res.setHeader('Allow', 'GET, POST'); return res.status(405).end(); }
  const teamId = req.method === 'GET' ? req.query.teamId : req.body?.teamId;
  if (!validTeamId(teamId)) return res.status(400).json({ notSaved: true, error: 'Choose a valid team.' });
  let identity;
  try { identity = await authorizeDashboardRequest(req); }
  catch { return res.status(401).json({ notSaved: true, error: 'Sign in to open Messages.' }); }
  try {
    const mode = req.headers['x-pulsecheck-firebase-mode'];
    if (req.method === 'GET') {
      const athleteId = req.query.athleteId;
      if (athleteId !== undefined && !validTeamId(athleteId)) throw new DashboardAccessError(400, 'Choose an athlete.');
      return res.json(await loadUnifiedInbox(identity.db, identity.uid, teamId, mode, athleteId as string | undefined, typeof req.query.cursor === 'string' ? req.query.cursor : undefined));
    }
    if (req.body.action === 'read') {
      if (!validTeamId(req.body.athleteId)) throw new DashboardAccessError(400, 'Choose an athlete.');
      return res.json(await markUnifiedRead(identity.db, identity.uid, teamId, req.body.athleteId));
    }
    if (req.body.action === 'retry') {
      if (req.body.channel !== 'sms') throw new DashboardAccessError(400, 'Only a failed Text delivery can be retried.');
      return res.status(202).json(await retryUnifiedText(identity.db, identity.uid, teamId, req.body.athleteId, req.body.messageId, mode));
    }
    if (req.body.action !== 'send') throw new DashboardAccessError(400, 'Choose a messaging action.');
    return res.status(202).json(await sendUnifiedMessage(identity.db, identity.uid, teamId, req.body, mode));
  } catch (error) {
    return res.status(error instanceof DashboardAccessError ? error.status : 503).json({ notSaved: error instanceof DashboardAccessError, error: error instanceof DashboardAccessError ? error.message : 'Messages are unavailable. Refresh to check delivery before trying again.' });
  }
}
