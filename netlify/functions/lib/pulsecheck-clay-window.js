// Read-only, owner-scoped curriculum selection. Never advances progress or assigns a skill.
const c=require('./pulsecheck-clay-self');
const scenes=require('./pulsecheck-clay-scenes');
const manifest=require('./clay-skill-manifest.json');
const section=(db,name)=>db.collection('pulsecheck-linear-curriculum').doc(name).collection('items');
const canonical=id=>manifest.aliases[id]||id;
function skill(id){const key=canonical(id);if(!Object.hasOwn(manifest.skills,key))throw c.fail(400,'This skill illustration is not available.');return key;}
function published(version){return version?.status==='published'&&Array.isArray(version.skills)&&Array.isArray(version.content?.orderedIds)&&Array.isArray(version.runtimeReadySkillIds)&&new Set(version.content.orderedIds).size===version.content.orderedIds.length&&version.content.orderedIds.length===version.skills.length&&version.skills.every((s,i)=>s.id===version.content.orderedIds[i]);}
function selectPair(uid,state,pinned,audience,latest){
 if(state?.athleteId!==uid||state.optedIn!==true||!state.enrollment?.timezone||!published(pinned)||pinned.id!==state.currentSkill?.versionId)return [];
 const current=state.currentSkill.skillId;
 if(!pinned.content.orderedIds.includes(current)||!pinned.runtimeReadySkillIds.includes(current))return [];
 const result=[current];
 if(audience?.athleteIds?.includes(uid)&&audience.versionId===latest?.id&&published(latest)){
  const done=new Set([...(state.completedSkillIds||[]),current]);
  // Do not skip an unapproved next skill: the transition runtime blocks at that boundary.
  const next=latest.content.orderedIds.find(id=>!done.has(id));
  if(next&&latest.runtimeReadySkillIds.includes(next))result.push(next);
 }
 return result.map(id=>({skillId:id,key:canonical(id)})).filter(item=>Object.hasOwn(manifest.skills,item.key));
}
async function resolvePair(db,uid){
 if(process.env.LINEAR_CURRICULUM_RUNTIME_ENABLED!=='true')return [];
 const state=(await section(db,'states').doc(uid).get()).data();
 if(!state?.currentSkill?.versionId||!state.audienceId)return [];
 const [pinned,audience]=await Promise.all([section(db,'versions').doc(state.currentSkill.versionId).get(),section(db,'audiences').doc(state.audienceId).get()]);
 const audienceData=audience.data();
 const latest=typeof audienceData?.versionId==='string'?(await section(db,'versions').doc(audienceData.versionId).get()).data():null;
 return selectPair(uid,state,pinned.data(),audienceData,latest);
}
async function status(db,bucket,uid,id){const key=skill(id);return {...await scenes.status(db,bucket,uid,key),skillId:id};}
async function prepare(db,bucket,uid,dispatch,options={}){
 const pair=await resolvePair(db,uid);
 const avatar=(await c.stateRef(db,uid).get()).data(),version=scenes.avatarVersion(avatar);
 if(!version)return {status:'avatar_required'};
 if(!pair.length)return {status:'curriculum_unavailable',avatarVersion:version,skills:[]};
 const statuses=[];
 for(const item of pair){
  const state=await status(db,bucket,uid,item.skillId);statuses.push(state);
  if(state.status==='processing')return {status:'processing',avatarVersion:version,skills:statuses};
  // Failed attempts stay failed, including expiry. Refresh does not cause a paid retry loop.
  if(state.status!=='not_started')continue;
  if(!(options.referenceReady||scenes.referenceReady)(item.key))return {status:'artwork_unavailable',avatarVersion:version,skills:statuses};
  try{
   const started=await scenes.generate(db,bucket,uid,item.key,payload=>dispatch({...payload,rollingWindow:true}));
   return {status:started.status,avatarVersion:version,skills:[...statuses.slice(0,-1),{...started,skillId:item.skillId}]};
  }catch(error){if(error.statusCode===409)return {status:'processing',avatarVersion:version,skills:statuses};if(error.statusCode===429)return {status:'quota_reached',avatarVersion:version,skills:statuses};throw error;}
 }
 return {status:statuses.some(s=>s.status==='failed')?'failed':'ready',avatarVersion:version,skills:statuses};
}
async function workPair(db,bucket,uid,body,renderer,options={}){
 // Maximum two serial jobs in this invocation, regardless of catalog size or progress changes.
 let current=body;
 const allowed=async key=>(await resolvePair(db,uid)).some(item=>item.key===key);
 for(let i=0;i<2&&current;i++){
  await scenes.work(db,bucket,uid,current,renderer,{allowed});
  current=null;
  if(i===0)await prepare(db,bucket,uid,async payload=>{current=payload;},options);
 }
}
module.exports={canonical,skill,published,selectPair,resolvePair,status,prepare,workPair};
