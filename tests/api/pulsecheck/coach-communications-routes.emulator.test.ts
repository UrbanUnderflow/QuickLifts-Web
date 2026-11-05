/** Authenticated API contract checks. Only local emulators and synthetic identities. */
import { before, beforeEach, after, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import admin from 'firebase-admin';
import { build } from 'esbuild';
import { rootFor } from '../../../src/lib/coach-communications/service';
const projectId = 'demo-pulsecheck-communications';
for (const key of ['FIRESTORE_EMULATOR_HOST','FIREBASE_AUTH_EMULATOR_HOST']) if (!/^127\.0\.0\.1:\d+$/.test(process.env[key] || '')) throw Error('Local Firestore and Auth emulators required; production prohibited.');
const app = admin.initializeApp({ projectId }, 'communications-routes');
const db = app.firestore();
(globalThis as any).__communicationsEmulatorApp = app;
const require = createRequire(import.meta.url);
const handlers: Record<string, any> = {};
let coach: any, athlete: any, stranger: any;
async function newIdentity() {
  const res = await fetch(`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=synthetic`, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({returnSecureToken:true})});
  assert.equal(res.status,200);return res.json();
}
async function invoke(route: string, token: string | undefined, method='GET', body?: any, query: any={teamId:'team'}, mode='prod') {
  let status=200, value:any;const headers:Record<string,any>={};
  const req = {method,query,body,headers:{...(token?{authorization:`Bearer ${token}`} : {}),'x-pulsecheck-firebase-mode':mode}};
  const res:any={setHeader:(k:string,v:any)=>{headers[k]=v;},status:(s:number)=>{status=s;return res;},json:(v:any)=>{value=v;return res;},end:()=>res};
  await handlers[route](req,res);return {status,value,headers};
}
before(async()=>{
  const out=path.resolve('work/communication-route-tests');fs.mkdirSync(out,{recursive:true});
  for(const [name,entry] of Object.entries({inbox:'src/pages/api/coach/communications/index.ts',pause:'src/pages/api/coach/communications/pause.ts',cancel:'src/pages/api/coach/communications/cancel.ts',preferences:'src/pages/api/pulsecheck/text-preferences.ts'})) {
    const outfile=path.join(out,name+'.cjs');
    await build({entryPoints:[entry],outfile,platform:'node',format:'cjs',bundle:true,packages:'external',plugins:[{name:'local-emulator-app-only',setup(b){
      b.onResolve({filter:/firebase-admin$/},args=>args.path.startsWith('.')?{path:'emulator-admin',namespace:'local-emulator'}:undefined);
      b.onLoad({filter:/.*/,namespace:'local-emulator'},()=>({contents:'export function getFirebaseAdminApp(){return globalThis.__communicationsEmulatorApp;}',loader:'js'}));
    }}]});
    handlers[name]=require(outfile).default;
  }
  [coach,athlete,stranger]=await Promise.all([newIdentity(),newIdentity(),newIdentity()]);
  Object.assign(process.env,{COACH_COMMUNICATIONS_SMS_ENABLED:'true',COACH_COMMUNICATIONS_SMS_WEBHOOK_ENABLED:'true',COACH_COMMUNICATIONS_FIREBASE_MODE:'prod',COACH_COMMUNICATIONS_WORKER_ENABLED:'true',COACH_COMMUNICATIONS_STATUS_WEBHOOK_URL:'https://example.test/status',COACH_COMMUNICATIONS_SMS_WEBHOOK_URL:'https://example.test/incoming',TWILIO_ACCOUNT_SID:'AC'+'a'.repeat(32),TWILIO_AUTH_TOKEN:'synthetic',TWILIO_FROM_NUMBER:'+12025559999'});
});
beforeEach(async()=>{
  const cleared=await fetch(`http://${process.env.FIRESTORE_EMULATOR_HOST}/emulator/v1/projects/${projectId}/databases/(default)/documents`,{method:'DELETE'});assert.equal(cleared.status,200);
  await db.doc('pulsecheck-organizations/org').set({status:'active'});await db.doc('pulsecheck-teams/team').set({organizationId:'org',status:'active'});
  for(const [identity,role] of [[coach,'coach'],[athlete,'athlete']] as const) await db.doc(`pulsecheck-team-memberships/team_${identity.localId}`).set({teamId:'team',organizationId:'org',userId:identity.localId,role,status:'active'});
  for (const identity of [coach,athlete]) await db.doc(`users/${identity.localId}`).set({displayName:'Synthetic'});
  await rootFor(db).collection('contacts').doc(`team_${athlete.localId}`).set({teamId:'team',athleteId:athlete.localId,displayName:'Synthetic athlete',enabled:true,phone:'+12025550100',consent:{purpose:'team-communications',status:'granted',grantedAtMs:1,evidenceId:'synthetic'}});
});
after(async()=>{delete (globalThis as any).__communicationsEmulatorApp;await app.delete();});
test('real emulator token verification rejects missing, malformed and disabled identities; team scope denies outsiders',async()=>{
  assert.equal((await invoke('inbox',undefined)).status,401);assert.equal((await invoke('inbox','forged')).status,401);
  assert.equal((await invoke('inbox',stranger.idToken)).status,403);assert.equal((await invoke('inbox',athlete.idToken)).status,403);
  const valid=await invoke('inbox',coach.idToken);assert.equal(valid.status,200);assert.equal(valid.value.recipients.length,1);assert.equal(valid.headers['Cache-Control'],'private, no-store');
  assert.equal((await invoke('inbox',coach.idToken,'GET',undefined,{teamId:'team'},'unknown')).status,401);
  const disabled=await newIdentity();await app.auth().updateUser(disabled.localId,{disabled:true});assert.equal((await invoke('inbox',disabled.idToken)).status,401);
});
test('authenticated queue, duplicate recovery, cancel and coach pause use actual route handlers without transport',async()=>{
  const payload={requestId:'route-test',athleteIds:[athlete.localId],text:'Synthetic app invite'};
  const queued=await invoke('inbox',coach.idToken,'POST',payload);assert.equal(queued.status,202);
  const duplicate=await invoke('inbox',coach.idToken,'POST',payload);assert.equal(duplicate.value.batchId,queued.value.batchId);
  assert.equal((await invoke('cancel',stranger.idToken,'POST',{teamId:'team',batchId:queued.value.batchId})).status,403);
  assert.equal((await invoke('cancel',coach.idToken,'POST',{teamId:'team',batchId:queued.value.batchId})).value.canceled,1);
  assert.equal((await invoke('pause',coach.idToken,'POST',{teamId:'team',athleteId:athlete.localId})).value.paused,true);
  assert.equal((await invoke('inbox',coach.idToken,'POST',{...payload,requestId:'again'})).status,409);
  assert.equal((await invoke('inbox',coach.idToken,'POST',payload,{teamId:'team'},'dev')).status,503);
});
test('athlete preference route requires ownership and recent phone auth; closure blocks reads and writes',async()=>{
  assert.equal((await invoke('preferences',coach.idToken)).status,403);
  assert.equal((await invoke('preferences',athlete.idToken)).status,200);
  assert.equal((await invoke('preferences',athlete.idToken,'POST',{accepted:true,version:'team-texts-v1'})).status,401);
  assert.equal((await invoke('preferences',athlete.idToken,'POST',{accepted:false,version:'team-texts-v1'})).value.enabled,false);
  await db.doc(`account-closure-jobs/${athlete.localId}`).set({status:'queued'});
  assert.equal((await invoke('preferences',athlete.idToken)).status,403);
  assert.equal((await invoke('preferences',athlete.idToken,'POST',{accepted:false,version:'team-texts-v1'})).status,403);
  assert.equal((await invoke('inbox',coach.idToken)).value.recipients.length,0);
  await db.doc(`account-closure-jobs/${coach.localId}`).set({status:'queued'});assert.equal((await invoke('inbox',coach.idToken)).status,403);
});
test('emulator phone ownership enables consent through the real preferences route without SMS delivery',async()=>{
  const base=`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}`;
  async function authCall(action:string,body:any) {const res=await fetch(`${base}/identitytoolkit.googleapis.com/v1/accounts:${action}?key=synthetic`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});assert.equal(res.status,200);return res.json();}
  const phone='+12025550199';const session=await authCall('sendVerificationCode',{phoneNumber:phone});
  const codes=await (await fetch(`${base}/emulator/v1/projects/${projectId}/verificationCodes`)).json();
  const code=codes.verificationCodes.find((c:any)=>c.sessionInfo===session.sessionInfo).code;
  const verified=await authCall('signInWithPhoneNumber',{sessionInfo:session.sessionInfo,code});
  await db.doc(`users/${verified.localId}`).set({displayName:'Synthetic phone athlete'});
  await db.doc(`pulsecheck-team-memberships/team_${verified.localId}`).set({teamId:'team',organizationId:'org',userId:verified.localId,role:'athlete',status:'active'});
  assert.equal((await invoke('preferences',verified.idToken,'POST',{accepted:true,version:'old'})).status,400);
  const result=await invoke('preferences',verified.idToken,'POST',{accepted:true,version:'team-texts-v1'});
  assert.equal(result.status,200);assert.equal(result.value.enabled,true);assert.equal(result.value.phoneLast4,'0199');
  const contact=(await rootFor(db).collection('contacts').doc(`team_${verified.localId}`).get()).data()!;
  assert.equal(contact.phone,phone);assert.equal(contact.consent.status,'granted');
});
