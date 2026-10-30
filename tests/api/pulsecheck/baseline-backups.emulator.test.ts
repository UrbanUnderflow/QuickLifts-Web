import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import admin from 'firebase-admin';
import fs from 'node:fs';
import {initializeTestEnvironment,assertFails} from '@firebase/rules-unit-testing';
import {doc,getDoc,setDoc} from 'firebase/firestore';
import { healthBaselineConsentDocuments } from '../../../src/api/firebase/pulsecheckProvisioning/consentPolicy';
import { teamBaselineReviewId } from '../../../src/lib/questionnaires/team-baseline-review';
import { COLLECTION, splitSubmission } from '../../../src/lib/questionnaires/cau';
import { backupMetadata, deleteVerifiedHealthBackup, healthBackupId, listHealthBackups, prepareHealthBackup, processHealthBackup } from '../../../src/lib/questionnaires/cau-backups';

if (!/^127\.0\.0\.1:\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST || '')) throw Error('This test requires an isolated local Firestore emulator.');
const projectId = 'demo-baseline-health-backups';
const app = admin.initializeApp({projectId}, 'baseline-backups-tests');
const db = app.firestore();
after(() => app.delete());
const HEALTH_CONSENT = healthBaselineConsentDocuments([],undefined,undefined,'pulsecheck').find(document=>document.category==='health_authorization')!;
let sequence = 0;
const fakeEnvironment = { AUNTEDNA_PARTNER_TEST_KEY:'ae_pk_test_fixture' };
async function fixture(verifiedPhone?: string) {
  const uid = `athlete-${++sequence}`;
  const decision = {document:HEALTH_CONSENT,decision:'accepted',signedName:'Synthetic Athlete',version:HEALTH_CONSENT.version,decidedAt:'2026-10-27T12:00:00Z'};
  await db.collection('users').doc(uid).set({id:uid,sport:'Golf'});
  const privateRef = db.collection('pulsecheck-private-users').doc(uid);
  await privateRef.set({baselineHealthConsentDecisions:{[HEALTH_CONSENT.id]:decision}});
  await privateRef.collection('consent-events').doc('first').set({actorUserId:uid,decisions:{[HEALTH_CONSENT.id]:decision},recordedAt:admin.firestore.Timestamp.now()});
  const assignment = {scope:'individual',environment:'test',universityCode:'SANDBOX'};
  const input = {submissionId:`submission-${uid}`,name:'Synthetic Athlete',email:verifiedPhone ? '' : 'athlete@example.test',answers:{'cau-starting-point-39':'Less than 5 hours'},completedSections:{performance:true,health:true}};
  const id = healthBackupId(uid,input.submissionId), mirrorId = `baseline_${uid}_fixture`;
  async function save() {
    await db.runTransaction(async tx => {
      const prepared = await prepareHealthBackup(db,tx,{uid,input,assignment,verifiedPhone,recordIds:[mirrorId]});
      tx.create(prepared.reference,prepared.record);
      tx.create(db.collection(COLLECTION).doc(mirrorId),{...splitSubmission(input,{verifiedPhone}).pulseCheck,externalId:uid,status:'complete',healthBackupId:id});
    });
  }
  return {uid,id,input,assignment,mirrorId,privateRef,save};
}
function receiptTransport(f:Awaited<ReturnType<typeof fixture>>, transform?:(value:any)=>any) {
  return (async (_url:any,request:any) => {
    const body=JSON.parse(request.body);
    assert.equal(body.submissionId,f.input.submissionId);
    assert.equal(Object.keys(body.fields).length,19);
    assert.equal(body.fields['cau-starting-point-46'],undefined,'performance goal never leaves with clinical payload');
    const envelope={success:true,requestId:'receipt-request',data:{externalId:f.uid,submissionId:f.input.submissionId,baselineId:'ae-baseline',athleteId:'ae-athlete',receivedAt:'2026-10-27T12:00:00Z',created:true}};
    return Response.json(transform?transform(envelope):envelope);
  }) as typeof fetch;
}

