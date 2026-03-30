const path = require('node:path');

const repoRoot = path.resolve(__dirname, '../../..');
const utilPath = path.join(repoRoot, 'netlify/functions/utils/pulsecheck-pilot-metrics.js');
const configPath = path.join(repoRoot, 'netlify/functions/config/firebase.js');
const profileRuntimePath = path.join(repoRoot, 'src/api/firebase/mentaltraining/profileSnapshotRuntime.js');

function cloneValue(value) {
  if (value === null || value === undefined || typeof value !== 'object') {
    return value;
  }

  if (value instanceof Date) {
    return new Date(value.getTime());
  }

  if (typeof value.toMillis === 'function' || typeof value.toDate === 'function') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(cloneValue);
  }

  return Object.entries(value).reduce((accumulator, [key, nested]) => {
    accumulator[key] = cloneValue(nested);
    return accumulator;
  }, {});
}

function getFieldValue(doc, fieldPath) {
  return String(fieldPath || '')
    .split('.')
    .filter(Boolean)
    .reduce((accumulator, key) => (accumulator && Object.prototype.hasOwnProperty.call(accumulator, key) ? accumulator[key] : undefined), doc);
}

function createTimestampFromMillis(timestampFromMillis) {
  return {
    fromMillis(value) {
      return timestampFromMillis(value);
    },
  };
}

function loadPulsecheckMetrics({ timestampFromMillis } = {}) {
  delete require.cache[utilPath];
  delete require.cache[configPath];
  delete require.cache[profileRuntimePath];

  const fromMillis = timestampFromMillis || ((value) => ({
    toMillis: () => value,
    valueOf: () => value,
  }));

  require.cache[configPath] = {
    id: configPath,
    filename: configPath,
    loaded: true,
    exports: {
      admin: {
        firestore: {
          Timestamp: createTimestampFromMillis(fromMillis),
        },
      },
    },
  };

  return require(utilPath);
}

function createPulsecheckFirestore(initialData = {}) {
  const stores = new Map();
  const writes = [];
  const counters = new Map();

  function ensureStore(collectionPath) {
    if (!stores.has(collectionPath)) {
      stores.set(collectionPath, new Map());
    }
    return stores.get(collectionPath);
  }

  function nextDocId(collectionPath) {
    const nextValue = (counters.get(collectionPath) || 0) + 1;
    counters.set(collectionPath, nextValue);
    return `${collectionPath.replace(/[^a-z0-9]+/gi, '-')}-${nextValue}`;
  }

  function writeDoc(collectionPath, id, data, merge = false) {
    const store = ensureStore(collectionPath);
    const existing = store.get(id);
    const next = merge && existing ? { ...existing, ...cloneValue(data) } : cloneValue(data);
    store.set(id, next);
    writes.push({ collectionPath, id, data: cloneValue(next), merge });
    return next;
  }

  function makeDocSnapshot(id, data) {
    return {
      exists: true,
      id,
      data: () => cloneValue(data),
    };
  }

  function makeQuery(collectionPath, filters = [], limitCount = null) {
    const query = {
      where(field, operator, value) {
        if (operator !== '==') {
          throw new Error(`Unsupported operator in test harness: ${operator}`);
        }
        return makeQuery(collectionPath, [...filters, { field, value }], limitCount);
      },
      limit(count) {
        return makeQuery(collectionPath, filters, count);
      },
      async get() {
        const store = ensureStore(collectionPath);
        let docs = [...store.entries()]
          .filter(([, doc]) => filters.every(({ field, value }) => getFieldValue(doc, field) === value))
          .map(([id, doc]) => makeDocSnapshot(id, doc));

        if (typeof limitCount === 'number') {
          docs = docs.slice(0, limitCount);
        }

        return {
          empty: docs.length === 0,
          docs,
        };
      },
    };

    return query;
  }

  function makeCollectionRef(collectionPath) {
    return {
      doc(id = nextDocId(collectionPath)) {
        return {
          id,
          async get() {
            const store = ensureStore(collectionPath);
            if (!store.has(id)) {
              return {
                exists: false,
                id,
                data: () => undefined,
              };
            }
            return {
              exists: true,
              id,
              data: () => cloneValue(store.get(id)),
            };
          },
          async set(data, options = {}) {
            writeDoc(collectionPath, id, data, Boolean(options?.merge));
          },
          async update(data) {
            const store = ensureStore(collectionPath);
            const existing = store.get(id) || {};
            writeDoc(collectionPath, id, { ...existing, ...data }, false);
          },
          async delete() {
            const store = ensureStore(collectionPath);
            store.delete(id);
            writes.push({ collectionPath, id, deleted: true });
          },
          collection(childName) {
            return makeCollectionRef(`${collectionPath}/${id}/${childName}`);
          },
        };
      },
      async add(data) {
        const id = nextDocId(collectionPath);
        writeDoc(collectionPath, id, data, false);
        return { id };
      },
      where(field, operator, value) {
        if (operator !== '==') {
          throw new Error(`Unsupported operator in test harness: ${operator}`);
        }
        return makeQuery(collectionPath, [{ field, value }], null);
      },
      limit(count) {
        return makeQuery(collectionPath, [], count);
      },
      async get() {
        const store = ensureStore(collectionPath);
        return {
          empty: store.size === 0,
          docs: [...store.entries()].map(([id, doc]) => makeDocSnapshot(id, doc)),
        };
      },
    };
  }

  for (const [collectionPath, docs] of Object.entries(initialData || {})) {
    const store = ensureStore(collectionPath);
    Object.entries(docs || {}).forEach(([id, data]) => {
      store.set(id, cloneValue(data));
    });
  }

  return {
    db: {
      collection: makeCollectionRef,
      __stores: stores,
      __writes: writes,
      seedDoc(collectionPath, id, data) {
        writeDoc(collectionPath, id, data, false);
      },
      getDoc(collectionPath, id) {
        const store = ensureStore(collectionPath);
        return store.get(id) || null;
      },
      getCollectionDocs(collectionPath) {
        const store = ensureStore(collectionPath);
        return [...store.entries()].map(([docId, doc]) => ({ id: docId, data: cloneValue(doc) }));
      },
    },
    writes,
  };
}

module.exports = {
  createPulsecheckFirestore,
  loadPulsecheckMetrics,
};
