#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const repoRoot = path.resolve(__dirname, '..');
const fixturesDir = path.join(repoRoot, 'tests', 'fixtures', 'pulsecheck');
const repairPath = path.join(repoRoot, 'netlify/functions/repair-pulsecheck-daily-assignment.js');
const configPath = path.join(repoRoot, 'netlify/functions/config/firebase.js');
const submitPath = path.join(repoRoot, 'netlify/functions/submit-pulsecheck-checkin.js');
const chatPath = path.join(repoRoot, 'netlify/functions/pulsecheck-chat.js');
const profileRuntimePath = path.join(repoRoot, 'src/api/firebase/mentaltraining/profileSnapshotRuntime.js');
const protocolRegistryRuntimePath = path.join(repoRoot, 'src/api/firebase/mentaltraining/protocolRegistryRuntime.js');

function parseArgs(argv) {
  const fixturePaths = [];
  let verbose = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--fixture') {
      const nextValue = argv[index + 1];
      if (!nextValue) {
        throw new Error('Expected a path after --fixture');
      }
      fixturePaths.push(path.resolve(process.cwd(), nextValue));
      index += 1;
      continue;
    }

    if (arg === '--verbose') {
      verbose = true;
      continue;
    }

    if (arg === '--list') {
      const fixtures = getDefaultFixturePaths();
      fixtures.forEach((fixturePath) => {
        console.log(path.relative(repoRoot, fixturePath));
      });
      process.exit(0);
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return {
    fixturePaths: fixturePaths.length ? fixturePaths : getDefaultFixturePaths(),
    verbose,
  };
}

function getDefaultFixturePaths() {
  if (!fs.existsSync(fixturesDir)) {
    throw new Error(`Fixture directory not found: ${fixturesDir}`);
  }

  return fs.readdirSync(fixturesDir)
    .filter((entry) => entry.endsWith('.json'))
    .sort()
    .map((entry) => path.join(fixturesDir, entry));
}

function loadFixture(fixturePath) {
  const raw = fs.readFileSync(fixturePath, 'utf8');
  return JSON.parse(raw);
}

function resetModuleCache() {
  delete require.cache[repairPath];
  delete require.cache[configPath];
  delete require.cache[submitPath];
  delete require.cache[chatPath];
  delete require.cache[profileRuntimePath];
  delete require.cache[protocolRegistryRuntimePath];
}

