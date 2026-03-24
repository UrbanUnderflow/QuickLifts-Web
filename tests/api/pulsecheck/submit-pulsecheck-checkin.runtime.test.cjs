const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const repoRoot = '/Users/tremainegrant/Documents/GitHub/QuickLifts-Web';
const submitPath = path.join(repoRoot, 'netlify/functions/submit-pulsecheck-checkin.js');
const configPath = path.join(repoRoot, 'netlify/functions/config/firebase.js');
const profileRuntimePath = path.join(repoRoot, 'src/api/firebase/mentaltraining/profileSnapshotRuntime.js');
const protocolRegistryRuntimePath = path.join(repoRoot, 'src/api/firebase/mentaltraining/protocolRegistryRuntime.js');

function loadRuntimeHelpers({ profileRuntimeMock = {} } = {}) {
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
    exports: profileRuntimeMock,
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

function loadSubmitModule({ db, decodedUid = 'athlete-1', profileRuntimeMock = {} }) {
  delete require.cache[submitPath];
  delete require.cache[configPath];
  delete require.cache[profileRuntimePath];
  delete require.cache[protocolRegistryRuntimePath];

  const firestoreFn = () => db;
  firestoreFn.FieldValue = {
    serverTimestamp: () => 'server-timestamp',
  };

  require.cache[configPath] = {
    id: configPath,
    filename: configPath,
    loaded: true,
    exports: {
      initializeFirebaseAdmin: () => {},
      getFirebaseAdminApp: () => ({}),
      admin: {
        auth: () => ({
          verifyIdToken: async () => ({ uid: decodedUid }),
        }),
        firestore: firestoreFn,
      },
      headers: {},
    },
  };

  require.cache[profileRuntimePath] = {
    id: profileRuntimePath,
    filename: profileRuntimePath,
    loaded: true,
    exports: profileRuntimeMock,
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

  return require(submitPath);
}

function parseBody(response) {
  assert.equal(response.statusCode, 200);
  return JSON.parse(response.body);
}

function createFirestoreDb({ snapshot, existingAssignment = null, trainingPlans = [], snapshotOverrides = {} }) {
  const writes = {
    snapshots: [],
    assignments: [],
    revisions: [],
    progress: [],
    trainingPlans: [],
    checkIns: [],
    assignmentEvents: [],
    responsivenessProfiles: [],
  };

  const emptyQueryResult = { docs: [], empty: true };
  const trainingPlanStore = new Map((trainingPlans || []).map((plan) => [plan.id, plan]));
  const assignmentStore = new Map();
  if (existingAssignment) {
    assignmentStore.set(existingAssignment.id, existingAssignment);
  }

  return {
    writes,
    batch() {
      const operations = [];
      return {
        set(ref, data, options) {
          operations.push({ type: 'set', ref, data, merge: Boolean(options && options.merge) });
        },
        delete(ref) {
          operations.push({ type: 'delete', ref });
        },
        async commit() {
          for (const operation of operations) {
            if (operation.type === 'set') {
              await operation.ref.set(operation.data, operation.merge ? { merge: true } : undefined);
            } else if (operation.type === 'delete' && typeof operation.ref.delete === 'function') {
              await operation.ref.delete();
            }
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
                const writeSnapshot = writes.snapshots.find((entry) => entry.id === id)?.data;
                const storedSnapshot = writeSnapshot || (id === snapshot.id ? snapshot : undefined) || snapshotOverrides[id];
                if (storedSnapshot) {
                  return { exists: true, id, data: () => storedSnapshot };
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
            const docs = [];
            const primarySnapshot = snapshot?.athleteId === value ? [{ id: snapshot.id, data: snapshot }] : [];
            const overrideSnapshots = Object.entries(snapshotOverrides || {})
              .filter(([, data]) => data?.athleteId === value)
              .map(([id, data]) => ({ id, data }));
            const writtenSnapshots = writes.snapshots
              .filter((entry) => entry.data?.athleteId === value)
              .map((entry) => ({ id: entry.id, data: entry.data }));

            primarySnapshot
              .concat(overrideSnapshots)
              .concat(writtenSnapshots)
              .forEach((entry) => {
                if (!docs.some((existing) => existing.id === entry.id)) {
                  docs.push({ id: entry.id, data: () => entry.data });
                }
              });

            return {
              async get() {
                return { empty: docs.length === 0, docs };
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
                const storedAssignment = assignmentStore.get(id);
                if (storedAssignment) {
                  return { exists: true, id, data: () => storedAssignment };
                }
                return { exists: false, id, data: () => undefined };
              },
              async set(data) {
                assignmentStore.set(id, data);
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
            const docs = Array.from(assignmentStore.entries())
              .filter(([, assignment]) => assignment?.athleteId === value)
              .map(([id, assignment]) => ({ id, data: () => assignment }));
            return {
              async get() {
                return { empty: docs.length === 0, docs };
              },
            };
          },
        };
      }

      if (name === 'pulsecheck-training-plans') {
        return {
          doc(id) {
            return {
              async get() {
                const storedPlan = trainingPlanStore.get(id);
                if (!storedPlan) {
                  return { exists: false, id, data: () => undefined };
                }
                return { exists: true, id, data: () => storedPlan };
              },
              async set(data) {
                const nextPlan = { ...(trainingPlanStore.get(id) || {}), ...data };
                trainingPlanStore.set(id, nextPlan);
                writes.trainingPlans.push({ id, data: nextPlan });
              },
            };
          },
          where(field, operator, value) {
            assert.equal(field, 'athleteId');
            assert.equal(operator, '==');
            const plans = Array.from(trainingPlanStore.entries())
              .filter(([, plan]) => plan.athleteId === value)
              .map(([id, plan]) => ({ id, ...plan }));
            return {
              async get() {
                return {
                  docs: plans.map((plan) => ({ id: plan.id, data: () => plan })),
                  empty: plans.length === 0,
                };
              },
            };
          },
        };
      }

      if (name === 'pulsecheck-assignment-events') {
        return {
          doc(id = `event-${writes.assignmentEvents.length + 1}`) {
            return {
              id,
              async set(data) {
                writes.assignmentEvents.push({ id, data });
              },
            };
          },
          where() {
            return {
              async get() {
                return emptyQueryResult;
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
                writes.candidateSets = writes.candidateSets || [];
                writes.candidateSets.push({ id, data });
              },
            };
          },
        };
      }

      if (name === 'pulsecheck-protocols' || name === 'sim-modules') {
        return {
          async get() {
            return emptyQueryResult;
          },
          doc(id) {
            return {
              async set() {
                return undefined;
              },
            };
          },
        };
      }

      if (name === 'mental-check-ins') {
        return {
          doc(id) {
            return {
              collection(childName) {
                assert.equal(childName, 'check-ins');
                return {
                  orderBy() {
                    return this;
                  },
                  limit() {
                    return this;
                  },
                  async get() {
                    return {
                      docs: [],
                      empty: true,
                    };
                  },
                  async add(data) {
                    writes.checkIns.push({ userId: id, data });
                    return { id: `check-in-${writes.checkIns.length}` };
                  },
                };
              },
            };
          },
        };
      }

      if (name === 'sim-sessions') {
        return {
          doc(id) {
            return {
              collection(childName) {
                assert.equal(childName, 'sessions');
                return {
                  orderBy() {
                    return this;
                  },
                  limit() {
                    return this;
                  },
                  async get() {
                    return {
                      docs: [],
                      empty: true,
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
              async get() {
                return { exists: false, id, data: () => undefined };
              },
              async set(data) {
                writes.progress.push({ id, data });
              },
              collection(childName) {
                assert.equal(childName, 'check-ins');
                return {
                  async add(data) {
                    writes.checkIns.push({ userId: id, data });
                    return { id: `progress-check-in-${writes.checkIns.length}` };
                  },
                };
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

function createMaterializationDb({ snapshot, simModules = [], protocols = [], trainingPlans = [] }) {
  const writes = {
    snapshots: [],
    assignments: [],
    revisions: [],
    progress: [],
    responsivenessProfiles: [],
    candidateSets: [],
    trainingPlans: [],
  };

  const emptyQueryResult = { empty: true, docs: [] };
  const trainingPlanStore = new Map((trainingPlans || []).map((plan) => [plan.id, plan]));
  const assignmentStore = new Map();

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
                const storedAssignment = assignmentStore.get(id);
                if (storedAssignment) {
                  return { exists: true, id, data: () => storedAssignment };
                }
                return { exists: false, id, data: () => undefined };
              },
              async set(data) {
                assignmentStore.set(id, data);
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
            const docs = Array.from(assignmentStore.entries())
              .filter(([, assignment]) => assignment.athleteId === value)
              .map(([id, assignment]) => toDoc(id, assignment));
            return {
              async get() {
                return {
                  empty: docs.length === 0,
                  docs,
                };
              },
            };
          },
        };
      }

      if (name === 'pulsecheck-training-plans') {
        return {
          doc(id) {
            return {
              async get() {
                const storedPlan = trainingPlanStore.get(id);
                if (!storedPlan) {
                  return { exists: false, id, data: () => undefined };
                }
                return { exists: true, id, data: () => storedPlan };
              },
              async set(data) {
                const nextPlan = { ...(trainingPlanStore.get(id) || {}), ...data };
                trainingPlanStore.set(id, nextPlan);
                writes.trainingPlans.push({ id, data: nextPlan });
              },
            };
          },
          where(field, operator, value) {
            assert.equal(field, 'athleteId');
            assert.equal(operator, '==');
            const plans = Array.from(trainingPlanStore.entries())
              .filter(([, plan]) => plan.athleteId === value)
              .map(([id, plan]) => ({ id, ...plan }));
            return {
              async get() {
                return {
                  empty: plans.length === 0,
                  docs: plans.map((plan) => toDoc(plan.id, plan)),
                };
              },
            };
          },
        };
      }

      if (name === 'pulsecheck-assignment-events') {
        return {
          doc(id = `event-${writes.assignmentEvents?.length || 0}`) {
            return {
              id,
              async set(data) {
                writes.assignmentEvents = writes.assignmentEvents || [];
                writes.assignmentEvents.push({ id, data });
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

test('orchestratePostCheckIn preserves a deferred assignment because deferred tasks are not mutable', async () => {
  const runtimeHelpers = loadRuntimeHelpers();
  const snapshot = {
    id: 'athlete-1_2026-03-20',
    athleteId: 'athlete-1',
    sourceDate: '2026-03-20',
    sourceCheckInId: 'checkin-1',
    overallReadiness: 'green',
    confidence: 'medium',
    recommendedRouting: 'protocol_then_sim',
    recommendedProtocolClass: 'regulation',
    readinessScore: 76,
    supportFlag: false,
  };
  const db = createFirestoreDb({
    snapshot,
    existingAssignment: {
      id: 'athlete-1_2026-03-20',
      athleteId: 'athlete-1',
      sourceDate: '2026-03-20',
      status: 'deferred',
      actionType: 'defer',
      rationale: 'Stale deferred assignment should be replaced.',
      revision: 1,
    },
  });

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
          id: 'athlete-1_2026-03-20_protocol-perfect-execution-replay',
          type: 'protocol',
          label: 'Perfect Execution Replay',
          actionType: 'protocol',
          rationale: 'Protocol-first candidate from the bounded set.',
          protocolId: 'protocol-perfect-execution-replay',
          protocolLabel: 'Perfect Execution Replay',
          protocolClass: 'regulation',
          protocolCategory: 'visualization',
          protocolResponseFamily: 'regulation',
          protocolDeliveryMode: 'guided_audio',
          sessionType: 'regulation',
          durationMode: 'short',
          durationSeconds: 240,
        },
        {
          id: 'athlete-1_2026-03-20_noise_gate',
          type: 'sim',
          label: 'Noise Gate',
          actionType: 'lighter_sim',
          rationale: 'Simulation candidate from the active program recommendation.',
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
      selectedCandidateId: 'athlete-1_2026-03-20_protocol-perfect-execution-replay',
      selectedCandidateType: 'protocol',
      actionType: 'protocol',
      confidence: 'medium',
      rationaleSummary: 'Start with the protocol candidate.',
      supportFlag: false,
    },
    liveProtocolRegistry: [],
    liveSimRegistry: [],
  });

  assert.ok(assignment);
  assert.equal(assignment.actionType, 'defer');
  assert.equal(assignment.status, 'deferred');
  assert.equal(db.writes.assignments.length, 0);
  assert.equal(db.writes.revisions.length, 0);
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

test('buildAssignmentCandidateSet resolves generic sim families to published variant records', async () => {
  const runtimeHelpers = loadRuntimeHelpers();

  const candidateSet = runtimeHelpers.buildAssignmentCandidateSet({
    athleteId: 'athlete-1',
    sourceDate: '2026-03-21',
    snapshot: {
      id: 'athlete-1_2026-03-21',
      athleteId: 'athlete-1',
      sourceDate: '2026-03-21',
      recommendedRouting: 'sim_only',
      candidateClassHints: ['sim'],
      overallReadiness: 'yellow',
    },
    progress: {
      activeProgram: {
        recommendedSimId: 'endurance_lock',
        recommendedLegacyExerciseId: 'focus-endurance-lock',
        sessionType: 'training_rep',
        durationMode: 'extended_stress_test',
        durationSeconds: 480,
      },
    },
    liveProtocolRegistry: [],
    liveSimRegistry: [
      {
        id: 'endurance-lock-library-burn-rate',
        simSpecId: 'endurance-lock-library-burn-rate',
        name: 'Burn Rate',
        engineKey: 'endurance_lock',
        buildArtifact: {
          engineKey: 'endurance_lock',
        },
        variantSource: {
          family: 'Endurance Lock',
          variantName: 'Burn Rate',
        },
        sortOrder: 1,
      },
      {
        id: 'endurance-lock-library-grind-line',
        simSpecId: 'endurance-lock-library-grind-line',
        name: 'Grind Line',
        engineKey: 'endurance_lock',
        buildArtifact: {
          engineKey: 'endurance_lock',
        },
        variantSource: {
          family: 'Endurance Lock',
          variantName: 'Grind Line',
        },
        sortOrder: 2,
      },
    ],
    responsivenessProfile: null,
  });

  assert.equal(candidateSet.candidates.length, 1);
  assert.equal(candidateSet.plannerEligible, true);
  assert.equal(candidateSet.candidates[0].type, 'sim');
  assert.equal(candidateSet.candidates[0].actionType, 'lighter_sim');
  assert.equal(candidateSet.candidates[0].simSpecId, 'endurance-lock-library-burn-rate');
  assert.equal(candidateSet.candidates[0].legacyExerciseId, 'endurance-lock-library-burn-rate');
  assert.equal(candidateSet.candidates[0].familyLabel, 'Endurance Lock');
  assert.equal(candidateSet.candidates[0].variantLabel, 'Burn Rate');
  assert.equal(candidateSet.inventoryGaps.length, 0);
});

test('buildAssignmentCandidateSet falls back to the snapshot active program context when synced progress drifts', async () => {
  const runtimeHelpers = loadRuntimeHelpers();

  const candidateSet = runtimeHelpers.buildAssignmentCandidateSet({
    athleteId: 'athlete-1',
    sourceDate: '2026-03-21',
    snapshot: {
      id: 'athlete-1_2026-03-21',
      athleteId: 'athlete-1',
      sourceDate: '2026-03-21',
      recommendedRouting: 'sim_only',
      candidateClassHints: ['sim'],
      overallReadiness: 'green',
      rawSignalSummary: {
        activeProgramContext: {
          recommendedSimId: 'noise_gate',
          recommendedLegacyExerciseId: 'focus-noise-gate',
          sessionType: 'training_rep',
          durationMode: 'standard_rep',
        },
      },
    },
    progress: {
      activeProgram: {
        recommendedSimId: 'stale_unpublished_sim',
        recommendedLegacyExerciseId: 'stale-unpublished-sim',
        sessionType: 'training_rep',
        durationMode: 'standard_rep',
        durationSeconds: 480,
        rationale: 'A later profile sync drifted to a different recommendation.',
      },
    },
    liveProtocolRegistry: [],
    liveSimRegistry: [
      {
        id: 'focus-noise-gate',
        simSpecId: 'noise_gate',
        name: 'Noise Gate',
      },
    ],
    responsivenessProfile: null,
  });

  assert.equal(candidateSet.candidates.length, 1);
  assert.equal(candidateSet.candidates[0].type, 'sim');
  assert.equal(candidateSet.candidates[0].simSpecId, 'noise_gate');
  assert.equal(candidateSet.candidates[0].legacyExerciseId, 'focus-noise-gate');
  assert.equal(candidateSet.inventoryGaps.length, 0);
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

test('orchestratePostCheckIn materializes into an existing training plan step and carries plan metadata', async () => {
  const runtimeHelpers = loadRuntimeHelpers();
  const snapshot = {
    id: 'athlete-1_2026-03-20',
    athleteId: 'athlete-1',
    sourceDate: '2026-03-20',
    sourceCheckInId: 'checkin-1',
    overallReadiness: 'yellow',
    confidence: 'medium',
    recommendedRouting: 'sim_only',
    readinessScore: 61,
    supportFlag: false,
  };
  const assignmentId = `${snapshot.athleteId}_${snapshot.sourceDate}`;
  const planStepId = 'training-plan-1_step_0001';
  const trainingPlan = {
    id: 'training-plan-1',
    athleteId: 'athlete-1',
    title: 'Steady Focus Build',
    goal: 'Hold steady focus without forcing pace.',
    planType: 'sim_focused',
    status: 'active',
    isPrimary: true,
    progressMode: 'sessions',
    targetCount: 5,
    completedCount: 1,
    steps: [
      {
        id: planStepId,
        stepIndex: 1,
        stepLabel: 'Endurance Lock',
        stepStatus: 'planned',
        actionType: 'sim',
        exerciseId: 'endurance_lock',
        linkedDailyTaskId: assignmentId,
        linkedDailyTaskSourceDate: snapshot.sourceDate,
        dueSourceDate: snapshot.sourceDate,
        timezone: 'America/New_York',
      },
    ],
    assignedBy: 'nora',
    sourceDate: snapshot.sourceDate,
    timezone: 'America/New_York',
    createdAt: 1742420000000,
    updatedAt: 1742420000000,
  };
  const db = createFirestoreDb({
    snapshot,
    trainingPlans: [trainingPlan],
  });

  const assignment = await runtimeHelpers.orchestratePostCheckIn({
    db,
    athleteId: 'athlete-1',
    sourceCheckInId: 'checkin-1',
    sourceStateSnapshotId: snapshot.id,
    sourceCandidateSetId: 'candidate-set-1',
    sourceDate: snapshot.sourceDate,
    timezone: 'America/New_York',
    progress: {
      coachId: null,
      activeProgram: {
        recommendedSimId: 'endurance_lock',
        recommendedLegacyExerciseId: 'focus-endurance-lock',
        sessionType: 'training_rep',
        durationMode: 'standard_rep',
        durationSeconds: 480,
        rationale: 'Keep the rep steady and build from there.',
      },
      taxonomyProfile: {
        modifierScores: {
          readiness: 61,
        },
      },
    },
    candidateSet: {
      id: 'candidate-set-1',
      candidates: [
        {
          id: 'athlete-1_2026-03-20_endurance-lock',
          type: 'sim',
          label: 'Endurance Lock',
          actionType: 'sim',
          rationale: 'Plan-backed steady-focus rep.',
          simSpecId: 'endurance_lock',
          legacyExerciseId: 'focus-endurance-lock',
          sessionType: 'training_rep',
          durationMode: 'standard_rep',
          durationSeconds: 480,
        },
      ],
      plannerEligible: true,
    },
    plannerDecision: {
      decisionSource: 'ai',
      selectedCandidateId: 'athlete-1_2026-03-20_endurance-lock',
      selectedCandidateType: 'sim',
      actionType: 'sim',
      confidence: 'medium',
      rationaleSummary: 'Use the existing focus build step.',
      supportFlag: false,
    },
    liveProtocolRegistry: [],
    liveSimRegistry: [],
  });

  assert.ok(assignment);
  assert.equal(assignment.trainingPlanId, trainingPlan.id);
  assert.equal(typeof assignment.trainingPlanStepId, 'string');
  assert.equal(assignment.trainingPlanStepId.startsWith(trainingPlan.id), true);
  assert.equal(typeof assignment.trainingPlanStepIndex, 'number');
  assert.equal(assignment.trainingPlanStepLabel.length > 0, true);
  assert.equal(assignment.trainingPlanIsPrimary, true);
  assert.equal(assignment.timezone, 'America/New_York');
  assert.equal(db.writes.trainingPlans.length > 0, true);
  assert.equal(db.writes.trainingPlans[0].data.steps.some((step) => step.stepStatus === 'active_today'), true);
  assert.equal(db.writes.trainingPlans[0].data.steps.some((step) => step.linkedDailyTaskId === assignmentId), true);
});

test('orchestratePostCheckIn does not rematerialize when coachFrozen blocks the assignment', async () => {
  const runtimeHelpers = loadRuntimeHelpers();
  const snapshot = {
    id: 'athlete-1_2026-03-21',
    athleteId: 'athlete-1',
    sourceDate: '2026-03-21',
    sourceCheckInId: 'checkin-2',
    overallReadiness: 'green',
    confidence: 'medium',
    recommendedRouting: 'sim_only',
    readinessScore: 74,
    supportFlag: false,
  };
  const existingAssignment = {
    id: `${snapshot.athleteId}_${snapshot.sourceDate}`,
    lineageId: `${snapshot.athleteId}_${snapshot.sourceDate}`,
    revision: 1,
    athleteId: 'athlete-1',
    teamId: 'team-1',
    teamMembershipId: 'membership-1',
    sourceCheckInId: 'checkin-1',
    sourceStateSnapshotId: 'athlete-1_2026-03-20',
    sourceCandidateSetId: 'candidate-set-previous',
    sourceDate: snapshot.sourceDate,
    timezone: 'America/New_York',
    status: 'assigned',
    actionType: 'sim',
    executionLock: {
      coachFrozen: true,
      lockedAt: 1742420000000,
      lockedBy: 'coach-1',
      lockedByRole: 'coach',
      lockReason: 'Coach held today steady.',
    },
    createdAt: 1742420000000,
    updatedAt: 1742420000000,
  };
  const db = createFirestoreDb({
    snapshot,
    existingAssignment,
  });

  const assignment = await runtimeHelpers.orchestratePostCheckIn({
    db,
    athleteId: 'athlete-1',
    sourceCheckInId: 'checkin-2',
    sourceStateSnapshotId: snapshot.id,
    sourceCandidateSetId: 'candidate-set-2',
    sourceDate: snapshot.sourceDate,
    timezone: 'America/New_York',
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
          readiness: 74,
        },
      },
    },
    candidateSet: {
      id: 'candidate-set-2',
      candidates: [],
      plannerEligible: false,
    },
    plannerDecision: null,
    liveProtocolRegistry: [],
    liveSimRegistry: [],
  });

  assert.equal(assignment.id, existingAssignment.id);
  assert.equal(db.writes.assignments.length, 0);
});

test('handler materializes against the athlete-local day before 4am and preserves timezone on the assignment', async () => {
  const originalNow = Date.now;
  const fixedNow = new Date('2026-03-20T03:30:00-04:00').getTime();
  Date.now = () => fixedNow;

  try {
    const db = createFirestoreDb({
      snapshot: {
        id: 'athlete-1_2026-03-19',
        athleteId: 'athlete-1',
        sourceDate: '2026-03-19',
        sourceCheckInId: 'checkin-rollover',
        overallReadiness: 'yellow',
        confidence: 'medium',
        recommendedRouting: 'sim_only',
        recommendedProtocolClass: 'none',
        stateDimensions: {
          activation: 58,
          focusReadiness: 52,
          emotionalLoad: 44,
          cognitiveFatigue: 40,
        },
      },
    });

    const { handler } = loadSubmitModule({
      db,
      decodedUid: 'athlete-1',
      profileRuntimeMock: {
        PROFILE_VERSION: 'test-v1',
        buildInitialAthleteProgress: (athleteId) => ({ athleteId }),
        buildTaxonomyCheckInState: ({ readinessScore, moodWord }) => ({
          readinessScore,
          moodWord,
        }),
        deriveTaxonomyProfile: () => ({
          modifierScores: {
            readiness: 61,
          },
        }),
        prescribeNextSession: () => ({
          recommendedSimId: 'endurance_lock',
          recommendedLegacyExerciseId: 'focus-endurance-lock',
          sessionType: 'training_rep',
          durationMode: 'standard_rep',
          durationSeconds: 480,
        }),
      },
    });

    const response = parseBody(await handler({
      httpMethod: 'POST',
      headers: { authorization: 'Bearer token' },
      body: JSON.stringify({
        readinessScore: 4,
        moodWord: 'okay',
        timezone: 'America/New_York',
      }),
    }));

    assert.equal(response.stateSnapshot.sourceDate, '2026-03-19');
    assert.equal(response.dailyAssignment.sourceDate, '2026-03-19');
    assert.equal(response.dailyAssignment.timezone, 'America/New_York');
    assert.equal(db.writes.assignments[0].data.sourceDate, '2026-03-19');
    assert.equal(db.writes.assignments[0].data.timezone, 'America/New_York');
    assert.equal(db.writes.checkIns[0].data.date, '2026-03-19');
  } finally {
    Date.now = originalNow;
  }
});

test('handler materializes against the athlete-local day after 4am using the current timezone day', async () => {
  const originalNow = Date.now;
  const fixedNow = new Date('2026-03-20T05:15:00-04:00').getTime();
  Date.now = () => fixedNow;

  try {
    const db = createFirestoreDb({
      snapshot: {
        id: 'athlete-1_2026-03-20',
        athleteId: 'athlete-1',
        sourceDate: '2026-03-20',
        sourceCheckInId: 'checkin-rollover',
        overallReadiness: 'yellow',
        confidence: 'medium',
        recommendedRouting: 'sim_only',
        recommendedProtocolClass: 'none',
        stateDimensions: {
          activation: 58,
          focusReadiness: 52,
          emotionalLoad: 44,
          cognitiveFatigue: 40,
        },
      },
    });

    const { handler } = loadSubmitModule({
      db,
      decodedUid: 'athlete-1',
      profileRuntimeMock: {
        PROFILE_VERSION: 'test-v1',
        buildInitialAthleteProgress: (athleteId) => ({ athleteId }),
        buildTaxonomyCheckInState: ({ readinessScore, moodWord }) => ({
          readinessScore,
          moodWord,
        }),
        deriveTaxonomyProfile: () => ({
          modifierScores: {
            readiness: 61,
          },
        }),
        prescribeNextSession: () => ({
          recommendedSimId: 'endurance_lock',
          recommendedLegacyExerciseId: 'focus-endurance-lock',
          sessionType: 'training_rep',
          durationMode: 'standard_rep',
          durationSeconds: 480,
        }),
      },
    });

    const response = parseBody(await handler({
      httpMethod: 'POST',
      headers: { authorization: 'Bearer token' },
      body: JSON.stringify({
        readinessScore: 4,
        moodWord: 'okay',
        timezone: 'America/New_York',
      }),
    }));

    assert.equal(response.stateSnapshot.sourceDate, '2026-03-20');
    assert.equal(response.dailyAssignment.sourceDate, '2026-03-20');
    assert.equal(response.dailyAssignment.timezone, 'America/New_York');
    assert.equal(db.writes.assignments[0].data.sourceDate, '2026-03-20');
    assert.equal(db.writes.assignments[0].data.timezone, 'America/New_York');
    assert.equal(db.writes.checkIns[0].data.date, '2026-03-20');
  } finally {
    Date.now = originalNow;
  }
});

test('orchestratePostCheckIn preserves an existing completed assignment instead of rematerializing it', async () => {
  const runtimeHelpers = loadRuntimeHelpers();
  const snapshot = {
    id: 'athlete-1_2026-03-20',
    athleteId: 'athlete-1',
    sourceDate: '2026-03-20',
    sourceCheckInId: 'checkin-2',
    overallReadiness: 'green',
    confidence: 'medium',
    recommendedRouting: 'sim_only',
    readinessScore: 74,
    supportFlag: false,
  };
  const existingAssignment = {
    id: `${snapshot.athleteId}_${snapshot.sourceDate}`,
    lineageId: `${snapshot.athleteId}_${snapshot.sourceDate}`,
    revision: 1,
    athleteId: 'athlete-1',
    teamId: 'team-1',
    teamMembershipId: 'membership-1',
    sourceCheckInId: 'checkin-1',
    sourceStateSnapshotId: 'athlete-1_2026-03-19',
    sourceCandidateSetId: 'candidate-set-previous',
    sourceDate: snapshot.sourceDate,
    timezone: 'America/New_York',
    status: 'completed',
    actionType: 'sim',
    completionSummary: {
      primaryMetric: {
        key: 'focus_hold',
        label: 'Focus Hold',
        value: 84,
        unit: '%',
      },
      noraTakeaway: 'Already finished.',
    },
    createdAt: 1742420000000,
    updatedAt: 1742420600000,
  };
  const db = createFirestoreDb({
    snapshot,
    existingAssignment,
  });

  const assignment = await runtimeHelpers.orchestratePostCheckIn({
    db,
    athleteId: 'athlete-1',
    sourceCheckInId: 'checkin-2',
    sourceStateSnapshotId: snapshot.id,
    sourceCandidateSetId: 'candidate-set-2',
    sourceDate: snapshot.sourceDate,
    timezone: 'America/New_York',
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
          readiness: 74,
        },
      },
    },
    candidateSet: {
      id: 'candidate-set-2',
      candidates: [],
      plannerEligible: false,
    },
    plannerDecision: null,
    liveProtocolRegistry: [],
    liveSimRegistry: [],
  });

  assert.equal(assignment.id, existingAssignment.id);
  assert.equal(assignment.status, 'completed');
  assert.equal(db.writes.assignments.length, 0);
});
