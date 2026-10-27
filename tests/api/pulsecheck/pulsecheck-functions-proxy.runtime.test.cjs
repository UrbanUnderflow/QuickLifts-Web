const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const {
  compileTypeScriptRuntime,
  loadCompiledModule,
  repoRoot,
  withPatchedEnv,
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

test('same-deployment phone proxies do not forward a candidate session to the published release or caller host', async () => {
  const originalFetch = global.fetch;
  const calls = [];
  global.fetch = async (url, options) => {
    calls.push({ url: String(url), options });
    return { status: 401, headers: new Headers({ 'content-type': 'application/json' }),
      async arrayBuffer() { return Buffer.from('{"error":"Sign in required."}'); } };
  };
  try {
    await withPatchedEnv({
      NODE_ENV: 'production',
      NEXT_PUBLIC_SITE_URL: 'https://fitwithpulse.ai',
      PULSECHECK_BASELINE_DEPLOYMENT_ORIGIN: 'https://candidate--quickliftsapp.netlify.app/',
      PULSECHECK_LOCAL_FUNCTIONS_ORIGIN: 'https://ignored-local.invalid',
    }, async () => {
      const { default: handler } = loadProxyModule();
      for (const name of ['complete-phone-auth', 'complete-email-link-auth', 'program-sign-in-policy']) {
        const response = createResponseRecorder();
        await handler({ method: 'POST', query: { name }, body: {}, headers: {
          host: 'caller.invalid', 'x-forwarded-host': 'caller.invalid',
          origin: 'https://caller.invalid', authorization: 'Bearer candidate-session',
        } }, response);
        assert.equal(response.statusCode, 401);
        assert.equal(calls.at(-1).url, `https://candidate--quickliftsapp.netlify.app/.netlify/functions/${name}`);
        assert.equal(calls.at(-1).options.headers.get('authorization'), 'Bearer candidate-session');
        assert.equal(calls.at(-1).options.headers.get('origin'), 'https://candidate--quickliftsapp.netlify.app');
        assert.equal(calls.at(-1).options.headers.get('referer'), 'https://candidate--quickliftsapp.netlify.app/');
      }
      await handler({ method: 'GET', query: { name: 'oura-status' }, headers: {} }, createResponseRecorder());
      assert.equal(calls.at(-1).url, 'https://fitwithpulse.ai/.netlify/functions/oura-status');
    });
  } finally { global.fetch = originalFetch; }
});

test('phone proxies retain the configured origin when no hosted build origin is available', async () => {
  const originalFetch = global.fetch;
  const calls = [];
  global.fetch = async url => {
    calls.push(String(url));
    return { status: 401, headers: new Headers(), async arrayBuffer() { return Buffer.from('{}'); } };
  };
  try {
    await withPatchedEnv({ NODE_ENV: 'production', NEXT_PUBLIC_SITE_URL: 'https://fitwithpulse.ai/',
      PULSECHECK_BASELINE_DEPLOYMENT_ORIGIN: undefined }, async () => {
      const { default: handler } = loadProxyModule();
      await handler({ method: 'POST', query: { name: 'complete-phone-auth' }, headers: {}, body: {} }, createResponseRecorder());
      assert.deepEqual(calls, ['https://fitwithpulse.ai/.netlify/functions/complete-phone-auth']);
    });
  } finally { global.fetch = originalFetch; }
});

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

test('PulseCheck function proxy supports coach scorecard requests', async () => {
  const originalFetch = global.fetch;
  const fetchCalls = [];
  global.fetch = async (url, options = {}) => {
    fetchCalls.push({ url: String(url), options });
    return {
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      async arrayBuffer() {
        return Buffer.from('{"scorecard":{"coherence":{"score":73}}}');
      },
    };
  };

  try {
    const { default: handler } = loadProxyModule();
    const response = createResponseRecorder();

    await handler({
      method: 'POST',
      url: '/api/pulsecheck/functions/get-pulsecheck-scorecard',
      query: { name: 'get-pulsecheck-scorecard' },
      headers: {
        host: 'localhost:3000',
        'x-forwarded-host': 'localhost:3000',
        authorization: 'Bearer token',
      },
      body: { athleteId: 'athlete-1', teamId: 'team-1' },
    }, response);

    assert.equal(response.statusCode, 200);
    assert.equal(fetchCalls.length, 1);
    assert.equal(fetchCalls[0].url, 'https://fitwithpulse.ai/.netlify/functions/get-pulsecheck-scorecard');
    assert.equal(fetchCalls[0].options.headers.get('authorization'), 'Bearer token');
    assert.equal(fetchCalls[0].options.body, JSON.stringify({ athleteId: 'athlete-1', teamId: 'team-1' }));
  } finally {
    global.fetch = originalFetch;
  }
});

test('PulseCheck function proxy forwards team standings requests', async () => {
  const originalFetch = global.fetch;
  const fetchCalls = [];
  global.fetch = async (url, options = {}) => {
    fetchCalls.push({ url: String(url), options });
    return {
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      async arrayBuffer() {
        return Buffer.from('{"teamId":"team-1","members":[]}');
      },
    };
  };

  try {
    const { default: handler } = loadProxyModule();
    const response = createResponseRecorder();

    await handler({
      method: 'POST',
      url: '/api/pulsecheck/functions/get-pulsecheck-team-standings',
      query: { name: 'get-pulsecheck-team-standings' },
      headers: {
        host: 'fitwithpulse.ai',
        'x-forwarded-host': 'fitwithpulse.ai',
        'x-forwarded-proto': 'https',
        authorization: 'Bearer token',
      },
      body: { timezone: 'America/New_York' },
    }, response);

    assert.equal(response.statusCode, 200);
    assert.equal(fetchCalls.length, 1);
    assert.equal(
      fetchCalls[0].url,
      'https://fitwithpulse.ai/.netlify/functions/get-pulsecheck-team-standings',
    );
    assert.equal(fetchCalls[0].options.headers.get('authorization'), 'Bearer token');
  } finally {
    global.fetch = originalFetch;
  }
});

test('PulseCheck function proxy forwards team showing-up history requests', async () => {
  const originalFetch = global.fetch;
  const fetchCalls = [];
  global.fetch = async (url, options = {}) => {
    fetchCalls.push({ url: String(url), options });
    return {
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      async arrayBuffer() {
        return Buffer.from('{"teamId":"team-1","standings":[]}');
      },
    };
  };

  try {
    const { default: handler } = loadProxyModule();
    const response = createResponseRecorder();

    await handler({
      method: 'POST',
      url: '/api/pulsecheck/functions/get-pulsecheck-team-showing-up-history',
      query: { name: 'get-pulsecheck-team-showing-up-history' },
      headers: {
        host: 'fitwithpulse.ai',
        'x-forwarded-host': 'fitwithpulse.ai',
        'x-forwarded-proto': 'https',
        authorization: 'Bearer token',
      },
      body: {
        teamId: 'team-1',
        startDate: '2026-07-30',
        endDate: '2026-10-27',
      },
    }, response);

    assert.equal(response.statusCode, 200);
    assert.equal(fetchCalls.length, 1);
    assert.equal(
      fetchCalls[0].url,
      'https://fitwithpulse.ai/.netlify/functions/get-pulsecheck-team-showing-up-history',
    );
    assert.equal(fetchCalls[0].options.headers.get('authorization'), 'Bearer token');
  } finally {
    global.fetch = originalFetch;
  }
});

test('PulseCheck function proxy strips upstream transfer and encoding headers', async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => ({
    status: 200,
    headers: new Headers({
      'content-type': 'application/json',
      'content-length': '999',
      'transfer-encoding': 'chunked',
      'content-encoding': 'gzip',
      'x-proxied': '1',
    }),
    async arrayBuffer() {
      return Buffer.from('{"ok":true}');
    },
  });

  try {
    const { default: handler } = loadProxyModule();
    const response = createResponseRecorder();

    await handler({
      method: 'GET',
      url: '/api/pulsecheck/functions/oura-status',
      query: { name: 'oura-status' },
      headers: {
        host: 'fitwithpulse.ai',
        'x-forwarded-host': 'fitwithpulse.ai',
        'x-forwarded-proto': 'https',
      },
      body: undefined,
    }, response);

    assert.equal(response.statusCode, 200);
    assert.equal(response.headers['content-type'], 'application/json');
    assert.equal(response.headers['x-proxied'], '1');
    assert.equal(response.headers['content-length'], undefined);
    assert.equal(response.headers['transfer-encoding'], undefined);
    assert.equal(response.headers['content-encoding'], undefined);
  } finally {
    global.fetch = originalFetch;
  }
});

