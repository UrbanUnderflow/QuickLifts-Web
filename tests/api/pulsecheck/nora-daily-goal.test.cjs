const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '../../..');
const goals = require(path.join(repoRoot, 'netlify/functions/utils/noraDailyGoal.js'));

// The endpoint's Firebase and closure modules are not needed for the request logic.
const firebasePath = path.join(repoRoot, 'netlify/functions/config/firebase.js');
const guardPath = path.join(repoRoot, 'netlify/functions/lib/account-closure-guard.js');
require.cache[firebasePath] = { id: firebasePath, filename: firebasePath, loaded: true, exports: { headers: {}, initializeFirebaseAdmin() {}, getFirebaseAdminApp() {} } };
require.cache[guardPath] = { id: guardPath, filename: guardPath, loaded: true, exports: { assertAccountOpen: async () => {}, accountOpenSet: async () => {} } };
const { handleDailyGoalRequest } = require(path.join(repoRoot, 'netlify/functions/pulsecheck-daily-goal.js'));

function fakeDb(initial = {}) {
  const docs = new Map(Object.entries(initial));
  return {
    docs,
    collection: (name) => ({
      doc: (id) => ({
        async get() { const key = `${name}/${id}`; return { exists: docs.has(key), data: () => docs.get(key) }; },
        async set(data, opts) { const key = `${name}/${id}`; docs.set(key, opts?.merge ? { ...(docs.get(key) || {}), ...data } : data); },
      }),
    }),
  };
}

// 2026-11-12 13:30 UTC is 08:30 in New York and 21:30 in Shanghai.
const MORNING_NY = new Date('2026-11-12T13:30:00Z');
const EVENING_NY = new Date('2026-11-12T22:30:00Z');

test('the athlete day comes from their time zone, not the server clock', () => {
  assert.deepEqual(goals.resolveDayContext('America/New_York', MORNING_NY), {
    timeZone: 'America/New_York', dayKey: '2026-11-12', previousDayKey: '2026-11-11', hour: 8,
  });
  const seoul = goals.resolveDayContext('Asia/Seoul', EVENING_NY);
  assert.equal(seoul.dayKey, '2026-11-13');
  assert.equal(seoul.hour, 7);
  assert.equal(goals.resolveDayContext('Not/AZone', MORNING_NY).timeZone, 'America/New_York');
  assert.equal(goals.resolveDayContext('Asia/Seoul', new Date('2026-03-01T03:00:00Z')).previousDayKey, '2026-02-28');
});

test('the phase follows the day: set up before 4pm, review after, quiet once done or declined', () => {
  const goal = { mainGoal: 'Finish the bio lab', status: 'set' };
  assert.equal(goals.goalPhase(null, 8), 'setup');
  assert.equal(goals.goalPhase(null, 15), 'setup');
  assert.equal(goals.goalPhase(null, 17), 'none');
  assert.equal(goals.goalPhase(goal, 11), 'active');
  assert.equal(goals.goalPhase(goal, 16), 'review');
  assert.equal(goals.goalPhase({ ...goal, review: { outcome: 'partly' } }, 20), 'reviewed');
  assert.equal(goals.goalPhase({ status: 'declined' }, 9), 'declined');
});

test('goals are cleaned, capped and always include the main goal in the list', () => {
  const goal = goals.sanitizeGoal({
    mainGoal: '  Finish   the bio lab ',
    items: ['Stay calm on free throws', 'stay calm on free throws', 'Call my mom', 'a', 'b', 'c', 'd'],
    plan: 'During study hall',
    backupPlan: 'Right after dinner if practice runs late',
  });
  assert.equal(goal.mainGoal, 'Finish the bio lab');
  assert.equal(goal.items[0], 'Finish the bio lab');
  assert.equal(goal.items.length, 5);
  assert.equal(goal.items.filter((item) => /free throws/i.test(item)).length, 1);
  assert.equal(goals.sanitizeGoal({ items: ['x'] }), null);
  assert.equal(goals.sanitizeReview({ outcome: 'great' }), null);
  assert.deepEqual(goals.sanitizeReview({ outcome: 'not_yet', reflection: 'Practice ran long' }), { outcome: 'not_yet', reflection: 'Practice ran long' });
});

test('Nora gets the guide that matches the phase and the goal stays private', () => {
  const setup = goals.buildDailyGoalPromptSection({ phase: 'setup', hour: 8 });
  assert.match(setup, /what is on their plate/i);
  assert.match(setup, /only thing they got done today/i);
  assert.match(setup, /what could get in the way/i);
  assert.match(setup, /not today/i);
  assert.match(setup, /never shared with coaches/i);
  const goal = { mainGoal: 'Finish the bio lab', items: ['Finish the bio lab', 'Call my mom'], plan: 'Study hall', backupPlan: 'After dinner' };
  const review = goals.buildDailyGoalPromptSection({ phase: 'review', goal, hour: 19 });
  assert.match(review, /Finish the bio lab/);
  assert.match(review, /Call my mom/);
  assert.match(review, /never a failure/i);
  assert.match(goals.buildDailyGoalPromptSection({ phase: 'active', goal, hour: 11 }), /Do not start goal talk/);
  assert.match(goals.buildDailyGoalPromptSection({ phase: 'declined', hour: 11 }), /Do not bring goals up again/);
  assert.match(goals.buildDailyGoalPromptSection({ phase: 'setup', hour: 7, previousGoal: { mainGoal: 'Ice my knee', review: { outcome: 'not_yet' } } }), /Ice my knee.*not yet/);
  assert.equal(goals.buildDailyGoalPromptSection({ phase: 'none', hour: 20 }), '');
});

