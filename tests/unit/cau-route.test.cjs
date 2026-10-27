const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),ts=require('typescript');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,esModuleInterop:true,target:ts.ScriptTarget.ES2022}}).outputText,f);
const healthDoc={id:'health',title:'Health choice',version:'v1',body:'Terms',category:'health_authorization'};
// Complete server-owned scope is part of every eligible fixture. Overrides exercise rejected scopes.
function fixtureMap(){const map=new Map();const put=map.set;map.set=function(key,value){
 if(key.startsWith('pulsecheck-teams/'))value={status:'active',organizationId:'org',requiredConsents:[healthDoc],...value};
 if(key.startsWith('pulsecheck-organizations/'))value={status:'active',productBrand:'athleticmind',...value};
 if(key.startsWith('pulsecheck-team-memberships/')&&!key.includes('/consent-events'))value={userId:'athlete',role:'athlete',teamId:key==='pulsecheck-team-memberships/real-membership-id'?'umes':'team',organizationId:'org',...value};
 return put.call(this,key,value);
};return map;}
let records=fixtureMap(),writes=[],providerCalls=0;
const snap=key=>({id:key.split('/').at(-1),ref:ref(key),exists:records.has(key),data:()=>records.get(key)});
const ref=key=>({key,id:key.split('/').at(-1),get:async()=>snap(key),collection:name=>collection(key+'/'+name)});
const collection=key=>({doc:(id='audit-'+writes.length)=>ref(key+'/'+id),where:(field,_op,value)=>({get:async()=>({docs:[...records.entries()].filter(([k,v])=>k.startsWith(key+'/')&&!k.slice(key.length+1).includes('/')&&v[field]===value).map(([k,v])=>({id:k.slice(key.length+1),data:()=>v}))})}),orderBy:()=>({limit:()=>({get:async()=>({docs:records.has(key)?[{data:()=>records.get(key)}]:[]})})})});
const db={collection,runTransaction:async fn=>fn({get:async r=>r.key?snap(r.key):r.get(),set:(r,value)=>{records.set(r.key,value);writes.push(value);},create:(r,value)=>{if(records.has(r.key))throw Error('exists');records.set(r.key,value);writes.push(value);}})};
const admin={auth:()=>({verifyIdToken:async token=>{if(token!=='valid')throw Error('bad token');return {uid:'athlete',email:'athlete@example.com'};}}),firestore:Object.assign(()=>db,{FieldValue:{serverTimestamp:()=> 'server-time'}})};
require.cache[path.resolve('src/lib/firebase-admin.ts')]={id:path.resolve('src/lib/firebase-admin.ts'),filename:path.resolve('src/lib/firebase-admin.ts'),loaded:true,exports:{__esModule:true,default:admin,getFirebaseAdminApp:()=>({})}};
const handler=require(path.resolve('src/pages/api/pulsecheck/questionnaire/cau.ts')).default;
const root='pulsecheck-restricted-questionnaire-submissions/';
function setup(){records=fixtureMap();writes=[];providerCalls=0;process.env.CAU_QUESTIONNAIRE_COLLECTION_ENABLED='true';process.env.AUNTEDNA_PARTNER_TEST_KEY='ae_pk_test_fake';
 records.set(root+'assignment_athlete',{kind:'assignment',enabled:true,version:'cau-operational-web-v1',teamId:'team',submissionId:'sub-1',environment:'test',universityCode:'SANDBOX'});
 records.set('pulsecheck-teams/team',{});records.set('pulsecheck-organizations/org',{});
 const decisions={health:{decision:'declined',version:'v1',document:healthDoc,signedName:''}};
 records.set('pulsecheck-team-memberships/team_athlete',{status:'active',athleteOnboarding:{consentDecisions:decisions}});
 records.set('pulsecheck-team-memberships/team_athlete/consent-events',{actorUserId:'athlete',decisions});
 records.set('athlete-mental-progress/athlete',{mentalSkillsBaseline:{version:5}});
 global.fetch=async(_url,opts)=>{providerCalls++; const sent=JSON.parse(opts.body);return Response.json({success:true,requestId:'request',data:{baselineId:'baseline',athleteId:'ae-athlete',externalId:'athlete',submissionId:sent.submissionId,receivedAt:'2026-09-16T12:00:00Z',created:providerCalls===1}});};
}
async function call(method,body,token='valid'){let result={status:200};const res={setHeader(){},status(n){result.status=n;return this;},json(v){result.body=v;return this;},end(){return this;}};await handler({method,headers:{authorization:'Bearer '+token},body:method==='POST'?{questionnaireVersion:'athlete-starting-point-v2',...body}:body},res);return result;}
const body={questionnaireVersion:'athlete-starting-point-v2',name:'Fictional Athlete',email:'test@example.com',answers:{'cau-starting-point-39':'Less than 5 hours'},completedSections:{performance:true,health:true},shareHealth:true};
test('status is authenticated and only active assigned accounts are required',async()=>{setup();assert.equal((await call('GET',null,'invalid')).status,401);assert.equal((await call('GET')).body.required,true);records.delete(root+'assignment_athlete');assert.equal((await call('GET')).body.required,false);});
test('no consent cannot transmit health; performance-only resolution does not store clinical values',async()=>{setup();assert.equal((await call('POST',body)).status,403);assert.equal(providerCalls,0);assert.equal((await call('POST',{...body,shareHealth:false})).body.saved,true);assert.equal(providerCalls,0);assert.equal(JSON.stringify(writes).includes('Less than 5 hours'),false);assert.equal((await call('GET')).body.completed,true);});
test('signed current authorization saves a private backup, sends health once and keeps mirror references only',async()=>{setup();const doc={id:'health',title:'Health choice',version:'v1',body:'Terms',category:'health_authorization'};const decisions={health:{decision:'accepted',version:'v1',document:doc,signedName:'Fictional Athlete'}};records.set('pulsecheck-teams/team',{requiredConsents:[doc]});records.set('pulsecheck-team-memberships/team_athlete',{status:'active',athleteOnboarding:{consentDecisions:decisions}});records.set('pulsecheck-team-memberships/team_athlete/consent-events',{actorUserId:'athlete',decisions});assert.equal((await call('POST',body)).body.saved,true);assert.equal(providerCalls,1);assert.equal(JSON.stringify(writes.filter(value=>value.kind!=='health_backup')).includes('Less than 5 hours'),false);assert.ok(writes.some(value=>value.kind==='health_backup'));assert.equal((await call('POST',body)).body.saved,true);assert.equal(providerCalls,1);assert.equal((await call('GET')).body.required,false);});
test('retired assignments and incomplete sections cannot submit',async()=>{setup();assert.equal((await call('POST',{...body,completedSections:{performance:true}})).status,400);records.set('pulsecheck-team-memberships/team_athlete',{status:'inactive'});assert.equal((await call('POST',body)).status,503);assert.equal(providerCalls,0);});

