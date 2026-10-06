import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseEvidence, saveEvidence } from '../../src/lib/evidence-journal';
import { createEvidenceJournalHandler } from '../../src/pages/api/evidence-journal';
import { createEvidenceEventHandler } from '../../src/pages/api/evidence-journal/event';
const id = 'ef1be120-cc70-4abc-8ccc-e8b64dace850';
const secondId = 'ef1be120-cc70-4abc-8ccc-e8b64dace851';
function database() {
  const records = new Map<string, any>();
  const paths: string[] = [];
  const ref = (path: string): any => ({ path, collection: (s: string) => ref(`${path}/${s}`), doc: (s: string) => ref(`${path}/${s}`) });
  const db: any = { collection: (s: string) => ref(s), runTransaction: async (fn: any) => fn({ get: async (r: any) => { paths.push(r.path); return { exists: records.has(r.path), data: () => records.get(r.path) }; }, create: (r: any, v: any) => records.set(r.path, v), set: (r: any, v: any) => records.set(r.path, v), update: (r: any, v: any) => records.set(r.path, { ...records.get(r.path), ...v }) }) };
  return { db, records, paths };
}
function response() { return { code: 0, body: null as any, setHeader() {}, status(n: number) { this.code = n; return this; }, json(v: any) { this.body = v; return this; } }; }
test('validates source and preserves reflection text; ignores supplied ownership', () => {
  assert.throws(() => parseEvidence({ entryId: '../victim', moment: 'a' }));
  assert.throws(() => parseEvidence({ entryId: id, moment: '  ' }));
  assert.throws(() => parseEvidence({ entryId: id, moment: 'a'.repeat(4001) }));
  assert.throws(() => parseEvidence({ entryId: id, moment: 'a', sourceAssignmentId: '../victim' }));
  const result = parseEvidence({ entryId: id, moment: 'a'.repeat(4000), athleteId: 'victim' });
  assert.equal(result.moment.length, 4000); assert.ok(!('athleteId' in result));
});
test('both endpoints reject unauthenticated reads/writes before database access', async () => {
  for (const create of [createEvidenceJournalHandler, createEvidenceEventHandler]) {
    const res = response(); await create({ authorize: async () => { throw Error('unauthorized'); } })({ method: 'POST', body: {} } as any, res as any); assert.equal(res.code, 401);
  }
});
test('retries are idempotent and conflicting IDs cannot overwrite an entry', async () => {
  const { db, records, paths } = database(); const input = parseEvidence({ entryId: id, moment: 'Tried again' });
  assert.equal((await saveEvidence(db, 'owner', input, 100)).created, true);
  assert.equal((await saveEvidence(db, 'owner', input, 200)).created, false);
  assert.equal(records.size, 1); assert.ok(paths.every(p => p.includes('/owner/')));
  await assert.rejects(saveEvidence(db, 'owner', { ...input, moment: 'changed' }, 300), /already belongs/);
});
test('saving the same assignment from another device returns original entry', async () => {
  const { db, records } = database(); const input = parseEvidence({ entryId: id, moment: 'Kept going', sourceAssignmentId: 'assignment-1' });
  await saveEvidence(db, 'owner', input, 100);
  const retry = await saveEvidence(db, 'owner', { ...input, id: secondId }, 200);
  assert.equal(retry.created, false); assert.equal(retry.entry.id, id); assert.equal(records.size, 2);
});
test('events are owner scoped, deduplicated and exclude reflection text', async () => {
  const { db, records } = database(); await saveEvidence(db, 'owner', parseEvidence({ entryId: id, moment: 'Private text' }), 100);
  const handler = createEvidenceEventHandler({ authorize: async () => ({ uid: 'owner', db }), now: () => 200 });
  for (let i = 0; i < 2; i++) { const res = response(); await handler({ method: 'POST', body: { entryId: id, eventId: secondId, event: 'used', moment: 'Private text' } } as any, res as any); assert.equal(res.code, 200); }
  const base = `pulsecheck-evidence-journals/owner/entries/${id}`;
  assert.equal(records.get(base).useCount, 1); assert.deepEqual(records.get(`${base}/events/${secondId}`), { event: 'used', createdAt: 200 });
  const res = response(); await createEvidenceEventHandler({ authorize: async () => ({ uid: 'other', db }) })({ method: 'POST', body: { entryId: id, eventId: secondId, event: 'used' } } as any, res as any); assert.equal(res.code, 404);
});
test('rules exclude evidence from permissive compatibility fallback', () => {
  const rules = readFileSync('firestore.rules', 'utf8');
  assert.match(rules.slice(rules.indexOf('function isExplicitlyRuledCollection'), rules.indexOf('function isExplicitlyRuledCollection') + 3500), /'pulsecheck-evidence-journals'/);
  assert.match(rules, /match \/pulsecheck-evidence-journals\/\{document=\*\*\} \{\s*allow read, write: if false;/);
});
test('listing pages only within owner and deleting cannot select another account', async () => {
  const paths: string[] = []; const calls: any[] = [];
  const docs = [{ id, data: () => ({ id, moment: 'Mine' }) }, { id: secondId, data: () => ({ id: secondId }) }];
  const ref = (path: string): any => ({ path, collection: (s: string) => ref(`${path}/${s}`), doc: (s: string) => ref(`${path}/${s}`), orderBy: (...args: any[]) => { calls.push(args); return ref(path); }, limit: (n: number) => { calls.push(n); return ref(path); }, get: async () => { paths.push(path); return { docs }; } });
  const db: any = { collection: (s: string) => ref(s), recursiveDelete: async (r: any) => paths.push(r.path) };
  const handler = createEvidenceJournalHandler({ authorize: async () => ({ uid: 'owner', db }) });
  const res = response(); await handler({ method: 'GET', query: { limit: '1', uid: 'victim' } } as any, res as any);
  assert.equal(res.code, 200); assert.equal(res.body.entries.length, 1); assert.equal(res.body.nextCursor, id); assert.ok(calls.includes(2));
  const deleted = response(); await handler({ method: 'DELETE', query: { entryId: id, uid: 'victim' } } as any, deleted as any);
  assert.equal(deleted.code, 200); assert.ok(paths.every(p => p.startsWith('pulsecheck-evidence-journals/owner/entries')));
  const invalid = response(); await handler({ method: 'GET', query: { limit: '99999' } } as any, invalid as any); assert.equal(invalid.code, 400);
});


test('journal types validate per type and default to evidence', () => {
  assert.equal(parseEvidence({ entryId: id, moment: 'a' }).type, 'evidence');
  assert.equal(parseEvidence({ entryId: id, moment: 'a', type: 'gratitude', action: 'It mattered' }).type, 'gratitude');
  assert.throws(() => parseEvidence({ entryId: id, moment: 'a', type: 'diary' }), /valid journal type/);
  assert.equal(parseEvidence({ entryId: id, moment: 'a'.repeat(8000), type: 'freewrite' }).moment.length, 8000);
  assert.throws(() => parseEvidence({ entryId: id, moment: 'a'.repeat(4001), type: 'gratitude' }));
  assert.throws(() => parseEvidence({ entryId: id, moment: 'a', type: 'freewrite', action: 'second field' }), /one field/);
  assert.throws(() => parseEvidence({ entryId: id, moment: 'a', type: 'gratitude', sourceAssignmentId: 'assignment-1' }), /evidence/);
});
test('entries saved before types existed read as evidence and retry cleanly', async () => {
  const { db, records } = database(); const input = parseEvidence({ entryId: id, moment: 'Old entry' });
  const { type, ...legacy } = input; records.set(`pulsecheck-evidence-journals/owner/entries/${id}`, { ...legacy, createdAt: 1, revisitCount: 0, useCount: 0 });
  const retry = await saveEvidence(db, 'owner', input, 200);
  assert.equal(retry.created, false); assert.equal(retry.entry.type, 'evidence');
});
test('type filter scans newest first, includes legacy evidence and pages with a cursor', async () => {
  const stored = [
    { id: 'a', type: 'gratitude' }, { id: 'b' }, { id: 'c', type: 'freewrite' }, { id: 'd', type: 'evidence' }, { id: 'e', type: 'gratitude' },
  ].map((data, i) => ({ id: `ef1be120-cc70-4abc-8ccc-e8b64dace86${i}`, data: () => ({ ...data, id: `ef1be120-cc70-4abc-8ccc-e8b64dace86${i}` }) }));
  const query = (after: number, size: number): any => ({
    orderBy: () => query(after, size), limit: (n: number) => query(after, n),
    startAfter: (doc: any) => query(stored.findIndex(s => s.id === doc.id) + 1, size),
    get: async () => ({ docs: stored.slice(after, after + size) }),
  });
  const entries: any = { ...query(0, 50), doc: (docId: string) => ({ get: async () => ({ exists: stored.some(s => s.id === docId), id: docId }) }) };
  const db: any = { collection: () => ({ doc: () => ({ collection: () => entries }) }) };
  const handler = createEvidenceJournalHandler({ authorize: async () => ({ uid: 'owner', db }) });
  const first = response(); await handler({ method: 'GET', query: { type: 'evidence', limit: '1' } } as any, first as any);
  assert.equal(first.code, 200); assert.deepEqual(first.body.entries.map((e: any) => e.type), ['evidence']);
  assert.equal(first.body.entries[0].id, stored[1].id); assert.equal(first.body.nextCursor, stored[1].id);
  const second = response(); await handler({ method: 'GET', query: { type: 'evidence', limit: '1', cursor: first.body.nextCursor } } as any, second as any);
  assert.equal(second.body.entries[0].id, stored[3].id); assert.equal(second.body.nextCursor, null);
  const all = response(); await handler({ method: 'GET', query: {} } as any, all as any);
  assert.equal(all.body.entries[1].type, 'evidence');
  const invalid = response(); await handler({ method: 'GET', query: { type: 'diary' } } as any, invalid as any); assert.equal(invalid.code, 400);
});

test('workout entries take an optional whole-number effort and food entries can be just a photo', () => {
  const workout = parseEvidence({ entryId: id, type: 'workout', moment: 'Legs for 45 minutes', effortRating: 7 });
  assert.equal((workout as any).effortRating, 7);
  assert.throws(() => parseEvidence({ entryId: id, type: 'workout', moment: 'Legs', effortRating: 11 }), /1 to 10/);
  assert.throws(() => parseEvidence({ entryId: id, type: 'gratitude', moment: 'x', effortRating: 5 }), /workout/);
  const photoOnly = parseEvidence({ entryId: id, type: 'food', moment: '', photoStoragePath: 'pulsecheck-journal-photos/owner/meal.jpg' });
  assert.equal((photoOnly as any).photoStoragePath, 'pulsecheck-journal-photos/owner/meal.jpg');
  assert.throws(() => parseEvidence({ entryId: id, type: 'food', moment: '' }));
  assert.throws(() => parseEvidence({ entryId: id, type: 'evidence', moment: 'x', photoStoragePath: 'pulsecheck-journal-photos/owner/a.jpg' }), /food/);
  assert.throws(() => parseEvidence({ entryId: id, type: 'food', moment: 'x', photoStoragePath: '../other/a.jpg' }), /food/);
});

test('injury entries preserve recovery reflections through save and retry', async () => {
  const { db, records } = database();
  const input = parseEvidence({ entryId: id, type: 'injury', moment: 'Frustrated today.', action: 'Rested and followed my rehab plan.' });
  const saved = await saveEvidence(db, 'owner', input, 100);
  assert.equal(saved.entry.type, 'injury');
  assert.equal(saved.entry.action, input.action);
  assert.equal((await saveEvidence(db, 'owner', input, 200)).created, false);
  assert.equal(records.size, 1);
  assert.equal(parseEvidence({ entryId: secondId, type: 'injury', moment: 'Hopeful.' }).action, null);
  assert.throws(() => parseEvidence({ entryId: id, type: 'injury', moment: ' ' }));
  assert.throws(() => parseEvidence({ entryId: id, type: 'injury', moment: 'a'.repeat(4001) }));
});
