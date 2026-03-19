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

function compileMentalTrainingRuntime() {
  if (compiledRuntimeCache) {
    return compiledRuntimeCache;
  }

  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ql-mentaltraining-runtime-'));
  const compileArgs = [
    'tsc',
    '--module', 'commonjs',
    '--target', 'es2020',
    '--moduleResolution', 'node',
    '--esModuleInterop',
    '--skipLibCheck',
    '--pretty', 'false',
    '--outDir', outDir,
    path.join(repoRoot, 'src/api/firebase/mentaltraining/simBuild.ts'),
    path.join(repoRoot, 'src/api/firebase/mentaltraining/variantRegistryService.ts'),
    path.join(repoRoot, 'src/api/firebase/mentaltraining/protocolPracticeConversationService.ts'),
    path.join(repoRoot, 'src/pages/api/mentaltraining/evaluate-protocol-practice.ts'),
  ];

  const result = spawnSync('npx', compileArgs, {
    cwd: repoRoot,
    encoding: 'utf8',
  });

  const simBuildPath = findFileRecursive(outDir, 'simBuild.js');
  const variantRegistryPath = findFileRecursive(outDir, 'variantRegistryService.js');
  const protocolPracticeServicePath = findFileRecursive(outDir, 'protocolPracticeConversationService.js');
  const protocolPracticeEvaluatorPath = findFileRecursive(outDir, 'evaluate-protocol-practice.js');

  if ((!simBuildPath || !variantRegistryPath || !protocolPracticeServicePath || !protocolPracticeEvaluatorPath) && result.status !== 0) {
    throw new Error(`Failed to compile mental training runtime:\n${result.stderr || result.stdout || 'Unknown tsc failure'}`);
  }

  if (!simBuildPath || !variantRegistryPath || !protocolPracticeServicePath || !protocolPracticeEvaluatorPath) {
    throw new Error('Compiled runtime files were not emitted to the temp directory.');
  }

  compiledRuntimeCache = {
    outDir,
    simBuildPath,
    variantRegistryPath,
    protocolPracticeServicePath,
    protocolPracticeEvaluatorPath,
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

function createFirestoreMock(initialCollections = {}) {
  const collections = new Map();
  let autoIdCounter = 0;

  function collectionKey(pathParts) {
    return pathParts.join('/');
  }

  function ensureCollection(pathParts) {
    const key = collectionKey(pathParts);
    if (!collections.has(key)) {
      collections.set(key, new Map());
    }
    return collections.get(key);
  }

  function setDocData(docPath, data, merge = false) {
    const collectionPath = docPath.slice(0, -1);
    const documentId = docPath.at(-1);
    const bucket = ensureCollection(collectionPath);
    const existing = bucket.get(documentId);
    bucket.set(documentId, merge && existing ? { ...clone(existing), ...clone(data) } : clone(data));
  }

  function getDocData(docPath) {
    const collectionPath = docPath.slice(0, -1);
    const documentId = docPath.at(-1);
    return ensureCollection(collectionPath).get(documentId);
  }

  function deleteDocData(docPath) {
    const collectionPath = docPath.slice(0, -1);
    const documentId = docPath.at(-1);
    ensureCollection(collectionPath).delete(documentId);
  }

  for (const [pathKey, records] of Object.entries(initialCollections)) {
    const bucket = ensureCollection(pathKey.split('/'));
    for (const record of records) {
      bucket.set(record.id, clone(record.data));
    }
  }

  function makeCollectionRef(pathParts) {
    return { __type: 'collection', path: [...pathParts] };
  }

  function makeDocRef(pathParts) {
    return { __type: 'doc', path: [...pathParts], id: pathParts.at(-1) };
  }

  const firestoreModule = {
    collection(db, ...pathParts) {
      return makeCollectionRef(pathParts);
    },
    doc(firstArg, ...pathParts) {
      if (firstArg && Array.isArray(firstArg.path)) {
        if (firstArg.__type === 'collection' && pathParts.length === 0) {
          autoIdCounter += 1;
          return makeDocRef([...firstArg.path, `auto-${autoIdCounter}`]);
        }
        return makeDocRef([...firstArg.path, ...pathParts]);
      }
      return makeDocRef(pathParts);
    },
    query(ref, ...clauses) {
      return { __type: 'query', path: [...ref.path], clauses: clauses.filter(Boolean) };
    },
    orderBy(field, direction = 'asc') {
      return { __type: 'orderBy', field, direction };
    },
    async getDocs(ref) {
      const pathParts = ref.path;
      const docs = Array.from(ensureCollection(pathParts).entries()).map(([id, data]) => ({
        id,
        ref: makeDocRef([...pathParts, id]),
        data: () => clone(data),
      }));
      const orderClauses = Array.isArray(ref.clauses)
        ? ref.clauses.filter((clause) => clause && clause.__type === 'orderBy')
        : [];
      if (orderClauses.length > 0) {
        docs.sort((left, right) => {
          for (const clause of orderClauses) {
            const leftValue = left.data()?.[clause.field];
            const rightValue = right.data()?.[clause.field];
            if (leftValue === rightValue) continue;
            const comparison = leftValue > rightValue ? 1 : -1;
            return clause.direction === 'desc' ? -comparison : comparison;
          }
          return 0;
        });
      }
      return { docs };
    },
    async getDoc(ref) {
      const data = getDocData(ref.path);
      return {
        exists: () => data !== undefined,
        data: () => clone(data),
      };
    },
    async deleteDoc(ref) {
      deleteDocData(ref.path);
    },
    writeBatch() {
      const ops = [];
      return {
        set(ref, data, options) {
          ops.push({ type: 'set', ref, data: clone(data), merge: Boolean(options && options.merge) });
        },
        delete(ref) {
          ops.push({ type: 'delete', ref });
        },
        async commit() {
          for (const op of ops) {
            if (op.type === 'set') {
              setDocData(op.ref.path, op.data, op.merge);
            } else if (op.type === 'delete') {
              deleteDocData(op.ref.path);
            }
          }
        },
      };
    },
  };

  return {
    db: { __type: 'mock-db' },
    firestoreModule,
    getCollection(pathKey) {
      return Array.from(ensureCollection(pathKey.split('/')).entries()).map(([id, data]) => ({ id, data: clone(data) }));
    },
    getDoc(pathKey) {
      const pathParts = pathKey.split('/');
      const data = getDocData(pathParts);
      return data === undefined ? undefined : clone(data);
    },
  };
}

function loadSimBuildRuntime() {
  const { simBuildPath } = compileMentalTrainingRuntime();
  delete require.cache[simBuildPath];
  return require(simBuildPath);
}

function loadVariantRegistryRuntime(firestoreMock) {
  const { variantRegistryPath } = compileMentalTrainingRuntime();
  delete require.cache[variantRegistryPath];

  return withModuleMocks({
    'firebase/firestore': firestoreMock.firestoreModule,
    '../config': { db: firestoreMock.db },
  }, () => require(variantRegistryPath));
}

function loadProtocolPracticeRuntime(mocks = {}) {
  const { protocolPracticeServicePath, protocolPracticeEvaluatorPath } = compileMentalTrainingRuntime();
  delete require.cache[protocolPracticeServicePath];
  delete require.cache[protocolPracticeEvaluatorPath];

  return withModuleMocks(mocks, () => ({
    service: require(protocolPracticeServicePath),
    evaluator: require(protocolPracticeEvaluatorPath),
  }));
}

module.exports = {
  createFirestoreMock,
  loadSimBuildRuntime,
  loadVariantRegistryRuntime,
  loadProtocolPracticeRuntime,
};