test('stale clients are rejected before writes and old drafts never resume as new questions',async()=>{
 setup();records.set(root+'performance_draft_athlete_cau-operational-web-v1',{version:'cau-operational-web-v1',answers:{'cau-operational-35':'Agree'},completed:true});
 const status=(await call('GET')).body;assert.equal(status.version,'cau-operational-web-v1');assert.equal(status.questionnaireVersion,'athlete-starting-point-v2');assert.equal(status.draft,null);
 const stale=await call('POST',{...body,questionnaireVersion:'cau-operational-web-v1'});assert.equal(stale.status,409);assert.match(stale.body.error,/Reload/);assert.equal(writes.length,0);assert.equal(providerCalls,0);
});
test('completed legacy records satisfy existing assignments without rewriting historical answers',async()=>{
 setup();const historical={status:'complete',externalId:'athlete',version:'cau-operational-web-v1',fields:{'cau-operational-35':{value:'Agree'}}};
 records.set(root+'baseline_athlete_cau-operational-web-v1',historical);
 const result=(await call('GET')).body;assert.equal(result.completed,true);assert.equal(result.required,false);assert.equal(result.draft,null);
 assert.equal((await call('POST',body)).body.completed,true);assert.equal(writes.length,0);assert.equal(providerCalls,0);assert.deepEqual(records.get(root+'baseline_athlete_cau-operational-web-v1'),historical);
});