function loadActualSubmitRuntimeHelpers() {
  resetModuleCache();

  require.cache[configPath] = {
    id: configPath,
    filename: configPath,
    loaded: true,
    exports: {
      initializeFirebaseAdmin: () => {},
      getFirebaseAdminApp: () => ({}),
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

function makeDoc(id, data) {
  return {
    id,
    data: () => data,
  };
}

function createSmokeDb(fixture) {
  const stateSnapshots = new Map();
  const snapshot = fixture.db.snapshot || null;
  if (snapshot?.id) {
    stateSnapshots.set(snapshot.id, snapshot);
  }

  const progressDoc = fixture.db.priorProgress || null;
  const assignmentId = `${fixture.userId}_${fixture.request.sourceDate}`;
  const existingAssignment = fixture.db.existingAssignment || null;
  const launchableLegacyExerciseIds = new Set((fixture.db.launchableLegacyExerciseIds || []).map((value) => String(value).toLowerCase()));
  const launchableSimSpecIds = new Set((fixture.db.launchableSimSpecIds || []).map((value) => String(value).toLowerCase()));
  const launchableLabels = new Set((fixture.db.launchableLabels || []).map((value) => String(value).toLowerCase()));
  const liveProtocols = Array.isArray(fixture.db.liveProtocols) ? [...fixture.db.liveProtocols] : [];
  const liveSimModules = Array.isArray(fixture.db.liveSimModules) ? [...fixture.db.liveSimModules] : [];

  const writes = {
    assignments: [],
    revisions: [],
    candidateSets: [],
    progress: [],
    responsivenessProfiles: [],
    snapshots: [],
    protocols: [],
  };

  const emptyDocsResult = { docs: [] };
  const emptyCollectionResult = { empty: true, docs: [] };

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
                const value = stateSnapshots.get(id);
                if (!value) {
                  return { exists: false, id, data: () => undefined };
                }
                return { exists: true, id, data: () => value };
              },
              async set(data) {
                const nextValue = { ...(stateSnapshots.get(id) || {}), ...data };
                stateSnapshots.set(id, nextValue);
                writes.snapshots.push({ id, data });
              },
            };
          },
          where(field, operator, value) {
            assert.equal(field, 'athleteId');
            assert.equal(operator, '==');
            const docs = Array.from(stateSnapshots.values())
              .filter((entry) => entry?.athleteId === value)
              .map((entry) => makeDoc(entry.id, entry));
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

      if (name === 'pulsecheck-daily-assignments') {
        return {
          doc(id) {
            return {
              async get() {
                if (!existingAssignment || id !== assignmentId) {
                  return { exists: false, id, data: () => undefined };
                }
                return { exists: true, id, data: () => existingAssignment };
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
            const docs = existingAssignment && value === fixture.userId
              ? [makeDoc(assignmentId, existingAssignment)]
              : [];
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

      if (name === 'mental-exercises') {
        return {
          doc(id) {
            return {
              async get() {
                const normalizedId = String(id).toLowerCase();
                return {
                  exists: launchableLegacyExerciseIds.has(normalizedId),
                  id,
                  data: () => (launchableLegacyExerciseIds.has(normalizedId) ? { isActive: true } : undefined),
                };
              },
            };
          },
          where(field, _operator, value) {
            const filters = [[field, value]];
            const query = {
              where(nextField, _nextOperator, nextValue) {
                filters.push([nextField, nextValue]);
                return query;
              },
              limit() {
                return query;
              },
              async get() {
                const normalizedFilters = new Map(filters.map(([key, filterValue]) => [key, String(filterValue).toLowerCase()]));
                const simSpecId = normalizedFilters.get('simSpecId');
                const label = normalizedFilters.get('name');
                const isActive = normalizedFilters.get('isActive');
                const hasMatch =
                  (simSpecId && launchableSimSpecIds.has(simSpecId) && isActive === 'true')
                  || (label && launchableLabels.has(label) && isActive === 'true');
                return {
                  empty: !hasMatch,
                  docs: hasMatch ? [{}] : [],
                };
              },
            };
            return query;
          },
        };
      }

      if (name === 'sim-modules') {
        return {
          async get() {
            return {
              empty: liveSimModules.length === 0,
              docs: liveSimModules.map((entry) => makeDoc(entry.id, entry)),
            };
          },
        };
      }

      if (name === 'pulsecheck-protocols') {
        return {
          doc(id) {
            return {
              async set(data) {
                writes.protocols.push({ id, data });
              },
            };
          },
          async get() {
            return {
              empty: liveProtocols.length === 0,
              docs: liveProtocols.map((entry) => makeDoc(entry.id, entry)),
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

      if (name === 'pulsecheck-assignment-events') {
        return {
          where() {
            return {
              async get() {
                return emptyCollectionResult;
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
                    return emptyDocsResult;
                  },
                };
              },
              async get() {
                return emptyDocsResult;
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
                if (!progressDoc || id !== fixture.userId) {
                  return { exists: false, id, data: () => undefined };
                }
                return { exists: true, id, data: () => progressDoc };
              },
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

function buildRepairHandler({ fixture, db }) {
  const actualRuntimeHelpers = loadActualSubmitRuntimeHelpers();
  const currentProgress = fixture.db.priorProgress || fixture.db.syncedProgress || {};
  const syncedProgress = fixture.db.syncedProgress || currentProgress;

  resetModuleCache();

  require.cache[configPath] = {
    id: configPath,
    filename: configPath,
    loaded: true,
    exports: {
      initializeFirebaseAdmin: () => {},
      admin: {
        auth: () => ({
          verifyIdToken: async () => ({ uid: fixture.decodedUid || fixture.userId }),
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
      runtimeHelpers: {
        ...actualRuntimeHelpers,
        loadOrInitializeProgress: async () => currentProgress,
        syncTaxonomyProfile: async (_db, athleteId, progress) => ({
          ...progress,
          ...syncedProgress,
          athleteId,
        }),
      },
    },
  };

  require.cache[chatPath] = {
    id: chatPath,
    filename: chatPath,
    loaded: true,
    exports: {
      runtimeHelpers: {
        recoverSnapshotFromSavedConversation: async () => (
          fixture.chatRecoveryResult || {
            applied: false,
            detail: 'No saved Nora conversation from today was available.',
          }
        ),
      },
    },
  };

  return require(repairPath).handler;
}

function getByPath(target, dottedPath) {
  return dottedPath.split('.').reduce((value, segment) => (value == null ? undefined : value[segment]), target);
}

function assertFixtureExpectations(responseBody, fixture) {
  const expected = fixture.expected || {};
  const equals = expected.equals || {};
  const includes = expected.includes || {};

  Object.entries(equals).forEach(([dottedPath, expectedValue]) => {
    const actualValue = getByPath(responseBody, dottedPath);
    assert.deepEqual(actualValue, expectedValue, `${fixture.name}: expected ${dottedPath} to equal ${JSON.stringify(expectedValue)}, received ${JSON.stringify(actualValue)}`);
  });

  Object.entries(includes).forEach(([dottedPath, snippets]) => {
    const actualValue = getByPath(responseBody, dottedPath);
    assert.equal(typeof actualValue, 'string', `${fixture.name}: expected ${dottedPath} to be a string for include checks`);
    const requiredSnippets = Array.isArray(snippets) ? snippets : [snippets];
    requiredSnippets.forEach((snippet) => {
      assert.match(actualValue, new RegExp(snippet.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `${fixture.name}: expected ${dottedPath} to include ${snippet}`);
    });
  });
}

async function runFixture(fixturePath, options = {}) {
  const fixture = loadFixture(fixturePath);
  const db = createSmokeDb(fixture);
  const handler = buildRepairHandler({ fixture, db });

  const response = await handler({
    httpMethod: 'POST',
    headers: { authorization: 'Bearer local-smoke-token' },
    body: JSON.stringify({
      userId: fixture.userId,
      ...fixture.request,
    }),
  });

  assert.equal(response.statusCode, 200, `${fixture.name}: expected HTTP 200, received ${response.statusCode}`);

  const body = JSON.parse(response.body);
  assertFixtureExpectations(body, fixture);

  console.log(`PASS ${fixture.name}`);
  console.log(`  fixture: ${path.relative(repoRoot, fixturePath)}`);
  console.log(`  repairApplied: ${body.repairApplied}`);
  console.log(`  actionType: ${body.dailyAssignment?.actionType || 'nil'}`);
  console.log(`  debugSummary: ${body.debugTrace?.summary || 'none'}`);

  if (options.verbose) {
    console.log('  response:', JSON.stringify(body, null, 2));
    console.log('  writes:', JSON.stringify(db.writes, null, 2));
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  let failed = false;

  for (const fixturePath of args.fixturePaths) {
    try {
      await runFixture(fixturePath, { verbose: args.verbose });
    } catch (error) {
      failed = true;
      console.error(`FAIL ${path.relative(repoRoot, fixturePath)}`);
      console.error(error instanceof Error ? error.stack || error.message : error);
    }
  }

  if (failed) {
    process.exitCode = 1;
    return;
  }

  console.log(`Smoke harness passed ${args.fixturePaths.length} fixture${args.fixturePaths.length === 1 ? '' : 's'}.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exit(1);
});
