import test from 'node:test';
import assert from 'node:assert/strict';
import { practiceOperationalDay, summarizePracticeBacklog } from '../../src/api/firebase/pulsecheckPilotDashboard/practiceBacklog';
const now = Date.parse('2026-09-13T13:00:00Z');
const task = (data: Record<string, unknown> = {}) => ({ status: 'assigned', sourceDate: '2026-09-13', isPrimaryForDate: true, ...data });

test('retained expired, replaced and completed history never becomes actionable backlog', () => {
  const history = ['expired', 'superseded', 'overridden', 'completed', 'deferred', 'paused', 'archived'].map(status => task({ status }));
  history.push(task({ completedAt: 123 }), task({ expiredAt: 123 }), task({ supersededByDailyTaskId: 'replacement' }), task({ actionType: 'defer' }));
  const original = JSON.stringify(history);
  assert.deepEqual(summarizePracticeBacklog([...history, task()], now), { dueToday: 1, overdue: 0, upcoming: 0, additionalDue: 0, undated: 0 });
  assert.equal(JSON.stringify(history), original);
});

test('future work and secondary curriculum do not inflate primary overdue work', () => {
  assert.deepEqual(summarizePracticeBacklog([
    task(), task({ sourceDate: '2026-09-14' }), task({ isPrimaryForDate: false }),
    task({ sourceDate: '2026-09-12', status: 'started' }),
    task({ sourceDate: '2026-09-12' }), task({ sourceDate: '2026-09-12', status: 'viewed' }),
  ], now), { dueToday: 1, overdue: 1, upcoming: 1, additionalDue: 1, undated: 0 });
});

test('legacy defaults count current assigned work, unknown dates and statuses never imply overdue', () => {
  assert.deepEqual(summarizePracticeBacklog([
    { sourceDate: '2026-09-13' }, task({ sourceDate: '' }), task({ sourceDate: '2026-02-30' }), task({ status: 'unexpected' }),
  ], now), { dueToday: 1, overdue: 0, upcoming: 0, additionalDue: 0, undated: 2 });
});

test('day boundary is athlete-local 4 a.m., including daylight-saving changes', () => {
  assert.equal(practiceOperationalDay(Date.parse('2026-09-13T07:59:00Z'), 'America/New_York'), '2026-09-12');
  assert.equal(practiceOperationalDay(Date.parse('2026-09-13T08:00:00Z'), 'America/New_York'), '2026-09-13');
  assert.equal(practiceOperationalDay(Date.parse('2026-11-01T08:59:00Z'), 'America/New_York'), '2026-10-31');
  assert.equal(practiceOperationalDay(Date.parse('2026-11-01T09:00:00Z'), 'America/New_York'), '2026-11-01');
  assert.equal(practiceOperationalDay(now, 'invalid'), '2026-09-13');
  assert.equal(summarizePracticeBacklog([task({ timezone: 'Pacific/Honolulu' })], Date.parse('2026-09-13T13:00:00Z')).upcoming, 1);
});

test('saved demos from before backlog fields still load and preserve completion history', async () => {
  const { pilotDashboardDemoMode } = await import('../../src/api/firebase/pulsecheckPilotDashboard/demoMode');
  const previousWindow = (globalThis as any).window;
  const values = new Map<string, string>();
  (globalThis as any).window = { localStorage: {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  } };
  try {
    pilotDashboardDemoMode.reset();
    const saved = JSON.parse(values.get('pulsecheckPilotDashboardDemoStore')!);
    const completions = saved.athletes.map((entry: any) => entry.summary.journey.assignmentCompletedCount);
    saved.athletes.forEach((entry: any) => { delete entry.summary.journey.practiceBacklog; });
    values.set('pulsecheckPilotDashboardDemoStore', JSON.stringify(saved));
    const detail = pilotDashboardDemoMode.getPilotDashboardDetail(pilotDashboardDemoMode.getPilotId())!;
    assert.deepEqual(detail.athletes.map((athlete: any) => athlete.journey.assignmentCompletedCount), completions);
    assert.ok(detail.athletes.every((athlete: any) => athlete.journey.practiceBacklog.dueToday === 0));
  } finally {
    if (previousWindow === undefined) delete (globalThis as any).window;
    else (globalThis as any).window = previousWindow;
  }
});
