import test from 'node:test';
import assert from 'node:assert/strict';
import { allocationPackageStatus, matchesAllocationParty } from '../../src/lib/equityAllocationStatus';
import type { ExecutionRequest } from '../../src/lib/equityExecution';

function fixture() {
  const document = { id: 'award', documentType: 'stock_grant', title: 'Vesting shares', status: 'completed', content: 'Current agreement', requiresSignature: true, signingGroupId: 'current', signingRequestIds: ['company', 'partner'], preparedSigners: [{ role: 'PIL CEO', email: 'company@example.com' }, { role: 'EDNA CEO', email: 'partner@example.com' }] };
  const requests: ExecutionRequest[] = document.preparedSigners.map((signer, index) => ({ id: document.signingRequestIds[index], equityDocumentId: document.id, status: 'signed', recipientEmail: signer.email, signerRole: signer.role, signingGroupId: 'current', documentContent: document.content, signedAt: '2026-09-01', signatureData: { typedName: signer.role, timestamp: '2026-09-01', verificationMethod: 'firebase-auth', verifiedEmail: signer.email, verifiedUid: `uid-${index}` } }));
  return { document, requests };
}

test('verified current package is documents signed, independently of issuance and vesting', () => {
  const { document, requests } = fixture();
  assert.equal(allocationPackageStatus([document], requests).label, 'Documents signed');
  assert.match(allocationPackageStatus([document], requests).detail, /Issuance and vesting are tracked separately/);
});

test('all current required documents and signer identities must verify', () => {
  for (const change of [{ status: 'sent' }, { documentContent: 'Old agreement' }, { previewMode: true }, { invalidatedAt: '2026-09-02' }, { signingGroupId: 'old' }, { signatureData: undefined }]) {
    const { document, requests } = fixture(); Object.assign(requests[0], change);
    assert.equal(allocationPackageStatus([document], requests).signed, false);
  }
  const { document, requests } = fixture();
  assert.equal(allocationPackageStatus([document, { ...document, id: 'approval', signingRequestIds: ['missing'] }], requests).signed, false);
  assert.equal(allocationPackageStatus([{ ...document, signingRequestIds: ['replacement'] }], requests).signed, false);
});

test('reference documents do not block signing and empty packages stay planned', () => {
  const { document, requests } = fixture();
  assert.equal(allocationPackageStatus([document, { id: 'reference', documentType: 'side_letter', title: 'Reciprocal Strategic Equity Side Letter', status: 'completed' }], requests).label, 'Documents signed');
  assert.equal(allocationPackageStatus([], []).label, 'Planned');
});

test('prepared, sent, resend and unresolved requirements retain accurate workflow states', () => {
  const { document, requests } = fixture();
  const prepared = { ...document, signingRequestIds: [] };
  assert.equal(allocationPackageStatus([prepared], []).label, 'Ready to send');
  assert.equal(allocationPackageStatus([{ ...prepared, closingRequirements: ['Set required terms'] }], []).label, 'Planned');
  requests[0].status = 'sent';
  assert.equal(allocationPackageStatus([document], requests).label, 'Awaiting signatures');
  assert.equal(allocationPackageStatus([{ ...document, needsResendSignature: true }], requests).label, 'Needs resend');
});

test('party matching uses whole normalized names and explicit holder IDs', () => {
  assert.equal(matchesAllocationParty({ stakeholderName: 'PIL and AuntEdna.ai' }, 'AuntEdna.ai'), true);
  assert.equal(matchesAllocationParty({ stakeholderName: 'Another AuntEdna.aiExtra' }, 'AuntEdna.ai'), false);
  assert.equal(matchesAllocationParty({ stakeholderName: 'AuntEdna.ai', stakeholderId: 'other' }, 'AuntEdna.ai', 'holder'), false);
});


test('signed supporting approvals cannot substitute for an allocation agreement', () => {
  const { document, requests } = fixture();
  for (const [documentType, title] of [['board_consent', 'Board consent'], ['side_letter', 'Reciprocal Strategic Equity Side Letter'], ['buyback', 'Reciprocal Share-Award Buyback Agreement']]) {
    assert.equal(allocationPackageStatus([{ ...document, documentType, title }], requests).label, 'Planned');
  }
  assert.equal(allocationPackageStatus([document, { id: 'draft', documentType: 'stock_grant', title: 'Another required agreement', status: 'draft', content: 'Draft' }], requests).signed, false);
});
