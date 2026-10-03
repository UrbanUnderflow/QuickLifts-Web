import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import { runPipeListSaveWithRetry } from '../../src/utils/pipelistsAutosave';
import { mergePipeListSnapshotsThreeWay, pipeListSnapshotsEqual } from '../../src/utils/pipelistsCollaboration';

const source = fs.readFileSync(new URL('../../src/pages/PipeLists.tsx', import.meta.url), 'utf8');
const start = source.indexOf('    if (isSharedView) return;\n    if (!user || !dataReady || !personalStateReady) return;');
assert.notEqual(start, -1, 'personal autosave effect must exist');
const end = source.indexOf('\n  }, [dataReady, isOwner, isSharedView, lists, personalStateReady', start);
assert.notEqual(end, -1, 'personal autosave effect must have its dependency boundary');
const runEffect = new Function('scope', `with (scope) { return (() => { ${ts.transpile(source.slice(start, end))} })(); }`);
const flush = async () => { for (let index = 0; index < 30; index++) await Promise.resolve(); };
const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
};
const board = (stage: string, notes = '') => [{ id: 'university', items: [{ id: 'morgan', stage, notes }] }];

function harness() {
  const timers = new Map<number, () => unknown>();
  let timerId = 0;
  const state = { remote: board('outreach-queued'), writes: [] as any[], cache: [] as any[], errors: [] as boolean[], messages: [] as any[], pending: 0, transactions: 0, readGate: null as Promise<void> | null, failure: null as Error | null };
  const schedule = (callback: () => unknown) => { const id = ++timerId; timers.set(id, callback); return id; };
  const scope: any = {
    isSharedView: false, user: { uid: 'owner', email: 'owner@example.com' }, dataReady: true, personalStateReady: true,
    lists: board('cold-email-sent'), sharedListIds: new Set(), universityStageMigrationPending: false, isOwner: true,
    personalSnapshotBaselineRef: { current: board('outreach-queued') }, personalListsRef: { current: board('outreach-queued') },
    personalSaveQueueRef: { current: Promise.resolve() }, simpBudgetAuth: { currentUser: { uid: 'owner' } },
    purgeExpiredDeletedItems: (value: any) => value, normalizeList: (value: any) => value,
    pipeListSnapshotsEqual, mergePipeListSnapshotsThreeWay, needsUniversityStageMigration: () => false,
    stripUndefined: (value: any) => value, serverTimestamp: () => 'server-time', doc: (...args: any[]) => args,
    simpBudgetDb: {}, SIMPBUDGET_USERS_COLLECTION: 'users', PIPELISTS_SUBCOLLECTION: 'pipeLists', PIPELISTS_STATE_DOCUMENT_ID: 'state', STORAGE_KEY: 'cache',
    personalSaveFailureRef: { current: null }, saveFailureDetails: (error: any) => ({ message: error.message, code: error.code }),
    setPendingPersonalSaves: (update: any) => { state.pending = typeof update === 'function' ? update(state.pending) : update; },
    setPersonalSaveError: (value: boolean) => state.errors.push(value), setAppMessage: (value: any) => state.messages.push(value),
    readFirestoreError: (error: Error) => error.message, console: { error() {}, warn() {} },
    setTimeout: schedule, clearTimeout: (id: number) => timers.delete(id),
    window: { setTimeout: schedule, clearTimeout: (id: number) => timers.delete(id), localStorage: { setItem: (...args: any[]) => state.cache.push(args) } },
    // Retry policy is tested separately; this harness isolates effect lifecycle and transaction cancellation.
    runPipeListSaveWithRetry: async (save: () => Promise<unknown>) => save(),
    runTransaction: async (_db: unknown, callback: any) => {
      state.transactions++;
      if (state.failure) throw state.failure;
      return callback({
        get: async () => { if (state.readGate) await state.readGate; return { data: () => ({ lists: state.remote }) }; },
        set: (_ref: unknown, value: any) => { state.writes.push(value); state.remote = value.lists; },
      });
    },
  };
  return {
    state, scope, start: () => runEffect(scope) as () => void,
    tick: async () => { const ready = [...timers.values()]; timers.clear(); ready.forEach((callback) => { void callback(); }); await flush(); },
  };
}

test('obsolete queued autosave never writes and newest stage wins', async () => {
  const h = harness();
  const previous = deferred();
  h.scope.personalSaveQueueRef.current = previous.promise;
  const cancel = h.start();
  await h.tick();
  cancel();
  h.scope.lists = board('engaged');
  h.start();
  await h.tick();
  previous.resolve();
  await flush();
  assert.equal(h.state.writes.length, 1);
  assert.equal(h.state.remote[0].items[0].stage, 'engaged');
  assert.equal(h.state.pending, 0);
});

