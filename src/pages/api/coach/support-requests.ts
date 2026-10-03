import type { NextApiRequest, NextApiResponse } from 'next';
import { authorizeDashboardRequest } from '../../../lib/coach-dashboard/auth';
import { DashboardAccessError, activeRecord, loadTeamAccess, validTeamId, visibleAthlete } from '../../../lib/coach-dashboard/access';

/** Only requested coach contact is projected. Clinical records stay in the care workflow. */
export async function loadSupportRequests(db: any, uid: string, teamId: string) {
  const { membership, team, access } = await loadTeamAccess(db, uid, teamId);
  if (!access.participation) throw new DashboardAccessError(403, 'Team access is required.');
  const [roster, records] = await Promise.all([
    db.collection('pulsecheck-team-memberships').where('teamId', '==', teamId).get(),
    db.collection('escalation-records').where('coachId', '==', uid).where('status', '==', 'active').select('userId','tier','consentStatus','createdAt','teamId','supportSelectionKind','supportSelectionUserId','supportSelectionTeamId','supportRoute','excludedRecipientIds','implicatedCoachId').get(),
  ]);
  const allowed = new Set(roster.docs.map((d: any) => d.data()).filter((d: any) => d.role === 'athlete' && d.organizationId === team.organizationId && activeRecord(d) && visibleAthlete(membership, d.userId)).map((d: any) => d.userId));
  return { requests: records.docs.flatMap((doc: any) => {
    const d = doc.data();
    if (d.supportSelectionKind !== 'staff' || d.supportSelectionUserId !== uid || d.supportSelectionTeamId !== teamId || d.supportRoute !== 'selected_staff' || d.implicatedCoachId === uid || (Array.isArray(d.excludedRecipientIds) && d.excludedRecipientIds.includes(uid))) return [];
    if (d.tier !== 2 || d.consentStatus !== 'accepted' || !allowed.has(d.userId) || (d.teamId && d.teamId !== teamId)) return [];
    return [{id:doc.id,athleteId:d.userId,createdAt:typeof d.createdAt === 'number' ? d.createdAt : null}];
  }) };
}
export const createSupportRequestsHandler = (deps: {authorize?: typeof authorizeDashboardRequest; load?: typeof loadSupportRequests} = {}) => async (req: NextApiRequest,res: NextApiResponse) => {
  res.setHeader('Cache-Control','no-store');
  if(req.method !== 'GET') return res.status(405).json({error:'Method not allowed'});
  if(!validTeamId(req.query.teamId)) return res.status(400).json({error:'Choose a team.'});
  let identity; try {identity = await (deps.authorize || authorizeDashboardRequest)(req);} catch {return res.status(401).json({error:'Sign in to continue.'});}
  try {return res.status(200).json(await (deps.load || loadSupportRequests)(identity.db,identity.uid,req.query.teamId));}
  catch(error) {return res.status(error instanceof DashboardAccessError ? error.status : 503).json({error:error instanceof DashboardAccessError ? error.message : 'Could not load support requests.'});}
};
export default createSupportRequestsHandler();
