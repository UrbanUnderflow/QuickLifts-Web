/**
 * Turns a saved Workout or Food journal entry into proposed records (workout and food logging TDD, sections 7 to 9).
 *
 * Endpoint: POST /.netlify/functions/journal-extract
 * Body: { entryId, allowQuestion }
 * Auth: the athlete's own Firebase ID token. The entry is read from Firestore, never taken from the request.
 *
 * Returns: { workouts: [...], meals: [...], question: string | null } or { skipped: 'safety' | 'sensitive' | 'not_loggable' }
 *
 * Rules: only what the athlete wrote, empty fields stay empty, effort words never become numbers, and nothing about
 * calories. Proposals are not saved here; the athlete confirms them in the app.
 */

const { initializeFirebaseAdmin, getFirebaseAdminApp, headers } = require('./config/firebase');
const { runtimeHelpers: chatRuntime } = require('./pulsecheck-chat');

const LOGGABLE_TYPES = ['workout', 'food'];
const BUCKETS = ['steady_cardio', 'long_endurance', 'burst_sprints', 'explosive_bursts', 'heavy_resistance', 'mixed_conditioning', 'game_or_practice', 'active_recovery'];
const TIMINGS = ['before_training', 'after_training'];
const CONTEXTS = ['rushed', 'traveling', 'on_the_go', 'with_team', 'late'];
// Same guard as the Nora meal card: this language gets no food log, only the safety screening every entry gets.
const SENSITIVE = /purge|purging|binge|eating disorder|body image|guilt|guilty|suicid|poison|allergic|chest/i;
const MENTIONS_AMOUNT = /\d|hour|half|minute|\bmins?\b|\bone\b|\btwo\b|\bthree\b|\bfour\b|\bfive\b|\bten\b|twenty|thirty|forty|fifty|sixty/i;

const clip = (value, max) => (typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : null);
const wholeNumber = (value, min, max) => (Number.isInteger(value) && value >= min && value <= max ? value : null);

/** Keeps only what the entry supports, whatever the model returned. */
function sanitize(raw, entryText) {
  const hasAmounts = MENTIONS_AMOUNT.test(entryText);
  const hasDigits = /\d/.test(entryText);
  const workouts = (Array.isArray(raw?.workouts) ? raw.workouts : []).slice(0, 5).map((w) => ({
    activity: clip(w?.activity, 200),
    bucket: BUCKETS.includes(w?.bucket) ? w.bucket : null,
    durationMinutes: hasAmounts ? wholeNumber(w?.durationMinutes, 1, 600) : null,
    effortWords: clip(w?.effortWords, 200),
    timeText: clip(w?.timeText, 80),
    details: hasDigits ? (Array.isArray(w?.details) ? w.details : []).slice(0, 30).map((d) => ({
      exercise: clip(d?.exercise, 100),
      sets: wholeNumber(d?.sets, 1, 50),
      reps: wholeNumber(d?.reps, 1, 500),
      weight: typeof d?.weight === 'number' && d.weight >= 0 && d.weight <= 2000 ? d.weight : null,
      unit: ['lb', 'kg'].includes(d?.unit) ? d.unit : null,
    })).filter((d) => d.exercise) : [],
  })).filter((w) => w.activity);
  const meals = (Array.isArray(raw?.meals) ? raw.meals : []).slice(0, 8).map((m) => ({
    description: clip(m?.description, 500),
    timing: TIMINGS.includes(m?.timing) ? m.timing : null,
    context: [...new Set((Array.isArray(m?.context) ? m.context : []).filter((c) => CONTEXTS.includes(c)))],
    timeText: clip(m?.timeText, 80),
  })).filter((m) => m.description);
  return { workouts, meals };
}

/** At most one question, chosen by rule so it never drifts into coaching. */
function clarifyingQuestion({ workouts, meals }, type) {
  if (workouts.some((w) => w.durationMinutes == null)) return 'About how long was the workout?';
  if (type === 'food' && meals.length === 0) return 'What did you eat?';
  return null;
}