test('a restated goal becomes a card the athlete confirms; nothing is saved by the chat', async () => {
  const seen = [];
  const update = await goals.extractDailyGoalUpdate({
    phase: 'setup', apiKey: 'k', message: 'The lab matters most. Study hall, or after dinner if practice runs late.',
    reply: "So today's main goal is to finish the bio lab during study hall, and after dinner if practice runs late. Sound right?",
    recentMessages: [{ content: "What's on your plate today?", isFromUser: false }],
    request: async (args) => { seen.push(args); return { status: 'proposed', items: ['Finish the bio lab', 'Call my mom'], mainGoal: 'Finish the bio lab', plan: 'During study hall', backupPlan: 'After dinner if practice runs late' }; },
  });
  assert.equal(update.kind, 'proposal');
  assert.match(seen[0].userPrompt, /Nora: What's on your plate today\?/);
  const action = goals.buildDailyGoalAction(update, '2026-11-12');
  assert.equal(action.type, 'daily_goal');
  assert.equal(action.id, 'daily-goal-2026-11-12');
  assert.equal(action.goal.mainGoal, 'Finish the bio lab');
});

test('saying not today, a review, nothing to report, or a failed extraction', async () => {
  const run = (phase, result) => goals.extractDailyGoalUpdate({ phase, apiKey: 'k', message: 'm', reply: 'r', goal: { mainGoal: 'Finish the bio lab' }, request: async () => result });
  assert.deepEqual(await run('setup', { status: 'declined' }), { kind: 'declined' });
  assert.equal(await run('setup', { status: 'none' }), null);
  assert.equal(await run('setup', { status: 'proposed', mainGoal: '' }), null);
  const review = await run('review', { status: 'reported', outcome: 'partly', reflection: 'Got half done before practice' });
  assert.equal(goals.buildDailyGoalAction(review, '2026-11-12').type, 'daily_goal_review');
  assert.equal(await run('review', { status: 'reported', outcome: 'amazing' }), null);
  assert.equal(await run('active', { status: 'proposed', mainGoal: 'x' }), null, 'no extraction outside setup and review');
  assert.equal(await goals.extractDailyGoalUpdate({ phase: 'setup', apiKey: 'k', message: 'm', reply: 'r', request: async () => { throw new Error('timeout'); } }), null);
  assert.equal(await goals.extractDailyGoalUpdate({ phase: 'setup', apiKey: '', message: 'm', reply: 'r', request: async () => ({ status: 'proposed', mainGoal: 'x' }) }), null);
});

test('the endpoint saves a confirmed goal, records how it went, and respects not today', async () => {
  const db = fakeDb();
  const request = (method, body, now = MORNING_NY) => handleDailyGoalRequest({ db, userId: 'u1', method, body, query: { timezone: 'America/New_York' }, now, timestamp: 100 });
  let res = await request('GET');
  assert.deepEqual(JSON.parse(res.body), { dayKey: '2026-11-12', phase: 'setup', goal: null });

  res = await request('POST', { action: 'save', timezone: 'America/New_York', goal: { mainGoal: 'Finish the bio lab', items: ['Call my mom'], plan: 'Study hall' } });
  let out = JSON.parse(res.body);
  assert.equal(res.statusCode, 200);
  assert.equal(out.phase, 'active');
  assert.deepEqual(out.goal.items, ['Finish the bio lab', 'Call my mom']);
  assert.equal(db.docs.get('pulsecheck-daily-goals/u1_2026-11-12').userId, 'u1');

  res = await request('POST', { action: 'review', timezone: 'America/New_York', review: { outcome: 'done', reflection: 'Study hall worked' } }, EVENING_NY);
  out = JSON.parse(res.body);
  assert.equal(out.phase, 'reviewed');
  assert.equal(out.goal.review.outcome, 'done');
  assert.equal(out.goal.mainGoal, 'Finish the bio lab', 'a review keeps the goal');

  res = await request('POST', { action: 'decline', timezone: 'America/New_York' });
  assert.equal(JSON.parse(res.body).goal.mainGoal, 'Finish the bio lab', 'declining never erases a set goal');

  const fresh = fakeDb();
  res = await handleDailyGoalRequest({ db: fresh, userId: 'u2', method: 'POST', body: { action: 'decline', timezone: 'America/New_York' }, now: MORNING_NY, timestamp: 1 });
  assert.equal(JSON.parse(res.body).phase, 'declined');
});

test('the endpoint rejects empty goals, reviews without a goal and unknown actions', async () => {
  const db = fakeDb();
  const post = (body) => handleDailyGoalRequest({ db, userId: 'u1', method: 'POST', body: { timezone: 'America/New_York', ...body }, now: MORNING_NY });
  assert.equal((await post({ action: 'save', goal: { mainGoal: '  ' } })).statusCode, 400);
  assert.equal((await post({ action: 'review', review: { outcome: 'done' } })).statusCode, 409);
  assert.equal((await post({ action: 'delete' })).statusCode, 400);
  assert.equal(db.docs.size, 0);
});
