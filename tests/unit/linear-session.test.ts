import test from 'node:test';
import assert from 'node:assert/strict';
import { createLinearSessionHandler } from '../../src/pages/api/curriculum/session';
import { createLinearJournalHandler } from '../../src/pages/api/curriculum/journal';

const root = 'pulsecheck-linear-curriculum/states/items/athlete';
function fixture() {
  const data = new Map<string, any>();
  let queue = Promise.resolve();
  let fail = false;
  class Ref {
    constructor(public path: string) {}
    doc(id: string) { return new Ref(`${this.path}/${id}`); }
    collection(id: string) { return new Ref(`${this.path}/${id}`); }
  }
  const clone = (value: any) => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  const db: any = {
    collection: (id: string) => new Ref(id),
    runTransaction: (fn: any) => {
      const next = queue.then(async () => {
        const writes: (() => void)[] = [];
        const result = await fn({
          get: async (ref: Ref) => {
            assert.equal(writes.length, 0, 'transaction reads precede writes');
            return { exists: data.has(ref.path), data: () => clone(data.get(ref.path)) };
          },
          create: (ref: Ref, value: any) => writes.push(() => { assert(!data.has(ref.path)); data.set(ref.path, clone(value)); }),
          set: (ref: Ref, value: any) => writes.push(() => data.set(ref.path, clone(value))),
        });
        if (fail) throw new Error('commit failed');
        writes.forEach(write => write());
        return result;
      });
      queue = next.catch(() => {});
      return next;
    },
  };
  data.set(root, { athleteId: 'athlete', optedIn: true });
  for (const id of ['day1', 'day2']) data.set(`${root}/assignments/${id}`, {
    athleteId: 'athlete', versionId: 'pinned-v1', skillId: 'brake-point', phase: 'use_it', windowStart: '2026-09-01',
  });
  const handler = createLinearSessionHandler({ enabled: () => true, authorize: async () => ({ uid: 'athlete', db }), now: () => 1234 });
  async function request(method: string, body: any = {}, query: any = {}) {
    const response: any = { code: 0, body: null, setHeader() {}, status(code: number) { this.code = code; return this; }, json(value: any) { this.body = value; return this; } };
    await handler({ method, body, query } as any, response);
    return response;
  }
  return { data, db, request, fail: () => { fail = true; } };
}
const draft = (extra = {}) => ({ assignmentId: 'day1', expectedRevision: 0, plan: 'Before my next serve', returned: false, observation: '', ...extra });

test('phase plan loads empty and survives next-day assignments and pinned curriculum reorder', async () => {
  const f = fixture();
  const initial = await f.request('GET', {}, { assignmentId: 'day1' });
  assert.equal(initial.body.session.revision, 0);
  assert.equal((await f.request('POST', draft())).body.session.revision, 1);
  f.data.set(root, { athleteId: 'athlete', optedIn: true, currentSkill: { versionId: 'new-order', skillId: 'different' } });
  const reopened = await f.request('GET', {}, { assignmentId: 'day2' });
  assert.equal(reopened.body.session.plan, 'Before my next serve');
  assert.equal(reopened.body.session.revision, 1);
  assert.equal([...f.data.keys()].some(key => key.includes('/completions/') || key.includes('/journals/')), false);
});

test('same retry is idempotent; stale concurrent writing cannot overwrite saved writing', async () => {
  const f = fixture();
  const results = await Promise.all([f.request('POST', draft()), f.request('POST', draft())]);
  assert.deepEqual(results.map(result => result.body.session.revision), [1, 1]);
  const conflict = await f.request('POST', draft({ plan: 'A stale other plan' }));
  assert.equal(conflict.code, 409);
  assert.equal(conflict.body.session.plan, 'Before my next serve');
  const saved = await f.request('POST', draft({ expectedRevision: 1, returned: true, observation: 'I paused before serving.' }));
  assert.equal(saved.body.session.revision, 2);
  assert.equal(saved.body.session.returned, true);
  assert.equal([...f.data.keys()].filter(key => key.includes('/revisions/')).length, 2);
});

test('new windows isolate plans while old plans remain available', async () => {
  const f = fixture(); await f.request('POST', draft());
  f.data.set(`${root}/assignments/restart`, { ...f.data.get(`${root}/assignments/day1`), windowStart: '2026-09-15' });
  assert.equal((await f.request('GET', {}, { assignmentId: 'restart' })).body.session.plan, '');
  assert.equal((await f.request('GET', {}, { assignmentId: 'day1' })).body.session.plan, 'Before my next serve');
});

test('assignment ownership, enrollment, phase, limits and returned-plan validation fail closed', async () => {
  const f = fixture();
  for (const body of [draft({ plan: 'x'.repeat(2001) }), draft({ observation: 'x'.repeat(4001) }), draft({ plan: '', returned: true }), draft({ expectedRevision: -1 })]) {
    assert.equal((await f.request('POST', body)).code, 400);
  }
  f.data.set(`${root}/assignments/other`, { ...f.data.get(`${root}/assignments/day1`), athleteId: 'other' });
  f.data.set(`${root}/assignments/learn`, { ...f.data.get(`${root}/assignments/day1`), phase: 'learn' });
  for (const id of ['missing', 'other', 'learn']) assert.equal((await f.request('GET', {}, { assignmentId: id })).code, 404);
  f.data.set(root, { athleteId: 'athlete', optedIn: false });
  assert.equal((await f.request('POST', draft())).code, 404);
});

test('failed durable save returns retryable error without any partial writing', async () => {
  const f = fixture(); const before = JSON.stringify([...f.data]); f.fail();
  assert.equal((await f.request('POST', draft())).code, 503);
  assert.equal(JSON.stringify([...f.data]), before);
});

test('disabled session endpoint performs no authorization or data access', async () => {
  let authorized = false;
  const handler = createLinearSessionHandler({ enabled: () => false, authorize: async () => { authorized = true; throw new Error(); } });
  const response: any = { setHeader() {}, status(code: number) { this.code = code; return this; }, json(body: any) { this.body = body; return this; } };
  await handler({ method: 'GET', query: { assignmentId: 'day1' } } as any, response);
  assert.equal(response.code, 409); assert.equal(authorized, false);
});

test('native journal revision protects edits from stale overwrite and keeps retry idempotent', async () => {
  const f = fixture();
  const handler = createLinearJournalHandler({ enabled: () => true, authorize: async () => ({ uid: 'athlete', db: f.db }), now: () => 1234 });
  const save = async (text: string, expectedRevision: number) => {
    const response: any = { setHeader() {}, status(code: number) { this.code = code; return this; }, json(body: any) { this.body = body; return this; } };
    await handler({ method: 'POST', body: { assignmentId: 'day1', text, expectedRevision } } as any, response);
    return response;
  };
  assert.equal((await save('My private note', 0)).body.revision, 1);
  assert.equal((await save('My private note', 0)).body.revision, 1);
  const conflict = await save('Stale replacement', 0);
  assert.equal(conflict.code, 409);
  assert.equal(conflict.body.text, 'My private note');
  assert.equal((await save('Reviewed edit', 1)).body.revision, 2);
  assert.equal(f.data.get(`${root}/journals/day1`).text, 'Reviewed edit');
});
