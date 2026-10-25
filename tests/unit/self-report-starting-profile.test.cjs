const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path'), fs = require('node:fs'), ts = require('typescript');
require.extensions['.ts'] = (m,f) => m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,esModuleInterop:true,target:ts.ScriptTarget.ES2022}}).outputText,f);
const {validateSkillsDraft,skillsResult,saveSkills,completedStartingProfile}=require(path.resolve('src/lib/questionnaires/cau-skills.ts'));
const {MENTAL_SKILL_FAMILIES}=require(path.resolve('src/api/firebase/mentaltraining/mentalSkillsBaseline.ts'));
const {normalizeSelfReportStartingProfile}=require('../../netlify/functions/utils/self-report-starting-profile');
const draft=()=>({version:2,assessmentKind:'self_report_starting_profile',step:'tools',currentState:{mood:'okay',rest:3,energy:3,confidence:3,motivation:3,sportConnection:3,selfBelief:3,improvementBelief:3},familiarity:Object.fromEntries(MENTAL_SKILL_FAMILIES.map(f=>[f,'new_to_me'])),answeredFamiliarity:[]});

test('reported profile needs no challenge fields and never fabricates competency or evidence',()=>{
 const raw={...draft(),overallCompetencyScore:100,familyScores:{attention_cues:{score:100}},evidence:[{score:100}]};
 const clean=validateSkillsDraft(raw,true);assert.equal(clean.step,'result');assert.equal(clean.evidence,undefined);
 const profile=skillsResult(clean,'Golf');assert.equal(profile.version,6);assert.equal(profile.sportArchetype,'precision');
 assert.equal(profile.assessmentKind,'self_report_starting_profile');assert.equal(profile.overallCompetencyScore,undefined);assert.equal(profile.familyScores,undefined);assert.equal(profile.evidence,undefined);
 const canonical=normalizeSelfReportStartingProfile({...profile,...raw,version:6});
 assert.equal(canonical.overallCompetencyScore,undefined);assert.equal(canonical.evidence,undefined);assert.deepEqual(canonical.answeredFamiliarity,[]);
});
test('unfinished v1 drafts migrate reported values without carrying authored challenge scores',()=>{
 const raw=draft();raw.version=1;delete raw.assessmentKind;raw.step='attention';raw.familiarity.attention_cues='practiced_it';raw.evidence=[{score:100}];
 const clean=validateSkillsDraft(raw);assert.equal(clean.version,2);assert.equal(clean.step,'tools');assert.equal(clean.evidence,undefined);assert.deepEqual(clean.answeredFamiliarity,['attention_cues']);assert.equal(clean.familiarity.attention_cues,'practiced_it');
});
test('unknown or duplicate reported fields and malformed ratings cannot complete',()=>{
 for(const patch of [{version:3},{assessmentKind:'demonstrated_ability'},{step:'attention'},{currentState:{...draft().currentState,rest:0}},{familiarity:{}},{answeredFamiliarity:['attention_cues','attention_cues']},{answeredFamiliarity:['made_up']}])assert.throws(()=>validateSkillsDraft({...draft(),...patch},true));
 const profile=skillsResult(validateSkillsDraft(draft(),true));
 for(const patch of [{version:5},{assessmentKind:'fake'},{familiarity:{}},{currentState:{...profile.currentState,energy:5.5}},{answeredFamiliarity:['made_up']}])assert.throws(()=>normalizeSelfReportStartingProfile({...profile,...patch}));
});
test('canonical completion recognizes old v5 and explicit v6 but not unmarked new versions',()=>{
 assert.equal(completedStartingProfile({version:5}),true);assert.equal(completedStartingProfile(skillsResult(validateSkillsDraft(draft(),true))),true);assert.equal(completedStartingProfile({version:6}),false);assert.equal(completedStartingProfile(null),false);
});
test('a completed v1 private draft with failed canonical save retries from stored reports',async()=>{
 const stored=draft();stored.version=1;delete stored.assessmentKind;stored.familiarity.attention_cues='use_it';stored.currentState.energy=4;
 let previous={completed:true,revision:2,draft:stored,result:{version:5,overallCompetencyScore:99}};
 const db={runTransaction:async fn=>fn({get:async()=>({data:()=>previous}),set:(_r,v)=>{previous=v;}})};
 const result=await saveSkills(db,{}, {draft:draft(),revision:0},'athlete',true,'Golf');
 assert.equal(result.result.version,6);assert.equal(result.result.currentState.energy,4);assert.equal(result.result.familiarity.attention_cues,'use_it');assert.equal(result.result.overallCompetencyScore,undefined);assert.equal(result.revision,3);
});

test('canonical completion persists the unscored profile with a null taxonomy and provisional plan',async()=>{
 const Module=require('node:module'),originalLoad=Module._load;
 let persisted,profilePassed;
 const progressRef={get:async()=>({exists:false}),set:async value=>{persisted=value;}};
 const noMemberships={where(){return this;},get:async()=>({docs:[]})};
 const db={collection:name=>name==='athlete-mental-progress'?{doc:()=>progressRef}:noMemberships};
 const admin={auth:()=>({verifyIdToken:async()=>({uid:'athlete'})}),firestore:Object.assign(()=>db,{Timestamp:{fromMillis:n=>n}})};
 const firebase={initializeFirebaseAdmin(){},getFirebaseAdminApp:()=>({}),admin,headers:{}};
 const metrics={normalizeTrustDispositionBaseline:()=>null,deriveMentalSkillsBaselineProfile:()=>null};
 const runtime={PROFILE_VERSION:1,buildInitialAthleteProgress:()=>({}),prescribeNextSession:({profile})=>{profilePassed=profile;return{isProvisional:true};}};
 Module._load=function(request,parent,isMain){
  if(parent?.filename.endsWith('/netlify/functions/complete-pulsecheck-baseline.js')){
   if(request==='./config/firebase')return firebase;
   if(request==='./utils/pulsecheck-pilot-metrics')return metrics;
   if(request.includes('profileSnapshotRuntime'))return runtime;
  }
  return originalLoad.call(this,request,parent,isMain);
 };
 let handler;
 try{const filename=path.resolve('netlify/functions/complete-pulsecheck-baseline.js');delete require.cache[filename];handler=require(filename).handler;}finally{Module._load=originalLoad;}
 const profile=skillsResult(validateSkillsDraft(draft(),true),'Golf');
 const result=await handler({httpMethod:'POST',headers:{authorization:'Bearer synthetic'},body:JSON.stringify({userId:'athlete',mentalSkillsBaseline:{...profile,overallCompetencyScore:100,evidence:[{score:100}]}})});
 assert.equal(result.statusCode,200);assert.equal(profilePassed,null);assert.equal(persisted.taxonomyProfile,null);assert.deepEqual(persisted.activeProgram,{isProvisional:true});assert.equal(persisted.mentalSkillsBaseline.version,6);assert.equal(persisted.mentalSkillsBaseline.overallCompetencyScore,undefined);assert.equal(persisted.mentalSkillsBaseline.evidence,undefined);
});
