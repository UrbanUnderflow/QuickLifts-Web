const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');
const path = require('node:path');
function setup(overrides = {}) {
 const roster=[{name:'Director',email:'director@example.com',role:'PIL CEO'},{name:'Recipient',email:'recipient@example.com',role:'EDNA CEO'}];
 const rows = new Map(Object.entries({
  'admin/director@example.com': {},
  'equity-documents/award': {title:'Award',documentType:'strategic_vesting_equity_agreement',status:'completed',content:'Award terms',requiresSignature:true,preparedSigners:roster,...overrides.award},
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
 function load(file) {file=path.resolve(file);if(cache.has(file))return cache.get(file);const module={exports:{}};cache.set(file,module.exports);const source=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;vm.runInNewContext(source,{module,exports:module.exports,require:name=>name==='./config/firebase'?firebase:name.startsWith('.')?load(path.resolve(path.dirname(file),name+'.ts')):require(name),Date,Buffer,console,Set,Map});return module.exports;}
 const handler=load(path.join(__dirname,'../../../netlify/functions/prepare-equity-package.ts')).handler;
 return {rows,writes:()=>writes,advanceDay:()=>{clock+=86400000;},invoke:(body={},headers={authorization:'Bearer token'})=>handler({httpMethod:'POST',headers,body:JSON.stringify({attemptId:'attempt-1',documentIds:['award','warrant'],referenceDocumentIds:['board','cap','cost'],...body})})};
}
test('atomically prepares one package per recipient with all signature children and immutable references',async()=>{
 const state=setup();const result=await state.invoke();assert.equal(result.statusCode,200,result.body);
 const payload=JSON.parse(result.body);assert.equal(payload.deliveries.length,2);assert.equal(payload.requestIds.length,4);
 for(const delivery of payload.deliveries){const root=state.rows.get(`signingRequests/${delivery.documentId}`);assert.equal(root.documentType,'strategic_signing_package');assert.equal(root.packageDocuments.length,5);assert.equal(root.childRequestIds.length,2);assert.equal(root.packageDocuments.find(d=>d.id==='board').signatureEvidence[0].signatureData.typedName,'Director');for(const id of root.childRequestIds)assert.equal(state.rows.get(`signingRequests/${id}`).packageId,delivery.documentId);}
 assert.equal(state.rows.get('equity-documents/award').signingRequestIds.length,2);
 const count=state.writes();const retry=await state.invoke();assert.equal(retry.body,result.body);assert.equal(state.writes(),count);
 assert.equal((await state.invoke({documentIds:['award']})).statusCode,409);assert.equal(state.writes(),count);
});
for(const [name,overrides,status] of [['nonadmin',{notAdmin:true},403],['unsigned board',{boardSignature:{status:'pending'}},409],['closing requirement',{award:{closingRequirements:['Price']}},409],['existing signature',{award:{signingRequestIds:['existing']}},409]])test(`rejects ${name} without any writes`,async()=>{const state=setup(overrides);assert.equal((await state.invoke()).statusCode,status);assert.equal(state.writes(),0);});
test('unauthenticated and malformed requests create nothing',async()=>{const state=setup();assert.equal((await state.invoke({},{})).statusCode,401);assert.equal((await state.invoke({attemptId:'invalid/id'})).statusCode,400);assert.equal(state.writes(),0);});

test('dates signature documents once and leaves approved references untouched',async()=>{
 const s=setup({award:{title:'Award - September 9, 2026',content:'AWARD\nDocument date: September 9, 2026\nSide Letter dated September 9, 2026.\nVesting commencement September 11, 2026.\nDate of Execution: __________________'}});
 const board=JSON.stringify(s.rows.get('equity-documents/board')),cap=JSON.stringify(s.rows.get('equity-documents/cap')),cost=JSON.stringify(s.rows.get('equity-documents/cost'));
 const first=await s.invoke();assert.equal(first.statusCode,200,first.body);const result=JSON.parse(first.body),source=s.rows.get('equity-documents/award');
 assert.equal(source.documentDate,'2026-09-23');assert.match(source.content,/Document date: September 23, 2026/);assert.match(source.content,/Side Letter dated September 9, 2026/);assert.match(source.content,/Vesting commencement September 11, 2026/);assert.match(source.content,/Date of Execution: __________________/);
 for(const delivery of result.deliveries){const root=s.rows.get(`signingRequests/${delivery.documentId}`),item=root.packageDocuments.find(d=>d.id==='award');assert.equal(item.content,source.content);const child=s.rows.get(`signingRequests/${item.requestId}`);assert.equal(child.documentContent,source.content);assert.equal(child.documentDate,source.documentDate);}
 assert.equal(JSON.stringify(s.rows.get('equity-documents/board')),board);assert.equal(JSON.stringify(s.rows.get('equity-documents/cap')),cap);assert.equal(JSON.stringify(s.rows.get('equity-documents/cost')),cost);
 s.advanceDay();const writes=s.writes();assert.equal((await s.invoke()).body,first.body);assert.equal(s.writes(),writes);assert.equal(s.rows.get('equity-documents/award').documentDate,'2026-09-23');assert.equal(source.contentHistory.length,1);
});
for(const evidence of [{signatureData:{typedName:'Director'}},{autoSignedAt:'2026-09-22'},{approvalStatus:'approved'}])test('rejects dating a signature document with approval or signature evidence',async()=>{const s=setup({award:evidence});assert.equal((await s.invoke()).statusCode,409);assert.equal(s.writes(),0);});

test('preparation retains reviewed reciprocal closing conditions as issuance requirements, not completed approvals',async()=>{
 const id='pil-auntedna-vesting-shares-draft',condition='Complete approved capitalization and reservation certificates and reciprocal EDNA award delivery, including the initial 2% condition';
 const s=setup({award:{contractualBuybackRevision:1,closingRequirements:[condition],issuanceRequirements:['Separate required consent']}});
 s.rows.set(`equity-documents/${id}`,s.rows.get('equity-documents/award'));s.rows.delete('equity-documents/award');
 const result=await s.invoke({documentIds:[id,'warrant']});assert.equal(result.statusCode,200,result.body);
 const source=s.rows.get(`equity-documents/${id}`);assert.equal(source.closingRequirements.length,0);assert.equal(source.issuanceRequirements.length,2);assert.equal(source.issuanceRequirements[0],'Separate required consent');assert.equal(source.issuanceRequirements[1],condition);assert.equal(source.approvalStatus,undefined);assert.equal(source.signedAt,undefined);
});
test('known closing conditions do not bypass required signed board approval',async()=>{
 const id='pil-auntedna-vesting-shares-draft',condition='Complete approved capitalization and reservation certificates and reciprocal EDNA award delivery, including the initial 2% condition';
 const s=setup({award:{contractualBuybackRevision:1,closingRequirements:[condition]},boardSignature:{status:'pending'}});s.rows.set(`equity-documents/${id}`,s.rows.get('equity-documents/award'));
 const result=await s.invoke({documentIds:[id,'warrant']});assert.equal(result.statusCode,409,result.body);assert.equal(s.writes(),0);
});
