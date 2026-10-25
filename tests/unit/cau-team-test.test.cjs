const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),ts=require('typescript');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,esModuleInterop:true,target:ts.ScriptTarget.ES2022}}).outputText,f);
let records=new Map(),writes=[],providerCalls=0;
const snap=key=>({exists:records.has(key),data:()=>records.get(key)});
const ref=key=>({key,get:async()=>snap(key),collection:name=>collection(key+'/'+name)});
const collection=key=>({doc:id=>ref(key+'/'+id),orderBy:()=>({limit:()=>({get:async()=>({docs:records.has(key)?[{data:()=>records.get(key)}]:[]})})})});
const db={collection,runTransaction:async fn=>fn({get:async r=>snap(r.key),set:(r,value)=>{records.set(r.key,value);writes.push(value);},create:(r,value)=>{if(records.has(r.key))throw Error('exists');records.set(r.key,value);writes.push(value);}})};
const admin={auth:()=>({verifyIdToken:async token=>{if(token!=='valid')throw Error('bad token');return {uid:'athlete',email:'athlete@example.com'};}}),firestore:Object.assign(()=>db,{FieldValue:{serverTimestamp:()=> 'server-time'}})};
require.cache[path.resolve('src/lib/firebase-admin.ts')]={id:path.resolve('src/lib/firebase-admin.ts'),filename:path.resolve('src/lib/firebase-admin.ts'),loaded:true,exports:{__esModule:true,default:admin,getFirebaseAdminApp:()=>({})}};
const handler=require(path.resolve('src/pages/api/pulsecheck/questionnaire/cau-team-test.ts')).default;
function setup(){records=new Map();writes=[];providerCalls=0;process.env.CAU_TEAM_TEST_INVITE='test-invite';process.env.CAU_TEAM_TEST_CAMPAIGN='test-campaign';process.env.CAU_TEAM_TEST_EXPIRES_AT='2099-01-01T00:00:00Z';process.env.AUNTEDNA_PARTNER_TEST_KEY='ae_pk_test_fake';
 records.set('pulsecheck-restricted-questionnaire-submissions/sandbox_skills_test-campaign_'+require('crypto').createHash('sha256').update('test-campaign:athlete').digest('hex').slice(0,32)+'_athlete-starting-point-v1',{completed:true,result:{version:5}});
 global.fetch=async(url,opts)=>{providerCalls++;const body=JSON.parse(opts.body);assert.equal(body.universityCode,'SANDBOX');assert.equal(body.identity.email.includes('athlete@'),false);assert.equal(Object.keys(body.fields).length,19);assert.equal(body.fields['cau-starting-point-46'],undefined);return Response.json({success:true,requestId:'request',data:{baselineId:'baseline',athleteId:'ae-athlete',externalId:url.split('/').at(-2),submissionId:body.submissionId,receivedAt:'2026-09-18T12:00:00Z',created:true}});};
}
async function call(method,body,invite='test-invite',token='valid'){let result={status:200};const res={setHeader(){},status(n){result.status=n;return this;},json(v){result.body=v;return this;},end(){return this;}};await handler({method,headers:{authorization:'Bearer '+token,'x-questionnaire-test':invite},body:method==='POST'?{questionnaireVersion:'athlete-starting-point-v1',...body}:body},res);return result;}
const body={questionnaireVersion:'athlete-starting-point-v1',name:'Fictional Athlete',email:'test@example.com',answers:{'cau-starting-point-39':'Less than 5 hours'},completedSections:{performance:true,health:true},shareHealth:true};
test('team test requires invite, sign-in and completed sections',async()=>{setup();assert.equal((await call('GET',null,'wrong')).status,403);assert.equal((await call('GET',null,'test-invite','wrong')).status,401);assert.equal((await call('POST',{...body,completedSections:{performance:true,health:false}})).status,400);assert.equal(providerCalls,0);});
test('sandbox routing, own receipt, reference-only persistence and duplicate prevention',async()=>{setup();const first=await call('POST',body);assert.equal(first.body.saved,true);assert.equal(first.body.receipt.baselineId,'baseline');assert.equal(JSON.stringify(writes).includes('Less than 5 hours'),false);assert.equal(writes.some(r=>r.kind==='assignment'),false);assert.equal((await call('GET')).body.completed,true);assert.equal((await call('POST',body)).body.receipt.baselineId,'baseline');assert.equal(providerCalls,1);});
test('expired link and live key cannot activate sandbox',async()=>{setup();process.env.AUNTEDNA_PARTNER_TEST_KEY='ae_pk_live_wrong';assert.equal((await call('GET')).status,503);setup();process.env.CAU_TEAM_TEST_EXPIRES_AT='2020-01-01';assert.equal((await call('GET')).status,503);assert.equal(providerCalls,0);});

