import test from 'node:test';
import assert from 'node:assert/strict';
import { nextPipeListsRevision, assertPipeListWriteSafe, pipeListWriteConflicts } from '../../src/utils/pipelistsWriteProtocol';
import { mergePipeListSnapshotsThreeWay } from '../../src/utils/pipelistsCollaboration';
import { stampPipeListTextChanges, stripPipeListTextMetadata, mapPipeListTextOffset, mergePipeListText } from '../../src/utils/pipelistsText';
import { reconcilePipeLists } from '../../src/utils/pipelistsIntegrity';

const board = (stage: string, notes = '', updatedAt = '2026-10-22') => [{ id: 'grants', items: [{ id: 'one', stage, notes, updatedAt }] }];
test('record and list omissions retain known records, while explicit tombstones and archives remain effective', () => {
  const base = board('submitted');
  assert.deepEqual(reconcilePipeLists(base, [{ id: 'grants', items: [] }], base), base);
  assert.deepEqual(reconcilePipeLists(base, [], base), base);
  assert.deepEqual(reconcilePipeLists(base, base, [{ id: 'grants', items: [] }]), base);
  assert.deepEqual(reconcilePipeLists(base, [{ id: 'grants', items: [] }], [{ id: 'grants', items: [] }]), base);
  const deleted = [{ id: 'grants', items: [{ ...base[0].items[0], deletedAt: '2026-10-31' }] }];
  assert.equal(reconcilePipeLists(base, base, deleted)[0].items[0].deletedAt, '2026-10-31');
  assert.deepEqual(reconcilePipeLists(base, [], base, { grants: { archivedAt: '2026-10-31' } }), []);
});
test('simultaneous status changes use the same result in both sessions, independently of device clock', () => {
  const base = board('identified'); const remote = board('submitted'); const stale = board('declined', '', '2099-01-01');
  assert.deepEqual(pipeListWriteConflicts(base, remote, stale), []);
  for (const [r, l] of [[remote, stale], [stale, remote]]) {
    assert.equal(reconcilePipeLists(base, r, l, {}, true)[0].items[0].stage, 'submitted');
  }
});
test('intentional downgrade from the current saved baseline remains allowed', () => {
  const current = board('submitted'); const intentional = board('identified', '', '2026-10-31');
  assert.doesNotThrow(() => assertPipeListWriteSafe(current, current, intentional));
  assert.equal(reconcilePipeLists(current, current, intentional)[0].items[0].stage, 'identified');
});
test('unrelated local edits preserve the remotely updated stage regardless of local timestamp', () => {
  const base = board('identified'); const remote = board('submitted'); const local = board('identified', 'New note', '2099-01-01');
  assert.doesNotThrow(() => assertPipeListWriteSafe(base, remote, local));
  const merged = reconcilePipeLists(base, remote, local)[0].items[0];
  assert.equal(merged.stage, 'submitted'); assert.equal(merged.notes, 'New note');
});
test('revision metadata is opt-in and increments a saved integer, never a clock', () => {
  assert.deepEqual(nextPipeListsRevision({}), {});
  assert.deepEqual(nextPipeListsRevision({ writeProtocol: 2, revision: 7 }), { writeProtocol: 2, revision: 8 });
  assert.throws(() => nextPipeListsRevision({ writeProtocol: 2, revision: '7' }), /Invalid/);
});


test('revision-protected edits use revision order even when an intentional downgrade has an older device clock', () => {
  const base = board('submitted', '', '2026-10-31');
  const remote = board('identified', '', '2026-10-20');
  assert.doesNotThrow(() => assertPipeListWriteSafe(base, remote, base));
  assert.equal(reconcilePipeLists(base, remote, base, {}, true)[0].items[0].stage, 'identified');
});

test('same-position inserts from two sessions both survive, even when the characters match', () => {
  const base = { notes: 'ab' };
  const left = stampPipeListTextChanges(base, { notes: 'a🙂b' });
  const right = stampPipeListTextChanges(base, { notes: 'a🙂b' });
  const result = mergePipeListSnapshotsThreeWay(base, right, left);
  assert.equal(result.notes, 'a🙂🙂b');
  assert.deepEqual(mergePipeListSnapshotsThreeWay(base, left, right), result);
  assert.deepEqual(mergePipeListSnapshotsThreeWay(base, result, left), result);
  assert.deepEqual(stripPipeListTextMetadata(result), { notes: 'a🙂🙂b' });
});

test('deleting a range and reconnecting preserves a simultaneous insertion in that range', () => {
  const base = { notes: 'abcd' };
  const left = stampPipeListTextChanges(base, { notes: 'ad' });
  const right = stampPipeListTextChanges(base, { notes: 'abXcd' });
  const result = mergePipeListSnapshotsThreeWay(base, right, left);
  assert.equal(result.notes, 'aXd');
  const resumed = stampPipeListTextChanges(left, { ...left, notes: 'ad!' });
  assert.equal(mergePipeListSnapshotsThreeWay(left, result, resumed).notes, 'aXd!');
});

test('selection changes retain both editor activity entries and independent text edits', () => {
  const base = { owner: '', stage: 'new', weeklyLogs: [] as {id:string; summary:string}[], notes: '' };
  const left = { ...base, owner: 'Casey', stage: 'ready', notes: 'Call', weeklyLogs: [{id:'a', summary:'owner set to Casey'}] };
  const right = { ...base, owner: 'Avery', stage: 'review', weeklyLogs: [{id:'b', summary:'owner set to Avery'}] };
  for (const [r, l] of [[right,left], [left,right]]) {
    assert.doesNotThrow(() => assertPipeListWriteSafe(base, r, l));
    const result = mergePipeListSnapshotsThreeWay(base, r, l);
    assert.equal(result.owner, 'Casey');
    assert.equal(result.stage, 'review');
    assert.equal(result.notes, 'Call');
    assert.deepEqual(result.weeklyLogs.map(log => log.id).sort(), ['a', 'b']);
  }
});

test('separate edits on a legacy field merge and preserve UTF-16 caret positions', () => {
  assert.equal(mergePipeListText('a b c', 'A b C', 'a B c'), 'A B C');
  assert.equal(mapPipeListTextOffset('a🙂cd', 'go a🙂c!d', 3), 6);
  assert.equal(mapPipeListTextOffset('abcd', 'ad', 3), 1);
});
