const {test}=require('node:test');const assert=require('node:assert/strict');
const {loadPublicOfferings}=require('../../../src/lib/profiles/publicOfferings.ts');
const {loadPublicWorkoutCount}=require('../../../src/lib/profiles/publicWorkoutCounts.ts');
function db(data,closed=false){return {collection(name){return {doc(){return {get:async()=>({exists:name==='account-closure-jobs'?closed:!!data,data:()=>data})}}}}};}
test('public coach offerings expose only intentional valid published fields',async()=>{
 const data={activeCoachAccount:true,services:[{title:'Session',description:'Coaching session',priceCents:5000,email:'private',intake:'private'},{title:'Draft',priceCents:2,published:false},{title:'Private',priceCents:2,private:true},{title:'Bad',priceCents:-1}]};
 assert.deepEqual(await loadPublicOfferings(db(data),'coach'),{id:'coach',services:[{title:'Session',description:'Coaching session',priceCents:5000}]});
 assert.deepEqual((await loadPublicOfferings(db({...data,activeCoachAccount:false}),'coach')).services,[]);
 assert.equal(await loadPublicOfferings(db(data,true),'coach'),null);
});
test('published count is isolated and unknown never invented as zero',async()=>{
 assert.deepEqual(await loadPublicWorkoutCount(db({workoutCount:12,email:'private'}),'a'),{id:'a',workoutCount:12});
 assert.equal((await loadPublicWorkoutCount(db({}),'a')).workoutCount,null);
 assert.equal((await loadPublicWorkoutCount(db({workoutCount:-1}),'a')).workoutCount,null);
 assert.equal((await loadPublicWorkoutCount(db({workoutCount:0}),'a')).workoutCount,0);
 assert.equal(await loadPublicWorkoutCount(db({workoutCount:12},true),'a'),null);
});
test('challenge join no longer copies private location or notification token',()=>{
 const fs=require('node:fs');const source=fs.readFileSync('src/api/firebase/workout/service.ts','utf8').split('  async joinChallenge(')[1].split('  async ')[0];
 assert.match(source,/userService.getUserByUsername/);assert.doesNotMatch(source,/fcmToken:|location:|collection\(db, 'users'\)/);
});
test('server challenge join also omits private identity mirrors',()=>{
 const source=require('node:fs').readFileSync('netlify/functions/join-challenge.js','utf8');
 assert.doesNotMatch(source,/fcmToken:\s*userData|location:\s*userData/);
});
