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

test('normalizeReadinessScore keeps the fresh check-in as the primary signal', async () => {
  const runtimeHelpers = loadRuntimeHelpers();

  const normalized = runtimeHelpers.normalizeReadinessScore({
    checkIn: {
      readinessScore: 5,
    },
    progress: {
      taxonomyProfile: {
        modifierScores: {
          readiness: 20,
        },
      },
    },
  });

  assert.equal(normalized, 88);
});

test('deriveRouting prefers protocol-only for an ordinary red training day', async () => {
  const runtimeHelpers = loadRuntimeHelpers();

  const routing = runtimeHelpers.deriveRouting({
    readiness: 'red',
    readinessScore: 40,
    dimensions: {
      activation: 74,
      focusReadiness: 42,
      emotionalLoad: 73,
      cognitiveFatigue: 66,
    },
    confidence: 'medium',
    contradictionFlags: [],
    progress: {
      activeProgram: {
        sessionType: 'training_rep',
        durationMode: 'standard_rep',
      },
    },
  });

  assert.equal(routing, 'protocol_only');
});

test('deriveRouting reserves defer-alternate-path for severe red high-cost days', async () => {
  const runtimeHelpers = loadRuntimeHelpers();

  const routing = runtimeHelpers.deriveRouting({
    readiness: 'red',
    readinessScore: 22,
    dimensions: {
      activation: 88,
      focusReadiness: 28,
      emotionalLoad: 86,
      cognitiveFatigue: 89,
    },
    confidence: 'medium',
    contradictionFlags: [],
    progress: {
      activeProgram: {
        sessionType: 'pressure_exposure',
        durationMode: 'extended_stress_test',
      },
    },
  });

  assert.equal(routing, 'defer_alternate_path');
});

test('deriveRecentAssignmentHistoryContext marks repeat defer risk after a recent Tier 0 defer', async () => {
  const runtimeHelpers = loadRuntimeHelpers();

  const history = runtimeHelpers.deriveRecentAssignmentHistoryContext([
    {
      id: 'athlete-1_2026-03-19',
      sourceDate: '2026-03-19',
      actionType: 'defer',
      status: 'deferred',
      escalationTier: 0,
      updatedAt: 20,
    },
    {
      id: 'athlete-1_2026-03-18',
      sourceDate: '2026-03-18',
      actionType: 'protocol',
      status: 'completed',
      escalationTier: 0,
      updatedAt: 10,
    },
  ]);

  assert.equal(history.recentTier0DeferCount, 1);
  assert.equal(history.consecutiveTier0Defers, 1);
  assert.equal(history.shouldAvoidRepeatDefer, true);
});

test('deriveRouting avoids a second consecutive Tier 0 defer when a protocol-first path is still viable', async () => {
  const runtimeHelpers = loadRuntimeHelpers();

  const routing = runtimeHelpers.deriveRouting({
    readiness: 'red',
    readinessScore: 28,
    dimensions: {
      activation: 87,
      focusReadiness: 24,
      emotionalLoad: 86,
      cognitiveFatigue: 84,
    },
    confidence: 'medium',
    contradictionFlags: [],
    recentAssignmentHistory: {
      shouldAvoidRepeatDefer: true,
      consecutiveTier0Defers: 1,
    },
    progress: {
      activeProgram: {
        sessionType: 'pressure_exposure',
        durationMode: 'extended_stress_test',
      },
    },
  });

  assert.equal(routing, 'protocol_only');
});

test('deriveRouting still allows defer when the repeat-defer day is critically red', async () => {
  const runtimeHelpers = loadRuntimeHelpers();

  const routing = runtimeHelpers.deriveRouting({
    readiness: 'red',
    readinessScore: 16,
    dimensions: {
      activation: 93,
      focusReadiness: 18,
      emotionalLoad: 92,
      cognitiveFatigue: 95,
    },
    confidence: 'medium',
    contradictionFlags: [],
    recentAssignmentHistory: {
      shouldAvoidRepeatDefer: true,
      consecutiveTier0Defers: 1,
    },
    progress: {
      activeProgram: {
        sessionType: 'pressure_exposure',
        durationMode: 'extended_stress_test',
      },
    },
  });

  assert.equal(routing, 'defer_alternate_path');
});

