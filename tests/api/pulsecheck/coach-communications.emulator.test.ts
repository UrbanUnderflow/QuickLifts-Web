import { before, beforeEach, after, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { initializeTestEnvironment, assertFails, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { enqueueBatch, processQueue, cancelBatch } from '../../../src/lib/coach-communications/queue';
import { rootFor, loadInbox } from '../../../src/lib/coach-communications/service';
const projectId='demo-pulsecheck-communications';
if (!/^127\.0\.0\.1:\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST || '')) throw Error('Local emulator required. Production is prohibited.');
const [host,port]=process.env.FIRESTORE_EMULATOR_HOST!.split(':');
let env: RulesTestEnvironment;const app=initializeApp({projectId},'communications-emulator'),db=getFirestore(app);
process.env.TWILIO_FROM_NUMBER='+12025559999';
before(async()=>{env=await initializeTestEnvironment({projectId,firestore:{host,port:Number(port),rules:fs.readFileSync('firestore.rules','utf8')}});});
beforeEach(async()=>{
 await env.clearFirestore();
 for(const uid of ['a','b','coach']) await db.doc('users/'+uid).set({displayName:'Synthetic '+uid});
 await db.doc('pulsecheck-organizations/org').set({status:'active'});await db.doc('pulsecheck-teams/team').set({organizationId:'org',status:'active'});
 await db.doc('pulsecheck-team-memberships/team_coach').set({teamId:'team',organizationId:'org',userId:'coach',role:'coach',status:'active',staffCapabilities:['coaching']});
 for(const [i,id] of ['a','b'].entries()){
  await db.doc('pulsecheck-team-memberships/team_'+id).set({teamId:'team',organizationId:'org',userId:id,role:'athlete',status:'active'});
  await rootFor(db).collection('contacts').doc('team_'+id).set({teamId:'team',athleteId:id,displayName:'Synthetic '+id,enabled:true,phone:`+1202555010${i}`,consent:{purpose:'team-communications',status:'granted',grantedAtMs:1,evidenceId:'synthetic'}});
 }
});
after(async()=>{await env?.cleanup();await deleteApp(app);});
test('real rules deny all client access to nested contact, message, job and consent data',async()=>{
 for(const uid of ['a','coach','stranger'])for(const sub of ['contacts/team_a','jobs/job','consent-events/event','teams/team/messages/message','teams/team/batches/batch','pending-athletes/row','pending-phone-index/hash']){
  const path='pulsecheck-restricted-questionnaire-submissions/coach-communications-v1/'+sub;
  await db.doc(path).set({synthetic:true});const client=env.authenticatedContext(uid,{admin:true}).firestore();await assertFails(getDoc(doc(client,path)));await assertFails(setDoc(doc(client,path),{forged:true}));
 }
});
test('real concurrent queue and workers send each recipient once',async()=>{
 const p={requestId:'request',athleteIds:['a','b'],text:'Synthetic only'};
 const groups=await Promise.all([enqueueBatch(db,'coach','team',p),enqueueBatch(db,'coach','team',{...p,requestId:'reload'})]);assert.equal(groups[0].batchId,groups[1].batchId);
 let calls=0;const send=async()=>{calls++;return{state:'accepted' as const,providerId:'SM'+'a'.repeat(32)};};await Promise.all([processQueue(db,send),processQueue(db,send)]);
 assert.equal(calls,2);const inbox=await loadInbox(db,'coach','team','prod');assert.deepEqual(inbox.batches[0].counts,{accepted:2});
});
test('real Firestore pagination retains equal timestamps without omissions or duplicates',async()=>{
 const messages=rootFor(db).collection('teams').doc('team').collection('messages'),batch=db.batch();
 for(let i=0;i<205;i++)batch.set(messages.doc('m'+String(i).padStart(3,'0')),{athleteId:'a',text:'Synthetic',atMs:1,direction:'incoming',status:'received'});await batch.commit();
 const first=await loadInbox(db,'coach','team','prod');assert.equal(first.messages.length,200);assert.ok(first.nextCursor);const second=await loadInbox(db,'coach','team','prod',first.nextCursor!);assert.equal(second.messages.length,5);assert.equal(new Set([...first.messages,...second.messages].map(m=>m.id)).size,205);
});
test('cancel only queued recipients; blocked roster access cannot inspect or cancel a group',async()=>{
 const group=await enqueueBatch(db,'coach','team',{requestId:'request',athleteIds:['a','b'],text:'Synthetic'});await assert.rejects(cancelBatch(db,'stranger','team',group.batchId));
 assert.equal((await cancelBatch(db,'coach','team',group.batchId)).canceled,2);let calls=0;await processQueue(db,async()=>{calls++;return{state:'accepted'};});assert.equal(calls,0);
 await db.doc('pulsecheck-team-memberships/team_coach').update({rosterVisibilityScope:'assigned',allowedAthleteIds:['b']});assert.equal((await loadInbox(db,'coach','team','prod')).batches.length,0);await assert.rejects(cancelBatch(db,'coach','team',group.batchId));
});

test('real account closure erases messages and queued work without erasing another athlete or consent evidence',async()=>{
 const {requestClosure,runClosureJob}=require('../../../netlify/functions/lib/account-closure');
 const {recordDelivery}=await import('../../../src/lib/coach-communications/queue');
 const {receiveSms}=await import('../../../src/lib/coach-communications/service');
 const root=rootFor(db),group=await enqueueBatch(db,'coach','team',{requestId:'close',athleteIds:['a','b'],text:'Synthetic closure test'});
 const jobs=(await root.collection('jobs').get()).docs,jobA=jobs.find(d=>d.data().athleteId==='a')!;
 await root.collection('consent-events').doc('evidence').set({uid:'a',teamId:'team',accepted:true});
 const suppression=db.doc('pulsecheck-restricted-questionnaire-submissions/coach-surveys-v1/sms-suppressions/synthetic');await suppression.set({suppressed:true});
 const auth={updateUser:async()=>{},revokeRefreshTokens:async()=>{},deleteUser:async()=>{}};
 await requestClosure({db,auth,uid:'a',now:1});
 const destinations:string[]=[];await processQueue(db,async({to})=>{destinations.push(to);return{state:'accepted',providerId:'SM'+'b'.repeat(32)};});
 assert.deepEqual(destinations,['+12025550101']);
 for(let i=0;i<25&&(await db.doc('account-closure-jobs/a').get()).data()?.status!=='retention_review';i++)await runClosureJob({db,auth,uid:'a',now:2,maxPages:1000});
 assert.equal((await db.doc('account-closure-jobs/a').get()).data()?.status,'retention_review');
 assert.equal((await root.collection('contacts').doc('team_a').get()).exists,false);
 assert.equal((await root.collection('jobs').doc(jobA.id).get()).exists,false);
 const inbox=await loadInbox(db,'coach','team','prod');assert.equal(inbox.messages.some(m=>m.athleteId==='a'),false);assert.equal(inbox.messages.some(m=>m.athleteId==='b'),true);
 const batch=(await root.collection('teams').doc('team').collection('batches').doc(group.batchId).get()).data()!;assert.deepEqual(batch.athleteIds,['b']);assert.equal(batch.fingerprint,undefined);
 assert.equal((await root.collection('consent-events').doc('evidence').get()).exists,true);assert.equal((await suppression.get()).exists,true);
 await recordDelivery(db,jobA.id,{To:'+12025550100',From:'+12025559999',MessageSid:'SM'+'a'.repeat(32),MessageStatus:'delivered'});
 await receiveSms(db,{From:'+12025550100',To:'+12025559999',MessageSid:'SM'+'c'.repeat(32),Body:'Late synthetic reply'});
 assert.equal((await root.collection('teams').doc('team').collection('messages').where('athleteId','==','a').get()).empty,true);
});

test('real organization purge clears nested SMS data and retains opt-out evidence',async()=>{
 const {purgeOrganizationBatch}=require('../../../netlify/functions/lib/organization-lifecycle');
 const root=rootFor(db);await enqueueBatch(db,'coach','team',{requestId:'purge',athleteIds:['a','b'],text:'Synthetic purge test'});
 await root.collection('routes').doc('route').set({teamId:'team',athleteId:'a'});
 await root.collection('consent-events').doc('evidence').set({uid:'a',teamId:'team'});
 await db.doc('pulsecheck-organizations/org').set({status:'decommissioned',lifecycleState:'deleted',deletedAt:1,purgeAfter:2});
 for(let i=0;i<30&&(await db.doc('pulsecheck-organizations/org').get()).data()?.lifecycleState!=='purged';i++)await purgeOrganizationBatch({db,organizationId:'org',now:3,batchSize:2});
 assert.equal((await db.doc('pulsecheck-organizations/org').get()).data()?.lifecycleState,'purged');
 for(const name of ['jobs','contacts','routes'])assert.equal((await root.collection(name).get()).empty,true,name);
 for(const name of ['messages','batches','send-intents'])assert.equal((await root.collection('teams').doc('team').collection(name).get()).empty,true,name);
 assert.equal((await root.collection('consent-events').doc('evidence').get()).exists,true);
 assert.equal((await db.doc('users/a').get()).exists,true);
});
test('legacy admin cleanup verifies Auth absence and recovers a crash without expanding deletion',async()=>{
 const {stageCommunicationDeletion,processCommunicationDeletion}=require('../../../netlify/functions/lib/communication-admin-deletion');
 await enqueueBatch(db,'coach','team',{requestId:'admin-closure',athleteIds:['a','b'],text:'Synthetic'});
 await stageCommunicationDeletion({db,uid:'a'});
 let sends=0;await processQueue(db,async()=>{sends++;return{state:'accepted'};});assert.equal(sends,1);
 const before=(await rootFor(db).collection('jobs').get()).size;
 const stillExists=await processCommunicationDeletion({db,uid:'a',auth:{getUser:async()=>({uid:'a'})}});
 assert.equal(stillExists.reason,'auth_still_exists');assert.equal((await rootFor(db).collection('jobs').get()).size,before);
 await assert.rejects(processCommunicationDeletion({db,uid:'a',auth:{getUser:async()=>{throw Object.assign(Error('synthetic unavailable'),{code:'auth/internal-error'});}}}));
 // Simulate the crash window: Auth gone, no confirmation/profile-delete executed.
 const absent={getUser:async()=>{throw Object.assign(Error('synthetic missing'),{code:'auth/user-not-found'});}};
 let result:any;for(let i=0;i<20;i++){result=await processCommunicationDeletion({db,uid:'a',auth:absent});if(!result.pending)break;}
 assert.equal(result.pending,false);assert.equal((await rootFor(db).collection('admin-deletions').doc('a').get()).data()?.status,'completed');
 assert.equal((await rootFor(db).collection('contacts').doc('team_a').get()).exists,false);
 assert.equal((await rootFor(db).collection('contacts').doc('team_b').get()).exists,true);
 assert.equal((await db.doc('users/a').get()).exists,true); // Not a full account closure.
 assert.equal((await db.doc('pulsecheck-team-memberships/team_a').get()).data()?.status,'active');
});
test('admin cleanup round-robin makes progress beyond still-existing Auth accounts',async()=>{
 const {stageCommunicationDeletion,processCommunicationDeletions}=require('../../../netlify/functions/lib/communication-admin-deletion');
 for(let i=0;i<6;i++)await stageCommunicationDeletion({db,uid:'candidate'+i});
 const auth={getUser:async(uid:string)=>{if(uid==='candidate5')throw Object.assign(Error('synthetic missing'),{code:'auth/user-not-found'});return{uid};}};
 assert.equal((await processCommunicationDeletions({db,auth})).processed,5);
 assert.equal((await processCommunicationDeletions({db,auth})).processed,1);
 assert.equal((await rootFor(db).collection('admin-deletions').doc('candidate5').get()).data()?.status,'completed');
});