test('PulseCheck function proxy supports Google Health Fitbit endpoints', async () => {
  const originalFetch = global.fetch;
  const fetchCalls = [];
  global.fetch = async (url, options = {}) => {
    fetchCalls.push({ url: String(url), options });
    return {
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      async arrayBuffer() {
        return Buffer.from('{"connected":true}');
      },
    };
  };

  try {
    const { default: handler } = loadProxyModule();
    const response = createResponseRecorder();

    await handler({
      method: 'GET',
      url: '/api/pulsecheck/functions/google-health-status',
      query: { name: 'google-health-status' },
      headers: {
        host: 'localhost:3000',
        'x-forwarded-host': 'localhost:3000',
        authorization: 'Bearer token',
      },
      body: undefined,
    }, response);

    assert.equal(response.statusCode, 200);
    assert.equal(String(response.body), '{"connected":true}');
    assert.equal(fetchCalls.length, 1);
    assert.equal(fetchCalls[0].url, 'https://fitwithpulse.ai/.netlify/functions/google-health-status');
    assert.equal(fetchCalls[0].options.headers.get('authorization'), 'Bearer token');
  } finally {
    global.fetch = originalFetch;
  }
});

test('PulseCheck function proxy supports WHOOP endpoints', async () => {
  const originalFetch = global.fetch;
  const fetchCalls = [];
  global.fetch = async (url, options = {}) => {
    fetchCalls.push({ url: String(url), options });
    return {
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      async arrayBuffer() {
        return Buffer.from('{"connected":true,"provider":"whoop"}');
      },
    };
  };

  try {
    const { default: handler } = loadProxyModule();
    const response = createResponseRecorder();

    await handler({
      method: 'GET',
      url: '/api/pulsecheck/functions/whoop-status',
      query: { name: 'whoop-status' },
      headers: {
        host: 'localhost:3000',
        'x-forwarded-host': 'localhost:3000',
        authorization: 'Bearer token',
      },
      body: undefined,
    }, response);

    assert.equal(response.statusCode, 200);
    assert.equal(String(response.body), '{"connected":true,"provider":"whoop"}');
    assert.equal(fetchCalls.length, 1);
    assert.equal(fetchCalls[0].url, 'https://fitwithpulse.ai/.netlify/functions/whoop-status');
    assert.equal(fetchCalls[0].options.headers.get('authorization'), 'Bearer token');
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

test('appearance proxy preserves authenticated team scope, environment and Clay response', async () => {
  const originalFetch = global.fetch;
  let call;
  global.fetch = async (url, options) => {call = {url: String(url), options}; return {
    status: 200, headers: new Headers({'content-type': 'application/json', 'cache-control': 'no-store'}),
    arrayBuffer: async () => Buffer.from('{"appExperience":{"ios":"clay"}}'),
  };};
  try {
    const response = createResponseRecorder();
    await loadProxyModule().default({method: 'GET', query: {name: 'get-pulsecheck-app-branding', teamId: 'synthetic-team'}, headers: {authorization: 'Bearer synthetic-token', 'x-pulsecheck-firebase-mode': 'prod'}, body: undefined}, response);
    assert.equal(response.statusCode, 200);
    assert.equal(call.url, 'https://fitwithpulse.ai/.netlify/functions/get-pulsecheck-app-branding?teamId=synthetic-team');
    assert.equal(call.options.headers.get('authorization'), 'Bearer synthetic-token');
    assert.equal(call.options.headers.get('x-pulsecheck-firebase-mode'), 'prod');
    assert.equal(String(response.body), '{"appExperience":{"ios":"clay"}}');
  } finally {global.fetch = originalFetch;}
});

test('Clay Self proxy preserves authenticated three-photo request and async response', async () => {
  const originalFetch = global.fetch;
  let call;
  global.fetch = async (url, options) => { call = { url: String(url), options }; return {
    status: 202, headers: new Headers({ 'content-type': 'application/json', 'cache-control': 'private, no-store' }),
    arrayBuffer: async () => Buffer.from('{"jobId":"synthetic-job","status":"processing"}'),
  }; };
  try {
    const response = createResponseRecorder();
    const body = { action: 'generate', images: ['full_body', 'face', 'reference'].map(role => ({ role, mimeType: 'image/jpeg', imageBase64: 'synthetic' })) };
    await loadProxyModule().default({ method: 'POST', query: { name: 'pulsecheck-clay-self' }, headers: { authorization: 'Bearer synthetic-token', 'x-pulsecheck-firebase-mode': 'dev' }, body }, response);
    assert.equal(response.statusCode, 202);
    assert.equal(call.url, 'https://fitwithpulse.ai/.netlify/functions/pulsecheck-clay-self');
    assert.equal(call.options.headers.get('authorization'), 'Bearer synthetic-token');
    assert.equal(call.options.headers.get('x-pulsecheck-firebase-mode'), 'dev');
    assert.deepEqual(JSON.parse(call.options.body), body);
  } finally { global.fetch = originalFetch; }
});