test('new progress writes only the new namespace and resumes at the same question',async()=>{
 setup();const oldKey=root+'performance_draft_athlete_cau-operational-web-v1';const old={version:'cau-operational-web-v1',answers:{'cau-operational-35':'Agree'},completed:true};records.set(oldKey,old);
 const draft={version:'athlete-starting-point-v2',flowVersion:4,name:'Tester',answers:{'cau-starting-point-46':['Focus']},position:0,completed:false,revision:0};
 const result=await call('POST',{action:'savePerformanceDraft',draft});assert.equal(result.status,200);assert.equal(result.body.draft.revision,1);
 assert.deepEqual(records.get(oldKey),old);assert.equal(records.get(root+'performance_draft_athlete_athlete-starting-point-v2').position,0);
 const resumed=(await call('GET')).body.draft;assert.equal(resumed.version,'athlete-starting-point-v2');assert.equal(resumed.position,0);assert.deepEqual(resumed.answers,{'cau-starting-point-46':['Focus']});
});
test('missing content version rejects every stale mutation including draft and skills saves',async()=>{
 for(const action of [undefined,'savePerformanceDraft','saveSkillsDraft','completeSkills']){setup();const result=await call('POST',{...body,action,questionnaireVersion:undefined});assert.equal(result.status,409);assert.equal(writes.length,0);assert.equal(providerCalls,0);}
});

test('the standard baseline reuses completed prior content without reopening it',async()=>{
 setup(); records.set(root+'baseline_athlete_cau-starting-point-v2',{status:'complete',externalId:'athlete',version:'cau-starting-point-v2'});
 const result=(await call('GET')).body; assert.equal(result.completed,true);assert.equal(result.required,false);assert.equal(writes.length,0);
});
test('activity context follows the provisioned sport with a neutral fallback',async()=>{
 setup(); records.set('pulsecheck-teams/team',{sportOrProgram:'Golf'});
 assert.equal((await call('GET')).body.sportName,'Golf');
 records.set('pulsecheck-teams/team',{});assert.equal((await call('GET')).body.sportName,'Sport');
});

