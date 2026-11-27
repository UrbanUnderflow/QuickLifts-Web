'use strict';
// Requires the explicitly isolated Test Lab server. Missing services fail; no skip.
const {test, before, after} = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const {client, PROJECT} = require('../../../scripts/test-lab/emulator-fixtures.cjs');
const origin = process.env.ATHLETE_LAB_ORIGIN || 'http://127.0.0.1:18787';
const url = new URL(origin);
if (url.protocol !== 'http:' || !['127.0.0.1','localhost','[::1]'].includes(url.hostname)) throw Error('Loopback Test Lab required.');
const namespace = 'ui-lab-contract-' + crypto.randomBytes(5).toString('hex');
const uid = namespace + '-athlete', other = namespace + '-other';
const email = namespace + '@example.test';
let auth, db, token, otherToken;
const id = namespace + '-conversation';
const messages = [{id:'turn-1',content:'I imagined looking at my target.',isFromUser:true,timestamp:Date.now()/1000}];
async function call(path, body, bearer = token) {
  const response = await fetch(origin + path, {method:'POST',headers:{'Content-Type':'application/json',...(bearer ? {Authorization:'Bearer '+bearer} : {})},body:JSON.stringify(body)});
  return {status:response.status,body:await response.json()};
}
async function signIn(user) {
  const response=await fetch('http://'+process.env.FIREBASE_AUTH_EMULATOR_HOST+'/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=test-lab-only', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:user.email,password:'SyntheticContract123!',returnSecureToken:true})});
  assert.equal(response.status,200);return (await response.json()).idToken;
}
before(async()=>{
  ({auth,db}=await client());
  const health=await (await fetch(origin+'/__testlab/health')).json();
  assert.equal(health.projectId,PROJECT);assert.match(health.nativeContracts,/deterministic-model-transport/);
  token=await signIn(await auth.createUser({uid,email,password:'SyntheticContract123!',emailVerified:true}));
  otherToken=await signIn(await auth.createUser({uid:other,email:namespace+'-other@example.test',password:'SyntheticContract123!',emailVerified:true}));
});
after(async()=>{
  if(!db)return;
  await Promise.all([db.collection('conversations').doc(id).delete(),db.collection('account-closure-jobs').doc(uid).delete(),db.collection('admin').doc(email).delete()]);
  await Promise.all([auth.deleteUser(uid),auth.deleteUser(other)]);
});
test('protected save uses real emulator identity, persists history key, and preserves it for old clients',async()=>{
  const endpoint='/api/pulsecheck/functions/nora-save-conversation';
  assert.equal((await call(endpoint,{id,messages},null)).status,401);
  assert.equal((await call(endpoint,{id,sessionKey:'2026-11-26',messages})).status,200);
  let record=(await db.collection('conversations').doc(id).get()).data();
  assert.equal(record.userId,uid);assert.equal(record.sessionKey,'2026-11-26');assert.equal(record.messages[0].content,messages[0].content);
  assert.equal((await call(endpoint,{id,messages})).status,200);
  assert.equal((await db.collection('conversations').doc(id).get()).data().sessionKey,'2026-11-26');
});
test('invalid keys, cross-account overwrite and durable closure cannot mutate the saved conversation',async()=>{
  const endpoint='/.netlify/functions/nora-save-conversation';
  const before=(await db.collection('conversations').doc(id).get()).data();
  assert.equal((await call(endpoint,{id,sessionKey:'bad/key',messages})).status,400);
  assert.equal((await call(endpoint,{id,messages},otherToken)).status,403);
  await db.collection('account-closure-jobs').doc(uid).set({testLabRun:namespace});
  assert.equal((await call(endpoint,{id,messages})).status,401);
  assert.deepEqual((await db.collection('conversations').doc(id).get()).data(),before);
  await db.collection('account-closure-jobs').doc(uid).delete();
});
test('real storage policy redacts restricted content before emulator persistence',async()=>{
  assert.equal((await call('/api/pulsecheck/functions/nora-save-conversation',{id,messages:[{...messages[0],content:'My medication details are private.'}]})).status,200);
  const record=(await db.collection('conversations').doc(id).get()).data();
  assert.equal(record.storagePolicy.restricted,true);assert.match(record.messages[0].content,/withheld/i);
});
const reflection={sessionId:crypto.randomUUID(),preview:true,action:'question',context:{skill:'Reminder word',phase:'practice',moment:'Before a putt',word:'Target',action:'Look at my target',sport:'golf'},messages:[]};
test('reflection preview retains real registry authorization and production opening question',async()=>{
  const endpoint='/api/pulsecheck/functions/skill-reflection';
  assert.equal((await call(endpoint,reflection)).status,403);
  await db.collection('admin').doc(email).set({isActive:true,testLabRun:namespace});
  const result=await call(endpoint,reflection);assert.equal(result.status,200);assert.match(result.body.reply,/practicing or imagining/);
  assert.equal((await call(endpoint,{...reflection,preview:false})).status,501);
});
test('reflection retry, bounded reply and exact athlete-word draft execute without journal writes',async()=>{
  const endpoint='/.netlify/functions/skill-reflection';
  const input={...reflection,messages:[{role:'assistant',content:'What was it like?'},{role:'user',content:'I imagined the action. I felt no change yet.'}]};
  assert.equal((await call('/__testlab/fault',{uid,mode:'fail-skill-reflection-once'})).status,200);
  assert.equal((await call(endpoint,input)).status,503);
  const question=await call(endpoint,input);assert.equal(question.status,200);assert.equal(question.body.reply,'What did you notice while you practiced that action?');
  const draft=await call(endpoint,{...input,action:'draft'});assert.equal(draft.status,200);assert.equal(draft.body.draft.text,input.messages[1].content);
  assert.equal((await db.collection('pulsecheck-evidence-journals').doc(uid).collection('entries').get()).size,0);
  const receipts=await(await fetch(origin+'/__testlab/receipts?uid='+uid)).json();assert.equal(receipts.persistedConversations.length,1);
});
test('reflection safety boundary stops the preview and never returns an ordinary draft',async()=>{
  const result=await call('/api/pulsecheck/functions/skill-reflection',{...reflection,action:'draft',messages:[{role:'assistant',content:'What was it like?'},{role:'user',content:'I want to kill myself tonight.'}]});
  assert.equal(result.status,200);assert.equal(result.body.stopped,true);assert.equal(result.body.safety.status,'critical');assert.equal(result.body.draft,undefined);
});
