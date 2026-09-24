const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');
const path = require('node:path');
const {createHash} = require('node:crypto');
const ids = {founder:'pil-founder-share-return-2026-09-23',reserve:'pil-eip-reserve-approval-2026-09-23',plan:'pulse-eip-amendment-2026-09-14-v2',board:'pil-auntedna-20260909-05',cap:'XmKR9EaPEkeQZcQbaw0A'};
const email='tre@fitwithpulse.ai';
const reviewed=require('../../../src/content/equity/edna-capitalization-approvals.json');
function setup() {
 const now = new Date('2026-09-23T12:00:00Z');
 const timestamp=()=>({seconds:Math.floor(now.getTime()/1000),toDate:()=>new Date(now),toMillis:()=>now.getTime()});
 const planContent='DRAFT - NOT APPROVED\n\n## 3.1 Share Reserve\nThe maximum number of shares that may be issued shall be 1,600,000 shares.\n## 4. Awards\nOther unchanged terms.';
 const base={status:'completed',requiresSignature:true,preparedSigners:[{name:'Tremaine Grant',email,role:'Individual stockholder, sole director and CEO'}],capitalizationRevision:1,closingRequirements:[]};
 const rows = new Map(Object.entries({
  [`admin/${email}`]:{},
  [`equity-documents/${ids.founder}`]:{...base,title:'Founder share return',content:reviewed.founder.content,documentType:'founder_share_return',founderReturn:{sharesBefore:9000000,sharesReturned:1000000,sharesAfter:8000000,vestingStartDate:'2025-12-11',vestingMonths:48,cliffMonths:12}},
  [`equity-documents/${ids.reserve}`]:{...base,title:'Board and stockholder reserve consent',content:reviewed.reserve.content,documentType:'equity_reserve_approval',prerequisiteDocumentIds:[ids.founder],exhibits:[ids.plan],reserveApproval:{planDocumentId:ids.plan,reserveShares:1600000,founderReturnDocumentId:ids.founder,planContentHash:createHash('sha256').update(planContent).digest('hex')}},
  [`equity-documents/${ids.plan}`]:{status:'completed',documentType:'eip',content:planContent,title:'Equity Incentive Plan amendment',approvalStatus:'draft'},
  [`equity-documents/${ids.cap}`]:{...base,title:'Capitalization certificate',content:reviewed.certificate.content,documentType:'strategic_capitalization_certificate',prerequisiteDocumentIds:[ids.founder,ids.reserve,ids.board]},
  [`equity-documents/${ids.board}`]:{...base,capitalizationRevision:undefined,title:'EDNA Board Consent',content:'EDNA approval terms',documentType:'strategic_board_consent_pil',signingRequestIds:['board-signed'],signingGroupId:'board-group'},
  'signingRequests/board-signed':{equityDocumentId:ids.board,documentContent:'EDNA approval terms',signingGroupId:'board-group',recipientEmail:email,signerRole:base.preparedSigners[0].role,status:'signed',signedAt:timestamp(),signatureData:{typedName:'Tremaine Grant',timestamp:timestamp(),verificationMethod:'firebase-auth',verifiedEmail:email,verifiedUid:'director'}},
  'equity-stakeholders/founder-ledger':{name:'Tremaine Grant',email,type:'founder',totalShares:9000000,totalVested:9000000,totalUnvested:0,vestingMonths:48,cliffMonths:12,grants:[]},
  'equity-stakeholders/advisor':{name:'Advisor',email:'advisor@example.com',type:'advisor',optionsGranted:50000,sharesOwned:0,grants:[]},
  'equity-pool/pool':{totalReserved:1000000,granted:50000,exercised:0,available:950000},
 }));
 let sequence=0,writes=0; const sends=[];
 const ref=(collection,id)=>({id,key:`${collection}/${id}`,get:async()=>snapshot(ref(collection,id))});
 const snapshot=ref=>({id:ref.id,ref,exists:rows.has(ref.key),data:()=>rows.get(ref.key)});
 const db={collection:collection=>({kind:'collection',collection,doc:id=>ref(collection,id||`generated-${++sequence}`)}),runTransaction:async fn=>{
  const pending=[];
  const value=await fn({get:async ref=>{assert.equal(pending.length,0,'all transaction reads precede writes');return ref.kind==='collection'?{docs:[...rows.keys()].filter(key=>key.startsWith(ref.collection+'/')).map(key=>snapshot({id:key.split('/')[1],key}))}:snapshot(ref);},
   create:(ref,value)=>{assert.ok(!rows.has(ref.key),'duplicate event or request');pending.push([ref,value,false]);},update:(ref,value)=>pending.push([ref,value,true]),set:(ref,value)=>pending.push([ref,value,true])});
  for(const [ref,value,merge] of pending){rows.set(ref.key,merge?{...rows.get(ref.key),...value}:value);writes++;}return value;
 }};
 const firestore=()=>db;firestore.Timestamp={now:timestamp};firestore.FieldValue={increment:value=>value};
 const firebase={getFirebaseAdminApp:()=>({}),admin:{firestore,auth:()=>({verifyIdToken:async()=>({uid:'director',email,email_verified:true})})}};
 const cache=new Map();
 function load(file){file=path.resolve(file);if(cache.has(file))return cache.get(file);const module={exports:{}};cache.set(file,module.exports);const source=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;vm.runInNewContext(source,{module,exports:module.exports,require:name=>name==='./config/firebase'?firebase:name==='./utils/emailSequenceHelpers'?{buildEmailDedupeKey:()=> 'test-delivery',sendBrevoTransactionalEmail:async payload=>{sends.push(payload);return {success:true,messageId:'test-message'};}}:name.endsWith('.json')?require(path.resolve(path.dirname(file),name)):name.startsWith('.')?load(path.resolve(path.dirname(file),name+'.ts')):require(name),Date,Buffer,console:{error(){},log(){}},Set,Map,process});return module.exports;}
 const prepare=load(path.join(__dirname,'../../../netlify/functions/prepare-equity-self-signature.ts')).handler;
 const sign=load(path.join(__dirname,'../../../netlify/functions/record-equity-signature.ts')).handler;
 const send=load(path.join(__dirname,'../../../netlify/functions/send-signing-request.ts')).handler;
 const event=body=>({httpMethod:'POST',headers:{authorization:'Bearer token'},body:JSON.stringify(body)});
 const invoke=id=>prepare(event({documentId:id}));
 const execute=requestId=>sign(event({requestId,typedName:'Tremaine Grant',signatureFont:'Brush Script MT'}));
 const complete=async id=>{const prepared=await invoke(id);assert.equal(prepared.statusCode,200,prepared.body);const requestId=JSON.parse(prepared.body).delivery.documentId;const signed=await execute(requestId);assert.equal(signed.statusCode,200,signed.body);return requestId;};
 return {rows,invoke,execute,complete,writes:()=>writes,now,sends,send:requestId=>send(event({documentId:requestId,sendAttemptId:'a-test-send-attempt'}),{})};
}
test('preparing the founder return leaves shares unchanged; its authenticated signature records the return once',async()=>{
 const s=setup();const prepared=await s.invoke(ids.founder);assert.equal(prepared.statusCode,200,prepared.body);
 assert.equal(s.rows.get('equity-stakeholders/founder-ledger').totalShares,9000000);assert.equal(s.rows.has(`equity-ledger-events/${ids.founder}`),false);
 const requestId=JSON.parse(prepared.body).delivery.documentId;const signed=await s.execute(requestId);assert.equal(signed.statusCode,200,signed.body);
 const holder=s.rows.get('equity-stakeholders/founder-ledger');assert.equal(holder.totalShares,8000000);assert.equal(holder.sharesOwned,8000000);assert.equal(holder.totalVested,0);assert.equal(holder.totalUnvested,8000000);assert.equal(holder.vestingStartDate,'2025-12-11');assert.equal(holder.cliffMonths,12);
 const audit=s.rows.get(`equity-ledger-events/${ids.founder}`);assert.equal(audit.before.totalShares,9000000);assert.equal(audit.after.totalShares,8000000);assert.equal(audit.requestId,requestId);assert.equal(audit.cashConsideration,0);
 assert.equal(s.rows.get(`equity-documents/${ids.founder}`).approvalStatus,'approved');const writes=s.writes();const duplicate=await s.execute(requestId);assert.equal(duplicate.statusCode,200,duplicate.body);assert.equal(JSON.parse(duplicate.body).alreadySigned,true);assert.equal(s.writes(),writes);
});
test('founder return refuses an unexpected or ambiguous ledger before any write',async()=>{
 for(const modify of [s=>s.rows.get('equity-stakeholders/founder-ledger').totalShares=8500000,s=>s.rows.set('equity-stakeholders/duplicate',{...s.rows.get('equity-stakeholders/founder-ledger')}),s=>s.rows.get('equity-stakeholders/founder-ledger').grants=[{id:'unhandled-grant'}]]){
  const s=setup();modify(s);const result=await s.invoke(ids.founder);assert.equal(result.statusCode,409,result.body);assert.equal(s.writes(),0);
 }
});
test('changed execution metadata or ledger after preparation cannot create signature or return',async()=>{
 for(const modify of [s=>s.rows.get(`equity-documents/${ids.founder}`).founderReturn.sharesReturned=2,s=>s.rows.get('equity-stakeholders/founder-ledger').totalShares=8500000]){
  const s=setup();const prepared=JSON.parse((await s.invoke(ids.founder)).body);const writes=s.writes();modify(s);assert.equal((await s.execute(prepared.delivery.documentId)).statusCode,409);assert.equal(s.writes(),writes);assert.equal(s.rows.get(`signingRequests/${prepared.delivery.documentId}`).status,'pending');
 }
});
test('reserve consent cannot be prepared before the founder has signed and the return has been recorded',async()=>{
 const s=setup();const result=await s.invoke(ids.reserve);assert.equal(result.statusCode,409,result.body);assert.equal(s.writes(),0);
 await s.complete(ids.founder);delete s.rows.get(`equity-documents/${ids.founder}`).capitalizationRecordedAt;const writes=s.writes();assert.equal((await s.invoke(ids.reserve)).statusCode,409);assert.equal(s.writes(),writes);
});
test('reserve execution adopts the exact reviewed EIP and updates the pool in the signature transaction',async()=>{
 const s=setup();await s.complete(ids.founder);const before=s.rows.get(`equity-documents/${ids.plan}`).content;
 const requestId=await s.complete(ids.reserve);const plan=s.rows.get(`equity-documents/${ids.plan}`);assert.equal(plan.content,before);assert.equal(plan.approvalStatus,'approved');assert.equal(plan.approvalDocumentId,ids.reserve);assert.equal(plan.approvalRequestId,requestId);assert.equal(plan.effectiveAt.toMillis(),s.now.getTime());
 const pool=s.rows.get('equity-pool/pool');assert.equal(pool.totalReserved,1600000);assert.equal(pool.granted,50000);assert.equal(pool.available,1550000);assert.ok(s.rows.has(`equity-ledger-events/${ids.reserve}`));
});
test('an EIP changed after consent preparation cannot be adopted or signed',async()=>{
 const s=setup();await s.complete(ids.founder);const prepared=JSON.parse((await s.invoke(ids.reserve)).body);s.rows.get(`equity-documents/${ids.plan}`).content+='\nChanged award terms.';const writes=s.writes();const signed=await s.execute(prepared.delivery.documentId);assert.equal(signed.statusCode,409,signed.body);assert.equal(s.writes(),writes);assert.equal(s.rows.get('equity-pool/pool').totalReserved,1000000);
});
test('certificate requires all three current verified approvals and recorded share and reserve balances',async()=>{
 const s=setup();assert.equal((await s.invoke(ids.cap)).statusCode,409);await s.complete(ids.founder);assert.equal((await s.invoke(ids.cap)).statusCode,409);await s.complete(ids.reserve);
 s.rows.get('signingRequests/board-signed').status='pending';assert.equal((await s.invoke(ids.cap)).statusCode,409);s.rows.get('signingRequests/board-signed').status='signed';
 const prepared=await s.invoke(ids.cap);assert.equal(prepared.statusCode,200,prepared.body);const requestId=JSON.parse(prepared.body).delivery.documentId;
 s.rows.get('equity-pool/pool').totalReserved=1700000;const writes=s.writes();assert.equal((await s.execute(requestId)).statusCode,409);assert.equal(s.writes(),writes);s.rows.get('equity-pool/pool').totalReserved=1600000;
 const signed=await s.execute(requestId);assert.equal(signed.statusCode,200,signed.body);assert.equal(s.rows.get(`equity-documents/${ids.cap}`).approvalStatus,'approved');
});
test('an arbitrary document cannot use a capitalization action type to mutate the ledger',async()=>{
 const s=setup();s.rows.set('equity-documents/unreviewed',{...s.rows.get(`equity-documents/${ids.founder}`)});assert.equal((await s.invoke('unreviewed')).statusCode,409);assert.equal(s.writes(),0);
});
test('reviewed certificate cannot bypass its prerequisites or unknown completion requirements',async()=>{
 const s=setup();await s.complete(ids.founder);await s.complete(ids.reserve);const cap=s.rows.get(`equity-documents/${ids.cap}`);cap.prerequisiteDocumentIds=[];assert.equal((await s.invoke(ids.cap)).statusCode,409);cap.prerequisiteDocumentIds=[ids.founder,ids.reserve,ids.board];cap.closingRequirements=['An unrelated unresolved term'];assert.equal((await s.invoke(ids.cap)).statusCode,409);
});

