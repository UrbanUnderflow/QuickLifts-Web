import {
  MENTAL_SKILL_FAMILIES, MENTAL_SKILL_FAMILIARITY_LEVELS, scoreMentalSkillsBaseline,
  BASELINE_SETBACK_RESPONSE_PROFILES, BASELINE_REFLECTION_RESPONSE_PROFILES,
  BASELINE_BODY_AWARENESS_RESPONSE_PROFILES, BASELINE_BREATH_PRACTICE_RESPONSE_PROFILES,
  baselineAttentionResponseProfiles, baselineSelfTalkResponseProfiles, baselineSportPack, scoreSequenceOrder,
} from '../../api/firebase/mentaltraining/mentalSkillsBaseline';
const steps = ['intro','state','tools','belief','reflection','body','breath','visualization','attention','emotion','coherence','result'];
const pack = baselineSportPack('net_racket');
const profiles: Record<string, any[]> = {
 setback: BASELINE_SETBACK_RESPONSE_PROFILES, reflection: BASELINE_REFLECTION_RESPONSE_PROFILES,
 body_signal: BASELINE_BODY_AWARENESS_RESPONSE_PROFILES, guided_breath: BASELINE_BREATH_PRACTICE_RESPONSE_PROFILES,
 attention: baselineAttentionResponseProfiles(pack), emotion: baselineSelfTalkResponseProfiles(pack),
};
const pairs: Record<string, [string,string,string][]> = {
 setback:[['belief_identity','choose','beliefScore'],['self_talk_reframing','choose','selfTalkScore'],['reflection_learning','understand','reflectionScore']],
 reflection:[['reflection_learning','choose','reflectionScore'],['belief_identity','understand','beliefScore']],
 body_signal:[['breathing_body_awareness','recognize','bodyAwarenessScore'],['emotional_regulation','recognize','emotionalAwarenessScore']],
 guided_breath:[['breathing_body_awareness','rehearse','breathingScore'],['coherence','rehearse','coherenceScore']],
 attention:[['attention_cues','choose','score']], emotion:[['emotional_regulation','choose','emotionalRegulationScore'],['self_talk_reframing','understand','selfTalkScore']],
};
const optionIds = new Set(Object.values(profiles).flat().map(p=>p.id));
export function validateSkillsDraft(input: any, complete = false) {
 if (!input || input.version !== 1 || !steps.includes(input.step)) throw Error('Invalid skills step.');
 const state: any = {};
 if (!['drained','off','okay','solid','locked_in'].includes(input.currentState?.mood)) throw Error('Invalid mood.');
 state.mood = input.currentState.mood;
 for (const key of ['rest','energy','confidence','motivation','sportConnection','selfBelief','improvementBelief']) {
  const value=input.currentState[key];if(!Number.isInteger(value)||value<1||value>5)throw Error('Invalid state.');state[key]=value;
 }
 const familiarity: any = {};
 for(const family of MENTAL_SKILL_FAMILIES){const value=input.familiarity?.[family];if(!MENTAL_SKILL_FAMILIARITY_LEVELS.some(p=>p.id===value))throw Error('Invalid familiarity.');familiarity[family]=value;}
 for(const key of ['selected','breathPracticeSelected'])if(input[key]!=null&&!optionIds.has(input[key]))throw Error('Invalid selection.');
 const order = input.visualizationOrder, chain=input.coherenceOrder;
 if(!Array.isArray(order)||order.length>4||new Set(order).size!==order.length||order.some(v=>![0,1,2,3].includes(v)))throw Error('Invalid order.');
 if(!Array.isArray(chain)||chain.length>4||new Set(chain).size!==chain.length||chain.some(v=>!['signal','breath','thought','action'].includes(v)))throw Error('Invalid chain.');
 if(typeof input.breathComplete!=='boolean'||!Array.isArray(input.evidence)||input.evidence.length>30)throw Error('Invalid evidence.');
 // Recreate scores from known response profiles. Never trust browser scores or arbitrary text.
 const evidence:any[]=[];
 for(const [challengeId,rows] of Object.entries(pairs)){
  const submitted=input.evidence.filter((e:any)=>e.challengeId===challengeId);
  if(!submitted.length)continue;
  const id=submitted[0].selectedOptionId;
  if(submitted.some((e:any)=>e.selectedOptionId!==id))throw Error('Conflicting selection.');
  const profile=profiles[challengeId].find(p=>p.id===id);if(!profile)throw Error('Unknown selection.');
  for(const [family,component,key] of rows)evidence.push({challengeId,family,component,score:profile[key],selectedOptionId:id});
 }
 if(order.length===4){const score=scoreSequenceOrder(order,[0,1,2,3]);for(const component of ['understand','choose','rehearse'])evidence.push({challengeId:'visualization_order',family:'visualization',component,score:component==='rehearse'?Math.min(100,score+5):score,selectedOptionId:`visualization_order_${order.join('-')}`});}
 if(chain.length===4){const score=scoreSequenceOrder(chain,['signal','breath','thought','action']);for(const component of ['understand','choose'])evidence.push({challengeId:'coherence_chain',family:'coherence',component,score,selectedOptionId:`coherence_order_${chain.join('-')}`});evidence.push({challengeId:'coherence_chain',family:'reflection_learning',component:'choose',score:Math.max(0,score-5),selectedOptionId:`coherence_order_${chain.join('-')}`});}
 if(complete && (Object.keys(pairs).some(id=>!evidence.some(e=>e.challengeId===id))||order.length!==4||chain.length!==4||!input.breathComplete||!input.breathPracticeSelected))throw Error('Finish every skills activity.');
 return {version:1,step:complete?'result':input.step,currentState:state,familiarity,evidence,selected:input.selected||null,breathComplete:input.breathComplete,breathPracticeSelected:input.breathPracticeSelected||null,visualizationOrder:order,coherenceOrder:chain};
}
export function skillsResult(draft: ReturnType<typeof validateSkillsDraft>) {
 return scoreMentalSkillsBaseline({source:'consolidated-cau-baseline',sportName:'Volleyball',sportArchetype:'net_racket',currentState:draft.currentState,familiarity:draft.familiarity,evidence:draft.evidence});
}
export async function saveSkills(db:any,ref:any,input:any,uid:string,complete:boolean){
 const draft=validateSkillsDraft(input.draft,complete);
 if(!Number.isInteger(input.revision)||input.revision<0)throw Error('Invalid revision.');
 return db.runTransaction(async(tx:any)=>{
  const previous=(await tx.get(ref)).data();
  if(previous?.completed)return previous;
  if(previous?.revision===input.revision+1&&JSON.stringify(previous.draft)===JSON.stringify(draft))return previous;
  if((previous?.revision||0)!==input.revision)throw Error('Skills changed in another tab. Reopen to continue.');
  const value={ownerUid:uid,version:1,revision:input.revision+1,draft,completed:complete,...(complete?{result:skillsResult(draft)}:{}),updatedAt:new Date().toISOString()};
  // Strip undefined optional scorer properties for Firestore.
  const safe=JSON.parse(JSON.stringify(value));tx.set(ref,safe);return safe;
 });
}
