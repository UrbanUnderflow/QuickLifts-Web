const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
function fixture(provider) {
  const state = {connected:true,closed:false,writes:[],ordinaryBatches:0};
  const db = {
    collection(name) {
      const query = {where(){return this;},limit(){return this;},async get(){return {empty:!state.connected,docs:state.connected?[{id:provider==='polar'?'athlete':'athlete_google_health',ref:{path:'connection'},data:()=>({userId:'athlete',provider:'google_health'})}]:[]};},doc(id){return {path:`${name}/${id}`,get:async()=>({exists:name==='account-closure-jobs'&&state.closed})};}};
      return query;
    },
    batch(){state.ordinaryBatches++;throw new Error('Unguarded persistence forbidden');},
    async runTransaction(fn){const pending=[];await fn({get:ref=>ref.get(),set:(ref,data)=>pending.push([ref.path,data])});state.writes.push(...pending);},
  };
  const firestore=()=>db;firestore.FieldValue={serverTimestamp:()=>1};
  for(const [module,exports] of [['config/firebase',{initializeFirebaseAdmin(){},admin:{firestore}}],[`${provider}-utils`,{RESPONSE_HEADERS:{}}]]) {
    const filename=require.resolve(`../${module}`);require.cache[filename]={id:filename,filename,loaded:true,exports};
  }
  const filename=require.resolve(`../${provider}-webhook`);delete require.cache[filename];
  const handler=require(filename).handler;
  const event={httpMethod:'POST',headers:{'x-polar-webhook-secret':'synthetic','authorization':'Bearer synthetic'},body:JSON.stringify(provider==='polar'?{event:'EXERCISE',user_id:'external-sensitive',member_id:'athlete',health:'sensitive'}:{data:{healthUserId:'external-sensitive',dataType:'steps'}})};
  return {state,request:()=>handler(event)};
}
for(const provider of ['polar','google-health']) {
 test(`${provider} removed connection accepts without retaining external payload or queue`,async()=>{
  process.env.POLAR_WEBHOOK_SECRET='synthetic';process.env.GOOGLE_HEALTH_WEBHOOK_AUTHORIZATION='Bearer synthetic';delete process.env.GOOGLE_HEALTH_WEBHOOK_REQUIRE_SIGNATURE;
  const f=fixture(provider);f.state.connected=false;
  const response=await f.request();assert.equal(response.statusCode,202);assert.deepEqual(f.state.writes,[]);assert.equal(f.state.ordinaryBatches,0);assert.doesNotMatch(response.body,/external-sensitive|athlete|sensitive/);
 });
 test(`${provider} live connection queues but subsequent removal does not recreate data`,async()=>{
  const f=fixture(provider);const first=await f.request();assert.ok([200,204].includes(first.statusCode));assert.equal(f.state.writes.length,3);
  f.state.connected=false;f.state.writes=[];assert.equal((await f.request()).statusCode,202);assert.deepEqual(f.state.writes,[]);
 });
 test(`${provider} closure tombstone wins after connection lookup`,async()=>{
  const f=fixture(provider);f.state.closed=true;const response=await f.request();assert.equal(response.statusCode,202);assert.deepEqual(f.state.writes,[]);
 });
}

test('Polar scalar event remains the full event, while object envelopes are unpacked',()=>{
 const {extractEvents}=require('../polar-webhook').__test;
 const event={event:'EXERCISE',user_id:123};
 assert.deepEqual(extractEvents(event),[event]);
 assert.deepEqual(extractEvents({events:[event]}),[event]);
 assert.deepEqual(extractEvents({event}),[event]);
});
