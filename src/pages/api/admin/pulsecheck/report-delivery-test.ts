import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAdminRequest } from '../_auth';
import { getFirebaseAdminApp } from '../../../../lib/firebase-admin';
import { validTeamId } from '../../../../lib/coach-dashboard/access';
import { runReportDeliveries } from '../../../../lib/coach-dashboard/reportDeliveryRunner';
import { validateDeliveryConfig, dueReports } from '../../../../lib/coach-dashboard/reportDelivery';
import { runReportSmsDeliveries } from '../../../../lib/coach-dashboard/reportSmsDelivery';

export default async function handler(req:NextApiRequest,res:NextApiResponse){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).json({error:'POST required.'});}
 if(!await requireAdminRequest(req))return res.status(401).json({error:'Admin authentication required.'});
 try{
  if(!req.body||typeof req.body!=='object'||Object.keys(req.body).some(k=>!['teamId','kind'].includes(k))||!validTeamId(req.body.teamId)||req.body.kind!=='daily')return res.status(400).json({error:'Choose a team and daily report.'});
  const app=getFirebaseAdminApp(false);
  const actor=await app.auth().verifyIdToken((req.headers.authorization||'').slice(7),true);
  const email=typeof actor.email==='string'?actor.email.trim():'';
  if(!email||!(await app.firestore().collection('admin').doc(email).get()).exists)return res.status(403).json({error:'Admin access required.'});
  const db=app.firestore(),config=validateDeliveryConfig((await db.collection('coach-team-insight-reports').doc('delivery').collection('configs').doc(req.body.teamId).get()).data());
  if(!config.recipientUids.includes(actor.uid)||!config.smsRecipientUids?.includes(actor.uid))return res.status(403).json({error:'Your account must be a selected report recipient.'});
  const now=new Date(),due=dueReports({...config,dailyEnabled:true,weeklyEnabled:false,startDate:'2000-01-01',sendHour:0},now)[0];
  const run={teamId:config.teamId,uid:actor.uid,kind:due.kind,reportDate:due.reportDate};
  const emailResult=await runReportDeliveries(db,now,{run,budgetMs:8000});
  const sms=await runReportSmsDeliveries(db,now,{run,budgetMs:8000});
  return res.status(200).json({teamId:config.teamId,reportDate:due.reportDate,email:emailResult,sms});
 }catch(error){return res.status(409).json({error:error instanceof Error?error.message:'Report test unavailable.'});}
}