test('buildAssignmentCandidateSet excludes unpublished sim recommendations', async () => {
  const runtimeHelpers = loadRuntimeHelpers();

  const candidateSet = runtimeHelpers.buildAssignmentCandidateSet({
    athleteId: 'athlete-1',
    sourceDate: '2026-03-18',
    snapshot: {
      id: 'athlete-1_2026-03-18',
      athleteId: 'athlete-1',
      sourceDate: '2026-03-18',
      recommendedRouting: 'sim_only',
      candidateClassHints: ['sim'],
      overallReadiness: 'green',
    },
    progress: {
      activeProgram: {
        recommendedSimId: 'endurance_lock',
        recommendedLegacyExerciseId: 'focus-endurance-lock',
        sessionType: 'training_rep',
        durationMode: 'standard_rep',
        durationSeconds: 480,
      },
    },
    liveProtocolRegistry: [],
    liveSimRegistry: [],
    responsivenessProfile: null,
  });

  assert.deepEqual(candidateSet.candidates, []);
  assert.equal(candidateSet.plannerEligible, false);
  assert.match(candidateSet.inventoryGaps[0], /not currently published and launchable/i);
});

test('buildAssignmentCandidateSet includes protocol alternatives for deferred alternate-path routing and prefers matching visualization category', async () => {
  const runtimeHelpers = loadRuntimeHelpers();

  const candidateSet = runtimeHelpers.buildAssignmentCandidateSet({
    athleteId: 'athlete-1',
    sourceDate: '2026-03-20',
    snapshot: {
      id: 'athlete-1_2026-03-20',
      athleteId: 'athlete-1',
      sourceDate: '2026-03-20',
      recommendedRouting: 'defer_alternate_path',
      recommendedProtocolClass: 'priming',
      candidateClassHints: ['protocol'],
      overallReadiness: 'yellow',
      contextTags: ['visualization', 'pre_training'],
    },
    progress: {
      activeProgram: {
        recommendedSimId: 'endurance_lock',
        recommendedLegacyExerciseId: 'focus-endurance-lock',
        sessionType: 'training_rep',
        durationMode: 'standard_rep',
        durationSeconds: 480,
      },
    },
    liveProtocolRegistry: [
      {
        id: 'proto-focus',
        label: 'Focus Primer',
        familyId: 'priming-focus',
        variantId: 'priming-focus--v1',
        legacyExerciseId: 'focus-primer',
        protocolClass: 'priming',
        category: 'focus',
        preferredContextTags: ['pre_training'],
        triggerTags: [],
        useWindowTags: [],
      },
      {
        id: 'proto-visualization',
        label: 'Visualization Primer',
        familyId: 'priming-visualization',
        variantId: 'priming-visualization--v1',
        legacyExerciseId: 'visualization-primer',
        protocolClass: 'priming',
        category: 'visualization',
        preferredContextTags: ['pre_training'],
        triggerTags: [],
        useWindowTags: [],
      },
    ],
    liveSimRegistry: [],
    responsivenessProfile: null,
  });

  assert.equal(candidateSet.plannerEligible, true);
  assert.equal(candidateSet.candidates[0].type, 'protocol');
  assert.equal(candidateSet.candidates[0].protocolLabel, 'Visualization Primer');
});

