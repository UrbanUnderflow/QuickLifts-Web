const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const repoRoot = '/Users/tremainegrant/Documents/GitHub/QuickLifts-Web';
const chatPath = path.join(repoRoot, 'netlify/functions/pulsecheck-chat.js');
const configPath = path.join(repoRoot, 'netlify/functions/config/firebase.js');
const submitPath = path.join(repoRoot, 'netlify/functions/submit-pulsecheck-checkin.js');

function loadRuntimeHelpers() {
  delete require.cache[chatPath];
  delete require.cache[configPath];
  delete require.cache[submitPath];

  require.cache[configPath] = {
    id: configPath,
    filename: configPath,
    loaded: true,
    exports: {
      initializeFirebaseAdmin: () => {},
      admin: {},
      headers: {},
    },
  };

  require.cache[submitPath] = {
    id: submitPath,
    filename: submitPath,
    loaded: true,
    exports: {
      runtimeHelpers: {},
    },
  };

  return require(chatPath).runtimeHelpers;
}

function createConversationRecoveryDb({ conversations = [] }) {
  const writes = {
    event: null,
    snapshot: null,
  };

  const eventQuery = {
    where() {
      return eventQuery;
    },
    async get() {
      return { docs: [] };
    },
  };

  const conversationQuery = {
    where() {
      return conversationQuery;
    },
    async get() {
      return {
        docs: conversations.map((entry, index) => ({
          id: entry.id || `conversation-${index + 1}`,
          data: () => entry,
        })),
      };
    },
  };

  const db = {
    collection(name) {
      if (name === 'conversations') {
        return conversationQuery;
      }

      if (name === 'conversation-derived-signal-events') {
        return {
          where() {
            return eventQuery;
          },
          doc(id = 'event-1') {
            return {
              id,
              async set(payload) {
                writes.event = payload;
              },
            };
          },
        };
      }

      if (name === 'state-snapshots') {
        return {
          doc(id) {
            return {
              async set(payload) {
                writes.snapshot = { id, payload };
              },
            };
          },
        };
      }

      throw new Error(`Unexpected collection: ${name}`);
    },
  };

  return { db, writes };
}

