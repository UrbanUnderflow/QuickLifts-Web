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

function loadModules({ classification = { tier: 0 }, created = { escalationId: 'esc-1', consentRequired: true }, pushes = [], escalations = [], db = null, classifierCalls = [] } = {}) {
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
  stub(modulePaths.escalation, { runtimeHelpers: { createEscalationFromTrustedRuntime: async (body) => { escalations.push(body); return created; } } });
  stub(modulePaths.metrics, { isTrueCareEscalationClassification: (value) => Number(value?.tier || 0) >= 2 });
  stub(modulePaths.notifications, {
    resolvePulseCheckFcmToken: () => 'token-1',
    sendLoggedNoraPush: async (message) => { pushes.push(message); return { success: true }; },
  });
  return { screen: require(modulePaths.screen), guide: require(modulePaths.guide), pushes, escalations };
}

const ENTRY = 'pulsecheck-evidence-journals/athlete-1/entries/entry-1';
const SCREENING = 'pulsecheck-evidence-journals/athlete-1/screenings/entry-1';

test('a clear entry leaves a screening record with no text and no escalation', async () => {
  const { screen, escalations, pushes } = loadModules({ classification: { tier: 0, confidence: 0.2 } });
  const db = createDb({ [ENTRY]: { type: 'gratitude', moment: 'My sister came to my race.' } });
  const result = await screen.screenJournalEntry({ db, userId: 'athlete-1', entryId: 'entry-1' });
  assert.equal(result.status, 'done');
  assert.equal(result.outcome, 'clear');
  assert.equal(escalations.length, 0);
  assert.equal(pushes.length, 0);
  assert.equal(JSON.stringify(db.docs.get(SCREENING)).includes('sister'), false);
});

test('Tier 1 stays a screening record only (decision D4)', async () => {
  const { screen, escalations } = loadModules({ classification: { tier: 1, confidence: 0.9 } });
  const db = createDb({ [ENTRY]: { moment: 'Stressed about the meet.' } });
  const result = await screen.screenJournalEntry({ db, userId: 'athlete-1', entryId: 'entry-1' });
  assert.equal(result.tier, 1);
  assert.equal(escalations.length, 0);
});

test('Tier 2 escalates through the trusted path, keeps a check-in waiting, and sends a neutral push', async () => {
  const { screen, escalations, pushes } = loadModules({ classification: { tier: 2, confidence: 0.8, category: 'persistent-distress' } });
  const db = createDb({ [ENTRY]: { moment: 'x'.repeat(400) } });
  const result = await screen.screenJournalEntry({ db, userId: 'athlete-1', entryId: 'entry-1', messaging: {} });
  assert.equal(result.outcome, 'checkIn');
  assert.equal(escalations[0].sourceType, 'journal');
  assert.equal(escalations[0].sourceRef, 'entry-1');
  assert.ok(escalations[0].triggerContent.length <= 280);
  assert.equal(db.docs.get('pulsecheck-athlete-safety-state/athlete-1').journalCheckIn.escalationId, 'esc-1');
  assert.equal(pushes[0].body, 'Nora wants to check in with you.');
  assert.equal(pushes[0].data.type, 'journalCheckIn');
});

test('low-confidence Tier 3 is routed as Tier 2 with clinical review (decision D2)', async () => {
  const { screen, escalations } = loadModules({ classification: { tier: 3, confidence: 0.6 } });
  const db = createDb({ [ENTRY]: { moment: 'Hard day.' } });
  const result = await screen.screenJournalEntry({ db, userId: 'athlete-1', entryId: 'entry-1' });
  assert.equal(result.tier, 2);
  assert.equal(result.requiresClinicalReview, true);
  assert.equal(escalations[0].tier, 2);
});

