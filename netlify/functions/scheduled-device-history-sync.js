const {schedule}=require('@netlify/functions');
const {initializeFirebaseAdmin,admin}=require('./config/firebase');
const {run}=require('./utils/deviceBackgroundSync');
const whoop=require('./whoop-sync');
const polar=require('./polar-sync');
const google=require('./google-health-sync');
const oura=require('./oura-sync');
const adapters=[
 {provider:'whoop',connectionCollection:'pulsecheck-whoop-connections',sync:whoop.syncWhoopForConnection},
 {provider:'polar',connectionCollection:'pulsecheck-polar-connections',sync:a=>polar.syncPolarSnapshotForConnection({...a,userId:a.connection.userId,requestedDateKey:a.dateKey})},
 {provider:'google_health',connectionCollection:'health-provider-connections',acceptConnection:c=>c.provider==='google_health',sync:a=>google.syncGoogleHealthSnapshotForConnection({...a,userId:a.connection.userId,requestedDateKey:a.dateKey})},
 {provider:'oura',connectionCollection:'pulsecheck-oura-connections',sync:async a=>{const r=await oura.syncOuraForUser({userId:a.connection.userId,body:{snapshotDateKey:a.dateKey,timezone:a.timezone}});if(r.statusCode!==200)throw Error('Oura sync failed');return JSON.parse(r.body);}},
];
exports.handler=schedule('* * * * *',async event=>{
 initializeFirebaseAdmin(event);
 // Each provider advances independently on every tick, including during outages elsewhere.
 const outcomes=await Promise.allSettled(adapters.map(async adapter=>({
   provider:adapter.provider,
   ...await run({db:admin.firestore(),resolveTimeZone:whoop.resolveTimeZone,...adapter}),
 })));
 const results=outcomes.map((outcome,index)=>outcome.status==='fulfilled'
   ? outcome.value : {provider:adapters[index].provider,processed:0,status:'worker_error'});
 console.log('[device-history-sync]',JSON.stringify(results));
 if(outcomes.some(outcome=>outcome.status==='rejected'))throw new Error('Device history worker needs retry');
 return {statusCode:200,body:JSON.stringify({results})};
});
exports.adapters=adapters;