test('performance drafts resume, reject clinical fields and stale writes, and retry safely',async()=>{
 setup();const draft={version:'athlete-starting-point-v1',name:'Tester',answers:{'cau-starting-point-01':'Yes'},position:4,completed:false,revision:0};
 const saved=await call('POST',{action:'savePerformanceDraft',draft});assert.equal(saved.body.draft.revision,1);
 const resumed=(await call('GET')).body;assert.equal(resumed.completed,false);assert.equal(resumed.draft.position,4);assert.equal(resumed.draft.answers['cau-starting-point-01'],'Yes');
 assert.equal((await call('POST',{action:'savePerformanceDraft',draft})).body.draft.revision,1);
 assert.equal((await call('POST',{action:'savePerformanceDraft',draft:{...draft,position:1}})).status,409);
 assert.equal((await call('POST',{action:'savePerformanceDraft',draft:{...draft,revision:1,answers:{'cau-starting-point-39':'CLINICAL'}}})).status,409);
 assert.equal(JSON.stringify(writes).includes('CLINICAL'),false);assert.equal(providerCalls,0);
 assert.equal((await call('POST',{action:'savePerformanceDraft',draft:{...draft,revision:1,completed:true,position:0}})).body.draft.completed,true);
});
test('new health answers remain external only without expanding prior retention',async()=>{
 setup(); const input={...body,answers:{...body.answers,'cau-starting-point-35':'Mostly','cau-starting-point-01':'Yes'}};
 assert.equal((await call('POST',input)).body.saved,true);
 const saved=writes.find(r=>r.status==='complete');
 assert.equal(Object.keys(saved.fields).length,5);
 assert.equal(Object.keys(saved.privateBaseline.fields).length,0);
 assert.equal(Object.keys(saved.auntEdnaReferences).length,19);
 assert.equal(saved.privateBaseline.fields['cau-starting-point-35'],undefined);
 assert.equal(saved.privateBaseline.fields['cau-starting-point-39'],undefined);
 assert.equal(JSON.stringify(writes).includes('Less than 5 hours'),false);
 assert.equal(providerCalls,1);
 const receipt=(await call('GET')).body;
 assert.equal(receipt.privateBaseline,undefined);
});
test('retention is server gated with all 19 protected items external only',()=>{
 const {retentionClass,retainedPrivateCopy,liveRetentionEnabled,RETENTION_VERSION}=require(path.resolve('src/lib/questionnaires/cau-retention.ts'));
 const {questions}=require(path.resolve('src/lib/questionnaires/cau.ts'));
 assert.equal(questions.filter(q=>retentionClass(q.id)==='external-only').length,19);
 assert.equal(questions.filter(q=>retentionClass(q.id)!=='external-only').length,5);
 assert.deepEqual(retainedPrivateCopy(body,false),{});
 assert.equal(liveRetentionEnabled({},'true'),false);
 assert.equal(liveRetentionEnabled({retentionPolicyVersion:RETENTION_VERSION},undefined),false);
 assert.equal(liveRetentionEnabled({retentionPolicyVersion:RETENTION_VERSION},'true'),true);
});
test('starting profile drafts finish without activities and sandbox never unlocks real progress',async()=>{
 setup(); const key='pulsecheck-restricted-questionnaire-submissions/sandbox_skills_test-campaign_'+require('crypto').createHash('sha256').update('test-campaign:athlete').digest('hex').slice(0,32)+'_athlete-starting-point-v1';records.delete(key);
 assert.equal((await call('POST',body)).status,400);
 const qdraft={version:'athlete-starting-point-v1',name:'Tester',answers:{},position:0,completed:true,revision:0};
 await call('POST',{action:'savePerformanceDraft',draft:qdraft});
 const lib=require(path.resolve('src/api/firebase/mentaltraining/mentalSkillsBaseline.ts'));
 const draft={version:1,step:'state',currentState:{mood:'okay',rest:3,energy:3,confidence:3,motivation:3,sportConnection:3,selfBelief:3,improvementBelief:3},familiarity:Object.fromEntries(lib.MENTAL_SKILL_FAMILIES.map(f=>[f,'new_to_me'])),evidence:[],selected:null,breathComplete:false,breathPracticeSelected:null,visualizationOrder:[],coherenceOrder:[]};
 assert.equal((await call('POST',{action:'saveSkillsDraft',draft,revision:0})).body.skills.revision,1);
 assert.equal((await call('GET')).body.skills.draft.step,'state');
 const done=await call('POST',{action:'completeSkills',draft,revision:1});assert.equal(done.body.skills.completed,true);assert.equal(done.body.skills.result.version,6);assert.equal(done.body.skills.result.assessmentKind,'self_report_starting_profile');assert.equal(done.body.skills.result.evidence,undefined);
 const retry=await call('POST',{action:'completeSkills',draft,revision:1});assert.deepEqual(retry.body.skills.result,done.body.skills.result);
 assert.equal((await call('POST',body)).body.saved,true);assert.equal(providerCalls,1);assert.equal([...records.keys()].some(k=>k.startsWith('athlete-mental-progress')),false);
 const originalReceipt=(await call('GET')).body.receipt;
 records.delete(key);
 const reopened=(await call('GET')).body;assert.equal(reopened.completed,false);assert.equal(reopened.questionnaireSubmitted,true);assert.equal(reopened.draft.completed,true);
 assert.equal((await call('POST',body)).status,400);
 const finished=await call('POST',{action:'completeSkills',draft,revision:0});assert.equal(finished.body.completed,true);assert.deepEqual(finished.body.receipt,originalReceipt);
 assert.equal((await call('GET')).body.completed,true);assert.equal(providerCalls,1);

});
