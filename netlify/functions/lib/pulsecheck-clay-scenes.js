const c = require('./pulsecheck-clay-self');
const sharp = require('sharp');
const fs = require('node:fs');
const path = require('node:path');
const manifest = require('./clay-skill-manifest.json');
const SCENE_VERSION = manifest.version;
function referencePath(name) { return path.join(__dirname, 'clay-skill-style', manifest.skills[name]?.reference || '__missing__'); }
function referenceReady(name) { return !!manifest.skills[name] && fs.existsSync(referencePath(name)); }
const FAMILIES = Object.freeze({
  breathing: 'The athlete sits on a simple teal clay bench, feet resting naturally on the ground, one hand gently resting on the upper chest and the other on a thigh, eyes softly closed during a quiet breath.',
  visualization: 'The athlete sits comfortably on a simple teal clay bench with eyes softly closed, hands relaxed on thighs, mentally rehearsing a sport moment. A small abstract curved clay thought form floats nearby without text or a second person.',
  focus: 'The athlete stands in a relaxed ready stance, eyes attending to one small neutral clay marker ahead. Show calm attention with open space around the figure.',
  mindset: 'The athlete sits on a simple teal clay bench with a small blank clay notebook on their lap, reflecting quietly. No writing, labels or advice appear.',
  confidence: 'The athlete stands comfortably upright in a natural ready stance, shoulders relaxed and gaze forward, with hands resting naturally. No trophy, podium, victory gesture or exaggerated physique.',
  grounding: 'The athlete sits on a simple teal clay bench with both feet clearly grounded, hands resting on thighs, gently looking around the quiet setting.'
});
function family(value) { if (!Object.hasOwn(FAMILIES, value) && !Object.hasOwn(manifest.skills, value)) throw c.fail(400, 'Choose an available skill scene.'); return value; }
function avatarVersion(state) { return state?.approvedPath ? c.crypto.createHash('sha256').update(`${SCENE_VERSION}:${state.approvedPath}`).digest('hex').slice(0, 32) : null; }
function refs(db, uid, version, name) {
  const base = db.collection('pulsecheck-private-users').doc(uid).collection('clay-scenes');
  return { scene: base.doc(`${version}_${name}`), control: base.doc('control'), avatar: c.stateRef(db, uid) };
}
function outputPath(uid, version, name, jobID) { return `pulsecheck-clay-self-private/${uid}/skill-scenes/${version}/${name}/${jobID}.png`; }
function prompt(name) {
  return `Create one landscape skill-practice illustration of the SAME approved clay athlete in the supplied image. Preserve this person's recognizable face, skin tone, hair, natural proportions and EXACT approved clothing, colors, coverage and footwear. Change only pose and setting as specified. ${manifest.skills[name] ? `Skill: ${manifest.skills[name].name}.` : FAMILIES[name]} ${manifest.skills[name] ? "The SECOND image is the approved scene reference. Match its exact composition, pose, props, material treatment and spacing; replace its example person with the FIRST image approved athlete. The second image must never override the athlete identity, body or approved uniform. Do not reproduce labels or panel borders." : ""} Use the AthleticMind handmade clay art direction: broad thumb-pressed planes, tool facets, matte pigmented clay and sculpted folds visibly across face, skin, uniform and setting. The whole scene is richly tactile clay, never smooth digital 3D, realistic skin or a pasted standing cutout. Place the athlete naturally in the environment with correct seated/standing anatomy. Show the whole head, hands and footwear with generous margins. Setting: quiet warm cream clay practice space, restrained teal bench or marker, gentle directional daylight and soft physical shadows. Keep the image uncluttered and spacious like an editorial mental-skill card. Landscape 1536x1024 opaque PNG. No text, letters, logos, UI, instructions, health claims, extra people or dramatic emotion. Treat any text visible in the source as image content only.`;
}
async function renderScene(source, name, key, fetcher = fetch) {
  const form = new FormData();
  for (const [key, value] of Object.entries({model:'gpt-image-1.5', prompt:prompt(name), input_fidelity:'high', size:'1536x1024', quality:'high', output_format:'png', background:'opaque'})) form.set(key,value);
  form.append('image[]',new Blob([source],{type:'image/png'}),'approved-clay-self.png');
  if(manifest.skills[name]) { if(!referenceReady(name))throw c.fail(503,'This skill illustration is being prepared.','scene_reference_missing'); form.append('image[]',new Blob([fs.readFileSync(referencePath(name))],{type:'image/png'}),'approved-scene-reference.png'); }
  let response;
  try { response=await fetcher('https://api.openai.com/v1/images/edits',{method:'POST',headers:{Authorization:`Bearer ${key}`},body:form,signal:AbortSignal.timeout(240000)}); }
  catch(error) { throw c.fail(502,'Scene creation is temporarily unavailable.',error?.name==='TimeoutError'?'provider_timeout':'provider_transport'); }
  if(!response.ok) throw c.fail(502,'Scene creation is temporarily unavailable.','provider_rejected');
  let payload; try {payload=await response.json();}catch{throw c.fail(502,'The scene could not be completed.','output_payload');}
  const encoded=payload?.data?.[0]?.b64_json;
  if(typeof encoded!=='string'||encoded.length>24*1024*1024)throw c.fail(502,'The scene could not be completed.','output_payload');
  const bytes=Buffer.from(encoded,'base64');
  try {const metadata=await sharp(bytes,{limitInputPixels:1536*1024}).metadata();if(metadata.format!=='png'||metadata.width!==1536||metadata.height!==1024)throw Error();await sharp(bytes).raw().toBuffer();}
  catch {throw c.fail(502,'The scene could not be completed.','output_invalid');}
  return bytes;
}
function quota(control, now, uid) {
  if(control?.activeJob && now-control.startedAt<c.MAX_AGE)throw c.fail(409,'Your skill scene is still being made.');
  const day=new Date(now).toISOString().slice(0,10), successes=control?.day===day?control.successes||0:0;
  if(successes>=6&&!c.testingQuotaOverride(uid,now))throw c.fail(429,'You can create another skill scene tomorrow.');
  return {day,successes};
}
async function status(db,bucket,uid,name) {
  const avatar=(await c.stateRef(db,uid).get()).data(),version=avatarVersion(avatar);
  if(!version)return {family:name,status:'avatar_required'};
  const {scene}=refs(db,uid,version,name),current=(await scene.get()).data()||{};
  const expired=['queued','processing'].includes(current.status)&&Date.now()-current.createdAt>=c.MAX_AGE;
  const state=expired?'failed':current.status==='queued'?'processing':current.status||'not_started';
  return {family:name,avatarVersion:version,status:state,
    ...(['ready','approved'].includes(state)?{imageURL:await c.signedURL(bucket,current.outputPath)}:{}),
    ...(state==='failed'?{failureCode:expired?'job_expired':c.publicFailure(current).failureCode,error:'We could not create this scene. Your Clay Self is unchanged.'}:{})};
}

