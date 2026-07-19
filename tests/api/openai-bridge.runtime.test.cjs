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
  const tscPath = path.join(
    repoRoot,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsc.cmd' : 'tsc',
  );
  const compileArgs = [
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

  const result = spawnSync(tscPath, compileArgs, {
    cwd: repoRoot,
    encoding: 'utf8',
  });

  const candidatePath = [
    path.join(outDir, 'openai-bridge.js'),
    path.join(outDir, 'netlify/functions/openai-bridge.js'),
  ].find((candidate) => fs.existsSync(candidate));
  if (!candidatePath) {
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
  const keys = ['OPENAI_API_KEY', 'OPEN_AI_SECRET_KEY', 'OPENAI_BRIDGE_FALLBACK_ORIGIN', 'NEXT_PUBLIC_SITE_URL'];
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
    assert.equal(body.error.code, 'AI_BRIDGE_UNAVAILABLE');
    assert.match(body.error.message, /couldn't complete/i);
    assert.ok(body.error.incidentId);
  });
});

test('openai-bridge relays local dev calls to the deployed bridge when no local provider key is configured', async () => {
  await withPatchedEnvironment({
    OPENAI_API_KEY: null,
    OPEN_AI_SECRET_KEY: null,
    OPENAI_BRIDGE_FALLBACK_ORIGIN: 'https://fitwithpulse.ai',
  }, async () => {
    const fetchCalls = [];
    global.fetch = async (url, options) => {
      fetchCalls.push({ url, options });
      return {
        ok: true,
        status: 200,
        async text() {
          return JSON.stringify({ choices: [{ message: { content: 'ok' } }] });
        },
        headers: {
          get(name) {
            return name.toLowerCase() === 'content-type' ? 'application/json' : null;
          },
        },
      };
    };

    const { handler } = loadOpenAIBridgeRuntime(createFirebaseMock());
    const response = await handler({
      httpMethod: 'POST',
      path: '/api/openai/v1/chat/completions',
      headers: {
        host: 'localhost:8888',
        authorization: 'Bearer firebase-id-token',
        'openai-organization': 'pulsecheckSportIntelligence',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'seed gymnastics' }],
      }),
    });

    assert.equal(response.statusCode, 200);
    assert.equal(fetchCalls.length, 1);
    assert.equal(fetchCalls[0].url, 'https://fitwithpulse.ai/api/openai/v1/chat/completions');
    assert.equal(fetchCalls[0].options.headers.Authorization, 'Bearer firebase-id-token');
    assert.equal(fetchCalls[0].options.headers['openai-organization'], 'generateWorkout');
    assert.equal(fetchCalls[0].options.headers['x-pulsecheck-original-openai-organization'], 'pulsecheckSportIntelligence');
    assert.equal(fetchCalls[0].options.headers['x-pulsecheck-firebase-mode'], 'prod');
  });
});

test('openai-bridge relays local PulseCheck SFX calls through the deployed structured-JSON policy', async () => {
  await withPatchedEnvironment({
    OPENAI_API_KEY: null,
    OPEN_AI_SECRET_KEY: null,
    OPENAI_BRIDGE_FALLBACK_ORIGIN: 'https://fitwithpulse.ai',
  }, async () => {
    const fetchCalls = [];
    global.fetch = async (url, options) => {
      fetchCalls.push({ url, options });
      return {
        ok: true,
        status: 200,
        async text() {
          return JSON.stringify({ choices: [{ message: { content: '{"layers":[]}' } }] });
        },
        headers: {
          get(name) {
            return name.toLowerCase() === 'content-type' ? 'application/json' : null;
          },
        },
      };
    };

    const { handler } = loadOpenAIBridgeRuntime(createFirebaseMock());
    const response = await handler({
      httpMethod: 'POST',
      path: '/api/openai/v1/chat/completions',
      headers: {
        host: 'localhost:8888',
        authorization: 'Bearer firebase-id-token',
        'openai-organization': 'pulsecheckSoundEffects',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-5-mini',
        response_format: { type: 'json_object' },
        max_completion_tokens: 4000,
        messages: [{ role: 'user', content: 'Design a UI sound recipe.' }],
      }),
    });

    assert.equal(response.statusCode, 200);
    assert.equal(fetchCalls.length, 1);
    assert.equal(fetchCalls[0].options.headers['openai-organization'], 'noraRoutineGeneration');
    assert.equal(fetchCalls[0].options.headers['x-pulsecheck-original-openai-organization'], 'pulsecheckSoundEffects');
  });
});

