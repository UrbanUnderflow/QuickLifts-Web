import test from 'node:test';
import assert from 'node:assert/strict';
import { dashboardAccess, visibleAthlete, activeRecord } from '../../src/lib/coach-dashboard/access';
import { aggregateCard, sharingAllows } from '../../src/lib/coach-dashboard/data';
import { TRAINER_SHARING_VERSION } from '../../src/lib/coach-dashboard/types';
import { createTeamDashboardHandler } from '../../src/pages/api/coach/team-dashboard';
const membership = { userId:'staff',teamId:'team',role:'coach',status:'active',staffCapabilities:['coaching'] };
test('coach and team admin cannot access trainer aggregates; trainer must be explicit',()=>{
 assert.equal(dashboardAccess(membership,'staff','team').wellbeing,false);
 assert.equal(dashboardAccess({...membership,staffCapabilities:['admin']},'staff','team').wellbeing,false);
 assert.equal(dashboardAccess({...membership,role:'performance-staff',staffCapabilities:undefined},'staff','team').wellbeing,false);
 assert.equal(dashboardAccess({...membership,staffCapabilities:['athletic_trainer']},'staff','team').wellbeing,true);
});
test('empty and invalid capability arrays deny; legacy absence allows participation only',()=>{
 assert.equal(dashboardAccess({...membership,staffCapabilities:[]},'staff','team').participation,false);
 assert.equal(dashboardAccess({...membership,staffCapabilities:['anything']},'staff','team').participation,false);
 const {staffCapabilities,...legacy}=membership;
 assert.deepEqual(dashboardAccess(legacy,'staff','team'),{participation:true,wellbeing:false,athlete:false});
});
test('team, owner, revoked status, athlete role and scoped roster cannot be bypassed',()=>{
 for(const m of [{...membership,status:'suspended'},{...membership,revokedAt:1},{...membership,role:'athlete'},{...membership,teamId:'other'},{...membership,userId:'other'}]) assert.equal(dashboardAccess(m,'staff','team').participation,false);
 assert.equal(activeRecord({...membership,removedAt:1}),false);
 assert.equal(visibleAthlete({rosterVisibilityScope:'assigned',allowedAthleteIds:['a']},'b'),false);
 assert.equal(visibleAthlete({rosterVisibilityScope:'none'},'a'),false);
});
test('sharing grants require exact team, owner, current disclosure and affirmative per-category choice',()=>{
 const grant={athleteId:'a',teamId:'t',version:TRAINER_SHARING_VERSION,choices:{mood:true}};
 assert.equal(sharingAllows(grant,'a','t','mood'),true);
 for(const g of [undefined,{...grant,teamId:'x'},{...grant,athleteId:'x'},{...grant,version:'old'},{...grant,choices:{mood:false}}]) assert.equal(sharingAllows(g,'a','t','mood'),false);
 assert.equal(sharingAllows(grant,'a','t','journaling'),false);
});
test('aggregate suppresses small cohorts and each sparsely populated field independently',()=>{
 const small=aggregateCard([{Mood:1},{Mood:5}],10,'check-ins','now',{Mood:'/5'});
 assert.equal(small.contributors,0);assert.deepEqual(small.values,[]);
 const full=aggregateCard([{Mood:1,Energy:1},{Mood:2},{Mood:3},{Mood:4},{Mood:5}],10,'check-ins','now',{Mood:'/5',Energy:'/5'});
 assert.deepEqual(full.values,[{label:'Mood',value:3,unit:'/5'}]);
});
test('HTTP rejects unauthenticated calls before loading data',async()=>{
 let loaded=false;let status=0;const res:any={setHeader(){},status(n:number){status=n;return this;},json(){return this;}};
 await createTeamDashboardHandler({authorize:async()=>{throw Error('no');},load:async()=>{loaded=true;return {} as any;}})({method:'GET',query:{teamId:'team',view:'wellbeing'}} as any,res);
 assert.equal(status,401);assert.equal(loaded,false);
});
import { createTrainerSharingHandler } from '../../src/pages/api/coach/trainer-sharing';
import { loadDashboard } from '../../src/lib/coach-dashboard/data';
function fakeDb(records:Record<string,any>) { const writes:any[]=[];let privateQueries=0;const db:any={collection(name:string){return {doc(id:string){return {async get(){const value=records[`${name}/${id}`];return {exists:!!value,data:()=>value};},async set(value:any){writes.push({path:`${name}/${id}`,value});}};},where(){privateQueries++;throw Error('Unexpected private query');}};}};return {db,writes,get privateQueries(){return privateQueries;}}; }
const recordsFor=(member:any)=>({'pulsecheck-teams/team':{status:'active',organizationId:'org'},'pulsecheck-organizations/org':{status:'active'},'pulsecheck-team-memberships/team_staff':{...member,organizationId:'org'}});
const response=()=>({code:0,payload:null as any,setHeader(){},status(n:number){this.code=n;return this;},json(value:any){this.payload=value;return this;}});
test('server wellbeing denies coach/admin before querying athlete data',async()=>{
 for(const staffCapabilities of [['coaching'],['admin'],[],['anything']]){
  const f=fakeDb(recordsFor({...membership,staffCapabilities}));
  await assert.rejects(loadDashboard(f.db,'staff','team','wellbeing'),(e:any)=>e.status===403);
  assert.equal(f.privateQueries,0);
 }
});
test('sharing endpoint binds consent and revocation to authenticated athlete',async()=>{
 const f=fakeDb(recordsFor({...membership,role:'athlete',staffCapabilities:[]}));const choices={mood:false,recovery:true,wearables:false,journaling:false};const res=response();
 await createTrainerSharingHandler({authorize:async()=>({uid:'staff',db:f.db})})({method:'POST',body:{teamId:'team',athleteId:'victim',version:TRAINER_SHARING_VERSION,choices}} as any,res as any);
 assert.equal(res.code,200);assert.equal(f.writes[0].path,'pulsecheck-trainer-sharing/team_staff');assert.equal(f.writes[0].value.athleteId,'staff');assert.deepEqual(f.writes[0].value.choices,choices);
});
test('staff cannot grant athlete consent, and wrong team or old disclosure fails',async()=>{
 for(const body of [{teamId:'team',version:TRAINER_SHARING_VERSION,choices:{mood:true,recovery:true,wearables:true,journaling:true}},{teamId:'other',version:TRAINER_SHARING_VERSION,choices:{mood:true,recovery:true,wearables:true,journaling:true}},{teamId:'team',version:'old',choices:{mood:true,recovery:true,wearables:true,journaling:true}}]){
  const f=fakeDb(recordsFor(membership));const res=response();await createTrainerSharingHandler({authorize:async()=>({uid:'staff',db:f.db})})({method:'POST',body} as any,res as any);assert.ok([400,403].includes(res.code));assert.equal(f.writes.length,0);
 }
});
