const { schedule }=require('@netlify/functions');
const { getFirebaseAdminApp }=require('./config/firebase');
const { runClosureJob,JOBS }=require('./lib/account-closure');
exports.handler=schedule('*/5 * * * *',async()=>{
  const app=getFirebaseAdminApp();const db=app.firestore();
  const jobs=await db.collection(JOBS).where('status','in',['queued','retry','processing']).limit(10).get();
  let completed=0,failed=0;
  for(const job of jobs.docs){try{await runClosureJob({db,auth:app.auth(),storage:app.storage().bucket(app.options.storageBucket || `${app.options.projectId}.appspot.com`),uid:job.id,now:new Date()});completed++;}catch{failed++;}}
  return {statusCode:200,body:JSON.stringify({processed:completed,failed})};
});
