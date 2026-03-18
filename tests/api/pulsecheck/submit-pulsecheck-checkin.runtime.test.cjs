const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const repoRoot = '/Users/tremainegrant/Documents/GitHub/QuickLifts-Web';
const submitPath = path.join(repoRoot, 'netlify/functions/submit-pulsecheck-checkin.js');
const configPath = path.join(repoRoot, 'netlify/functions/config/firebase.js');
const profileRuntimePath = path.join(repoRoot, 'src/api/firebase/mentaltraining/profileSnapshotRuntime.js');
const protocolRegistryRuntimePath = path.join(repoRoot, 'src/api/firebase/mentaltraining/protocolRegistryRuntime.js');

function loadRuntimeHelpers() {
  delete require.cache[submitPath];
  delete require.cache[configPath];
  delete require.cache[profileRuntimePath];
  delete require.cache[protocolRegistryRuntimePath];

  require.cache[configPath] = {
    id: configPath,
    filename: configPath,
    loaded: true,
    exports: {
      initializeFirebaseAdmin: () => {},
      admin: {
        firestore: {
          FieldValue: {
            serverTimestamp: () => 'server-timestamp',
          },
        },
      },
      headers: {},
    },
  };

  require.cache[profileRuntimePath] = {
    id: profileRuntimePath,
    filename: profileRuntimePath,
    loaded: true,
    exports: {},
  };

  require.cache[protocolRegistryRuntimePath] = {
    id: protocolRegistryRuntimePath,
    filename: protocolRegistryRuntimePath,
    loaded: true,
    exports: {},
  };

  return require(submitPath).runtimeHelpers;
}

function createFirestoreDb({ snapshot }) {
  const writes = {
    snapshots: [],
    assignments: [],
    revisions: [],
    progress: [],
  };

  const emptyQueryResult = { docs: [] };

  return {
    writes,
    collection(name) {
      if (name === 'state-snapshots') {
        return {
          doc(id) {
            return {
              async get() {
                if (id === snapshot.id) {
                  return { exists: true, id, data: () => snapshot };
                }
                return { exists: false, id, data: () => undefined };
              },
              async set(data) {
                writes.snapshots.push({ id, data });
              },
            };
          },
        };
      }

      if (name === 'pulsecheck-daily-assignments') {
        return {
          doc(id) {
            return {
              async get() {
                return { exists: false, id, data: () => undefined };
              },
              async set(data) {
                writes.assignments.push({ id, data });
              },
              collection(childName) {
                assert.equal(childName, 'revisions');
                return {
                  doc(revisionId) {
                    return {
                      async set(data) {
                        writes.revisions.push({ revisionId, data });
                      },
                    };
                  },
                };
              },
            };
          },
        };
      }

      if (name === 'pulsecheck-team-memberships') {
        return {
          where() {
            return {
              where() {
                return {
                  async get() {
                    return emptyQueryResult;
                  },
                };
              },
              async get() {
                return emptyQueryResult;
              },
            };
          },
        };
      }

      if (name === 'athlete-mental-progress') {
        return {
          doc(id) {
            return {
              async set(data) {
                writes.progress.push({ id, data });
              },
            };
          },
        };
      }

      throw new Error(`Unexpected collection: ${name}`);
    },
  };
}

function createResponsivenessDb() {
  const writes = {
    profiles: [],
  };

  const emptyQueryResult = { docs: [] };

  return {
    writes,
    collection(name) {
      if (name === 'pulsecheck-protocol-responsiveness-profiles') {
        return {
          doc(id) {
            return {
              async get() {
                return { exists: false, id, data: () => undefined };
              },
              async set(data) {
                writes.profiles.push({ id, data });
              },
            };
          },
        };
      }

      if (
        name === 'pulsecheck-daily-assignments'
        || name === 'pulsecheck-assignment-events'
        || name === 'state-snapshots'
      ) {
        return {
          where() {
            return {
              async get() {
                return emptyQueryResult;
              },
            };
          },
        };
      }

      throw new Error(`Unexpected collection: ${name}`);
    },
  };
}