test('backup and completion are atomic, protected fields never enter mirror or admin metadata',async()=>{
  const f=await fixture();await f.save();
  const record=(await db.collection(COLLECTION).doc(f.id).get()).data()!;
  assert.equal(record.payload.fields['cau-starting-point-39'].value,'Less than 5 hours');
  assert.equal(JSON.stringify((await db.collection(COLLECTION).doc(f.mirrorId).get()).data()).includes('Less than 5 hours'),false);
  const metadata=backupMetadata(f.id,record);
  assert.equal(JSON.stringify(metadata).includes('Less than 5 hours'),false);
  assert.equal(metadata.canDelete,false);
  await assert.rejects(deleteVerifiedHealthBackup(db,f.id,'admin'),/confirmed AuntEdna receipt/);
  const page=await listHealthBackups(db,1);assert.equal(page.backups.length,1);
});
test('missing connection still retains a durable backup and never fabricates provider receipt',async()=>{
  const f=await fixture();await f.save();let calls=0;
  const result=await processHealthBackup(db,f.id,'admin',{env:{},transport:(async()=>{calls++;throw Error('must not send')}) as typeof fetch});
  assert.equal(result.deliveryStatus,'blocked');assert.equal(result.backupRetained,true);assert.equal(result.receipt,null);assert.equal(calls,0);
});
test('provider verification uses immutable identity, retains backup until explicit verified cleanup, and preserves receipt audit',async()=>{
  const f=await fixture();await f.save();let calls=0;
  const transport=(async(...args:any[])=>{calls++;return (receiptTransport(f) as any)(...args)}) as typeof fetch;
  const result=await processHealthBackup(db,f.id,'admin',{env:fakeEnvironment,transport});
  assert.equal(result.deliveryStatus,'verified');assert.equal(result.canDelete,true);assert.equal(calls,1);
  assert.equal((await processHealthBackup(db,f.id,'admin',{env:fakeEnvironment,transport})).deliveryStatus,'verified');assert.equal(calls,1);
  assert.equal((await db.collection(COLLECTION).doc(f.mirrorId).get()).data()?.auntEdna.baselineId,'ae-baseline');
  const removed=await deleteVerifiedHealthBackup(db,f.id,'admin');assert.equal(removed.backupRetained,false);
  const stored=(await db.collection(COLLECTION).doc(f.id).get()).data()!;assert.equal(stored.payload,undefined);assert.equal(stored.receipt.baselineId,'ae-baseline');
  assert.equal((await deleteVerifiedHealthBackup(db,f.id,'admin')).backupRetained,false);
});
test('mismatched/unconfirmed provider outcomes cannot permit deletion; retry reuses the same payload',async()=>{
  const f=await fixture();await f.save();
  const failed=await processHealthBackup(db,f.id,'admin',{env:fakeEnvironment,transport:receiptTransport(f,value=>({...value,data:{...value.data,submissionId:'another'}}))});
  assert.equal(failed.deliveryStatus,'retryable');assert.equal(failed.canDelete,false);
  await assert.rejects(deleteVerifiedHealthBackup(db,f.id,'admin'),/confirmed AuntEdna receipt/);
  const retry=await processHealthBackup(db,f.id,'admin',{env:fakeEnvironment,transport:receiptTransport(f)});assert.equal(retry.deliveryStatus,'verified');
});
test('revoked authorization and account closure block both backup creation and later transmission',async()=>{
  const f=await fixture();await f.save();
  await f.privateRef.set({baselineHealthConsentDecisions:{[HEALTH_CONSENT.id]:{decision:'revoked',version:HEALTH_CONSENT.version}}});
  let calls=0;const transport=(async()=>{calls++;throw Error('must not send')}) as typeof fetch;
  assert.equal((await processHealthBackup(db,f.id,'admin',{env:fakeEnvironment,transport})).deliveryStatus,'blocked');assert.equal(calls,0);
  const closed=await fixture();await db.collection('account-closure-jobs').doc(closed.uid).set({status:'pending'});
  await assert.rejects(closed.save(),/account is unavailable/);
  assert.equal((await db.collection(COLLECTION).doc(closed.id).get()).exists,false);
  assert.equal((await db.collection(COLLECTION).doc(closed.mirrorId).get()).exists,false);
});
test('live lease fences retry/delete and stale response cannot overwrite another claim',async()=>{
  const f=await fixture();await f.save();let release!:()=>void;
  const wait=new Promise<void>(r=>{release=r});let started!:()=>void;const ready=new Promise<void>(r=>{started=r});
  const transport=(async(...args:any[])=>{started();await wait;return (receiptTransport(f) as any)(...args)}) as typeof fetch;
  const first=processHealthBackup(db,f.id,'admin',{env:fakeEnvironment,transport});await ready;
  await assert.rejects(processHealthBackup(db,f.id,'admin',{env:fakeEnvironment,transport}),/already running/);
  await assert.rejects(deleteVerifiedHealthBackup(db,f.id,'admin'),/confirmed AuntEdna receipt/);
  await db.collection(COLLECTION).doc(f.id).update({lease:{id:'newer',expiresAt:Date.now()+90000}});
  release();await assert.rejects(first,/attempt changed/);
  assert.equal((await db.collection(COLLECTION).doc(f.id).get()).data()?.lease.id,'newer');
});


