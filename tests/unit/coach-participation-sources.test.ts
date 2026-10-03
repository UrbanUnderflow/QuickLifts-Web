import test from 'node:test';
import assert from 'node:assert/strict';
import { coverageForDays, scheduledParticipationDates, participationTimestamp, loadCurrentLinearSkill, loadWearableParticipation } from '../../src/lib/coach-dashboard/participationSources';
const dates=['2026-09-28','2026-09-29','2026-09-30'];
test('daily schedule begins at activation or team join, whichever is later',()=>{
 assert.deepEqual(scheduledParticipationDates(dates,{activatedAt:'2026-09-28T10:00:00Z'},{grantedAt:'2026-09-29T08:00:00Z'}),dates.slice(1));
 assert.deepEqual(coverageForDays(new Set(['2026-09-28','2026-09-30']),dates.slice(1)),{completed:1,expected:2,rate:50,status:'available'});
 assert.equal(participationTimestamp(1790640000),1790640000000);
});
test('skill label follows pinned version even when latest issued skill belongs to prior pin',async()=>{
 const query:any={collection(){return this},doc(){return this},orderBy(){return this},limit(){return this},select(){return this},get:async()=>({docs:[{data:()=>({skillId:'old',versionId:'v1',skillName:'Stale skill',phase:'use_it'})}]})};
 const db:any={collection:()=>({doc:(section:string)=>section==='versions'?{collection:()=>({doc:()=>({get:async()=>({data:()=>({skills:[{id:'new',name:'New skill'}]})})})})}:query})};
 assert.deepEqual(await loadCurrentLinearSkill(db,'a',{athleteId:'a',optedIn:true,currentSkill:{skillId:'new',versionId:'v2'}}),{id:'new',name:'New skill',phase:null});
});
test('absent wearable evidence remains unavailable and explicit disconnect remains distinct',async()=>{
 const chain:any={collection(){return this},doc(){return this}};
 let calls=0;const db:any={collection:()=>chain,getAll:async()=>++calls===1?dates.map(()=>({data:()=>undefined})):[{data:()=>({sourceStatuses:{oura:{status:'disconnected'}}})}]};
 const result=await loadWearableParticipation(db,'a','t','o',dates);assert.equal(result.metric.status,'not_connected');assert.equal(result.metric.expected,null);
 calls=0;db.getAll=async()=>++calls===1?dates.map(()=>({data:()=>undefined})):[];
 assert.equal((await loadWearableParticipation(db,'a','t','o',dates)).metric.status,'unavailable');
});

test('retained measurements do not override disconnection or missing lifecycle',async()=>{
 const chain:any={collection(){return this},doc(){return this}};
 const sample={domains:{recovery:{sourceFamily:'oura',freshness:'fresh',data:{sleepDuration:8}}}};
 for(const status of ['revoked','disconnected',undefined]){
  let calls=0;const db:any={collection:()=>chain,getAll:async()=>++calls===1?dates.map(()=>({data:()=>sample})):[{data:()=>status?{sourceStatuses:{oura:{status}}}:undefined}]};
  const result=await loadWearableParticipation(db,'a','t','o',dates);assert.equal(result.days.size,0);assert.equal(result.metric.completed,0);assert.equal(result.metric.status,status?'not_connected':'unavailable');
 }
});

test('revoked source cannot count through an unrelated connected source',async()=>{
 const chain:any={collection(){return this},doc(){return this}};let calls=0;
 const db:any={collection:()=>chain,getAll:async()=>++calls===1?dates.map(()=>({data:()=>({domains:{recovery:{sourceFamily:'oura',freshness:'fresh',data:{sleepDuration:8}}}})})):[{data:()=>({sourceStatuses:{oura:{status:'revoked'},healthkit:{status:'connected'}}})}]};
 const result=await loadWearableParticipation(db,'a','t','o',dates);assert.equal(result.days.size,0);assert.equal(result.metric.status,'sync_pending');
});

test('currently connected matching source contributes measured days',async()=>{
 const chain:any={collection(){return this},doc(){return this}};let calls=0;
 const db:any={collection:()=>chain,getAll:async()=>++calls===1?dates.map(()=>({data:()=>({domains:{recovery:{sourceFamily:'oura',freshness:'fresh',data:{sleepDuration:8}}}})})):[{data:()=>({sourceStatuses:{oura:{status:'connected'}}})}]};
 const result=await loadWearableParticipation(db,'a','t','o',dates);assert.equal(result.days.size,3);assert.equal(result.metric.rate,100);
});
