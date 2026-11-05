import test from 'node:test';
import assert from 'node:assert/strict';
import { nextPipeListsRevision, assertPipeListWriteSafe, pipeListWriteConflicts } from '../../src/utils/pipelistsWriteProtocol';
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
test('newer client clock cannot resolve a conflicting status change', () => {
  const base = board('identified'); const remote = board('submitted'); const stale = board('declined', '', '2099-01-01');
  assert.throws(() => assertPipeListWriteSafe(base, remote, stale), /same fields/);
  assert.deepEqual(pipeListWriteConflicts(base, remote, stale), ['/grants/items/one/stage']);
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
