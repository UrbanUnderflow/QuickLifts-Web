import type { firestore } from 'firebase-admin';
import { buildLinearCurriculumCatalog } from '../../api/firebase/dailyCurriculum/linearCurriculum';
import type { ParticipationAthlete } from './types';
export type CoachCurriculumSkill = {id:string;name:string;type:string;currentCount:number;nextCount:number};
export type CoachCurriculumOutline = {status:'available'|'unavailable';sequences:Array<{id:string;title:string;description:string;skills:CoachCurriculumSkill[]}>};
export function outlineRows(skills:Array<{id:string;name:string;type:string;aliases?:string[]}>,athletes:ParticipationAthlete[],next:Map<string,number>=new Map()):CoachCurriculumSkill[]{
 return skills.map(skill=>({id:skill.id,name:skill.name,type:skill.type,currentCount:athletes.filter(a=>a.currentSkill&&[skill.id,...(skill.aliases||[])].includes(a.currentSkill.id)).length,nextCount:next.get(skill.id)||0}));
}
/** Read-only course metadata. Draft rationales, athlete writing, and content assets never enter this DTO. */
export async function loadCoachCurriculumOutline(db:firestore.Firestore,athletes:ParticipationAthlete[]):Promise<CoachCurriculumOutline>{
 try {
  const names=['pulsecheck-protocols','sim-modules','mental-exercises'];
  const snaps=await Promise.all(names.map(name=>db.collection(name).where('isActive','==',true).select('label','name','variantName','isActive','publishStatus','legacyExerciseId').limit(2001).get()));
  if(snaps.some(s=>s.size>2000))return {status:'unavailable',sequences:[]};
  const catalog=buildLinearCurriculumCatalog(Object.fromEntries(snaps.map((s,i)=>[names[i],s.docs.map(d=>({...d.data(),id:d.id}))])));
  const lookup=new Map(catalog.active.map(skill=>[skill.id,skill]));
  const ordered=catalog.proposedOrder.flatMap(id=>lookup.has(id)?[lookup.get(id)!]:[]);
  return {status:'available',sequences:[{id:'full-library',title:'Full skill list',description:'All active skills in the curriculum library. Current assignments are marked below. This list does not change athlete assignments.',skills:outlineRows(ordered,athletes)}]};
 }catch{return {status:'unavailable',sequences:[]};}
}
