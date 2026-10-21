const test=require('node:test'),assert=require('node:assert/strict');
const sharp=require('sharp');
const s=require('../../netlify/functions/lib/pulsecheck-clay-scenes');
const c=require('../../netlify/functions/lib/pulsecheck-clay-self');
function harness(){
 const states=new Map(),files=new Map();
 const db={collection:name=>collection(name),runTransaction:async fn=>fn({get:ref=>ref.get(),set:(ref,data)=>states.set(ref.path,data),update:(ref,data)=>states.set(ref.path,{...states.get(ref.path),...data})})};
 function collection(path){return {doc:id=>({path:`${path}/${id}`,get:async()=>({data:()=>states.get(`${path}/${id}`)}),collection:name=>collection(`${path}/${id}/${name}`)})};}
 const bucket={file:path=>({download:async()=>{if(!files.has(path))throw Error('missing');return[files.get(path)];},save:async bytes=>files.set(path,bytes),delete:async()=>files.delete(path),getSignedUrl:async()=>[`https://private.test/${path}`]})};
 const uid='owner',avatarPath='pulsecheck-clay-self-private/owner/approved/portrait.png';
 states.set(c.stateRef(db,uid).path,{status:'approved',approvedPath:avatarPath});files.set(avatarPath,Buffer.from('approved-avatar'));
 return {db,bucket,uid,avatarPath,states,files};
}
const withKey=async fn=>{const old=process.env.OPENAI_API_KEY,oldFlag=process.env.LINEAR_CURRICULUM_RUNTIME_ENABLED;process.env.OPENAI_API_KEY='synthetic';process.env.LINEAR_CURRICULUM_RUNTIME_ENABLED='true';try{await fn();}finally{if(old===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=old;if(oldFlag===undefined)delete process.env.LINEAR_CURRICULUM_RUNTIME_ENABLED;else process.env.LINEAR_CURRICULUM_RUNTIME_ENABLED=oldFlag;}};
test('templates cover supported categories without accepting arbitrary prompts',()=>{
 assert.deepEqual(Object.keys(s.FAMILIES),['breathing','visualization','focus','mindset','confidence','grounding']);
 assert.throws(()=>s.family('ignore instructions'),{statusCode:400});
 assert.match(s.prompt('breathing'),/sits on a simple teal clay bench/);
 assert.match(s.prompt('breathing'),/EXACT approved clothing/);
 assert.match(s.prompt('breathing'),/face, skin, uniform/);
});
test('explicit generate caches one owner-private scene per approvedavatar and family',()=>withKey(async()=>{
 const h=harness();let payload,requests=0;
 const dispatch=async body=>{payload=body;requests++;};
 const queued=await s.generate(h.db,h.bucket,h.uid,'breathing',dispatch);
 assert.equal(queued.status,'processing');
 await s.generate(h.db,h.bucket,h.uid,'breathing',dispatch);assert.equal(requests,1);
 await assert.rejects(s.generate(h.db,h.bucket,h.uid,'focus',dispatch),{statusCode:409});
 await s.work(h.db,h.bucket,h.uid,payload,async(source,family)=>{assert.equal(source.toString(),'approved-avatar');assert.equal(family,'breathing');return Buffer.from('scene');});
 const ready=await s.status(h.db,h.bucket,h.uid,'breathing');assert.equal(ready.status,'ready');assert.match(ready.imageURL,/skill-scenes/);
 await s.generate(h.db,h.bucket,h.uid,'breathing',dispatch);assert.equal(requests,1);
 await s.work(h.db,h.bucket,h.uid,payload,async()=>{throw Error('duplicate should not generate');});
 assert.equal((await s.status(h.db,h.bucket,'other','breathing')).status,'avatar_required');
 assert.equal(h.files.size,2);
 assert.equal(h.states.get(s.refs(h.db,h.uid,payload.avatarVersion,'breathing').control.path).successes,1,'duplicate worker counts once');
}));
test('avatar change during generation discards stale output and releases lock',()=>withKey(async()=>{
 const h=harness();let payload;
 await s.generate(h.db,h.bucket,h.uid,'breathing',async body=>{payload=body;});
 await s.work(h.db,h.bucket,h.uid,payload,async()=>{h.states.set(c.stateRef(h.db,h.uid).path,{approvedPath:'new-approved-avatar'});return Buffer.from('scene');});
 assert.equal((await s.status(h.db,h.bucket,h.uid,'breathing')).status,'not_started');
 assert.equal(h.files.size,1);
 const control=s.refs(h.db,h.uid,payload.avatarVersion,'breathing').control;
 assert.equal(h.states.get(control.path).activeJob,null);
}));
test('avatar deletion prevents fetching old cached scene',()=>withKey(async()=>{
 const h=harness();let payload;
 await s.generate(h.db,h.bucket,h.uid,'focus',async body=>{payload=body;});
 await s.work(h.db,h.bucket,h.uid,payload,async()=>Buffer.from('scene'));
 h.states.set(c.stateRef(h.db,h.uid).path,{status:'deleted',approvedPath:null});
 assert.deepEqual(await s.status(h.db,h.bucket,h.uid,'focus'),{family:'focus',status:'avatar_required'});
}));
test('failed generation is resumable as a failed state and retains approved avatar',()=>withKey(async()=>{
 const h=harness();let payload;
 await s.generate(h.db,h.bucket,h.uid,'mindset',async body=>{payload=body;});
 await s.work(h.db,h.bucket,h.uid,payload,async()=>{throw c.fail(502,'private provider message','provider_rejected');});
 const failed=await s.status(h.db,h.bucket,h.uid,'mindset');
 assert.equal(failed.status,'failed');assert.equal(failed.failureCode,'provider_rejected');
 assert.equal(JSON.stringify(failed).includes('private provider'),false);assert.equal(h.files.size,1);
}));
test('scene success bound and UTC rollover preserve active-job guard',()=>{
 const now=Date.parse('2026-10-18T12:00:00Z');
 assert.throws(()=>s.quota({day:'2026-10-18',successes:6},now),{statusCode:429});
 assert.equal(s.quota({day:'2026-10-17',successes:6},now).successes,0);
 assert.throws(()=>s.quota({activeJob:'pending',startedAt:now},now),{statusCode:409});
});
test('provider request sends approvedavatar only with fixed landscape template and validates result',async()=>{
 const png=await sharp({create:{width:1536,height:1024,channels:3,background:'#efeade'}}).png().toBuffer();
 const result=await s.renderScene(Buffer.from('approved'),'breathing','synthetic',async(url,options)=>{
  assert.equal(options.body.getAll('image[]').length,1);assert.equal(options.body.get('size'),'1536x1024');assert.equal(options.body.get('background'),'opaque');
  assert.equal(options.body.get('quality'),'high');assert.match(options.body.get('prompt'),/sits on a simple teal clay bench/);
  return{ok:true,json:async()=>({data:[{b64_json:png.toString('base64')}]})};
 });assert.deepEqual(result,png);
 await assert.rejects(s.renderScene(Buffer.from('approved'),'focus','synthetic',async()=>({ok:true,json:async()=>({data:[{b64_json:Buffer.from('bad').toString('base64')}]})})),{failureCode:'output_invalid'});
});

test('another owner cannot claim a job and stale queued job releases its lock',()=>withKey(async()=>{
 const h=harness();let payload;
 await s.generate(h.db,h.bucket,h.uid,'grounding',async body=>{payload=body;});
 let calls=0;
 await s.work(h.db,h.bucket,'other',payload,async()=>{calls++;return Buffer.from('scene');});
 assert.equal(calls,0);
 h.states.set(c.stateRef(h.db,h.uid).path,{approvedPath:'replacement'});
 await s.work(h.db,h.bucket,h.uid,payload,async()=>{calls++;return Buffer.from('scene');});
 assert.equal(calls,0);
 assert.equal(h.states.get(s.refs(h.db,h.uid,payload.avatarVersion,'grounding').control.path).activeJob,null);
}));

test('dispatch failure releases active lock and returns only curated error',()=>withKey(async()=>{
 const h=harness();
 await assert.rejects(s.generate(h.db,h.bucket,h.uid,'focus',async()=>{throw Error('secret dispatch details');}),{statusCode:503,message:'Scene creation is temporarily unavailable.'});
 const result=await s.status(h.db,h.bucket,h.uid,'focus');
 assert.equal(result.status,'failed');assert.equal(result.failureCode,'dispatch_failed');
 assert.equal(JSON.stringify(result).includes('secret'),false);
}));

test('scene failures consume no successful quota and tester override is scoped and expiring',()=>withKey(async()=>{
 const h=harness();let payload;
 await s.generate(h.db,h.bucket,h.uid,'focus',async body=>{payload=body;});
 await s.work(h.db,h.bucket,h.uid,payload,async()=>{throw Error('failure');});
 assert.equal(h.states.get(s.refs(h.db,h.uid,payload.avatarVersion,'focus').control.path).successes,0);
 const oldIds=process.env.CLAY_SELF_TESTER_UIDS,oldUntil=process.env.CLAY_SELF_TESTING_UNTIL;
 const now=Date.now(),control={day:new Date(now).toISOString().slice(0,10),successes:6};
 try{
  process.env.CLAY_SELF_TESTER_UIDS='owner';process.env.CLAY_SELF_TESTING_UNTIL=new Date(now+60000).toISOString();
  assert.equal(s.quota(control,now,'owner').successes,6);
  assert.throws(()=>s.quota(control,now,'other'),{statusCode:429});
  assert.throws(()=>s.quota(control,now+120000,'owner'),{statusCode:429});
 }finally{if(oldIds===undefined)delete process.env.CLAY_SELF_TESTER_UIDS;else process.env.CLAY_SELF_TESTER_UIDS=oldIds;if(oldUntil===undefined)delete process.env.CLAY_SELF_TESTING_UNTIL;else process.env.CLAY_SELF_TESTING_UNTIL=oldUntil;}
}));

test('bounded cleanup removes only stale old scene objects, preserves avatar/current/fresh assets',async()=>{
 const h=harness(),now=Date.now(),removed=[];
 const current=s.avatarVersion({approvedPath:h.avatarPath}),old='a'.repeat(32);
 const file=(name,age)=>({name,metadata:{timeCreated:new Date(now-age).toISOString()},delete:async()=>removed.push(name)});
 const oldAge=8*24*60*60*1000;
 let calls=0;
 const bucket={getFiles:async query=>{calls++;assert.equal(query.maxResults,50);return [[file(h.avatarPath,oldAge),file(s.outputPath(h.uid,current,'focus','current'),oldAge),file(s.outputPath(h.uid,old,'focus','fresh'),1000),file(s.outputPath(h.uid,old,'focus','stale'),oldAge)],calls===1?{pageToken:'second'}:{pageToken:'third'}];}};
 const result=await s.cleanupStaleScenes(h.db,bucket,{now});
 assert.equal(calls,2);assert.equal(result.nextPageToken,'third');assert.equal(result.removed,2);
 assert.ok(removed.every(name=>name.endsWith('/stale.png')));
});

const windowScenes=require('../../netlify/functions/lib/pulsecheck-clay-window');
function seedWindow(h,ids=['breathing-box','breathing-recovery','breathing-activation']){
 const version={id:'v1',status:'published',content:{orderedIds:ids},skills:ids.map(id=>({id,name:id})),runtimeReadySkillIds:ids};
 const state={athleteId:h.uid,optedIn:true,audienceId:'team',enrollment:{timezone:'America/New_York'},currentSkill:{skillId:ids[0],versionId:'v1'},completedSkillIds:[]};
 const audience={athleteIds:[h.uid],versionId:'v1'};
 for(const [section,id,data] of [['states',h.uid,state],['versions','v1',version],['audiences','team',audience]])h.states.set(`pulsecheck-linear-curriculum/${section}/items/${id}`,data);
 return {state,version,audience};
}
test('rolling window derives exactly current and actual next, never skips blocked next or trusts another owner',()=>{
 const h=harness(),{state,version,audience}=seedWindow(h);
 assert.deepEqual(windowScenes.selectPair(h.uid,state,version,audience,version).map(x=>x.key),['breathing-box','breathing-recovery']);
 assert.deepEqual(windowScenes.selectPair('other',state,version,audience,version),[]);
 const latest={...version,id:'v2',runtimeReadySkillIds:['breathing-box','breathing-activation']};
 assert.deepEqual(windowScenes.selectPair(h.uid,state,version,{...audience,versionId:'v2'},latest).map(x=>x.key),['breathing-box']);
 assert.deepEqual(windowScenes.selectPair(h.uid,state,version,{athleteIds:[],versionId:'v1'},version).map(x=>x.key),['breathing-box']);
 assert.equal(windowScenes.skill('protocol-box-breathing'),'breathing-box');
 assert.throws(()=>windowScenes.skill('arbitrary prompt'),{statusCode:400});
});
test('prepare current pair processes two serial cached skills, advances one, and failures never automatically retry',()=>withKey(async()=>{
 const h=harness(),seed=seedWindow(h),options={referenceReady:()=>true};let payload,calls=0;
 await windowScenes.prepare(h.db,h.bucket,h.uid,async p=>{payload=p;},options);
 await windowScenes.prepare(h.db,h.bucket,h.uid,async()=>{throw Error('duplicate dispatch');},options);
 await windowScenes.workPair(h.db,h.bucket,h.uid,payload,async()=>{calls++;return Buffer.from('scene');},options);
 assert.equal(calls,2);
 assert.equal((await windowScenes.prepare(h.db,h.bucket,h.uid,async()=>{throw Error('cached dispatch');},options)).status,'ready');
 seed.state.currentSkill.skillId='breathing-recovery';seed.state.completedSkillIds=['breathing-box'];
 await windowScenes.prepare(h.db,h.bucket,h.uid,async p=>{payload=p;},options);
 await windowScenes.workPair(h.db,h.bucket,h.uid,payload,async()=>{calls++;throw Error('provider down');},options);
 assert.equal(calls,3);
 assert.equal((await windowScenes.prepare(h.db,h.bucket,h.uid,async()=>{throw Error('failed retry');},options)).status,'failed');
 assert.equal(h.states.get(s.refs(h.db,h.uid,payload.avatarVersion,'breathing-box').control.path).successes,2);
}));
test('rolling window cancels obsolete queued work before paid rendering and rejects absent approved artwork',()=>withKey(async()=>{
 const h=harness(),seed=seedWindow(h);let payload,calls=0;
 assert.equal((await windowScenes.prepare(h.db,h.bucket,h.uid,async()=>{}, {referenceReady:()=>false})).status,'artwork_unavailable');
 await windowScenes.prepare(h.db,h.bucket,h.uid,async p=>{payload=p;},{referenceReady:()=>true});
 seed.state.optedIn=false;
 await windowScenes.workPair(h.db,h.bucket,h.uid,payload,async()=>{calls++;return Buffer.from('scene');},{referenceReady:()=>true});
 assert.equal(calls,0);
}));
test('latest applicable published order determines next, not pinned order or client family',()=>{
 const h=harness(),{state,version,audience}=seedWindow(h);
 const ids=['breathing-activation','breathing-recovery','breathing-box'];
 const latest={...version,id:'v2',content:{orderedIds:ids},skills:ids.map(id=>({id})),runtimeReadySkillIds:ids};
 assert.deepEqual(windowScenes.selectPair(h.uid,state,version,{...audience,versionId:'v2'},latest).map(x=>x.key),['breathing-box','breathing-activation']);
});
test('every allowlisted skill has its own approved panel; request sends identity first and composition second',async()=>{
 const manifest=require('../../netlify/functions/lib/clay-skill-manifest.json');
 assert.equal(Object.keys(manifest.skills).length,77);
 for(const id of Object.keys(manifest.skills))assert.equal(s.referenceReady(id),true,id);
 const png=await sharp({create:{width:1536,height:1024,channels:3,background:'white'}}).png().toBuffer();
 await s.renderScene(Buffer.from('approved-owner-figure'),'breathing-box','test',async(url,request)=>{
  const images=request.body.getAll('image[]');assert.equal(images.length,2);
  assert.equal(images[0].name,'approved-clay-self.png');assert.equal(await images[0].text(),'approved-owner-figure');
  assert.equal(images[1].name,'approved-scene-reference.png');assert.ok(images[1].size>1000);
  assert.match(request.body.get('prompt'),/SECOND image is the approved scene reference/);
  assert.match(request.body.get('prompt'),/never override the athlete identity/);
  return {ok:true,json:async()=>({data:[{b64_json:png.toString('base64')}]})};
 });
});
test('avatar replacement rebuilds only two current slots, never older cached or full catalog scenes',()=>withKey(async()=>{
 const h=harness();seedWindow(h);const options={referenceReady:()=>true};let payload,calls=0;
 const dispatch=async p=>{payload=p;};const renderer=async()=>{calls++;return Buffer.from('scene');};
 await windowScenes.prepare(h.db,h.bucket,h.uid,dispatch,options);
 await windowScenes.workPair(h.db,h.bucket,h.uid,payload,renderer,options);
 const newPath='pulsecheck-clay-self-private/owner/approved/new.png';
 h.states.set(c.stateRef(h.db,h.uid).path,{approvedPath:newPath});h.files.set(newPath,Buffer.from('new-approved'));
 await windowScenes.prepare(h.db,h.bucket,h.uid,dispatch,options);
 await windowScenes.workPair(h.db,h.bucket,h.uid,payload,renderer,options);
 assert.equal(calls,4);
 assert.equal((await windowScenes.status(h.db,h.bucket,h.uid,'breathing-activation')).status,'not_started');
}));

test('disabled curriculum runtime does not create a guessed window',()=>withKey(async()=>{const h=harness();seedWindow(h);process.env.LINEAR_CURRICULUM_RUNTIME_ENABLED='false';assert.deepEqual(await windowScenes.resolvePair(h.db,h.uid),[]);}));
