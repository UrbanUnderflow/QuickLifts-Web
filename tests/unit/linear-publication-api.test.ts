import test from 'node:test';
import assert from 'node:assert/strict';
import type { NextApiRequest, NextApiResponse } from 'next';
import type { app } from 'firebase-admin';
import { createCurriculumAdminAuthorizer } from '../../src/pages/api/admin/curriculum/_auth';
import { createLinearPublicationHandler } from '../../src/pages/api/admin/curriculum/publication';
import { previewLinearAssignment, type LinearPublishedVersion } from '../../src/api/firebase/dailyCurriculum/linearPublication';

const authApp = (options: { invalid?: boolean; registered?: boolean; verified?: boolean }) => ({ options: { projectId: 'isolated' }, auth: () => ({ verifyIdToken: async (_token: string, checkRevoked: boolean) => { assert.equal(checkRevoked, true); if (options.invalid) throw Error('bad token'); return { uid: 'admin-1', email: 'Admin@Example.test', email_verified: options.verified !== false }; } }), firestore: () => ({ collection: (name: string) => { assert.equal(name, 'admin'); return { doc: (email: string) => { assert.equal(email, 'admin@example.test'); return { get: async () => ({ exists: options.registered !== false, data: () => ({}) }) }; } }; } }) }) as unknown as app.App;
test('strict auth rejects localhost hints, invalid tokens, unverified email and other-project admin absence', async () => {
  const req = (authorization?: string) => ({ headers: { authorization, host: 'localhost', 'x-admin-email': 'admin@example.test' } }) as NextApiRequest;
  for (const [options, bearer] of [[{}, undefined], [{ invalid: true }, 'Bearer bad'], [{ verified: false }, 'Bearer good'], [{ registered: false }, 'Bearer good']] as const) await assert.rejects(createCurriculumAdminAuthorizer(() => authApp(options))(req(bearer)));
  let selected = false; const identity = await createCurriculumAdminAuthorizer(dev => { selected = dev; return authApp({}); })({ headers: { authorization: 'Bearer good', 'x-pulsecheck-firebase-mode': 'dev' } });
  assert.equal(selected, true); assert.equal(identity.projectId, 'isolated');
});
const setup = () => {
  const store = new Map<string, Record<string, unknown>>(); const writes: string[] = []; let race = false;
  const ref = (path: string): any => ({ path, id: path.split('/').at(-1), collection: (name: string) => ref(`${path}/${name}`), doc: (id: string) => ref(`${path}/${id}`), get: async () => {
    if (path === 'pulsecheck-protocols') return { docs: [{ id: 'protocol-478-breathing', data: () => ({ isActive: true, publishStatus: 'published', label: '4-7-8 Breathing' }) }] };
    if (['sim-modules', 'mental-exercises', 'sim-variants', 'pulsecheck-protocol-variants'].includes(path)) return { docs: [] };
    return { exists: store.has(path), data: () => store.get(path) };
  } });
  const db: any = { collection: ref, runTransaction: async (callback: any) => {
    if (race) { race = false; const key = [...store.keys()].find(path => path.includes('/drafts/'))!; store.set(key, { ...store.get(key), revision: 99 }); }
    return callback({ get: (r: any) => r.get(), set: (r: any, data: any) => { writes.push(r.path); store.set(r.path, data); }, create: (r: any, data: any) => { if (store.has(r.path)) throw Error('immutable version exists'); writes.push(r.path); store.set(r.path, data); } });
  } };
  let ids = 0; const handler = createLinearPublicationHandler({ authorize: async () => ({ uid: 'admin-1', email: 'admin@example.test', projectId: 'mock', db }), writesEnabled: () => true, id: () => `id-${++ids}`, now: () => '2026-09-13T12:00:00Z' });
  const request = async (body: any, target = handler) => { let status = 0; let data: any; const response = { setHeader: () => {}, status: (code: number) => { status = code; return response; }, json: (value: any) => { data = value; } } as unknown as NextApiResponse; await target({ method: 'POST', body, headers: {} } as NextApiRequest, response); return { status, data }; };
  return { store, writes, db, request, race: () => { race = true; } };
};
const draft = { orderedIds: ['protocol-478-breathing'], rationales: {}, audience: { mode: 'explicit_athlete_ids', confirmed: true }, progressionBasis: 'five_days_in_fourteen', protocolDays: [5, 5, 5], simulationDays: null };
test('mock save→review→immutable publish leaves consumer gated and history untouched', async () => {
  const context = setup(); const reviewed = await context.request({ action: 'review', draft }); assert.equal(reviewed.status, 200); assert.equal(context.writes.length, 0);
  const saved = await context.request({ action: 'save_draft', draft, expectedDraftRevision: null, expectedCatalogFingerprint: reviewed.data.catalogFingerprint }); assert.equal(saved.status, 200);
  const reviewedSaved = await context.request({ action: 'review', draftId: saved.data.draft.id });
  const published = await context.request({ action: 'publish', draftId: saved.data.draft.id, expectedDraftRevision: 1, expectedReviewFingerprint: reviewedSaved.data.reviewFingerprint, expectedCatalogFingerprint: reviewedSaved.data.catalogFingerprint }); assert.equal(published.status, 201);
  const version = [...context.store.entries()].find(([key]) => key.includes('/versions/'))![1] as unknown as LinearPublishedVersion;
  const original = JSON.stringify(version); const history: never[] = [];
  const result = previewLinearAssignment({ athleteId: 'a1', version, enrollment: null, asOf: '2026-09-13', completions: history }); assert.equal(result.kind, 'blocked'); assert.deepEqual(history, []); assert.equal(JSON.stringify(version), original);
  assert.equal(context.writes.length, 2); assert.ok(context.writes.every(path => path.startsWith('pulsecheck-linear-curriculum/')));
  context.race(); const conflict = await context.request({ action: 'publish', draftId: saved.data.draft.id, expectedDraftRevision: 1, expectedReviewFingerprint: reviewedSaved.data.reviewFingerprint, expectedCatalogFingerprint: reviewedSaved.data.catalogFingerprint }); assert.equal(conflict.status, 409); assert.equal(context.writes.length, 2); assert.equal(JSON.stringify([...context.store.entries()].find(([key]) => key.includes('/versions/'))![1]), original, 'published snapshot survives a newer draft revision unchanged');
});
test('write gate and unresolved pacing reject publication without writes', async () => {
  const context = setup(); const blocked = createLinearPublicationHandler({ authorize: async () => ({ uid: 'admin-1', email: 'admin@example.test', projectId: 'mock', db: context.db }), writesEnabled: () => false });
  assert.equal((await context.request({ action: 'save_draft', draft }, blocked)).status, 409);
  const review = await context.request({ action: 'review', draft: { ...draft, protocolDays: [4, 5, 5], progressionBasis: null } }); assert.equal(review.data.publishable, false); assert.equal(context.writes.length, 0);
});