test('canceling during a transaction read prevents its write and cache update', async () => {
  const h = harness();
  const read = deferred();
  h.state.readGate = read.promise;
  const cancel = h.start();
  await h.tick();
  assert.equal(h.state.transactions, 1);
  cancel();
  read.resolve();
  await flush();
  assert.equal(h.state.writes.length, 0);
  assert.equal(h.state.cache.length, 0);
  assert.equal(h.state.pending, 0);
});

test('latest stage merges with independently updated remote notes', async () => {
  const h = harness();
  h.state.remote = board('outreach-queued', 'A collaborator added this');
  h.start();
  await h.tick();
  assert.equal(h.state.writes.length, 1);
  assert.deepEqual(h.state.remote[0].items[0], { id: 'morgan', stage: 'cold-email-sent', notes: 'A collaborator added this' });
});

test('auth change while waiting on the queue prevents writes', async () => {
  const h = harness();
  const previous = deferred();
  h.scope.personalSaveQueueRef.current = previous.promise;
  h.start();
  await h.tick();
  h.scope.simpBudgetAuth.currentUser = { uid: 'another-user' };
  previous.resolve();
  await flush();
  assert.equal(h.state.transactions, 0);
  assert.equal(h.state.writes.length, 0);
  assert.equal(h.state.pending, 0);
});

test('persistent save failure remains visible without reporting saved', async () => {
  const h = harness();
  h.state.failure = new Error('Stored version mismatch');
  h.start();
  await h.tick();
  assert.deepEqual(h.state.errors, [true]);
  assert.equal(h.state.messages.at(-1)?.text, 'Stored version mismatch');
  assert.equal(h.state.cache.length, 0);
  assert.equal(h.state.pending, 0);
});


test('transient save contention retries with bounded backoff and can recover', async () => {
  for (const code of ['aborted', 'firestore/unavailable', 'deadline-exceeded']) {
    let attempts = 0;
    const delays: number[] = [];
    await runPipeListSaveWithRetry(async () => {
      attempts++;
      if (attempts < 3) throw Object.assign(new Error('Transient'), { code });
    }, () => true, async (ms) => { delays.push(ms); });
    assert.equal(attempts, 3);
    assert.deepEqual(delays, [500, 1000]);
  }
});

test('persistent transient failures stop after three attempts and propagate', async () => {
  let attempts = 0;
  const error = Object.assign(new Error('Stored version mismatch'), { code: 'aborted' });
  await assert.rejects(runPipeListSaveWithRetry(async () => { attempts++; throw error; }, () => true, async () => {}), (caught) => caught === error);
  assert.equal(attempts, 3);
});

test('permission failures are not retried', async () => {
  let attempts = 0;
  const error = Object.assign(new Error('Permission denied'), { code: 'permission-denied' });
  await assert.rejects(runPipeListSaveWithRetry(async () => { attempts++; throw error; }, () => true, async () => { assert.fail('must not wait'); }), (caught) => caught === error);
  assert.equal(attempts, 1);
});

test('a save superseded during backoff does not retry', async () => {
  let current = true;
  let attempts = 0;
  await runPipeListSaveWithRetry(async () => { attempts++; throw Object.assign(new Error('Transient'), { code: 'aborted' }); }, () => current, async () => { current = false; });
  assert.equal(attempts, 1);
});

test('debounced changes remain unsaved until canceled and never start a transaction', async () => {
  const h = harness();
  const cancel = h.start();
  assert.equal(h.state.pending, 1);
  cancel();
  await h.tick();
  assert.equal(h.state.transactions, 0);
  assert.equal(h.state.pending, 0);
});

test('a superseded transaction failure does not surface an obsolete error', async () => {
  const h = harness();
  const read = deferred();
  h.scope.runTransaction = async () => { await read.promise; throw new Error('Obsolete failure'); };
  const cancel = h.start();
  await h.tick();
  cancel();
  read.resolve();
  await flush();
  assert.deepEqual(h.state.errors, []);
  assert.deepEqual(h.state.messages, []);
  assert.equal(h.state.pending, 0);
});

test('observed stored-version failed-precondition is retryable but other preconditions are not', async () => {
  let attempts = 0;
  await runPipeListSaveWithRetry(async () => {
    attempts++;
    if (attempts === 1) throw Object.assign(new Error('Stored version (42) does not match the required base version (41)'), { code: 'failed-precondition' });
  }, () => true, async () => {});
  assert.equal(attempts, 2);
  attempts = 0;
  const error = Object.assign(new Error('Missing required index'), { code: 'failed-precondition' });
  await assert.rejects(runPipeListSaveWithRetry(async () => { attempts++; throw error; }, () => true, async () => { assert.fail('must not wait'); }), (caught) => caught === error);
  assert.equal(attempts, 1);
});
