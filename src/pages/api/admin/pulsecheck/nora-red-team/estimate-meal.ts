import type {NextApiRequest,NextApiResponse} from 'next';
import {randomUUID} from 'node:crypto';
import {localTestingApp,requireLocalTester} from '../../../../../lib/nora-red-team/localTesting';
import {createSyntheticFirebaseIdToken} from '../../../../../lib/nora-red-team/syntheticFirebaseAuth';
export default async function handler(req:NextApiRequest,res:NextApiResponse){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='POST'||!(await requireLocalTester(req)))return res.status(403).json({error:'Local tester required.'});
 const app=localTestingApp(),uid=`nora-red-team-${randomUUID()}`;
 try{
 const origin=process.env.NORA_RED_TEAM_STAGING_CHAT_ORIGIN||process.env.PULSECHECK_LOCAL_FUNCTIONS_ORIGIN;
 if(!origin)throw Error('Missing development endpoint');
 const token=await createSyntheticFirebaseIdToken({app,uid,email:`${uid}@example.invalid`,apiKey:process.env.DEV_FIREBASE_WEB_API_KEY||process.env.NEXT_PUBLIC_DEV_FIREBASE_API_KEY||'',claims:{noraRedTeamSynthetic:true}});
 const result=await fetch(new URL('/.netlify/functions/nora-estimate-meal',origin),{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`,'x-pulsecheck-firebase-mode':'dev'},body:JSON.stringify(req.body),signal:AbortSignal.timeout(90000)});
 return res.status(result.status).json(await result.json());
 }catch{return res.status(503).json({error:'The estimate is unavailable. Please try again.'});}finally{await app.auth().deleteUser(uid).catch(()=>{});}
}
