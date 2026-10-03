import type { NextApiRequest, NextApiResponse } from 'next';
import { authorizeDashboardRequest } from '../../../lib/coach-dashboard/auth';
import { DashboardAccessError, validTeamId } from '../../../lib/coach-dashboard/access';
import { loadDashboard } from '../../../lib/coach-dashboard/data';
export const createTeamDashboardHandler = (deps: { authorize?: typeof authorizeDashboardRequest; load?: typeof loadDashboard } = {}) => async (req: NextApiRequest, res: NextApiResponse) => {
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='GET')return res.status(405).json({error:'Method not allowed'});
  const {teamId,view='participation'}=req.query;
  if(!validTeamId(teamId)||!['participation','wellbeing'].includes(String(view)))return res.status(400).json({error:'Choose a valid team and dashboard view.'});
  let identity;try{identity=await(deps.authorize||authorizeDashboardRequest)(req);}catch{return res.status(401).json({error:'Sign in to view your team.'});}
  try{return res.status(200).json(await(deps.load||loadDashboard)(identity.db,identity.uid,teamId,view as 'participation'|'wellbeing'));}
  catch(error){return res.status(error instanceof DashboardAccessError?error.status:503).json({error:error instanceof DashboardAccessError?error.message:'Team data is temporarily unavailable. Please try again.'});}
};
export default createTeamDashboardHandler();
