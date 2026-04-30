const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const {
  compileTypeScriptRuntime,
  loadCompiledModule,
  repoRoot,
  createNextApiResponseRecorder,
} = require('../firebase-admin/_runtimeHarness.cjs');

const compiledRuntime = compileTypeScriptRuntime({
  cacheKey: 'admin-smoke-levers',
  entryPaths: [
    path.join(repoRoot, 'src/pages/api/admin/pulsecheck/smoke-levers.ts'),
  ],
});

function loadSmokeModule(authResult = { email: 'admin@example.com' }) {
  return loadCompiledModule({
    compiled: compiledRuntime,
    fileName: 'smoke-levers.js',
    mocks: {
      '../_auth': {
        requireAdminRequest: async () => authResult,
      },
    },
  });
}

test('admin smoke levers lists server-side Netlify function endpoints', async () => {
  const { default: handler } = loadSmokeModule();
  const response = createNextApiResponseRecorder();

  await handler({
    method: 'GET',
    headers: {
      host: 'localhost:8888',
      authorization: 'Bearer token',
    },
  }, response);

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.ok, true);
  assert.ok(response.body.targets.some((target) => target.id === 'scheduled-nora-conversation'));
  assert.ok(response.body.targets.some((target) => target.id === 'nora-timeout-sweep'));
  assert.ok(response.body.targets.some((target) => target.id === 'daily-curriculum-assignment'));
  assert.ok(response.body.targets.some((target) => target.id === 'curriculum-reminder'));
  assert.ok(response.body.targets.some((target) => target.id === 'curriculum-assessment'));

  const assessment = response.body.targets.find((target) => target.id === 'curriculum-assessment');
  assert.equal(
    assessment.endpoint,
    'http://localhost:8888/.netlify/functions/scheduled-curriculum-assessment?force=1&backfillMonths=0',
  );
});

test('admin smoke levers invokes a selected Netlify function through the server API', async () => {
  const originalFetch = global.fetch;
  const fetchCalls = [];
  global.fetch = async (url, options = {}) => {
    fetchCalls.push({ url: String(url), options });
    return {
      ok: true,
      status: 200,
      async text() {
        return JSON.stringify({ ok: true, summary: { closed: 2 } });
      },
    };
  };

  try {
    const { default: handler } = loadSmokeModule();
    const response = createNextApiResponseRecorder();

    await handler({
      method: 'POST',
      headers: {
        host: 'fitwithpulse.ai',
        'x-forwarded-proto': 'https',
        authorization: 'Bearer token',
      },
      body: { targetId: 'nora-timeout-sweep' },
    }, response);

    assert.equal(response.statusCode, 200);
    assert.equal(response.body.ok, true);
    assert.equal(response.body.targetId, 'nora-timeout-sweep');
    assert.equal(fetchCalls.length, 1);
    assert.equal(fetchCalls[0].url, 'https://fitwithpulse.ai/.netlify/functions/scheduled-nora-conversation-timeout-sweep');
    assert.equal(fetchCalls[0].options.method, 'GET');
    assert.equal(fetchCalls[0].options.headers['x-admin-smoke-lever'], 'admin@example.com');
    assert.deepEqual(response.body.payload, { ok: true, summary: { closed: 2 } });
  } finally {
    global.fetch = originalFetch;
  }
});

test('admin smoke levers rejects unsupported targets before fetching', async () => {
  const originalFetch = global.fetch;
  let fetched = false;
  global.fetch = async () => {
    fetched = true;
    throw new Error('should not fetch');
  };

  try {
    const { default: handler } = loadSmokeModule();
    const response = createNextApiResponseRecorder();

    await handler({
      method: 'POST',
      headers: {
        host: 'localhost:8888',
        authorization: 'Bearer token',
      },
      body: { targetId: 'not-real' },
    }, response);

    assert.equal(response.statusCode, 400);
    assert.equal(fetched, false);
  } finally {
    global.fetch = originalFetch;
  }
});
