const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const admin=require('firebase-admin');
const {run,dateKeys,planDateWindow,shouldQueue}=require('../../netlify/functions/utils/deviceBackgroundSync');
const projectId='demo-device-'+Date.now().toString(36);let app,db;
before(()=>{assert.ok(process.env.FIRESTORE_EMULATOR_HOST,'Local emulator required');app=admin.initializeApp({projectId},'device-history-tests');db=app.firestore();});
after(()=>app.delete());
const now=Date.parse('2026-09-07T14:00:00Z');
const timezone=x=>x||'UTC';
test('civil-day window crosses daylight-saving and month boundaries',()=>{assert.deepEqual(dateKeys(new Date('2026-03-09T02:00:00Z'),'America/New_York').slice(0,3),['2026-03-08','2026-03-07','2026-03-06']);assert.equal(dateKeys(new Date('2026-09-01T12:00:00Z'),'UTC').at(-1),'2026-08-25');});
test('queued backoff and live leases survive scheduling',()=>{assert.equal(shouldQueue({status:'queued',nextAttemptAt:now+1000},now),false);assert.equal(shouldQueue({status:'processing',leaseUntil:now+1000},now),false);assert.equal(shouldQueue({status:'complete',nextAttemptAt:now+1000},now),false);assert.equal(shouldQueue({status:'processing',leaseUntil:now-1},now),true);});
for(const provider of ['whoop','oura','polar','google_health'])test(`${provider} saves and verifies exact athlete-day`,async()=>{
 const userId='synthetic-'+provider,connectionCollection='test-connections-'+provider;
 await db.collection(connectionCollection).doc(userId).set({userId,status:'connected',timezone:'UTC'});
 const result=await run({db,provider,connectionCollection,resolveTimeZone:timezone,now,sync:async a=>{await db.collection('health-context-snapshots').doc(`${userId}_daily_${a.dateKey}`).set({athleteUserId:userId,snapshotDateKey:a.dateKey});return {status:'synced',sourceRecordIds:['synthetic-record']};}});
 assert.equal(result.status,'complete');
 const jobs=await db.collection('pulsecheck-device-sync-jobs').where('provider','==',provider).get();assert.equal(jobs.size,8);assert.equal(jobs.docs.filter(x=>x.data().status==='complete').length,1);
});
test('missing snapshot and provider outage stay retryable',async()=>{
 const provider='missing',connectionCollection='test-connections-missing';await db.collection(connectionCollection).doc('synthetic-missing').set({userId:'synthetic-missing',status:'connected'});
 let result=await run({db,provider,connectionCollection,resolveTimeZone:timezone,now,sync:async()=>({status:'synced',sourceRecordIds:['record']})});assert.equal(result.status,'queued');
 result=await run({db,provider,connectionCollection,resolveTimeZone:timezone,now,sync:async()=>{throw Error('provider unavailable')}});assert.equal(result.status,'queued');
 const jobs=await db.collection('pulsecheck-device-sync-jobs').where('provider','==',provider).get();assert.ok(jobs.docs.some(d=>d.data().lastErrorCode==='DEVICE_BACKGROUND_SYNC_FAILED'));assert.equal(jobs.docs.some(d=>d.data().status==='complete'),false);
});

test('scheduler outage longer than a week retains a catch-up cursor',()=>{const p=planDateWindow(new Date('2026-09-07T14:00:00Z'),'UTC','2026-07-01');assert.equal(p.dates[0],'2026-07-02');assert.equal(p.cursor,'2026-08-01');assert.ok(p.dates.includes('2026-09-07'));});

test('wrong athlete or day never counts as a completed snapshot',async()=>{
 const provider='wrong-day',connectionCollection='test-connections-wrong';
 await db.collection(connectionCollection).doc('synthetic-wrong').set({userId:'synthetic-wrong',status:'connected'});
 const result=await run({db,provider,connectionCollection,resolveTimeZone:timezone,now,sync:async a=>{
  await db.collection('health-context-snapshots').doc(`synthetic-wrong_daily_${a.dateKey}`).set({athleteUserId:'another-user',snapshotDateKey:a.dateKey});
  return {status:'synced',sourceRecordIds:['record']};
 }});assert.equal(result.status,'queued');
});
test('disconnected queued connection is cancelled without calling provider',async()=>{
 const provider='disconnected',connectionCollection='test-connections-disconnected';
 await db.collection(connectionCollection).doc('synthetic-off').set({userId:'synthetic-off',status:'disconnected'});
 await db.collection('pulsecheck-device-sync-jobs').doc('synthetic-off-job').set({provider,userId:'synthetic-off',requestedDateKey:'2026-09-06',status:'queued'});
 const result=await run({db,provider,connectionCollection,resolveTimeZone:timezone,now,sync:async()=>{assert.fail('Provider must not be called')}});
 assert.equal(result.status,'cancelled');
});
test('a live connection lease prevents a second provider call',async()=>{
 const provider='locked',connectionCollection='test-connections-locked';
 await db.collection(connectionCollection).doc('synthetic-locked').set({userId:'synthetic-locked',status:'connected'});
 await db.collection('device-sync-worker-locks').doc(`${provider}_synthetic-locked`).set({lease:'other-worker',leaseUntil:now+60000});
 const result=await run({db,provider,connectionCollection,resolveTimeZone:timezone,now,sync:async()=>{assert.fail('Overlapping call')}});
 assert.equal(result.processed,0);
});
