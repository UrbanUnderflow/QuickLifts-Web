import { firestore } from 'firebase-admin';
import { hasMorningCheckIn, hasEveningCheckIn } from '../../../netlify/functions/utils/teamShowingUpScore';
import { loadWearableParticipation } from './participationSources';
import { loadNoraConversationCount } from './noraParticipation';
export type LifetimeParticipation = { morning: number | null; recovery: number | null; evening: number | null; skills: number | null; wearableDays: number | null; conversations: number | null };
/** Count recorded completions, never infer activity from an account's age. */
export function lifetimeCheckIns(canonical: Array<{date:string; data:Record<string,any>}>, legacy: Record<string,any>[]) {
 const morning=new Set<string>(), recovery=new Set<string>(), evening=new Set<string>();
 for(const {date,data} of canonical){if(hasMorningCheckIn(data))morning.add(date);if(hasEveningCheckIn(data))evening.add(date);if(typeof data.subjectiveRecoveryLevel==='number'&&data.subjectiveRecoveryLevel>=1&&data.subjectiveRecoveryLevel<=5)recovery.add(date);}
 for(const data of legacy)if(typeof data.date==='string'&&typeof data.subjectiveRecoveryScore==='number'&&data.subjectiveRecoveryScore>=1&&data.subjectiveRecoveryScore<=5)recovery.add(data.date);
 return {morning:morning.size,recovery:recovery.size,evening:evening.size};
}
export async function loadLifetimeParticipation(db:firestore.Firestore, athleteId:string, teamId:string, organizationId:string):Promise<LifetimeParticipation>{
 const empty:LifetimeParticipation={morning:null,recovery:null,evening:null,skills:null,wearableDays:null,conversations:null};
 const prefix=(collection:string,start:string)=>db.collection(collection).orderBy(firestore.FieldPath.documentId()).startAt(start).endAt(start+'\uf8ff').limit(10001).get();
 const [checks,skills,wearables,conversations]=await Promise.allSettled([
  Promise.all([prefix('pulsecheck-morning-checkins',athleteId+'_'),db.collection('mental-check-ins').doc(athleteId).collection('check-ins').select('date','subjectiveRecoveryScore').limit(10001).get()]).then(([a,b])=>a.size>10000||b.size>10000?null:lifetimeCheckIns(a.docs.map(d=>({date:d.id.slice(athleteId.length+1),data:d.data()})),b.docs.map(d=>d.data()))),
  Promise.all([db.collection('pulsecheck-daily-assignments').where('athleteId','==',athleteId).select('status').limit(10001).get(),db.collection('pulsecheck-linear-curriculum').doc('states').collection('items').doc(athleteId).collection('assignments').select('completedAt').limit(10001).get()]).then(([a,b])=>a.size>10000||b.size>10000?null:a.docs.filter(d=>d.data().status==='completed').length+b.docs.filter(d=>!!d.data().completedAt).length),
  prefix('health-context-snapshots',athleteId+'_daily_').then(async s=>{if(s.size>10000)return null;const dates=s.docs.map(d=>d.id.slice((athleteId+'_daily_').length)).filter(d=>/^\d{4}-\d{2}-\d{2}$/.test(d));let total=0;for(let i=0;i<Math.max(1,dates.length);i+=200){const w=await loadWearableParticipation(db,athleteId,teamId,organizationId,dates.slice(i,i+200));if(w.metric.status==='unavailable'||w.metric.status==='not_connected')return null;total+=w.days.size;}return total;}),
  loadNoraConversationCount(db,athleteId,'1970-01-01',new Date().toISOString().slice(0,10)),
 ]);
 return {...empty,...(checks.status==='fulfilled'?checks.value:{}),skills:skills.status==='fulfilled'?skills.value:null,wearableDays:wearables.status==='fulfilled'?wearables.value:null,conversations:conversations.status==='fulfilled'?conversations.value:null};
}
