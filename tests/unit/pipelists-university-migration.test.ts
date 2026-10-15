import test from 'node:test';
import assert from 'node:assert/strict';
import { migrateUniversityList, previewUniversityMigration, universityStageMigration, UNIVERSITY_MIGRATION_STAGES } from '../../src/utils/pipelistsUniversityMigration';
const list = (): any => ({ id: 'university-1', templateKey: 'university-pilot', stages: [{ id: 'identified', label: 'Reviewed custom label', probability: 3, custom: true }, { id: 'cold-email-sent', label: 'Cold Email Sent', probability: 15 }, { id: 'custom-review', label: 'Custom Review', probability: 18 }], items: [{ id: 'lead-1', stage: 'cold-email-sent', weeklyLogs: [{ id: 'prior', notes: 'Synthetic history' }] }, { id: 'lead-2', stage: 'closed-won', notes: 'Synthetic legacy win' }, { id: 'lead-3', stage: 'custom-review' }] });
function database() {
  const records = new Map<string, any>([['simpbudget-users/owner/pipeLists/state', { lists: [list(), { id: 'other', templateKey: 'contacts', items: [] }] }], ['pipeListProtectedShares/owner-university-1', { ownerUid: 'owner', listId: 'university-1', list: list() }]]);
  const ref = (path: string): any => ({ path, collection: (id: string) => collection(`${path}/${id}`) });
  const collection = (path: string): any => ({ doc: (id: string) => ref(`${path}/${id}`) });
  let count = 0; let queue = Promise.resolve();
  const db: any = { records, collection, get writeCount() { return count; }, runTransaction(fn: any) { const result = queue.then(async () => { const writes: (() => void)[] = []; const value = await fn({ get: async (r: any) => ({ exists: records.has(r.path), data: () => records.get(r.path) }), set: (r: any, data: any) => writes.push(() => records.set(r.path, structuredClone(data))), update: (r: any, data: any) => writes.push(() => records.set(r.path, { ...records.get(r.path), ...structuredClone(data) })) }); count += writes.length; writes.forEach(write => write()); return value; }); queue = result.catch(() => {}); return result; } };
  return db;
}
const previewInput = { action: 'preview', listId: 'university-1' };
const approval = (preview: any) => ({ action: 'apply', listId: preview.listId, targetVersion: preview.targetVersion, expectedFingerprint: preview.fingerprint, approved: true });
test('explicit migration preserves custom stage configuration and prior history without inventing touches', () => {
  const before = list(); const after = migrateUniversityList(before);
  assert.deepEqual(after.items[0], before.items[0]); assert.equal(after.items[1].stage, 'pilot-active'); assert.equal(after.items[2].stage, 'custom-review');
  assert.deepEqual(after.stages.find((s: any) => s.id === 'identified'), { ...UNIVERSITY_MIGRATION_STAGES[0], ...before.stages[0] });
  assert.equal(after.stages.find((s: any) => s.id === 'cold-email-sent').label, 'First Email Sent');
  assert.equal(after.stages.filter((s: any) => ['cold-email-sent','call-attempted','follow-up-email-sent','final-outreach-email-sent'].includes(s.id)).every((s: any) => s.probability === 15), true);
  assert.deepEqual(migrateUniversityList(after), after); assert.equal(before.items[1].stage, 'closed-won');
});
test('preview is read only and contains both copies plus an exact scoped fingerprint', async () => {
  const db = database(); const before = structuredClone([...db.records]); const preview = await universityStageMigration(db, 'owner', previewInput);
  assert.equal(db.writeCount, 0); assert.deepEqual([...db.records], before); assert.equal(preview.changes.personal.itemStageChanges.length, 1); assert.ok(preview.before.protected);
  assert.notEqual(preview.fingerprint, previewUniversityMigration('another-owner', 'university-1', list(), list()).fingerprint);
});
test('apply requires explicit approval and rejects stale or mismatched versions without writes', async () => {
  const db = database(); const preview = await universityStageMigration(db, 'owner', previewInput);
  await assert.rejects(universityStageMigration(db, 'owner', { ...approval(preview), approved: false }), /Approve/);
  await assert.rejects(universityStageMigration(db, 'owner', { ...approval(preview), targetVersion: 2 }), /Approve/);
  db.records.get('pipeListProtectedShares/owner-university-1').list.items[0].notes = 'Concurrent edit';
  await assert.rejects(universityStageMigration(db, 'owner', approval(preview)), /changed after preview/); assert.equal(db.writeCount, 0);
});
test('approved apply atomically preserves rollback copies and unrelated lists, and is idempotent after re-preview', async () => {
  const db = database(); const before = structuredClone([...db.records]); const preview = await universityStageMigration(db, 'owner', previewInput);
  const result: any = await universityStageMigration(db, 'owner', approval(preview)); assert.equal(result.applied, true); assert.equal(db.writeCount, 3);
  const backup = [...db.records].find(([key]: any) => key.startsWith('pipeListStageMigrations/'))![1];
  assert.deepEqual(backup.before.personal, before[0][1].lists[0]); assert.deepEqual(backup.before.protected, before[1][1].list);
  assert.deepEqual(db.records.get('simpbudget-users/owner/pipeLists/state').lists[1], before[0][1].lists[1]);
  const again = await universityStageMigration(db, 'owner', previewInput); assert.equal(again.changed, false);
  await universityStageMigration(db, 'owner', approval(again)); assert.equal(db.writeCount, 3);
});
test('concurrent approvals cannot apply the same stale preview twice', async () => {
  const db = database(); const preview = await universityStageMigration(db, 'owner', previewInput);
  const results = await Promise.allSettled([universityStageMigration(db, 'owner', approval(preview)), universityStageMigration(db, 'owner', approval(preview))]);
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1); assert.equal(db.writeCount, 3);
});
test('unrelated/newer schemas and mismatched protected ownership fail closed', async () => {
  assert.throws(() => migrateUniversityList({ ...list(), templateKey: 'contacts' }), /Only university/);
  assert.throws(() => migrateUniversityList({ ...list(), universityStageSchemaVersion: 2 }), /newer/);
  const db = database(); db.records.get('pipeListProtectedShares/owner-university-1').ownerUid = 'outsider';
  await assert.rejects(universityStageMigration(db, 'owner', previewInput), /ownership review/); assert.equal(db.writeCount, 0);
});