function createEscalationFlowDb({
  conversations = [],
  escalationConditions = [],
  escalationRecords = [],
  userDocs = [],
  athleticProgressDocs = [],
  assignmentDocs = [],
} = {}) {
  const writes = {
    conversations: [],
    records: [],
  };

  const conversationStore = new Map(conversations.map((entry) => [entry.id, { ...entry }]));
  const userStore = new Map(userDocs.map((entry) => [entry.id, { ...entry }]));
  const progressStore = new Map(athleticProgressDocs.map((entry) => [entry.id, { ...entry }]));
  const assignmentStore = new Map(assignmentDocs.map((entry) => [entry.id, { ...entry }]));
  const conditionDocs = escalationConditions.map((entry, index) => ({
    id: entry.id || `condition-${index + 1}`,
    data: () => entry,
  }));
  const recordStore = new Map(escalationRecords.map((entry) => [entry.id, { ...entry }]));

  const emptyQuery = {
    where() {
      return emptyQuery;
    },
    orderBy() {
      return emptyQuery;
    },
    limit() {
      return emptyQuery;
    },
    async get() {
      return { docs: [], empty: true };
    },
  };

  function makeQueryFromDocs(docs) {
    return {
      where(field, operator, value) {
        const filtered = docs.filter((doc) => {
          const payload = doc.data ? doc.data() : doc;
          const candidate = payload?.[field];
          if (operator === '==') return candidate === value;
          if (operator === 'in') return Array.isArray(value) && value.includes(candidate);
          return false;
        });
        return makeQueryFromDocs(filtered);
      },
      orderBy() {
        return makeQueryFromDocs(docs);
      },
      limit(count) {
        return makeQueryFromDocs(docs.slice(0, count));
      },
      async get() {
        return { docs, empty: docs.length === 0 };
      },
    };
  }

  function makeRecordSnapshot(id, data) {
    return { id, data: () => ({ ...data }) };
  }

  function makeRecordCollection() {
    return {
      where(field, operator, value) {
        const docs = [...recordStore.entries()]
          .filter(([, entry]) => {
            if (operator === '==') return entry?.[field] === value;
            if (operator === 'in') return Array.isArray(value) && value.includes(entry?.[field]);
            return false;
          })
          .map(([id, entry]) => makeRecordSnapshot(id, entry));
        return makeQueryFromDocs(docs);
      },
      async add(data) {
        const id = `escalation-${recordStore.size + 1}`;
        recordStore.set(id, { ...data });
        writes.records.push({ type: 'add', id, data: { ...data } });
        return {
          id,
          async update(updateData) {
            const existing = recordStore.get(id) || {};
            recordStore.set(id, { ...existing, ...updateData });
            writes.records.push({ type: 'update', id, data: { ...updateData } });
          },
        };
      },
      doc(id) {
        return {
          id,
          async get() {
            const data = recordStore.get(id);
            if (!data) {
              return { exists: false, id, data: () => undefined };
            }
            return { exists: true, id, data: () => ({ ...data }) };
          },
          async set(data, options = {}) {
            const existing = recordStore.get(id) || {};
            recordStore.set(id, options.merge ? { ...existing, ...data } : { ...data });
            writes.records.push({ type: 'set', id, data: { ...data }, merge: Boolean(options.merge) });
          },
          async update(data) {
            const existing = recordStore.get(id) || {};
            recordStore.set(id, { ...existing, ...data });
            writes.records.push({ type: 'update', id, data: { ...data } });
          },
        };
      },
    };
  }

  function makeSimpleDocCollection(store, collectionName) {
    return {
      doc(id) {
        return {
          id,
          async get() {
            const data = store.get(id);
            if (!data) {
              return { exists: false, id, data: () => undefined };
            }
            return { exists: true, id, data: () => ({ ...data }) };
          },
          async set(data, options = {}) {
            const existing = store.get(id) || {};
            store.set(id, options.merge ? { ...existing, ...data } : { ...data });
            if (collectionName === 'conversations') {
              writes.conversations.push({ id, data: { ...data }, merge: Boolean(options.merge) });
            }
          },
          async update(data) {
            const existing = store.get(id) || {};
            store.set(id, { ...existing, ...data });
            if (collectionName === 'conversations') {
              writes.conversations.push({ id, data: { ...data }, update: true });
            }
          },
        };
      },
      where(field, operator, value) {
        const docs = [...store.entries()]
          .filter(([, entry]) => {
            const candidate = entry?.[field];
            if (operator === '==') return candidate === value;
            if (operator === 'in') return Array.isArray(value) && value.includes(candidate);
            return false;
          })
          .map(([id, entry]) => ({ id, data: () => ({ ...entry }) }));
        return makeQueryFromDocs(docs);
      },
      async get() {
        const docs = [...store.entries()].map(([id, entry]) => ({ id, data: () => ({ ...entry }) }));
        return { docs, empty: docs.length === 0 };
      },
    };
  }

  const db = {
    collection(name) {
      if (name === 'conversations') {
        return makeSimpleDocCollection(conversationStore, 'conversations');
      }
      if (name === 'escalation-conditions') {
        return makeQueryFromDocs(conditionDocs);
      }
      if (name === 'escalation-records') {
        return makeRecordCollection();
      }
      if (name === 'users') {
        return makeSimpleDocCollection(userStore, 'users');
      }
      if (name === 'athlete-mental-progress') {
        return makeSimpleDocCollection(progressStore, 'athlete-mental-progress');
      }
      if (name === 'pulsecheck-daily-assignments') {
        return makeSimpleDocCollection(assignmentStore, 'pulsecheck-daily-assignments');
      }
      return {
        doc() {
          return {
            async get() {
              return { exists: false, id: 'missing', data: () => undefined };
            },
            async set() {},
            async update() {},
          };
        },
        where() {
          return emptyQuery;
        },
        orderBy() {
          return emptyQuery;
        },
        limit() {
          return emptyQuery;
        },
        async get() {
          return { docs: [], empty: true };
        },
      };
    },
  };

  return { db, writes, recordStore, conversationStore };
}

