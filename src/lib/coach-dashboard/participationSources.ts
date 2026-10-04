import type { firestore } from 'firebase-admin';
import type { CoverageMetric, CurrentSkill } from './types';
import { resolveWearableCoverageFromSnapshot } from '../../../netlify/functions/utils/teamShowingUpScore';
const families=['oura','apple_health','healthkit','health_kit','apple_watch','healthconnect','google_health','polar','fitbit','whoop','garmin'];
const connected=new Set(['connected','synced','stale','connectedsynced','connectedwaitingdata','connectedstale','connectederror']);
const record=(value:unknown):Record<string,any>=>value&&typeof value==='object'?value as Record<string,any>:{};
export function participationTimestamp(value:unknown):number|null {
 if(typeof value==='number'&&Number.isFinite(value)) return value>1e12?value:value*1000;
 if(typeof value==='string'){const date=Date.parse(value);return Number.isFinite(date)?date:null;}
 if(value&&typeof (value as any).toMillis==='function')return (value as any).toMillis();
 if(value&&typeof (value as any).seconds==='number')return (value as any).seconds*1000;
 return null;
}
/** Matches the scorecard's daily schedule after activation, bounded to joining this team. */
export function scheduledParticipationDates(dates:string[],user:Record<string,any>,member:Record<string,any>):string[] {
 const activation=participationTimestamp(user.activatedAt??user.joinedAt??user.createdAt);
 const joined=participationTimestamp(member.grantedAt??member.joinedAt??member.createdAt);
 const starts=[activation,joined].filter((v):v is number=>v!==null);
 const start=starts.length?new Date(Math.max(...starts)).toISOString().slice(0,10):null;
 return dates.filter(date=>!start||date>=start);
}
export function coverageForDays(completed:Set<string>,expected:string[]):CoverageMetric {
 const count=expected.filter(d=>completed.has(d)).length;
 return {completed:count,expected:expected.length,rate:expected.length?Math.round(count/expected.length*100):null,status:'available'};
}
export async function loadCurrentLinearSkill(db:firestore.Firestore,athleteId:string,state:Record<string,any>):Promise<CurrentSkill|null> {
 if(state.optedIn!==true||state.athleteId!==athleteId)return null;
 const pin=record(state.currentSkill); if(!/^[A-Za-z0-9_-]{1,128}$/.test(pin.skillId||'')||!/^[A-Za-z0-9_-]{1,128}$/.test(pin.versionId||''))return null;
 const [version,latest]=await Promise.all([
 db.collection('pulsecheck-linear-curriculum').doc('versions').collection('items').doc(pin.versionId).get(),
 db.collection('pulsecheck-linear-curriculum').doc('states').collection('items').doc(athleteId).collection('assignments').orderBy('sourceDate','desc').limit(30).select('skillId','versionId','skillName','phase').get()
 ]);
 const definition=(version.data()?.skills||[]).find((skill:any)=>skill.id===pin.skillId);
 const assignment=latest.docs.map(d=>d.data()).find(d=>d.skillId===pin.skillId&&d.versionId===pin.versionId);
 const name=definition?.name||assignment?.skillName;
 if(!name)return null;
 const content=version.data()?.contentSnapshots?.[pin.skillId] || (await db.collection('pulsecheck-linear-curriculum').doc('versions').collection('items').doc(pin.versionId).collection('content').doc(pin.skillId).get()).data()?.contentSnapshot;
 const today=new Date().toISOString().slice(0,10);
 return {id:pin.skillId,name:String(name).slice(0,160),phase:assignment?.phase||null,...(content&&definition?{preview:{id:`preview-${pin.versionId}-${pin.skillId}`,versionId:pin.versionId,skillId:pin.skillId,skillName:String(name),skillType:definition.type,phase:definition.type==='simulation'?'practice':'learn',sourceDate:today,timezone:'UTC',windowStart:today,windowEnd:today,completedDayCount:0,requiredDays:5,phaseCompletedToday:false,contentSnapshot:content,clientContractVersion:1} as import('../../api/firebase/dailyCurriculum/linearRuntimeClient').LinearRuntimeAssignment}:{})};
}
export const normalizeWearableFamily=(value:unknown):string=>{
 const family=String(value||'').toLowerCase().replace(/-/g,'_');
 if(['apple_health','healthkit','health_kit','apple_watch'].includes(family))return 'healthkit';
 if(['healthconnect','google_health'].includes(family))return 'healthconnect';
 return family;
};
const sourceScope=(data:Record<string,any>,athleteId:string,teamId:string,organizationId:string)=>(!data.teamId||data.teamId===teamId)&&(!data.organizationId||data.organizationId===organizationId)&&(!data.athleteUserId||data.athleteUserId===athleteId);
/** A retained measurement never proves current authorization. Explicit revocation wins across layouts. */
export async function loadWearableLifecycle(db:firestore.Firestore,athleteId:string,teamId:string,organizationId:string) {
 const documents=await db.getAll(db.collection('health-context-source-status').doc(athleteId),db.collection('athletes').doc(athleteId).collection('health-context-source-status').doc('current'),...families.map(f=>db.collection('health-context-source-status').doc(`${athleteId}_${f}`)));
 const statuses:Array<Record<string,any>&{family:string}>=documents.flatMap((doc,i)=>{const data=doc.data();if(!data||!sourceScope(data,athleteId,teamId,organizationId))return [];if(i>1)return [{...data,family:normalizeWearableFamily(families[i-2])}];const map=record(data.sourceStatuses||data);return families.flatMap(f=>map[f]?[{...(typeof map[f]==='string'?{status:map[f]}:record(map[f])),family:normalizeWearableFamily(f)}]:[]);}).filter(d=>sourceScope(d,athleteId,teamId,organizationId));
 const blocked=new Set(statuses.filter(d=>d.revokedAt||d.disconnectedAt||['disconnected','not_connected','notconnected','revoked','disabled'].includes(String(d.lifecycleState||d.status||d.connectionState||'').toLowerCase().replace(/-/g,'_'))).map(d=>d.family));
 const current=statuses.filter(d=>{const state=String(d.lifecycleState||d.status||d.connectionState||'').toLowerCase().replace(/-/g,'_');return !blocked.has(d.family)&&(connected.has(state)||state.startsWith('connected_'));});
 return {allowed:new Set(current.map(d=>d.family)),blocked,current};
}
export function snapshotFromAllowedSources(snapshot:Record<string,any>,allowed:Set<string>):Record<string,any> {
 const domains:Record<string,any>={};
 for(const domain of ['activity','training','workout','biometrics','cardio','heart','recovery','sleep']) {
  const block=record(snapshot.domains?.[domain]||snapshot[domain]);
  const source=normalizeWearableFamily(block.provenance?.primarySource||snapshot.provenance?.domainWinners?.[domain]||block.sourceFamily||(snapshot.provenance?.sourcesUsed?.length===1?snapshot.provenance.sourcesUsed[0]:null)||snapshot.sourceFamily);
  if(source&&allowed.has(source))domains[domain]=block;
 }
 return {domains,freshness:snapshot.freshness,provenance:snapshot.provenance,sourceFamily:snapshot.sourceFamily};
}
/** Reads presence and lifecycle only into the public DTO. Health measurements never leave this adapter. */
export async function loadWearableParticipation(db:firestore.Firestore,athleteId:string,teamId:string,organizationId:string,dates:string[]):Promise<{metric:CoverageMetric;days:Set<string>;periods:Record<string,{daytime:boolean;overnight:boolean}>}> {
 const [snapshots,lifecycle]=await Promise.all([
 dates.length?db.getAll(...dates.map(d=>db.collection('health-context-snapshots').doc(`${athleteId}_daily_${d}`))):Promise.resolve([]),
 loadWearableLifecycle(db,athleteId,teamId,organizationId)
 ]);
 const days=new Set<string>();
 const periods:Record<string,{daytime:boolean;overnight:boolean}>={};
 if(!lifecycle.allowed.size)return {days,periods,metric:{completed:0,expected:null,rate:null,status:lifecycle.blocked.size?'not_connected':'unavailable',reason:lifecycle.blocked.size?'No currently connected wearable source.':'Current wearable connection has not been verified.'}};
 snapshots.forEach((snapshot,i)=>{const data=snapshot.data();if(data&&sourceScope(data,athleteId,teamId,organizationId)){const coverage=resolveWearableCoverageFromSnapshot(snapshotFromAllowedSources(data,lifecycle.allowed));periods[dates[i]]={daytime:coverage.hasDaytime,overnight:coverage.hasOvernight};if(coverage.hasDaytime||coverage.hasOvernight)days.add(dates[i]);}});
 const connectionDates=lifecycle.current.map(d=>participationTimestamp(d.connectedAt)).filter((v):v is number=>v!==null);
 const start=connectionDates.length?new Date(Math.min(...connectionDates)).toISOString().slice(0,10):null;
 const expected=dates.filter(date=>!start||date>=start);
 const metric=coverageForDays(days,expected);
 if(!days.size){metric.status='sync_pending';metric.reason='A wearable is connected. Measured data has not arrived for this window.';}
 else metric.reason='Measured days from currently connected wearable sources.';
 return {metric,days,periods};
}
