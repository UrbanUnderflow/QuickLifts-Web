import type { firestore } from 'firebase-admin';
import { loadDashboard } from './data';
import { DashboardAccessError } from './access';
import { buildInsightFacts,buildFallbackReport,consistencySpotlight,groundedTakeaway,type InsightRole } from './insights';
import { analyze } from './insightAnalysis';
import { findInsightReport,saveInsightReport,insightFactsFingerprint } from './insightHistory';
import type { TeamParticipation } from './types';
const DAY=86400000;
export function latestReportEnd(now=Date.now()):string {
 const day=new Date(now);day.setUTCHours(0,0,0,0);
 day.setUTCDate(day.getUTCDate()-(day.getUTCDay()||7));
 return day.toISOString().slice(0,10);
}
export function reportWindow(to:string,now=Date.now()) {
 const end=Date.parse(`${to}T00:00:00Z`);
 if(!/^\d{4}-\d{2}-\d{2}$/.test(to)||!Number.isFinite(end)||new Date(end).toISOString().slice(0,10)!==to||new Date(end).getUTCDay()!==0||to>latestReportEnd(now))throw new DashboardAccessError(400,'Choose a completed weekly report.');
 return {from:new Date(end-6*DAY).toISOString().slice(0,10),to,asOf:end+DAY};
}
export async function generateWeeklyInsight(db:firestore.Firestore,uid:string,teamId:string,role:InsightRole,to=latestReportEnd(),deps:{load?:typeof loadDashboard;analyze?:typeof analyze;persist?:boolean}={}){
 const window=reportWindow(to),view=role==='trainer'?'wellbeing':'participation';
 const current=await(deps.load||loadDashboard)(db,uid,teamId,view,window.asOf,true);
 const previous=await(deps.load||loadDashboard)(db,uid,teamId,view,window.asOf-7*DAY,true);
 const facts=buildInsightFacts(role,current,previous).map(f=>f.id.startsWith('skill')&&f.id!=='skillTraining'?{...f,detail:'Latest recorded skill assignment per athlete within this report week.'}:f);
 const spotlight=role==='coach'?consistencySpotlight(current as TeamParticipation):[];
 const fingerprint=insightFactsFingerprint({analysisVersion:2,facts,spotlight:spotlight.map(({name,rate,rank})=>({name,rate,rank})),roster:role==='coach'?(current as TeamParticipation).athletes.map(a=>a.id).sort():undefined});
 if(deps.persist!==false){const saved=await findInsightReport(db,uid,teamId,role,to,fingerprint);if(saved.status==='available'&&saved.report.mode==='ai')return {...saved.report,spotlight,takeaway:groundedTakeaway(facts)};}
 const report=buildFallbackReport(role,facts,window.from,to);report.spotlight=spotlight;
 report.limitations.push('Historical summaries use currently authorized team members and sharing permissions.','Historical skill assignments are counted where recorded. A current skill pin is not used as historical learning evidence.');
 if(facts.some(f=>f.current!==null))try{Object.assign(report,await(deps.analyze||analyze)(role,facts),{mode:'ai'});}catch{}
 else report.takeaway='There is not enough shared data to generate insights for this period.';
 if(report.mode==='ai')report.takeaway=groundedTakeaway(facts);
 if(deps.persist!==false)await saveInsightReport(db,uid,teamId,report,fingerprint);
 return report;
}
