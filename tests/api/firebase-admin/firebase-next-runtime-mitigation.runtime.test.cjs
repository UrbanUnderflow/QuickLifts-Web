const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const {
  compileTypeScriptRuntime,
  loadCompiledModule,
  repoRoot,
} = require('./_runtimeHarness.cjs');

const compiledProxyRuntime = compileTypeScriptRuntime({
  cacheKey: 'firebase-next-runtime-mitigation',
  entryPaths: [
    path.join(repoRoot, 'netlify/functions/firebase-next-api.ts'),
  ],
});

function loadProxyModule() {
  return loadCompiledModule({
    compiled: compiledProxyRuntime,
    fileName: 'firebase-next-api.js',
  });
}

test('firebase-next-api exposes the full migrated route count and matches dynamic patterns', () => {
  const proxyModule = loadProxyModule();

  assert.ok(
    proxyModule.__test.routeCount >= 37,
    'route count should include the current migrated routes and remain tolerant of new additions'
  );
  assert.equal(
    proxyModule.__test.resolveRoutePattern('/api/admin/group-meet/contacts'),
    '/api/admin/group-meet/contacts'
  );
  assert.equal(
    proxyModule.__test.resolveRoutePattern('/api/admin/group-meet/test-email'),
    '/api/admin/group-meet/test-email'
  );
  assert.equal(
    proxyModule.__test.resolveRoutePattern('/api/admin/group-meet/request-123'),
    '/api/admin/group-meet/[requestId]'
  );
  assert.equal(
    proxyModule.__test.resolveRoutePattern('/api/admin/group-meet/request-123/send'),
    '/api/admin/group-meet/[requestId]/send'
  );
  assert.equal(
    proxyModule.__test.resolveRoutePattern('/api/admin/group-meet/request-123/preview-email'),
    '/api/admin/group-meet/[requestId]/preview-email'
  );
  assert.equal(
    proxyModule.__test.resolveRoutePattern('/api/group-meet/calendar/google/callback'),
    '/api/group-meet/calendar/google/callback'
  );
  assert.equal(
    proxyModule.__test.resolveRoutePattern('/api/group-meet/token-123/calendar/google/import'),
    '/api/group-meet/[token]/calendar/google/import'
  );
  assert.equal(
    proxyModule.__test.resolveRoutePattern('/api/group-meet/token-123/calendar/google/disconnect'),
    '/api/group-meet/[token]/calendar/google/disconnect'
  );
  assert.deepEqual(
    proxyModule.__test.matchRoutePattern(
      '/api/admin/group-meet/[requestId]/schedule',
      '/api/admin/group-meet/request-123/schedule'
    ),
    { requestId: 'request-123' }
  );
  assert.deepEqual(
    proxyModule.__test.matchRoutePattern(
      '/api/shared/system-overview/[token]/unlock',
      '/api/shared/system-overview/token-abc/unlock'
    ),
    { token: 'token-abc' }
  );
  assert.equal(
    proxyModule.__test.matchRoutePattern(
      '/api/outreach/create',
      '/api/outreach/deploy-campaign'
    ),
    null
  );
});

test('firebase-next-api handler adapts Netlify events into Next API req/res semantics', async () => {
  const proxyModule = loadProxyModule();
  const handler = proxyModule.__test.createFirebaseNextApiHandler([
    {
      pattern: '/api/example/[token]',
      async loadHandler() {
        return {
          default: async (req, res) => {
            res.setHeader('Set-Cookie', ['probe=1; Path=/; HttpOnly']);
            return res.status(201).json({
              method: req.method,
              token: req.query.token,
              query: req.query.mode,
              body: req.body,
              host: req.headers.host,
              remoteAddress: req.socket?.remoteAddress || null,
            });
          },
        };
      },
    },
  ]);

  const response = await handler({
    httpMethod: 'POST',
    headers: {
      host: 'fitwithpulse.ai',
      'content-type': 'application/json',
      'x-forwarded-for': '203.0.113.44',
    },
    queryStringParameters: {
      originalPath: '/api/example/probe-123',
      mode: 'safe',
    },
    body: JSON.stringify({ ok: true }),
    isBase64Encoded: false,
  });

  assert.equal(response.statusCode, 201);
  assert.equal(response.headers['Content-Type'], 'application/json; charset=utf-8');
  assert.deepEqual(response.multiValueHeaders['Set-Cookie'], ['probe=1; Path=/; HttpOnly']);
  assert.deepEqual(JSON.parse(response.body), {
    method: 'POST',
    token: 'probe-123',
    query: 'safe',
    body: { ok: true },
    host: 'fitwithpulse.ai',
    remoteAddress: '203.0.113.44',
  });
});

test('firebase-next-api resolves the public api path when originalPath is missing', async () => {
  const proxyModule = loadProxyModule();
  const handler = proxyModule.__test.createFirebaseNextApiHandler([
    {
      pattern: '/api/example/[token]',
      async loadHandler() {
        return {
          default: async (req, res) => res.status(200).json({
            token: req.query.token,
            query: req.query.mode,
            url: req.url,
          }),
        };
      },
    },
  ]);

  const response = await handler({
    httpMethod: 'GET',
    path: '/api/example/probe-456',
    rawUrl: 'https://fitwithpulse.ai/api/example/probe-456?mode=live',
    headers: {
      host: 'fitwithpulse.ai',
    },
    queryStringParameters: {
      mode: 'live',
    },
    body: null,
    isBase64Encoded: false,
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(JSON.parse(response.body), {
    token: 'probe-456',
    query: 'live',
    url: '/api/example/probe-456?mode=live',
  });
});
