import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveEquityBalances, issuedShares, readPlanReserve, resolveEquityPlan, resolveWorkingEquityPlan } from '../../src/lib/equityPlanState';

const body = (n: string) => `### 3.1 Share Reserve\nThe maximum number of shares of Common Stock shall be **${n} shares**.\n### 3.2 Share Counting\n`;
const original = { id: 'v1', documentType: 'eip', status: 'completed', autoSigned: true, content: body('1,000,000') };
const draft = { ...original, id: 'v2', originalDocumentId: 'v1', versionNumber: 2, autoSigned: false, approvalStatus: 'draft', content: body('1,600,000') };

test('working setup displays the latest saved draft without changing issuance capacity', () => {
  const documents = [original, draft];
  const working = resolveWorkingEquityPlan(documents);
  assert.equal(working.plan?.id, 'v2');
  assert.equal(working.reserve, 1600000);
  assert.equal(working.isEffective, false);
  assert.equal(resolveEquityPlan(documents).reserve, 1000000);
  assert.deepEqual(documents.map(d => d.id), ['v1', 'v2']);
});

test('a newer effective setup takes precedence over an older pending plan', () => {
  const pending = { ...draft, createdAt: { seconds: 1000 } };
  const approved = { ...draft, id: 'v3', versionNumber: 3, approvalStatus: 'approved', effectiveAt: '2026-09-01', createdAt: { toMillis: () => 2000000 } };
  const working = resolveWorkingEquityPlan([pending, approved], Date.parse('2026-09-23'));
  assert.equal(working.plan?.id, 'v3');
  assert.equal(working.isEffective, true);
});

test('working setup preserves an unknown reserve and ignores unfinished or unrelated documents', () => {
  const working = resolveWorkingEquityPlan([
    original,
    { ...draft, content: 'Unrecognized reserve language' },
    { ...draft, id: 'in-progress', versionNumber: 3, status: 'generating' },
    { ...draft, id: 'other', versionNumber: 4, documentType: 'board_consent' },
  ]);
  assert.equal(working.plan?.id, 'v2');
  assert.equal(working.reserve, null);
  assert.deepEqual(resolveWorkingEquityPlan([]), { plan: undefined, reserve: null, isEffective: false });
});

test('a newly saved restoration wins by creation time and tied records have stable selection', () => {
  const newer = { ...draft, createdAt: '2026-09-22' };
  const restored = { ...draft, id: 'restored', versionNumber: 1, content: original.content, createdAt: '2026-09-23' };
  assert.equal(resolveWorkingEquityPlan([newer, restored]).reserve, 1000000);
  const tied = { ...newer, id: 'a-tied' };
  assert.equal(resolveWorkingEquityPlan([newer, tied]).plan?.id, 'a-tied');
  assert.equal(resolveWorkingEquityPlan([tied, newer]).plan?.id, 'a-tied');
});

test('pending amendments show separately and provide no usable reserve', () => {
  const state = resolveEquityPlan([draft, original]);
  assert.equal(state.active?.id, 'v1');
  assert.equal(state.reserve, 1000000);
  assert.equal(state.proposedReserve, 1600000);
  assert.equal(resolveEquityPlan([draft]).reserve, null);
});
test('approval alone does not activate an amendment; recorded effectiveness changes the source', () => {
  const approved = { ...draft, approvalStatus: 'approved', effectiveAt: '2026-10-01' };
  assert.equal(resolveEquityPlan([approved, original], Date.parse('2026-09-14')).reserve, 1000000);
  assert.equal(resolveEquityPlan([approved, original], Date.parse('2026-10-02')).reserve, 1600000);
  assert.equal(resolveEquityPlan([{ ...approved, effectiveAt: undefined }, original]).reserve, 1000000);
});
test('unrecognized or ambiguous governing text requires review instead of a default reserve', () => {
  assert.equal(readPlanReserve('Authorize 2,000,000 shares elsewhere'), null);
  assert.equal(readPlanReserve(body('1,000,000').replace('### 3.2', 'The maximum number of shares shall be 2,000,000 shares.\n### 3.2')), null);
  assert.ok(resolveEquityPlan([{ ...original, content: 'Different plan language' }]).issue);
});
test('options are commitments, not ownership, and exercises do not consume the reserve twice', () => {
  const holders = [{ type: 'founder', totalShares: 9000000 }, { type: 'advisor', sharesOwned: 10000, optionsGranted: 50000, optionsExercised: 10000 }];
  const result = deriveEquityBalances(holders, 1000000, 10000, 10000000);
  assert.equal(result.issued, 9010000);
  assert.equal(result.committed, 50000);
  assert.equal(result.available, 950000);
  assert.equal(result.unallocated, 0);
});
test('explicit zero holdings override legacy totals, and common-stock awards consume plan capacity', () => {
  assert.equal(issuedShares({ type: 'founder', sharesOwned: 0, totalShares: 9000000 }), 0);
  const result = deriveEquityBalances([{ type: 'employee', sharesOwned: 200000, grants: [{ equityType: 'common', status: 'active', numberOfShares: 200000 }] }], 1000000, 0, 10000000);
  assert.equal(result.committed, 200000);
  assert.equal(result.planIssued, 200000);
  assert.equal(result.unissuedReserve, 800000);
});
test('recorded releases retain exercised usage; strategic awards stay outside the EIP', () => {
  const result = deriveEquityBalances([{ type: 'advisor', sharesOwned: 10000, optionsExercised: 10000, grants: [
    { equityType: 'nso', status: 'terminated', numberOfShares: 50000, exercisedShares: 10000, releasedShares: 40000 },
    { equityType: 'common', status: 'active', numberOfShares: 200000, reserveSource: 'strategic' },
  ] }], 1000000, 0, 10000000);
  assert.equal(result.committed, 10000);
  assert.equal(result.available, 990000);
});
test('over-allocation remains visible, never silently clamped to zero', () => {
  assert.equal(deriveEquityBalances([{ type: 'advisor', optionsGranted: 1100000 }], 1000000, 0, 10000000).available, -100000);
});

test('termination alone does not release vested or outstanding exercise rights', () => {
  const state = deriveEquityBalances([{ type: 'advisor', grants: [{ equityType: 'nso', status: 'terminated', numberOfShares: 50000 }] }], 1000000, 0, 10000000);
  assert.equal(state.available, 950000);
});
