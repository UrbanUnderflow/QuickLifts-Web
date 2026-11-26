import test from 'node:test';
import assert from 'node:assert/strict';
import type { NextApiRequest, NextApiResponse } from 'next';
import juniorSeed from '../../scripts/data/junior-curriculum.json';
import { SEEDED_EXERCISES } from '../../src/api/firebase/mentaltraining/exerciseSeed';
import { createCurriculumWorkspaceHandler } from '../../src/pages/api/admin/curriculum/workspace';
import { CurriculumApiError } from '../../src/pages/api/admin/curriculum/_auth';

const setup = () => {
  const store = new Map<string, Record<string, any>>();
  const reads: string[] = [], writes: string[] = [];
  let ids = 0;
  const snapshot = (path: string) => ({ id: path.split('/').at(-1)!, exists: store.has(path), data: () => store.get(path), ref: ref(path) });
  const ref = (path: string): any => ({ path, id: path.split('/').at(-1), get: async () => { reads.push(path); return snapshot(path); } });
  const query = (name: string, filters: any[] = [], cap = 2000): any => ({
    doc: (id = `synthetic-note-${++ids}`) => ref(`${name}/${id}`),
    where: (...filter: any[]) => query(name, [...filters, filter], cap),
    limit: (value: number) => query(name, filters, value),
    get: async () => {
      reads.push(name);
      const docs = [...store.keys()].filter(path => path.startsWith(`${name}/`) && path.split('/').length === 2)
        .filter(path => filters.every(([field, op, value]) => op === '==' && store.get(path)?.[field] === value)).slice(0, cap).map(snapshot);
      return { docs, size: docs.length };
    },
  });
  const writer = () => {
    const pending: Array<{ kind: string; target: any; data: any; merge?: boolean }> = [];
    return {
      get: async (target: any) => { assert.equal(pending.length, 0, 'all transaction reads precede writes'); return target.get(); },
      create: (target: any, data: any) => { assert.equal(store.has(target.path), false); pending.push({ kind: 'create', target, data }); },
      update: (target: any, data: any) => { assert.equal(store.has(target.path), true); pending.push({ kind: 'update', target, data }); },
      set: (target: any, data: any, options?: { merge?: boolean }) => { pending.push({ kind: 'set', target, data, merge: options?.merge }); },
      commit: async () => { for (const change of pending) { writes.push(change.target.path); store.set(change.target.path, change.merge || change.kind === 'update' ? { ...store.get(change.target.path), ...change.data } : change.data); } },
    };
  };
  const db: any = { doc: ref, collection: query, batch: writer, runTransaction: async (callback: any) => { const tx = writer(); await callback(tx); await tx.commit(); } };
  const identity = { uid: 'athleticmind:synthetic-admin', email: 'admin@example.test', displayName: 'Synthetic Admin', projectId: 'quicklifts-dd3f1', db };
  const handler = createCurriculumWorkspaceHandler({ authorize: async () => identity, now: () => 123456, timestamp: () => ({ serverTimestamp: 'synthetic-only' }) });
  const invoke = async (body: unknown, target = handler, method = 'POST', contentType = 'application/json') => {
    let status = 0; let data: any; const headers: Record<string, string> = {};
    const response = { setHeader: (key: string, value: string) => { headers[key] = value; }, status: (code: number) => { status = code; return response; }, json: (value: unknown) => { data = value; } } as unknown as NextApiResponse;
    await target({ method, body, headers: { 'content-type': contentType } } as NextApiRequest, response);
    return { status, data, headers };
  };
  return { store, reads, writes, invoke, identity };
};
const note = { trackId: 'junior', targetId: 'track:junior', targetLabel: 'Junior overview', kind: 'idea', body: 'Synthetic curriculum feedback.', status: 'open', authorUid: 'forged', authorName: 'forged', authorEmail: 'forged@example.test', createdAt: { __curriculumTimestamp: true }, updatedAt: { __curriculumTimestamp: true } };
const commit = (...writes: unknown[]) => ({ action: 'commit', writes });
const settings = (revisionId = 'revision-1') => ({ id: 'current', defaultPillarWeights: { composure: 33, focus: 33, decision: 33 }, pillarWeightsBySport: {}, frequencyTargetsByLevel: { foundational: 12, intermediate: 8, advanced: 4 }, notificationCadence: { morningHourLocal: 8, middayHourLocal: 13, eveningHourLocal: 19 }, engineEnabled: true, revisionId, revisionLog: [{ revisionId, changedAt: 1, summary: 'Synthetic settings.' }], createdAt: 1, updatedAt: 1 });