async function waitFor(predicate, timeoutMs = 5000, intervalMs = 25) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const result = await predicate();
    if (result) {
      return result;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error('Timed out waiting for expected state.');
}

test('recovers today conversation context when message timestamps use Apple reference-date seconds', async () => {
  const { recoverSnapshotFromSavedConversation } = loadRuntimeHelpers();
  const sourceDate = '2026-03-20';
  const appleReferenceSecondsForTodayMessage = 795696960;
  const snapshot = {
    id: 'athlete-1_2026-03-20',
    sourceDate,
    overallReadiness: 'green',
    confidence: 'medium',
    recommendedRouting: 'defer_alternate_path',
    recommendedProtocolClass: 'priming',
    stateDimensions: {
      activation: 50,
      focusReadiness: 50,
      emotionalLoad: 40,
      cognitiveFatigue: 30,
    },
  };
  const assignment = {
    id: 'athlete-1_2026-03-20',
    sourceDate,
    actionType: 'defer',
    status: 'deferred',
  };
  const { db, writes } = createConversationRecoveryDb({
    conversations: [
      {
        id: 'conversation-today',
        updatedAt: 1774028880,
        messages: [
          {
            id: 'message-1',
            content: 'I like visualization',
            isFromUser: true,
            timestamp: appleReferenceSecondsForTodayMessage,
          },
        ],
      },
    ],
  });

  const result = await recoverSnapshotFromSavedConversation({
    db,
    userId: 'athlete-1',
    sourceDate,
    snapshot,
    assignment,
  });

  assert.equal(result.applied, true);
  assert.equal(result.detail, 'Recovered today’s assignment context from the saved Nora conversation.');
  assert.equal(result.conversationId, 'conversation-today');
  assert.equal(result.messageId, 'message-1');
  assert.equal(result.stateSnapshot.recommendedRouting, 'protocol_only');
  assert.ok(writes.event, 'expected conversation signal event write');
  assert.equal(writes.event.messageId, 'message-1');
  assert.ok(writes.snapshot, 'expected refreshed snapshot write');
  assert.equal(writes.snapshot.id, snapshot.id);
});

test('recovers today conversation context when message timestamps are stored as Firestore timestamp objects', async () => {
  const { recoverSnapshotFromSavedConversation } = loadRuntimeHelpers();
  const sourceDate = '2026-03-20';
  const snapshot = {
    id: 'athlete-1_2026-03-20',
    sourceDate,
    overallReadiness: 'green',
    confidence: 'medium',
    recommendedRouting: 'defer_alternate_path',
    recommendedProtocolClass: 'priming',
    stateDimensions: {
      activation: 50,
      focusReadiness: 50,
      emotionalLoad: 40,
      cognitiveFatigue: 30,
    },
  };
  const assignment = {
    id: 'athlete-1_2026-03-20',
    sourceDate,
    actionType: 'defer',
    status: 'deferred',
  };
  const { db, writes } = createConversationRecoveryDb({
    conversations: [
      {
        id: 'conversation-today',
        updatedAt: 1774028880,
        messages: [
          {
            id: 'message-1',
            content: 'I am ready to push through the session.',
            isFromUser: true,
            timestamp: {
              seconds: 1774022400,
              nanoseconds: 0,
            },
          },
        ],
      },
    ],
  });

  const result = await recoverSnapshotFromSavedConversation({
    db,
    userId: 'athlete-1',
    sourceDate,
    snapshot,
    assignment,
  });

  assert.equal(result.applied, true);
  assert.equal(result.conversationId, 'conversation-today');
  assert.equal(result.messageId, 'message-1');
  assert.ok(writes.event, 'expected conversation signal event write');
  assert.ok(writes.snapshot, 'expected refreshed snapshot write');
});

