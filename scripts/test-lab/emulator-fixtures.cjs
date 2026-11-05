#!/usr/bin/env node
'use strict';
// Never loads a service-account key. All operations are confined to demo-project emulators.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const PROJECT='demo-pulsecheck-ui';const QUESTIONNAIRE_VERSION=require('../../src/content/questionnaires/athlete-starting-point.json').version;
function localHost(value, fallback) {
 const host=value||fallback;
 if(!/^(127\.0\.0\.1|localhost|\[::1\]):\d{2,5}$/.test(host))throw Error('Test Lab requires loopback emulator hosts.');
 return host;
}
function args(argv){const a={};for(let i=0;i<argv.length;i++){if(argv[i].startsWith('--'))a[argv[i].slice(2)]=argv[++i];else if(!a.command)a.command=argv[i];else throw Error('Unexpected argument.');}return a;}
function assertManifest(m){if(m.projectId!==PROJECT||!/^ui-lab-[a-z0-9-]{1,48}$/.test(m.namespace)||m.accounts?.athlete?.uid!==m.namespace+'-athlete'||!Array.isArray(m.documentPaths))throw Error('Invalid isolated fixture manifest.');return m;}
async function client(){
 if(process.env.GCLOUD_PROJECT&&process.env.GCLOUD_PROJECT!==PROJECT)throw Error('Production/non-demo project is forbidden.');
 if(process.env.GOOGLE_APPLICATION_CREDENTIALS)throw Error('Test Lab must not load real cloud credentials.');
 process.env.FIREBASE_AUTH_EMULATOR_HOST=localHost(process.env.FIREBASE_AUTH_EMULATOR_HOST,'127.0.0.1:9099');
 process.env.FIRESTORE_EMULATOR_HOST=localHost(process.env.FIRESTORE_EMULATOR_HOST,'127.0.0.1:8080');
 process.env.GCLOUD_PROJECT=PROJECT;
 const admin=require('firebase-admin');const app=admin.apps.find(a=>a.name==='athlete-test-lab')||admin.initializeApp({projectId:PROJECT},'athlete-test-lab');
 return {admin,app,auth:admin.auth(app),db:admin.firestore(app)};
}
async function seed(a){
 if(!/^[a-z0-9-]{1,48}$/.test(a['run-id']||''))throw Error('--run-id must contain 1-48 lowercase letters, digits or hyphens.');
 const scenario=a.scenario||'no-membership';if(!['existing-member','no-membership','baseline-required','onboarding-required'].includes(scenario))throw Error('Unknown scenario.');
 const namespace='ui-lab-'+a['run-id'];const uid=namespace+'-athlete',email=`qa-athlete-${a['run-id']}@example.test`,password='SyntheticAthlete123!';
 const organizationId=namespace+'-org',teamId=namespace+'-team-a',otherTeamId=namespace+'-team-b';const {auth,db}=await client();
 let user;try{user=await auth.getUser(uid);if(user.email!==email)throw Error('Fixture UID ownership mismatch.');}catch(e){if(e.code!=='auth/user-not-found')throw e;user=await auth.createUser({uid,email,password,emailVerified:true,displayName:'Synthetic Athlete'});}
 const createdAt=new Date();const docs={};const participation={id:'synthetic-participation',title:'Synthetic participation',body:'Synthetic local test terms. No real agreement is created.',version:'synthetic-v1',category:'participation',required:true};const commercial={commercialModel:'team-plan',teamPlanStatus:'active',teamPlanBypassesPaywall:true,youthTrack:'pro',experienceAudience:'athletes'};
 docs[`users/${uid}`]={id:uid,uid,email,displayName:'Synthetic Athlete',phoneNumber:'+12025550123',username:namespace,sport:'Volleyball',firstName:'Synthetic',lastName:'Athlete',pulseCheckOnboardingComplete:scenario!=='onboarding-required',registrationComplete:scenario!=='onboarding-required',subscriptionType:'teamPlan',subscriptionPlatform:'Web',pulseCheckTeamCommercialAccess:{commercialModel:'team-plan',teamPlanStatus:'active',teamPlanBypassesPaywall:true},createdAt,updatedAt:createdAt,testLabRun:namespace};
 docs[`pulsecheck-organizations/${organizationId}`]={id:organizationId,displayName:'Synthetic Test University',legalName:'Synthetic Test University',status:'active',productBrand:'athleticmind',healthBaselineEnabled:false,testLabRun:namespace};
 for(const id of [teamId,otherTeamId])docs[`pulsecheck-teams/${id}`]={id,organizationId,displayName:id===teamId?'Synthetic Volleyball':'Synthetic Golf',status:'active',sportOrProgram:id===teamId?'Volleyball':'Golf',sportId:id===teamId?'volleyball':'golf',healthBaselineEnabled:false,requiredConsents:[participation],commercialConfig:commercial,commercialAccess:commercial,intake:{athlete:{version:'synthetic-v1',questions:[]}},testLabRun:namespace};
 if(scenario!=='no-membership')docs[`pulsecheck-team-memberships/${teamId}_${uid}`]={userId:uid,organizationId,teamId,role:'athlete',phone:'+12025550123',athleteAge:21,athleteTrackOverride:'pro',status:'active',revokedAt:null,removedAt:null,deletedAt:null,archivedAt:null,onboardingStatus:scenario==='onboarding-required'?'pending':'complete',commercialAccess:{commercialModel:'team-plan',teamPlanStatus:'active',teamPlanBypassesPaywall:true,sourceOrganizationId:organizationId,sourceTeamId:teamId},athleteOnboarding:{entryOnboardingName:'Synthetic Athlete',entryOnboardingStep:scenario==='onboarding-required'?'name':'complete',productConsentAccepted:scenario!=='onboarding-required',productConsentVersion:'synthetic-v1',researchConsentStatus:'not-required',eligibleForResearchDataset:false,enrollmentMode:'product-only',requiredConsents:[participation],completedConsentIds:scenario==='onboarding-required'?[]:['synthetic-participation'],completedConsentVersions:scenario==='onboarding-required'?{}:{'synthetic-participation':'synthetic-v1'},consentDecisions:scenario==='onboarding-required'?{}:{'synthetic-participation':{documentId:'synthetic-participation',document:participation,version:'synthetic-v1',decision:'accepted',signatureName:'Synthetic Athlete',body:participation.body,recordedAt:createdAt.toISOString()}},intakeResponses:{},baselinePathStatus:scenario==='baseline-required'?'pending':'complete'},createdAt,updatedAt:createdAt,testLabRun:namespace};
 if(a.training==='true'){
  if(scenario==='no-membership')throw Error('Training requires synthetic membership.');
  const skillId='protocol-478-breathing',versionId=namespace+'-version',audienceId=namespace+'-audience',today=createdAt.toISOString().slice(0,10),base='pulsecheck-linear-curriculum';
  const skill={id:skillId,name:'4-7-8 Breathing',type:'protocol',readiness:'Synthetic test fixture',rationale:'Synthetic local UI test',sourceRefs:[],aliases:[],catalogType:'protocol',classificationReason:'Synthetic local UI test'};
  const snapshot={id:skillId,name:'4-7-8 Breathing',category:'breathing',durationMinutes:5,description:'Practice steady breathing.',exerciseConfig:{type:'breathing',config:{cycles:4,phases:[{name:'inhale',duration:4,instruction:'Breathe in'},{name:'hold',duration:7,instruction:'Hold'},{name:'exhale',duration:8,instruction:'Breathe out'}]}}};
  docs[`${base}/versions/items/${versionId}`]={id:versionId,status:'published',publishedAt:today,content:{orderedIds:[skillId],rationales:{},audience:{mode:'explicit_athlete_ids',confirmed:true},progressionBasis:'five_days_in_fourteen',protocolDays:[5,5,5],simulationDays:null},skills:[skill],runtimeReadySkillIds:[skillId],contentSnapshots:{[skillId]:snapshot},testLabRun:namespace};
  docs[`${base}/versions/items/${versionId}/content/${skillId}`]={contentSnapshot:snapshot,testLabRun:namespace};
  docs[`${base}/audiences/items/${audienceId}`]={versionId,athleteIds:[uid],revision:1,testLabRun:namespace};
  docs[`${base}/states/items/${uid}`]={athleteId:uid,optedIn:true,audienceId,revision:1,enrollment:{athleteId:uid,versionId,optedIn:true,startedOn:today,timezone:'UTC',historyPolicy:'preserve'},currentSkill:{skillId,versionId,startedOn:today},completedSkillIds:[],testLabRun:namespace};
 }
 const batch=db.batch();for(const [p,v]of Object.entries(docs))batch.set(db.doc(p),v);await batch.commit();
 const manifest={version:1,projectId:PROJECT,namespace,scenario,createdAt:createdAt.toISOString(),accounts:{athlete:{uid,email,password}},organizationId,teamId,otherTeamId,documentPaths:Object.keys(docs),evidenceMode:'firebase-emulators',externalDelivery:'disabled',fixtureDigest:crypto.createHash('sha256').update(JSON.stringify(Object.keys(docs))).digest('hex')};
 const output=path.resolve(a.output||`/tmp/${namespace}-fixtures.json`);fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(manifest,null,2)+'\n',{mode:0o600});console.log(JSON.stringify({status:'seeded',projectId:PROJECT,namespace,scenario,manifestPath:output,documents:Object.keys(docs).length}));return manifest;
}
async function readback(a){const m=assertManifest(JSON.parse(fs.readFileSync(a.manifest,'utf8')));const {auth,db}=await client();const user=await auth.getUser(m.accounts.athlete.uid);const records=[];for(const p of m.documentPaths){const d=await db.doc(p).get();records.push({path:p,exists:d.exists,testLabRun:d.data()?.testLabRun});}console.log(JSON.stringify({status:'readback',projectId:PROJECT,namespace:m.namespace,accountExists:Boolean(user),records},null,2));return records;}
async function cleanup(a) {
 const m=assertManifest(JSON.parse(fs.readFileSync(a.manifest,'utf8')));
 const {auth}=await client(); // Validates demo project, loopback hosts and absence of cloud credentials.
 const uid=m.accounts.athlete.uid;
 // Native listener shutdown can leave emulator gRPC calls cancelled. Use the
 // emulator's REST API for one-shot cleanup; never request real credentials.
 const base=`http://${localHost(process.env.FIRESTORE_EMULATOR_HOST,'127.0.0.1:8080')}/v1/projects/${PROJECT}/databases/(default)/documents`;
 const encode=p=>p.split('/').map(encodeURIComponent).join('/');
 async function request(method,suffix,payload) {
  const r=await fetch(base+suffix,{method,headers:{'Authorization':'Bearer owner','Content-Type':'application/json'},
   body:payload?JSON.stringify(payload):undefined,signal:AbortSignal.timeout(10000)});
  if(r.status===404)return null;
  // Some emulator deletes commit but lose their response when a native watch
  // closes. Confirm absence independently; never treat an error alone as success.
  if(method==='DELETE'&&r.status===499&&await request('GET',suffix)===null)return null;
  if(!r.ok)throw Error(`Isolated cleanup REST ${method} ${suffix} failed (${r.status}): ${(await r.text()).slice(0,200)}`);
  return r.status===204?null:r.json();
 }
 const fields=d=>Object.fromEntries(Object.entries(d?.fields||{}).map(([k,v])=>[k,v.stringValue??v.booleanValue??v.integerValue]));
 const get=p=>request('GET','/'+encode(p));
 const remove=p=>request('DELETE','/'+encode(p));
 async function query(collection,field,value) {
  const pieces=collection.split('/'),collectionId=pieces.pop();
  const structuredQuery={from:[{collectionId}]};
  if(field)structuredQuery.where={fieldFilter:{field:{fieldPath:field},op:'EQUAL',value:{stringValue:value}}};
  const rows=await request('POST',(pieces.length?'/'+encode(pieces.join('/')):'')+':runQuery',{structuredQuery});
  return (rows||[]).filter(r=>r.document).map(r=>({path:r.document.name.split('/documents/')[1],data:fields(r.document)}));
 }
 for(const [collection,field] of [['pulsecheck-checkins','userId'],['pulsecheck-morning-checkins','athleteUserId']]) {
  for(const row of await query(collection,field,uid)) {
   if(row.data.testLabRun!==m.namespace)throw Error('Check-in cleanup ownership mismatch.');
   await remove(row.path);
  }
 }
 for(const id of [`performance_draft_${uid}_${QUESTIONNAIRE_VERSION}`,`skills_draft_${uid}_${QUESTIONNAIRE_VERSION}`,`baseline_${uid}_${QUESTIONNAIRE_VERSION}`]) {
  const p='pulsecheck-restricted-questionnaire-submissions/'+id,d=await get(p),v=fields(d);
  if(d&&(v.ownerUid===uid||v.externalId===uid))await remove(p);
 }
 // Actual native teaching/completion writers identify ownership by the exact
 // emulator UID path and userId, rather than adding test flags to product data.
 const privateUser='pulsecheck-private-users/'+uid;
 const privateDoc=await get(privateUser);
 if(privateDoc) {
  if(fields(privateDoc).userId!==uid)throw Error('Private fixture cleanup ownership mismatch.');
  await remove(privateUser);
 }
 const teaching='mental-training-education-progress/'+uid;
 const teachingDoc=await get(teaching);
 if(teachingDoc) {
  if(fields(teachingDoc).userId!==uid)throw Error('Teaching cleanup ownership mismatch.');
  await remove(teaching);
 }
 for(const row of await query('mental-exercise-completions/'+uid+'/completions')) {
  if(row.data.userId!==uid)throw Error('Exercise cleanup ownership mismatch.');
  await remove(row.path);
 }
 const state='pulsecheck-linear-curriculum/states/items/'+uid;
 if(fields(await get(state)).testLabRun===m.namespace) {
  for(const name of ['assignments','completions'])for(const row of await query(state+'/'+name)) {
   if(row.data.athleteId!==uid)throw Error('Curriculum cleanup ownership mismatch.');
   await remove(row.path);
  }
 }
 for(const p of m.documentPaths) {
  if(p.includes('..')||!p.includes(m.namespace))throw Error('Cleanup path outside fixture namespace.');
  const d=await get(p);
  if(d&&fields(d).testLabRun!==m.namespace)throw Error('Cleanup ownership mismatch.');
  if(p.startsWith('pulsecheck-team-memberships/')) {
   for(const row of await query(p+'/consent-events')) {
    if(row.data.actorUserId!==uid)throw Error('Consent cleanup actor mismatch.');
    await remove(row.path);
   }
  }
  await remove(p);
 }
 await auth.deleteUser(uid).catch(e=>{if(e.code!=='auth/user-not-found')throw e});
 console.log(JSON.stringify({status:'cleaned',namespace:m.namespace,documents:m.documentPaths.length,transport:'loopback-emulator-rest'}));
}
if(require.main===module){const a=args(process.argv.slice(2));({seed,readback,cleanup}[a.command]||(()=>{throw Error('Use seed, readback or cleanup.');}))(a).catch(e=>{console.error(JSON.stringify({status:'blocked',reason:e.message}));process.exitCode=2});}
module.exports={PROJECT,client,seed,readback,cleanup,assertManifest};