test('orchestratePostCheckIn materializes a protocol assignment when activeProgram is missing', async () => {
  const runtimeHelpers = loadRuntimeHelpers();
  const snapshot = {
    id: 'athlete-1_2026-03-18',
    athleteId: 'athlete-1',
    sourceDate: '2026-03-18',
    sourceCheckInId: 'checkin-1',
    overallReadiness: 'yellow',
    confidence: 'medium',
    recommendedRouting: 'protocol_only',
    recommendedProtocolClass: 'regulation',
    readinessScore: 58,
    supportFlag: false,
  };
  const db = createFirestoreDb({ snapshot });

  const assignment = await runtimeHelpers.orchestratePostCheckIn({
    db,
    athleteId: 'athlete-1',
    sourceCheckInId: 'checkin-1',
    sourceStateSnapshotId: snapshot.id,
    sourceCandidateSetId: 'candidate-set-1',
    sourceDate: snapshot.sourceDate,
    progress: {
      coachId: null,
      activeProgram: null,
      taxonomyProfile: {
        modifierScores: {
          readiness: 58,
        },
      },
    },
    candidateSet: {
      id: 'candidate-set-1',
      candidates: [
        {
          id: 'athlete-1_2026-03-18_box-breathing',
          type: 'protocol',
          label: 'Box Breathing',
          actionType: 'protocol',
          rationale: 'Use regulation work when readiness routes protocol-first.',
          protocolId: 'box-breathing',
          protocolLabel: 'Box Breathing',
          protocolClass: 'regulation',
          protocolCategory: 'breathing',
          protocolResponseFamily: 'regulation',
          protocolDeliveryMode: 'guided_audio',
          sessionType: 'regulation',
          durationMode: 'short',
          durationSeconds: 240,
        },
      ],
      plannerEligible: true,
    },
    plannerDecision: {
      decisionSource: 'fallback_rules',
      selectedCandidateId: 'athlete-1_2026-03-18_box-breathing',
      selectedCandidateType: 'protocol',
      actionType: 'protocol',
      confidence: 'medium',
      rationaleSummary: 'Fallback planner selected Box Breathing.',
      supportFlag: false,
    },
    liveProtocolRegistry: [],
  });

  assert.ok(assignment);
  assert.equal(assignment.id, 'athlete-1_2026-03-18');
  assert.equal(assignment.actionType, 'protocol');
  assert.equal(assignment.status, 'assigned');
  assert.equal(assignment.protocolId, 'box-breathing');
  assert.equal(assignment.protocolLabel, 'Box Breathing');
  assert.equal(assignment.simSpecId, undefined);
  assert.equal(assignment.sourceStateSnapshotId, snapshot.id);
  assert.equal(db.writes.assignments.length, 1);
  assert.equal(db.writes.snapshots.length, 1);
  assert.equal(db.writes.snapshots[0].data.executionLink, assignment.id);
});

test('getOrRefreshProtocolResponsivenessProfile reads assignment events without throwing', async () => {
  const runtimeHelpers = loadRuntimeHelpers();
  const db = createResponsivenessDb();

  const profile = await runtimeHelpers.getOrRefreshProtocolResponsivenessProfile({
    db,
    athleteId: 'athlete-1',
    protocolRegistry: [],
  });

  assert.equal(profile.athleteId, 'athlete-1');
  assert.deepEqual(profile.familyResponses, {});
  assert.deepEqual(profile.variantResponses, {});
  assert.equal(db.writes.profiles.length, 1);
  assert.equal(db.writes.profiles[0].id, 'athlete-1');
});

test('stripUndefinedDeep removes undefined optional check-in fields before persistence', async () => {
  const runtimeHelpers = loadRuntimeHelpers();

  const sanitized = runtimeHelpers.stripUndefinedDeep({
    userId: 'athlete-1',
    readinessScore: 4,
    moodWord: 'Solid',
    energyLevel: undefined,
    stressLevel: undefined,
    sleepQuality: undefined,
    taxonomyState: {
      readiness: 80,
      energyLevel: undefined,
    },
    rawSignalSummary: {
      explicitSelfReport: {
        moodWord: 'Solid',
        energyLevel: undefined,
      },
    },
  });

  assert.deepEqual(sanitized, {
    userId: 'athlete-1',
    readinessScore: 4,
    moodWord: 'Solid',
    taxonomyState: {
      readiness: 80,
    },
    rawSignalSummary: {
      explicitSelfReport: {
        moodWord: 'Solid',
      },
    },
  });
  assert.equal('energyLevel' in sanitized, false);
  assert.equal('stressLevel' in sanitized, false);
  assert.equal('sleepQuality' in sanitized, false);
});
