const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),ts=require('typescript');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,esModuleInterop:true,target:ts.ScriptTarget.ES2022}}).outputText,f);
let records=new Map(),writes=[],providerCalls=0;
const snap=key=>({exists:records.has(key),data:()=>records.get(key)});
const ref=key=>({key,get:async()=>snap(key),collection:name=>collection(key+'/'+name)});
const collection=key=>({doc:id=>ref(key+'/'+id),orderBy:()=>({limit:()=>({get:async()=>({docs:records.has(key)?[{data:()=>records.get(key)}]:[]})})})});
const db={collection,runTransaction:async fn=>fn({get:async r=>snap(r.key),set:(r,value)=>{records.set(r.key,value);writes.push(value);},create:(r,value)=>{if(records.has(r.key))throw Error('exists');records.set(r.key,value);writes.push(value);}})};
const admin={auth:()=>({verifyIdToken:async token=>{if(token!=='valid')throw Error('bad token');return {uid:'athlete',email:'athlete@example.com'};}}),firestore:Object.assign(()=>db,{FieldValue:{serverTimestamp:()=> 'server-time'}})};
require.cache[path.resolve('src/lib/firebase-admin.ts')]={id:path.resolve('src/lib/firebase-admin.ts'),filename:path.resolve('src/lib/firebase-admin.ts'),loaded:true,exports:{__esModule:true,default:admin,getFirebaseAdminApp:()=>({})}};
const handler=require(path.resolve('src/pages/api/pulsecheck/questionnaire/cau.ts')).default;
const root='pulsecheck-restricted-questionnaire-submissions/';
function setup(){records=new Map();writes=[];providerCalls=0;process.env.CAU_QUESTIONNAIRE_COLLECTION_ENABLED='true';process.env.AUNTEDNA_PARTNER_TEST_KEY='ae_pk_test_fake';
 records.set(root+'assignment_athlete',{kind:'assignment',enabled:true,version:'cau-operational-web-v1',teamId:'team',submissionId:'sub-1',environment:'test',universityCode:'SANDBOX'});
 records.set('pulsecheck-team-memberships/team_athlete',{status:'active'});
 records.set('athlete-mental-progress/athlete',{mentalSkillsBaseline:{version:5}});
 global.fetch=async(_url,opts)=>{providerCalls++; const sent=JSON.parse(opts.body);return Response.json({success:true,requestId:'request',data:{baselineId:'baseline',athleteId:'ae-athlete',externalId:'athlete',submissionId:sent.submissionId,receivedAt:'2026-09-16T12:00:00Z',created:providerCalls===1}});};
}
async function call(method,body,token='valid'){let result={status:200};const res={setHeader(){},status(n){result.status=n;return this;},json(v){result.body=v;return this;},end(){return this;}};await handler({method,headers:{authorization:'Bearer '+token},body:method==='POST'?{questionnaireVersion:'cau-starting-point-v2',...body}:body},res);return result;}
const body={questionnaireVersion:'cau-starting-point-v2',name:'Fictional Athlete',email:'test@example.com',answers:{'cau-starting-point-39':'Less than 5 hours'},completedSections:{performance:true,health:true},shareHealth:true};
test('status is authenticated and only active assigned accounts are required',async()=>{setup();assert.equal((await call('GET',null,'invalid')).status,401);assert.equal((await call('GET')).body.required,true);records.delete(root+'assignment_athlete');assert.equal((await call('GET')).body.required,false);});
test('no consent cannot transmit health; performance-only resolution does not store clinical values',async()=>{setup();assert.equal((await call('POST',body)).status,403);assert.equal(providerCalls,0);assert.equal((await call('POST',{...body,shareHealth:false})).body.saved,true);assert.equal(providerCalls,0);assert.equal(JSON.stringify(writes).includes('Less than 5 hours'),false);assert.equal((await call('GET')).body.completed,true);});
test('signed current authorization sends health once and persists references only',async()=>{setup();const doc={id:'health',version:'v1',body:'Terms',category:'health_authorization'};const decisions={health:{decision:'accepted',version:'v1',document:doc,signedName:'Fictional Athlete'}};records.set('pulsecheck-teams/team',{requiredConsents:[doc]});records.set('pulsecheck-team-memberships/team_athlete',{status:'active',athleteOnboarding:{consentDecisions:decisions}});records.set('pulsecheck-team-memberships/team_athlete/consent-events',{actorUserId:'athlete',decisions});assert.equal((await call('POST',body)).body.saved,true);assert.equal(providerCalls,1);assert.equal(JSON.stringify(writes).includes('Less than 5 hours'),false);assert.equal((await call('POST',body)).body.saved,true);assert.equal(providerCalls,1);assert.equal((await call('GET')).body.required,false);});
test('retired assignments and incomplete sections cannot submit',async()=>{setup();assert.equal((await call('POST',{...body,completedSections:{performance:true}})).status,400);records.set('pulsecheck-team-memberships/team_athlete',{status:'inactive'});assert.equal((await call('POST',body)).status,503);assert.equal(providerCalls,0);});

test('stale clients are rejected before writes and old drafts never resume as new questions',async()=>{
 setup();records.set(root+'performance_draft_athlete_cau-operational-web-v1',{version:'cau-operational-web-v1',answers:{'cau-operational-35':'Agree'},completed:true});
 const status=(await call('GET')).body;assert.equal(status.version,'cau-operational-web-v1');assert.equal(status.questionnaireVersion,'cau-starting-point-v2');assert.equal(status.draft,null);
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
 const draft={version:'cau-starting-point-v2',flowVersion:4,name:'Tester',answers:{'cau-starting-point-01':'Yes'},position:2,completed:false,revision:0};
 const result=await call('POST',{action:'savePerformanceDraft',draft});assert.equal(result.status,200);assert.equal(result.body.draft.revision,1);
 assert.deepEqual(records.get(oldKey),old);assert.equal(records.get(root+'performance_draft_athlete_cau-starting-point-v2').position,2);
 const resumed=(await call('GET')).body.draft;assert.equal(resumed.version,'cau-starting-point-v2');assert.equal(resumed.position,2);assert.deepEqual(resumed.answers,{'cau-starting-point-01':'Yes'});
});
test('missing content version rejects every stale mutation including draft and skills saves',async()=>{
 for(const action of [undefined,'savePerformanceDraft','saveSkillsDraft','completeSkills']){setup();const result=await call('POST',{...body,action,questionnaireVersion:undefined});assert.equal(result.status,409);assert.equal(writes.length,0);assert.equal(providerCalls,0);}
});