test('an unfinished school-specific client must reload the standard content before saving',async()=>{
 setup();const result=await call('POST',{...body,questionnaireVersion:'cau-starting-point-v2'});assert.equal(result.status,409);assert.equal(writes.length,0);
});
test('starting profile completes without challenges and uses provisioned sport, not browser claims',async()=>{
 const lib=require(path.resolve('src/api/firebase/mentaltraining/mentalSkillsBaseline.ts'));
 for(const [sport,archetype] of [['Golf','precision'],['Basketball','invasion'],['Sport','general']]) {
  setup();records.delete('athlete-mental-progress/athlete');records.set('pulsecheck-teams/team',{sportOrProgram:sport});
  const draft={version:'athlete-starting-point-v2',flowVersion:4,name:'Athlete',answers:{},position:0,completed:true,revision:0};
  assert.equal((await call('POST',{action:'savePerformanceDraft',draft})).status,200);
  assert.equal((await call('POST',{...body,shareHealth:false})).status,400);
  const skillsDraft={version:2,assessmentKind:'self_report_starting_profile',step:'tools',sportName:'Volleyball',currentState:{mood:'okay',rest:3,energy:3,confidence:3,motivation:3,sportConnection:3,selfBelief:3,improvementBelief:3},familiarity:Object.fromEntries(lib.MENTAL_SKILL_FAMILIES.map(f=>[f,'new_to_me'])),answeredFamiliarity:['attention_cues'],overallCompetencyScore:9999,evidence:[{score:9999}]};
  let canonicalPayload;global.fetch=async(_url,options)=>{canonicalPayload=JSON.parse(options.body);return Response.json({success:true});};
  const result=await call('POST',{action:'completeSkills',draft:skillsDraft,revision:0});
  assert.equal(result.status,200);assert.equal(result.body.skills.completed,true);
  const profile=canonicalPayload.mentalSkillsBaseline;
  assert.equal(profile.version,6);assert.equal(profile.assessmentKind,'self_report_starting_profile');
  assert.equal(profile.sportName,sport);assert.equal(profile.sportArchetype,archetype);
  assert.equal(profile.evidence,undefined);assert.equal(profile.familyScores,undefined);assert.equal(profile.overallCompetencyScore,undefined);
  assert.deepEqual(profile.answeredFamiliarity,['attention_cues']);
  assert.equal((await call('GET')).body.completed,false,'a private skills draft cannot unlock the baseline');
  records.set('athlete-mental-progress/athlete',{mentalSkillsBaseline:profile});
  const status=(await call('GET')).body;assert.equal(status.skills.completed,true);assert.equal(status.completed,false);
  assert.equal((await call('POST',{...body,shareHealth:false})).body.completed,true);
 }
});
test('canonical write failure is retryable without repeating or fabricating challenges',async()=>{
 setup();records.delete('athlete-mental-progress/athlete');
 await call('POST',{action:'savePerformanceDraft',draft:{version:'athlete-starting-point-v2',flowVersion:4,name:'Athlete',answers:{},position:0,completed:true,revision:0}});
 const lib=require(path.resolve('src/api/firebase/mentaltraining/mentalSkillsBaseline.ts'));
 const draft={version:2,assessmentKind:'self_report_starting_profile',step:'tools',currentState:{mood:'solid',rest:3,energy:4,confidence:3,motivation:3,sportConnection:3,selfBelief:3,improvementBelief:3},familiarity:Object.fromEntries(lib.MENTAL_SKILL_FAMILIES.map(f=>[f,'new_to_me'])),answeredFamiliarity:[]};
 global.fetch=async()=>{throw Error('interrupted');};
 assert.equal((await call('POST',{action:'completeSkills',draft,revision:0})).status,503);
 const status=(await call('GET')).body;assert.equal(status.completed,false);assert.equal(status.skills.completed,false);
 let saved;global.fetch=async(_u,opts)=>{saved=JSON.parse(opts.body).mentalSkillsBaseline;return Response.json({success:true});};
 assert.equal((await call('POST',{action:'completeSkills',draft,revision:0})).body.skills.completed,true);
 assert.equal(saved.currentState,undefined);assert.equal(saved.overallCompetencyScore,undefined);
});
test('active team athletes get a standard requirement without manual assignment, and skills alone cannot release it',async()=>{
 setup();records.delete(root+'assignment_athlete');
 records.set('pulsecheck-team-memberships/real-membership-id',{userId:'athlete',role:'athlete',teamId:'umes',status:'active',baselineJoinedAt:'2026-10-26',athleteOnboarding:{entryOnboardingStep:'complete',productConsentAccepted:true}});
 const families=require('../../src/api/firebase/mentaltraining/mentalSkillsBaseline.ts').MENTAL_SKILL_FAMILIES;
 records.set('athlete-mental-progress/athlete',{mentalSkillsBaseline:{version:6,assessmentKind:'self_report_starting_profile',familiarity:Object.fromEntries(families.map(f=>[f,'new_to_me'])),answeredFamiliarity:[]}});
 records.set('pulsecheck-teams/umes',{sportOrProgram:'Golf'});
 const initial=await call('GET');assert.equal(initial.status,200);assert.equal(initial.body.required,true);assert.equal(initial.body.healthCollectionAvailable,false);assert.equal(initial.body.healthBackupAvailable,false);assert.equal(initial.body.providerDeliveryAvailable,false);
 assert.equal(records.get(root+'assignment_athlete').teamMembershipId,'real-membership-id');
 assert.equal(initial.body.skills.completed,true);assert.equal(initial.body.completed,false);
 records.set(root+'baseline_athlete_athlete-starting-point-v2',{status:'complete',externalId:'athlete'});
 const finished=await call('GET');assert.equal(finished.body.completed,false);assert.equal(finished.body.required,true);
 assert.equal(finished.body.reviewId,initial.body.reviewId,'account completion does not satisfy a new join');
});
test('a temporarily unavailable baseline never clears an unfinished requirement',async()=>{
 setup();process.env.ATHLETE_BASELINE_ENABLED='false';
 try {const result=await call('GET');assert.equal(result.body.required,true);assert.equal(result.body.available,false);}
 finally {delete process.env.ATHLETE_BASELINE_ENABLED;}
});
test('a provider delivery failure still completes a durable private backup and reports unverified storage',async()=>{
 setup();const doc={id:'health',title:'Health choice',version:'v1',body:'Terms',category:'health_authorization'};
 const decisions={health:{decision:'accepted',version:'v1',document:doc,signedName:'Fictional Athlete'}};
 records.set('pulsecheck-teams/team',{requiredConsents:[doc]});records.set('pulsecheck-team-memberships/team_athlete',{status:'active',athleteOnboarding:{consentDecisions:decisions}});
 records.set('pulsecheck-team-memberships/team_athlete/consent-events',{actorUserId:'athlete',decisions});
 const transport=global.fetch;global.fetch=async()=>{throw Error('network interrupted');};
 const result=await call('POST',body);assert.equal(result.status,200);assert.equal(result.body.receipt.healthStorage,'pulse_private_backup');assert.equal(result.body.receipt.providerVerified,false);
 assert.equal((await call('GET')).body.completed,true);
 global.fetch=transport;assert.equal((await call('POST',body)).body.completed,true);
 assert.equal((await call('GET')).body.required,false);
});

