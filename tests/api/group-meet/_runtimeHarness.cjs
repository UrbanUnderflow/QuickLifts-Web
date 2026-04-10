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

function findFileRecursiveBySuffix(rootDir, suffix) {
  const normalizedSuffix = suffix.split(path.sep).join('/');
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
      if (entry.isFile() && nextPath.split(path.sep).join('/').endsWith(normalizedSuffix)) {
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
    path.join(repoRoot, 'src/lib/groupMeetGuestGoogleCalendar.ts'),
    path.join(repoRoot, 'src/pages/api/group-meet/[token].ts'),
    path.join(repoRoot, 'src/pages/api/group-meet/flex/[token].ts'),
    path.join(repoRoot, 'src/pages/api/group-meet/[token]/calendar/google/connect/start.ts'),
    path.join(repoRoot, 'src/pages/api/admin/group-meet/index.ts'),
    path.join(repoRoot, 'src/pages/api/admin/group-meet/[requestId].ts'),
  ];

  const result = spawnSync('npx', compileArgs, {
    cwd: repoRoot,
    encoding: 'utf8',
  });

  const groupMeetPath = findFileRecursive(outDir, 'groupMeet.js');
  const googleCalendarPath = findFileRecursive(outDir, 'googleCalendar.js');
  const guestGoogleCalendarPath = findFileRecursive(outDir, 'groupMeetGuestGoogleCalendar.js');
  const publicInviteHandlerPath = findFileRecursiveBySuffix(outDir, 'pages/api/group-meet/[token].js');
  const flexHandlerPath = findFileRecursiveBySuffix(outDir, 'pages/api/group-meet/flex/[token].js');
  const connectStartHandlerPath = findFileRecursiveBySuffix(
    outDir,
    'pages/api/group-meet/[token]/calendar/google/connect/start.js'
  );
  const createHandlerPath = findFileRecursiveBySuffix(outDir, 'pages/api/admin/group-meet/index.js');
  const requestHandlerPath = findFileRecursive(outDir, '[requestId].js');

  if (
    (
      !groupMeetPath ||
      !googleCalendarPath ||
      !guestGoogleCalendarPath ||
      !publicInviteHandlerPath ||
      !flexHandlerPath ||
      !connectStartHandlerPath ||
      !createHandlerPath ||
      !requestHandlerPath
    ) &&
    result.status !== 0
  ) {
    throw new Error(
      `Failed to compile Group Meet runtime:\n${result.stderr || result.stdout || 'Unknown tsc failure'}`
    );
  }

  if (
    !groupMeetPath ||
    !googleCalendarPath ||
    !guestGoogleCalendarPath ||
    !publicInviteHandlerPath ||
    !flexHandlerPath ||
    !connectStartHandlerPath ||
    !createHandlerPath ||
    !requestHandlerPath
  ) {
    throw new Error('Compiled Group Meet runtime files were not emitted to the temp directory.');
  }

  compiledRuntimeCache = {
    outDir,
    groupMeetPath,
    googleCalendarPath,
    guestGoogleCalendarPath,
    publicInviteHandlerPath,
    flexHandlerPath,
    connectStartHandlerPath,
    createHandlerPath,
    requestHandlerPath,
  };

  return compiledRuntimeCache;
}

function clearCompiledRuntimeModuleCache() {
  const { outDir } = compileGroupMeetRuntime();
  for (const cacheKey of Object.keys(require.cache)) {
    if (cacheKey.startsWith(outDir)) {
      delete require.cache[cacheKey];
    }
  }
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
  clearCompiledRuntimeModuleCache();
  return require(groupMeetPath);
}

