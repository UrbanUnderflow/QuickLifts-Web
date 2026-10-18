const {test}=require('node:test');
const assert=require('node:assert/strict');
const {publicProfile,loadPublicProfile}=require('../../../src/lib/profiles/publicProjection.ts');
const {createPublicProfileHandler}=require('../../../src/pages/api/profiles/public.ts');
const secret={displayName:'Athlete',username:'athlete',bio:'Public bio',profileImage:{profileImageURL:'photo',secret:'hidden'},email:'secret',birthdate:123,fcmToken:'token',mentalPerformanceGoals:['secret'],clinical:'secret'};
for(const caller of ['owner','staff','stranger','anonymous']) test(`${caller} receives identical allowlisted public identity`,async()=>{
  let output,status;
  const handler=createPublicProfileHandler(async()=>publicProfile('athlete',secret),async()=>({}));
  await handler({method:'GET',query:{userId:'athlete'},headers:caller==='anonymous'?{}:{authorization:`Bearer ${caller}`}},{setHeader(){},status(s){status=s;return this;},json(v){output=v;}});
  assert.equal(status,200);assert.deepEqual(output.profile,{id:'athlete',displayName:'Athlete',username:'athlete',bio:'Public bio',profileImage:{profileImageURL:'photo'}});
});
test('closure tombstone hides profile without reading personal record',async()=>{
 const db={collection(name){assert.equal(name,'account-closure-jobs');return {doc(){return {get:async()=>({exists:true})}}}}};
 assert.equal(await loadPublicProfile(db,'athlete'),null);
});
test('batch is bounded and invalid environment rejected',async()=>{
 for(const req of [{method:'POST',body:{userIds:Array(31).fill('a')},query:{},headers:{}},{method:'GET',query:{userId:'a'},headers:{'x-pulsecheck-firebase-mode':'bad'}}]){
 let status;await createPublicProfileHandler(()=>{throw Error('must not load')}) (req,{setHeader(){},status(s){status=s;return this},json(){}});assert.equal(status,400);
 }
});
test('batch returns only found public profiles and never private fields',async()=>{
 let output;
 await createPublicProfileHandler(async(_db,id)=>id==='missing'?null:publicProfile(id,secret),async()=>({}))({method:'POST',body:{userIds:['a','missing']},query:{},headers:{}},{setHeader(){},status(s){assert.equal(s,200);return this},json(v){output=v;}});
 assert.equal(output.profiles.length,1);assert.equal(output.profiles[0].id,'a');assert.equal(JSON.stringify(output).includes('secret'),false);
});
test('loader reads only requested profile and filters root secrets',async()=>{
 const db={collection(name){return {doc(id){assert.equal(id,'a');return {get:async()=>name==='account-closure-jobs'?{exists:false}:{exists:true,data:()=>secret}}}}}};
 assert.deepEqual(await loadPublicProfile(db,'a'),publicProfile('a',secret));
});