test('confident Tier 3 is critical, reports honest handoff wording, and pushes the crisis wall', async () => {
  const { screen, pushes } = loadModules({
    classification: { tier: 3, confidence: 0.95 },
    created: { escalationId: 'esc-3', isCritical: true, handoffStatus: 'failed', success: false },
  });
  const db = createDb({ [ENTRY]: { moment: 'I cannot stay safe.' } });
  const result = await screen.screenJournalEntry({ db, userId: 'athlete-1', entryId: 'entry-1', messaging: {} });
  assert.equal(result.outcome, 'critical');
  assert.equal(result.handoff, 'unavailable');
  assert.equal(pushes[0].data.type, 'crisisWall');
  assert.equal(pushes[0].body.includes('safe'), false);
  assert.deepEqual(screen.safetyBlockFromScreening(result), { status: 'critical', escalationId: 'esc-3', handoff: 'unavailable' });
});

test('screening runs once: a finished screening is returned without classifying again', async () => {
  let calls = 0;
  const { screen } = loadModules();
  const db = createDb({ [ENTRY]: { moment: 'Fine.' }, [SCREENING]: { status: 'done', outcome: 'clear', tier: 0 } });
  const result = await screen.screenJournalEntry({ db, userId: 'athlete-1', entryId: 'entry-1', classify: async () => { calls += 1; return { tier: 3 }; } });
  assert.equal(result.outcome, 'clear');
  assert.equal(calls, 0);
});

test('a deleted entry is skipped and an organization can turn screening off (R11)', async () => {
  const { screen } = loadModules({ classification: { tier: 3, confidence: 1 } });
  const missing = await screen.screenJournalEntry({ db: createDb(), userId: 'athlete-1', entryId: 'entry-1' });
  assert.equal(missing.status, 'skipped');

  const db = createDb({
    [ENTRY]: { moment: 'Anything.' },
    'pulsecheck-team-memberships/team-1_athlete-1': { userId: 'athlete-1', organizationId: 'org-1' },
    'pulsecheck-organizations/org-1': { journalSafetyScreeningDisabled: true },
  });
  const off = await screen.screenJournalEntry({ db, userId: 'athlete-1', entryId: 'entry-1' });
  assert.equal(off.status, 'skipped');
  assert.equal(off.reason, 'organization_disabled');
});

test('classifier failure leaves the screening pending for the sweep', async () => {
  const { screen } = loadModules();
  const db = createDb({ [ENTRY]: { moment: 'Hello.' } });
  const result = await screen.screenJournalEntry({ db, userId: 'athlete-1', entryId: 'entry-1', classify: async () => { throw new Error('down'); } });
  assert.equal(result.status, 'pending');
  assert.equal(db.docs.get(SCREENING).attempts, 1);
});

test('guide validates drafts and only accepts one short question', () => {
  const { guide } = loadModules();
  const { validate, cleanQuestion, guidePrompt } = guide._private;
  const draftId = 'ef1be120-cc70-4abc-8ccc-e8b64dace850';
  assert.equal(validate({ type: 'diary', moment: 'a', draftId }).error, 'Invalid request.');
  assert.equal(validate({ type: 'gratitude', moment: '  ', draftId }).error, 'Write a little first, then ask Nora.');
  assert.equal(validate({ type: 'freewrite', moment: 'a', action: 'dropped', draftId }).action, '');
  assert.equal(cleanQuestion('"Who was there with you?"'), 'Who was there with you?');
  assert.equal(cleanQuestion('Here is a rewrite of your entry.'), null);
  assert.equal(cleanQuestion(`${'word '.repeat(25)}?`), null);
  assert.equal(cleanQuestion('What helped — the breathing?'), 'What helped, the breathing?');
  assert.match(guidePrompt({ type: 'evidence', moment: 'x', action: '', previousQuestions: ['What happened?'] }).user, /do not repeat/);
});

const JUNIOR_TEAM = {
  'pulsecheck-team-memberships/team-j_athlete-1': { userId: 'athlete-1', role: 'athlete', teamId: 'team-j' },
  'pulsecheck-teams/team-j': { commercialConfig: { youthTrack: 'junior' } },
};
const PRO_TEAM = {
  'pulsecheck-team-memberships/team-p_athlete-1': { userId: 'athlete-1', role: 'athlete', teamId: 'team-p' },
  'pulsecheck-teams/team-p': { commercialConfig: { youthTrack: 'pro' } },
};
const DRAFT_ID = 'ef1be120-cc70-4abc-8ccc-e8b64dace850';

