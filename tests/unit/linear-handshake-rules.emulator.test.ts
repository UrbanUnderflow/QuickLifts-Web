import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';

test('emulator: enrolled users cannot start direct legacy work or bypass via owner removal; non-enrolled work preserved', async () => {
 assert.equal(process.env.FIRESTORE_EMULATOR_HOST, '127.0.0.1:8099', 'Explicit local emulator required');
 const env=await initializeTestEnvironment({projectId:'demo-linear-handshake',firestore:{host:'127.0.0.1',port:8099,rules:readFileSync('firestore.rules','utf8')}});
 try {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async context=>{
   const db=context.firestore();
   await setDoc(doc(db,'pulsecheck-linear-curriculum/states/items/a'),{athleteId:'a',optedIn:true});
   for(const root of ['sim-assignments','mental-exercise-assignments']) {
    await setDoc(doc(db,`${root}/enrolled`),{athleteUserId:'a',status:'pending'});
    await setDoc(doc(db,`${root}/reserved`),{athleteUserId:'b',source:'standalone_reservation',status:'in_progress'});
    await setDoc(doc(db,`${root}/legacy`),{athleteUserId:'b',status:'pending'});
   }
  });
  for(const root of ['sim-assignments','mental-exercise-assignments']) {
   const a=env.authenticatedContext('a').firestore(),b=env.authenticatedContext('b').firestore();
   await assertFails(updateDoc(doc(a,`${root}/enrolled`),{status:'in_progress'}));
   await assertFails(updateDoc(doc(a,`${root}/enrolled`),{startedAt:1234}));
   await assertFails(setDoc(doc(a,`${root}/self`),{athleteUserId:'a',status:'in_progress'}));
   await assertFails(updateDoc(doc(a,`${root}/enrolled`),{athleteUserId:'other',status:'pending'}));
   await assertFails(deleteDoc(doc(a,`${root}/enrolled`)));
   await assertSucceeds(updateDoc(doc(a,`${root}/enrolled`),{status:'completed'}));
   await assertFails(updateDoc(doc(b,`${root}/reserved`),{status:'completed'}));
   await assertFails(deleteDoc(doc(b,`${root}/reserved`)));
   await assertFails(setDoc(doc(a,`${root}/ownerless`),{status:'in_progress'}));
   await assertSucceeds(updateDoc(doc(b,`${root}/legacy`),{status:'in_progress'}));
   await assertFails(updateDoc(doc(b,`${root}/legacy`),{athleteUserId:'other'}));
   await assertFails(deleteDoc(doc(b,`${root}/legacy`)));
   await assertSucceeds(updateDoc(doc(b,`${root}/legacy`),{status:'completed'}));
  }
 } finally {await env.cleanup();}
});

test('emulator: real overlapping enrollment and legacy start cannot both commit', async () => {
 assert.equal(process.env.FIRESTORE_EMULATOR_HOST, '127.0.0.1:8099');
 const { initializeApp, deleteApp }=await import('firebase-admin/app');
 const { getFirestore }=await import('firebase-admin/firestore');
 const { commitLegacyStart, assertNoActiveLegacyWork }=await import('../../src/api/firebase/dailyCurriculum/linearEnrollmentHandshake');
 const app=initializeApp({projectId:'demo-linear-handshake'},'linear-race'); const db=getFirestore(app);
 try {
  for(let i=0;i<4;i++) {
   const owner=`race-${i}`;const assignment=db.collection('pulsecheck-daily-assignments').doc(owner);
   const state=db.collection('pulsecheck-linear-curriculum').doc('states').collection('items').doc(owner);
   await state.delete();await assignment.set({athleteId:owner,status:'assigned'});
   const enroll=()=>db.runTransaction(async tx=>{const current=await tx.get(state);if(current.exists)throw new Error('already initialized');await assertNoActiveLegacyWork(tx,db,owner);tx.create(state,{athleteId:owner,optedIn:true});});
   const start=()=>commitLegacyStart(db,assignment,owner,()=>({status:'started',startedAt:Date.now()}));
   const results=await Promise.allSettled(i%2?[start(),enroll()]:[enroll(),start()]);
   assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
   const [a,s]=await Promise.all([assignment.get(),state.get()]);
   assert.equal(s.exists && a.data()?.status==='started',false);
  }
 } finally {await deleteApp(app);}
});