test('every action requires current admin authorization and JSON POST', async () => {
  const context = setup();
  const denied = createCurriculumWorkspaceHandler({ authorize: async () => { throw new CurriculumApiError(403, 'admin_required', 'Admin access is required.'); } });
  for (const action of ['getDoc', 'getDocs', 'commit', 'syncSeededCopy']) assert.equal((await context.invoke({ action }, denied)).status, 403);
  assert.equal((await context.invoke({}, undefined, 'GET')).status, 405);
  assert.equal((await context.invoke({}, undefined, 'POST', 'text/plain')).status, 415);
  assert.deepEqual(context.reads, []); assert.deepEqual(context.writes, []);
});

test('workspace rejects athlete collections, nested paths, unsupported filters and direct catalog writes', async () => {
  const context = setup();
  for (const path of ['users/synthetic', 'pulsecheck-daily-assignments/synthetic', 'curriculum-notes/id/private/note', 'pulsecheck-curriculum-config/other', 'mental-exercises/../users']) {
    assert.equal((await context.invoke({ action: 'getDoc', path })).status, 403);
  }
  assert.equal((await context.invoke({ action: 'getDocs', collection: 'users' })).status, 403);
  assert.equal((await context.invoke({ action: 'getDocs', collection: 'mental-exercises', filters: [{ field: 'athleteId', operator: '==', value: 'synthetic' }] })).status, 400);
  assert.equal((await context.invoke(commit({ kind: 'set', path: 'sim-modules/test', data: { isActive: false }, merge: true }))).status, 403);
  assert.deepEqual(context.reads, []); assert.deepEqual(context.writes, []);
});

test('read responses preserve note timestamps and report missing documents without widening scope', async () => {
  const context = setup();
  context.store.set('curriculum-notes/synthetic', { ...note, createdAt: { toMillis: () => 4321 }, updatedAt: new Date(5678) });
  context.store.set('mental-exercises/active', { isActive: true, name: 'Synthetic active' });
  context.store.set('mental-exercises/inactive', { isActive: false, name: 'Synthetic inactive' });
  const found = await context.invoke({ action: 'getDoc', path: 'curriculum-notes/synthetic' });
  assert.equal(found.status, 200); assert.equal(found.headers['Cache-Control'], 'private, no-store');
  assert.deepEqual(found.data.data.createdAt, { __curriculumTimestampMillis: 4321 });
  assert.deepEqual(found.data.data.updatedAt, { __curriculumTimestampMillis: 5678 });
  assert.deepEqual((await context.invoke({ action: 'getDoc', path: 'junior-curriculum/missing' })).data, { id: 'missing', exists: false, data: null });
  const filtered = await context.invoke({ action: 'getDocs', collection: 'mental-exercises', filters: [{ field: 'isActive', operator: '==', value: true }], limit: 100 });
  assert.deepEqual(filtered.data.docs.map((doc: any) => doc.id), ['active']);
});

test('unbounded collection reads fail visibly when the safe cap is exceeded', async () => {
  const context = setup();
  for (let index = 0; index < 1001; index++) context.store.set(`curriculum-notes/synthetic-${index}`, { body: 'Synthetic only' });
  const result = await context.invoke({ action: 'getDocs', collection: 'curriculum-notes' });
  assert.equal(result.status, 409); assert.equal(result.data.error, 'read_limit');
});

test('note creation and resolution always use the verified actor and server timestamps', async () => {
  const context = setup();
  const created = await context.invoke(commit({ kind: 'add', path: 'curriculum-notes', data: note }));
  assert.equal(created.status, 200);
  const id = created.data.ids[0]; const path = `curriculum-notes/${id}`;
  assert.equal(context.store.get(path)?.authorUid, context.identity.uid);
  assert.equal(context.store.get(path)?.authorEmail, context.identity.email);
  assert.deepEqual(context.store.get(path)?.createdAt, { serverTimestamp: 'synthetic-only' });
  const resolved = await context.invoke(commit({ kind: 'update', path, data: { status: 'resolved', resolvedByUid: 'forged', resolvedByName: 'forged', resolvedAt: 0, updatedAt: 0 } }));
  assert.equal(resolved.status, 200); assert.equal(context.store.get(path)?.resolvedByUid, context.identity.uid);
  assert.equal(context.store.get(path)?.body, note.body);
  await context.invoke(commit({ kind: 'update', path, data: { status: 'open', resolvedAt: null, resolvedByUid: null, resolvedByName: null } }));
  assert.equal(context.store.get(path)?.resolvedByUid, null);
});

test('a mixed invalid commit performs no partial writes and request sizes are bounded', async () => {
  const context = setup();
  const mixed = await context.invoke(commit({ kind: 'add', path: 'curriculum-notes', data: note }, { kind: 'set', path: 'users/synthetic', data: { admin: true } }));
  assert.equal(mixed.status, 403); assert.deepEqual(context.writes, []);
  assert.equal((await context.invoke(commit(...Array.from({ length: 101 }, () => ({ kind: 'add', path: 'curriculum-notes', data: note }))))).status, 400);
  assert.equal((await context.invoke({ action: 'getDoc', path: 'mental-exercises/test', extra: 'x'.repeat(256 * 1024) })).status, 400);
});

