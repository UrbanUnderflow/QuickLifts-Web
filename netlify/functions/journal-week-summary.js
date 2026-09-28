/**
 * Nora's on-request summary of an athlete's week (workout and food logging TDD, section 9, "Look back").
 *
 * Endpoint: POST /.netlify/functions/journal-week-summary
 * Body: { from, to }   epoch milliseconds, at most 8 days apart
 * Auth: the athlete's own Firebase ID token. Only tracks with Nora conversation get a summary.
 *
 * Nora describes what was recorded and connects it to what the athlete wrote. She never claims causes, gives advice,
 * mentions nutrition numbers, or treats a day with nothing logged as a rest day or a skipped meal.
 */

const { initializeFirebaseAdmin, getFirebaseAdminApp, headers } = require('./config/firebase');
const { runtimeHelpers: chatRuntime } = require('./pulsecheck-chat');
const { resolvePulseCheckYouthTrack, allowsDirectNoraChat } = require('./utils/pulsecheck-youth-track');

const MAX_RANGE_MS = 8 * 86_400_000;
const NUMBERS_ABOUT_FOOD = /\b(k?cal(orie)?s?|macros?|protein|carbs?|fat)\b/i;

async function whoopSessions(db, userId, from, to) {
  const refs = [];
  for (let t = from - 86_400_000; t <= to + 86_400_000; t += 86_400_000) {
    refs.push(db.collection('health-context-source-records').doc(`${userId}_whoop_training_${new Date(t).toISOString().slice(0, 10)}`));
  }
  const docs = await db.getAll(...refs);
  const sessions = new Map();
  for (const doc of docs) {
    const data = doc.exists ? doc.data() : null;
    if (!data || data.athleteUserId !== userId || data.status !== 'active') continue;
    for (const w of data.payload?.workouts || []) {
      const startedAt = Number(w?.startAt) * 1000;
      if (w?.id && startedAt >= from && startedAt <= to) sessions.set(`whoop:${w.id}`, { id: `whoop:${w.id}`, sport: w.sportName || 'Workout', durationMinutes: w.durationMinutes ?? null, startedAt });
    }
  }
  return [...sessions.values()];
}

/** Only facts, with the athlete's own words about how things felt. No nutrition numbers are ever included. */
async function gatherWeek(db, userId, from, to) {
  const base = db.collection('pulsecheck-activity-records').doc(userId);
  const [workoutSnap, mealSnap, sessions] = await Promise.all([
    base.collection('workouts').where('startedAt', '>=', from).where('startedAt', '<=', to).get(),
    base.collection('meals').where('eatenAt', '>=', from).where('eatenAt', '<=', to).get(),
    whoopSessions(db, userId, from, to).catch(() => []),
  ]);
  const workouts = workoutSnap.docs.map((d) => d.data());
  const meals = mealSnap.docs.map((d) => d.data());
  const entryIds = [...new Set([...workouts, ...meals].map((r) => r.entryId).filter(Boolean))].slice(0, 20);
  const entries = entryIds.length
    ? (await db.getAll(...entryIds.map((id) => db.collection('pulsecheck-evidence-journals').doc(userId).collection('entries').doc(id))))
      .filter((d) => d.exists && ['workout', 'food'].includes(d.data().type)).map((d) => d.data())
    : [];
  const linked = new Set(workouts.map((w) => w.connectedSessionId).filter(Boolean));
  const day = (ms) => new Date(ms).toISOString().slice(0, 10);
  return {
    workouts: [
      ...workouts.map((w) => ({ day: day(w.startedAt), activity: w.activity, minutes: w.durationMinutes ?? null, effort: w.effortRating ?? null, theirWords: w.effortWords ?? null })),
      ...sessions.filter((s) => !linked.has(s.id)).map((s) => ({ day: day(s.startedAt), activity: s.sport, minutes: s.durationMinutes, effort: null, theirWords: null, fromDevice: true })),
    ],
    meals: meals.map((m) => ({ day: day(m.eatenAt), description: m.description || 'a photo', timing: m.timing || null, context: m.context || [] })),
    reflections: entries.map((e) => ({ type: e.type, howItFelt: e.action || null })).filter((r) => r.howItFelt).slice(0, 10),
    daysWithNothingLogged: (() => {
      const logged = new Set([...workouts.map((w) => day(w.startedAt)), ...meals.map((m) => day(m.eatenAt)), ...sessions.map((s) => day(s.startedAt))]);
      let count = 0;
      for (let t = from; t <= to; t += 86_400_000) if (!logged.has(day(t))) count += 1;
      return count;
    })(),
  };
}