test('older clients polling before team consent are allowed to finish onboarding first',async()=>{
 setup();records.set('pulsecheck-team-memberships/team_athlete',{status:'active',athleteOnboarding:{entryOnboardingStep:'consent',productConsentAccepted:false}});
 const result=await call('GET');assert.equal(result.body.required,false);assert.equal(result.body.available,false);
 assert.equal((await call('POST',{...body,shareHealth:false})).status,503);
});

test('health baseline defaults on while provider readiness and authorization stay independent',async()=>{
 setup();records.set('pulsecheck-teams/team',{organizationId:'org'});
 assert.equal((await call('GET')).body.healthBaselineEnabled,true);
 const assignment=records.get(root+'assignment_athlete');records.set(root+'assignment_athlete',{...assignment,environment:'unconfigured',universityCode:''});
 const status=(await call('GET')).body;assert.equal(status.healthBaselineEnabled,true);assert.equal(status.healthCollectionAvailable,false);assert.equal(status.healthSharingAllowed,false);
 assert.equal((await call('POST',body)).status,403);assert.equal(providerCalls,0);
});
test('team or inherited organization policy can disable health without authorizing transmission',async()=>{
 setup();records.set('pulsecheck-teams/team',{organizationId:'org'});records.set('pulsecheck-organizations/org',{healthBaselineEnabled:false});
 assert.equal((await call('GET')).body.healthBaselineEnabled,false);
 records.set('pulsecheck-teams/team',{organizationId:'org',healthBaselineEnabled:true});assert.equal((await call('GET')).body.healthBaselineEnabled,true);
 records.set('pulsecheck-teams/team',{organizationId:'org',healthBaselineEnabled:false});
 const doc={id:'health',title:'Health choice',version:'v1',body:'Terms',category:'health_authorization'};
 const decisions={health:{decision:'accepted',version:'v1',document:doc,signedName:'Fictional Athlete'}};
 records.set('pulsecheck-teams/team',{organizationId:'org',healthBaselineEnabled:false,requiredConsents:[doc]});
 records.set('pulsecheck-team-memberships/team_athlete',{status:'active',athleteOnboarding:{consentDecisions:decisions}});
 records.set('pulsecheck-team-memberships/team_athlete/consent-events',{actorUserId:'athlete',decisions});
 assert.equal((await call('GET')).body.healthSharingAllowed,false);assert.equal((await call('POST',body)).status,403);assert.equal(providerCalls,0);
 assert.equal((await call('POST',{...body,shareHealth:false})).body.completed,true);
});

test('default health authorization is explicit and missing authorization cannot erase an existing baseline requirement',async()=>{
 setup();records.set('pulsecheck-teams/team',{organizationId:'org'});records.set('pulsecheck-organizations/org',{productBrand:'athleticmind'});records.set('pulsecheck-team-memberships/team_athlete',{status:'active'});records.delete('pulsecheck-team-memberships/team_athlete/consent-events');
 const status=(await call('GET')).body;assert.equal(status.required,true);assert.equal(status.healthBaselineEnabled,true);assert.equal(status.healthSharingAllowed,false);assert.equal(status.healthAuthorizationRequired,true);assert.equal(status.healthAuthorizationDecision,'pending');assert.equal(status.healthAuthorizationUrl,'/PulseCheck/athlete-onboarding?organizationId=org&teamId=team');
});
test('an explicit current health decline remains honored and is not treated as missing consent',async()=>{
 setup();const doc={id:'health',title:'Health choice',version:'v1',body:'Terms',category:'health_authorization'};
 const decisions={health:{decision:'declined',version:'v1',document:doc,signedName:'Fictional Athlete'}};
 records.set('pulsecheck-teams/team',{requiredConsents:[doc]});
 records.set('pulsecheck-team-memberships/team_athlete',{status:'active',athleteOnboarding:{consentDecisions:decisions}});records.set('pulsecheck-team-memberships/team_athlete/consent-events',{actorUserId:'athlete',decisions});
 const status=(await call('GET')).body;assert.equal(status.required,true);assert.equal(status.healthSharingAllowed,false);assert.equal(status.healthAuthorizationRequired,false);assert.equal(status.healthAuthorizationDecision,'declined');
 assert.equal((await call('POST',{...body,shareHealth:false})).body.completed,true);assert.equal(providerCalls,0);
});

