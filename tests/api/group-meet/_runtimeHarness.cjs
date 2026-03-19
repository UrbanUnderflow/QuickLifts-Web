const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Module = require('node:module');
const { spawnSync } = require('node:child_process');

const repoRoot = '/Users/tremainegrant/Documents/GitHub/QuickLifts-Web';

let compiledRuntimeCache = null;

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function findFileRecursive(rootDir, fileName) {
  const stack = [rootDir];

  while (stack.length > 0) {
    const current = stack.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const nextPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(nextPath);
        continue;
      }
      if (entry.isFile() && entry.name === fileName) {
        return nextPath;
      }
    }
  }

  return null;
}

function compileGroupMeetRuntime() {
  if (compiledRuntimeCache) {
    return compiledRuntimeCache;
  }

  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ql-group-meet-runtime-'));
  const compileArgs = [
    'tsc',
    '--module', 'commonjs',
    '--target', 'es2020',
    '--moduleResolution', 'node',
    '--esModuleInterop',
    '--skipLibCheck',
    '--pretty', 'false',
    '--outDir', outDir,
    path.join(repoRoot, 'src/lib/groupMeet.ts'),
    path.join(repoRoot, 'src/lib/googleCalendar.ts'),
    path.join(repoRoot, 'src/pages/api/admin/group-meet/[requestId].ts'),
  ];

  const result = spawnSync('npx', compileArgs, {
    cwd: repoRoot,
    encoding: 'utf8',
  });

  const groupMeetPath = findFileRecursive(outDir, 'groupMeet.js');
  const googleCalendarPath = findFileRecursive(outDir, 'googleCalendar.js');
  const requestHandlerPath = findFileRecursive(outDir, '[requestId].js');

  if ((!groupMeetPath || !googleCalendarPath || !requestHandlerPath) && result.status !== 0) {
    throw new Error(
      `Failed to compile Group Meet runtime:\n${result.stderr || result.stdout || 'Unknown tsc failure'}`
    );
  }

  if (!groupMeetPath || !googleCalendarPath || !requestHandlerPath) {
    throw new Error('Compiled Group Meet runtime files were not emitted to the temp directory.');
  }

  compiledRuntimeCache = {
    outDir,
    groupMeetPath,
    googleCalendarPath,
    requestHandlerPath,
  };

  return compiledRuntimeCache;
}

function withModuleMocks(mocks, loadFn) {
  const originalLoad = Module._load;

  Module._load = function patchedLoad(request, parent, isMain) {
    if (Object.prototype.hasOwnProperty.call(mocks, request)) {
      return mocks[request];
    }
    return originalLoad.call(this, request, parent, isMain);
  };

  try {
    return loadFn();
  } finally {
    Module._load = originalLoad;
  }
}

function loadGroupMeetRuntime() {
  const { groupMeetPath } = compileGroupMeetRuntime();
  delete require.cache[groupMeetPath];
  return require(groupMeetPath);
}

function loadGoogleCalendarRuntime({ secretManagerMock } = {}) {
  const { googleCalendarPath } = compileGroupMeetRuntime();
  delete require.cache[googleCalendarPath];

  return withModuleMocks(
    {
      'google-auth-library': {
        JWT: class MockJwt {},
        OAuth2Client: class MockOAuth2Client {},
      },
      './secretManager': {
        getSecretManagerSecret:
          secretManagerMock || (async () => {
            throw new Error('Secret Manager mock not provided.');
          }),
      },
    },
    () => require(googleCalendarPath)
  );
}

function makeTimestamp(isoString) {
  return {
    toDate() {
      return new Date(isoString);
    },
  };
}

function createRequestDetailHandlerRuntime({ requestData, inviteDocs, setupStatus }) {
  const { requestHandlerPath } = compileGroupMeetRuntime();
  delete require.cache[requestHandlerPath];

  const state = {
    requestData: clone(requestData),
    updates: [],
  };

  const requestRef = {
    id: 'request-1',
    async get() {
      return {
        exists: true,
        id: 'request-1',
        data: () => clone(state.requestData),
      };
    },
    async set(payload, options = {}) {
      const nextPayload = clone(payload);
      state.updates.push({ payload: nextPayload, options: clone(options) });
      state.requestData = options && options.merge
        ? { ...state.requestData, ...nextPayload }
        : nextPayload;
    },
    collection(name) {
      if (name !== 'groupMeetInvites') {
        throw new Error(`Unexpected collection: ${name}`);
      }

      return {
        orderBy() {
          return this;
        },
        async get() {
          return {
            docs: inviteDocs.map((inviteDoc) => ({
              id: inviteDoc.id,
              data: () => clone(inviteDoc.data),
            })),
          };
        },
      };
    },
  };

  const firebaseAdminMock = {
    firestore() {
      return {
        collection(name) {
          if (name !== 'groupMeetRequests') {
            throw new Error(`Unexpected top-level collection: ${name}`);
          }

          return {
            doc(id) {
              if (id !== 'request-1') {
                throw new Error(`Unexpected request id: ${id}`);
              }

              return requestRef;
            },
          };
        },
        FieldValue: {
          serverTimestamp() {
            return { __serverTimestamp: true };
          },
        },
        Timestamp: {
          fromDate(date) {
            return makeTimestamp(date.toISOString());
          },
        },
      };
    },
  };

  firebaseAdminMock.firestore.FieldValue = {
    serverTimestamp() {
      return { __serverTimestamp: true };
    },
  };
  firebaseAdminMock.firestore.Timestamp = {
    fromDate(date) {
      return makeTimestamp(date.toISOString());
    },
  };

  const groupMeetAdminMock = {
    GROUP_MEET_INVITES_SUBCOLLECTION: 'groupMeetInvites',
    GROUP_MEET_REQUESTS_COLLECTION: 'groupMeetRequests',
    toIso(value) {
      return value?.toDate?.().toISOString?.() || null;
    },
    mapGroupMeetInviteDetail(docSnap) {
      const data = docSnap.data() || {};
      return {
        token: docSnap.id,
        name: data.name || '',
        email: data.email || null,
        shareUrl: data.shareUrl || '',
        emailStatus: data.emailStatus || 'not_sent',
        emailError: data.emailError || null,
        respondedAt: data.responseSubmittedAt?.toDate?.().toISOString?.() || null,
        availabilityCount: Array.isArray(data.availabilityEntries) ? data.availabilityEntries.length : 0,
        availabilityEntries: Array.isArray(data.availabilityEntries) ? clone(data.availabilityEntries) : [],
      };
    },
  };

  const handlerModule = withModuleMocks(
    {
      '../../../../lib/firebase-admin': firebaseAdminMock,
      '../../../../lib/googleCalendar': {
        getGoogleCalendarSetupStatus: async () => clone(setupStatus),
      },
      '../../../../lib/groupMeetAdmin': groupMeetAdminMock,
      '../_auth': {
        requireAdminRequest: async () => ({ email: 'admin@fitwithpulse.ai' }),
      },
    },
    () => require(requestHandlerPath)
  );

  return {
    handler: handlerModule.default,
    state,
  };
}

function createApiResponseRecorder() {
  return {
    statusCode: 200,
    payload: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.payload = payload;
      return this;
    },
  };
}

module.exports = {
  createApiResponseRecorder,
  createRequestDetailHandlerRuntime,
  loadGoogleCalendarRuntime,
  loadGroupMeetRuntime,
  makeTimestamp,
};
