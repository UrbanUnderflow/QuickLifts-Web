import type { NextApiRequest, NextApiResponse } from 'next';
import { authorizeDashboardRequest } from '../../../lib/coach-dashboard/auth';
import { DashboardAccessError, validTeamId } from '../../../lib/coach-dashboard/access';
import { listPendingAthletes, stagePendingAthlete } from '../../../lib/pending-athletes/service';
export const config={api:{bodyParser:{sizeLimit:'4kb'}}};
export default async function handler(req:NextApiRequest,res:NextApiResponse){
 res.setHeader('Cache-Control','private, no-store');
 if(!['GET','POST'].includes(req.method||'')){res.setHeader('Allow','GET, POST');return res.status(405).end();}
 if(!validTeamId(req.query.teamId))return res.status(400).json({error:'Choose a valid team.'});
 let identity;try{identity=await authorizeDashboardRequest(req);}catch{return res.status(401).json({error:'Sign in to view pending athletes.'});}
 try{return res.status(req.method==='POST'?201:200).json(req.method==='POST'?await stagePendingAthlete(identity.db,identity.uid,req.query.teamId,req.body):await listPendingAthletes(identity.db,identity.uid,req.query.teamId));}
 catch(e){return res.status(e instanceof DashboardAccessError?e.status:503).json({error:e instanceof DashboardAccessError?e.message:'Pending athletes are unavailable.'});}
}
