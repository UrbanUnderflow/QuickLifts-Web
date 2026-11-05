// Operational text content follows account closure and the existing organization
// purge window. Consent events and shared STOP suppressions remain review evidence.
const ROOT = 'pulsecheck-restricted-questionnaire-submissions/coach-communications-v1';
const validId = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);
const collection = (db, name) => db.collection(`${ROOT}/${name}`);
const teamCollection = (db, teamId, name) => collection(db, `teams/${teamId}/${name}`);
async function removePage(db, query, belongs, limit) {
  const page = await query.limit(limit).get();
  if (page.empty) return false;
  await db.runTransaction(async tx => {
    const current = await Promise.all(page.docs.map(doc => tx.get(doc.ref)));
    for (const doc of current) if (doc.exists && belongs(doc.data())) tx.delete(doc.ref);
  });
  return true;
}
async function removeIntents(db, teamId, batchId, limit) {
  return removePage(db, teamCollection(db, teamId, 'send-intents').where('batchId','==',batchId), d => d.batchId === batchId, limit);
}
// Pending identities are operational metadata, not consent evidence. Remove each
// phone-index binding in the same transaction so a deleted row cannot strand it.
async function erasePendingAthletes({db,field,value,limit=25,organizationId}) {
  const page=await collection(db,'pending-athletes').where(field,'==',value).limit(limit).get();
  if(page.empty)return false;
  for(const candidate of page.docs)await db.runTransaction(async tx=>{
    const current=await tx.get(candidate.ref),data=current.data();if(!data||data[field]!==value)return;
    if(organizationId){
      const [org,team]=await Promise.all([tx.get(db.collection('pulsecheck-organizations').doc(organizationId)),tx.get(db.collection('pulsecheck-teams').doc(value))]);
      if(org.data()?.lifecycleState!=='purging'||team.data()?.organizationId!==organizationId)throw new Error('Pending roster purge scope changed.');
    }
    const indexRef=collection(db,'pending-phone-index').doc(data.phoneHash),index=await tx.get(indexRef);
    tx.delete(current.ref);
    if(index.exists){const ids=(index.data().recordIds||[]).filter(id=>id!==current.id);if(ids.length)tx.set(indexRef,{recordIds:ids});else tx.delete(indexRef);}
  });
  return true;
}
// Returns after one bounded page. The durable closure job retries until drained;
// no deletion cursor skips newly found records or a partially erased group.
async function eraseAccountCommunicationBatch({db,uid,limit=50}) {
  if (!validId(uid)) throw new Error('Invalid communication closure identity.');
  limit = Math.max(1, Math.min(50, Math.floor(limit) || 50));
  for(const field of ['expectedUserId','claimedUserId'])if(await erasePendingAthletes({db,field,value:uid,limit}))return {pending:true};
  const contacts = await collection(db,'contacts').where('athleteId','==',uid).limit(1).get();
  if (!contacts.empty) {
    const contact = contacts.docs[0], teamId = contact.data().teamId;
    if (!validId(teamId)) throw new Error('Communication contact requires retention review.');
    if (await removePage(db,teamCollection(db,teamId,'messages').where('athleteId','==',uid), d=>d.athleteId===uid,limit)) return {pending:true};
    const batches = await teamCollection(db,teamId,'batches').where('athleteIds','array-contains',uid).limit(1).get();
    if (!batches.empty) {
      const batch = batches.docs[0];
      if (await removeIntents(db,teamId,batch.id,limit)) return {pending:true};
      await db.runTransaction(async tx => {
        const current = await tx.get(batch.ref), data = current.data();
        if (!data?.athleteIds?.includes(uid)) return;
        // Preserve other recipients' delivery history; erase the closing athlete's
        // identifiers and the fingerprint derived from the original recipient list.
        const jobs = await Promise.all(Object.keys(data.states || {}).map(id=>tx.get(collection(db,'jobs').doc(id))));
        const states = {...data.states};
        for (const job of jobs) if (job.data()?.athleteId===uid) delete states[job.id];
        const {fingerprint,...rest} = data;
        tx.set(batch.ref,{...rest,athleteIds:data.athleteIds.filter(id=>id!==uid),states,privacyRedacted:true});
      });
      return {pending:true};
    }
    await db.runTransaction(async tx => {const current=await tx.get(contact.ref);if(current.data()?.athleteId===uid)tx.delete(contact.ref);});
    return {pending:true};
  }
  if (await removePage(db,collection(db,'routes').where('athleteId','==',uid),d=>d.athleteId===uid,limit)) return {pending:true};
  for (const field of ['athleteId','uid']) {
    const jobs = await collection(db,'jobs').where(field,'==',uid).limit(1).get();
    if (jobs.empty) continue;
    const job = jobs.docs[0], data = job.data();
    if (!validId(data.teamId) || !validId(data.batchId)) throw new Error('Communication job requires retention review.');
    if (await removeIntents(db,data.teamId,data.batchId,limit)) return {pending:true};
    const batchRef=teamCollection(db,data.teamId,'batches').doc(data.batchId);
    const messageRef=teamCollection(db,data.teamId,'messages').doc(job.id);
    await db.runTransaction(async tx => {
      const [current,batch,message] = await Promise.all([tx.get(job.ref),tx.get(batchRef),tx.get(messageRef)]);
      const d=current.data(); if(!d || d[field]!==uid || d.teamId!==data.teamId || d.batchId!==data.batchId)return;
      tx.delete(job.ref); // Includes queued work: deleted jobs cannot be claimed.
      if(message.exists && (message.data().athleteId===uid || message.data().senderId===uid))tx.delete(messageRef);
      if(batch.exists){
        const b=batch.data();
        if(b.uid===uid)tx.delete(batchRef);
        else {const {fingerprint,...rest}=b;const states={...b.states};delete states[job.id];tx.set(batchRef,{...rest,athleteIds:(b.athleteIds||[]).filter(id=>id!==uid),states,privacyRedacted:true});}
      }
    });
    return {pending:true};
  }
  return {pending:false};
}
module.exports={ROOT,collection,teamCollection,eraseAccountCommunicationBatch,erasePendingAthletes};
