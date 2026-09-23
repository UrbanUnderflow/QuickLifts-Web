import test from 'node:test';
import assert from 'node:assert/strict';
import {reconcileEdnaPackage} from '../../src/lib/ednaReconciledPackage';
import {buildAuntEdnaVestingDraft} from '../../src/lib/auntEdnaVestingDraft';
import {completeEdnaAgreement, reviseEdnaAgreement} from '../../src/lib/ednaAgreementRevision';
import {isEquityReferenceDocument, isSendableEquityDocument} from '../../src/lib/equityDocumentScope';
test('reconciled package separates awards, preserves vesting and conditions sole-director approval', () => {
 const agreement=completeEdnaAgreement(reviseEdnaAgreement(buildAuntEdnaVestingDraft({id:'private',title:'Valerie Alexander',content:'template'},{id:'side',title:'Reciprocal Strategic Equity Side Letter',content:'source'}).content));
 const docs=reconcileEdnaPackage(agreement);
 for (const doc of docs) {
  assert.match(doc.content,/September 23, 2026/);
  assert.match(doc.content,/September 11, 2027/);
  assert.doesNotMatch(doc.content,/Jelanna Salas|AuntEdna.ai, Inc.|September 9, 2026|six-month|twenty-four \(24\)|Valerie/);
 }
 assert.match(docs[1].content,/4.6 Repurchase/);
 assert.match(docs[1].content,/2.0% of EDNA/);
 assert.equal(isEquityReferenceDocument(docs[1]),false);
 assert.equal(isSendableEquityDocument(docs[1]),true);
 assert.match(docs[2].content,/Tremaine Grant, constituting the sole director/);
 assert.match(docs[2].content,/1,600,000-share/);
 assert.doesNotMatch(docs[2].content,/approves reducing/);
 assert.match(docs[2].content,/No dollar amount is supplied/);
 assert.equal(docs[2].exhibits.length,3);
 assert.match(docs[3].content,/Issue Date is the actual coordinated closing date/);
 assert.match(docs[0].content,/September 23, 2026 revised Side Letter/);
});