test('orchestratePostCheckIn defers when the recommended sim is not published', async () => {
  const runtimeHelpers = loadRuntimeHelpers();
  const snapshot = {
    id: 'athlete-1_2026-03-18',
    athleteId: 'athlete-1',
    sourceDate: '2026-03-18',
    sourceCheckInId: 'checkin-1',
    overallReadiness: 'green',
    confidence: 'medium',
    recommendedRouting: 'sim_only',
    readinessScore: 78,
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
      activeProgram: {
        recommendedSimId: 'endurance_lock',
        recommendedLegacyExerciseId: 'focus-endurance-lock',
        sessionType: 'training_rep',
        durationMode: 'standard_rep',
        durationSeconds: 480,
        rationale: 'Taxonomy profile still points to Endurance Lock.',
      },
      taxonomyProfile: {
        modifierScores: {
          readiness: 78,
        },
      },
    },
    candidateSet: {
      id: 'candidate-set-1',
      candidates: [],
      plannerEligible: false,
      inventoryGaps: ['Endurance Lock is not currently published and launchable, so Nora should not assign it yet.'],
    },
    plannerDecision: null,
    liveProtocolRegistry: [],
    liveSimRegistry: [],
  });

  assert.ok(assignment);
  assert.equal(assignment.actionType, 'defer');
  assert.equal(assignment.status, 'deferred');
  assert.equal(assignment.simSpecId, undefined);
  assert.equal(assignment.legacyExerciseId, undefined);
});

test('orchestratePostCheckIn can materialize a protocol alternative from a deferred alternate-path day', async () => {
  const runtimeHelpers = loadRuntimeHelpers();
  const snapshot = {
    id: 'athlete-1_2026-03-20',
    athleteId: 'athlete-1',
    sourceDate: '2026-03-20',
    sourceCheckInId: 'checkin-visualization',
    overallReadiness: 'yellow',
    confidence: 'medium',
    recommendedRouting: 'defer_alternate_path',
    recommendedProtocolClass: 'priming',
    candidateClassHints: ['protocol'],
    contextTags: ['visualization', 'pre_training'],
    readinessScore: 62,
    supportFlag: false,
  };
  const db = createFirestoreDb({ snapshot });

  const candidateSet = runtimeHelpers.buildAssignmentCandidateSet({
    athleteId: 'athlete-1',
    sourceDate: snapshot.sourceDate,
    snapshot,
    progress: {
      coachId: null,
      activeProgram: {
        recommendedSimId: 'endurance_lock',
        recommendedLegacyExerciseId: 'focus-endurance-lock',
        sessionType: 'training_rep',
        durationMode: 'standard_rep',
        durationSeconds: 480,
      },
    },
    liveProtocolRegistry: [
      {
        id: 'proto-visualization',
        label: 'Visualization Primer',
        familyId: 'priming-visualization',
        variantId: 'priming-visualization--v1',
        legacyExerciseId: 'visualization-primer',
        protocolClass: 'priming',
        category: 'visualization',
        preferredContextTags: ['pre_training'],
        triggerTags: [],
        useWindowTags: [],
      },
    ],
    liveSimRegistry: [],
    responsivenessProfile: null,
  });

  const assignment = await runtimeHelpers.orchestratePostCheckIn({
    db,
    athleteId: 'athlete-1',
    sourceCheckInId: 'checkin-visualization',
    sourceStateSnapshotId: snapshot.id,
    sourceCandidateSetId: candidateSet.id,
    sourceDate: snapshot.sourceDate,
    progress: {
      coachId: null,
      activeProgram: {
        recommendedSimId: 'endurance_lock',
        recommendedLegacyExerciseId: 'focus-endurance-lock',
        sessionType: 'training_rep',
        durationMode: 'standard_rep',
        durationSeconds: 480,
        rationale: 'No published sim is available, so use a bounded support rep instead.',
      },
      taxonomyProfile: {
        modifierScores: {
          readiness: 62,
        },
      },
    },
    candidateSet,
    plannerDecision: null,
    liveProtocolRegistry: [],
    liveSimRegistry: [],
  });

  assert.ok(assignment);
  assert.equal(assignment.actionType, 'protocol');
  assert.equal(assignment.status, 'assigned');
  assert.equal(assignment.protocolLabel, 'Visualization Primer');
  assert.equal(assignment.legacyExerciseId, 'visualization-primer');
});
