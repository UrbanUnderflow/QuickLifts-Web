import type { TeamParticipation, TeamWellbeing } from './types';
export type InsightRole = 'coach' | 'trainer';
export type InsightFact = { id:string; label:string; current:number|null; previous:number|null; unit:string; detail:string };
export type InsightReport = { role:InsightRole; from:string; to:string; generatedAt:string; mode:'ai'|'data'; takeaway:string; insights:{title:string;meaning:string;action:string;evidenceIds:string[]}[]; facts:InsightFact[]; limitations:string[]; spotlight:{name:string;rate:number;rank:number}[] };
const rounded = (n:number) => Math.round(n*10)/10;
export function buildInsightFacts(role:InsightRole,current:TeamParticipation|TeamWellbeing,previous?:TeamParticipation|TeamWellbeing):InsightFact[] {
 if(role==='coach') {
  const c=current as TeamParticipation,p=previous as TeamParticipation|undefined;
  const facts:InsightFact[]= (['checkIns','skillTraining','wearables'] as const).map(key=>({id:key,label:{checkIns:'Check-in participation',skillTraining:'Assigned skill completion',wearables:'Wearable data coverage'}[key],current:c.adherence[key].rate===null?null:rounded(c.adherence[key].rate!),previous:p?.adherence[key].rate==null?null:rounded(p.adherence[key].rate!),unit:'%',detail:`${c.adherence[key].completed} of ${c.adherence[key].expected??'unknown'} opportunities. Previous: ${p?.adherence[key].completed??'unknown'} of ${p?.adherence[key].expected??'unknown'}.`}));
  for(const [field,label] of [['morningCompleted','Morning check-ins'],['eveningCompleted','Evening check-ins'],['recoveryCompleted','Recovery check-ins']] as const){
   const measure=(d?:TeamParticipation)=>{const days=d?.athletes.flatMap(a=>a.dailyParticipation||[]).filter(d=>d.scheduled&&typeof d[field]==='boolean')||[];return {count:days.filter(d=>d[field]).length,total:days.length};};const a=measure(c),b=measure(p);
   facts.push({id:field,label,current:a.total?rounded(a.count/a.total*100):null,previous:b.total?rounded(b.count/b.total*100):null,unit:'%',detail:`${a.count} of ${a.total} scheduled days with known completion. Previous: ${b.count} of ${b.total}.`});
  }
  c.skills.slice(0,3).forEach((s,i)=>facts.push({id:`skill${i}`,label:`Learning: ${s.name}`,current:s.athleteCount,previous:null,unit:'athletes',detail:'Current assignment snapshot, not historical progress.'}));
  return facts;
 }
 const c=current as TeamWellbeing,p=previous as TeamWellbeing|undefined;
 return (['mood','recovery','wearables','journaling'] as const).flatMap<InsightFact>(key=>{
  const card=c[key],prior=p?.[key];
  if(card.status!=='available')return [{id:key,label:{mood:'Reported mood',recovery:'Reported recovery',wearables:'Wearable summaries',journaling:'Journaling activity'}[key],current:null,previous:null,unit:'',detail:card.reason||'Insufficient shared data.'}];
  return card.values.map((v,i)=>({id:`${key}${i}`,label:v.label,current:v.value,previous:prior?.status==='available'?prior.values.find(x=>x.label===v.label)?.value??null:null,unit:v.unit,detail:`${card.contributors} contributing athletes. Previous: ${prior?.status==='available'?prior.contributors:'unavailable'}. ${card.source}.`}));
 });
}
export function buildFallbackReport(role:InsightRole,facts:InsightFact[],from:string,to:string):InsightReport {
 return {role,from,to,generatedAt:new Date().toISOString(),mode:'data',takeaway:'Your weekly evidence is ready. AI interpretation is currently unavailable.',insights:[],facts,spotlight:[],limitations:['Comparisons cover consecutive seven-day UTC windows.','Contributor groups and scheduled opportunities may differ between weeks.','Missing data is not a negative outcome.']};
}
export function consistencySpotlight(data:TeamParticipation):InsightReport['spotlight'] {
 const rows=data.athletes.flatMap(a=>{const expected=(a.checkIns.expected??0)+(a.skillTraining.expected??0);return expected>0?[{name:a.displayName,rate:rounded(Math.min(1,(a.checkIns.completed+a.skillTraining.completed)/expected)*100)}]:[];}).sort((a,b)=>b.rate-a.rate||a.name.localeCompare(b.name));
 return rows.map((r,i)=>({...r,rank:i>0&&r.rate===rows[i-1].rate?rows.findIndex(x=>x.rate===r.rate)+1:i+1})).slice(0,3);
}
/** Reject malformed outputs and unsupported citations rather than displaying ungrounded prose. */
export function parseInsightAnalysis(raw:string,facts:InsightFact[]):Pick<InsightReport,'takeaway'|'insights'> {
 const data=JSON.parse(raw);const text=(v:unknown,max:number)=>typeof v==='string'&&v.trim().length>0&&v.length<=max;
 const ids=new Set(facts.map(f=>f.id));
 if(!text(data.takeaway,600)||!Array.isArray(data.insights)||data.insights.length<1||data.insights.length>3)throw new Error('Invalid analysis');
 for(const i of data.insights)if(!text(i.title,120)||!text(i.meaning,700)||!text(i.action,500)||!Array.isArray(i.evidenceIds)||!i.evidenceIds.length||i.evidenceIds.some((id:unknown)=>typeof id!=='string'||!ids.has(id)))throw new Error(`Unsupported insight: text lengths ${i.title?.length}/${i.meaning?.length}/${i.action?.length}; citations ${JSON.stringify(i.evidenceIds)}`);
 for(const i of data.insights){const cited=facts.filter(f=>i.evidenceIds.includes(f.id));if(cited.every(f=>f.previous===null)&&/stable|unchanged|improv|declin|increas|decreas|trend|maintain|worsen/i.test(i.title+' '+i.meaning))throw new Error('Comparison without baseline');}
 if(/team cohesion|team dynamics|first (?:recorded|ever|week|mood|time)|incentives|significant reduction in engagement/i.test(JSON.stringify(data)))throw new Error('Unsupported interpretation: '+JSON.stringify(data).match(/team cohesion|team dynamics|first (?:recorded|ever|week|mood|time)|incentives|significant reduction in engagement/i)?.[0]);
 return {takeaway:data.takeaway,insights:data.insights.map((i:any)=>({title:i.title,meaning:i.meaning,action:i.action,evidenceIds:i.evidenceIds}))};
}
/** Keep the headline arithmetic deterministic; AI supplies the interpretation and suggested experiment. */
export function groundedTakeaway(facts:InsightFact[]):string {
 const comparable=facts.filter(f=>f.current!==null&&f.previous!==null).sort((a,b)=>Math.abs(b.current!-b.previous!)-Math.abs(a.current!-a.previous!));
 if(comparable.length)return comparable.slice(0,2).map(f=>{const delta=rounded(f.current!-f.previous!);return `${f.label} ${delta===0?`remained at ${f.current}${f.unit==='%'?'%':` ${f.unit}`}`:`${delta>0?'increased':'decreased'} by ${Math.abs(delta)} ${f.unit==='%'?'percentage points':f.unit===' /5'||f.unit==='/5'?'points':f.unit}, from ${f.previous} to ${f.current}`}.`;}).join(' ');
 const available=facts.filter(f=>f.current!==null);
 return available.length?`${available[0].label}: ${available[0].current} ${available[0].unit}. A comparable previous week is unavailable.`:'There is not enough shared data to compare this period.';
}