test('junior reseeding uses bundled copy and preserves a newer existing manual module mapping', async () => {
  const context = setup();
  const first = juniorSeed[0];
  context.store.set(`junior-curriculum/${first.id}`, { exerciseId: 'synthetic-manual', customField: 'preserved' });
  context.store.set('mental-exercises/synthetic-manual', { isActive: true, exerciseConfig: { type: 'breathing' } });
  const writes = juniorSeed.map(({ id, ...fields }) => ({ kind: 'set', path: `junior-curriculum/${id}`, merge: true, data: { ...fields, updatedAt: 0, seededBy: 'forged' } }));
  const result = await context.invoke(commit(...writes));
  assert.equal(result.status, 200); assert.equal(result.data.ids.length, juniorSeed.length);
  const row = context.store.get(`junior-curriculum/${first.id}`)!;
  assert.equal(row.exerciseId, 'synthetic-manual'); assert.equal(row.customField, 'preserved');
  assert.equal(row.title, first.title); assert.equal(row.seededBy, 'curriculum-outline (admin@example.test)');
  const modified = { ...writes[0], data: { ...writes[0].data, title: 'Unreviewed replacement copy' } };
  assert.equal((await context.invoke(commit(modified))).status, 409);
});

test('manual junior mappings require a seeded lesson and an active module without a chat handoff', async () => {
  const context = setup();
  const path = `junior-curriculum/${juniorSeed[0].id}`;
  context.store.set(path, { title: 'Keep title', exerciseId: 'old' });
  context.store.set('mental-exercises/unsafe', { isActive: true, exerciseConfig: { type: 'mindset', config: { type: 'growth_mindset' } } });
  context.store.set('mental-exercises/safe', { isActive: true, exerciseConfig: { type: 'breathing' } });
  const mapping = (exerciseId: string) => commit({ kind: 'set', path, merge: true, data: { exerciseId, exerciseMappedBy: 'forged', updatedAt: 0 } });
  for (const id of ['missing', 'unsafe']) assert.equal((await context.invoke(mapping(id))).status, 409);
  assert.deepEqual(context.writes, []);
  assert.equal((await context.invoke(mapping('safe'))).status, 200);
  assert.equal(context.store.get(path)?.title, 'Keep title');
  assert.equal(context.store.get(path)?.exerciseMappedBy, 'curriculum-outline (admin@example.test)');
});

test('settings save validates values, preserves revision history and rejects stale changes', async () => {
  const context = setup(); const path = 'pulsecheck-curriculum-config/current';
  const save = (data: unknown) => context.invoke(commit({ kind: 'set', path, merge: false, data }));
  assert.equal((await save(settings())).status, 200);
  const current = context.store.get(path)!;
  assert.equal(current.revisionLog[0].changedByUserId, context.identity.uid);
  const next = { ...current, engineEnabled: false, revisionId: 'revision-2', revisionLog: [...current.revisionLog, { revisionId: 'revision-2', changedAt: 0, changedByUserId: 'forged', summary: 'Synthetic update.' }] };
  assert.equal((await save(next)).status, 200);
  assert.equal(context.store.get(path)?.engineEnabled, false);
  assert.equal(context.store.get(path)?.revisionLog[1].changedByUserId, context.identity.uid);
  assert.equal((await save(next)).status, 409);
  assert.equal((await save({ ...settings('revision-bad'), defaultPillarWeights: { composure: 0, focus: 0, decision: 0 } })).status, 400);
  assert.equal((await save({ ...settings('revision-bad'), defaultPillarWeights: {} })).status, 400);
  assert.equal((await save({ ...settings('revision-bad'), engineEnabled: 'yes' })).status, 400);
});

test('seed sync accepts server-owned content only and preserves runtime-added fields', async () => {
  const context = setup();
  const path = `sim-modules/${SEEDED_EXERCISES[0].id}`;
  context.store.set(path, { runtimeOnly: 'keep-me' });
  assert.equal((await context.invoke({ action: 'syncSeededCopy', payload: { isActive: false } })).status, 400);
  assert.deepEqual(context.writes, []);
  const result = await context.invoke({ action: 'syncSeededCopy' });
  assert.equal(result.status, 200); assert.equal(result.data.updated, SEEDED_EXERCISES.length);
  assert.equal(context.writes.length, SEEDED_EXERCISES.length * 2);
  assert.ok(context.writes.every(path => /^(sim-modules|mental-exercises)\//.test(path)));
  assert.equal(context.store.get(path)?.runtimeOnly, 'keep-me');
  assert.ok(context.store.get(path)?.sportContentPacks);
});