test('emulator: standalone reservations validate content, ownership, restrictions and retain terminal history', async () => {
 assert.equal(process.env.FIRESTORE_EMULATOR_HOST,'127.0.0.1:8099');
 const {initializeApp,deleteApp}=await import('firebase-admin/app');
 const {getFirestore}=await import('firebase-admin/firestore');
 const {createLegacyStartHandler}=await import('../../src/pages/api/curriculum/legacy-start');
 const app=initializeApp({projectId:'demo-linear-handshake'},'standalone-test');const db=getFirestore(app);
 try {
  let uid='standalone-owner';
  const handler=createLegacyStartHandler({authorize:async()=>({uid,db}) as never,now:()=>1234});
  const call=async(body:object)=>{let status=0,payload:any;await handler({method:'POST',body} as never,{setHeader(){},status(value:number){status=value;return this;},json(value:unknown){payload=value;return this;}} as never);return {status,payload};};
  await db.collection('sim-modules').doc('valid-game').set({isActive:true});
  assert.equal((await call({action:'reserve',moduleId:'missing',idempotencyKey:'one'})).status,409);
  const first=await call({action:'reserve',moduleId:'valid-game',idempotencyKey:'one'});assert.equal(first.status,200);
  assert.deepEqual(await call({action:'reserve',moduleId:'valid-game',idempotencyKey:'one'}),first);
  const ref=db.collection('sim-assignments').doc(first.payload.assignmentId);
  assert.equal((await ref.get()).data()?.startedAt,1234);
  uid='other-owner';assert.equal((await call({action:'release',idempotencyKey:'one',assignmentId:ref.id,outcome:'completed'})).status,409);uid='standalone-owner';
  assert.equal((await call({action:'release',idempotencyKey:'one',assignmentId:ref.id,outcome:'cancelled'})).status,200);
  assert.equal((await call({action:'release',idempotencyKey:'one',assignmentId:ref.id,outcome:'cancelled'})).status,200);
  assert.equal((await call({action:'release',idempotencyKey:'one',assignmentId:ref.id,outcome:'completed'})).status,409);
  assert.equal((await ref.get()).data()?.status,'cancelled');
  assert.equal((await call({action:'reserve',moduleId:'valid-game',idempotencyKey:'one'})).status,409);
  await db.collection('pulsecheck-pilot-enrollments').doc('hold').set({userId:uid,status:'active'});
  await db.collection('pulsecheck-pilot-operational-states').doc('hold').set({watchListActive:true,restrictionFlags:{suppressAssignments:true}});
  assert.equal((await call({action:'reserve',moduleId:'valid-game',idempotencyKey:'two'})).status,409);
  uid='reserve-race-owner';
  const {assertNoActiveLegacyWork}=await import('../../src/api/firebase/dailyCurriculum/linearEnrollmentHandshake');
  const raceState=db.doc(`pulsecheck-linear-curriculum/states/items/${uid}`);
  const enrollment=db.runTransaction(async tx=>{await tx.get(raceState);await assertNoActiveLegacyWork(tx,db,uid);tx.create(raceState,{athleteId:uid});}).then(()=>true,()=>false);
  const [enrolled,reserved]=await Promise.all([enrollment,call({action:'reserve',moduleId:'valid-game',idempotencyKey:'race'})]);
  assert.equal(Number(enrolled)+Number(reserved.status===200),1,'new reservation creation and enrollment cannot both succeed');
  uid='cancel-race-owner';
  const {createHash}=await import('node:crypto');
  const cancelledId=(key:string)=>`standalone_${createHash('sha256').update(`${uid}:${key}`).digest('hex')}`;
  assert.equal((await call({action:'release',assignmentId:cancelledId('absent'),idempotencyKey:'wrong',outcome:'cancelled'})).status,409);
  assert.equal((await db.collection('sim-assignments').doc(cancelledId('absent')).get()).exists,false);
  assert.equal((await call({action:'release',assignmentId:cancelledId('absent'),idempotencyKey:'absent',outcome:'completed'})).status,409);
  for(let i=0;i<4;i++) {
    const key=`cancel-${i}`,id=cancelledId(key);
    const cancel=()=>call({action:'release',assignmentId:id,idempotencyKey:key,outcome:'cancelled'});
    const reserve=()=>call({action:'reserve',moduleId:'valid-game',idempotencyKey:key});
    const results=await Promise.all(i%2?[reserve(),cancel()]:[cancel(),reserve()]);
    assert.equal(results[i%2?1:0].status,200);
    assert.equal((await db.collection('sim-assignments').doc(id).get()).data()?.status,'cancelled');
    assert.equal((await reserve()).status,409,'late reserve cannot resurrect cancelled session');
    assert.equal((await cancel()).status,200);
  }
  const victimId=cancelledId('victim');uid='other-owner';
  assert.equal((await call({action:'release',assignmentId:victimId,idempotencyKey:'victim',outcome:'cancelled'})).status,409);
  assert.equal((await db.collection('sim-assignments').doc(victimId).get()).exists,false);
  uid='versioned-owner';await db.doc(`pulsecheck-linear-curriculum/states/items/${uid}`).set({athleteId:uid});
  assert.equal((await call({action:'reserve',moduleId:'valid-game',idempotencyKey:'one'})).status,409);
 } finally {await deleteApp(app);}
});