test('protected backup documents and audit are client-denied even to admin browser sessions',async()=>{
  const f=await fixture();await f.save();
  const env=await initializeTestEnvironment({projectId,firestore:{host:'127.0.0.1',port:8201,rules:fs.readFileSync('firestore.rules','utf8')}});
  try{
    await db.collection('admin').doc('admin@example.test').set({email:'admin@example.test'});
    for(const context of [env.unauthenticatedContext(),env.authenticatedContext(f.uid),env.authenticatedContext('coach'),env.authenticatedContext('admin',{email:'admin@example.test',admin:true})]){
      for(const path of [`${COLLECTION}/${f.id}`,`${COLLECTION}/${f.id}/audit/example`]){
        await assertFails(getDoc(doc(context.firestore(),path)));
        await assertFails(setDoc(doc(context.firestore(),path),{kind:'health_backup',deliveryStatus:'verified'}));
      }
    }
  }finally{await env.cleanup()}
});


async function teamFixture(){
  const f=await fixture(),teamId='team-'+f.uid,organizationId='org-'+f.uid,membershipId=teamId+'_'+f.uid;
  const summary=(await f.privateRef.get()).data()!;
  const member={userId:f.uid,role:'athlete',status:'active',teamId,organizationId,baselineJoinedAt:'2026-10-27',athleteOnboarding:{entryOnboardingStep:'complete',productConsentAccepted:true,consentDecisions:summary.baselineHealthConsentDecisions}};
  await db.collection('pulsecheck-team-memberships').doc(membershipId).set(member);
  await db.collection('pulsecheck-team-memberships').doc(membershipId).collection('consent-events').doc('first').set({actorUserId:f.uid,decisions:summary.baselineHealthConsentDecisions,recordedAt:admin.firestore.Timestamp.now()});
  await db.collection('pulsecheck-teams').doc(teamId).set({status:'active',organizationId,displayName:'Synthetic Golf',requiredConsents:[HEALTH_CONSENT]});
  await db.collection('pulsecheck-organizations').doc(organizationId).set({status:'active',productBrand:'pulsecheck',displayName:'Synthetic University',universityCode:'TESTUNI',auntEdnaBaselineConnection:{organizationId,teamIds:[teamId],environment:'live',universityCode:'TESTUNI',approvalReference:'synthetic-approval',credentialEnv:'AUNTEDNA_PARTNER_LIVE_KEY'}});
  Object.assign(f.assignment,{scope:'team',teamId,teamMembershipId:membershipId,organizationId,reviewId:teamBaselineReviewId(f.uid,membershipId,member),environment:'live',universityCode:'TESTUNI'});
  return{...f,teamId,organizationId,membershipId};
}
test('an approved provider route is pinned and cannot silently redirect an existing backup',async()=>{
  const f=await teamFixture();await f.save();let calls=0;
  const transport=(async()=>{calls++;throw Error('unknown outcome')}) as typeof fetch;
  const env={AUNTEDNA_PARTNER_LIVE_KEY:'ae_pk_live_fixture'};
  assert.equal((await processHealthBackup(db,f.id,'admin',{env,transport})).deliveryStatus,'retryable');assert.equal(calls,1);
  await db.collection('pulsecheck-organizations').doc(f.organizationId).update({universityCode:'OTHER','auntEdnaBaselineConnection.universityCode':'OTHER'});
  const result=await processHealthBackup(db,f.id,'admin',{env,transport});
  assert.equal(result.deliveryStatus,'blocked');assert.equal(result.deliveryIssue,'route_changed');assert.equal(calls,1);
  assert.equal(result.teamName,'Synthetic Golf');assert.equal(result.organizationName,'Synthetic University');
});
test('a new team-join marker cannot reuse the previous membership backup authorization',async()=>{
  const f=await teamFixture();await f.save();
  await db.collection('pulsecheck-team-memberships').doc(f.membershipId).update({baselineJoinedAt:'2026-10-28'});
  let calls=0;const transport=(async()=>{calls++;throw Error('must not send')}) as typeof fetch;
  const result=await processHealthBackup(db,f.id,'admin',{env:{AUNTEDNA_PARTNER_LIVE_KEY:'ae_pk_live_fixture'},transport});
  assert.equal(result.deliveryIssue,'authorization_changed');assert.equal(calls,0);
});
test('a stored verification label without its matching authenticated receipt never enables deletion',async()=>{
  const f=await fixture();await f.save();
  await db.collection(COLLECTION).doc(f.id).update({deliveryStatus:'verified',receipt:{externalId:'another',submissionId:f.input.submissionId}});
  const data=(await db.collection(COLLECTION).doc(f.id).get()).data();
  assert.equal(backupMetadata(f.id,data).canDelete,false);assert.equal(backupMetadata(f.id,data).deliveryStatus,'retryable');
  await assert.rejects(deleteVerifiedHealthBackup(db,f.id,'admin'),/confirmed AuntEdna receipt/);
});


