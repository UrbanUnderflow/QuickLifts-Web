const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Module = require('node:module');
const { spawnSync } = require('node:child_process');

const repoRoot = '/Users/tremainegrant/Documents/GitHub/QuickLifts-Web';

let compiledBridgePath = null;

function compileOpenAIBridgeRuntime() {
  if (compiledBridgePath) {
    return compiledBridgePath;
  }

  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ql-openai-bridge-runtime-'));
  const compileArgs = [
    'tsc',
    '--module', 'commonjs',
    '--target', 'es2020',
    '--moduleResolution', 'node',
    '--esModuleInterop',
    '--allowJs',
    '--skipLibCheck',
    '--pretty', 'false',
    '--outDir', outDir,
    path.join(repoRoot, 'netlify/functions/openai-bridge.ts'),
  ];

  const result = spawnSync('npx', compileArgs, {
    cwd: repoRoot,
    encoding: 'utf8',
  });

  const candidatePath = path.join(outDir, 'openai-bridge.js');
  if (!fs.existsSync(candidatePath)) {
    throw new Error(`Failed to compile openai-bridge runtime:\n${result.stderr || result.stdout || 'Unknown tsc failure'}`);
  }

  compiledBridgePath = candidatePath;
  return compiledBridgePath;
}

function loadOpenAIBridgeRuntime(firebaseMock) {
  const bridgePath = compileOpenAIBridgeRuntime();
  delete require.cache[bridgePath];

  const originalLoad = Module._load;
  Module._load = function patchedLoad(request, parent, isMain) {
    if (
      request === './config/firebase' ||
      request.endsWith('/config/firebase') ||
      request.endsWith('/config/firebase.js')
    ) {
      return firebaseMock;
    }
    return originalLoad.call(this, request, parent, isMain);
  };

  try {
    return require(bridgePath);
  } finally {
    Module._load = originalLoad;
  }
}

function createFirebaseMock(uid = 'user-1') {
  return {
    admin: {
      auth() {
        return {
          async verifyIdToken(token) {
            if (!token) {
              throw new Error('Missing token');
            }
            return { uid };
          },
        };
      },
    },
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    },
  };
}

async function withPatchedEnvironment(patch, run) {
  const keys = ['OPENAI_API_KEY', 'OPEN_AI_SECRET_KEY', 'OPENAI_MAX_TOKENS'];
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));

  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(patch, key)) {
      const value = patch[key];
      if (value == null) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    } else {
      delete process.env[key];
    }
  }

  const originalFetch = global.fetch;

  try {
    return await run();
  } finally {
    global.fetch = originalFetch;
    for (const key of keys) {
      const value = previous[key];
      if (value == null) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

test('openai-bridge returns a clear 500 when no server-side provider key is configured', async () => {
  await withPatchedEnvironment({
    OPENAI_API_KEY: null,
    OPEN_AI_SECRET_KEY: null,
    OPENAI_MAX_TOKENS: null,
  }, async () => {
    let fetchCalled = false;
    global.fetch = async () => {
      fetchCalled = true;
      throw new Error('fetch should not be called when the bridge is misconfigured');
    };

    const { handler } = loadOpenAIBridgeRuntime(createFirebaseMock());
    const response = await handler({
      httpMethod: 'POST',
      path: '/api/openai/v1/chat/completions',
      headers: {
        Authorization: 'Bearer firebase-id-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'hello' }],
      }),
    });

    assert.equal(response.statusCode, 500);
    assert.equal(fetchCalled, false);

    const body = JSON.parse(response.body);
    assert.match(body.error, /missing OPENAI_API_KEY or OPEN_AI_SECRET_KEY/i);
  });
});

test('openai-bridge falls back to OPEN_AI_SECRET_KEY and caps tokens by feature policy', async () => {
  await withPatchedEnvironment({
    OPENAI_API_KEY: '',
    OPEN_AI_SECRET_KEY: 'server-secret-key',
    OPENAI_MAX_TOKENS: '1800',
  }, async () => {
    const fetchCalls = [];
    global.fetch = async (url, options) => {
      fetchCalls.push({ url, options });
      return {
        status: 200,
        async text() {
          return JSON.stringify({ ok: true });
        },
        headers: {
          get(name) {
            return name.toLowerCase() === 'content-type' ? 'application/json' : null;
          },
        },
      };
    };

    const { handler } = loadOpenAIBridgeRuntime(createFirebaseMock('user-42'));
    const response = await handler({
      httpMethod: 'POST',
      path: '/api/openai/v1/chat/completions',
      headers: {
        authorization: 'Bearer firebase-id-token',
        'OpenAI-Organization': 'scanFood',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'analyze this meal' }],
        max_tokens: 2500,
      }),
    });

    assert.equal(response.statusCode, 200);
    assert.equal(fetchCalls.length, 1);
    assert.equal(fetchCalls[0].url, 'https://api.openai.com/v1/chat/completions');
    assert.equal(fetchCalls[0].options.headers.Authorization, 'Bearer server-secret-key');
    assert.equal(fetchCalls[0].options.headers['Content-Type'], 'application/json');

    const forwardedBody = JSON.parse(fetchCalls[0].options.body);
    assert.equal(forwardedBody.max_tokens, 1500);
    assert.equal(forwardedBody.model, 'gpt-4o');
  });
});
