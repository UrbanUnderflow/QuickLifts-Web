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
