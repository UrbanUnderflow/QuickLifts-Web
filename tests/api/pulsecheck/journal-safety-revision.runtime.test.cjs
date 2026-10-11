const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '../../..');
const fn = (name) => path.join(repoRoot, 'netlify/functions', name);
const modulePaths = {
  screen: fn('journal-safety-screen.js'),
  guide: fn('journal-guide.js'),
  config: fn('config/firebase.js'),
  chat: fn('pulsecheck-chat.js'),
  escalation: fn('pulsecheck-escalation.js'),
  metrics: fn('utils/pulsecheck-pilot-metrics.js'),
  notifications: fn('pulsecheck-notification-utils.js'),
};

function stub(modulePath, exports) {
  require.cache[modulePath] = { id: modulePath, filename: modulePath, loaded: true, exports };
}

/** In-memory Firestore keyed by document path, enough for the screening module. */
function createDb(seed = {}) {
  const docs = new Map(Object.entries(seed));
  const docRef = (docPath) => ({
    path: docPath,
    id: docPath.split('/').pop(),
    async get() { return { exists: docs.has(docPath), data: () => docs.get(docPath) }; },
    async set(value, options) { docs.set(docPath, options?.merge ? { ...(docs.get(docPath) || {}), ...value } : value); },
    collection: (name) => collectionRef(`${docPath}/${name}`),
  });
  const query = (collectionPath, filters) => ({
    where: (field, _op, value) => query(collectionPath, [...filters, [field, value]]),
    async get() {
      const matches = [...docs.entries()]
        .filter(([key, data]) => key.startsWith(`${collectionPath}/`) && key.split('/').length === collectionPath.split('/').length + 1
          && filters.every(([field, value]) => data[field] === value))
        .map(([key, data]) => ({ id: key.split('/').pop(), data: () => data }));
      return { docs: matches, empty: matches.length === 0 };
    },
  });
  const collectionRef = (collectionPath) => ({
    doc: (id) => docRef(`${collectionPath}/${id}`),
    where: (field, op, value) => query(collectionPath, []).where(field, op, value),
  });
  return {
    docs,
    collection: (name) => collectionRef(name),
    async runTransaction(callback) {
      return callback({ get: (ref) => ref.get(), set: (ref, value, options) => ref.set(value, options) });
    },
  };
}

function loadModules({ classification = { tier: 0 }, created = { escalationId: 'esc-1', consentRequired: true }, pushes = [], escalations = [], db = null, classifierCalls = [], onEscalate = () => {} } = {}) {
  Object.values(modulePaths).forEach((p) => delete require.cache[p]);
  const app = db ? { firestore: () => db, messaging: () => ({}) } : {};
  stub(modulePaths.config, { initializeFirebaseAdmin: () => {}, getFirebaseAdminApp: () => app, headers: {}, admin: { messaging: () => ({}) } });
  stub(modulePaths.chat, {
    runtimeHelpers: {
      classifyEscalation: async (...args) => { classifierCalls.push(args); return classification; },
      buildTrustedEscalationOutcome: (value) => ({ escalationRecordId: value.escalationId, handoffStatus: value.handoffStatus, success: value.success }),
      verifyPulseCheckCaller: async () => ({ userId: 'athlete-1' }),
    },
  });
  stub(modulePaths.escalation, { runtimeHelpers: { createEscalationFromTrustedRuntime: async (body) => { escalations.push(body); await onEscalate(); return created; } } });
  stub(modulePaths.metrics, { isTrueCareEscalationClassification: (value) => Number(value?.tier || 0) >= 2 });
  stub(modulePaths.notifications, {
    resolvePulseCheckFcmToken: () => 'token-1',
    sendLoggedNoraPush: async (message) => { pushes.push(message); return { success: true }; },
  });
  return { screen: require(modulePaths.screen), guide: require(modulePaths.guide), pushes, escalations };
}

const ENTRY = 'pulsecheck-evidence-journals/athlete-1/entries/entry-1';
const SCREENING = 'pulsecheck-evidence-journals/athlete-1/screenings/entry-1';

const revision = require('../../../netlify/functions/lib/journal-sharing').journalEntryRevision;
const run = (screen, db, classify) => screen.screenJournalEntry({ db, userId: 'athlete-1', entryId: 'entry-1', classify });
function edit(db) {
  const entry = { moment: 'New writing', createdAt: 1, updatedAt: 2 };
  db.docs.set(ENTRY, entry);
  db.docs.set(SCREENING, { status: 'pending', attempts: 0, entryRevision: revision(entry) });
}
test('edit while classifying cancels obsolete critical dispatch and preserves new pending screen', async () => {
  const { screen, escalations } = loadModules();
  const db = createDb({ [ENTRY]: { moment: 'Old writing', createdAt: 1 } });
  const result = await run(screen, db, async () => { edit(db); return { tier: 3, confidence: 1 }; });
  assert.equal(result.reason, 'revision_superseded');
  assert.equal(escalations.length, 0);
  assert.deepEqual(db.docs.get(SCREENING), { status: 'pending', attempts: 0, entryRevision: revision(db.docs.get(ENTRY)) });
});
test('delete while classifying cancels dispatch', async () => {
  const { screen, escalations } = loadModules();
  const db = createDb({ [ENTRY]: { moment: 'Old writing' } });
  await run(screen, db, async () => { db.docs.delete(ENTRY); return { tier: 3, confidence: 1 }; });
  assert.equal(escalations.length, 0);
});
test('old worker failure cannot overwrite replacement claim or its result', async () => {
  const { screen } = loadModules();
  const db = createDb({ [ENTRY]: { moment: 'Old writing' } });
  const replacement = { status: 'done', outcome: 'clear', claimId: 'replacement' };
  await run(screen, db, async () => { db.docs.set(SCREENING, replacement); throw new Error('synthetic classifier failure'); });
  assert.deepEqual(db.docs.get(SCREENING), replacement);
});
test('already authorized dispatch completion cannot overwrite an edit that arrived during delivery', async () => {
  const db = createDb({ [ENTRY]: { moment: 'Current danger', createdAt: 1 } });
  const { screen, escalations } = loadModules({ onEscalate: () => edit(db) });
  const result = await run(screen, db, async () => ({ tier: 3, confidence: 1 }));
  assert.equal(escalations.length, 1);
  assert.equal(result.reason, 'revision_superseded');
  assert.equal(db.docs.get(SCREENING).status, 'pending');
  assert.equal(db.docs.get(SCREENING).attempts, 0);
});
test('current revision emergency still dispatches and finalizes once', async () => {
  const { screen, escalations } = loadModules();
  const db = createDb({ [ENTRY]: { moment: 'Current danger', createdAt: 1 } });
  const first = await run(screen, db, async () => ({ tier: 3, confidence: 1 }));
  await run(screen, db, async () => { throw new Error('must not classify twice'); });
  assert.equal(first.outcome, 'critical');
  assert.equal(escalations.length, 1);
  assert.equal(db.docs.get(SCREENING).entryRevision, revision(db.docs.get(ENTRY)));
});
