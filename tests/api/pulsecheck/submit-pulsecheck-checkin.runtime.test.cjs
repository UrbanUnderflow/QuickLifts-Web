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
    exports: {
      normalizeProtocolRecord: (record) => record,
      listPulseCheckProtocolSeedRecords: () => [],
    },
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

function createMaterializationDb({ snapshot, simModules = [], protocols = [] }) {
  const writes = {
    snapshots: [],
    assignments: [],
    revisions: [],
    progress: [],
    responsivenessProfiles: [],
    candidateSets: [],
  };

  const emptyQueryResult = { empty: true, docs: [] };

  function toDoc(id, data) {
    return {
      id,
      data: () => data,
    };
  }

  return {
    writes,
    batch() {
      const operations = [];
      return {
        set(ref, data) {
          operations.push({ ref, data });
        },
        async commit() {
          for (const operation of operations) {
            await operation.ref.set(operation.data);
          }
        },
      };
    },
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
          where(field, operator, value) {
            assert.equal(field, 'athleteId');
            assert.equal(operator, '==');
            if (value !== snapshot.athleteId) {
              return {
                async get() {
                  return emptyQueryResult;
                },
              };
            }
            return {
              async get() {
                return { empty: false, docs: [toDoc(snapshot.id, snapshot)] };
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
          where(field, operator, value) {
            assert.equal(field, 'athleteId');
            assert.equal(operator, '==');
            return {
              async get() {
                return { empty: true, docs: [] };
              },
            };
          },
        };
      }

      if (name === 'pulsecheck-assignment-events') {
        return {
          where(field, operator, value) {
            assert.equal(field, 'athleteId');
            assert.equal(operator, '==');
            return {
              async get() {
                return { empty: true, docs: [] };
              },
            };
          },
        };
      }

      if (name === 'pulsecheck-protocol-responsiveness-profiles') {
        return {
          doc(id) {
            return {
              async get() {
                return { exists: false, id, data: () => undefined };
              },
              async set(data) {
                writes.responsivenessProfiles.push({ id, data });
              },
            };
          },
        };
      }

      if (name === 'pulsecheck-assignment-candidate-sets') {
        return {
          doc(id) {
            return {
              async set(data) {
                writes.candidateSets.push({ id, data });
              },
            };
          },
        };
      }

      if (name === 'pulsecheck-protocols') {
        return {
          doc(id) {
            return {
              async set(data) {
                protocols.push({ id, ...data });
              },
            };
          },
          async get() {
            return {
              empty: protocols.length === 0,
              docs: protocols.map((protocol) => toDoc(protocol.id, protocol)),
            };
          },
        };
      }

      if (name === 'sim-modules') {
        return {
          async get() {
            return {
              empty: simModules.length === 0,
              docs: simModules.map((module) => toDoc(module.id, module)),
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
                    return { docs: [] };
                  },
                };
              },
              async get() {
                return { docs: [] };
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

test('orchestratePostCheckIn falls back to a bounded sim when AI defers despite a valid candidate', async () => {
  const runtimeHelpers = loadRuntimeHelpers();
  const snapshot = {
    id: 'athlete-1_2026-03-20',
    athleteId: 'athlete-1',
    sourceDate: '2026-03-20',
    sourceCheckInId: 'checkin-1',
    overallReadiness: 'green',
    confidence: 'medium',
    recommendedRouting: 'sim_only',
    readinessScore: 76,
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
        recommendedSimId: 'noise_gate',
        recommendedLegacyExerciseId: 'focus-noise-gate',
        sessionType: 'training_rep',
        durationMode: 'standard_rep',
        durationSeconds: 480,
      },
      taxonomyProfile: {
        modifierScores: {
          readiness: 76,
        },
      },
    },
    candidateSet: {
      id: 'candidate-set-1',
      candidates: [
        {
          id: 'athlete-1_2026-03-20_noise_gate',
          type: 'sim',
          label: 'Noise Gate',
          actionType: 'sim',
          rationale: 'Bounded simulation candidate from the active program recommendation.',
          simSpecId: 'noise_gate',
          legacyExerciseId: 'focus-noise-gate',
          sessionType: 'training_rep',
          durationMode: 'standard_rep',
          durationSeconds: 480,
        },
      ],
      plannerEligible: true,
    },
    plannerDecision: {
      decisionSource: 'ai',
      selectedCandidateId: undefined,
      selectedCandidateType: undefined,
      actionType: 'defer',
      confidence: 'low',
      rationaleSummary: 'AI incorrectly deferred despite a valid candidate.',
      supportFlag: false,
    },
    liveProtocolRegistry: [],
    liveSimRegistry: [],
  });

  assert.ok(assignment);
  assert.equal(assignment.actionType, 'sim');
  assert.equal(assignment.status, 'assigned');
  assert.equal(assignment.simSpecId, 'noise_gate');
  assert.equal(assignment.legacyExerciseId, 'focus-noise-gate');
});

test('rematerializeAssignmentFromSnapshot falls back to the bounded sim when the AI planner defers', async () => {
  const originalApiKey = process.env.OPEN_AI_SECRET_KEY;
  const originalFetch = global.fetch;
  process.env.OPEN_AI_SECRET_KEY = 'test-key';
  global.fetch = async () => ({
    ok: true,
    async json() {
      return {
        choices: [
          {
            message: {
              content: JSON.stringify({
                selectedCandidateId: '',
                selectedCandidateType: '',
                actionType: 'defer',
                confidence: 'low',
                rationaleSummary: 'AI deferred despite a valid sim candidate.',
                supportFlag: false,
              }),
            },
          },
        ],
      };
    },
  });

  try {
    const runtimeHelpers = loadRuntimeHelpers();
    const snapshot = {
      id: 'athlete-1_2026-03-20',
      athleteId: 'athlete-1',
      sourceDate: '2026-03-20',
      sourceCheckInId: 'checkin-1',
      overallReadiness: 'green',
      confidence: 'medium',
      recommendedRouting: 'sim_only',
      recommendedProtocolClass: 'none',
      candidateClassHints: [],
      contextTags: [],
      readinessScore: 78,
      supportFlag: false,
    };
    const db = createMaterializationDb({
      snapshot,
      simModules: [
        {
          id: 'focus-noise-gate',
          name: 'Noise Gate',
          simSpecId: 'noise_gate',
          isActive: true,
          publishedFingerprint: 'pub-1',
          syncStatus: 'in_sync',
          engineKey: 'pulsecheck',
          runtimeConfig: { version: 1 },
          buildArtifact: {
            sourceFingerprint: 'src-1',
            engineKey: 'pulsecheck',
          },
          variantSource: {
            family: 'Noise Gate',
            variantName: 'Noise Gate',
            publishedAt: 1773945600000,
          },
        },
      ],
      protocols: [
        {
          id: 'proto-box-breathing',
          label: 'Box Breathing',
          familyId: 'regulation-breathing',
          variantId: 'regulation-breathing-v1',
          isActive: true,
          publishStatus: 'published',
          governanceStage: 'approved',
          legacyExerciseId: 'box-breathing',
        },
      ],
    });

    const result = await runtimeHelpers.rematerializeAssignmentFromSnapshot({
      db,
      athleteId: 'athlete-1',
      sourceCheckInId: 'checkin-1',
      sourceStateSnapshotId: snapshot.id,
      sourceDate: snapshot.sourceDate,
      progress: {
        coachId: null,
        activeProgram: {
          recommendedSimId: 'noise_gate',
          recommendedLegacyExerciseId: 'focus-noise-gate',
          sessionType: 'training_rep',
          durationMode: 'standard_rep',
          durationSeconds: 480,
        },
      },
    });

    assert.ok(result.dailyAssignment);
    assert.equal(result.dailyAssignment.actionType, 'sim');
    assert.equal(result.dailyAssignment.status, 'assigned');
    assert.equal(result.dailyAssignment.simSpecId, 'noise_gate');
    assert.equal(result.dailyAssignment.legacyExerciseId, 'focus-noise-gate');
  } finally {
    process.env.OPEN_AI_SECRET_KEY = originalApiKey;
    global.fetch = originalFetch;
  }
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
