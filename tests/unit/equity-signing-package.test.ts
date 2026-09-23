import test from 'node:test';
import assert from 'node:assert/strict';
import {validatePackageSources, packageRecipients, validatePreparedPackage, type PackageSource} from '../../src/lib/equitySigningPackage';
const agreement: PackageSource = {id:'award', title:'Award', documentType:'strategic_vesting_equity_agreement', status:'completed', content:'Award terms', requiresSignature:true, preparedSigners:[{name:'Director',role:'PIL CEO',email:'director@example.com'},{name:'Recipient',role:'EDNA CEO',email:'recipient@example.com'}]};
const references: PackageSource[] = [{id:'board',title:'Board',documentType:'strategic_board_consent_pil',status:'completed',content:'Approval'},{id:'cap',title:'Capitalization certificate',documentType:'cap_table',status:'completed',content:'Shares',approvalStatus:'approved'},{id:'cost',title:'Consideration',documentType:'consideration_schedule',status:'completed',content:'Cost',approvalStatus:'approved'}];
test('package requires signed board and approved substantive references', () => {
 assert.deepEqual(validatePackageSources([agreement],references,new Set(['board'])),[]);
 assert.match(validatePackageSources([agreement],references,new Set()).join(),/verified signatures/);
 assert.match(validatePackageSources([agreement],references.filter(d=>d.id!=='cost'),new Set(['board'])).join(),/approved consideration/);
});
test('package cannot bypass closing requirements, incoming restriction, or replace requests', () => {
 assert.match(validatePackageSources([{...agreement,closingRequirements:['Price']}],references,new Set(['board'])).join(),/closing requirements/);
 assert.match(validatePackageSources([{...agreement,equityDirection:'incoming'}],references,new Set(['board'])).join(),/outgoing/);
 assert.match(validatePackageSources([{...agreement,signingRequestIds:['signed-old']}],references,new Set(['board'])).join(),/already exists/);
});
test('all document rosters are retained while recipients receive one root', () => {
 assert.equal(packageRecipients([agreement,{...agreement,id:'warrant',preparedSigners:[{name:'Recipient',role:'EDNA CEO',email:'RECIPIENT@example.com'}]}]).length,2);
 assert.match(validatePackageSources([{...agreement,preparedSigners:[{name:'X',role:'',email:'x@example.com'}]}],references,new Set(['board'])).join(),/signer roster/);
});
test('prepared snapshots become unusable when content, recipient or active group changes', () => {
 const document={...agreement,signingGroupId:'group',signingRequestIds:['child']};
 const request={status:'pending',id:'child',packageId:'root',equityDocumentId:'award',recipientEmail:'recipient@example.com',signerRole:'EDNA CEO',documentContent:'Award terms',signingGroupId:'group'};
 const root={id:'root',documentType:'strategic_signing_package',childRequestIds:['child'],recipientEmail:'recipient@example.com',packageDocuments:[{id:'award',title:'Award',content:'Award terms',mode:'sign',requestId:'child'},...references.map(d=>({...d,mode:'reference'}))]};
 assert.deepEqual(validatePreparedPackage(root,[document,...references],[request]),[]);
 assert.match(validatePreparedPackage({...root,expiresAt:new Date(0)},[document,...references],[request]).join(),/expired/);
 assert.match(validatePreparedPackage(root,[document,...references],[{...request,expiresAt:new Date(0)}]).join(),/no longer current/);
 assert.match(validatePreparedPackage(root,[{...document,preparedSigners:[]},...references],[request]).join(),/no longer current/);
 assert.match(validatePreparedPackage(root,[document,...references.map(r=>r.id==='cost'?{...r,approvalStatus:'revoked'}:r)],[request]).join(),/approval is no longer current/);
 assert.match(validatePreparedPackage({...root,childRequestIds:['other']},[document,...references],[request]).join(),/do not match/);
 assert.match(validatePreparedPackage({...root,packageDocuments:[{...root.packageDocuments[0],mode:'unknown'}]},[document,...references],[request]).join(),/invalid document mode/);
 assert.match(validatePreparedPackage(root,[{...document,content:'Changed'},...references],[request]).join(),/changed/);
 assert.match(validatePreparedPackage(root,[document,...references],[{...request,recipientEmail:'attacker@example.com'}]).join(),/no longer current/);
 assert.match(validatePreparedPackage(root,[{...document,signingGroupId:'new'},...references],[request]).join(),/no longer current/);
});

test('signature-required references cannot pass on an approval flag alone', () => {
 const signedReferences = references.map(d => d.id === 'cost' ? {...d, requiresSignature:true} : d);
 assert.match(validatePackageSources([agreement],signedReferences,new Set(['board'])).join(),/required reference signatures/);
 assert.deepEqual(validatePackageSources([agreement],signedReferences,new Set(['board','cost'])),[]);
});