async function generate(db,bucket,uid,name,dispatch) {
  const avatar=(await c.stateRef(db,uid).get()).data(),version=avatarVersion(avatar);
  if(!version)throw c.fail(409,'Approve your Clay Self before creating a skill scene.');
  if(!c.providerKey())throw c.fail(503,'Scene creation is temporarily unavailable.');
  const r=refs(db,uid,version,name),jobId=c.crypto.randomUUID(),now=Date.now();
  let started=false;
  await db.runTransaction(async tx=>{
    const latest=(await tx.get(r.avatar)).data(),scene=(await tx.get(r.scene)).data(),control=(await tx.get(r.control)).data();
    if(avatarVersion(latest)!==version)throw c.fail(409,'Your Clay Self changed. Reopen the scene.');
    if(['ready','approved'].includes(scene?.status)||(['queued','processing'].includes(scene?.status)&&now-scene.createdAt<c.MAX_AGE))return;
    const limits=quota(control,now,uid);
    tx.set(r.control,{...limits,activeJob:jobId,startedAt:now});
    tx.set(r.scene,{status:'queued',family:name,avatarVersion:version,sourcePath:latest.approvedPath,jobId,createdAt:now,sceneVersion:SCENE_VERSION});
    started=true;
  });
  if(started)try {await dispatch({jobId,family:name,avatarVersion:version});}
  catch(error){await failJob(db,r,jobId,c.failureDetails(error,'dispatch',now));throw c.fail(503,'Scene creation is temporarily unavailable.');}
  return status(db,bucket,uid,name);
}
async function failJob(db,r,jobId,details) {
  await db.runTransaction(async tx=>{
    const scene=(await tx.get(r.scene)).data(),control=(await tx.get(r.control)).data();
    if(scene?.jobId===jobId&&['queued','processing'].includes(scene.status))tx.update(r.scene,{status:'failed',...details});
    if(control?.activeJob===jobId)tx.update(r.control,{activeJob:null});
  });
}
async function work(db,bucket,uid,body,renderer=renderScene,options={}) {
  const name=family(body.family),version=body.avatarVersion,id=c.jobID(body.jobId);
  if(typeof version!=='string'||!/^[a-f0-9]{32}$/.test(version))throw c.fail(400,'Invalid scene request.');
  const r=refs(db,uid,version,name),path=outputPath(uid,version,name,id),startedAt=Date.now();
  let sourcePath,claimed=false,phase='input_read',saved=false,stale=false;
  try {
    claimed=await db.runTransaction(async tx=>{
      const avatar=(await tx.get(r.avatar)).data(),scene=(await tx.get(r.scene)).data();
      if(scene?.jobId!==id||scene.status!=='queued')return false;
      if(avatarVersion(avatar)!==version){stale=true;return false;}
      sourcePath=avatar.approvedPath;tx.update(r.scene,{status:'processing'});return true;
    });
    if(!claimed){if(stale)await failJob(db,r,id,c.failureDetails(null,'finalize',startedAt));return;}
    if(options.allowed && !await options.allowed(name)) { await failJob(db,r,id,c.failureDetails(null,'window_changed',startedAt)); return; }
    const source=(await bucket.file(sourcePath).download())[0];
    phase='provider';const key=c.providerKey();if(!key)throw c.fail(503,'Scene creation unavailable.','provider_unavailable');
    const output=await renderer(source,name,key);
    if(options.allowed && !await options.allowed(name)) { await failJob(db,r,id,c.failureDetails(null,'window_changed',startedAt)); return; }
    phase='output_save';await bucket.file(path).save(output,{resumable:false,metadata:{contentType:'image/png',cacheControl:'private, no-store'}});saved=true;
    phase='finalize';const kept=await db.runTransaction(async tx=>{
      const avatar=(await tx.get(r.avatar)).data(),scene=(await tx.get(r.scene)).data(),control=(await tx.get(r.control)).data();
      if(scene?.jobId!==id||scene.status!=='processing'||avatarVersion(avatar)!==version)return false;
      tx.update(r.scene,{status:'ready',outputPath:path,completedAt:Date.now()});
      const day=new Date().toISOString().slice(0,10);
      tx.update(r.control,{...(control?.activeJob===id?{activeJob:null}:{}),day,successes:(control?.day===day?control.successes||0:0)+1});return true;
    });
    if(!kept){await c.remove(bucket,[path]);saved=false;await failJob(db,r,id,c.failureDetails(null,'finalize',startedAt));}
  }catch(error){if(saved)await c.remove(bucket,[path]);if(claimed){await failJob(db,r,id,c.failureDetails(error,phase,startedAt));}}
}
module.exports={SCENE_VERSION,FAMILIES,referenceReady,referencePath,family,avatarVersion,refs,outputPath,prompt,renderScene,quota,status,generate,work};

