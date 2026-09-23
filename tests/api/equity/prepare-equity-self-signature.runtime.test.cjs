const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');
const path = require('node:path');
function setup(overrides = {}) {
 const roster=[{name:'Tremaine Grant',email:'director@example.com',role:'Sole director'},{name:'Recipient',email:'recipient@example.com',role:'EDNA CEO'}];
 const rows = new Map(Object.entries({
  'admin/director@example.com': {},
  'equity-documents/award': {title:'Certificate',documentType:'strategic_capitalization_certificate',status:'completed',content:'Approved terms',requiresSignature:true,preparedSigners:roster.slice(0,1),...overrides.award},
  'equity-documents/warrant': {title:'Warrant',documentType:'strategic_warrant_pil',status:'completed',content:'Warrant terms',requiresSignature:true,preparedSigners:roster},
  'equity-documents/board': {title:'Board',documentType:'strategic_board_consent_pil',status:'completed',content:'Board terms',preparedSigners:[{name:'Director',email:'director@example.com',role:'Sole director'}],signingRequestIds:['board-signed'],signingGroupId:'board-group'},
  'equity-documents/cap': {title:'Capitalization',documentType:'capitalization_certificate',status:'completed',content:'Cap terms',approvalStatus:'approved'},
  'equity-documents/cost': {title:'Consideration',documentType:'consideration_schedule',status:'completed',content:'Cost terms',approvalStatus:'approved'},
  'signingRequests/board-signed': {equityDocumentId:'board',documentContent:'Board terms',signingGroupId:'board-group',recipientEmail:'director@example.com',signerRole:'Sole director',status:'signed',signedAt:'2026-01-01',signatureData:{typedName:'Director',timestamp:'2026-01-01',verificationMethod:'firebase-auth',verifiedEmail:'director@example.com',verifiedUid:'director'},...overrides.boardSignature},
 }));
 if (overrides.notAdmin) rows.delete('admin/director@example.com');
 let sequence=0, writes=0, clock=Date.parse('2026-09-24T02:30:00Z');
 const snapshot = ref => ({id:ref.id,exists:rows.has(ref.key),data:()=>rows.get(ref.key)});
 const db={collection:collection=>({doc:id=>{id=id||`generated-${++sequence}`;const ref={id,key:`${collection}/${id}`};return {...ref,get:async()=>snapshot(ref)};}}),runTransaction:async fn=>{
  const pending=[];const result=await fn({get:async ref=>snapshot(ref),create:(ref,value)=>pending.push([ref,value,false]),update:(ref,value)=>pending.push([ref,value,true])});
  for(const [ref,value,merge] of pending) {rows.set(ref.key,merge?{...rows.get(ref.key),...value}:value);writes++;}return result;
 }};
 const firestore=()=>db;firestore.Timestamp={now:()=>({seconds:Math.floor(clock/1000)})};
 const firebase={getFirebaseAdminApp:()=>({}),admin:{firestore,auth:()=>({verifyIdToken:async()=>({uid:'director',email:'director@example.com'})})}};
 const cache=new Map();
 function load(file) {file=path.resolve(file);if(cache.has(file))return cache.get(file);const module={exports:{}};cache.set(file,module.exports);const source=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;vm.runInNewContext(source,{module,exports:module.exports,require:name=>name==='./config/firebase'?firebase:name.endsWith('.json')?require(path.resolve(path.dirname(file),name)):name.startsWith('.')?load(path.resolve(path.dirname(file),name+'.ts')):require(name),Date,Buffer,console,Set,Map});return module.exports;}
 const handler=load(path.join(__dirname,'../../../netlify/functions/prepare-equity-self-signature.ts')).handler;
 return {rows,writes:()=>writes,advanceDay:()=>{clock+=86400000;},invoke:(body={},headers={authorization:'Bearer token'})=>handler({httpMethod:'POST',headers,body:JSON.stringify({documentId:'award',...body})})};
}
test('prepares and reuses one self-signature request without changing evidence',async()=>{const state=setup();const first=await state.invoke();assert.equal(first.statusCode,200,first.body);const a=JSON.parse(first.body);assert.equal(a.reused,false);assert.equal(a.delivery.recipientEmail,'director@example.com');assert.ok(a.delivery.sendAttemptId);const writes=state.writes();const retry=JSON.parse((await state.invoke()).body);assert.equal(retry.delivery.documentId,a.delivery.documentId);assert.equal(retry.reused,true);assert.equal(state.writes(),writes);state.rows.get(`signingRequests/${a.delivery.documentId}`).status='signed';assert.equal((await state.invoke()).statusCode,409);assert.equal(state.writes(),writes);});
for(const [name,overrides,status] of [['nonadmin',{notAdmin:true},403],['closing requirements',{award:{closingRequirements:['Missing value']}},409],['wrong type',{award:{documentType:'strategic_warrant_pil'}},409],['incoming',{award:{equityDirection:'incoming'}},409],['wrong signer',{award:{preparedSigners:[{name:'Other',email:'director@example.com',role:'Director'}]}},403],['signed',{award:{signedAt:'2026-01-01'}},409]])test(`rejects ${name} without writes`,async()=>{const s=setup(overrides);const result=await s.invoke();assert.equal(result.statusCode,status,result.body);assert.equal(s.writes(),0);});
test('requires authentication',async()=>{const s=setup();assert.equal((await s.invoke({},{})).statusCode,401);assert.equal(s.writes(),0);});
test('board self-signature retains saved outgoing review exhibits',async()=>{const s=setup({award:{documentType:'strategic_board_consent_pil',exhibits:['warrant']}});const result=await s.invoke();assert.equal(result.statusCode,200,result.body);const request=s.rows.get(`signingRequests/${JSON.parse(result.body).delivery.documentId}`);assert.equal(request.supportingDocuments.length,1);assert.equal(request.supportingDocuments[0].url,'/equity-doc/warrant');});
test('does not replace a changed pending signature request',async()=>{const s=setup();const result=JSON.parse((await s.invoke()).body);s.rows.get('equity-documents/award').content='Changed after preparation';const writes=s.writes();assert.equal((await s.invoke()).statusCode,409);assert.equal(s.writes(),writes);assert.match(s.rows.get(`signingRequests/${result.delivery.documentId}`).documentContent,/Approved terms/);});

