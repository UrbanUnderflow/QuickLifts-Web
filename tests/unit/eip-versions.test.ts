import test from 'node:test';
import assert from 'node:assert/strict';
import { buildEipDraftVersion, eipDraftText, isApprovedEip, nextEipVersion } from '../../src/lib/eipVersions';
const original = Object.freeze({ id: 'signed-original', documentType: 'eip', status: 'completed', autoSigned: true, autoSignedAt: 'original-date' });

test('a new EIP version preserves source and does not inherit signatures or approvals', () => {
 const draft = buildEipDraftVersion(original, {title: 'Amendment', content:'Proposed reserve change', changeSummary:'Increase reserve',versionNumber:2,now:'today'});
 assert.equal(draft.originalDocumentId, original.id);
 assert.equal(draft.sourceDocumentId, original.id);
 assert.equal(draft.approvalStatus, 'draft');
 assert.equal(draft.autoSigned, false);
 assert.equal('autoSignedAt' in draft, false);
 assert.equal('signingRequestId' in draft, false);
 assert.equal(draft.requiresSignature, true);
 assert.equal(original.autoSignedAt, 'original-date');
 assert.ok(isApprovedEip(original));
 assert.equal(isApprovedEip({...draft,id:'new'}),false);
});
test('a draft cannot become governing just because it was generated more recently', () => {
 assert.equal(isApprovedEip({...original, approvalStatus:'draft'}),false);
 assert.equal(isApprovedEip({id:'unsigned',documentType:'eip',status:'completed'}),false);
});
test('version lineage includes all existing descendants', () => {
 const draft={id:'v2',documentType:'eip',originalDocumentId:original.id,versionNumber:2};
 assert.equal(nextEipVersion(draft,[original,draft,{...draft,id:'v3',versionNumber:3}]),4);
});
test('draft editing removes the old adoption signature and preserves later safeguards', () => {
 const draft=eipDraftText('## Plan\nOriginal terms\n## 11. Adoption Footer\nWas approved January 11\n/s/ Tremaine Grant\n## Plan Administration Safeguards\nKeep these limits');
 assert.ok(draft.includes('Original terms'));
 assert.ok(draft.includes('Keep these limits'));
 assert.ok(draft.includes('Actual execution date:'));
 assert.equal(draft.includes('/s/'),false);
 assert.equal(draft.includes('Was approved'),false);
});
test('copied executed signature is rejected, and a change summary is required', () => {
 const opts={title:'v2',content:'/s/ Tremaine Grant',changeSummary:'Change',versionNumber:2,now:'today'};
 assert.throws(()=>buildEipDraftVersion(original,opts),/copied signatures/);
 assert.throws(()=>buildEipDraftVersion(original,{...opts,content:'Draft',changeSummary:''}),/change summary/);
});
