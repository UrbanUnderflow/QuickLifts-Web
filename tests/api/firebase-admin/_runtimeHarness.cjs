const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Module = require('node:module');
const { spawnSync } = require('node:child_process');

const repoRoot = '/Users/tremainegrant/Documents/GitHub/QuickLifts-Web';
const compiledRuntimeCache = new Map();

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

function compileTypeScriptRuntime({ cacheKey, entryPaths, assets = [] }) {
  if (compiledRuntimeCache.has(cacheKey)) {
    return compiledRuntimeCache.get(cacheKey);
  }

  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), `ql-${cacheKey}-`));
  const compileArgs = [
    'tsc',
    '--module', 'commonjs',
    '--target', 'es2020',
    '--moduleResolution', 'node',
    '--esModuleInterop',
    '--allowJs',
    '--skipLibCheck',
    '--pretty', 'false',
    '--outDir', outDir,
    ...entryPaths,
  ];

  const result = spawnSync('npx', compileArgs, {
    cwd: repoRoot,
    encoding: 'utf8',
  });

  const emittedFiles = {};
  for (const entryPath of entryPaths) {
    const fileName = `${path.basename(entryPath, path.extname(entryPath))}.js`;
    const emittedPath = findFileRecursive(outDir, fileName);
    if (!emittedPath) {
      throw new Error(`Failed to compile ${fileName}:\n${result.stderr || result.stdout || 'Unknown tsc failure'}`);
    }
    emittedFiles[fileName] = emittedPath;
  }

  for (const asset of assets) {
    const assetName = path.basename(asset);
    const emittedDir = path.dirname(emittedFiles[`${path.basename(entryPaths[0], path.extname(entryPaths[0]))}.js`]);
    fs.copyFileSync(asset, path.join(emittedDir, assetName));
  }

  const compiled = {
    outDir,
    emittedFiles,
  };

  compiledRuntimeCache.set(cacheKey, compiled);
  return compiled;
}

function clearCompiledRuntimeCache(compiled) {
  if (!compiled?.outDir) {
    return;
  }

  for (const cacheKey of Object.keys(require.cache)) {
    if (cacheKey.startsWith(compiled.outDir)) {
      delete require.cache[cacheKey];
    }
  }
}

function resolveMock(request, mocks) {
  if (!mocks) {
    return undefined;
  }

  for (const [pattern, mockValue] of Object.entries(mocks)) {
    if (request === pattern || request.endsWith(pattern)) {
      return mockValue;
    }
  }

  return undefined;
}

function withModuleMocks(mocks, loadFn) {
  const originalLoad = Module._load;

  Module._load = function patchedLoad(request, parent, isMain) {
    const mockValue = resolveMock(request, mocks);
    if (mockValue !== undefined) {
      return mockValue;
    }

    return originalLoad.call(this, request, parent, isMain);
  };

  try {
    return loadFn();
  } finally {
    Module._load = originalLoad;
  }
}

function loadCompiledModule({ compiled, fileName, mocks }) {
  const modulePath = compiled.emittedFiles[fileName];
  if (!modulePath) {
    throw new Error(`Compiled runtime did not emit ${fileName}`);
  }

  clearCompiledRuntimeCache(compiled);
  return withModuleMocks(mocks, () => require(modulePath));
}