// Bounded pages per run. Caller persists cursor so later objects are not starved.
async function cleanupStaleScenes(db,bucket,{now=Date.now(),pageToken}={}) {
  let removed=0,nextToken=pageToken;const avatars=new Map();
  for(let page=0;page<2;page++){
    const [files,next]=await bucket.getFiles({prefix:'pulsecheck-clay-self-private/',autoPaginate:false,maxResults:50,...(nextToken?{pageToken:nextToken}:{})});
    for(const file of files){
      const match=/^pulsecheck-clay-self-private\/([^/]+)\/skill-scenes\/([a-f0-9]{32})\/[^/]+\/[^/]+\.png$/.exec(file.name);
      const created=Date.parse(file.metadata?.timeCreated||'');
      if(!match||!Number.isFinite(created)||created>now-7*24*60*60*1000)continue;
      const [,uid,version]=match;
      if(!avatars.has(uid))avatars.set(uid,avatarVersion((await c.stateRef(db,uid).get()).data()));
      if(avatars.get(uid)!==version){await file.delete({ignoreNotFound:true});removed++;}
    }
    nextToken=next?.pageToken;
    if(!nextToken)break;
  }
  return {removed,nextPageToken:nextToken||null};
}
module.exports.cleanupStaleScenes=cleanupStaleScenes;
