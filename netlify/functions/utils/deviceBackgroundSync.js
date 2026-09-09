const JOBS = 'pulsecheck-device-sync-jobs';

function dateKeys(now, timezone) {
  const today = new Intl.DateTimeFormat('en-CA', {timeZone: timezone, year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
  return Array.from({length:8},(_,i)=>new Date(Date.parse(today+'T12:00:00Z')-i*86400000).toISOString().slice(0,10));
}
function planDateWindow(now, timezone, cursor) {
  const recent = dateKeys(now, timezone), today=recent[0];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(cursor||'') || !Number.isFinite(Date.parse(cursor+'T12:00:00Z')) || cursor>=today) return {dates:recent,cursor:today};
  const missed=[];
  for(let i=1;i<=31;i++){const day=new Date(Date.parse(cursor+'T12:00:00Z')+i*86400000).toISOString().slice(0,10);if(day>today)break;missed.push(day);}
  return {dates:[...new Set([...missed,...recent])],cursor:missed.at(-1)||today};
}
function shouldQueue(job, now) {
  if(job.status==='queued')return false;
  if(job.status==='processing' && job.leaseUntil>now)return false;
  return !job.nextAttemptAt || job.nextAttemptAt<=now;
}
async function run({db,sync,resolveTimeZone,provider,connectionCollection,acceptConnection=()=>true,now=Date.now()}) {
  const state=db.collection('device-sync-worker-state').doc(provider);
  const cursor=(await state.get()).data()?.cursor;
  let query=db.collection(connectionCollection).orderBy('__name__').limit(5);
  if(cursor)query=query.startAfter(cursor);
  const connections=await query.get();
  for(const doc of connections.docs){
    const connection=doc.data();if(connection.status!=='connected'||!connection.userId||!acceptConnection(connection))continue;
    const timezone=resolveTimeZone(connection.lastSyncTimezone||connection.timezone||'UTC');
    const plan=planDateWindow(new Date(now),timezone,connection.historyScheduledThrough);
    for(const day of plan.dates){
      const ref=db.collection(JOBS).doc(`${provider}_catchup_${connection.userId}_${day}`);
      await db.runTransaction(async tx=>{const current=(await tx.get(ref)).data()||{};if(shouldQueue(current,now))tx.set(ref,{provider,userId:connection.userId,connectionId:doc.id,jobType:'device_catchup',requestedDateKey:day,timezone,status:'queued',createdAt:current.createdAt||now,nextAttemptAt:now},{merge:true});});
    }
    await doc.ref.set({historyScheduledThrough:plan.cursor},{merge:true});
  }
  await state.set({cursor:connections.size===5?connections.docs.at(-1).id:null,lastScanAt:now},{merge:true});
  // Recover interrupted work before selecting the next job.
  const stalled=await db.collection(JOBS).where('status','==','processing').limit(100).get();
  for(const doc of stalled.docs)if(doc.data().provider===provider && doc.data().leaseUntil<=now)await db.runTransaction(async tx=>{const d=(await tx.get(doc.ref)).data();if(d?.status==='processing'&&d.leaseUntil<=now)tx.update(doc.ref,{status:'queued'});});
  const queued=await db.collection(JOBS).where('status','==','queued').get();
  const candidates=queued.docs.filter(d=>d.data().provider===provider&&(d.data().nextAttemptAt||0)<=now).sort((a,b)=>(a.data().nextAttemptAt||a.data().createdAt||0)-(b.data().nextAttemptAt||b.data().createdAt||0));
  const job=candidates[0];if(!job)return {processed:0};
  const lease=`${now}-${Math.random().toString(36).slice(2)}`;
  const lock=db.collection('device-sync-worker-locks').doc(`${provider}_${job.data().userId}`);
  const claimed=await db.runTransaction(async tx=>{const d=(await tx.get(job.ref)).data();const held=(await tx.get(lock)).data();if(held?.leaseUntil>now)return false;if(d?.status!=='queued'||(d.nextAttemptAt||0)>now)return false;tx.set(lock,{lease,leaseUntil:now+180000});tx.update(job.ref,{status:'processing',lease,leaseUntil:now+180000,attempts:(d.attempts||0)+1});return true;});
  if(!claimed)return {processed:0};
  const data=job.data();let outcome;
  try{
    const ref=db.collection(connectionCollection).doc(data.connectionId||data.userId);
    const doc=await ref.get(),connection=doc.data();
    if(!connection||connection.status!=='connected'||connection.userId!==data.userId||!acceptConnection(connection)){outcome={status:'cancelled',nextAttemptAt:now+86400000};}
    else {const result=await sync({firestore:db,connectionRef:ref,connection,dateKey:data.requestedDateKey,timezone:resolveTimeZone(data.timezone||connection.lastSyncTimezone||connection.timezone||'UTC')});const snapshot=await db.collection('health-context-snapshots').doc(`${data.userId}_daily_${data.requestedDateKey}`).get();const saved=snapshot.data();const exact=saved?.athleteUserId===data.userId&&saved?.snapshotDateKey===data.requestedDateKey;const imported=result.status==='synced'&&Array.isArray(result.sourceRecordIds)&&result.sourceRecordIds.length>0&&exact&&result.projectedRequestedSnapshot!==false;outcome={status:imported?'complete':'queued',resultStatus:imported?'verified':'waiting_for_data',nextAttemptAt:now+(imported?6*3600000:3600000),lastCheckedAt:Date.now(),...(imported?{lastCompletedAt:Date.now()}:{})};}
  }catch{outcome={status:'queued',lastErrorCode:'DEVICE_BACKGROUND_SYNC_FAILED',nextAttemptAt:now+Math.min(6*3600000,60000*2**Math.min(data.attempts||0,8))};}
  await db.runTransaction(async tx=>{const d=(await tx.get(job.ref)).data();const held=(await tx.get(lock)).data();if(d?.lease===lease)tx.update(job.ref,{...outcome,leaseUntil:0});if(held?.lease===lease)tx.set(lock,{leaseUntil:0});});
  return {processed:1,status:outcome.status};
}
module.exports={run,dateKeys,planDateWindow,shouldQueue};
