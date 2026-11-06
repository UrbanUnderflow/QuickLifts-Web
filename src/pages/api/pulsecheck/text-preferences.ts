import type { NextApiRequest, NextApiResponse } from 'next';
import { authorizeDashboardRequest } from '../../../lib/coach-dashboard/auth';
import { DashboardAccessError, validTeamId } from '../../../lib/coach-dashboard/access';
import { ownPreferences, ownTextTeams, setOwnConsent, SMS_CONSENT_VERSION, recentPhoneProof } from '../../../lib/coach-communications/consent';
export const createTextPreferencesHandler = (deps: { authorize?: typeof authorizeDashboardRequest } = {}) => async (req: NextApiRequest, res: NextApiResponse) => {
  res.setHeader('Cache-Control','private, no-store');
  if (!['GET','POST'].includes(req.method || '')) return res.status(405).end();
  const teamId = req.query.teamId;
  if (!(req.method === 'GET' && teamId === undefined) && !validTeamId(teamId)) return res.status(400).json({error:'Choose a team.'});
  let identity; try { identity = await (deps.authorize || authorizeDashboardRequest)(req); } catch { return res.status(401).json({error:'Sign in to manage your team texts.'}); }
  try {
    if (req.method === 'GET' && teamId === undefined) return res.json({ teams: await ownTextTeams(identity.db, identity.uid) });
    if (!validTeamId(teamId)) return res.status(400).json({error:'Choose a team.'});
    if (req.method === 'GET') return res.json(await ownPreferences(identity.db,identity.uid,teamId));
    if (typeof req.body?.accepted !== 'boolean' || req.body.version !== SMS_CONSENT_VERSION) return res.status(400).json({error:'Review the current texting choice.'});
    let verifiedPhone: string | undefined;
    if (req.body.accepted) {
      const { getFirebaseAdminApp } = await import('../../../lib/firebase-admin');
      const app = getFirebaseAdminApp(req.headers['x-pulsecheck-firebase-mode'] === 'dev');
      const token = await app.auth().verifyIdToken(req.headers.authorization!.slice(7),true);
      const account = await app.auth().getUser(identity.uid);
      verifiedPhone = recentPhoneProof(token, account, identity.uid);
    }
    return res.json(await setOwnConsent(identity.db,identity.uid,teamId,req.body.accepted,verifiedPhone));
  } catch(e) { return res.status(e instanceof DashboardAccessError ? e.status : 503).json({error:e instanceof DashboardAccessError ? e.message : 'Your texting choice could not be saved.'}); }
};
export default createTextPreferencesHandler();
