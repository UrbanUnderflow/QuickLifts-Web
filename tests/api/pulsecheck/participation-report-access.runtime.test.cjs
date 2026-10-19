const test = require('node:test');
const assert = require('node:assert/strict');
const { compileTypeScriptRuntime, loadCompiledModule, createFirestoreAdminMock, createNextApiResponseRecorder } = require('../firebase-admin/_runtimeHarness.cjs');
const compiled = compileTypeScriptRuntime({ cacheKey: 'participation-report-access', entryPaths: ['src/pages/api/coach/participation-report.ts', 'src/lib/coach-dashboard/access.ts'] });
const access = loadCompiledModule({ compiled, fileName: 'access.js' });
const id = 'a'.repeat(64);
async function call(options = {}) {
  const report = { uid: 'coach', teamId: 'team', athleteIds: ['athlete'], subject: 'Synthetic report', contentHtml: '<p>Named participation</p>', recipientEmail: 'private@example.test', lastError: 'private error', ...options.report };
  const coach = { userId: 'coach', teamId: 'team', organizationId: 'org', role: 'coach', status: 'active', ...options.coach };
  const athlete = { userId: 'athlete', teamId: 'team', organizationId: 'org', role: 'athlete', status: 'active', ...options.athlete };
  const f = createFirestoreAdminMock({ collections: {
    'coach-team-insight-reports/delivery/reports': options.missingReport ? [] : [{ id, data: report }],
    'pulsecheck-teams': [{ id: 'team', data: { status: 'active', organizationId: 'org', ...options.team } }],
    'pulsecheck-organizations': [{ id: 'org', data: { status: 'active' } }],
    'pulsecheck-team-memberships': [{ id: 'team_coach', data: coach }, { id: 'team_athlete', data: athlete }],
    'account-closure-jobs': options.closed ? [{ id: 'coach', data: {} }] : [],
  } });
  const handler = loadCompiledModule({ compiled, fileName: 'participation-report.js', mocks: {
    '/coach-dashboard/auth': { authorizeDashboardRequest: async () => { if (options.noAuth) throw new Error('Unauthenticated'); return { db: f.db, uid: options.uid || 'coach' }; } },
    '/coach-dashboard/access': access,
  } }).default;
  const res = createNextApiResponseRecorder();
  await handler({ method: options.method || 'GET', query: { id: options.id === undefined ? id : options.id }, headers: {} }, res);
  return res;
}
test('intended authorized recipient gets only allowed report fields', async () => {
  const res = await call(); assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { subject: 'Synthetic report', contentHtml: '<p>Named participation</p>', teamId: 'team' });
});
test('invalid links, non-GET and unauthenticated requests reject', async () => {
  for (const [options, status] of [[{ id: '../report' }, 400], [{ id: ['a'.repeat(64)] }, 400], [{ id: 'g'.repeat(64) }, 400], [{ noAuth: true }, 401], [{ method: 'POST' }, 405]]) {
    const res = await call(options); assert.equal(res.statusCode, status); assert.equal(res.body.contentHtml, undefined);
  }
});
test('report only opens for intended UID even when the requester might have team access', async () => {
  const res = await call({ report: { uid: 'another-coach' } }); assert.equal(res.statusCode, 403); assert.equal(res.body.contentHtml, undefined);
  assert.equal((await call({ missingReport: true })).statusCode, 403);
});
test('revoked staff, closed accounts, inactive teams and narrowed roster deny historical report', async () => {
  for (const options of [{ coach: { status: 'removed' } }, { coach: { staffCapabilities: [] } }, { closed: true }, { team: { status: 'archived' } }, { coach: { rosterVisibilityScope: 'none' } }, { coach: { rosterVisibilityScope: 'assigned', allowedAthleteIds: [] } }]) {
    const res = await call(options); assert.equal(res.statusCode, 403); assert.equal(res.body.contentHtml, undefined);
  }
});
test('removed or cross-organization athlete denies stale named report', async () => {
  for (const athlete of [{ status: 'removed' }, { revokedAt: 123 }, { organizationId: 'other-org' }]) {
    const res = await call({ athlete }); assert.equal(res.statusCode, 403); assert.equal(res.body.contentHtml, undefined);
  }
});
test('malformed report audience fails closed; unfinished content returns preparation status', async () => {
  for (const athleteIds of [null, undefined, 'athlete', ['unknown-athlete']]) assert.equal((await call({ report: { athleteIds } })).statusCode, 403);
  const res = await call({ report: { contentHtml: '' } }); assert.equal(res.statusCode, 409); assert.equal(res.body.contentHtml, undefined);
});
test('assigned staff can open a report when every listed athlete remains assigned', async () => {
  assert.equal((await call({ coach: { rosterVisibilityScope: 'assigned', allowedAthleteIds: ['athlete'] } })).statusCode, 200);
});