test('recovers from the most recent material user message instead of only the latest neutral reply', async () => {
  const { recoverSnapshotFromSavedConversation } = loadRuntimeHelpers();
  const sourceDate = '2026-03-20';
  const snapshot = {
    id: 'athlete-1_2026-03-20',
    sourceDate,
    overallReadiness: 'green',
    confidence: 'medium',
    recommendedRouting: 'defer_alternate_path',
    recommendedProtocolClass: 'priming',
    stateDimensions: {
      activation: 50,
      focusReadiness: 50,
      emotionalLoad: 40,
      cognitiveFatigue: 30,
    },
  };
  const assignment = {
    id: 'athlete-1_2026-03-20',
    sourceDate,
    actionType: 'defer',
    status: 'deferred',
  };
  const { db, writes } = createConversationRecoveryDb({
    conversations: [
      {
        id: 'conversation-today',
        updatedAt: 1774028880,
        messages: [
          {
            id: 'message-material',
            content: 'I feel anxious and scattered right now.',
            isFromUser: true,
            timestamp: 1774022400,
          },
          {
            id: 'message-neutral',
            content: 'okay',
            isFromUser: true,
            timestamp: 1774022460,
          },
        ],
      },
    ],
  });

  const result = await recoverSnapshotFromSavedConversation({
    db,
    userId: 'athlete-1',
    sourceDate,
    snapshot,
    assignment,
  });

  assert.equal(result.applied, true);
  assert.equal(result.conversationId, 'conversation-today');
  assert.equal(result.messageId, 'message-material');
  assert.ok(writes.event, 'expected conversation signal event write');
  assert.equal(writes.event.messageId, 'message-material');
  assert.ok(writes.snapshot, 'expected refreshed snapshot write');
});

test('downgrades benign performance stress escalation requests before record creation', async () => {
  const handlerPath = require('node:path').join(repoRoot, 'netlify/functions/pulsecheck-chat.js');
  const originalFetch = global.fetch;
  const originalOpenAiKey = process.env.OPEN_AI_SECRET_KEY;
  process.env.OPEN_AI_SECRET_KEY = 'test-openai-key';
  const { db, recordStore } = createEscalationFlowDb({
    escalationConditions: [
      {
        id: 'condition-tier1',
        tier: 1,
        category: 'performance_support',
        title: 'Competition stress',
        description: 'Nervous performance language without safety markers.',
        isActive: true,
        priority: 10,
        examplePhrases: ['competition stress'],
      },
    ],
    conversations: [
      {
        id: 'conversation-stress',
        userId: 'athlete-1',
        updatedAt: Date.parse('2026-03-31T12:00:00.000Z'),
        messages: [
          {
            id: 'message-1',
            content: 'I am nervous about competition and want help focusing.',
            isFromUser: true,
            timestamp: Math.floor(Date.parse('2026-03-31T12:00:00.000Z') / 1000),
          },
        ],
      },
    ],
  });

  delete require.cache[handlerPath];
  delete require.cache[configPath];
  delete require.cache[submitPath];
  require.cache[configPath] = {
    id: configPath,
    filename: configPath,
    loaded: true,
    exports: {
      initializeFirebaseAdmin: () => {},
      admin: {
        firestore: () => db,
      },
      headers: {},
    },
  };
  require.cache[submitPath] = {
    id: submitPath,
    filename: submitPath,
    loaded: true,
    exports: {
      runtimeHelpers: {},
    },
  };

  const { handler } = require(handlerPath);

  global.fetch = async () => ({
    ok: true,
    status: 200,
    statusText: 'OK',
    headers: new Map(),
    json: async () => ({
      choices: [
        {
          message: {
            content: JSON.stringify({
              tier: 1,
              category: 'performance_support',
              reason: 'Stress and competition language detected.',
              confidence: 0.88,
              shouldEscalate: true,
            }),
          },
        },
      ],
    }),
  });

  try {
    const response = await handler({
      httpMethod: 'POST',
      headers: { authorization: 'Bearer fake-token' },
      body: JSON.stringify({
        userId: 'athlete-1',
        message: 'I am nervous about competition and want help focusing.',
        conversationId: 'conversation-stress',
        recentMessages: [
          { isFromUser: true, content: 'I am nervous about competition and want help focusing.' },
        ],
      }),
    });

    const body = JSON.parse(response.body);
    assert.equal(response.statusCode, 200);
    assert.equal(body.escalation.tier, 0);
    assert.equal(body.escalation.shouldEscalate, false);
    assert.equal(body.escalation.classificationFamily, 'performance_support');
    assert.equal(body.escalation.incident.scope, 'same_conversation');
    assert.equal(body.escalation.incident.family, 'performance_support');
    assert.equal(body.escalation.incident.status, 'open');
    await new Promise((resolve) => setTimeout(resolve, 200));
    assert.equal(recordStore.size, 0);
  } finally {
    global.fetch = originalFetch;
    process.env.OPEN_AI_SECRET_KEY = originalOpenAiKey;
  }
});

