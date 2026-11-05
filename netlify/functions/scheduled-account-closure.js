const { schedule }=require('@netlify/functions');
const { getFirebaseAdminApp }=require('./config/firebase');
const {processCommunicationDeletions}=require('./lib/communication-admin-deletion');
const { runClosureJob,JOBS }=require('./lib/account-closure');
exports.handler=schedule('*/5 * * * *',async()=>{
  const app=getFirebaseAdminApp();const db=app.firestore();
  // Run the bounded SMS page first so broad closure work cannot starve it.
  const communicationCleanup=await processCommunicationDeletions({db,auth:app.auth()}).catch(()=>({processed:0,failed:1}));
  const jobs=await db.collection(JOBS).where('status','in',['queued','retry','processing']).limit(10).get();
  let completed=0,failed=0;
  for(const job of jobs.docs){try{await runClosureJob({db,auth:app.auth(),storage:app.storage().bucket(app.options.storageBucket || `${app.options.projectId}.appspot.com`),uid:job.id,now:new Date()});completed++;}catch{failed++;}}
  return {statusCode:200,body:JSON.stringify({processed:completed,failed,communicationCleanup})};
});
