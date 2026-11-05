// Separate from account-closure-jobs: this job must NEVER delete/disable Auth or
// expand legacy admin deletion into a full account-closure operation.
const { collection, eraseAccountCommunicationBatch } = require('./communication-retention');
const jobs = db => collection(db, 'admin-deletions');
async function stageCommunicationDeletion({db,uid,now=Date.now()}) {
  const ref=jobs(db).doc(uid);
  await db.runTransaction(async tx=>{
    const current=await tx.get(ref);
    if(current.exists) return; // Never downgrade a prior completion or confirmation.
    tx.create(ref,{uid,status:'pending',createdAtMs:now});
  });
}
async function confirmCommunicationDeletion({db,uid}) {
  const ref=jobs(db).doc(uid);
  await db.runTransaction(async tx=>{
    const current=await tx.get(ref);
    if(current.data()?.status==='completed')return;
    tx.set(ref,{uid,status:'confirmed'},{merge:true});
  });
}
async function processCommunicationDeletion({db,auth,uid,now=Date.now()}) {
  const ref=jobs(db).doc(uid),snapshot=await ref.get();
  if(!snapshot.exists || snapshot.data().status==='completed') return {pending:false};
  try {
    await auth.getUser(uid);
    // Auth still exists, including when legacy deletion failed. Preserve ALL
    // records. Do not turn an HTTP500 into a later background account deletion.
    return {pending:true,reason:'auth_still_exists'};
  } catch(error) { if(error.code!=='auth/user-not-found') throw error; }
  const result=await eraseAccountCommunicationBatch({db,uid});
  if(!result.pending) await ref.set({status:'completed',completedAtMs:now},{merge:true});
  return result;
}
async function processCommunicationDeletions({db,auth,limit=5,now=Date.now()}) {
  const cursor=collection(db,'maintenance').doc('admin-deletion-scan');
  const prior=(await cursor.get()).data()?.lastId;
  let query=jobs(db).where('status','in',['pending','confirmed']).orderBy('__name__').limit(Math.max(1,Math.min(limit,5)));
  if(prior) query=query.startAfter(prior);
  const page=await query.get();let processed=0,failed=0;
  for(const doc of page.docs) {
    try {await processCommunicationDeletion({db,auth,uid:doc.id,now});processed++;}catch{failed++;}
  }
  // Rotate past failures/existing accounts so neither can starve later jobs.
  await cursor.set({lastId:page.empty?null:page.docs[page.docs.length-1].id});
  return {processed,failed};
}
module.exports={stageCommunicationDeletion,confirmCommunicationDeletion,processCommunicationDeletion,processCommunicationDeletions};