test('elevates loss-of-function language into a true care escalation', async () => {
  const handlerPath = require('node:path').join(repoRoot, 'netlify/functions/pulsecheck-chat.js');
  const originalFetch = global.fetch;
  const originalOpenAiKey = process.env.OPEN_AI_SECRET_KEY;
  process.env.OPEN_AI_SECRET_KEY = 'test-openai-key';
  const { db, recordStore, writes } = createEscalationFlowDb({
    escalationConditions: [
      {
        id: 'condition-tier2',
        tier: 2,
        category: 'safety',
        title: 'Loss of function',
        description: 'Inability to move, feel, or use a limb is a true care escalation.',
        isActive: true,
        priority: 100,
        examplePhrases: ['arm went numb'],
      },
    ],
    conversations: [
      {
        id: 'conversation-loss-of-function',
        userId: 'athlete-1',
        updatedAt: Date.parse('2026-03-31T12:00:00.000Z'),
        messages: [
          {
            id: 'message-1',
            content: 'My right arm went numb and I cannot grip the bar.',
            isFromUser: true,
            timestamp: Math.floor(Date.parse('2026-03-31T12:00:00.000Z') / 1000),
          },
        ],
      },
    ],
  });

  delete require.cache[handlerPath];
  delete require.cache[configPath];
  delete require.cache[submitPath];
  require.cache[configPath] = {
    id: configPath,
    filename: configPath,
    loaded: true,
    exports: {
      initializeFirebaseAdmin: () => {},
      admin: {
        firestore: () => db,
      },
      headers: {},
    },
  };
  require.cache[submitPath] = {
    id: submitPath,
    filename: submitPath,
    loaded: true,
    exports: {
      runtimeHelpers: {},
    },
  };

  const { handler } = require(handlerPath);

  global.fetch = async () => ({
    ok: true,
    status: 200,
    statusText: 'OK',
    headers: new Map(),
    json: async () => ({
      choices: [
        {
          message: {
            content: JSON.stringify({
              tier: 0,
              category: 'performance_support',
              reason: 'Needs coaching support.',
              confidence: 0.42,
              shouldEscalate: false,
            }),
          },
        },
      ],
    }),
  });

  try {
    const response = await handler({
      httpMethod: 'POST',
      headers: { authorization: 'Bearer fake-token' },
      body: JSON.stringify({
        userId: 'athlete-1',
        message: 'My right arm went numb and I cannot grip the bar.',
        conversationId: 'conversation-loss-of-function',
        recentMessages: [
          { isFromUser: true, content: 'My right arm went numb and I cannot grip the bar.' },
        ],
      }),
    });

    const body = JSON.parse(response.body);
    assert.equal(response.statusCode, 200);
    assert.equal(body.escalation.tier, 2);
    assert.equal(body.escalation.classificationFamily, 'care_escalation');
    assert.equal(body.escalation.requiresClinicalHandoff, true);

    await waitFor(() => recordStore.size === 1);
    const activeRecord = [...recordStore.values()].find((entry) => entry.conversationId === 'conversation-loss-of-function');
    assert.equal(activeRecord?.tier, 2);
    assert.equal(activeRecord?.classificationFamily, 'care_escalation');

    const conversationWrite = writes.conversations[writes.conversations.length - 1];
    assert.equal(conversationWrite?.data?.escalationTier, 2);
    assert.equal(conversationWrite?.data?.isInSafetyMode, false);
  } finally {
    global.fetch = originalFetch;
    process.env.OPEN_AI_SECRET_KEY = originalOpenAiKey;
  }
});