const SYSTEM_PROMPT = [
  'You are Nora, an AI mental-performance coach, summarizing an athlete\'s week from their own log. Write 2 to 4 short sentences',
  'in plain words a smart 13-year-old understands, speaking to the athlete as "you".',
  'Describe only what was recorded. You may connect records to what they wrote about how it felt, quoting their words briefly.',
  'Never say one thing caused another. Never give advice, suggestions, or next steps. Never judge food or mention calories or nutrition.',
  'Days with nothing logged are unknown: never call them rest days, days off, or skipped meals. Do not use em dashes. Output only the summary.',
].join(' ');

async function requestSummary(facts, fetchImpl = fetch) {
  const apiKey = process.env.OPEN_AI_SECRET_KEY;
  if (!apiKey) throw new Error('Summary model unavailable');
  const response = await fetchImpl('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: 'gpt-4o-mini', temperature: 0.3, max_tokens: 180, messages: [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: JSON.stringify(facts) }] }),
  });
  if (!response.ok) throw new Error(`Summary model failed: ${response.status}`);
  const payload = await response.json();
  return String(payload?.choices?.[0]?.message?.content || '').trim();
}

/** A plain fallback built from the facts alone, used when the model is unavailable or strays. */
function factualSummary(facts) {
  const parts = [];
  if (facts.workouts.length) parts.push(`You logged ${facts.workouts.length} ${facts.workouts.length === 1 ? 'workout' : 'workouts'} this week.`);
  if (facts.meals.length) parts.push(`You added ${facts.meals.length} ${facts.meals.length === 1 ? 'meal' : 'meals'} to your food log.`);
  if (!parts.length) return 'You haven\'t logged anything this week yet.';
  return parts.join(' ');
}

function acceptable(text) {
  return Boolean(text) && text.length <= 700 && !NUMBERS_ABOUT_FOOD.test(text) && !/\b(rest day|day off|skipped)\b/i.test(text);
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  try {
    const request = { headers: event.headers || {} };
    initializeFirebaseAdmin(request);
    const app = getFirebaseAdminApp(request);
    const caller = await chatRuntime.verifyPulseCheckCaller(app, event);
    const db = app.firestore();
    const { track } = await resolvePulseCheckYouthTrack(db, caller.userId);
    if (!allowsDirectNoraChat(track)) return { statusCode: 403, headers, body: JSON.stringify({ error: 'Nora summaries are not available on your track.' }) };
    const { from, to } = JSON.parse(event.body || '{}');
    if (!Number.isFinite(from) || !Number.isFinite(to) || to < from || to - from > MAX_RANGE_MS) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Choose a week.' }) };
    const facts = await gatherWeek(db, caller.userId, from, to);
    if (!facts.workouts.length && !facts.meals.length) return { statusCode: 200, headers, body: JSON.stringify({ summary: factualSummary(facts) }) };
    let summary = await requestSummary(facts).catch(() => '');
    summary = summary.replace(/\s*[—–]\s*/g, ', ');
    return { statusCode: 200, headers, body: JSON.stringify({ summary: acceptable(summary) ? summary : factualSummary(facts) }) };
  } catch (error) {
    const statusCode = error?.statusCode || 503;
    return { statusCode, headers, body: JSON.stringify({ error: statusCode === 401 ? 'Sign in is required.' : 'Nora could not look back right now. Try again in a moment.' }) };
  }
};

exports._private = { gatherWeek, factualSummary, acceptable };