test('v1 in-progress projection preserves goal/name/explicit experience and leaves old records untouched',async()=>{
 setup();records.delete('athlete-mental-progress/athlete');
 const lib=require(path.resolve('src/api/firebase/mentaltraining/mentalSkillsBaseline.ts'));
 const performance={version:'athlete-starting-point-v1',name:'Saved Athlete',answers:{'cau-starting-point-46':['Focus'],'cau-starting-point-05':'Mostly'},completed:true,position:4,revision:9};
 const oldSkills={draft:{version:1,step:'attention',familiarity:Object.fromEntries(lib.MENTAL_SKILL_FAMILIES.map(f=>[f,f==='attention_cues'?'use_it':'new_to_me'])),currentState:{energy:5},evidence:[{score:99}]},revision:4};
 const performanceKey=root+'performance_draft_athlete_athlete-starting-point-v1',skillsKey=root+'skills_draft_athlete_athlete-starting-point-v1';
 records.set(performanceKey,performance);records.set(skillsKey,oldSkills);
 const status=(await call('GET')).body;assert.equal(status.draft.version,'athlete-starting-point-v2');assert.equal(status.draft.name,'Saved Athlete');assert.equal(status.draft.revision,0);assert.equal(status.draft.position,0);assert.deepEqual(status.draft.answers,{'cau-starting-point-46':['Focus']});
 assert.equal(status.skills.revision,0);assert.deepEqual(status.skills.draft.answeredFamiliarity,['attention_cues']);assert.equal(status.skills.draft.currentState,undefined);assert.equal(status.skills.draft.evidence,undefined);assert.equal(writes.length,0);
 assert.equal((await call('POST',{action:'savePerformanceDraft',draft:status.draft})).status,200);
 assert.deepEqual(records.get(performanceKey),performance);assert.deepEqual(records.get(skillsKey),oldSkills);
 assert.equal((await call('POST',{action:'savePerformanceDraft',questionnaireVersion:'athlete-starting-point-v1',draft:performance})).status,409);
});
test('completed prior standard baselines skip without replacing answers or retaking skills',async()=>{
 setup();const historical={status:'complete',externalId:'athlete',version:'athlete-starting-point-v1',fields:{'cau-starting-point-05':{value:'Mostly'}}};
 records.set(root+'baseline_athlete_athlete-starting-point-v1',historical);
 const status=(await call('GET')).body;assert.equal(status.completed,true);assert.equal(status.required,false);assert.equal(writes.length,0);assert.deepEqual(records.get(root+'baseline_athlete_athlete-starting-point-v1'),historical);
});
test('mismatched signer, membership, team and organization cannot authorize transmission',async()=>{
 for(const patch of [{userId:'foreign'},{organizationId:'foreign'},{teamId:'foreign'},{role:'coach'}]){
  setup();records.set('pulsecheck-team-memberships/team_athlete',{...records.get('pulsecheck-team-memberships/team_athlete'),...patch});
  const status=(await call('GET')).body;assert.equal(status.available,false);assert.equal(status.healthSharingAllowed,false);assert.equal((await call('POST',body)).status,503);assert.equal(providerCalls,0);
 }
});
test('pending health choice cannot be silently converted to performance-only completion',async()=>{
 setup();records.set('pulsecheck-team-memberships/team_athlete',{status:'active'});records.delete('pulsecheck-team-memberships/team_athlete/consent-events');
 const status=(await call('GET')).body;assert.equal(status.required,true);assert.equal(status.healthAuthorizationRequired,true);
 assert.equal((await call('POST',{...body,shareHealth:false})).status,409);assert.equal(writes.length,0);assert.equal(providerCalls,0);
});

