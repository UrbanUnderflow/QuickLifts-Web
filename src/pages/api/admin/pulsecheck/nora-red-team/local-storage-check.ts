import type { NextApiRequest, NextApiResponse } from 'next';
import { randomUUID } from 'node:crypto';
import { localTestingApp, requireLocalTester } from '../../../../../lib/nora-red-team/localTesting';
export default async function handler(req:NextApiRequest,res:NextApiResponse){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='POST'||!(await requireLocalTester(req)))return res.status(403).json({error:'Local development tester required.'});
 const app=localTestingApp();const ref=app.firestore().collection('nora-red-team-local-checks').doc(randomUUID());
 try{
   const value={synthetic:true,kind:'storage-probe',status:'pending',createdAt:new Date().toISOString()};
   await ref.set(value);const fresh=await ref.get();
   const checks=[{name:'Development Firebase write and fresh server read',passed:fresh.exists && fresh.data()?.kind === value.kind && fresh.data()?.status === value.status && fresh.data()?.synthetic === true}];
   await ref.update({status:'complete'});checks.push({name:'Updated value persists on a fresh read',passed:(await ref.get()).data()?.status==='complete'});
   const url=`https://firestore.googleapis.com/v1/projects/${app.options.projectId}/databases/(default)/documents/${ref.path}`;
   const anonymous=await fetch(url);checks.push({name:'Anonymous direct database read denied',passed:anonymous.status===403});
   const signed=await fetch(url,{headers:{Authorization:'Bearer '+req.cookies['nora-local-session']}});checks.push({name:'Synthetic tester cannot bypass server through direct database read',passed:signed.status===403});
   await ref.delete();checks.push({name:'Synthetic probe cleaned up',passed:!(await ref.get()).exists});
   return res.json({verdict:checks.every(c=>c.passed)?'Pass':'Needs attention',checks,scope:'Real development Firebase connectivity and namespace access checks. This probe does not validate production Nora transcript storage, clinical separation or delivery.'});
 }catch{return res.status(500).json({error:'Firebase integration check failed.'});}finally{await ref.delete().catch(()=>{});}
}
