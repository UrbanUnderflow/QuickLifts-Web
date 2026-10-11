const test = require('node:test');
const assert = require('node:assert/strict');
const { runScheduledSnapshotBatch } = require('../../../netlify/functions/lib/athleticmind-snapshot-schedule');
test('scheduler is inert by default, without opening Firebase', async () => {
  assert.deepEqual(await runScheduledSnapshotBatch({ env: {}, getDb: () => { throw new Error('unexpected DB'); } }), { status: 'disabled', attempted: 0 });
});
test('scheduler resumes bounded member pages after a failed delivery without dropping later athletes', async () => {
  const records = new Map([
    ['pulsecheck-teams/team-am', { snapshotDelivery: { enabled: true } }],
    ['pulsecheck-team-memberships/team-am_athlete-a', { teamId: 'team-am', role: 'athlete', userId: 'athlete-a' }],
    ['pulsecheck-team-memberships/team-am_athlete-b', { teamId: 'team-am', role: 'athlete', userId: 'athlete-b' }],
  ]);
  const snap = (path, data) => ({ id: path.split('/').at(-1), exists: data !== undefined, data: () => data });
  const db = { collection: name => {
    const query = { filters: [], cursor: '', size: 1,
      doc: id => ({ path: `${name}/${id}`, get: async () => snap(`${name}/${id}`, records.get(`${name}/${id}`)) }),
      where(field, _op, value) { this.filters.push([field, value]); return this; }, orderBy() { return this; }, limit(size) { this.size = size; return this; }, startAfter(id) { this.cursor = id; return this; },
      async get() { return { docs: [...records].filter(([path, data]) => path.startsWith(`${name}/`) && path.split('/').at(-1) > this.cursor && this.filters.every(([field, value]) => field.split('.').reduce((d, key) => d?.[key], data) === value)).sort().slice(0, this.size).map(([path, data]) => snap(path, data)) }; },
    }; return query;
  }, runTransaction: fn => fn({ get: ref => ref.get(), set: (ref, value, options) => records.set(ref.path, options?.merge ? { ...records.get(ref.path), ...value } : value) }) };
  const attempted = [];
  const options = { env: { ATHLETICMIND_SNAPSHOT_PUSH_ENABLED: 'true' }, getDb: () => db, clock: () => 1000, maxAttempts: 1, deliver: async (_db, input) => { attempted.push(input.athleteId); return { status: input.athleteId === 'athlete-a' ? 'failed' : 'delivered' }; } };
  await runScheduledSnapshotBatch(options);
  await runScheduledSnapshotBatch(options);
  assert.deepEqual(attempted, ['athlete-a', 'athlete-b']);
  assert.equal(records.get('athleticmind-snapshot-scheduler/daily').leaseUntil, 0);
});
