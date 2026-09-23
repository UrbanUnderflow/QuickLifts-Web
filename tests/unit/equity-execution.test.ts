import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateGrantExecution, evaluateDocumentSignatures, type ExecutionGrant, type ExecutionDocument, type ExecutionRequest } from '../../src/lib/equityExecution';

function fixture() {
  const grant: ExecutionGrant = { id: 'grant', stakeholderId: 'holder', status: 'active', numberOfShares: 4800, strikePrice: 1, vestingSchedule: '4-year-1-cliff', vestingStartDate: '2025-01-31T12:00:00Z', cliffMonths: 12, vestingMonths: 48, earlyExerciseAllowed: false, equityDocumentId: 'agreement' };
  const agreement: ExecutionDocument = { id: 'agreement', documentType: 'advisor_nso_agreement', stakeholderId: 'holder', grantId: 'grant', status: 'completed', content: 'Exact agreement', createdAt: '2025-01-01', grantDetails: { ...grant }, signingRequestIds: ['recipient', 'company'], preparedSigners: [{ role: 'Recipient', email: 'recipient@example.com' }, { role: 'Company', email: 'company@example.com' }] };
  const board: ExecutionDocument = { id: 'board', documentType: 'board_consent', stakeholderId: 'holder', grantId: 'grant', status: 'completed', content: 'Executed board consent', signingRequestIds: ['director'], preparedSigners: [{ role: 'Director', email: 'director@example.com' }], grantDetails: { ...grant }, executionVerification: { method: 'admin-review', reviewedBy: 'admin', reviewedAt: '2025-01-01', documentContent: 'Executed board consent' } };
  const plan: ExecutionDocument = { id: 'plan', documentType: 'eip', status: 'completed', approvalStatus: 'approved', effectiveAt: '2025-01-01', content: '### 3.1 Share Reserve\nThe maximum number of shares shall be 10,000 shares.' };
  const requests: ExecutionRequest[] = agreement.preparedSigners!.map((signer, index) => ({ id: index ? 'company' : 'recipient', equityDocumentId: 'agreement', stakeholderId: 'holder', status: 'signed', recipientEmail: signer.email, signerRole: signer.role, signingGroupId: 'current', documentContent: agreement.content, signedAt: '2025-01-02', signatureData: { typedName: signer.role, timestamp: '2025-01-02', verificationMethod: 'firebase-auth', verifiedEmail: signer.email, verifiedUid: `uid-${index}` } }));
  requests.push({ id: 'director', equityDocumentId: 'board', status: 'signed', recipientEmail: 'director@example.com', signerRole: 'Director', signingGroupId: 'board-current', documentContent: board.content, signedAt: '2025-01-02', signatureData: { typedName: 'Director', timestamp: '2025-01-02', verificationMethod: 'firebase-auth', verifiedEmail: 'director@example.com', verifiedUid: 'director-uid' } });
  return { stakeholder: { id: 'holder', email: 'recipient@example.com', grants: [grant], boardConsentDocId: 'board' }, grant, documents: [agreement, board, plan], requests, now: Date.parse('2026-01-31T12:00:00Z') };
}

test('verified current agreement, approval and exact terms establish active monthly vesting', () => {
  const result = evaluateGrantExecution(fixture());
  assert.equal(result.verified, true);
  assert.deepEqual(result.vesting, { vested: 1200, unvested: 3600 });
});

test('legacy or incomplete signatures never establish execution but remain protected evidence', () => {
  for (const field of ['typedName', 'timestamp', 'verificationMethod', 'verifiedEmail', 'verifiedUid'] as const) {
    const input = fixture();
    delete input.requests[0].signatureData![field];
    assert.equal(evaluateGrantExecution(input).verified, false, field);
    assert.equal(evaluateDocumentSignatures(input.documents[0], input.requests, input.now).hasRecordedSignatures, true);
  }
  const input = fixture(); delete input.requests[0].signedAt;
  assert.equal(evaluateGrantExecution(input).verified, false);
});

