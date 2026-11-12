// GET  /.netlify/functions/pulsecheck-daily-goal?timezone=America/New_York
//      -> { dayKey, phase, goal }
// POST { action: 'save', timezone, goal: { items, mainGoal, plan, backupPlan }, source }
//      { action: 'review', timezone, review: { outcome, reflection } }
//      { action: 'decline', timezone }
//
// Today's goal belongs to the athlete. Nora proposes it in chat and the athlete
// confirms it here. Coach surfaces never read this collection.

const { assertAccountOpen, accountOpenSet } = require('./lib/account-closure-guard');
const { initializeFirebaseAdmin, getFirebaseAdminApp, headers } = require('./config/firebase');
const {
  COLLECTION, resolveDayContext, goalDocId, sanitizeGoal, sanitizeReview, goalPhase,
} = require('./utils/noraDailyGoal');

const json = (statusCode, body) => ({ statusCode, headers, body: JSON.stringify(body) });

function publicGoal(data) {
  if (!data) return null;
  return {
    dayKey: data.dayKey,
    status: data.status,
    mainGoal: data.mainGoal || '',
    items: data.items || [],
    plan: data.plan || '',
    backupPlan: data.backupPlan || '',
    review: data.review?.outcome ? { outcome: data.review.outcome, reflection: data.review.reflection || '' } : null,
  };
}

async function handleDailyGoalRequest({ db, userId, method, query = {}, body = {}, now = new Date(), timestamp = Date.now(), write }) {
  const day = resolveDayContext(method === 'GET' ? query.timezone : body.timezone, now);
  const ref = db.collection(COLLECTION).doc(goalDocId(userId, day.dayKey));
  const save = write || ((data) => ref.set(data, { merge: true }));
  const snapshot = await ref.get();
  const current = snapshot.exists ? snapshot.data() : null;

  if (method === 'GET') {
    return json(200, { dayKey: day.dayKey, phase: goalPhase(current, day.hour), goal: publicGoal(current) });
  }

  const base = { userId, dayKey: day.dayKey, timezone: day.timeZone, updatedAt: timestamp };
  let next;
  switch (body.action) {
    case 'save': {
      const goal = sanitizeGoal(body.goal);
      if (!goal) return json(400, { error: 'A main goal is required.' });
      next = {
        ...base, ...goal, status: 'set',
        source: body.source === 'athlete' ? 'athlete' : 'nora',
        setAt: current?.setAt || timestamp,
      };
      break;
    }
    case 'review': {
      if (!current?.mainGoal) return json(409, { error: 'There is no goal for today yet.' });
      const review = sanitizeReview(body.review);
      if (!review) return json(400, { error: 'Choose how it went.' });
      next = { ...base, review: { ...review, reviewedAt: timestamp } };
      break;
    }
    case 'decline':
      if (current?.mainGoal) return json(200, { dayKey: day.dayKey, phase: goalPhase(current, day.hour), goal: publicGoal(current) });
      next = { ...base, status: 'declined', declinedAt: timestamp };
      break;
    default:
      return json(400, { error: 'Unknown action.' });
  }

  await save(next);
  const merged = { ...(current || {}), ...next };
  return json(200, { dayKey: day.dayKey, phase: goalPhase(merged, day.hour), goal: publicGoal(merged) });
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (!['GET', 'POST'].includes(event.httpMethod)) return json(405, { error: 'Method not allowed' });

  const firebaseRequest = { headers: event.headers || {} };
  let firebaseApp;
  try {
    initializeFirebaseAdmin(firebaseRequest);
    firebaseApp = getFirebaseAdminApp(firebaseRequest);
  } catch (error) {
    console.error('[pulsecheck-daily-goal] Firebase initialization error:', error?.message);
    return json(500, { error: 'Firebase initialization failed' });
  }
  const db = firebaseApp.firestore();

  const authorization = Object.entries(event.headers || {})
    .find(([key]) => key.toLowerCase() === 'authorization')?.[1] || '';
  const match = String(authorization).match(/^Bearer\s+([^\s]+)$/i);
  if (!match) return json(401, { error: 'Sign in is required.' });
  let userId;
  try {
    const decoded = await firebaseApp.auth().verifyIdToken(match[1], true);
    userId = String(decoded?.uid || '').trim();
    if (!userId) throw new Error('missing uid');
    await assertAccountOpen(db, userId);
  } catch {
    return json(401, { error: 'Your sign-in session is invalid or expired.' });
  }

  let body = {};
  if (event.httpMethod === 'POST') {
    try { body = JSON.parse(event.body || '{}'); } catch { return json(400, { error: 'Invalid JSON' }); }
  }

  try {
    return await handleDailyGoalRequest({
      db, userId, method: event.httpMethod, query: event.queryStringParameters || {}, body,
      write: (data) => accountOpenSet(db, userId, db.collection(COLLECTION).doc(goalDocId(userId, data.dayKey)), data, { merge: true }),
    });
  } catch (error) {
    console.error('[pulsecheck-daily-goal] failed:', error?.message);
    return json(500, { error: "Today's goal could not be saved. Try again." });
  }
};

exports.handleDailyGoalRequest = handleDailyGoalRequest;
exports.publicGoal = publicGoal;
