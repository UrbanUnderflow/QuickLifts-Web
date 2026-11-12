// Daily goal: Nora helps the athlete list what is on their plate, choose the one
// that matters most, plan it, and talk about how it went that evening.
// Goals are private to the athlete and Nora. Coach surfaces never read them.

const COLLECTION = 'pulsecheck-daily-goals';
const REVIEW_HOUR = 16;
const MAX_ITEMS = 5;
const OUTCOMES = new Set(['done', 'partly', 'not_yet']);

function validTimeZone(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value.trim() });
    return value.trim();
  } catch {
    return null;
  }
}

/** Local day and hour for the athlete, computed on the server from their time zone. */
function resolveDayContext(timeZone, now = new Date()) {
  const zone = validTimeZone(timeZone) || 'America/New_York';
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23',
  }).formatToParts(now).map((part) => [part.type, part.value]));
  const dayKey = `${parts.year}-${parts.month}-${parts.day}`;
  const yesterday = new Date(Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day) - 1));
  return {
    timeZone: zone,
    dayKey,
    previousDayKey: yesterday.toISOString().slice(0, 10),
    hour: Number(parts.hour) % 24,
  };
}

const goalDocId = (userId, dayKey) => `${userId}_${dayKey}`;

function cleanText(value, max) {
  if (typeof value !== 'string') return '';
  return value.replace(/\s+/g, ' ').trim().slice(0, max);
}

/** Validates a goal from Nora's card or the athlete's own edit. Returns null when unusable. */
function sanitizeGoal(input) {
  if (!input || typeof input !== 'object') return null;
  const mainGoal = cleanText(input.mainGoal, 200);
  if (!mainGoal) return null;
  const items = (Array.isArray(input.items) ? input.items : [])
    .map((item) => cleanText(item, 140))
    .filter(Boolean)
    .filter((item, index, all) => all.findIndex((other) => other.toLowerCase() === item.toLowerCase()) === index)
    .slice(0, MAX_ITEMS);
  if (!items.some((item) => item.toLowerCase() === mainGoal.toLowerCase())) items.unshift(mainGoal);
  return {
    mainGoal,
    items: items.slice(0, MAX_ITEMS),
    plan: cleanText(input.plan, 400),
    backupPlan: cleanText(input.backupPlan, 300),
  };
}

function sanitizeReview(input) {
  if (!input || typeof input !== 'object' || !OUTCOMES.has(input.outcome)) return null;
  return { outcome: input.outcome, reflection: cleanText(input.reflection, 500) };
}

/**
 * setup: no goal yet and the day is still ahead
 * active: goal set, day in progress
 * review: goal set, evening, not talked through yet
 * reviewed / declined / none: nothing for Nora to start
 */
function goalPhase(goal, hour) {
  if (goal?.status === 'declined') return 'declined';
  if (!goal?.mainGoal) return hour < REVIEW_HOUR ? 'setup' : 'none';
  if (goal.review?.outcome) return 'reviewed';
  return hour >= REVIEW_HOUR ? 'review' : 'active';
}

function describeGoal(goal) {
  const lines = [`Main goal: ${goal.mainGoal}`];
  const others = (goal.items || []).filter((item) => item !== goal.mainGoal);
  if (others.length) lines.push(`Also on their list: ${others.join('; ')}`);
  if (goal.plan) lines.push(`Plan: ${goal.plan}`);
  if (goal.backupPlan) lines.push(`If something gets in the way: ${goal.backupPlan}`);
  return lines.join('\n');
}

function buildDailyGoalPromptSection({ phase, goal, previousGoal, hour }) {
  const timeOfDay = hour < 12 ? 'morning' : hour < REVIEW_HOUR ? 'afternoon' : 'evening';
  const header = `\n\n### Today's Goal\nIt is ${timeOfDay} for the athlete. Today's goal is private to the athlete and you; it is never shared with coaches.`;
  const previous = previousGoal?.mainGoal
    ? `\nYesterday's main goal was "${previousGoal.mainGoal}"${previousGoal.review?.outcome ? ` (they said: ${previousGoal.review.outcome.replace('_', ' ')})` : ''}. You may mention it once, briefly, only if it helps.`
    : '';

  if (phase === 'setup') {
    return `${header}${previous}
The athlete has not set a goal for today. Help them set one, the athlete leads:
- If they came with something on their mind, help with that first. Offer goal setting at a natural pause, not as a detour.
- If they say not today or seem uninterested, drop it for the rest of the day without pushing.
- Otherwise guide these steps, one short question per message:
  1. Ask what is on their plate today: practice, school, games, anything they want to get done. Collect two to four things in their own words.
  2. Ask which one, if it were the only thing they got done today, would matter most or feel most satisfying.
  3. Help them think through what actually needs to happen to get it done: what the steps are and when they will do it.
  4. Ask what could get in the way and what they will do if it does.
  5. Restate it in one or two sentences, their main goal, when and how, and the backup plan, and ask if that sounds right.
- If a goal is outside their control (win the game, get picked), help them turn it into something they control. Do not argue.
- Keep each message short. Do not interview: if they already answered a step, skip it.`;
  }
  if (phase === 'active') {
    return `${header}${previous}
They set this goal earlier today:
${describeGoal(goal)}
Do not start goal talk on your own. If they bring it up or it fits what they are saying, help them with it, and help adjust it if their day changed.`;
  }
  if (phase === 'review') {
    return `${header}
This morning they set:
${describeGoal(goal)}
If the athlete is open to it, ask how it went, using their own words for the goal. Then talk it through: what helped, what got in the way, what they want to carry into tomorrow. If it did not get done, treat it as something to notice and adjust, never a failure. If they came with something else on their mind, help with that first.`;
  }
  if (phase === 'reviewed') {
    return `${header}
Today's goal was "${goal.mainGoal}" and they already talked through how it went (${goal.review.outcome.replace('_', ' ')}). Do not ask about it again.`;
  }
  if (phase === 'declined') {
    return `${header}\nThey chose not to set a goal today. Do not bring goals up again today.`;
  }
  return '';
}

