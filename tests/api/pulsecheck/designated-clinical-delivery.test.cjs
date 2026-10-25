const test=require('node:test'),assert=require('node:assert/strict');
const {resolveDesignatedClinicalRoute,withinCoverage,deliverDesignatedClinicalAlert}=require('../../../netlify/functions/lib/designated-clinical-delivery');
const config=()=>({status:'active',teamId:'team',organizationId:'org',revision:2,primary:{name:'Synthetic clinician',email:'clinical@example.test',phone:'+14105550123'},backup:null,coverage:{mode:'always',days:[],start:'09:00',end:'17:00'},timeZone:'America/New_York',member:{phone:'+14105550124'}});
function fixture(){const rows=new Map([
 ['pulsecheck-teams/team',{organizationId:'org',status:'active',clinicalDeliveryMode:'designated_staff'}],
 ['pulsecheck-organizations/org',{status:'active',productBrand:'athleticmind'}],['pulsecheck-team-escalation-settings/team',config()],
 ['pulsecheck-team-memberships/team_athlete',{userId:'athlete',teamId:'team',organizationId:'org',status:'active',role:'athlete'}],
 ['users/athlete',{displayName:'Synthetic Athlete',email:'athlete@example.test',phone:'+14105550124',baselineAnswers:'NEVER INCLUDE',messages:'NEVER INCLUDE',dateOfBirth:'NEVER INCLUDE'}],
 ]);const reference=key=>({get:async()=>({exists:rows.has(key),data:()=>structuredClone(rows.get(key))}),set:async(v,o)=>rows.set(key,o?.merge?{...rows.get(key),...v}:v),collection:name=>({doc:id=>reference(`${key}/${name}/${id}`)})});
 return {rows,db:{collection:name=>{assert(!['conversations','user-mental-notes'].includes(name));return{doc:id=>reference(`${name}/${id}`)};},runTransaction:async fn=>fn({get:r=>r.get(),set:(r,v,o)=>r.set(v,o)})}};}
test('only active scoped athlete/program/private contact configuration selects staff delivery',async()=>{
 const f=fixture();const scope={teamId:'team',userId:'athlete'};assert.equal((await resolveDesignatedClinicalRoute(f.db,scope)).primary.email,'clinical@example.test');
 for(const [key,patch] of [['pulsecheck-team-memberships/team_athlete',{userId:'other'}],['pulsecheck-team-memberships/team_athlete',{organizationId:'foreign'}],['pulsecheck-team-memberships/team_athlete',{role:'coach'}],['pulsecheck-teams/team',{archivedAt:1}],['pulsecheck-organizations/org',{status:'deleted'}],['pulsecheck-team-escalation-settings/team',{status:'draft'}],['pulsecheck-team-escalation-settings/team',{organizationId:'foreign'}]]){
  const g=fixture();g.rows.set(key,{...g.rows.get(key),...patch});assert.equal(await resolveDesignatedClinicalRoute(g.db,scope),null);
 }
});
test('scheduled coverage uses configured timezone/days and excludes the closing instant',()=>{
 const c={...config(),coverage:{mode:'scheduled',days:[1],start:'09:00',end:'17:00'}};
 assert.equal(withinCoverage(c,new Date('2026-10-26T13:00:00Z')),true);
 assert.equal(withinCoverage(c,new Date('2026-10-26T21:00:00Z')),false);
 assert.equal(withinCoverage(c,new Date('2026-10-25T14:00:00Z')),false);
 assert.equal(withinCoverage({...c,timeZone:'invalid'}),false);
});
test('provider acknowledgments and retries produce one minimal email and SMS without clinical content',async()=>{
 const f=fixture(),sent=[];const input={config:config(),userId:'athlete',escalationId:'incident',tier:3};
 const transports={email:async packet=>{sent.push(packet);return{success:true,messageId:'email-id'}},sms:async packet=>{sent.push(packet);return{success:true,messageSid:'sms-id'}}};
 for(let i=0;i<2;i++){const result=await deliverDesignatedClinicalAlert(f.db,input,transports);assert.equal(result.success,true);assert.equal(result.emergencyHandoffStatus,'sent');assert.equal(result.providerConfirmed,false);}
 assert.equal(sent.length,2);assert.doesNotMatch(JSON.stringify(sent),/NEVER INCLUDE/);assert.match(sent[0].message,/Synthetic Athlete/);assert.doesNotMatch(sent[1].body,/Synthetic Athlete|athlete@example/);
 assert.equal(f.rows.get('escalation-records/incident').staffEmailStatus,'sent');
});
test('unconfirmed sends remain pending without blind duplicate delivery',async()=>{
 const f=fixture();let sends=0;const transports={email:async()=>{sends++;throw Error('connection interrupted')},sms:async()=>({success:false,skipped:true})};
 const input={config:config(),userId:'athlete',escalationId:'incident',tier:2};
 assert.equal((await deliverDesignatedClinicalAlert(f.db,input,transports)).emergencyHandoffStatus,'pending');
 await deliverDesignatedClinicalAlert(f.db,input,transports);assert.equal(sends,1);
});
test('confirmed failures can retry, and only confirmed primary failure tries backup email',async()=>{
 const f=fixture();let sends=0;const c={...config(),backup:{name:'Backup',email:'backup@example.test',phone:'+14105550125'}};
 const result=await deliverDesignatedClinicalAlert(f.db,{config:c,userId:'athlete',escalationId:'incident',tier:3},{email:async p=>{sends++;return{success:p.contact.email.startsWith('backup'),messageId:p.contact.email.startsWith('backup')?'backup-email':null}},sms:async()=>({success:false})});
 assert.equal(sends,2);assert.equal(result.success,true);
});
test('outside coverage and nonclinical events never contact staff',async()=>{
 const f=fixture();const c={...config(),coverage:{mode:'scheduled',days:[],start:'09:00',end:'17:00'}};
 const input={config:c,userId:'athlete',escalationId:'incident',tier:3};const transports={email:async()=>{throw Error('must not send')},sms:async()=>{throw Error('must not send')}};
 assert.equal((await deliverDesignatedClinicalAlert(f.db,input,transports)).status,'outside_coverage');
 await assert.rejects(deliverDesignatedClinicalAlert(f.db,{...input,tier:1},transports));
});