test('wrong roles, identities, stale groups, previews and stale signed content are rejected', () => {
  for (const change of [
    { signerRole: 'Company' }, { recipientEmail: 'other@example.com' }, { signingGroupId: 'old' },
    { previewMode: true }, { invalidatedAt: '2025-02-01' }, { status: 'sent' }, { documentContent: 'Old text' },
  ]) {
    const input = fixture(); Object.assign(input.requests[0], change);
    assert.equal(evaluateGrantExecution(input).verified, false, JSON.stringify(change));
  }
  const input = fixture(); input.documents[0].signingRequestIds = ['replacement'];
  assert.equal(evaluateGrantExecution(input).verified, false);
});

test('auto-signing and AI verification do not prove board approval; effective plan is required', () => {
  const input = fixture(); delete input.documents[1].executionVerification; input.documents[1].autoSigned = true; input.documents[1].signingRequestIds = [];
  assert.equal(evaluateGrantExecution(input).verified, false);
  const noPlan = fixture(); noPlan.documents[2].approvalStatus = 'draft';
  assert.equal(evaluateGrantExecution(noPlan).verified, false);
});

test('stale or omitted grant terms and ambiguous multi-grant fallback fail closed', () => {
  for (const field of ['numberOfShares', 'strikePrice', 'vestingStartDate', 'cliffMonths', 'vestingMonths', 'earlyExerciseAllowed'] as const) {
    const input = fixture(); delete input.documents[0].grantDetails![field];
    assert.equal(evaluateGrantExecution(input).verified, false, field);
  }
  const stale = fixture(); stale.documents[0].grantDetails!.numberOfShares = 6000;
  assert.equal(evaluateGrantExecution(stale).vesting, null);
  const input = fixture(); delete input.grant.equityDocumentId; delete input.documents[0].grantId;
  input.stakeholder.grants.push({ ...input.grant, id: 'other' });
  assert.equal(evaluateGrantExecution(input).verified, false);
});

test('cliff, end, future start and month-end vesting boundaries use elapsed whole months', () => {
  for (const [date, vested] of [['2026-01-31T11:59:59Z', 0], ['2026-01-31T12:00:00Z', 1200], ['2029-01-31T12:00:00Z', 4800], ['2030-01-31T12:00:00Z', 4800], ['2025-01-15T12:00:00Z', 0]] as const) {
    const input = fixture(); input.now = Date.parse(date);
    assert.equal(evaluateGrantExecution(input).vesting?.vested, vested, date);
  }
  const input = fixture(); input.grant.cliffMonths = 0; input.documents[0].grantDetails!.cliffMonths = 0; input.documents[1].grantDetails!.cliffMonths = 0; input.grant.vestingSchedule = '4-year-monthly'; input.documents[0].grantDetails!.vestingSchedule = '4-year-monthly'; input.documents[1].grantDetails!.vestingSchedule = '4-year-monthly'; input.now = Date.parse('2025-02-28T12:00:00Z');
  assert.equal(evaluateGrantExecution(input).vesting?.vested, 100);
  input.grant.cliffMonths = -1; input.documents[0].grantDetails!.cliffMonths = -1;
  assert.equal(evaluateGrantExecution(input).vesting, null);
});

test('closed grants cannot be resurrected by verified signatures', () => {
  for (const status of ['terminated', 'revoked', 'exercised']) {
    const input = fixture(); input.grant.status = status;
    const result = evaluateGrantExecution(input);
    assert.equal(result.status, status); assert.equal(result.verified, false); assert.equal(result.vesting, null);
  }
});

test('sole-grant holder links work and company signers may have their own stakeholder ID', () => {
  const input = fixture(); delete input.grant.equityDocumentId; delete input.documents[0].grantId;
  input.requests[1].stakeholderId = 'founder';
  assert.equal(evaluateGrantExecution(input).verified, true);
  input.documents.push({ ...input.documents[0], id: 'new-agreement', updatedAt: '2025-04-01', signingRequestIds: ['new-unsigned-request'] });
  const result = evaluateGrantExecution(input);
  assert.equal(result.documentId, 'new-agreement');
  assert.equal(result.verified, false);
  assert.equal(result.label, 'Ready to send');
});