test('an abandoned expired lease remains recoverable in dashboard metadata and replays the same submission',async()=>{
  const f=await fixture();await f.save();
  await db.collection(COLLECTION).doc(f.id).update({lease:{id:'abandoned',expiresAt:Date.now()-1},deliveryStatus:'pending'});
  const abandoned=backupMetadata(f.id,(await db.collection(COLLECTION).doc(f.id).get()).data());
  assert.equal(abandoned.deliveryStatus,'retryable');assert.equal(abandoned.canDelete,false);
  const recovered=await processHealthBackup(db,f.id,'admin',{env:fakeEnvironment,transport:receiptTransport(f)});
  assert.equal(recovered.deliveryStatus,'verified');assert.equal(recovered.canDelete,true);
});


test('admin listing is bounded and cursor pagination never returns raw payloads',async()=>{
  const f=await fixture();await f.save();
  const first=await listHealthBackups(db,1);assert.equal(first.backups.length,1);assert.ok(first.nextCursor);
  const next=await listHealthBackups(db,1,first.nextCursor!);assert.equal(next.backups.length,1);assert.notEqual(next.backups[0].id,first.backups[0].id);
  assert.equal(JSON.stringify(next).includes('Less than 5 hours'),false);
  await assert.rejects(listHealthBackups(db,101),/valid page/);await assert.rejects(listHealthBackups(db,1,'../other'),/valid page/);
});


test('phone-only identity saves and replays private health backup without fabricated email',async()=>{
 const f=await fixture('+12025550123');
 await f.save();
 const mirror=(await db.collection(COLLECTION).doc(f.mirrorId).get()).data();
 assert.equal(mirror?.identity.phone,'+12025550123');
 assert.equal('email' in mirror?.identity,false);
 const delivered=await processHealthBackup(db,f.id,f.uid,{transport:receiptTransport(f),env:fakeEnvironment});
 assert.equal(delivered.deliveryStatus,'verified');
});