const SETUP_EXTRACTION_PROMPT = `You read the end of a conversation between an athlete and Nora, their mental performance coach, about setting a goal for today.
Return JSON: {"status": "proposed" | "declined" | "none", "items": [string], "mainGoal": string, "plan": string, "backupPlan": string}
- "proposed" only when Nora's LATEST reply restates the athlete's main goal for today and asks them to confirm it.
- "declined" only when the athlete clearly said they do not want to set a goal today.
- Otherwise "none" with empty fields.
- Write every field in the athlete's own words and language, short, second person where natural ("Finish the bio lab"). Never invent details.
- items: everything they listed for today, including the main goal. plan: when and how. backupPlan: what they will do if something gets in the way.`;

const REVIEW_EXTRACTION_PROMPT = `You read the end of a conversation between an athlete and Nora, their mental performance coach. This morning the athlete set a main goal for today (given below).
Return JSON: {"status": "reported" | "none", "outcome": "done" | "partly" | "not_yet", "reflection": string}
- "reported" only when the athlete has said in this conversation how the goal went today.
- outcome: done if they did it, partly if they made some progress, not_yet if they did not.
- reflection: one short sentence in the athlete's own words and language about what helped or got in the way. Never invent details.
- Otherwise "none".`;

async function requestJson({ apiKey, systemPrompt, userPrompt, signal, fetchImpl = fetch }) {
  const res = await fetchImpl('https://api.openai.com/v1/chat/completions', {
    signal: signal || AbortSignal.timeout(5000),
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
      temperature: 0,
      max_tokens: 300,
      response_format: { type: 'json_object' },
    }),
  });
  if (!res.ok) throw new Error(`goal extraction failed: ${res.status}`);
  const data = await res.json();
  return JSON.parse(data?.choices?.[0]?.message?.content || '{}');
}

function transcript(recentMessages, message, reply) {
  return [
    ...(recentMessages || []).slice(-8).map((m) => `${m.isFromUser || m.role === 'user' ? 'Athlete' : 'Nora'}: ${m.content || ''}`),
    `Athlete: ${message}`,
    `Nora: ${reply}`,
  ].join('\n');
}

/**
 * Reads the turn for a goal Nora just restated (setup) or a report of how it went (review).
 * Returns {kind: 'proposal'|'declined'|'review', ...} or null. Never throws.
 */
async function extractDailyGoalUpdate({ phase, goal, recentMessages, message, reply, apiKey, signal, request = requestJson }) {
  if (!apiKey || !['setup', 'review'].includes(phase)) return null;
  try {
    if (phase === 'setup') {
      const result = await request({
        apiKey, signal, systemPrompt: SETUP_EXTRACTION_PROMPT,
        userPrompt: transcript(recentMessages, message, reply),
      });
      if (result?.status === 'declined') return { kind: 'declined' };
      if (result?.status !== 'proposed') return null;
      const draft = sanitizeGoal(result);
      return draft ? { kind: 'proposal', goal: draft } : null;
    }
    const result = await request({
      apiKey, signal, systemPrompt: REVIEW_EXTRACTION_PROMPT,
      userPrompt: `Main goal: ${goal?.mainGoal || ''}\n\n${transcript(recentMessages, message, reply)}`,
    });
    if (result?.status !== 'reported') return null;
    const review = sanitizeReview(result);
    return review ? { kind: 'review', review } : null;
  } catch (error) {
    console.warn('[noraDailyGoal] extraction skipped:', error?.message || error);
    return null;
  }
}

/** Card the app shows so the athlete confirms before anything is saved. */
function buildDailyGoalAction(update, dayKey) {
  if (update?.kind === 'proposal') {
    return { id: `daily-goal-${dayKey}`, type: 'daily_goal', label: "Save today's goal", dayKey, goal: update.goal };
  }
  if (update?.kind === 'review') {
    return { id: `daily-goal-review-${dayKey}`, type: 'daily_goal_review', label: 'Save how it went', dayKey, review: update.review };
  }
  return null;
}

async function loadDailyGoals(db, userId, dayContext) {
  const ref = (key) => db.collection(COLLECTION).doc(goalDocId(userId, key));
  const [today, previous] = await Promise.all([ref(dayContext.dayKey).get(), ref(dayContext.previousDayKey).get()]);
  return {
    goal: today.exists ? today.data() : null,
    previousGoal: previous.exists ? previous.data() : null,
  };
}

module.exports = {
  COLLECTION,
  REVIEW_HOUR,
  resolveDayContext,
  goalDocId,
  sanitizeGoal,
  sanitizeReview,
  goalPhase,
  buildDailyGoalPromptSection,
  extractDailyGoalUpdate,
  buildDailyGoalAction,
  loadDailyGoals,
};
