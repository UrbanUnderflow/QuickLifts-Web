const test = require('node:test');
const assert = require('node:assert/strict');
const { compileTypeScriptRuntime, loadCompiledModule, createFirestoreAdminMock, createNextApiResponseRecorder } = require('../firebase-admin/_runtimeHarness.cjs');
const compiled = compileTypeScriptRuntime({ cacheKey: 'report-delivery-admin', entryPaths: ['src/pages/api/admin/pulsecheck/report-delivery.ts'] });
const config = { teamId: 'team', dailyEnabled: true, weeklyEnabled: true, timeZone: 'America/New_York', sendHour: 8, startDate: '2026-10-26', recipientUids: ['coach'] };
async function call(options = {}) {
  const f = createFirestoreAdminMock({ collections: {
    'coach-team-insight-reports/delivery/configs': options.saved ? [{ id: 'team', data: options.saved }] : [],
    admin: options.notAdmin ? [] : [{ id: 'admin@example.test', data: {} }],
    'pulsecheck-teams': [{ id: 'team', data: {} }],
    'account-closure-jobs': options.closed ? [{ id: 'actor', data: {} }] : [],
  } });
  const app = { firestore: () => f.db, auth: () => ({ verifyIdToken: async (_token, revoked) => { assert.equal(revoked, true); return { uid: 'actor', email: 'admin@example.test' }; } }) };
  const handler = loadCompiledModule({ compiled, fileName: 'report-delivery.js', mocks: {
    '../_auth': { requireAdminRequest: async () => options.denied ? null : { email: 'admin@example.test' } },
    '/lib/firebase-admin': { __esModule: true, default: f.admin, getFirebaseAdminApp: () => app },
    '/lib/coach-dashboard/access': { validTeamId: value => typeof value === 'string' && /^[A-Za-z0-9_-]+$/.test(value), dashboardAccess: () => ({ participation: true }) },
    '/lib/coach-dashboard/reportDelivery': { validateDeliveryConfig: input => input, resolveReportRecipients: async () => { if (options.invalidRecipient) throw new Error('Recipient has no team access.'); return [{ uid: 'coach', email: 'coach@example.test', name: 'Coach' }]; } },
  } }).default;
  const res = createNextApiResponseRecorder();
  await handler({ method: options.method || 'POST', headers: { authorization: 'Bearer synthetic' }, body: { ...config, ...options.patch }, query: { teamId: 'team' } }, res);
  return { f, res };
}
test('authorized report schedule saves only team config with server-owned audit fields', async () => {
  const { f, res } = await call(); assert.equal(res.statusCode, 200);
  assert.equal(f.getDocument('coach-team-insight-reports/delivery/configs/team').updatedBy, 'actor');
  assert.equal(f.getDocument('coach-team-insight-reports/delivery/configs/team').dailyEnabled, true);
});
test('unauthorized, closed, unknown-field, and inaccessible-recipient writes do not persist', async () => {
  for (const [options, expected] of [[{ denied: true }, 401], [{ notAdmin: true }, 403], [{ closed: true }, 403], [{ patch: { updatedBy: 'forged' } }, 400], [{ invalidRecipient: true }, 400], [{ method: 'DELETE' }, 405]]) {
    const { f, res } = await call(options); assert.equal(res.statusCode, expected); assert.ok(!f.getDocument('coach-team-insight-reports/delivery/configs/team'));
  }
});
test('admin can persist per-recipient CC mapping', async () => {
  const recipientCc = { coach: [{ email: 'copy@example.test', name: 'Copy' }] };
  const { f, res } = await call({ patch: { recipientCc } });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(f.getDocument('coach-team-insight-reports/delivery/configs/team').recipientCc, recipientCc);
});

test('older dashboards preserve saved CCs only for retained primary recipients', async () => {
  const retained = [{ email: 'copy@example.test' }];
  const { f, res } = await call({ saved: { ...config, recipientCc: { coach: retained, removed: [{ email: 'removed@example.test' }] } }, patch: { sendHour: 9 } });
  assert.equal(res.statusCode, 200);
  const saved = f.getDocument('coach-team-insight-reports/delivery/configs/team');
  assert.deepEqual(saved.recipientCc, { coach: retained });
  assert.equal(saved.sendHour, 9);
});
test('an explicit empty CC mapping clears previously saved CCs', async () => {
  const { f, res } = await call({ saved: { ...config, recipientCc: { coach: [{ email: 'copy@example.test' }] } }, patch: { recipientCc: {} } });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(f.getDocument('coach-team-insight-reports/delivery/configs/team').recipientCc, {});
});