test('suppressed or skipped email without a provider receipt never reports delivery',async()=>{
 for(const providerResult of [{success:true,suppressed:true,skipped:true},{success:true,skipped:true}]) {
  const f=fixture();const result=await deliverDesignatedClinicalAlert(f.db,{config:config(),userId:'athlete',escalationId:'incident',tier:3},{email:async()=>providerResult,sms:async()=>({success:false,skipped:true})});
  assert.equal(result.success,false);assert.notEqual(result.emergencyHandoffStatus,'sent');
 }
});

test('critical handoff uses active designated staff with AuntEdna disabled and never calls a provider',async()=>{
 const f=fixture(),path=require('node:path'),Module=require('node:module');
 const configPath=path.resolve('netlify/functions/config/firebase.js'),metricsPath=path.resolve('netlify/functions/utils/pulsecheck-pilot-metrics.js'),escalationPath=path.resolve('netlify/functions/pulsecheck-escalation.js');
 const savedConfig=require.cache[configPath],savedMetrics=require.cache[metricsPath],oldLoad=Module._load;
 require.cache[configPath]={id:configPath,filename:configPath,loaded:true,exports:{initializeFirebaseAdmin(){},db:f.db,headers:{},admin:{firestore:{FieldValue:{serverTimestamp:()=>0}}}}};
 require.cache[metricsPath]={id:metricsPath,filename:metricsPath,loaded:true,exports:{}};
 let emails=0,providerCalled=false;
 Module._load=function(request,parent,isMain){if(request==='../utils/sendBrevoTransactionalEmail')return{sendBrevoTransactionalEmail:async()=>{emails++;return{success:true,messageId:'confirmed-email'}}};return oldLoad.call(this,request,parent,isMain);};
 try {
  delete require.cache[escalationPath];const {runtimeHelpers}=require(escalationPath);
  const result=await runtimeHelpers.performClinicalHandoff('athlete','conversation','incident',{tier:3,teamId:'team',organizationId:'org'},f.db,{teamId:'team',pilotContext:{teamMembershipId:'team_athlete',organizationId:'org'}},()=>{providerCalled=true;throw Error('No provider should be used');});
  assert.equal(result.success,true);assert.equal(result.emergencySupportMode,'designated_staff');assert.equal(result.emergencyHandoffStatus,'sent');assert.equal(providerCalled,false);assert.equal(emails,1);
  for (const status of ['sent','pending','outside_coverage']) {
   const safety=await runtimeHelpers.executeCriticalSafetyOperations({userId:'athlete',conversationId:'conversation',escalationId:'incident',escalationData:{tier:3,teamId:'team'},supportContext:{teamId:'team'},nowSec:123,runtimeDb:f.db,
    handoffRunner:async()=>({success:status==='sent',status,emergencySupportMode:'designated_staff',emergencyHandoffStatus:status})});
   assert.equal(safety.handoffResult.emergencyHandoffStatus,status);
   assert.equal(f.rows.get('pulsecheck-athlete-safety-state/athlete').emergencyHandoffStatus,status);
   assert.equal(f.rows.get('pulsecheck-athlete-safety-state/athlete').crisisWallActive,true);
  }

 }finally{Module._load=oldLoad;if(savedConfig)require.cache[configPath]=savedConfig;else delete require.cache[configPath];if(savedMetrics)require.cache[metricsPath]=savedMetrics;else delete require.cache[metricsPath];delete require.cache[escalationPath];}
});
