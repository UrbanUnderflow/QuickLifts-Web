const test = require('node:test');
const assert = require('node:assert/strict');
const { compileTypeScriptRuntime, loadCompiledModule, createFirestoreAdminMock, createNextApiResponseRecorder } = require('../firebase-admin/_runtimeHarness.cjs');
const compiled = compileTypeScriptRuntime({ cacheKey: 'legacy-participation-access', entryPaths: ['src/lib/coach-dashboard/access.ts', 'src/pages/api/coach/team-dashboard.ts'] });
const { loadLegacyParticipationAccess } = loadCompiledModule({ compiled, fileName: 'access.js' });
function fixture(options = {}) {
  return createFirestoreAdminMock({ collections: {
    coaches: [{ id: 'coach', data: { userId: 'coach', userType: 'coach', status: 'active', ...options.coach } }],
    coachAthletes: options.links || [{ id: 'connection', data: { coachId: 'coach', athleteUserId: 'athlete', sourceTeamId: 'team', ...options.link } }],
    'account-closure-jobs': options.closed ? [{ id: 'coach', data: {} }] : [],
    'pulsecheck-teams': [{ id: 'team', data: { organizationId: 'org', status: 'active', ...options.team } }],
    'pulsecheck-organizations': [{ id: 'org', data: { status: 'active', ...options.org } }],
  } }).db;
}
test('verified legacy connections grant assigned participation access only', async () => {
  const result = await loadLegacyParticipationAccess(fixture(), 'coach', 'legacy:coach');
  assert.equal(result.teamId, 'team');
  assert.deepEqual(result.membership.allowedAthleteIds, ['athlete']);
  assert.equal(result.membership.rosterVisibilityScope, 'assigned');
  assert.equal(result.access.wellbeing, false);
});
test('foreign, disabled, disconnected, unscoped and inactive contexts reject', async () => {
  await assert.rejects(loadLegacyParticipationAccess(fixture(), 'coach', 'legacy:other'), e => e.status === 403);
  for (const args of [
    { coach: { disabled: true } }, { coach: { status: 'revoked' } }, { coach: { userId: 'other' } },
    { closed: true }, { link: { disconnectedAt: 1 } }, { link: { sourceTeamId: undefined } },
    { team: { status: 'archived' } }, { org: { status: 'inactive' } },
    { links: [
      { id: 'one', data: { coachId: 'coach', athleteUserId: 'a', sourceTeamId: 'team' } },
      { id: 'two', data: { coachId: 'coach', athleteUserId: 'b', sourceTeamId: 'other' } },
    ] },
  ]) await assert.rejects(loadLegacyParticipationAccess(fixture(args), 'coach', 'legacy:coach'), e => e.status === 403);
});

test('dashboard route accepts a legacy workspace and still verifies sign-in', async () => {
  const { createTeamDashboardHandler } = loadCompiledModule({ compiled, fileName: 'team-dashboard.js', mocks: {
    '/coach-dashboard/auth': { authorizeDashboardRequest: async () => { throw Error('unused'); } },
    '/coach-dashboard/data': { loadDashboard: async () => { throw Error('unused'); } },
    '/coach-dashboard/access': loadCompiledModule({ compiled, fileName: 'access.js' }),
  } });
  const handler = createTeamDashboardHandler({
    authorize: async () => ({ uid: 'coach', db: fixture() }),
    load: async (db, uid, id, view) => {
      assert.equal(uid, 'coach'); assert.equal(id, 'legacy:coach'); assert.equal(view, 'participation');
      return { teamId: id };
    },
  });
  const response = createNextApiResponseRecorder();
  await handler({ method: 'GET', query: { teamId: 'legacy:coach' } }, response);
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.teamId, 'legacy:coach');
  const denied = createNextApiResponseRecorder();
  await createTeamDashboardHandler({ authorize: async () => { throw Error('expired'); } })(
    { method: 'GET', query: { teamId: 'legacy:coach' } }, denied);
  assert.equal(denied.statusCode, 401);
});