test('openai-bridge falls back to OPEN_AI_SECRET_KEY and caps tokens by feature policy', async () => {
  await withPatchedEnvironment({
    OPENAI_API_KEY: '',
    OPEN_AI_SECRET_KEY: 'server-secret-key',
  }, async () => {
    const fetchCalls = [];
    global.fetch = async (url, options) => {
      fetchCalls.push({ url, options });
      return {
        ok: true,
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

test('openai-bridge allows timeout-aware gpt-5-mini routine generation', async () => {
  await withPatchedEnvironment({
    OPENAI_API_KEY: 'server-openai-key',
    OPEN_AI_SECRET_KEY: null,
  }, async () => {
    const fetchCalls = [];
    global.fetch = async (url, options) => {
      fetchCalls.push({ url, options });
      return {
        ok: true,
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

    const { handler } = loadOpenAIBridgeRuntime(createFirebaseMock('coach-1'));
    const response = await handler({
      httpMethod: 'POST',
      path: '/api/openai/v1/chat/completions',
      headers: {
        authorization: 'Bearer firebase-id-token',
        'OpenAI-Organization': 'noraRoutineGeneration',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-5-mini',
        messages: [{ role: 'user', content: 'generate a full routine' }],
        max_completion_tokens: 20000,
      }),
    });

    assert.equal(response.statusCode, 200);
    assert.equal(fetchCalls.length, 1);

    const forwardedBody = JSON.parse(fetchCalls[0].options.body);
    assert.equal(forwardedBody.model, 'gpt-5-mini');
    assert.equal(forwardedBody.max_completion_tokens, 8000);
  });
});

test('openai-bridge allows PulseCheck procedural sound-recipe generation', async () => {
  await withPatchedEnvironment({
    OPENAI_API_KEY: 'server-openai-key',
    OPEN_AI_SECRET_KEY: null,
  }, async () => {
    const fetchCalls = [];
    const recipe = JSON.stringify({
      masterGain: 0.6,
      layers: [{ source: 'oscillator', waveform: 'sine', frequencyStartHz: 500, frequencyEndHz: 300 }],
    });
    global.fetch = async (url, options) => {
      fetchCalls.push({ url, options });
      return {
        ok: true,
        status: 200,
        async text() {
          return JSON.stringify({
            choices: [{ message: { content: recipe } }],
          });
        },
        headers: {
          get(name) {
            return name.toLowerCase() === 'content-type' ? 'application/json' : null;
          },
        },
      };
    };

    const { handler } = loadOpenAIBridgeRuntime(createFirebaseMock('sound-admin-1'));
    const response = await handler({
      httpMethod: 'POST',
      path: '/api/openai/v1/chat/completions',
      headers: {
        authorization: 'Bearer firebase-id-token',
        'OpenAI-Organization': 'pulsecheckSoundEffects',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-5-mini',
        response_format: { type: 'json_object' },
        messages: [{ role: 'user', content: 'Design a soft UI chime synthesis recipe.' }],
        max_completion_tokens: 5000,
      }),
    });

    assert.equal(response.statusCode, 200);
    assert.equal(fetchCalls.length, 1);
    assert.equal(fetchCalls[0].url, 'https://api.openai.com/v1/chat/completions');

    const forwardedBody = JSON.parse(fetchCalls[0].options.body);
    assert.equal(forwardedBody.model, 'gpt-5-mini');
    assert.deepEqual(forwardedBody.response_format, { type: 'json_object' });
    assert.equal(forwardedBody.modalities, undefined);
    assert.equal(forwardedBody.audio, undefined);
    assert.equal(forwardedBody.max_completion_tokens, 4000);

    const responseBody = JSON.parse(response.body);
    assert.equal(responseBody.choices[0].message.content, recipe);
  });
});

test('openai-bridge wraps non-json upstream responses for SDK clients', async () => {
  await withPatchedEnvironment({
    OPENAI_API_KEY: 'server-openai-key',
    OPEN_AI_SECRET_KEY: null,
  }, async () => {
    global.fetch = async () => ({
      ok: false,
      status: 504,
      async text() {
        return '<html><body>Gateway timeout</body></html>';
      },
      headers: {
        get(name) {
          return name.toLowerCase() === 'content-type' ? 'text/html; charset=utf-8' : null;
        },
      },
    });

    const { handler } = loadOpenAIBridgeRuntime(createFirebaseMock('coach-1'));
    const response = await handler({
      httpMethod: 'POST',
      path: '/api/openai/v1/chat/completions',
      headers: {
        authorization: 'Bearer firebase-id-token',
        'OpenAI-Organization': 'noraRoutineGeneration',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-5-mini',
        messages: [{ role: 'user', content: 'generate a full routine' }],
        max_completion_tokens: 12000,
      }),
    });

    assert.equal(response.statusCode, 504);
    assert.equal(response.headers['Content-Type'], 'application/json');

    const body = JSON.parse(response.body);
    assert.equal(body.error.code, 'AI_ANALYZER_UNAVAILABLE');
    assert.match(body.error.message, /couldn't complete/i);
    assert.ok(body.error.incidentId);
    assert.equal(body.upstreamStatus, undefined);
    assert.equal(body.upstreamBodyPreview, undefined);
  });
});
