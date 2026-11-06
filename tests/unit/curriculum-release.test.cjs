const test = require('node:test');
const assert = require('node:assert/strict');
const { verifyCurriculumRelease } = require('../../scripts/verify-curriculum-release.cjs');
const origin = 'https://candidate.example';
test('rejects a published preview even when ready and locked', async () => {
  await assert.rejects(verifyCurriculumRelease({ origin, deployment: {
    id: 'published-preview', context: 'deploy-preview', state: 'ready', locked: true, published_at: '2026-11-04',
  }, fetchImpl: () => { throw Error('must stop before network'); } }), /requires production context/);
});
test('rejects disabled runtime returning legacy despite HTTP 200', async () => {
  await assert.rejects(verifyCurriculumRelease({ origin, deployment: { context: 'production' },
    fetchImpl: async () => new Response(JSON.stringify({ status: 'legacy' }), { status: 200 }),
  }), /must reach its sign-in gate/);
});
test('checks the actual runtime gate without authenticating or issuing an assignment', async () => {
  const result = await verifyCurriculumRelease({ origin, deployment: { id: 'candidate', context: 'production' },
    fetchImpl: async (url, options) => {
      assert.equal(url.href, origin + '/api/curriculum/runtime');
      assert.equal(options.headers.Authorization, undefined);
      assert.deepEqual(JSON.parse(options.body), { action: 'today' });
      return new Response(JSON.stringify({ error: 'Sign in to continue' }), { status: 401 });
    },
  });
  assert.equal(result.runtimeGateVerified, true);
  assert.equal(result.authenticatedAssignmentVerified, false);
});
