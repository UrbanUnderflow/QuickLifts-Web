import test from 'node:test';
import assert from 'node:assert/strict';
import {getEquitySigningRequirements, getEquityIssuanceRequirements, requiresEquitySigningPackage} from '../../src/lib/equitySigningRequirements';
import {validatePackageSources, validatePreparedPackage} from '../../src/lib/equitySigningPackage';

const conditions = [
  'Complete PIL board approval of consideration value and the separate Warrant exercise price, and obtain bilateral adoption of the matching $0.10 contractual Share Award repurchase price',
  'Complete approved capitalization and reservation certificates and reciprocal EDNA award delivery, including the initial 2% condition',
  'Confirm EDNA corporate identity and obtain all required signatures and corporate and securities approvals',
];
const document = {id:'pil-auntedna-vesting-shares-draft',documentType:'strategic_vesting_equity_agreement',contractualBuybackRevision:1,closingRequirements:conditions};

test('moves only exact reviewed conditions for the exact reconciled EDNA instruments', () => {
  for (const id of [document.id, 'pil-auntedna-20260909-04', 'pil-auntedna-20260909-07']) {
    assert.deepEqual(getEquitySigningRequirements({...document,id}), []);
    assert.deepEqual(getEquityIssuanceRequirements({...document,id}), conditions);
  }
  for (const change of [{id:'another-award'},{contractualBuybackRevision:undefined},{contractualBuybackRevision:2},{contractualBuybackRevision:'1'}]) {
    assert.deepEqual(getEquitySigningRequirements({...document,...change}), conditions);
    assert.deepEqual(getEquityIssuanceRequirements({...document,...change}), []);
  }
  assert.deepEqual(document.closingRequirements,conditions);
});

test('keeps every unknown condition blocking and preserves prior issuance requirements', () => {
  const source = {...document,closingRequirements:[...conditions,'Confirm share count',conditions[0] + '.'],issuanceRequirements:['Deliver EDNA evidence',conditions[0]]};
  assert.deepEqual(getEquitySigningRequirements(source), ['Confirm share count', conditions[0] + '.']);
  assert.deepEqual(getEquityIssuanceRequirements(source), ['Deliver EDNA evidence',...conditions]);
  const migrated = {...source,closingRequirements:getEquitySigningRequirements(source),issuanceRequirements:getEquityIssuanceRequirements(source)};
  assert.deepEqual(getEquitySigningRequirements(migrated),getEquitySigningRequirements(source));
  assert.deepEqual(getEquityIssuanceRequirements(migrated),getEquityIssuanceRequirements(source));
});

test('coordinated instruments cannot switch to a standalone signing workflow', () => {
  assert.equal(requiresEquitySigningPackage(document),true);
  assert.equal(requiresEquitySigningPackage({...document,closingRequirements:[],contractualBuybackRevision:undefined}),true);
  assert.equal(requiresEquitySigningPackage({id:'pil-edna-reciprocal-buyback-agreement'}),true);
  assert.equal(requiresEquitySigningPackage({id:'uploaded-buyback',documentType:'strategic_reciprocal_buyback_agreement'}),true);
  assert.equal(requiresEquitySigningPackage({id:'board',documentType:'strategic_board_consent_pil'}),false);
});

test('conditional documents still require verified board and approved references at preparation and signing', () => {
  const signable = {...document,status:'completed',content:'Conditional award terms',requiresSignature:true,preparedSigners:[{name:'Recipient',role:'EDNA CEO',email:'edna@example.com'}]};
  const references = [{id:'board',title:'Board',documentType:'strategic_board_consent_pil',status:'completed',content:'Board'}, {id:'cap',title:'Capitalization',documentType:'capitalization_certificate',status:'completed',content:'Cap',approvalStatus:'approved'}, {id:'cost',title:'Consideration',documentType:'consideration_schedule',status:'completed',content:'Cost',approvalStatus:'approved'}];
  assert.deepEqual(validatePackageSources([signable],references,new Set(['board'])),[]);
  assert.match(validatePackageSources([signable],references,new Set()).join(),/verified signatures/);
  assert.match(validatePackageSources([signable],references.filter(d=>d.id!=='cost'),new Set(['board'])).join(),/approved consideration/);
  const saved={...signable,signingGroupId:'group',signingRequestIds:['child']};
  const request={status:'pending',id:'child',packageId:'root',equityDocumentId:document.id,recipientEmail:'edna@example.com',signerRole:'EDNA CEO',documentContent:signable.content,signingGroupId:'group'};
  const root={id:'root',documentType:'strategic_signing_package',childRequestIds:['child'],recipientEmail:'edna@example.com',packageDocuments:[{id:document.id,title:'Award',content:signable.content,mode:'sign',requestId:'child'},...references.map(d=>({...d,mode:'reference'}))]};
  assert.deepEqual(validatePreparedPackage(root,[saved,...references],[request]),[]);
  assert.match(validatePreparedPackage(root,[{...saved,closingRequirements:[...conditions,'Missing share count']},...references],[request]).join(),/no longer current/);
  assert.match(validatePreparedPackage(root,[saved,...references.map(d=>d.id==='cap'?{...d,approvalStatus:'pending'}:d)],[request]).join(),/approval/);
});
