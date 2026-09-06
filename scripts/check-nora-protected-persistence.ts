import {loadEnvConfig} from '@next/env';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
import {getFirebaseAdminApp} from '../src/lib/firebase-admin';
import {createSyntheticFirebaseIdToken} from '../src/lib/nora-red-team/syntheticFirebaseAuth';
async function main(){
 loadEnvConfig(process.cwd());
 const app=getFirebaseAdminApp(true),db=app.firestore();
 assert.equal(app.options.projectId,'quicklifts-dev-01');
 const uid=`nora-red-team-${randomUUID()}`,id=randomUUID();
 const ref=db.collection('conversations').doc(id);
 try {
  const token=await createSyntheticFirebaseIdToken({app,uid,email:`${uid}@example.invalid`,apiKey:process.env.DEV_FIREBASE_WEB_API_KEY||process.env.NEXT_PUBLIC_DEV_FIREBASE_API_KEY||'',claims:{noraRedTeamSynthetic:true}});
  async function send(path:string,body:object){return fetch(`${process.env.NORA_RED_TEAM_STAGING_CHAT_ORIGIN || "http://127.0.0.1:3111"}/.netlify/functions/${path}`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`,'x-pulsecheck-firebase-mode':'dev','x-nora-red-team-synthetic':'true'},body:JSON.stringify(body)});}
  const content='My medication is SYNTHETIC-PROTECTED-917.';
  let response=await send('nora-save-conversation',{id,messages:[{id:randomUUID(),content,isFromUser:true}]});
  assert.equal(response.status,200);const saved=(await ref.get()).data();assert.equal(saved?.storagePolicy.restricted,true);assert.ok(!JSON.stringify(saved).includes('SYNTHETIC-PROTECTED-917'));
  console.log('Protected native conversation: placeholder stored, fixture absent.');
  response=await send('nora-save-derived',{kind:'note',id,data:{title:content}});assert.equal(response.status,409);assert.equal((await db.collection('user-mental-notes').doc(uid).collection('notes').doc(id).get()).exists,false);
  console.log('Protected mental note: rejected before persistence.');
  response=await send('nora-save-derived',{kind:'summary',id,data:{summary:'A normal-looking summary'}});assert.equal(response.status,409);
  console.log('Summary of protected conversation: rejected.');
  await ref.set({userId:'different-synthetic-owner'},{merge:true});
  response=await send('nora-save-conversation',{id,messages:[]});assert.equal(response.status,403);
  console.log('Cross-account overwrite: denied.');
 }finally{await ref.delete();await db.collection('conversationSummaries').doc(id).delete();await db.collection('user-mental-notes').doc(uid).collection('notes').doc(id).delete();await app.auth().deleteUser(uid);}
}
main().catch(()=>{console.error('Protected persistence verification failed.');process.exitCode=1;});