async function callGuide(guide, draft) {
  const response = await guide.handler({ httpMethod: 'POST', headers: { authorization: 'Bearer t' }, body: JSON.stringify({ draftId: DRAFT_ID, ...draft }) });
  return { statusCode: response.statusCode, body: JSON.parse(response.body) };
}

async function withModel(content, run) {
  const originalFetch = global.fetch;
  const originalKey = process.env.OPEN_AI_SECRET_KEY;
  const calls = [];
  process.env.OPEN_AI_SECRET_KEY = 'test-key';
  global.fetch = async (url) => { calls.push(url); return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content } }] }) }; };
  try {
    return await run(calls);
  } finally {
    global.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.OPEN_AI_SECRET_KEY; else process.env.OPEN_AI_SECRET_KEY = originalKey;
  }
}

test('screening escalates a junior-track entry exactly like any other track', async () => {
  const { screen, escalations } = loadModules({ classification: { tier: 2, confidence: 0.8 } });
  const db = createDb({ ...JUNIOR_TEAM, [ENTRY]: { moment: 'Everything feels heavy lately.' } });
  const result = await screen.screenJournalEntry({ db, userId: 'athlete-1', entryId: 'entry-1', messaging: {} });
  assert.equal(result.outcome, 'checkIn');
  assert.equal(escalations.length, 1);
});

test('guide asks a pro-track athlete one question after the safety check', async () => {
  const classifierCalls = [];
  const { guide } = loadModules({ db: createDb(PRO_TEAM), classifierCalls });
  await withModel('What helped you most?', async (modelCalls) => {
    const result = await callGuide(guide, { type: 'evidence', moment: 'I reset after a bad serve.' });
    assert.equal(result.statusCode, 200);
    assert.equal(result.body.question, 'What helped you most?');
    assert.equal(classifierCalls.length, 1);
    assert.equal(modelCalls.length, 1);
  });
});

test('guide refuses a clear draft on the junior track without calling the question model', async () => {
  const classifierCalls = [];
  const { guide, escalations } = loadModules({ db: createDb(JUNIOR_TEAM), classifierCalls });
  await withModel('What helped you most?', async (modelCalls) => {
    const result = await callGuide(guide, { type: 'gratitude', moment: 'My coach stayed late with me.' });
    assert.equal(result.statusCode, 403);
    assert.equal(result.body.errorCode, 'nora_track_restricted');
    assert.equal(classifierCalls.length, 1, 'the safety check still runs');
    assert.equal(escalations.length, 0);
    assert.equal(modelCalls.length, 0);
  });
});

test('guide refuses an athlete with no team, since the default track is junior', async () => {
  const { guide } = loadModules({ db: createDb() });
  await withModel('What helped you most?', async (modelCalls) => {
    const result = await callGuide(guide, { type: 'freewrite', moment: 'Long day.' });
    assert.equal(result.statusCode, 403);
    assert.equal(modelCalls.length, 0);
  });
});

test('guide still escalates a Tier 2 draft on the rookie track', async () => {
  const db = createDb({
    'pulsecheck-team-memberships/team-r_athlete-1': { userId: 'athlete-1', role: 'athlete', teamId: 'team-r', athleteTrackOverride: 'rookie' },
    'pulsecheck-teams/team-r': { commercialConfig: { youthTrack: 'pro' } },
  });
  const { guide, escalations } = loadModules({ db, classification: { tier: 2, confidence: 0.85 } });
  await withModel('What helped you most?', async (modelCalls) => {
    const result = await callGuide(guide, { type: 'freewrite', moment: 'I do not want to be around anyone anymore.' });
    assert.equal(result.statusCode, 200);
    assert.equal(result.body.safety.status, 'checkIn');
    assert.equal(escalations[0].sourceType, 'journal_draft');
    assert.equal(modelCalls.length, 0);
  });
});