function reviewedCapitalizationPackage() {
 const ids={cap:'XmKR9EaPEkeQZcQbaw0A',founder:'pil-founder-share-return-2026-09-23',reserve:'pil-eip-reserve-approval-2026-09-23',board:'pil-auntedna-20260909-05',plan:'pulse-eip-amendment-2026-09-14-v2'};
 const signer={name:'Tremaine Grant',role:'Sole director and stockholder',email:'tre@fitwithpulse.ai'};
 const approved={status:'completed',approvalStatus:'approved',requiresSignature:true,preparedSigners:[signer],capitalizationRevision:1,closingRequirements:[]};
 const supporting: PackageSource[]=[
  {...approved,id:ids.cap,title:'Reviewed capitalization certificate',documentType:'strategic_capitalization_certificate',content:'8,000,000 issued; 1,600,000 plan; 400,000 strategic.',prerequisiteDocumentIds:[ids.founder,ids.reserve,ids.board]},
  {...approved,id:ids.founder,title:'Founder return',documentType:'founder_share_return',content:'Return 1,000,000 shares.',capitalizationRecordedAt:'2026-09-23',capitalizationLedgerEventId:ids.founder,prerequisiteDocumentIds:[],founderReturn:{sharesBefore:9000000,sharesReturned:1000000,sharesAfter:8000000,vestingStartDate:'2025-12-11',vestingMonths:48,cliffMonths:12}},
  {...approved,id:ids.reserve,title:'Reserve consent',documentType:'equity_reserve_approval',content:'Adopt 1,600,000-share plan reserve.',capitalizationRecordedAt:'2026-09-23',capitalizationLedgerEventId:ids.reserve,prerequisiteDocumentIds:[ids.founder],reserveApproval:{planDocumentId:ids.plan,reserveShares:1600000,founderReturnDocumentId:ids.founder,planContentHash:'a'.repeat(64)}},
  {...approved,capitalizationRevision:undefined,id:ids.board,title:'EDNA board consent',documentType:'strategic_board_consent_pil',content:'Authorize EDNA instruments.'},
  references.find(document=>document.id==='cost')!,
 ].map(document=>document.requiresSignature ? {...document,signingRequestIds:[`${document.id}-signed`],signingGroupId:`${document.id}-group`} : document);
 const records=supporting.filter(document=>document.requiresSignature).map(document=>({id:`${document.id}-signed`,equityDocumentId:document.id,documentContent:document.content,signingGroupId:`${document.id}-group`,recipientEmail:signer.email,signerRole:signer.role,status:'signed',signedAt:'2025-01-01',signatureData:{typedName:signer.name,timestamp:'2025-01-01',verificationMethod:'firebase-auth',verifiedEmail:signer.email,verifiedUid:'director'}}));
 const document={...agreement,signingGroupId:'group',signingRequestIds:['child']};
 const request={status:'pending',id:'child',packageId:'root',equityDocumentId:'award',recipientEmail:'recipient@example.com',signerRole:'EDNA CEO',documentContent:'Award terms',signingGroupId:'group'};
 const root={id:'root',documentType:'strategic_signing_package',childRequestIds:['child'],recipientEmail:'recipient@example.com',packageDocuments:[{id:'award',title:'Award',content:'Award terms',mode:'sign',requestId:'child'},...supporting.map(doc=>({...doc,mode:'reference'}))]};
 return {ids,supporting,verified:new Set(supporting.filter(doc=>doc.requiresSignature).map(doc=>doc.id)),document,root,records:[request,...records]};
}

test('revised capitalization cannot be packaged without its exact recorded supporting approvals', () => {
 const p=reviewedCapitalizationPackage();
 assert.deepEqual(validatePackageSources([agreement],p.supporting,p.verified),[]);
 for(const id of [p.ids.founder,p.ids.reserve,p.ids.board]) {
  assert.ok(validatePackageSources([agreement],p.supporting.filter(document=>document.id!==id),p.verified).length,`Missing ${id} must fail`);
 }
 for(const change of [{capitalizationRevision:2},{prerequisiteDocumentIds:[]},{requiresSignature:false}]) {
  assert.match(validatePackageSources([agreement],p.supporting.map(document=>document.id===p.ids.cap?{...document,...change}:document),p.verified).join(),/reviewed revision/);
 }
 const unrecorded=p.supporting.map(document=>document.id===p.ids.founder?{...document,capitalizationRecordedAt:undefined}:document);
 assert.match(validatePackageSources([agreement],unrecorded,p.verified).join(),/signed and recorded founder/);
 const changed=p.supporting.map(document=>document.id===p.ids.reserve?{...document,reserveApproval:{...document.reserveApproval,reserveShares:2000000}}:document);
 assert.match(validatePackageSources([agreement],changed,p.verified).join(),/instructions no longer match/);
});

test('delivery and signature validation retain capitalization prerequisites after preparation', () => {
 const p=reviewedCapitalizationPackage();
 assert.deepEqual(validatePreparedPackage(p.root,[p.document,...p.supporting],p.records),[]);
 const omitted=new Set([p.ids.founder,p.ids.reserve]);
 const stripped={...p.root,packageDocuments:p.root.packageDocuments.filter(document=>!omitted.has(document.id))};
 assert.match(validatePreparedPackage(stripped,[p.document,...p.supporting.filter(document=>!omitted.has(document.id))],p.records).join(),/signed and recorded/);
 for(const change of [{capitalizationLedgerEventId:'different-record'},{capitalizationRecordedAt:undefined},{requiresSignature:false}]) {
  const changed=p.supporting.map(document=>document.id===p.ids.founder?{...document,...change}:document);
  assert.match(validatePreparedPackage(p.root,[p.document,...changed],p.records).join(),/signed and recorded founder/);
 }
 const altered=p.supporting.map(document=>document.id===p.ids.cap?{...document,prerequisiteDocumentIds:[]}:document);
 assert.match(validatePreparedPackage(p.root,[p.document,...altered],p.records).join(),/reviewed revision/);
 const invalidSignature=p.records.map(record=>record.id===`${p.ids.reserve}-signed`?{...record,status:'pending'}:record);
 assert.match(validatePreparedPackage(p.root,[p.document,...p.supporting],invalidSignature).join(),/reference signatures are no longer current/);
});
