import type { NextApiRequest,NextApiResponse } from 'next';
import { authorizeDashboardRequest } from '../../../lib/coach-dashboard/auth';
import { activeRecord,loadTeamAccess,visibleAthlete } from '../../../lib/coach-dashboard/access';
export default async function handler(req:NextApiRequest,res:NextApiResponse){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='GET')return res.status(405).json({error:'GET required.'});
 if(typeof req.query.id!=='string'||! /^[a-f0-9]{64}$/.test(req.query.id))return res.status(400).json({error:'Invalid report link.'});
 let identity;try{identity=await authorizeDashboardRequest(req);}catch{return res.status(401).json({error:'Sign in to open your report.'});}
 try{
  const {db,uid}=identity,report=(await db.collection('coach-team-insight-reports').doc('delivery').collection('reports').doc(req.query.id).get()).data();
  if(!report||report.uid!==uid)return res.status(403).json({error:'This report is available to its intended recipient.'});
  if((await db.collection('account-closure-jobs').doc(uid).get()).exists)throw new Error('Account unavailable.');
  const {access,membership,team}=await loadTeamAccess(db,uid,report.teamId);
  if(!access.participation)throw new Error('Access changed.');
  const roster=await db.collection('pulsecheck-team-memberships').where('teamId','==',report.teamId).get();
  const permitted=new Set(roster.docs.map(d=>d.data()).filter(d=>d.role==='athlete'&&d.organizationId===team.organizationId&&activeRecord(d)&&visibleAthlete(membership,d.userId)).map(d=>d.userId));
  if(!Array.isArray(report.athleteIds)||report.athleteIds.some((id:string)=>!permitted.has(id)))throw new Error('Access changed.');
  if(!report.contentHtml)return res.status(409).json({error:'This report is still being prepared.'});
  return res.status(200).json({subject:report.subject,contentHtml:report.contentHtml,teamId:report.teamId});
 }catch{return res.status(403).json({error:'Team access has changed. Open the dashboard for your current authorized view.'});}
}