function addNewTeam(team='second', joinedAt='2026-10-26T17:00:00Z') {
 const decisions={health:{decision:'declined',version:'v1',document:healthDoc,signedName:''}};
 records.set(`pulsecheck-teams/${team}`,{displayName:team,healthBaselineEnabled:false});
 records.set(`pulsecheck-team-memberships/${team}_athlete`,{userId:'athlete',role:'athlete',teamId:team,organizationId:'org',status:'active',baselineJoinedAt:joinedAt,athleteOnboarding:{entryOnboardingStep:'complete',productConsentAccepted:true,consentDecisions:decisions}});
 records.set(`pulsecheck-team-memberships/${team}_athlete/consent-events`,{actorUserId:'athlete',decisions});
}
function previousBaseline() {
 const families=require('../../src/api/firebase/mentaltraining/mentalSkillsBaseline.ts').MENTAL_SKILL_FAMILIES;
 records.set('athlete-mental-progress/athlete',{mentalSkillsBaseline:{version:6,assessmentKind:'self_report_starting_profile',completedAt:10,familiarity:Object.fromEntries(families.map(f=>[f,'use_it'])),answeredFamiliarity:families}});
 records.set(root+'baseline_athlete_athlete-starting-point-v2',{status:'complete',externalId:'athlete',submissionId:'original-completion',identity:{name:'Previous Athlete',email:'previous@example.test'},fields:{'cau-starting-point-46':{state:'local',value:['Focus']}},auntEdnaReferences:{'cau-starting-point-39':{state:'external',recordId:'not-an-answer'}}});
}
test('a new team requires explicit review even after a completed baseline; prior answers remain unchanged',async()=>{
 setup();previousBaseline();addNewTeam();
 const old=structuredClone(records.get(root+'baseline_athlete_athlete-starting-point-v2'));
 const initial=await call('GET');assert.equal(initial.status,200);assert.equal(initial.body.required,true);assert.equal(initial.body.completed,false);
 assert.equal(initial.body.teamName,'second');assert.equal(initial.body.prefill.prefilledQuestionCount,9);
 assert.deepEqual(initial.body.prefill.answers,{'cau-starting-point-46':['Focus']});assert.equal(initial.body.prefill.unavailableHealthAnswers,true);
 assert.equal(JSON.stringify(initial.body.prefill).includes('not-an-answer'),false);
 const input={...body,answers:initial.body.prefill.answers,shareHealth:false,reviewId:initial.body.reviewId};
 assert.equal((await call('POST',input)).status,400);
 assert.equal((await call('POST',{...input,reviewId:'another-join',acceptPrefilled:true})).status,409);
 assert.equal((await call('POST',{...input,acceptPrefilled:true})).body.saved,true);
 assert.deepEqual(records.get(root+'baseline_athlete_athlete-starting-point-v2'),old);
 const review=records.get(root+require('../../src/lib/questionnaires/team-baseline-review.ts').teamBaselineRecordId(initial.body.reviewId));
 assert.equal(review.teamId,'second');assert.equal(review.reviewedBy,'athlete');assert.equal(review.acceptedPrefilled,true);
 assert.equal((await call('GET')).body.required,false);
});
test('multiple new teams are reviewed separately and rejoining creates another requirement',async()=>{
 setup();previousBaseline();addNewTeam('a-new');addNewTeam('z-new');
 const first=(await call('GET')).body;
 await call('POST',{...body,answers:first.prefill.answers,shareHealth:false,reviewId:first.reviewId,acceptPrefilled:true});
 const second=(await call('GET')).body;assert.equal(second.required,true);assert.equal(second.teamName,'z-new');assert.notEqual(first.reviewId,second.reviewId);
 assert.equal((await call('POST',{...body,shareHealth:false,reviewId:first.reviewId,acceptPrefilled:true})).status,409);
 await call('POST',{...body,answers:second.prefill.answers,shareHealth:false,reviewId:second.reviewId,acceptPrefilled:true});
 assert.equal((await call('GET')).body.required,false);
 addNewTeam('a-new','2026-10-27T17:00:00Z');
 const rejoin=(await call('GET')).body;assert.equal(rejoin.required,true);assert.notEqual(rejoin.reviewId,first.reviewId);
 assert.equal((await call('GET')).body.reviewId,rejoin.reviewId,'repeated checks do not create another join');
});
test('new-team drafts are isolated and revoked memberships cannot reuse their pending review',async()=>{
 setup();previousBaseline();addNewTeam();const initial=(await call('GET')).body;
 const draft={version:'athlete-starting-point-v2',name:'Current Athlete',answers:{'cau-starting-point-46':['Confidence']},position:0,completed:true,revision:0};
 assert.equal((await call('POST',{action:'savePerformanceDraft',reviewId:initial.reviewId,draft})).status,200);
 assert.equal(records.has(root+'performance_draft_athlete_athlete-starting-point-v2'),false);
 assert.deepEqual((await call('GET')).body.draft.answers,draft.answers);
 const member=records.get('pulsecheck-team-memberships/second_athlete');member.status='inactive';
 assert.equal((await call('POST',{...body,shareHealth:false,reviewId:initial.reviewId,acceptPrefilled:true})).status,409);
});

