const test = require('node:test');
const assert = require('node:assert/strict');
const { compileTypeScriptRuntime, loadCompiledModule, createFirestoreAdminMock } = require('../firebase-admin/_runtimeHarness.cjs');
const compiled = compileTypeScriptRuntime({ cacheKey: 'report-delivery-scheduler', entryPaths: ['src/lib/coach-dashboard/reportDelivery.ts', 'src/lib/coach-dashboard/reportDeliveryRunner.ts', 'src/lib/coach-dashboard/access.ts'] });
const access = loadCompiledModule({ compiled, fileName: 'access.js' });
const helpers = loadCompiledModule({ compiled, fileName: 'reportDelivery.js', mocks: { './access': access, './data': { loadDashboard: async () => { throw new Error('Unexpected dashboard fetch'); } } } });
const runner = loadCompiledModule({ compiled, fileName: 'reportDeliveryRunner.js', mocks: { './reportDelivery': helpers, '/utils/emailSequenceHelpers': { sendBrevoTransactionalEmail: async () => { throw new Error('Real email forbidden in tests'); } } } });
const config = { teamId: 'team', dailyEnabled: true, weeklyEnabled: true, timeZone: 'America/New_York', sendHour: 8, startDate: '2026-01-01', recipientUids: ['coach'] };
const monday = new Date('2026-10-26T12:00:00Z');
const prefix = 'coach-team-insight-reports/delivery';
function fixture(extra = {}) {
  return createFirestoreAdminMock({ collections: {
    [`${prefix}/configs`]: [{ id: 'team', data: config }],
    'pulsecheck-teams': [{ id: 'team', data: { status: 'active', organizationId: 'org' } }],
    'pulsecheck-organizations': [{ id: 'org', data: { status: 'active' } }],
    'pulsecheck-team-memberships': [{ id: 'team_coach', data: { userId: 'coach', teamId: 'team', organizationId: 'org', role: 'coach', status: 'active' } }, { id: 'team_athlete', data: { userId: 'athlete', teamId: 'team', organizationId: 'org', role: 'athlete', status: 'active' } }],
    users: [{ id: 'coach', data: { email: 'coach@example.test', displayName: 'Coach' } }], ...extra,
  } });
}
const prepare = async () => ({ subject: 'Synthetic report', html: '<p>Report</p>', contentHtml: '<p>Report</p>', athleteIds: ['athlete'], from: '2026-10-19', to: '2026-10-25' });
const record = (f, kind) => f.getDocument(`${prefix}/reports/${helpers.deliveryId('team', 'coach', kind, '2026-10-25')}`);
test('New York 8 AM follows daylight saving and waits for hour and start date', () => {
  for (const [before, at] of [['2026-07-13T11:59:00Z', '2026-07-13T12:00:00Z'], ['2026-12-14T12:59:00Z', '2026-12-14T13:00:00Z']]) {
    assert.deepEqual(helpers.dueReports(config, new Date(before)), []);
    assert.deepEqual(helpers.dueReports(config, new Date(at)).map(r => r.kind), ['daily', 'weekly']);
  }
  assert.deepEqual(helpers.dueReports({ ...config, startDate: '2026-10-27' }, monday), []);
  assert.deepEqual(helpers.dueReports(config, new Date('2026-10-27T12:00:00Z')).map(r => r.kind), ['daily']);
  assert.notEqual(helpers.deliveryId('team', 'coach', 'daily', '2026-10-25'), helpers.deliveryId('team', 'coach', 'weekly', '2026-10-25'));
});
test('invalid settings reject impossible dates, unknown zones, hours, recipients and enabled empty lists', () => {
  for (const patch of [{ startDate: '2026-02-30' }, { timeZone: 'Moon/Sea' }, { sendHour: 24 }, { sendHour: 8.5 }, { recipientUids: [] }, { recipientUids: ['bad/id'] }, { dailyEnabled: 'true' }]) assert.throws(() => helpers.validateDeliveryConfig({ ...config, ...patch }));
  assert.deepEqual(helpers.validateDeliveryConfig({ ...config, recipientUids: ['coach', 'coach'] }).recipientUids, ['coach']);
});
const day = (date, checkIn, skillCompleted = 0) => ({ date, checkIn, scheduled: true, skillAssigned: 1, skillCompleted });
const current = { from: '2026-10-19', to: '2026-10-25', athletes: [
  { id: 'a', displayName: '<A & B>', dailyParticipation: [day('2026-10-24', true, 9), day('2026-10-25', true, 2)] },
  { id: 'b', displayName: 'Older activity', dailyParticipation: [day('2026-10-24', true), day('2026-10-25', false)] },
] };
function render(kind) { return helpers.renderParticipationReport({ teamName: 'Synthetic <team>', brand: 'AthleticMind', kind, to: '2026-10-25', current, previous: { from: '2026-10-12', to: '2026-10-18', athletes: [] }, url: 'https://example.test/report' }); }
test('daily uses only previous day with escaped names and concise participation, no weekly insights', () => {
  const result = render('daily'); assert.equal(result.from, '2026-10-25');
  assert.match(result.html, /1 of 2 athletes checked in yesterday/); assert.match(result.html, /2 recorded as complete/);
  assert.match(result.html, /&lt;A &amp; B&gt;/); assert.doesNotMatch(result.html, /<A & B>|9 completed|11 completed|What changed|One focus|Older activity/);
});
test('weekly tells named athletes and days story without opportunity rates', () => {
  const result = render('weekly'); assert.match(result.html, /2 of 2 athletes checked in last week/);
  assert.match(result.html, /Checked in on 2 of 2 days/); assert.match(result.html, /What changed/);
  assert.match(result.html, /11 practices assigned for this week/); assert.doesNotMatch(result.html.replace(/<[^>]+>/g, ""), /opportunit|adherence|%/);
});
test('Monday sends daily and weekly once; repeat run skips sent records', async () => {
  const f = fixture(); let sent = 0;
  const deps = { prepare, send: async (args) => { assert.equal(args.bypassDailyRecipientLimit, true); return { success: true, messageId: `synthetic-${++sent}` }; } };
  const first = await runner.runReportDeliveries(f.db, monday, deps); assert.deepEqual(first, { sent: 2, failed: 0, skipped: 0 }, JSON.stringify(record(f, 'daily')));
  assert.deepEqual(await runner.runReportDeliveries(f.db, monday, deps), { sent: 0, failed: 0, skipped: 2 });
  assert.equal(sent, 2); assert.equal(record(f, 'daily').status, 'sent'); assert.equal(record(f, 'weekly').status, 'sent');
});
test('revoked staff never receives a report', async () => {
  const f = fixture({ 'pulsecheck-team-memberships': [{ id: 'team_coach', data: { userId: 'coach', teamId: 'team', organizationId: 'org', role: 'coach', status: 'removed' } }] });
  let sent = 0; const result = await runner.runReportDeliveries(f.db, monday, { prepare, send: async () => { sent++; return { success: true }; } });
  assert.equal(result.failed, 2); assert.equal(sent, 0); assert.equal(record(f, 'daily').status, 'failed');
});
test('authorization revoked during preparation is rechecked before email', async () => {
  const f = fixture(); let sent = 0;
  const result = await runner.runReportDeliveries(f.db, monday, { prepare: async () => { await f.db.collection('pulsecheck-team-memberships').doc('team_coach').update({ status: 'removed' }); return prepare(); }, send: async () => { sent++; return { success: true }; } });
  assert.equal(result.failed, 2); assert.equal(sent, 0);
});
test('failed sends and ambiguous skipped sends remain failed and retryable', async () => {
  for (const response of [{ success: false, error: 'Provider unavailable' }, { success: true, skipped: true }]) {
    const f = fixture(); let attempts = 0;
    const result = await runner.runReportDeliveries(f.db, monday, { prepare, send: async () => { attempts++; return response; } });
    assert.equal(result.failed, 2); assert.equal(record(f, 'daily').status, 'failed'); assert.equal(record(f, 'daily').sentAt, undefined); assert.equal(record(f, 'daily').leaseUntil, 0);
    const retry = await runner.runReportDeliveries(f.db, monday, { prepare, send: async () => { attempts++; return { success: true, messageId: 'retry' }; } });
    assert.equal(retry.sent, 2); assert.equal(attempts, 4);
  }
});
test('suppressed recipients are recorded as suppressed, never falsely sent', async () => {
  const f = fixture(); const result = await runner.runReportDeliveries(f.db, monday, { prepare, send: async () => ({ success: true, skipped: true, suppressed: true, suppressionReason: 'opt-out' }) });
  assert.deepEqual(result, { sent: 0, failed: 0, skipped: 2 }); assert.equal(record(f, 'daily').status, 'suppressed'); assert.equal(record(f, 'daily').sentAt, null);
});
test('athlete removed during preparation stops stale named report delivery', async () => {
  const f = fixture(); let sent = 0;
  const result = await runner.runReportDeliveries(f.db, monday, { prepare: async () => { await f.db.collection('pulsecheck-team-memberships').doc('team_athlete').update({ status: 'removed' }); return prepare(); }, send: async () => { sent++; return { success: true }; } });
  assert.equal(result.failed, 2); assert.equal(sent, 0); assert.match(record(f, 'daily').lastError, /audience changed/);
});
test('an active delivery lease prevents a second worker from sending', async () => {
  const f = fixture({ [`${prefix}/reports`]: ['daily', 'weekly'].map(kind => ({ id: helpers.deliveryId('team', 'coach', kind, '2026-10-25'), data: { status: 'preparing', leaseUntil: Date.now() + 60000 } })) });
  let sent = 0; const result = await runner.runReportDeliveries(f.db, monday, { prepare, send: async () => { sent++; return { success: true }; } });
  assert.deepEqual(result, { sent: 0, failed: 0, skipped: 2 }); assert.equal(sent, 0);
});
