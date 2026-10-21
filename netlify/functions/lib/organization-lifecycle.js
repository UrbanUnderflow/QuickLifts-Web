const { randomUUID } = require('node:crypto');
const ORGANIZATIONS = 'pulsecheck-organizations';
const RETENTION_MS = 90 * 24 * 60 * 60 * 1000;
const LEASE_MS = 120000;
const RETENTION_MANIFEST = { removed: ['organization and team configuration', 'invitation and activation links, native handoffs and invitation outbox', 'coach report configuration and snapshots'], retained: ['personal accounts and athlete history', 'membership and consent evidence', 'pilot definitions, cohorts and research enrollment evidence', 'clinical and incident records', 'minimal organization and team tombstones'] };
const validId = id => typeof id === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(id);
const isUnavailable = org => !org || ['deleted','purging','purged'].includes(org.lifecycleState) || ['decommissioned','deleted'].includes(org.status);
async function changeOrganizationLifecycle({ db, organizationId, action, confirmationName, actorUid, now = Date.now() }) {
  if (!validId(organizationId) || !validId(actorUid) || !Number.isFinite(now) || !['delete','restore'].includes(action)) throw new Error('Valid organization and action required.');
  const ref = db.collection(ORGANIZATIONS).doc(organizationId);
  return db.runTransaction(async tx => {
    const [snap, closure] = await Promise.all([tx.get(ref), tx.get(db.collection('account-closure-jobs').doc(actorUid))]);
    if (closure.exists) throw new Error('Account access is unavailable.');
    if (!snap.exists) throw new Error('Organization not found.');
    const data = snap.data();
    if (action === 'delete') {
      if (isUnavailable(data)) throw new Error('Organization is already decommissioned.');
      const name = data.displayName || data.name || organizationId;
      if (confirmationName !== name) throw new Error('Enter the exact organization name to delete it.');
      const patch = { status: 'decommissioned', lifecycleState: 'deleted', deletedAt: now, purgeAfter: now + RETENTION_MS, previousStatus: data.status ?? null, deletedBy: actorUid, updatedAt: now };
      tx.update(ref, patch);
      return { organizationId, ...patch };
    }
    if (data.lifecycleState !== 'deleted' || !Number.isFinite(data.purgeAfter) || now >= data.purgeAfter) throw new Error('The restoration window has ended.');
    // Replace the document to remove lifecycle markers without relying on SDK sentinels.
    const restored = { ...data, status: data.previousStatus ?? null, restoredAt: now, restoredBy: actorUid, updatedAt: now };
    if (data.previousStatus == null) delete restored.status;
    for (const key of ['lifecycleState','deletedAt','purgeAfter','previousStatus','deletedBy']) delete restored[key];
    tx.set(ref, restored);
    return { organizationId, status: restored.status };
  });
}
async function listDeletedOrganizations(db, now = Date.now()) {
  const result = await db.collection(ORGANIZATIONS).where('lifecycleState','in',['deleted','purging']).get();
  return result.docs.map(doc => { const d = doc.data(); return { id:doc.id, displayName:d.displayName || d.name || doc.id, deletedAt:d.deletedAt, purgeAfter:d.purgeAfter, status:d.lifecycleState, canRestore:d.lifecycleState === 'deleted' && now < d.purgeAfter }; });
}
// Each invocation deletes at most one bounded page. The team remains until its child
// operational collections are drained; retained membership consent evidence is untouched.
async function purgeOrganizationBatch({ db, organizationId, now = Date.now(), batchSize = 100 }) {
  if (!validId(organizationId) || !Number.isFinite(now)) throw new Error('Invalid organization id.');
  batchSize = Number.isFinite(batchSize) ? Math.max(1, Math.min(100, Math.floor(batchSize))) : 100;
  const ref = db.collection(ORGANIZATIONS).doc(organizationId), job = ref.collection('lifecycle-jobs').doc('purge'), leaseId = randomUUID();
  const acquired = await db.runTransaction(async tx => {
    const [org, state] = await Promise.all([tx.get(ref),tx.get(job)]); const d = org.data();
    if (!org.exists || !['deleted','purging'].includes(d.lifecycleState) || !Number.isFinite(d.purgeAfter) || now < d.purgeAfter || (state.data()?.leaseUntil || 0) > now) return false;
    tx.update(ref, { status:'decommissioned', lifecycleState:'purging' });
    tx.set(job,{ leaseId, leaseUntil:now+LEASE_MS, updatedAt:now },{merge:true}); return true;
  });
  if (!acquired) return { processed:false };
  const commit = async (documents, scopeTeamRef, complete = false) => db.runTransaction(async tx => {
    const [state,org] = await Promise.all([tx.get(job),tx.get(ref)]);
    if (state.data()?.leaseId !== leaseId || org.data()?.lifecycleState !== 'purging') throw new Error('Purge lease changed.');
    if (scopeTeamRef) { const team = await tx.get(scopeTeamRef); if (team.data()?.organizationId !== organizationId) throw new Error('Team ownership changed.'); }
    // Re-read every target in the transaction: a stale query must never delete
    // a record that was reassigned before this batch committed.
    const currentDocuments = await Promise.all(documents.map(doc => tx.get(doc.ref)));
    const expectedTeamId = scopeTeamRef ? scopeTeamRef.path.split('/').pop() : null;
    for (const doc of currentDocuments) {
      const data = doc.data();
      if (doc.exists && (expectedTeamId ? data.teamId === expectedTeamId : data.organizationId === organizationId)) tx.delete(doc.ref);
    }
    if (complete) tx.set(ref,{ status:'deleted', lifecycleState:'purged', purgedAt:now, deletedAt:org.data().deletedAt, retentionDeadline:org.data().purgeAfter, retentionManifest:RETENTION_MANIFEST });
    tx.set(job,{leaseId:null,leaseUntil:0,updatedAt:now,status:complete?'completed':'pending'},{merge:true});
    return {processed:true,deleted:documents.length,completed:complete};
  });
  try {
    const operational = ['pulsecheck-invite-links','adminActivationInvites','pulsecheck-native-athlete-invite-handoffs','pulsecheck-invite-accepted-outbox'];
    for (const collection of operational) {
      const links = await db.collection(collection).where('organizationId','==',organizationId).limit(batchSize).get();
      if (!links.empty) return await commit(links.docs);
    }
    // Keep tombstones out of this scan by querying original organization ownership
    // plus using a cursor persisted only after each team is completely processed.
    const state = (await job.get()).data();
    let query = db.collection('pulsecheck-teams').where('organizationId','==',organizationId).orderBy('__name__').limit(1);
    if (state?.lastTeamId) query = query.startAfter(state.lastTeamId);
    const teams = await query.get();
    if (teams.empty) return await commit([],null,true);
    const team = teams.docs[0];
    const scopes = [...operational.map(name=>db.collection(name)), db.collection('coach-team-insight-reports').doc('delivery').collection('reports')];
    for (const scope of scopes) { const docs=await scope.where('teamId','==',team.id).limit(batchSize).get(); if(!docs.empty) return await commit(docs.docs,team.ref); }
    const config=await db.collection('coach-team-insight-reports').doc('delivery').collection('configs').doc(team.id).get();
    // Team tombstone and cursor must commit together, otherwise retries can skip work.
    return await db.runTransaction(async tx => {
      const [s,o,t]=await Promise.all([tx.get(job),tx.get(ref),tx.get(team.ref)]);
      if(s.data()?.leaseId!==leaseId || o.data()?.lifecycleState!=='purging') throw new Error('Purge lease changed.');
      if(t.data()?.organizationId !== organizationId) throw new Error('Team ownership changed.');
      if(config.exists) tx.delete(config.ref);
      tx.set(team.ref,{organizationId,status:'deleted',lifecycleState:'purged',purgedAt:now});
      tx.set(job,{lastTeamId:team.id,leaseId:null,leaseUntil:0,updatedAt:now,status:'pending'},{merge:true});
      return {processed:true,completed:false,teamId:team.id};
    });
  } catch (error) {
    await db.runTransaction(async tx => {const s=await tx.get(job);if(s.data()?.leaseId===leaseId)tx.set(job,{leaseId:null,leaseUntil:0,status:'retry',updatedAt:now},{merge:true});});
    throw error;
  }
}
module.exports={RETENTION_MANIFEST,ORGANIZATIONS,RETENTION_MS,isUnavailable,changeOrganizationLifecycle,listDeletedOrganizations,purgeOrganizationBatch};
