const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),ts=require('typescript');
const old=require.extensions['.ts'];require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText,f);
const {submitAuntEdnaBaseline,baselineMirror}=require(path.resolve('src/lib/questionnaires/auntedna-partner.ts'));require.extensions['.ts']=old;
const input={submissionId:'test-submission',name:'Fictional Athlete',email:'test@example.com',answers:{'cau-operational-26':'PRIVATE_SENTINEL','cau-operational-35':require('../../src/content/questionnaires/cau-operational.json').questions.find(q=>q.id==='cau-operational-35').choices[0]}};
const config={apiKey:'ae_pk_test_fake',environment:'test',universityCode:'SANDBOX'};
const envelope={success:true,data:{baselineId:'baseline',athleteId:'athlete',externalId:'test-athlete',submissionId:input.submissionId,receivedAt:'2026-09-16T12:00:00Z',created:true},requestId:'request'};
test('sends only audited health fields and mirrors only references',async()=>{
 const receipt=await submitAuntEdnaBaseline(input,'test-athlete',config,async(url,opts)=>{
 assert.equal(url,'https://partner-api.auntedna.ai/partner/athletes/test-athlete/baseline');assert.equal(opts.headers['X-Pulse-Integration'],'true');assert.equal(opts.redirect,'error');
 const body=JSON.parse(opts.body);assert.equal(body.ownershipVersion,'cau-routing-v2');assert.equal(body.universityCode,'SANDBOX');assert.equal(Object.keys(body.fields).length,48);assert.equal(body.fields['cau-operational-35'],undefined);return Response.json(envelope);
 });const mirror=baselineMirror(input,receipt);assert.equal(Object.keys(mirror.fields).length,13);assert.equal(JSON.stringify(mirror).includes('PRIVATE_SENTINEL'),false);assert.equal(mirror.auntEdnaReferences['cau-operational-26'].baselineId,'baseline');
});
test('rejects crossed environments before transmission',async()=>{
 await assert.rejects(submitAuntEdnaBaseline(input,'test-athlete',{...config,universityCode:'CAU'},()=>{throw Error('must not call')}),/environment/);
});
test('rejects mismatched receipts and suppresses provider error contents',async()=>{
 await assert.rejects(submitAuntEdnaBaseline(input,'test-athlete',config,async()=>Response.json({...envelope,data:{...envelope.data,externalId:'someone-else'}})),e=>e.retryable===true);
 await assert.rejects(submitAuntEdnaBaseline(input,'test-athlete',config,async()=>Response.json({error:'PRIVATE_SENTINEL'},{status:422})),e=>e.status===422&&!e.retryable&&!e.message.includes('PRIVATE_SENTINEL'));
});
test('accepts idempotent replay without requiring a new baseline',async()=>{
 const r=await submitAuntEdnaBaseline(input,'test-athlete',config,async()=>Response.json({...envelope,data:{...envelope.data,created:false}}));assert.equal(r.created,false);assert.equal(r.baselineId,'baseline');
});
test('local persistence receives only the mirror and a failed save can retry',async()=>{
 require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText,f);
 const {deliverQuestionnaire}=require(path.resolve('src/lib/questionnaires/cau-delivery.ts'));require.extensions['.ts']=old;
 let saved=null,calls=0,fail=true;
 const store={get:async()=>saved,create:async(id,record)=>{assert.equal(JSON.stringify(record).includes('PRIVATE_SENTINEL'),false);if(fail){fail=false;throw Error('store unavailable');}saved=record;return record;}};
 const transport=async()=>{calls++;return Response.json({...envelope,data:{...envelope.data,created:calls===1}});};
 await assert.rejects(deliverQuestionnaire(input,'test-athlete',config,store,transport),/store unavailable/);
 await deliverQuestionnaire(input,'test-athlete',config,store,transport);
 await deliverQuestionnaire(input,'test-athlete',config,store,transport);
 assert.equal(calls,2);assert.equal(saved.auntEdna.baselineId,'baseline');
 await assert.rejects(deliverQuestionnaire(input,'another-athlete',config,store,transport),/identity conflict/);
});