const SYSTEM_PROMPT = [
  'You extract records from an athlete\'s private journal entry. Reply with JSON only, shaped',
  '{"workouts":[{"activity":string,"bucket":string|null,"durationMinutes":number|null,"effortWords":string|null,"timeText":string|null,',
  '"details":[{"exercise":string,"sets":number|null,"reps":number|null,"weight":number|null,"unit":"lb"|"kg"|null}]}],',
  '"meals":[{"description":string,"timing":"before_training"|"after_training"|null,"context":string[],"timeText":string|null}]}.',
  'Use only what the athlete wrote. Never guess. Leave a field null or empty when they did not say it.',
  'activity: a few words in their words, like "legs" or "5k run". durationMinutes: only if they stated a length of time.',
  'effortWords: copy their words about how hard it was, never a number. details: only exercises with stated sets, reps, or weight.',
  `bucket: one of ${BUCKETS.join(', ')}, only when clearly implied.`,
  'meals: one item per distinct meal or snack, description in their words. timing: only if they said before or after training or practice.',
  `context: only from ${CONTEXTS.join(', ')} and only if they said it. timeText: the time words they used, like "after practice".`,
  'Never estimate calories, portions, or nutrition. Never judge food.',
].join(' ');

async function requestExtraction(entryText, fetchImpl = fetch) {
  const apiKey = process.env.OPEN_AI_SECRET_KEY;
  if (!apiKey) throw new Error('Extraction model unavailable');
  const response = await fetchImpl('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: entryText }],
    }),
  });
  if (!response.ok) throw new Error(`Extraction model failed: ${response.status}`);
  const payload = await response.json();
  return JSON.parse(payload?.choices?.[0]?.message?.content || '{}');
}

async function extractEntry({ db, userId, entryId, allowQuestion, extract = requestExtraction }) {
  const base = db.collection('pulsecheck-evidence-journals').doc(userId);
  const [entrySnap, screeningSnap] = await Promise.all([base.collection('entries').doc(entryId).get(), base.collection('screenings').doc(entryId).get()]);
  if (!entrySnap.exists) return { skipped: 'not_loggable' };
  const entry = entrySnap.data();
  if (!LOGGABLE_TYPES.includes(entry.type)) return { skipped: 'not_loggable' };
  const screening = screeningSnap.exists ? screeningSnap.data() : null;
  if (screening?.outcome === 'checkIn' || screening?.outcome === 'critical') return { skipped: 'safety' };

  const entryText = [entry.moment, entry.action].filter(Boolean).join('\n');
  if (SENSITIVE.test(entryText)) return { skipped: 'sensitive' };

  // A photo-only food entry becomes one meal with no description for the athlete to name.
  if (!entryText.trim()) return { workouts: [], meals: entry.type === 'food' ? [{ description: null, timing: null, context: [], timeText: null }] : [], question: null };

  const proposals = sanitize(await extract(entryText), entryText);
  // Nora asks a question only once screening came back clear, and never on tracks without Nora conversation.
  const screenedClear = screening?.status === 'done' || screening?.status === 'skipped';
  return { ...proposals, question: allowQuestion === true && screenedClear ? clarifyingQuestion(proposals, entry.type) : null };
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  try {
    const request = { headers: event.headers || {} };
    initializeFirebaseAdmin(request);
    const app = getFirebaseAdminApp(request);
    const caller = await chatRuntime.verifyPulseCheckCaller(app, event);
    const { entryId, allowQuestion } = JSON.parse(event.body || '{}');
    if (typeof entryId !== 'string' || !/^[0-9a-f-]{36}$/i.test(entryId)) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Choose a valid entry.' }) };
    const result = await extractEntry({ db: app.firestore(), userId: caller.userId, entryId: entryId.toLowerCase(), allowQuestion });
    console.log('[journal-extract]', JSON.stringify({ skipped: result.skipped || null, workouts: result.workouts?.length || 0, meals: result.meals?.length || 0 }));
    return { statusCode: 200, headers, body: JSON.stringify(result) };
  } catch (error) {
    const statusCode = error?.statusCode || 503;
    return { statusCode, headers, body: JSON.stringify({ error: statusCode === 401 ? 'Sign in is required.' : 'Nora could not set up your log right now. You can add it yourself.' }) };
  }
};

exports.extractEntry = extractEntry;
exports._private = { sanitize, clarifyingQuestion, SENSITIVE };