test('initial self-signature dates source and snapshot together, while next-day retries preserve both',async()=>{
 const s=setup({award:{title:'Certificate - September 9, 2026',content:'CERTIFICATE\nDocument date: September 9, 2026\nThe director certifies to EDNA as of [Certification Date].\nVesting commencement September 11, 2026.\nDate of Execution: __________________'}});
 const first=await s.invoke();assert.equal(first.statusCode,200,first.body);const requestId=JSON.parse(first.body).delivery.documentId;
 const source=s.rows.get('equity-documents/award'),request=s.rows.get(`signingRequests/${requestId}`);
 assert.equal(source.documentDate,'2026-09-23');assert.equal(request.documentDate,source.documentDate);assert.equal(request.documentContent,source.content);assert.equal(request.documentName,'Certificate - September 23, 2026');
 assert.match(source.content,/as of the date recorded with the undersigned's electronic signature/);assert.match(source.content,/Vesting commencement September 11, 2026/);assert.match(source.content,/Date of Execution: __________________/);assert.equal(source.contentHistory.length,1);assert.match(source.contentHistory[0].content,/Document date: September 9, 2026/);assert.equal(source.signedAt,undefined);
 s.advanceDay();const writes=s.writes();assert.equal(JSON.parse((await s.invoke()).body).reused,true);assert.equal(s.writes(),writes);assert.equal(source.documentDate,'2026-09-23');assert.equal(request.documentContent,source.content);
});
for(const evidence of [{signatureData:{typedName:'Tremaine Grant'}},{autoSignedAt:'2026-09-22'},{approvalStatus:'approved'}])test('does not redate a document with existing approval or signature evidence',async()=>{const s=setup({award:evidence});assert.equal((await s.invoke()).statusCode,409);assert.equal(s.writes(),0);});
