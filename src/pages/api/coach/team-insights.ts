import type { NextApiRequest,NextApiResponse } from 'next';
import { authorizeDashboardRequest } from '../../../lib/coach-dashboard/auth';
import { DashboardAccessError,validTeamId } from '../../../lib/coach-dashboard/access';
import { loadDashboard } from '../../../lib/coach-dashboard/data';
import { analyze } from '../../../lib/coach-dashboard/insightAnalysis';
import { generateWeeklyInsight } from '../../../lib/coach-dashboard/insightService';
import { listInsightReportHistory } from '../../../lib/coach-dashboard/insightHistory';
export { analyze } from '../../../lib/coach-dashboard/insightAnalysis';
export const createTeamInsightsHandler=(deps:{authorize?:typeof authorizeDashboardRequest;load?:typeof loadDashboard;analyze?:typeof analyze}={})=>async(req:NextApiRequest,res:NextApiResponse)=>{
 res.setHeader('Cache-Control','no-store');
 if(!['GET','POST'].includes(req.method||''))return res.status(405).json({error:'Method not allowed'});
 const {teamId,role,to}=req.method==='GET'?req.query:req.body||{};
 if(!validTeamId(teamId)||!['coach','trainer'].includes(role)||to!==undefined&&typeof to!=='string')return res.status(400).json({error:'Choose a team and report.'});
 let identity;try{identity=await(deps.authorize||authorizeDashboardRequest)(req);}catch{return res.status(401).json({error:'Sign in to view reports.'});}
 try{
  if(req.method==='GET')return res.status(200).json({history:await listInsightReportHistory(identity.db,identity.uid,teamId,role)});
  return res.status(200).json(await generateWeeklyInsight(identity.db,identity.uid,teamId,role,to,{...deps,persist:!deps.load}));
 }catch(error){return res.status(error instanceof DashboardAccessError?error.status:503).json({error:error instanceof DashboardAccessError?error.message:'Reports are temporarily unavailable. Please try again.'});}
};
export default createTeamInsightsHandler();