function withPatchedEnv(patch, run) {
  const previous = {};
  for (const [key, value] of Object.entries(patch)) {
    previous[key] = process.env[key];
    if (value == null) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  return Promise.resolve()
    .then(run)
    .finally(() => {
      for (const [key, value] of Object.entries(previous)) {
        if (value == null) {
          delete process.env[key];
        } else {
          process.env[key] = value;
        }
      }
    });
}

function createNextApiResponseRecorder() {
  const response = {
    statusCode: 200,
    body: undefined,
    headers: {},
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
    setHeader(name, value) {
      this.headers[name] = value;
    },
  };

  return response;
}

function createFetchResponse({
  ok = true,
  status = ok ? 200 : 500,
  json = {},
  text,
  headers = { 'content-type': 'application/json' },
} = {}) {
  return {
    ok,
    status,
    headers: {
      get(name) {
        return headers[String(name).toLowerCase()] || headers[name] || null;
      },
    },
    async json() {
      return clone(json);
    },
    async text() {
      if (typeof text === 'string') {
        return text;
      }
      return JSON.stringify(json);
    },
  };
}

function createFirestoreAdminMock({ collections = {}, queryErrors = {} } = {}) {
  const stores = new Map();
  const writes = {
    sets: [],
    updates: [],
    adds: [],
    deletes: [],
    batchCommits: 0,
  };
  let autoIdCounter = 0;

  const FieldValue = {
    serverTimestamp() {
      return { __op: 'serverTimestamp' };
    },
    arrayUnion(...values) {
      return { __op: 'arrayUnion', values: clone(values) };
    },
    increment(value) {
      return { __op: 'increment', value };
    },
  };

  function pathKey(pathParts) {
    return pathParts.join('/');
  }

  function ensureStore(pathParts) {
    const key = pathKey(pathParts);
    if (!stores.has(key)) {
      stores.set(key, new Map());
    }
    return stores.get(key);
  }

  function hydrateInitialData() {
    for (const [collectionPath, records] of Object.entries(collections)) {
      const bucket = ensureStore(collectionPath.split('/'));
      for (const record of records) {
        bucket.set(record.id, clone(record.data));
      }
    }
  }

  function resolveStoredValue(value) {
    if (Array.isArray(value)) {
      return value.map((item) => resolveStoredValue(item));
    }

    if (value && typeof value === 'object') {
      if (value.__op === 'serverTimestamp') {
        return 'server-timestamp';
      }

      if (value.__op === 'arrayUnion') {
        return value;
      }

      return Object.fromEntries(
        Object.entries(value).map(([key, nestedValue]) => [key, resolveStoredValue(nestedValue)])
      );
    }

    return value;
  }

  function setPathValue(target, dottedKey, rawValue) {
    const segments = dottedKey.split('.');
    let cursor = target;
    for (let index = 0; index < segments.length - 1; index += 1) {
      const segment = segments[index];
      const nextValue = cursor[segment];
      if (!nextValue || typeof nextValue !== 'object' || Array.isArray(nextValue)) {
        cursor[segment] = {};
      }
      cursor = cursor[segment];
    }

    const finalKey = segments.at(-1);
    if (rawValue && typeof rawValue === 'object' && rawValue.__op === 'arrayUnion') {
      const existing = Array.isArray(cursor[finalKey]) ? [...cursor[finalKey]] : [];
      for (const candidate of rawValue.values) {
        const normalizedCandidate = resolveStoredValue(candidate);
        if (!existing.some((item) => JSON.stringify(item) === JSON.stringify(normalizedCandidate))) {
          existing.push(normalizedCandidate);
        }
      }
      cursor[finalKey] = existing;
      return;
    }

    if (rawValue && typeof rawValue === 'object' && rawValue.__op === 'increment') {
      const existing = typeof cursor[finalKey] === 'number' ? cursor[finalKey] : 0;
      cursor[finalKey] = existing + Number(rawValue.value || 0);
      return;
    }

    cursor[finalKey] = resolveStoredValue(rawValue);
  }

  function mergeData(current, patch) {
    const next = { ...(current || {}) };
    for (const [key, rawValue] of Object.entries(patch || {})) {
      setPathValue(next, key, rawValue);
    }

    return next;
  }

  function getDocData(pathParts) {
    const bucket = ensureStore(pathParts.slice(0, -1));
    return bucket.get(pathParts.at(-1));
  }

  function setDocData(pathParts, data, options = {}) {
    const bucket = ensureStore(pathParts.slice(0, -1));
    const docId = pathParts.at(-1);
    const existing = bucket.get(docId);
    const nextData = options.merge ? mergeData(existing, data) : resolveStoredValue(clone(data));
    bucket.set(docId, nextData);
    return nextData;
  }

  function updateDocData(pathParts, data) {
    const existing = getDocData(pathParts);
    if (!existing) {
      throw new Error(`Missing mock document at ${pathKey(pathParts)}`);
    }

    const next = mergeData(existing, data);
    ensureStore(pathParts.slice(0, -1)).set(pathParts.at(-1), next);
    return next;
  }

  function makeDocSnapshot(pathParts, id, data) {
    return {
      id,
      ref: makeDocRef([...pathParts, id]),
      exists: data != null,
      data: () => clone(data),
    };
  }

  function applyQuery(docs, clauses) {
    return clauses.reduce((accumulator, clause) => {
      if (clause.type === 'where') {
        return accumulator.filter((snapshot) => {
          const value = snapshot.data()?.[clause.field];
          if (clause.operator === '==') {
            return value === clause.value;
          }
          if (clause.operator === 'array-contains') {
            return Array.isArray(value) && value.includes(clause.value);
          }
          throw new Error(`Unsupported where operator in mock: ${clause.operator}`);
        });
      }

      if (clause.type === 'limit') {
        return accumulator.slice(0, clause.value);
      }

      if (clause.type === 'orderBy') {
        const sorted = [...accumulator];
        sorted.sort((left, right) => {
          const leftValue = left.data()?.[clause.field];
          const rightValue = right.data()?.[clause.field];
          if (leftValue === rightValue) {
            return 0;
          }
          const comparison = leftValue > rightValue ? 1 : -1;
          return clause.direction === 'desc' ? comparison * -1 : comparison;
        });
        return sorted;
      }

      return accumulator;
    }, docs);
  }

  function makeQueryRef(pathParts, clauses = []) {
    return {
      async get() {
        const collectionName = pathKey(pathParts);
        if (queryErrors[collectionName]) {
          throw queryErrors[collectionName];
        }

        const docs = Array.from(ensureStore(pathParts).entries()).map(([id, data]) =>
          makeDocSnapshot(pathParts, id, data)
        );
        const filteredDocs = applyQuery(docs, clauses);
        return {
          empty: filteredDocs.length === 0,
          docs: filteredDocs,
        };
      },
      where(field, operator, value) {
        return makeQueryRef(pathParts, clauses.concat([{ type: 'where', field, operator, value }]));
      },
      orderBy(field, direction = 'asc') {
        return makeQueryRef(pathParts, clauses.concat([{ type: 'orderBy', field, direction }]));
      },
      limit(value) {
        return makeQueryRef(pathParts, clauses.concat([{ type: 'limit', value }]));
      },
    };
  }

  function makeDocRef(pathParts) {
    return {
      id: pathParts.at(-1),
      path: pathKey(pathParts),
      async get() {
        const data = getDocData(pathParts);
        return {
          id: pathParts.at(-1),
          ref: makeDocRef(pathParts),
          exists: data != null,
          data: () => clone(data),
        };
      },
      async set(data, options) {
        const stored = setDocData(pathParts, data, options || {});
        writes.sets.push({ path: pathKey(pathParts), data: clone(stored), merge: Boolean(options && options.merge) });
      },
      async update(data) {
        const stored = updateDocData(pathParts, data);
        writes.updates.push({ path: pathKey(pathParts), data: clone(data), next: clone(stored) });
      },
      async delete() {
        ensureStore(pathParts.slice(0, -1)).delete(pathParts.at(-1));
        writes.deletes.push({ path: pathKey(pathParts) });
      },
      collection(childName) {
        return makeCollectionRef(pathParts.concat(childName));
      },
    };
  }

  function makeCollectionRef(pathParts) {
    return {
      path: pathKey(pathParts),
      doc(id) {
        return makeDocRef(pathParts.concat(id));
      },
      where(field, operator, value) {
        return makeQueryRef(pathParts, [{ type: 'where', field, operator, value }]);
      },
      orderBy(field, direction = 'asc') {
        return makeQueryRef(pathParts, [{ type: 'orderBy', field, direction }]);
      },
      limit(value) {
        return makeQueryRef(pathParts, [{ type: 'limit', value }]);
      },
      async get() {
        return makeQueryRef(pathParts).get();
      },
      async add(data) {
        autoIdCounter += 1;
        const id = `auto-${autoIdCounter}`;
        const stored = setDocData(pathParts.concat(id), data);
        writes.adds.push({ path: `${pathKey(pathParts)}/${id}`, data: clone(stored) });
        return makeDocRef(pathParts.concat(id));
      },
    };
  }

  hydrateInitialData();

  const db = {
    collection(name) {
      return makeCollectionRef([name]);
    },
    batch() {
      const operations = [];
      return {
        update(ref, data) {
          operations.push({ type: 'update', ref, data });
        },
        set(ref, data, options) {
          operations.push({ type: 'set', ref, data, options: options || {} });
        },
        delete(ref) {
          operations.push({ type: 'delete', ref });
        },
        async commit() {
          for (const operation of operations) {
            if (operation.type === 'update') {
              await operation.ref.update(operation.data);
            } else if (operation.type === 'set') {
              await operation.ref.set(operation.data, operation.options);
            } else if (operation.type === 'delete') {
              await operation.ref.delete();
            }
          }
          writes.batchCommits += 1;
        },
      };
    },
  };

  function firestore() {
    return db;
  }

  firestore.FieldValue = FieldValue;

  return {
    admin: {
      firestore,
      auth() {
        return {
          async verifyIdToken() {
            return { uid: 'mock-user' };
          },
        };
      },
    },
    db,
    writes,
    getDocument(pathString) {
      return clone(getDocData(pathString.split('/')));
    },
  };
}

module.exports = {
  compileTypeScriptRuntime,
  createFetchResponse,
  createFirestoreAdminMock,
  createNextApiResponseRecorder,
  loadCompiledModule,
  repoRoot,
  withModuleMocks,
  withPatchedEnv,
};