function loadGoogleCalendarRuntime({ secretManagerMock } = {}) {
  const { googleCalendarPath } = compileGroupMeetRuntime();
  clearCompiledRuntimeModuleCache();

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

function loadGuestGoogleCalendarRuntime({ secretManagerMock, OAuth2ClientMock } = {}) {
  const { guestGoogleCalendarPath } = compileGroupMeetRuntime();
  clearCompiledRuntimeModuleCache();

  return withModuleMocks(
    {
      './secretManager': {
        getSecretManagerSecret:
          secretManagerMock || (async () => {
            throw new Error('Secret Manager mock not provided.');
          }),
      },
      'google-auth-library': {
        OAuth2Client:
          OAuth2ClientMock ||
          class DefaultMockOAuth2Client {
            constructor(options) {
              this.options = options;
            }

            generateAuthUrl() {
              return 'https://accounts.google.com/o/oauth2/v2/auth';
            }
          },
      },
    },
    () => require(guestGoogleCalendarPath)
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
  clearCompiledRuntimeModuleCache();

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

  const firestoreInstance = {
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

  function firestore() {
    return firestoreInstance;
  }

  const firebaseAdminMock = {
    firestore,
    getFirebaseAdminApp() {
      return { firestore };
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
        emailedAt: data.emailedAt?.toDate?.().toISOString?.() || null,
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

function createGroupMeetCreateHandlerRuntime({
  adminEmail = 'admin@fitwithpulse.ai',
  baseUrl = 'https://app.fitwithpulse.ai',
  sendInviteEmailResult = async () => ({ success: true }),
  contacts = {
    'contact-host': {
      id: 'contact-host',
      name: 'Tre',
      email: 'tre@fitwithpulse.ai',
      imageUrl: 'https://images.example.com/tre.png',
    },
    'contact-avery': {
      id: 'contact-avery',
      name: 'Avery',
      email: 'avery@example.com',
      imageUrl: 'https://images.example.com/avery.png',
    },
  },
} = {}) {
  const { createHandlerPath } = compileGroupMeetRuntime();
  clearCompiledRuntimeModuleCache();

  const state = {
    requestData: null,
    inviteDocs: new Map(),
    emailCalls: [],
    contacts: clone(contacts),
  };

  let requestIdCounter = 0;

  function cloneForStorage(value) {
    if (value == null) return value;
    if (Array.isArray(value)) {
      return value.map(cloneForStorage);
    }
    if (typeof value === 'object') {
      if (typeof value.toDate === 'function') {
        return value;
      }
      const next = {};
      for (const [key, child] of Object.entries(value)) {
        next[key] = cloneForStorage(child);
      }
      return next;
    }
    return value;
  }

  function createInviteRef(token) {
    return {
      id: token,
      path: ['groupMeetRequests', 'request-1', 'groupMeetInvites', token],
      async set(payload, options = {}) {
        const existing = state.inviteDocs.get(token) || {};
        const nextPayload = cloneForStorage(payload);
        state.inviteDocs.set(
          token,
          options && options.merge ? { ...existing, ...nextPayload } : nextPayload
        );
      },
    };
  }

  const requestRef = {
    id: 'request-1',
    collection(name) {
      if (name !== 'groupMeetInvites') {
        throw new Error(`Unexpected collection: ${name}`);
      }
      return {
        doc(token) {
          return createInviteRef(token);
        },
      };
    },
  };

  const firestoreInstance = {
    collection(name) {
      if (name === 'groupMeetRequests') {
        return {
          doc() {
            requestIdCounter += 1;
            if (requestIdCounter > 1) {
              throw new Error('Unexpected extra request document creation.');
            }
            return requestRef;
          },
          orderBy() {
            return this;
          },
          limit() {
            return this;
          },
          async get() {
            return { docs: [] };
          },
        };
      }

      if (name === 'groupMeetContacts') {
        return {
          doc(contactId) {
            return {
              id: contactId,
              async get() {
                const contact = state.contacts[contactId];
                return {
                  id: contactId,
                  exists: Boolean(contact),
                  data: () => clone(contact),
                };
              },
            };
          },
        };
      }

      throw new Error(`Unexpected top-level collection: ${name}`);
    },
    batch() {
      const operations = [];
      return {
        set(ref, payload, options = {}) {
          operations.push({
            ref,
            payload: cloneForStorage(payload),
            options: clone(options),
          });
        },
        async commit() {
          for (const operation of operations) {
            if (operation.ref === requestRef) {
              state.requestData = operation.options && operation.options.merge && state.requestData
                ? { ...state.requestData, ...operation.payload }
                : operation.payload;
              continue;
            }

            const token = operation.ref.id;
            const existing = state.inviteDocs.get(token) || {};
            state.inviteDocs.set(
              token,
              operation.options && operation.options.merge
                ? { ...existing, ...operation.payload }
                : operation.payload
            );
          }
        },
      };
    },
  };

  function firestore() {
    return firestoreInstance;
  }

  firestore.Timestamp = {
    fromDate(date) {
      return makeTimestamp(date.toISOString());
    },
  };
  firestore.FieldValue = {
    serverTimestamp() {
      return { __serverTimestamp: true };
    },
  };

  const firebaseAdminMock = {
    firestore,
    getFirebaseAdminApp() {
      return { firestore };
    },
  };

  const groupMeetAdminMock = {
    GROUP_MEET_CONTACTS_COLLECTION: 'groupMeetContacts',
    GROUP_MEET_INVITES_SUBCOLLECTION: 'groupMeetInvites',
    GROUP_MEET_REQUESTS_COLLECTION: 'groupMeetRequests',
    getGroupMeetBaseUrl() {
      return baseUrl;
    },
    mapGroupMeetContact(docSnap) {
      const data = docSnap.data() || {};
      return {
        id: docSnap.id,
        name: data.name || '',
        email: data.email || null,
        imageUrl: data.imageUrl || null,
        createdAt: data.createdAt?.toDate?.().toISOString?.() || null,
        updatedAt: data.updatedAt?.toDate?.().toISOString?.() || null,
        createdByEmail: data.createdByEmail || null,
      };
    },
    mapGroupMeetInviteSummary(docSnap) {
      const data = docSnap.data() || {};
      return {
        token: docSnap.id,
        name: data.name || '',
        email: data.email || null,
        imageUrl: data.imageUrl || null,
        participantType: data.participantType === 'host' ? 'host' : 'participant',
        contactId: data.contactId || null,
        shareUrl: data.shareUrl || '',
        emailStatus: data.emailStatus || 'not_sent',
        emailedAt: data.emailedAt?.toDate?.().toISOString?.() || null,
        emailError: data.emailError || null,
        respondedAt: data.responseSubmittedAt?.toDate?.().toISOString?.() || null,
        availabilityCount: Array.isArray(data.availabilityEntries) ? data.availabilityEntries.length : 0,
      };
    },
    sendGroupMeetInviteEmail: async (args) => {
      state.emailCalls.push(clone(args));
      return sendInviteEmailResult(args);
    },
    toIso(value) {
      return value?.toDate?.().toISOString?.() || null;
    },
  };

  const handlerModule = withModuleMocks(
    {
      '../../../../lib/firebase-admin': firebaseAdminMock,
      '../../../../lib/groupMeetAdmin': groupMeetAdminMock,
      '../_auth': {
        requireAdminRequest: async () => ({ email: adminEmail }),
      },
    },
    () => require(createHandlerPath)
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

function createPublicInviteHandlerRuntime({
  requestData = {
    title: 'Group Meet',
    targetMonth: '2026-04',
    deadlineAt: makeTimestamp('2026-04-08T21:00:00.000Z'),
    timezone: 'America/New_York',
    meetingDurationMinutes: 60,
    status: 'draft',
  },
  inviteDocs = [
    {
      id: 'guest-token',
      data: {
        token: 'guest-token',
        name: 'Avery',
        email: 'avery@example.com',
        imageUrl: 'https://images.example.com/avery.png',
        participantType: 'participant',
        shareUrl: 'https://fitwithpulse.ai/group-meet/guest-token',
        availabilityEntries: [],
        responseSubmittedAt: null,
        hasResponse: false,
      },
    },
  ],
} = {}) {
  compiledRuntimeCache = null;
  const { publicInviteHandlerPath } = compileGroupMeetRuntime();
  clearCompiledRuntimeModuleCache();

  const state = {
    requestData: clone(requestData),
    inviteDocs: new Map(inviteDocs.map((inviteDoc) => [inviteDoc.id, clone(inviteDoc.data)])),
    firebaseAppSelections: [],
    hostNotificationCalls: [],
  };

  function createInviteSnapshot(id, data) {
    return {
      id,
      data: () => clone(data),
      ref: {
        id,
        parent: {
          parent: requestRef,
        },
        async get() {
          const current = state.inviteDocs.get(id) || {};
          return createInviteSnapshot(id, current);
        },
        async set(payload, options = {}) {
          const existing = state.inviteDocs.get(id) || {};
          const nextPayload = clone(payload);
          state.inviteDocs.set(id, options && options.merge ? { ...existing, ...nextPayload } : nextPayload);
        },
      },
    };
  }

  const requestRef = {
    id: 'request-1',
    async get() {
      return {
        exists: true,
        id: 'request-1',
        ref: requestRef,
        data: () => clone(state.requestData),
      };
    },
    async set(payload, options = {}) {
      const nextPayload = clone(payload);
      state.requestData = options && options.merge
        ? { ...state.requestData, ...nextPayload }
        : nextPayload;
    },
    collection(name) {
      if (name !== 'groupMeetInvites') {
        throw new Error(`Unexpected collection: ${name}`);
      }

      return {
        async get() {
          const docs = Array.from(state.inviteDocs.entries()).map(([id, inviteData]) =>
            createInviteSnapshot(id, inviteData)
          );

          return { docs, size: docs.length, empty: docs.length === 0 };
        },
        where(field, operator, value) {
          return {
            async get() {
              if (field !== 'hasResponse' || operator !== '==' || value !== true) {
                throw new Error(`Unexpected invite query: ${field} ${operator} ${value}`);
              }

              const docs = Array.from(state.inviteDocs.entries())
                .filter(([, inviteData]) => Boolean(inviteData.hasResponse))
                .map(([id, inviteData]) => createInviteSnapshot(id, inviteData));

              return { docs, size: docs.length, empty: docs.length === 0 };
            },
          };
        },
      };
    },
  };

  const firestoreInstance = {
    collectionGroup(name) {
      if (name !== 'groupMeetInvites') {
        throw new Error(`Unexpected collection group: ${name}`);
      }

      const queryState = {
        token: null,
      };

      return {
        where(field, operator, value) {
          if (field !== 'token' || operator !== '==') {
            throw new Error(`Unexpected collection group query: ${field} ${operator}`);
          }
          queryState.token = value;
          return this;
        },
        limit() {
          return this;
        },
        async get() {
          let docs = Array.from(state.inviteDocs.entries()).map(([id, inviteData]) =>
            createInviteSnapshot(id, inviteData)
          );

          if (queryState.token) {
            docs = docs.filter((docSnap) => {
              const data = docSnap.data() || {};
              return data.token === queryState.token || docSnap.id === queryState.token;
            });
          }

          return { docs, size: docs.length, empty: docs.length === 0 };
        },
      };
    },
  };

  function firestore() {
    return firestoreInstance;
  }

  firestore.FieldValue = {
    serverTimestamp() {
      return { __serverTimestamp: true };
    },
  };

  const firebaseAdminMock = {
    firestore,
    getFirebaseAdminApp(forceDevProject = false) {
      state.firebaseAppSelections.push(Boolean(forceDevProject));
      return { firestore };
    },
  };
  firebaseAdminMock.firestore.FieldValue = firestore.FieldValue;

  const groupMeetGuestGoogleCalendarMock = {
    GROUP_MEET_INVITES_SUBCOLLECTION: 'groupMeetInvites',
    buildGroupMeetGuestCalendarImportSummary(value) {
      const raw = value || null;
      if (!raw || raw.provider !== 'google') {
        return null;
      }

      return {
        provider: 'google',
        status: raw.status || 'disconnected',
        connectedAt: raw.connectedAt?.toDate?.().toISOString?.() || null,
        disconnectedAt: raw.disconnectedAt?.toDate?.().toISOString?.() || null,
        lastSyncedAt: raw.lastSyncedAt?.toDate?.().toISOString?.() || null,
        lastSyncStatus: raw.lastSyncStatus || 'never',
        lastSyncError: raw.lastSyncError || null,
        googleAccountEmail: raw.googleAccountEmail || null,
        connected: raw.status === 'connected',
        connectedEmail: raw.googleAccountEmail || null,
        lastConnectedAt: raw.connectedAt?.toDate?.().toISOString?.() || null,
        lastImportedAt: raw.lastSyncedAt?.toDate?.().toISOString?.() || null,
        error: raw.lastSyncError || null,
      };
    },
    findGroupMeetInviteByToken: async (db, token) => {
      let snapshot = await db.collectionGroup('groupMeetInvites').where('token', '==', token).limit(1).get();
      let inviteDoc = snapshot?.empty ? null : snapshot?.docs?.[0] || null;

      if (!inviteDoc) {
        snapshot = await db.collectionGroup('groupMeetInvites').get();
        inviteDoc =
          snapshot.docs.find((docSnap) => {
            const data = docSnap.data() || {};
            return docSnap.id === token || data.token === token;
          }) || null;
      }

      if (!inviteDoc) {
        return null;
      }

      return {
        inviteDoc,
        requestDoc: await requestRef.get(),
      };
    },
    shouldForceDevFirebase(req) {
      const hostHeader = req.headers?.host || '';
      const host = Array.isArray(hostHeader) ? hostHeader[0] || '' : hostHeader;
      const normalizedHost = String(host).trim().toLowerCase();
      return normalizedHost.startsWith('localhost:') || normalizedHost.startsWith('127.0.0.1:');
    },
    toIso(value) {
      return value?.toDate?.().toISOString?.() || null;
    },
  };

  const groupMeetAdminMock = {
    getGroupMeetBaseUrl() {
      return 'https://fitwithpulse.ai';
    },
    mapGroupMeetInviteDetail(docSnap, targetMonth) {
      const data = docSnap.data() || {};
      const availabilityEntries = Array.isArray(data.availabilityEntries)
        ? data.availabilityEntries
            .filter((slot) => typeof slot?.date === 'string' && slot.date.startsWith(`${targetMonth}-`))
            .map((slot) => ({
              date: slot.date,
              startMinutes: slot.startMinutes,
              endMinutes: slot.endMinutes,
            }))
        : [];

      return {
        token: docSnap.id,
        name: data.name || '',
        email: data.email || null,
        imageUrl: data.imageUrl || null,
        participantType: data.participantType === 'host' ? 'host' : 'participant',
        contactId: data.contactId || null,
        shareUrl: data.shareUrl || '',
        emailStatus: data.emailStatus || 'not_sent',
        emailedAt: data.emailedAt?.toDate?.().toISOString?.() || null,
        emailError: data.emailError || null,
        respondedAt: data.responseSubmittedAt?.toDate?.().toISOString?.() || null,
        availabilityCount: availabilityEntries.length,
        availabilityEntries,
      };
    },
    maybeNotifyGroupMeetHostAfterAvailabilitySave: async (args) => {
      state.hostNotificationCalls.push(clone(args));
      return { notified: true, mode: 'progress', skipped: false };
    },
  };

  const handlerModule = withModuleMocks(
    {
      '../../../lib/firebase-admin': firebaseAdminMock,
      '../../../lib/groupMeetGuestGoogleCalendar': groupMeetGuestGoogleCalendarMock,
      '../../../lib/groupMeetAdmin': groupMeetAdminMock,
      'google-auth-library': {
        OAuth2Client: class MockOAuth2Client {},
      },
    },
    () => require(publicInviteHandlerPath)
  );

  return {
    handler: handlerModule.default,
    state,
  };
}

function createPublicFlexHandlerRuntime({
  requestData = {
    title: 'Group Meet',
    targetMonth: '2026-04',
    deadlineAt: makeTimestamp('2026-04-08T21:00:00.000Z'),
    timezone: 'America/New_York',
    meetingDurationMinutes: 60,
    status: 'collecting',
  },
  inviteDocs = [
    {
      id: 'host-token',
      data: {
        token: 'host-token',
        name: 'Tremaine Grant',
        email: 'tre@fitwithpulse.ai',
        imageUrl: 'https://images.example.com/tre.png',
        participantType: 'host',
        shareUrl: 'https://fitwithpulse.ai/group-meet/host-token',
        availabilityEntries: [{ date: '2026-04-08', startMinutes: 540, endMinutes: 600 }],
        responseSubmittedAt: makeTimestamp('2026-03-31T12:00:00.000Z'),
        hasResponse: true,
      },
    },
    {
      id: 'guest-token',
      data: {
        token: 'guest-token',
        name: 'Avery',
        email: 'avery@example.com',
        imageUrl: 'https://images.example.com/avery.png',
        participantType: 'participant',
        shareUrl: 'https://fitwithpulse.ai/group-meet/guest-token',
        availabilityEntries: [],
        responseSubmittedAt: null,
        hasResponse: false,
      },
    },
  ],
  flexPayload = {
    requestId: 'request-1',
    inviteToken: 'guest-token',
    candidateKey: '2026-04-08|600',
    date: '2026-04-08',
    startMinutes: 600,
    endMinutes: 660,
    issuedAt: Date.now(),
  },
} = {}) {
  compiledRuntimeCache = null;
  const { flexHandlerPath } = compileGroupMeetRuntime();
  clearCompiledRuntimeModuleCache();

  const state = {
    requestData: clone(requestData),
    inviteDocs: new Map(inviteDocs.map((inviteDoc) => [inviteDoc.id, clone(inviteDoc.data)])),
    firebaseAppSelections: [],
    hostNotificationCalls: [],
  };

  function createInviteSnapshot(id, data) {
    const exists = state.inviteDocs.has(id);
    return {
      id,
      exists,
      data: () => clone(data),
      ref: {
        id,
        async get() {
          const current = state.inviteDocs.get(id) || {};
          return createInviteSnapshot(id, current);
        },
        async set(payload, options = {}) {
          const existing = state.inviteDocs.get(id) || {};
          const nextPayload = clone(payload);
          state.inviteDocs.set(id, options && options.merge ? { ...existing, ...nextPayload } : nextPayload);
        },
      },
    };
  }

  const requestRef = {
    id: 'request-1',
    async get() {
      return {
        exists: true,
        id: 'request-1',
        ref: requestRef,
        data: () => clone(state.requestData),
      };
    },
    async set(payload, options = {}) {
      const nextPayload = clone(payload);
      state.requestData = options && options.merge
        ? { ...state.requestData, ...nextPayload }
        : nextPayload;
    },
    collection(name) {
      if (name !== 'groupMeetInvites') {
        throw new Error(`Unexpected collection: ${name}`);
      }

      return {
        doc(id) {
          return createInviteSnapshot(id, state.inviteDocs.get(id) || {}).ref;
        },
        orderBy() {
          return this;
        },
        async get() {
          const docs = Array.from(state.inviteDocs.entries()).map(([id, inviteData]) =>
            createInviteSnapshot(id, inviteData)
          );
          return { docs, size: docs.length, empty: docs.length === 0 };
        },
      };
    },
  };

  const firestoreInstance = {
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
  };

  function firestore() {
    return firestoreInstance;
  }

  firestore.FieldValue = {
    serverTimestamp() {
      return { __serverTimestamp: true };
    },
  };

  const firebaseAdminMock = {
    firestore,
    getFirebaseAdminApp(forceDevProject = false) {
      state.firebaseAppSelections.push(Boolean(forceDevProject));
      return { firestore };
    },
  };
  firebaseAdminMock.firestore.FieldValue = firestore.FieldValue;

  const groupMeetGuestGoogleCalendarMock = {
    shouldForceDevFirebase(req) {
      const hostHeader = req.headers?.host || '';
      const host = Array.isArray(hostHeader) ? hostHeader[0] || '' : hostHeader;
      const normalizedHost = String(host).trim().toLowerCase();
      return normalizedHost.startsWith('localhost:') || normalizedHost.startsWith('127.0.0.1:');
    },
    toIso(value) {
      return value?.toDate?.().toISOString?.() || null;
    },
  };

  const groupMeetAdminMock = {
    GROUP_MEET_INVITES_SUBCOLLECTION: 'groupMeetInvites',
    GROUP_MEET_REQUESTS_COLLECTION: 'groupMeetRequests',
    getGroupMeetBaseUrl() {
      return 'https://fitwithpulse.ai';
    },
    mapGroupMeetInviteDetail(docSnap, targetMonth) {
      const data = docSnap.data() || {};
      const availabilityEntries = Array.isArray(data.availabilityEntries)
        ? data.availabilityEntries
            .filter((slot) => typeof slot?.date === 'string' && slot.date.startsWith(`${targetMonth}-`))
            .map((slot) => ({
              date: slot.date,
              startMinutes: slot.startMinutes,
              endMinutes: slot.endMinutes,
            }))
        : [];

      return {
        token: docSnap.id,
        name: data.name || '',
        email: data.email || null,
        imageUrl: data.imageUrl || null,
        participantType: data.participantType === 'host' ? 'host' : 'participant',
        contactId: data.contactId || null,
        shareUrl: data.shareUrl || '',
        emailStatus: data.emailStatus || 'not_sent',
        emailedAt: data.emailedAt?.toDate?.().toISOString?.() || null,
        emailError: data.emailError || null,
        respondedAt: data.responseSubmittedAt?.toDate?.().toISOString?.() || null,
        availabilityCount: availabilityEntries.length,
        availabilityEntries,
      };
    },
    maybeNotifyGroupMeetHostAfterAvailabilitySave: async (args) => {
      state.hostNotificationCalls.push(clone(args));
      return { notified: true, mode: 'completion', skipped: false };
    },
  };

  const handlerModule = withModuleMocks(
    {
      '../../../../lib/firebase-admin': firebaseAdminMock,
      '../../../../lib/groupMeetGuestGoogleCalendar': groupMeetGuestGoogleCalendarMock,
      '../../../../lib/groupMeetAdmin': groupMeetAdminMock,
      '../../../../lib/groupMeetFlex': {
        verifyGroupMeetFlexActionToken() {
          return clone(flexPayload);
        },
      },
    },
    () => require(flexHandlerPath)
  );

  return {
    handler: handlerModule.default,
    state,
  };
}

function createGuestCalendarConnectStartHandlerRuntime({
  requestData = {
    title: 'Group Meet',
    targetMonth: '2026-04',
    deadlineAt: makeTimestamp('2026-04-08T21:00:00.000Z'),
    timezone: 'America/New_York',
    meetingDurationMinutes: 60,
    status: 'draft',
  },
  helperOverrides = {},
} = {}) {
  compiledRuntimeCache = null;
  const { connectStartHandlerPath } = compileGroupMeetRuntime();
  clearCompiledRuntimeModuleCache();

  const state = {
    firebaseAppSelections: [],
  };

  const firebaseAdminMock = {
    getFirebaseAdminApp(forceDevProject = false) {
      state.firebaseAppSelections.push(Boolean(forceDevProject));
      return {
        firestore() {
          return {};
        },
      };
    },
  };

  const helperMock = {
    buildGuestGoogleCalendarConnectUrl: async () => 'https://accounts.google.com/o/oauth2/v2/auth',
    findGroupMeetInviteByToken: async () => ({
      inviteDoc: {
        data: () => ({
          token: 'guest-token',
        }),
      },
      requestDoc: {
        data: () => clone(requestData),
      },
    }),
    getPublicGuestCalendarDebugInfo: () => ({
      code: 'google_calendar_connect_unknown',
      hint: 'Check the server log entry for the connect route to see the exact failure stage.',
    }),
    shouldForceDevFirebase: () => false,
    toPublicGuestCalendarErrorMessage: (error) =>
      error?.message || 'Google Calendar connect could not be completed.',
    toIso: (value) => value?.toDate?.().toISOString?.() || null,
    ...helperOverrides,
  };

  const handlerModule = withModuleMocks(
    {
      '../../../../../../../lib/firebase-admin': firebaseAdminMock,
      '../../../../../../../lib/groupMeetGuestGoogleCalendar': helperMock,
    },
    () => require(connectStartHandlerPath)
  );

  return {
    handler: handlerModule.default,
    state,
  };
}

module.exports = {
  createApiResponseRecorder,
  createGroupMeetCreateHandlerRuntime,
  createGuestCalendarConnectStartHandlerRuntime,
  createPublicFlexHandlerRuntime,
  createPublicInviteHandlerRuntime,
  createRequestDetailHandlerRuntime,
  loadGuestGoogleCalendarRuntime,
  loadGoogleCalendarRuntime,
  loadGroupMeetRuntime,
  makeTimestamp,
};
