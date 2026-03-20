const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const repoRoot = '/Users/tremainegrant/Documents/GitHub/QuickLifts-Web';
const repairPath = path.join(repoRoot, 'netlify/functions/repair-pulsecheck-daily-assignment.js');
const configPath = path.join(repoRoot, 'netlify/functions/config/firebase.js');
const submitPath = path.join(repoRoot, 'netlify/functions/submit-pulsecheck-checkin.js');
const chatPath = path.join(repoRoot, 'netlify/functions/pulsecheck-chat.js');

function loadHandler({ db, runtimeHelpers, chatRuntimeHelpers = {}, decodedUid = 'athlete-1' }) {
  delete require.cache[repairPath];
  delete require.cache[configPath];
  delete require.cache[submitPath];
  delete require.cache[chatPath];

  require.cache[configPath] = {
    id: configPath,
    filename: configPath,
    loaded: true,
    exports: {
      initializeFirebaseAdmin: () => {},
      admin: {
        auth: () => ({
          verifyIdToken: async () => ({ uid: decodedUid }),
        }),
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
      runtimeHelpers,
    },
  };

  require.cache[chatPath] = {
    id: chatPath,
    filename: chatPath,
    loaded: true,
    exports: {
      runtimeHelpers: {
        recoverSnapshotFromSavedConversation: async () => ({
          applied: false,
          detail: 'No saved Nora conversation from today was available.',
        }),
        ...chatRuntimeHelpers,
      },
    },
  };

  return require(repairPath).handler;
}

function createDb({ existingAssignment }) {
  return {
    collection(name) {
      if (name !== 'pulsecheck-daily-assignments') {
        throw new Error(`Unexpected collection: ${name}`);
      }

      return {
        doc(id) {
          return {
            async get() {
              if (!existingAssignment) {
                return { exists: false, id, data: () => undefined };
              }
              return {
                exists: true,
                id,
                data: () => existingAssignment,
              };
            },
          };
        },
      };
    },
  };
}

function parseBody(response) {
  assert.equal(response.statusCode, 200);
  return JSON.parse(response.body);
}

test('returns existing assignment without rematerializing when one already exists', async () => {
  let rematerializeCalled = false;
  const handler = loadHandler({
    db: createDb({
      existingAssignment: {
        athleteId: 'athlete-1',
        sourceDate: '2026-03-18',
        status: 'assigned',
        actionType: 'sim',
      },
    }),
    runtimeHelpers: {
      getSnapshotById: async () => ({ id: 'athlete-1_2026-03-18', sourceCheckInId: 'checkin-1' }),
      loadOrInitializeProgress: async () => {
        throw new Error('should not load progress when assignment already exists');
      },
      syncTaxonomyProfile: async () => {
        throw new Error('should not sync profile when assignment already exists');
      },
      rematerializeAssignmentFromSnapshot: async () => {
        rematerializeCalled = true;
        return null;
      },
    },
  });

  const body = parseBody(await handler({
    httpMethod: 'POST',
    headers: { authorization: 'Bearer fake-token' },
    body: JSON.stringify({ sourceDate: '2026-03-18' }),
  }));

  assert.equal(body.dailyAssignment.status, 'assigned');
  assert.equal(body.repairApplied, false);
  assert.equal(rematerializeCalled, false);
});

test('rematerializes deferred assignment so assessment chat can promote it into a live task', async () => {
  let syncCalled = false;
  let rematerializeCalled = false;
  const snapshot = {
    id: 'athlete-1_2026-03-18',
    sourceDate: '2026-03-18',
    sourceCheckInId: 'checkin-1',
    recommendedRouting: 'sim_only',
  };
  const repairedAssignment = {
    id: 'athlete-1_2026-03-18',
    athleteId: 'athlete-1',
    sourceDate: '2026-03-18',
    sourceCheckInId: 'checkin-1',
    status: 'assigned',
    actionType: 'sim',
    simSpecId: 'noise_gate',
    rationale: 'Assessment chat resolved the right sim.',
  };

  const handler = loadHandler({
    db: createDb({
      existingAssignment: {
        athleteId: 'athlete-1',
        sourceDate: '2026-03-18',
        status: 'deferred',
        actionType: 'defer',
      },
    }),
    runtimeHelpers: {
      getSnapshotById: async () => snapshot,
      loadOrInitializeProgress: async () => ({ athleteId: 'athlete-1' }),
      syncTaxonomyProfile: async (_db, athleteId, progress) => {
        syncCalled = true;
        return { ...progress, athleteId, activeProgram: { recommendedSimId: 'noise_gate' } };
      },
      rematerializeAssignmentFromSnapshot: async () => {
        rematerializeCalled = true;
        return {
          stateSnapshot: snapshot,
          candidateSet: { id: 'candidate-set-1' },
          dailyAssignment: repairedAssignment,
        };
      },
    },
  });

  const body = parseBody(await handler({
    httpMethod: 'POST',
    headers: { authorization: 'Bearer fake-token' },
    body: JSON.stringify({ sourceDate: '2026-03-18' }),
  }));

  assert.equal(syncCalled, true);
  assert.equal(rematerializeCalled, true);
  assert.equal(body.dailyAssignment.id, repairedAssignment.id);
  assert.equal(body.dailyAssignment.actionType, 'sim');
  assert.equal(body.repairApplied, true);
});

test('rematerializes missing assignment when snapshot exists for the day', async () => {
  let syncCalled = false;
  let rematerializeCalled = false;
  const snapshot = {
    id: 'athlete-1_2026-03-18',
    sourceDate: '2026-03-18',
    sourceCheckInId: 'checkin-1',
    recommendedRouting: 'sim_only',
  };
  const repairedAssignment = {
    id: 'athlete-1_2026-03-18',
    athleteId: 'athlete-1',
    sourceDate: '2026-03-18',
    sourceCheckInId: 'checkin-1',
    status: 'assigned',
    actionType: 'sim',
    simSpecId: 'noise_gate',
    rationale: 'Recovered assignment.',
  };

  const handler = loadHandler({
    db: createDb({ existingAssignment: null }),
    runtimeHelpers: {
      getSnapshotById: async () => snapshot,
      loadOrInitializeProgress: async () => ({ athleteId: 'athlete-1' }),
      syncTaxonomyProfile: async (_db, athleteId, progress) => {
        syncCalled = true;
        return { ...progress, athleteId, activeProgram: { recommendedSimId: 'noise_gate' } };
      },
      rematerializeAssignmentFromSnapshot: async ({ athleteId, sourceStateSnapshotId, sourceDate }) => {
        rematerializeCalled = true;
        assert.equal(athleteId, 'athlete-1');
        assert.equal(sourceStateSnapshotId, snapshot.id);
        assert.equal(sourceDate, snapshot.sourceDate);
        return {
          stateSnapshot: snapshot,
          candidateSet: { id: 'candidate-set-1' },
          dailyAssignment: repairedAssignment,
        };
      },
    },
  });

  const body = parseBody(await handler({
    httpMethod: 'POST',
    headers: { authorization: 'Bearer fake-token' },
    body: JSON.stringify({ sourceDate: '2026-03-18' }),
  }));

  assert.equal(syncCalled, true);
  assert.equal(rematerializeCalled, true);
  assert.equal(body.dailyAssignment.id, repairedAssignment.id);
  assert.equal(body.repairApplied, true);
  assert.equal(body.stateSnapshot.id, snapshot.id);
});

test('replays saved Nora conversation context before rematerializing a missing assignment', async () => {
  let conversationRecoveryCalled = false;
  let rematerializeCalled = false;
  const snapshot = {
    id: 'athlete-1_2026-03-18',
    sourceDate: '2026-03-18',
    sourceCheckInId: 'checkin-1',
    recommendedRouting: 'defer_alternate_path',
    recommendedProtocolClass: 'priming',
  };
  const refreshedSnapshot = {
    ...snapshot,
    recommendedRouting: 'protocol_only',
    recommendedProtocolClass: 'priming',
    confidence: 'medium',
  };
  const repairedAssignment = {
    id: 'athlete-1_2026-03-18',
    athleteId: 'athlete-1',
    sourceDate: '2026-03-18',
    sourceCheckInId: 'checkin-1',
    status: 'assigned',
    actionType: 'protocol',
    protocolId: 'proto-visualization',
    protocolLabel: 'Visualization Primer',
    rationale: 'Recovered from saved Nora conversation.',
  };

  const handler = loadHandler({
    db: createDb({ existingAssignment: null }),
    runtimeHelpers: {
      getSnapshotById: async () => snapshot,
      loadOrInitializeProgress: async () => ({ athleteId: 'athlete-1' }),
      syncTaxonomyProfile: async (_db, athleteId, progress) => {
        return { ...progress, athleteId, activeProgram: { recommendedSimId: 'noise_gate' } };
      },
      rematerializeAssignmentFromSnapshot: async ({ sourceStateSnapshotId }) => {
        rematerializeCalled = true;
        assert.equal(sourceStateSnapshotId, refreshedSnapshot.id);
        return {
          stateSnapshot: refreshedSnapshot,
          candidateSet: { id: 'candidate-set-1' },
          dailyAssignment: repairedAssignment,
        };
      },
    },
    chatRuntimeHelpers: {
      recoverSnapshotFromSavedConversation: async ({ snapshot: incomingSnapshot, sourceDate }) => {
        conversationRecoveryCalled = true;
        assert.equal(incomingSnapshot.id, snapshot.id);
        assert.equal(sourceDate, '2026-03-18');
        return {
          applied: true,
          detail: 'Recovered today’s assignment context from the saved Nora conversation.',
          stateSnapshot: refreshedSnapshot,
        };
      },
    },
  });

  const body = parseBody(await handler({
    httpMethod: 'POST',
    headers: { authorization: 'Bearer fake-token' },
    body: JSON.stringify({ sourceDate: '2026-03-18', recoverFromConversation: true }),
  }));

  assert.equal(conversationRecoveryCalled, true);
  assert.equal(rematerializeCalled, true);
  assert.equal(body.dailyAssignment.id, repairedAssignment.id);
  assert.equal(body.detail, 'Recovered today’s assignment context from the saved Nora conversation.');
});
