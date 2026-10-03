import test from 'node:test';
import assert from 'node:assert/strict';
import { buildInsightFacts,parseInsightAnalysis,consistencySpotlight } from '../../src/lib/coach-dashboard/insights';
import { createTeamInsightsHandler } from '../../src/pages/api/coach/team-insights';
import { DashboardAccessError } from '../../src/lib/coach-dashboard/access';
import type { TeamParticipation } from '../../src/lib/coach-dashboard/types';
const metric={completed:3,expected:4,rate:75,status:'available' as const};
const data:TeamParticipation={teamId:'team',asOf:'',from:'',to:'',canViewWellbeing:false,athletes:[],adherence:{checkIns:metric,skillTraining:metric,wearables:metric},daily:[],skills:[],limitations:[]};
test('coach facts preserve percent scale and exclude identities and responses',()=>{
 const facts=buildInsightFacts('coach',{...data,athletes:[{id:'secret',displayName:'Private name',avatarUrl:null,checkIns:metric,skillTraining:metric,wearables:metric,currentSkill:null}]} ,data);
 assert.equal(facts[0].current,75);assert.equal(facts[0].previous,75);assert.ok(!JSON.stringify(facts).includes('Private name'));
});
test('rejects fabricated references and missing evidence',()=>{
 const facts=buildInsightFacts('coach',data);
 assert.throws(()=>parseInsightAnalysis(JSON.stringify({takeaway:'Hi',insights:[{title:'T',meaning:'M',action:'A',evidenceIds:['privateMood']}]}),facts));
 assert.throws(()=>parseInsightAnalysis(JSON.stringify({takeaway:'Hi',insights:[]}),facts));
 assert.equal(parseInsightAnalysis(JSON.stringify({takeaway:'Hi',insights:[{title:'T',meaning:'M',action:'A',evidenceIds:['checkIns']}]}),facts).insights.length,1);
});
test('spotlight excludes zero opportunities and preserves ties',()=>{
 const athlete=(name:string)=>({id:name,displayName:name,avatarUrl:null,checkIns:metric,skillTraining:metric,wearables:metric,currentSkill:null});
 assert.equal(consistencySpotlight({...data,athletes:['A','B','C','D'].map(athlete)}).length,3);
 assert.ok(consistencySpotlight({...data,athletes:['A','B'].map(athlete)}).every(a=>a.rank===1));
});
function response(){const r:any={statusCode:200,setHeader(){},status(n:number){r.statusCode=n;return r;},json(body:any){r.body=body;return r;}};return r;}
test('trainer denial prevents model access',async()=>{
 let called=false;const handler=createTeamInsightsHandler({authorize:async()=>({uid:'u',db:{} as any}),load:async()=>{throw new DashboardAccessError(403,'Trainer required');},analyze:async()=>{called=true;return {} as any;}});const res=response();await handler({method:'POST',body:{teamId:'team',role:'trainer'}} as any,res);assert.equal(res.statusCode,403);assert.equal(called,false);
});
test('AI failure returns factual report and two separate week windows',async()=>{
 const dates:number[]=[];const handler=createTeamInsightsHandler({authorize:async()=>({uid:'u',db:{} as any}),load:async(_d,_u,_t,_v,now)=>{dates.push(now!);return data;},analyze:async()=>{throw Error('offline');}});const res=response();await handler({method:'POST',body:{teamId:'team',role:'coach'}} as any,res);assert.equal(res.body.mode,'data');assert.deepEqual(res.body.insights,[]);assert.equal(dates[0]-dates[1],7*86400000);
});
test('trainer facts suppress unavailable cohorts and never carry raw records',()=>{
 const hidden={status:'insufficient_responses' as const,contributors:0,eligible:8,source:'check-ins',asOf:'',values:[{label:'Hidden',value:2,unit:'/5'}]};
 const facts=buildInsightFacts('trainer',{teamId:'team',asOf:'',minimumContributors:5,mood:hidden,recovery:hidden,wearables:hidden,journaling:hidden});
 assert.ok(facts.every(f=>f.current===null&&f.previous===null));assert.ok(!JSON.stringify(facts).includes('Hidden'));
});
test('missing-data insight may cite an unavailable fact without inventing a measurement',()=>{
 const facts=[{id:'mood',label:'Mood',current:null,previous:null,unit:'',detail:'Insufficient contributors'}];
 assert.equal(parseInsightAnalysis(JSON.stringify({takeaway:'Mood data is unavailable.',insights:[{title:'Insufficient mood data',meaning:'There is no comparison available.',action:'Check whether athletes can access check-ins.',evidenceIds:['mood']}]}),facts).insights.length,1);
 assert.throws(()=>parseInsightAnalysis(JSON.stringify({takeaway:'Mood stable',insights:[{title:'Stable mood',meaning:'Mood remains stable.',action:'Review.',evidenceIds:['mood']}]}),facts));
});