test('an earlier team verified receipt is never reported as the new team review receipt',async()=>{
 setup();
 const backupId='health_backup_'+'a'.repeat(64);
 records.set(root+'baseline_athlete_athlete-starting-point-v2',{status:'complete',externalId:'athlete',reviewId:'old-team-review',healthBackupId:backupId});
 records.set(root+backupId,{kind:'health_backup',externalId:'athlete',submissionId:'old-submission',deliveryStatus:'verified',backupRetained:true,receipt:{externalId:'athlete',submissionId:'old-submission',baselineId:'old-baseline',athleteId:'old-athlete',requestId:'old-request',receivedAt:'2026-10-01T00:00:00Z',created:true}});
 records.set('pulsecheck-team-memberships/real-membership-id',{userId:'athlete',role:'athlete',teamId:'umes',status:'active',baselineJoinedAt:'2026-10-26',athleteOnboarding:{entryOnboardingStep:'complete',productConsentAccepted:true}});
 records.set('pulsecheck-teams/umes',{sportOrProgram:'Golf'});
 const status=await call('GET');assert.equal(status.status,200);assert.equal(status.body.required,true);assert.ok(status.body.reviewId);assert.equal(status.body.receipt,null);
});

test('a reserved submission never silently replaces the submitted performance answers',async()=>{
 setup();assert.equal((await call('POST',{...body,shareHealth:false})).body.saved,true);
 records.delete(root+'baseline_athlete_athlete-starting-point-v2');const before=writes.length;
 const changed=await call('POST',{...body,shareHealth:false,answers:{'cau-starting-point-46':['Focus']}});
 assert.equal(changed.status,409);assert.equal(writes.length,before);assert.equal(providerCalls,0);
});

test('global completion does not imply that every team health delivery was provider-verified',async()=>{
 setup();const backupId='health_backup_'+'b'.repeat(64);
 records.set(root+'baseline_athlete_athlete-starting-point-v2',{status:'complete',externalId:'athlete',healthBackupId:backupId});
 records.set(root+backupId,{kind:'health_backup',externalId:'athlete',submissionId:'old-submission',deliveryStatus:'verified',backupRetained:true,receipt:{externalId:'athlete',submissionId:'old-submission',baselineId:'old-baseline',athleteId:'old-athlete',requestId:'old-request',receivedAt:'2026-10-01T00:00:00Z',created:true}});
 const result=await call('GET');assert.equal(result.body.completed,true);assert.equal(result.body.receipt,null);
 assert.equal((await call('POST',body)).body.receipt,null);
});

test('a malformed stored verification flag cannot produce an AuntEdna-confirmed athlete receipt',async()=>{
 setup();records.set('pulsecheck-team-memberships/real-membership-id',{userId:'athlete',role:'athlete',teamId:'umes',status:'active',baselineJoinedAt:'2026-10-26',athleteOnboarding:{entryOnboardingStep:'complete',productConsentAccepted:true}});records.set('pulsecheck-teams/umes',{sportOrProgram:'Golf'});
 const first=await call('GET'),reviewId=first.body.reviewId,backupId='health_backup_'+'c'.repeat(64);
 records.set(root+`team_baseline_${reviewId}_athlete-starting-point-v2`,{externalId:'athlete',status:'pending',reviewId,healthBackupId:backupId});
 records.set(root+backupId,{kind:'health_backup',externalId:'athlete',submissionId:'submission',deliveryStatus:'verified',backupRetained:true,receipt:{externalId:'another',submissionId:'submission'}});
 const current=await call('GET');assert.equal(current.body.receipt.providerVerified,false);assert.equal(current.body.receipt.healthStorage,'pulse_private_backup');
});
