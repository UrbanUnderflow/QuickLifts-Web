import test from 'node:test';
import assert from 'node:assert/strict';
import { parseMeal, parseWorkout, saveRecord } from '../../src/lib/activity-records';
import { createActivityRecordsHandler } from '../../src/pages/api/activity-records';

const recordId = 'ef1be120-cc70-4abc-8ccc-e8b64dace850';
const entryId = 'ef1be120-cc70-4abc-8ccc-e8b64dace851';
const now = 1_790_000_000_000;

test('workouts keep empty fields empty and only compute load from two athlete numbers', () => {
  const words = parseWorkout({ recordId, source: 'journal', entryId, activity: 'legs', startedAt: now, effortWords: 'pretty tough' }, 'owner');
  assert.equal(words.effortRating, null);
  assert.equal(words.durationMinutes, null);
  assert.equal(words.sessionLoad, null);
  const rated = parseWorkout({ recordId, source: 'quick', activity: 'Lift', startedAt: now, durationMinutes: 45, effortRating: 7 }, 'owner');
  assert.equal(rated.sessionLoad, 315);
  assert.throws(() => parseWorkout({ recordId, source: 'quick', activity: 'Lift', startedAt: now, effortRating: 7.5 }, 'owner'), /whole number/);
  assert.throws(() => parseWorkout({ recordId, source: 'quick', activity: '  ', startedAt: now }, 'owner'), /what you did/);
});

test('meals need words or a photo, reject another account\'s photo, and hold nutrition only in detail', () => {
  const casual = parseMeal({ recordId, source: 'journal', description: 'eggs and toast', eatenAt: now, timing: 'before_training', context: ['rushed', 'rushed'] }, 'owner');
  assert.equal(casual.detail, null);
  assert.deepEqual(casual.context, ['rushed']);
  assert.ok(parseMeal({ recordId, source: 'journal', photoStoragePath: 'pulsecheck-journal-photos/owner/a.jpg', eatenAt: now }, 'owner'));
  assert.throws(() => parseMeal({ recordId, source: 'journal', eatenAt: now }, 'owner'), /photo/);
  assert.throws(() => parseMeal({ recordId, source: 'journal', photoStoragePath: 'pulsecheck-journal-photos/victim/a.jpg', eatenAt: now }, 'owner'), /another account/);
  assert.throws(() => parseMeal({ recordId, source: 'journal', description: 'x', eatenAt: now, context: ['skipped'] }, 'owner'), /context/);
});

test('saving keeps the first createdAt and the API stays owner scoped', async () => {
  const docs = new Map<string, any>();
  const ref = (path: string): any => ({
    path,
    collection: (name: string) => ref(`${path}/${name}`),
    doc: (name: string) => ref(`${path}/${name}`),
    async get() { return { exists: docs.has(path), data: () => docs.get(path) }; },
  });
  const db: any = { collection: (name: string) => ref(name), runTransaction: async (fn: any) => fn({ get: (r: any) => r.get(), set: (r: any, v: any) => docs.set(r.path, v) }) };
  const first = await saveRecord(db, 'owner', parseWorkout({ recordId, source: 'quick', activity: 'Run', startedAt: now }, 'owner'), 100);
  const second = await saveRecord(db, 'owner', parseWorkout({ recordId, source: 'quick', activity: 'Run', startedAt: now, durationMinutes: 30 }, 'owner'), 200);
  assert.equal(first.created, true);
  assert.equal(second.created, false);
  assert.equal(second.record.createdAt, 100);
  assert.ok([...docs.keys()].every((key) => key.startsWith('pulsecheck-activity-records/owner/')));

  const response = () => ({ code: 0, body: null as any, setHeader() {}, status(n: number) { this.code = n; return this; }, json(v: any) { this.body = v; return this; } });
  const denied = response();
  await createActivityRecordsHandler({ authorize: async () => { throw Error('no'); } })({ method: 'GET', query: {} } as any, denied as any);
  assert.equal(denied.code, 401);
  const badRange = response();
  await createActivityRecordsHandler({ authorize: async () => ({ uid: 'owner', db }) as any })({ method: 'GET', query: { from: '0', to: String(40 * 86_400_000) } } as any, badRange as any);
  assert.equal(badRange.code, 400);
});

import { coachSummary, connectedSessions, isCoachOfAthlete } from '../../src/lib/activity-records';
import { createCoachSummaryHandler } from '../../src/pages/api/activity-records/coach-summary';