test('board review of stale terms or changed text does not establish approval', () => {
  const input = fixture(); input.documents[1].grantDetails!.numberOfShares = 5000;
  assert.equal(evaluateGrantExecution(input).verified, false);
  const changed = fixture(); changed.documents[1].content = 'Changed board text';
  assert.equal(evaluateGrantExecution(changed).verified, false);
});

test('an admin review without retained execution evidence never substitutes for director signatures', () => {
  const input = fixture(); input.documents[1].signingRequestIds = [];
  assert.ok(input.documents[1].executionVerification);
  assert.equal(evaluateGrantExecution(input).verified, false);
});

test('custom, annual, missing and inconsistent schedules never produce monthly vesting', () => {
  for (const schedule of ['custom', 'annual', undefined, '2-year-monthly']) {
    const input = fixture();
    input.grant.vestingSchedule = schedule;
    input.documents[0].grantDetails!.vestingSchedule = schedule;
    input.documents[1].grantDetails!.vestingSchedule = schedule;
    const result = evaluateGrantExecution(input);
    assert.equal(result.verified, false);
    assert.equal(result.vesting, null);
  }
});

test('missing grant IDs never pull the latest agreement from another shareholder', () => {
  const input = fixture();
  input.grant.id = undefined as unknown as string;
  delete input.grant.equityDocumentId;
  delete input.documents[0].grantId;
  delete input.documents[1].grantId;
  input.documents.push({ ...input.documents[0], id: 'other-holder-agreement', stakeholderId: 'other-holder', updatedAt: '2025-06-01' });
  assert.equal(evaluateGrantExecution(input).documentId, 'agreement');
  input.documents = input.documents.filter(document => document.id !== 'agreement');
  assert.equal(evaluateGrantExecution(input).documentId, null);
});

test('explicit monthly schedules support independently documented duration and cliff', () => {
  const input = fixture();
  const terms = { vestingSchedule: 'monthly', vestingMonths: 24, cliffMonths: 3 };
  Object.assign(input.grant, terms);
  Object.assign(input.documents[0].grantDetails!, terms);
  Object.assign(input.documents[1].grantDetails!, terms);
  input.now = Date.parse('2025-04-30T12:00:00Z');
  assert.deepEqual(evaluateGrantExecution(input).vesting, { vested: 600, unvested: 4200 });
  input.now = Date.parse('2025-04-30T11:59:59Z');
  assert.deepEqual(evaluateGrantExecution(input).vesting, { vested: 0, unvested: 4800 });
  input.documents[1].grantDetails!.cliffMonths = 0;
  assert.equal(evaluateGrantExecution(input).vesting, null);
});


test('workflow stages follow preparation and actual sending without a verification stage', () => {
  const input = fixture();
  input.documents = input.documents.filter(d => d.id !== 'agreement');
  assert.equal(evaluateGrantExecution(input).label, 'Planned');
  const prepared = fixture();
  prepared.requests = [];
  prepared.documents[0].signingRequestIds = [];
  assert.equal(evaluateGrantExecution(prepared).label, 'Ready to send');
  prepared.documents[0].status = 'generating';
  assert.equal(evaluateGrantExecution(prepared).label, 'Planned');
  const unsent = fixture();
  unsent.requests.forEach(r => { r.status = 'pending'; delete r.signedAt; delete r.signatureData; });
  assert.equal(evaluateGrantExecution(unsent).label, 'Ready to send');
  unsent.requests[0].status = 'sent';
  assert.equal(evaluateGrantExecution(unsent).label, 'Awaiting signatures');
  unsent.requests[0].previewMode = true;
  assert.equal(evaluateGrantExecution(unsent).label, 'Ready to send');
  unsent.requests[0].previewMode = false;
  unsent.requests[0].invalidatedAt = '2025-01-02';
  assert.equal(evaluateGrantExecution(unsent).label, 'Ready to send');
  assert.equal(evaluateGrantExecution(fixture()).label, 'Active');
  const problem = fixture();
  problem.documents[1].grantDetails!.numberOfShares = 999;
  const blocked = evaluateGrantExecution(problem);
  assert.equal(blocked.label, 'Awaiting signatures');
  assert.equal(blocked.verified, false);
  assert.ok(blocked.reasons.includes('Board approval terms must match this grant.'));
});
