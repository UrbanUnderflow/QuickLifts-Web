const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Module = require('node:module');
const { spawnSync } = require('node:child_process');

const repoRoot = '/Users/tremainegrant/Documents/GitHub/QuickLifts-Web';

let compiledStatusPath = null;

function compileStatusRuntime() {
  if (compiledStatusPath) return compiledStatusPath;

  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ql-nora-status-runtime-'));
  const result = spawnSync('npx', [
    'tsc',
    '--module', 'commonjs',
    '--target', 'es2020',
    '--moduleResolution', 'node',
    '--esModuleInterop',
    '--allowJs',
    '--skipLibCheck',
    '--pretty', 'false',
    '--outDir', outDir,
    path.join(repoRoot, 'netlify/functions/nora-routine-generation-status.ts'),
  ], {
    cwd: repoRoot,
    encoding: 'utf8',
  });

  const candidatePath = [
    path.join(outDir, 'nora-routine-generation-status.js'),
    path.join(outDir, 'netlify/functions/nora-routine-generation-status.js'),
  ].find((candidate) => fs.existsSync(candidate));

  if (!candidatePath) {
    throw new Error(`Failed to compile nora-routine-generation-status runtime:\n${result.stderr || result.stdout || 'Unknown tsc failure'}`);
  }

  compiledStatusPath = candidatePath;
  return compiledStatusPath;
}

function loadStatusRuntime(firebaseMock) {
  const statusPath = compileStatusRuntime();
  delete require.cache[statusPath];

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
    return require(statusPath);
  } finally {
    Module._load = originalLoad;
  }
}

function createFirebaseMock(jobData, uid = 'coach-1') {
  return {
    admin: {
      auth() {
        return {
          async verifyIdToken(token) {
            if (!token) throw new Error('Missing token');
            return { uid };
          },
        };
      },
      firestore() {
        return {
          collection(collectionName) {
            assert.equal(collectionName, 'noraRoutineGenerationJobs');
            return {
              doc(jobId) {
                assert.equal(jobId, 'job-1');
                return {
                  async get() {
                    return {
                      exists: Boolean(jobData),
                      data() {
                        return jobData;
                      },
                    };
                  },
                };
              },
            };
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

test('nora routine generation status normalizes null system_fingerprint for iOS', async () => {
  const jobData = {
    ownerId: 'coach-1',
    status: 'succeeded',
    result: {
      id: 'chatcmpl-test',
      object: 'chat.completion',
      created: 1777868117,
      model: 'gpt-5-mini',
      system_fingerprint: null,
      choices: [
        {
          index: 0,
          message: { role: 'assistant', content: '{"sessions":[]}' },
          finish_reason: 'stop',
        },
      ],
    },
  };

  const { handler } = loadStatusRuntime(createFirebaseMock(jobData));
  const response = await handler({
    httpMethod: 'GET',
    path: '/.netlify/functions/nora-routine-generation-status',
    headers: {
      authorization: 'Bearer firebase-id-token',
    },
    queryStringParameters: {
      jobId: 'job-1',
    },
  });

  assert.equal(response.statusCode, 200);
  const body = JSON.parse(response.body);
  assert.equal(body.status, 'succeeded');
  assert.equal(body.result.system_fingerprint, '');
});
