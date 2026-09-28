const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '../../..');
const utilsPath = path.join(repoRoot, 'netlify/functions/pulsecheck-notification-utils.js');
const nudgePath = path.join(repoRoot, 'netlify/functions/utils/connected-session-nudge.js');
function load({ suppressed = false } = {}) {
  delete require.cache[nudgePath];
  require.cache[utilsPath] = { id: utilsPath, filename: utilsPath, loaded: true, exports: {
    resolvePulseCheckFcmToken: () => 'token', sendLoggedNoraPush: async () => ({ success: true }),
    loadPulseCheckNudgeSuppressionState: async () => ({ suppressed }),
  } };
  return require(nudgePath);
}
function db({ ledger = {}, logged = false } = {}) {
  const state = { ledger };
  const ledgerRef = {
    async get() { return { data: () => ({ sessionNudges: state.ledger }) }; },
    async set(value) { state.ledger = value.sessionNudges; },
    collection: () => ({ where: () => ({ limit: () => ({ async get() { return { empty: !logged }; } }) }) }),
  };
  return { state, firestore: { collection: (name) => ({ doc: () => (name === 'users' ? { async get() { return { exists: true, data: () => ({}) }; } } : ledgerRef) }) } };
}
const now = 1_790_000_000_000;
const recent = [{ id: 'a', startAt: (now - 2 * 3_600_000) / 1000, endAt: (now - 3_600_000) / 1000 }];

test('a new recent WHOOP workout sends one neutral invite and is never sent twice', async () => {
  const { nudgeForNewWhoopWorkouts, _private } = load();
  const sent = [];
  const { firestore, state } = db();
  const first = await nudgeForNewWhoopWorkouts({ firestore, messaging: {}, userId: 'u', workouts: recent, now, send: async (m) => { sent.push(m); return { success: true }; } });
  assert.equal(first.sent, true);
  assert.equal(sent[0].body, _private.BODY);
  assert.equal(/\d/.test(sent[0].body), false);
  const again = await nudgeForNewWhoopWorkouts({ firestore, messaging: {}, userId: 'u', workouts: recent, now, send: async (m) => { sent.push(m); return { success: true }; } });
  assert.equal(again.sent, false);
  assert.equal(sent.length, 1);
  assert.ok(state.ledger.notifiedSessionIds.includes('whoop:a'));
});

test('no invite for old workouts, logged sessions, the daily limit, or suppressed athletes', async () => {
  const send = async () => { throw new Error('should not send'); };
  const old = await load().nudgeForNewWhoopWorkouts({ firestore: db().firestore, messaging: {}, userId: 'u', workouts: [{ id: 'b', startAt: (now - 30 * 3_600_000) / 1000 }], now, send });
  assert.equal(old.reason, 'no_new_workout');
  const logged = await load().nudgeForNewWhoopWorkouts({ firestore: db({ logged: true }).firestore, messaging: {}, userId: 'u', workouts: recent, now, send });
  assert.equal(logged.reason, 'already_logged');
  const daily = await load().nudgeForNewWhoopWorkouts({ firestore: db({ ledger: { lastSentAt: now - 3_600_000 } }).firestore, messaging: {}, userId: 'u', workouts: recent, now, send });
  assert.equal(daily.reason, 'daily_limit');
  const suppressed = await load({ suppressed: true }).nudgeForNewWhoopWorkouts({ firestore: db().firestore, messaging: {}, userId: 'u', workouts: recent, now, send });
  assert.equal(suppressed.reason, 'suppressed');
});

test('week summary guard rejects food numbers and rest-day claims', () => {
  const summaryPath = path.join(repoRoot, 'netlify/functions/journal-week-summary.js');
  for (const p of [summaryPath, path.join(repoRoot, 'netlify/functions/config/firebase.js'), path.join(repoRoot, 'netlify/functions/pulsecheck-chat.js')]) delete require.cache[p];
  require.cache[path.join(repoRoot, 'netlify/functions/config/firebase.js')] = { id: 'c', filename: 'c', loaded: true, exports: { initializeFirebaseAdmin() {}, getFirebaseAdminApp: () => ({}), headers: {} } };
  require.cache[path.join(repoRoot, 'netlify/functions/pulsecheck-chat.js')] = { id: 'p', filename: 'p', loaded: true, exports: { runtimeHelpers: {} } };
  const { _private } = require(summaryPath);
  assert.equal(_private.acceptable('You logged two workouts and wrote that legs felt tough.'), true);
  assert.equal(_private.acceptable('You ate about 2,000 calories.'), false);
  assert.equal(_private.acceptable('Tuesday was a rest day.'), false);
  assert.equal(_private.factualSummary({ workouts: [], meals: [] }), "You haven't logged anything this week yet.");
});