function memoryDb(seed: Record<string, any>) {
  const docs = new Map(Object.entries(seed));
  const docRef = (path: string): any => ({
    path, id: path.split('/').pop(),
    async get() { return { exists: docs.has(path), data: () => docs.get(path), id: path.split('/').pop() }; },
    collection: (name: string) => colRef(`${path}/${name}`),
  });
  const colRef = (path: string): any => {
    const filters: Array<[string, string, any]> = [];
    const query: any = {
      doc: (id: string) => docRef(`${path}/${id}`),
      where(field: string, op: string, value: any) { filters.push([field, op, value]); return query; },
      orderBy() { return query; },
      limit() { return query; },
      async get() {
        const rows = [...docs.entries()].filter(([key]) => key.startsWith(`${path}/`) && key.split('/').length === path.split('/').length + 1)
          .filter(([, data]) => filters.every(([f, op, v]) => op === '==' ? data[f] === v : op === '>=' ? data[f] >= v : data[f] <= v))
          .map(([key, data]) => ({ id: key.split('/').pop(), data: () => data, ref: docRef(key) }));
        return { docs: rows, empty: rows.length === 0 };
      },
    };
    return query;
  };
  return { collection: (name: string) => colRef(name), getAll: async (...refs: any[]) => Promise.all(refs.map((r) => r.get())) } as any;
}

test('connected sessions come from the athlete\'s own WHOOP day records, inside the range only', async () => {
  const day = new Date(now).toISOString().slice(0, 10);
  const db = memoryDb({
    [`health-context-source-records/owner_whoop_training_${day}`]: {
      athleteUserId: 'owner', status: 'active',
      payload: { workouts: [{ id: 'w1', sportName: 'Weightlifting', startAt: now / 1000, durationMinutes: 52 }, { id: 'w2', startAt: (now - 10 * 86_400_000) / 1000 }] },
    },
  });
  const sessions = await connectedSessions(db, 'owner', now - 86_400_000, now + 1000);
  assert.deepEqual(sessions.map((s) => s.id), ['whoop:w1']);
  assert.equal(sessions[0].durationMinutes, 52);
});

test('coach summary counts a linked device session once and never includes effort words or details', () => {
  const summary = coachSummary(
    [{ startedAt: now, activity: 'Legs', durationMinutes: 45, effortRating: 7, sessionLoad: 315, effortWords: 'pretty tough', details: [{ exercise: 'Squat' }], connectedSessionId: 'whoop:w1' }],
    [{ id: 'whoop:w1', sourceLane: 'whoop', sport: 'Weightlifting', startedAt: now, durationMinutes: 52 }, { id: 'whoop:w2', sourceLane: 'whoop', sport: 'Running', startedAt: now - 1000, durationMinutes: 30 }],
  );
  assert.equal(summary.totals.workoutCount, 2);
  assert.equal(summary.totals.load, 315);
  assert.equal(summary.totals.unratedWorkouts, 1);
  assert.equal(JSON.stringify(summary).includes('pretty tough'), false);
  assert.equal(JSON.stringify(summary).includes('Squat'), false);
});

test('only staff on the athlete\'s team see a summary, and only when the athlete shared it', async () => {
  const db = memoryDb({
    'pulsecheck-team-memberships/team1_athlete': { userId: 'athlete', teamId: 'team1', role: 'athlete' },
    'pulsecheck-team-memberships/team1_coach': { userId: 'coach', teamId: 'team1', role: 'coach' },
    'pulsecheck-team-memberships/team2_other': { userId: 'other', teamId: 'team2', role: 'coach' },
  });
  assert.equal(await isCoachOfAthlete(db, 'coach', 'athlete'), true);
  assert.equal(await isCoachOfAthlete(db, 'other', 'athlete'), false);
  const response = () => ({ code: 0, body: null as any, setHeader() {}, status(n: number) { this.code = n; return this; }, json(v: any) { this.body = v; return this; } });
  const query = { athleteId: 'athlete', from: String(now - 86_400_000), to: String(now) };
  const stranger = response();
  await createCoachSummaryHandler({ authorize: async () => ({ uid: 'other', db }) })({ method: 'GET', query } as any, stranger as any);
  assert.equal(stranger.code, 403);
  const notShared = response();
  await createCoachSummaryHandler({ authorize: async () => ({ uid: 'coach', db }) })({ method: 'GET', query } as any, notShared as any);
  assert.deepEqual(notShared.body, { shared: false });
});