test('changed legal text cannot keep the ledger action even when metadata still matches',async()=>{
 const s=setup();s.rows.get(`equity-documents/${ids.founder}`).content += '\nReturn an additional share.';const result=await s.invoke(ids.founder);assert.equal(result.statusCode,409,result.body);assert.match(result.body,/reviewed capitalization paperwork/);assert.equal(s.writes(),0);
});
test('sending an approval rechecks its dependency and reviewed action immediately before email',async()=>{
 const s=setup();await s.complete(ids.founder);const prepared=await s.invoke(ids.reserve);assert.equal(prepared.statusCode,200,prepared.body);const requestId=JSON.parse(prepared.body).delivery.documentId;
 const founderRequestId=s.rows.get(`equity-documents/${ids.founder}`).approvalRequestId;s.rows.get(`signingRequests/${founderRequestId}`).invalidatedAt='2026-09-23';
 const denied=await s.send(requestId);assert.equal(denied.statusCode,409,denied.body);assert.equal(s.sends.length,0);delete s.rows.get(`signingRequests/${founderRequestId}`).invalidatedAt;
 const sent=await s.send(requestId);assert.equal(sent.statusCode,200,sent.body);assert.equal(s.sends.length,1);
});
test('a retry with missing ledger audit never recreates a completed founder return',async()=>{
 const s=setup();const requestId=await s.complete(ids.founder);s.rows.delete(`equity-ledger-events/${ids.founder}`);const writes=s.writes();const result=await s.execute(requestId);assert.equal(result.statusCode,409,result.body);assert.equal(s.writes(),writes);assert.equal(s.rows.get('equity-stakeholders/founder-ledger').totalShares,8000000);
});
test('missing reserve ledger is created only by verified execution, and certificate accepts it',async()=>{
 const s=setup();s.rows.delete('equity-pool/pool');await s.complete(ids.founder);
 const prepared=await s.invoke(ids.reserve);assert.equal(prepared.statusCode,200,prepared.body);
 assert.equal(s.rows.has('equity-pool/pil-eip'),false);
 const signed=await s.execute(JSON.parse(prepared.body).delivery.documentId);assert.equal(signed.statusCode,200,signed.body);
 const pool=s.rows.get('equity-pool/pil-eip');assert.equal(pool.totalReserved,1600000);assert.equal(pool.granted,50000);assert.equal(pool.available,1550000);assert.equal(pool.exercised,0);
 assert.equal(s.rows.get(`equity-ledger-events/${ids.reserve}`).before.pool,null);
 assert.equal((await s.invoke(ids.cap)).statusCode,200);
});
test('multiple reserve ledgers still block approval without writing',async()=>{
 const s=setup();await s.complete(ids.founder);s.rows.set('equity-pool/duplicate',{...s.rows.get('equity-pool/pool')});
 const writes=s.writes();const result=await s.invoke(ids.reserve);assert.equal(result.statusCode,409);assert.match(result.body,/Multiple equity reserve ledgers/);assert.equal(s.writes(),writes);
});
