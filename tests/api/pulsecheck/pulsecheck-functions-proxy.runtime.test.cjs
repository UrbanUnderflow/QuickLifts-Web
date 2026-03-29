const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const {
  compileTypeScriptRuntime,
  loadCompiledModule,
  repoRoot,
} = require('../firebase-admin/_runtimeHarness.cjs');

const compiledProxyRuntime = compileTypeScriptRuntime({
  cacheKey: 'pulsecheck-functions-proxy',
  entryPaths: [
    path.join(repoRoot, 'src/pages/api/pulsecheck/functions/[name].ts'),
  ],
});

function createResponseRecorder() {
  return {
    statusCode: 200,
    body: undefined,
    headers: {},
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
    send(payload) {
      this.body = payload;
      return this;
    },
    setHeader(name, value) {
      this.headers[name] = value;
    },
  };
}

function loadProxyModule() {
  return loadCompiledModule({
    compiled: compiledProxyRuntime,
    fileName: '[name].js',
  });
}

test('PulseCheck function proxy forwards supported functions to direct Netlify endpoints', async () => {
  const originalFetch = global.fetch;
  const fetchCalls = [];
  global.fetch = async (url, options = {}) => {
    fetchCalls.push({ url: String(url), options });
    return {
      status: 200,
      headers: new Headers({ 'content-type': 'application/json', 'x-proxied': '1' }),
      async arrayBuffer() {
        return Buffer.from('{"ok":true}');
      },
    };
  };

  try {
    const { default: handler } = loadProxyModule();
    const response = createResponseRecorder();

    await handler({
      method: 'POST',
      url: '/api/pulsecheck/functions/submit-pulsecheck-checkin?sourceDate=2026-03-29',
      query: { name: 'submit-pulsecheck-checkin', sourceDate: '2026-03-29' },
      headers: {
        host: 'fitwithpulse.ai',
        'x-forwarded-host': 'fitwithpulse.ai',
        'x-forwarded-proto': 'https',
        authorization: 'Bearer token',
      },
      body: { userId: 'athlete-1', readinessScore: 4 },
    }, response);

    assert.equal(response.statusCode, 200);
    assert.equal(String(response.body), '{"ok":true}');
    assert.equal(fetchCalls.length, 1);
    assert.equal(fetchCalls[0].url, 'https://fitwithpulse.ai/.netlify/functions/submit-pulsecheck-checkin?sourceDate=2026-03-29');
    assert.equal(fetchCalls[0].options.method, 'POST');
    assert.equal(fetchCalls[0].options.headers.get('authorization'), 'Bearer token');
    assert.equal(fetchCalls[0].options.body, JSON.stringify({ userId: 'athlete-1', readinessScore: 4 }));
  } finally {
    global.fetch = originalFetch;
  }
});

test('PulseCheck function proxy rejects unsupported functions', async () => {
  const { default: handler } = loadProxyModule();
  const response = createResponseRecorder();

  await handler({
    method: 'GET',
    url: '/api/pulsecheck/functions/not-real',
    query: { name: 'not-real' },
    headers: { host: 'fitwithpulse.ai' },
    body: undefined,
  }, response);

  assert.equal(response.statusCode, 404);
  assert.deepEqual(response.body, { error: 'Unsupported PulseCheck function: not-real' });
});
