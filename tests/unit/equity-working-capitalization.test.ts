import test from 'node:test';
import assert from 'node:assert/strict';
import { Timestamp } from 'firebase/firestore';
import { buildWorkingCapitalizationSave, restoreWorkingCapitalization, validateWorkingCapitalization, workingSetupBaseline, type WorkingCapitalization } from '../../src/lib/equityWorkingCapitalization';

const setup: WorkingCapitalization = { founderShares: null, strategicReserve: 0, allocations: [{ id: 'recipient', name: ' Recipient ', kind: 'options', shares: null, percentage: 2.5, notes: ' Planning only ' }] };
const source = { documentType: 'eip', status: 'completed', approvalStatus: 'draft', content: 'Original legal text', effectiveAt: null };
const first = () => buildWorkingCapitalizationSave({ baseline: workingSetupBaseline(), setup, sourcePlanId: 'eip-1', sourcePlan: source, uid: 'admin-1', now: Timestamp.fromMillis(1000) });

test('working persistence keeps unknown values distinct from zero and leaves legal approvals untouched', () => {
  const original = structuredClone(source);
  const result = first();
  assert.equal(result.workingCapitalization.founderShares, null);
  assert.equal(result.workingCapitalization.strategicReserve, 0);
  assert.equal(result.workingCapitalization.allocations[0].shares, null);
  assert.equal(result.workingCapitalization.allocations[0].name, 'Recipient');
  assert.equal(result.workingCapitalization.updatedBy, 'admin-1');
  assert.deepEqual(source, original);
  assert.equal(Object.hasOwn(result, 'approvalStatus'), false);
  assert.equal(Object.hasOwn(result, 'effectiveAt'), false);
  assert.equal(result.documentType, 'capitalization_working_setup');
});

test('stale edits, wrong record types, unfinished plans and unsigned users cannot save', () => {
  const current = first();
  const options = { current, baseline: workingSetupBaseline(current.workingCapitalization), setup, sourcePlanId: 'eip-1', sourcePlan: source, uid: 'admin-1', now: Timestamp.fromMillis(2000) };
  assert.throws(() => buildWorkingCapitalizationSave({ ...options, baseline: workingSetupBaseline() }), /changed while you were editing/);
  assert.throws(() => buildWorkingCapitalizationSave({ ...options, current: { ...current, documentType: 'eip' } }), /needs review/);
  assert.throws(() => buildWorkingCapitalizationSave({ ...options, sourcePlan: { ...source, status: 'generating' } }), /no longer available/);
  assert.throws(() => buildWorkingCapitalizationSave({ ...options, uid: '' }), /Sign in/);
});

test('share counts must be safe nonnegative integers while percentages may be fractional', () => {
  assert.doesNotThrow(() => validateWorkingCapitalization(setup));
  for (const value of [-1, 1.5, Infinity, NaN, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => validateWorkingCapitalization({ ...setup, founderShares: value }));
    assert.throws(() => validateWorkingCapitalization({ ...setup, strategicReserve: value }));
    assert.throws(() => validateWorkingCapitalization({ ...setup, allocations: [{ ...setup.allocations[0], shares: value }] }));
  }
  for (const percentage of [-1, 101, Infinity, NaN]) assert.throws(() => validateWorkingCapitalization({ ...setup, allocations: [{ ...setup.allocations[0], percentage }] }));
  assert.throws(() => validateWorkingCapitalization({ ...setup, allocations: [setup.allocations[0], setup.allocations[0]] }));
  assert.throws(() => validateWorkingCapitalization({ ...setup, allocations: [{ ...setup.allocations[0], name: ' ' }] }));
});

test('repeated saves and restoration retain prior snapshots, source plan and audit trail', () => {
  const initial = first();
  const second = buildWorkingCapitalizationSave({ current: initial, baseline: workingSetupBaseline(initial.workingCapitalization), setup: { ...setup, founderShares: 500, strategicReserve: 300 }, sourcePlanId: 'eip-2', sourcePlan: source, uid: 'admin-2', now: Timestamp.fromMillis(2000) });
  assert.equal(second.workingCapitalizationHistory.length, 1);
  assert.equal(second.workingCapitalizationHistory[0].sourcePlanId, 'eip-1');
  assert.equal(second.workingCapitalizationHistory[0].replacedBy, 'admin-2');
  const restored = restoreWorkingCapitalization(second.workingCapitalizationHistory[0]);
  assert.equal(Object.hasOwn(restored, 'updatedBy'), false);
  assert.equal(Object.hasOwn(restored, 'replacedBy'), false);
  restored.allocations[0].notes = 'Restoration note';
  assert.equal(second.workingCapitalizationHistory[0].allocations[0].notes, 'Planning only');
  const third = buildWorkingCapitalizationSave({ current: second, baseline: workingSetupBaseline(second.workingCapitalization), setup: restored, sourcePlanId: 'eip-2', sourcePlan: source, uid: 'admin-3', now: Timestamp.fromMillis(3000) });
  assert.equal(third.workingCapitalizationHistory.length, 2);
  assert.equal(third.workingCapitalizationHistory[1].founderShares, 500);
  assert.equal(third.workingCapitalizationHistory[1].sourcePlanId, 'eip-2');
  assert.equal(third.workingCapitalization.founderShares, null);
  assert.equal(third.workingCapitalization.updatedBy, 'admin-3');
  assert.equal(third.createdAt.toMillis(), 1000);
  assert.equal(initial.workingCapitalizationHistory.length, 0);
});