test('dedupes same-conversation escalation records within the merge window', async () => {
  const handlerPath = require('node:path').join(repoRoot, 'netlify/functions/pulsecheck-chat.js');
  const originalFetch = global.fetch;
  const originalOpenAiKey = process.env.OPEN_AI_SECRET_KEY;
  process.env.OPEN_AI_SECRET_KEY = 'test-openai-key';
  const { db, recordStore } = createEscalationFlowDb({
    escalationConditions: [
      {
        id: 'condition-tier2',
        tier: 2,
        category: 'safety',
        title: 'Safety concern',
        description: 'Consent-based clinical escalation.',
        isActive: true,
        priority: 100,
        examplePhrases: ['cannot stay safe'],
      },
    ],
    conversations: [
      {
        id: 'conversation-escalation',
        userId: 'athlete-1',
        updatedAt: Date.parse('2026-03-31T12:00:00.000Z'),
        messages: [
          {
            id: 'message-1',
            content: 'I cannot stay safe and need help.',
            isFromUser: true,
            timestamp: Math.floor(Date.parse('2026-03-31T12:00:00.000Z') / 1000),
          },
        ],
      },
    ],
  });

  delete require.cache[handlerPath];
  delete require.cache[configPath];
  delete require.cache[submitPath];
  require.cache[configPath] = {
    id: configPath,
    filename: configPath,
    loaded: true,
    exports: {
      initializeFirebaseAdmin: () => {},
      admin: {
        firestore: () => db,
      },
      headers: {},
    },
  };
  require.cache[submitPath] = {
    id: submitPath,
    filename: submitPath,
    loaded: true,
    exports: {
      runtimeHelpers: {},
    },
  };

  const { handler } = require(handlerPath);

  global.fetch = async () => ({
    ok: true,
    status: 200,
    statusText: 'OK',
    headers: new Map(),
    json: async () => ({
      choices: [
        {
          message: {
            content: JSON.stringify({
              tier: 2,
              category: 'safety',
              reason: 'Elevated risk language detected.',
              confidence: 0.92,
              shouldEscalate: true,
            }),
          },
        },
      ],
    }),
  });

  try {
    const firstResponse = await handler({
      httpMethod: 'POST',
      headers: { authorization: 'Bearer fake-token' },
      body: JSON.stringify({
        userId: 'athlete-1',
        message: 'I cannot stay safe and need help.',
        conversationId: 'conversation-escalation',
        recentMessages: [
          { isFromUser: true, content: 'I cannot stay safe and need help.' },
        ],
      }),
    });

    assert.equal(firstResponse.statusCode, 200);
    await waitFor(() => recordStore.size === 1);

    const secondResponse = await handler({
      httpMethod: 'POST',
      headers: { authorization: 'Bearer fake-token' },
      body: JSON.stringify({
        userId: 'athlete-1',
        message: 'I cannot stay safe and need help again.',
        conversationId: 'conversation-escalation',
        recentMessages: [
          { isFromUser: true, content: 'I cannot stay safe and need help.' },
          { isFromUser: true, content: 'I cannot stay safe and need help again.' },
        ],
      }),
    });

    const secondBody = JSON.parse(secondResponse.body);
    assert.equal(secondResponse.statusCode, 200);
    assert.equal(secondBody.escalation.tier, 2);
    assert.equal(secondBody.escalation.classificationFamily, 'care_escalation');
    assert.equal(secondBody.escalation.incident.scope, 'same_conversation');
    assert.equal(secondBody.escalation.incident.family, 'care_escalation');
    assert.equal(secondBody.escalation.incident.status, 'open');
    await waitFor(() => {
      const activeRecord = [...recordStore.values()].find((entry) => entry.conversationId === 'conversation-escalation');
      return activeRecord?.dedupeMergedCount === 1;
    });
    const activeRecord = [...recordStore.values()].find((entry) => entry.conversationId === 'conversation-escalation');
    assert.equal(activeRecord?.countsTowardCareKpi, true);
    assert.equal(activeRecord?.classificationFamily, 'care_escalation');
    assert.equal(activeRecord?.incident?.family, 'care_escalation');
    assert.equal(activeRecord?.incident?.status, 'open');
    assert.equal(recordStore.size, 1);
  } finally {
    global.fetch = originalFetch;
    process.env.OPEN_AI_SECRET_KEY = originalOpenAiKey;
  }
});
