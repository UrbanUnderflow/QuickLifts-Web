import test from 'node:test';
import assert from 'node:assert/strict';
import {buildAuntEdnaVestingDraft} from '../../src/lib/auntEdnaVestingDraft';
import {completeEdnaAgreement, reviseEdnaAgreement} from '../../src/lib/ednaAgreementRevision';
import {reconcileEdnaPackage} from '../../src/lib/ednaReconciledPackage';
import {EDNA_CONTRACTUAL_REPURCHASE_CLAUSE, reviseEdnaContractualBuyback} from '../../src/lib/ednaContractualBuyback';

function originals() {
  const raw = buildAuntEdnaVestingDraft({id: 'private', title: 'Valerie Alexander', content: 'template'}, {id: 'side', title: 'Reciprocal Strategic Equity Side Letter', content: 'source'}).content;
  return reconcileEdnaPackage(completeEdnaAgreement(reviseEdnaAgreement(raw)));
}

test('revises reciprocal repurchase economics without changing warrant, vesting, or event protections', () => {
  const before = originals();
  const serialized = JSON.stringify(before);
  const after = reviseEdnaContractualBuyback(before);
  assert.equal(JSON.stringify(before), serialized, 'source records remain unchanged');
  assert.equal(after[3].content, before[3].content, 'the warrant instrument and price stay unchanged');
  for (const document of after.slice(0, 3)) {
    assert.match(document.content, /\$0\.10/);
    assert.match(document.content, /\$20,000/);
    assert.doesNotMatch(document.content, /original acquisition cost|original-cost/);
    assert.match(document.content, /execution|executed/);
  }
  assert.ok(after[0].content.includes(EDNA_CONTRACTUAL_REPURCHASE_CLAUSE));
  const section = (content: string, start: string, end: string) => content.slice(content.indexOf(start), content.indexOf(end));
  assert.equal(section(after[0].content, '(a) Repurchase Events.', '(c) Price.'), section(before[0].content, '(a) Repurchase Events.', '(c) Price.'));
  assert.equal(section(after[0].content, '(d) Exercise and closing.', '## SECTION 4'), section(before[0].content, '(d) Exercise and closing.', '## SECTION 4'));
  assert.equal(section(after[0].content, '2.5 Vesting.', '## SECTION 3'), section(before[0].content, '2.5 Vesting.', '## SECTION 3'));
  assert.match(after[0].content, /No subsequent appreciation is included/);
  assert.match(after[1].content, /unilateral approval does not constitute bilateral adoption/);
  assert.match(after[2].content, /Board must separately approve the Warrant exercise price/);
  assert.match(after[2].content, /Board approval alone does not establish EDNA’s agreement/);
  for (const document of after) assert.doesNotMatch(document.closingRequirements.join(' '), /original acquisition cost/);
});

test('accepts its own revision idempotently and preserves existing metadata without adding approvals', () => {
  const documents = originals().map(document => ({...document, approvalStatus: 'draft', status: 'completed', preparedSigners: [{name: 'Tremaine Grant'}]}));
  const revised = reviseEdnaContractualBuyback(documents);
  assert.deepEqual(reviseEdnaContractualBuyback(revised), revised);
  for (const document of revised) {
    assert.equal(document.approvalStatus, 'draft');
    assert.equal(document.status, 'completed');
    assert.deepEqual(document.preparedSigners, [{name: 'Tremaine Grant'}]);
    assert.equal('signedAt' in document, false);
    assert.equal('signingRequestIds' in document, false);
  }
});

test('rejects missing, duplicate or substituted package identities', () => {
  assert.throws(() => reviseEdnaContractualBuyback(originals().slice(0, 3)), /four current/);
  const duplicate = originals();
  duplicate[3] = duplicate[2];
  assert.throws(() => reviseEdnaContractualBuyback(duplicate), /four current/);
  const substituted = originals();
  substituted[3].id = 'other-warrant';
  assert.throws(() => reviseEdnaContractualBuyback(substituted), /four current/);
});

test('refuses historical signatures, live requests, or existing approvals', () => {
  for (const metadata of [{signingRequestId: 'sent'}, {signingRequestIds: ['pending']}, {signedAt: new Date()}, {autoSigned: true}, {autoSignedAt: new Date()}, {signatureData: {}}, {status: 'signed'}, {status: 'executed'}, {approvalStatus: 'approved'}]) {
    const documents = originals().map((document, index) => ({...document, ...(index === 2 ? metadata : {})}));
    assert.throws(() => reviseEdnaContractualBuyback(documents), /signing or approval history/);
  }
});

test('fails closed on unreviewed prices and unfamiliar closing requirements', () => {
  const documents = originals();
  documents[0].content = documents[0].content.replace('The repurchase price is EDNA’s original acquisition cost', 'The repurchase price is the fair market value');
  assert.throws(() => reviseEdnaContractualBuyback(documents), /differ from the reviewed draft/);
  const requirements = originals();
  requirements[3].closingRequirements.push('Approve the original acquisition cost at $0.01');
  assert.throws(() => reviseEdnaContractualBuyback(requirements), /unfamiliar repurchase closing requirement/);
});

test('leaves pre-existing FMV and award consideration disclosures unchanged', () => {
  const documents = originals();
  documents[2].content += '\n\nSeparate consideration record: fair market value $0.01 per share; aggregate noncash consideration $2,000.';
  const revised = reviseEdnaContractualBuyback(documents);
  assert.match(revised[2].content, /fair market value \$0\.01 per share; aggregate noncash consideration \$2,000\./);
  assert.match(revised[0].content, /independent of the board’s determination of fair market value/);
});
