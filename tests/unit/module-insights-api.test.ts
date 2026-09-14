import test from 'node:test';
import assert from 'node:assert/strict';
import { collectModuleInsights, parseInsightWindow } from '../../src/pages/api/admin/curriculum/insights';
function fakeDB(records: Record<string, any[]>, cap = false, missingIndex = false) {
  const masks: string[][] = [];
  const makeDoc = (row: any) => ({ id: row.id, exists: true, ref: { path: row.path || `pulsecheck-daily-assignments/${row.id}` }, data: () => row.data });
  function query(name: string) {
    let filter = ''; let fields: string[] = [];
    const q: any = {
      where(field: string) { filter = field; return q; },
      select(...selection: string[]) { fields = selection; masks.push(fields); return q; },
      limit() { return q; },
      async get() { if (missingIndex && name === 'completions' && filter) { filter = ''; throw Object.assign(new Error('Query requires index'), { code: 9 }); } const rows = records[`${name}:${filter}`] || []; return { size: cap ? 5001 : rows.length, docs: rows.map(makeDoc) }; },
      doc(id: string) { return { id }; },
    }; return q;
  }
  return { masks, db: { collection: query, collectionGroup: query, async getAll(...args: any[]) {
    masks.push(args.pop().fieldMask);
    return args.map(({ id }: any) => {
      const found = records.linked?.find(row => row.id === id);
      return found ? makeDoc(found) : { id, exists: false };
    });
  } } as any };
}
test('window accepts half-open UTC interval and rejects broad, reversed and repeated params', () => {
  assert.deepEqual(parseInsightWindow('2026-09-01', '2026-09-02'), { start: Date.parse('2026-09-01'), end: Date.parse('2026-09-02') });
  for (const [start, end] of [['2026-01-01', '2026-09-01'], ['bad', '2026-09-01'], ['2026-09-02', '2026-09-01'], [[], '2026-09-01']]) assert.throws(() => parseInsightWindow(start, end));
});
test('collector projects safe fields, resolves overdue linked assignments and filters other completion roots', async () => {
  const { db, masks } = fakeDB({
    'pulsecheck-assignment-events:eventAt': [{ id: 'event', data: { assignmentId: 'a', athleteId: 'u', eventType: 'completed', eventAt: 150 } }],
    linked: [{ id: 'a', data: { athleteId: 'u', protocolId: 'protocol-box-breathing', startedAt: 110 } }],
    'completions:completedAt': [
      { id: 'c', path: 'sim-completions/u/completions/c', data: { userId: 'u', exerciseId: 'breathing-box', dailyAssignmentId: 'a', completedAt: 151, helpfulnessRating: 5 } },
      { id: 'secret', path: 'other/u/completions/secret', data: { userId: 'u', exerciseId: 'other', completedAt: 155 } },
    ],
  });
  const result = await collectModuleInsights(db, { start: 100, end: 200 });
  assert.equal(result.status, 'complete'); assert.equal(result.coverage.completions, 1);
  assert.equal(result.modules.length, 1); assert.equal(result.modules[0].completedSessions, 1);
  assert.equal(result.modules[0].completionOfStarters.rate, 1);
  assert.ok(masks.length >= 5);
  assert.equal(masks.flat().some(field => /notes|journal|rationale|summary/i.test(field)), false);
  assert.equal(JSON.stringify(result).includes('athleteId'), false);
});
test('caps suppress every aggregate rather than displaying truncated counts', async () => {
  const { db } = fakeDB({}, true);
  const result = await collectModuleInsights(db, { start: 100, end: 200 });
  assert.equal(result.status, 'partial'); assert.deepEqual(result.modules, []);
});
test('missing linked assignment is reported and excluded', async () => {
  const { db } = fakeDB({ 'pulsecheck-assignment-events:eventAt': [{ id: 'e', data: { assignmentId: 'missing', athleteId: 'u', eventType: 'started', eventAt: 110 } }] });
  const result = await collectModuleInsights(db, { start: 100, end: 200 });
  assert.equal(result.coverage.unresolvedLinks, 1); assert.deepEqual(result.modules, []);
});

test('missing index falls back to complete projected history then filters dates', async () => {
  const row = (id: string, completedAt: number) => ({ id, path: `sim-completions/u/completions/${id}`, data: { userId: 'u', exerciseId: 'reset', completedAt } });
  const { db } = fakeDB({ 'completions:': [row('old', 50), row('current', 150), row('future', 250)] }, false, true);
  const result = await collectModuleInsights(db, { start: 100, end: 200 });
  assert.equal(result.status, 'complete'); assert.equal(result.coverage.completions, 1);
  assert.ok(result.warnings.some(warning => warning.includes('complete-history')));
});
test('fallback history cap withholds aggregates even when few rows are in window', async () => {
  const rows = Array.from({ length: 5001 }, (_, i) => ({ id: String(i), data: { completedAt: 50 } }));
  const { db } = fakeDB({ 'completions:': rows }, false, true);
  const result = await collectModuleInsights(db, { start: 100, end: 200 });
  assert.equal(result.status, 'partial'); assert.deepEqual(result.modules, []);
});

test('protected linear assignments count once and exclude other roots or mismatched owners', async () => {
  const good = { id: 'daily', path: 'pulsecheck-linear-curriculum/states/items/u/assignments/daily', data: { athleteId: 'u', skillId: 'protocol-box-breathing', startedAt: 110, completedAt: 150 } };
  const { db, masks } = fakeDB({ 'assignments:startedAt': [good], 'assignments:completedAt': [good, { ...good, path: 'other/states/items/u/assignments/daily' }, { ...good, path: 'pulsecheck-linear-curriculum/states/items/wrong/assignments/daily' }] });
  const result = await collectModuleInsights(db, { start: 100, end: 200 });
  assert.equal(result.modules.length, 1); assert.equal(result.modules[0].completedSessions, 1);
  assert.equal(result.modules[0].uniqueStarters, 1); assert.equal(result.coverage.assignments, 1);
  assert.equal(masks.flat().some(field => /journal|text|outcome|notes/i.test(field)), false);
});
test('linear assignment source cap withholds aggregates', async () => {
  const { db } = fakeDB({ 'assignments:startedAt': Array.from({ length: 5001 }, (_, i) => ({ id: String(i), data: {} })) });
  const result = await collectModuleInsights(db, { start: 100, end: 200 });
  assert.equal(result.status, 'partial'); assert.deepEqual(result.modules, []);
});
