const JOBS = 'account-closure-jobs';
// Evidence and shared clinical records are retained pending a documented disposition.
const RETAINED = ['pulsecheck-team-memberships (consent evidence)', 'pulsecheck-pilot-enrollments (research evidence)', 'clinical and incident records', 'provider-held records and backups'];
const QUERY_TARGETS = [
  ['conversations','userId'], ['mentalNotes','userId'], ['subscriptions','userId'],
  ['fitWithPulse-workoutSessions','userId'], ['mealLogs','userId'], ['userInteractions','userId'],
  ['workoutSummary','userId'], ['health-context-source-status','userId'],
  ['pulsecheck-nora-conversations','athleteId'], ['pulsecheck-daily-assignments','athleteId'],
  ['mental-exercise-assignments','athleteId'], ['health-context-snapshots','athleteId'],
  ['pulsecheck-push-installations','ownerUserId'],
  ['pulsecheck-oura-connections','userId'], ['pulsecheck-whoop-connections','userId'],
  ['pulsecheck-polar-connections','userId'], ['health-provider-connections','userId'],
  ['pulsecheck-oauth-states','userId'],
  ...['health-context-source-status','health-context-source-records','health-context-snapshots','health-context-snapshot-revisions','health-context-assembly-traces','health-context-jobs','pulsecheck-polar-webhook-events','google-health-webhook-events'].map(name=>[name,'athleteUserId']),
  // Append only: persisted job.step indexes must keep their original meaning.
  ['conversationSummaries','userId'], ['dailySentimentAnalysis','userId'],
  ['state-snapshots','athleteId'], ['conversation-derived-signal-events','athleteId'],
  ['pulsecheck-morning-checkins','athleteUserId'], ['mental-exercise-assignments','athleteUserId'],
  ['sim-assignments','athleteUserId'], ['pulsecheck-training-plans','athleteId'],
];
async function requestClosure({db,auth,uid,now}) {
  const ref = db.collection(JOBS).doc(uid);
  await db.runTransaction(async tx => {
    const prior = await tx.get(ref);
    if (prior.exists) return;
    tx.set(ref, {ownerUserId:uid,status:'queued',step:0,requestedAt:now,updatedAt:now,retentionReview:RETAINED});
    tx.set(db.collection('users').doc(uid), {accountClosureRequestedAt:now,accountStatus:'closing'}, {merge:true});
  });
  // A durable request already exists if auth revocation fails; the worker retries it.
  await auth.updateUser(uid,{disabled:true});
  await auth.revokeRefreshTokens(uid);
  return {accepted:true,jobId:uid,status:'queued',deleted:false,retentionReviewRequired:true};
}
async function runClosureJob({db,auth,storage,uid,now,maxPages=20}) {
  const ref=db.collection(JOBS).doc(uid);
  const snapshot=await ref.get(); if(!snapshot.exists)return;
  const job=snapshot.data(); if(job.status==='retention_review')return;
  try {
    try { await auth.updateUser(uid,{disabled:true}); await auth.revokeRefreshTokens(uid); }
    catch(error){if(error.code!=='auth/user-not-found')throw error;}
    // Revoke access without deleting append-only signer evidence.
    for(const collection of ['pulsecheck-team-memberships','pulsecheck-organization-memberships','pulsecheck-pilot-enrollments']) {
      const membership=await db.collection(collection).where('userId','==',uid).get();
      for(const doc of membership.docs) await doc.ref.set({status:'revoked',revokedAt:now,accountClosureRequestedAt:now}, {merge:true});
    }
    let step=job.step||0,pages=0;
    while(step<QUERY_TARGETS.length && pages++<maxPages){
      const [collection,field]=QUERY_TARGETS[step];
      const batch=await db.collection(collection).where(field,'==',uid).limit(100).get();
      for(const doc of batch.docs) await db.recursiveDelete(doc.ref);
      if(batch.empty)step++;
      await ref.set({step,status:'processing',updatedAt:now},{merge:true});
    }
    if(step<QUERY_TARGETS.length)return {pending:true,step};
    // User-owned subcollections are erased recursively, not just the profile document.
    for(const collection of ['pulsecheck-oura-connections','pulsecheck-whoop-connections','pulsecheck-polar-connections','users','athlete-mental-progress','mental-check-ins','user-mental-notes']) await db.recursiveDelete(db.collection(collection).doc(uid));
    await db.recursiveDelete(db.collection('health-provider-connections').doc(`${uid}_google_health`));
    await db.collection('users').doc(uid).set({accountClosureRequestedAt:job.requestedAt,accountStatus:'closed'});
    await db.recursiveDelete(db.collection('pulsecheck-private-users').doc(uid).collection('clay-self').doc('current'));
    if(storage) for(const prefix of [`profile-images/${uid}/`,`profile-avatars/${uid}/`,`pulsecheck-clay-self-private/${uid}/`,`pulsecheck-clay-self-inputs/${uid}/`]) await storage.deleteFiles({prefix,force:true});
    try {await auth.deleteUser(uid);}catch(error){if(error.code!=='auth/user-not-found')throw error;}
    await ref.set({status:'retention_review',coreClosureCompletedAt:now,updatedAt:now,retentionReview:RETAINED},{merge:true});
    return {coreClosed:true,retentionReviewRequired:true};
  } catch(error) {
    await ref.set({status:'retry',updatedAt:now,lastErrorCode:error.code||'closure_failed'},{merge:true});
    throw error;
  }
}
module.exports={requestClosure,runClosureJob,QUERY_TARGETS,RETAINED,JOBS};
