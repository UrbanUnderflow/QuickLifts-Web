import { Handler } from '@netlify/functions';
import { admin, db, headers as corsHeaders } from './config/firebase';

interface MealRecord {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  createdAt: number;
}

interface DayTotal {
  dayKey: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  mealCount: number;
}

interface MacraProfile {
  sex?: string;
  birthdate?: number;
  heightCm?: number;
  currentWeightKg?: number;
  goalWeightKg?: number;
  pace?: string;
  activityLevel?: string;
  dietaryPreference?: string;
  biggestStruggle?: string;
  goalDirection?: string;
}

interface SportContext {
  sportId?: string;
  sportName?: string;
  position?: string;
  noraContext?: string;
  macraNutritionContext?: string;
  riskFlags?: string[];
}

interface FwpTrainingContext {
  todaySession?: { name: string; durationMin: number; rpe?: number };
  yesterdaySession?: { name: string; rpe?: number };
  recentRpeAvg?: number;
  daysSinceLastSession?: number;
  fatigueFlag?: boolean;
}

interface RequestBody {
  date?: string;        // YYYY-MM-DD; defaults to today in user's tz
  userId?: string;      // honored only with valid internal token
  persist?: boolean;    // defaults true
  timezone?: string;    // IANA, defaults 'America/New_York'
}

const INTERNAL_TOKEN_HEADER = 'x-macra-internal-token';

const getHeader = (headers: Record<string, string | undefined> | undefined, name: string): string | undefined => {
  if (!headers) return undefined;
  const direct = headers[name];
  if (direct) return direct;
  const lower = name.toLowerCase();
  const key = Object.keys(headers).find(k => k.toLowerCase() === lower);
  return key ? headers[key] : undefined;
};

const verifyAuth = async (authHeader: string | undefined): Promise<string | null> => {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  try {
    const decoded = await admin.auth().verifyIdToken(authHeader.split('Bearer ')[1]);
    return decoded.uid;
  } catch {
    return null;
  }
};

const resolveBridgeBaseUrl = (event: { headers?: Record<string, string | undefined> }): string => {
  const host = getHeader(event.headers, 'host') || process.env.URL || 'https://fitwithpulse.ai';
  if (host.startsWith('http://') || host.startsWith('https://')) return host;
  return `https://${host}`;
};

const tzDayKey = (date: Date, timezone: string): string => {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return fmt.format(date);
};

const localHour = (date: Date, timezone: string): number => {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: '2-digit',
    hour12: false,
  });
  const part = fmt.formatToParts(date).find(p => p.type === 'hour');
  return part ? parseInt(part.value, 10) : 0;
};

const numberish = (v: unknown): number => {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
};

const stringish = (v: unknown): string | undefined => {
  return typeof v === 'string' && v.trim().length > 0 ? v.trim() : undefined;
};

const epochMs = (v: unknown): number => {
  const n = numberish(v);
  if (n <= 0) return 0;
  return n > 10_000_000_000 ? n : n * 1000;
};

const loadMacraProfile = async (uid: string): Promise<MacraProfile | null> => {
  try {
    const snap = await db.collection('users').doc(uid).collection('macra').doc('profile').get();
    if (!snap.exists) return null;
    const d = snap.data() || {};
    return {
      sex: stringish(d.sex),
      birthdate: epochMs(d.birthdate),
      heightCm: numberish(d.heightCm) || undefined,
      currentWeightKg: numberish(d.currentWeightKg) || undefined,
      goalWeightKg: numberish(d.goalWeightKg) || undefined,
      pace: stringish(d.pace),
      activityLevel: stringish(d.activityLevel),
      dietaryPreference: stringish(d.dietaryPreference),
      biggestStruggle: stringish(d.biggestStruggle),
      goalDirection: stringish(d.goalDirection),
    };
  } catch {
    return null;
  }
};

const loadSportContext = async (uid: string, profile: MacraProfile | null): Promise<SportContext | null> => {
  if (!profile || profile.activityLevel !== 'athlete') return null;
  try {
    const userRef = db.collection('users').doc(uid);
    const [userSnap, sportConfigSnap] = await Promise.all([
      userRef.get(),
      db.collection('company-config').doc('pulsecheck-sports').get(),
    ]);
    const u = userSnap.data() || {};
    const sportId = stringish(u.athleteSport) || stringish(u.sport);
    if (!sportId) return null;

    const sports = Array.isArray(sportConfigSnap.data()?.sports) ? sportConfigSnap.data()?.sports : [];
    const cfg = sports.find((s: Record<string, unknown>) => stringish(s.id) === sportId);

    return {
      sportId,
      sportName: stringish(u.athleteSportName) || stringish(cfg?.name),
      position: stringish(u.athleteSportPosition) || stringish(u.position),
      noraContext: stringish(cfg?.prompting?.noraContext),
      macraNutritionContext: stringish(cfg?.prompting?.macraNutritionContext),
      riskFlags: Array.isArray(cfg?.prompting?.riskFlags) ? cfg.prompting.riskFlags : [],
    };
  } catch {
    return null;
  }
};

const loadMealsForDay = async (uid: string, dayKey: string): Promise<MealRecord[]> => {
  try {
    const snap = await db.collection('users').doc(uid).collection('mealLogs')
      .where('dayKey', '==', dayKey)
      .limit(50)
      .get();
    if (!snap.empty) return snap.docs.map(d => parseMeal(d.data())).filter(Boolean) as MealRecord[];

    const [year, month, day] = dayKey.split('-').map(Number);
    const start = Date.UTC(year, month - 1, day) / 1000;
    const end = start + 24 * 60 * 60;
    const fallback = await db.collection('users').doc(uid).collection('mealLogs')
      .where('createdAt', '>=', start)
      .where('createdAt', '<', end)
      .limit(50)
      .get();
    return fallback.docs.map(d => parseMeal(d.data())).filter(Boolean) as MealRecord[];
  } catch (err) {
    console.warn('[generate-macra-daily-insight] meals fetch failed:', err);
    return [];
  }
};

const parseMeal = (d: Record<string, unknown>): MealRecord | null => {
  const name = stringish(d.name) || stringish(d.foodName) || 'Meal';
  return {
    name,
    calories: Math.round(numberish(d.calories)),
    protein: Math.round(numberish(d.protein)),
    carbs: Math.round(numberish(d.carbs)),
    fat: Math.round(numberish(d.fat)),
    createdAt: epochMs(d.createdAt),
  };
};

const loadDailyTotals = async (uid: string, todayKey: string, days: number): Promise<DayTotal[]> => {
  try {
    const cutoffSec = (Date.now() - days * 24 * 60 * 60 * 1000) / 1000;
    const snap = await db.collection('users').doc(uid).collection('mealLogs')
      .where('createdAt', '>=', cutoffSec)
      .limit(500)
      .get();

    const byDay = new Map<string, DayTotal>();
    for (const doc of snap.docs) {
      const meal = parseMeal(doc.data());
      if (!meal || meal.createdAt <= 0) continue;
      const key = (doc.data().dayKey as string) || tzDayKey(new Date(meal.createdAt), 'UTC');
      const existing = byDay.get(key) || { dayKey: key, calories: 0, protein: 0, carbs: 0, fat: 0, mealCount: 0 };
      existing.calories += meal.calories;
      existing.protein += meal.protein;
      existing.carbs += meal.carbs;
      existing.fat += meal.fat;
      existing.mealCount += 1;
      byDay.set(key, existing);
    }
    return Array.from(byDay.values())
      .filter(d => d.dayKey !== todayKey)
      .sort((a, b) => b.dayKey.localeCompare(a.dayKey));
  } catch {
    return [];
  }
};

const loadFrequentFoods = async (uid: string, days: number): Promise<string[]> => {
  try {
    const cutoffSec = (Date.now() - days * 24 * 60 * 60 * 1000) / 1000;
    const snap = await db.collection('users').doc(uid).collection('mealLogs')
      .where('createdAt', '>=', cutoffSec)
      .limit(500)
      .get();
    const counts = new Map<string, number>();
    for (const doc of snap.docs) {
      const name = stringish(doc.data().name);
      if (!name) continue;
      counts.set(name, (counts.get(name) || 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name]) => name);
  } catch {
    return [];
  }
};

const loadFwpTraining = async (uid: string, todayKey: string, timezone: string): Promise<FwpTrainingContext | null> => {
  try {
    const cutoffSec = (Date.now() - 14 * 24 * 60 * 60 * 1000) / 1000;
    const snap = await db.collection('users').doc(uid).collection('workoutSessions')
      .where('createdAt', '>=', cutoffSec)
      .orderBy('createdAt', 'desc')
      .limit(20)
      .get();
    if (snap.empty) return null;

    const sessions = snap.docs.map(d => {
      const data = d.data();
      const ts = epochMs(data.completedAt) || epochMs(data.createdAt);
      return {
        name: stringish(data.workoutTitle) || stringish(data.name) || 'Workout',
        rpe: numberish(data.rpe) || numberish(data.averageRpe) || undefined,
        durationMin: Math.round(numberish(data.duration) / 60),
        ts,
        dayKey: ts > 0 ? tzDayKey(new Date(ts), timezone) : '',
      };
    }).filter(s => s.ts > 0);

    if (sessions.length === 0) return null;

    const today = sessions.find(s => s.dayKey === todayKey);
    const yesterdayKey = (() => {
      const d = new Date(todayKey + 'T12:00:00Z');
      d.setUTCDate(d.getUTCDate() - 1);
      return tzDayKey(d, timezone);
    })();
    const yesterday = sessions.find(s => s.dayKey === yesterdayKey);

    const rpes = sessions.slice(0, 5).map(s => s.rpe).filter((v): v is number => typeof v === 'number');
    const recentRpeAvg = rpes.length > 0 ? rpes.reduce((a, b) => a + b, 0) / rpes.length : undefined;

    const last = sessions[0];
    const daysSince = last.ts > 0 ? Math.floor((Date.now() - last.ts) / (24 * 60 * 60 * 1000)) : undefined;

    return {
      todaySession: today ? { name: today.name, durationMin: today.durationMin, rpe: today.rpe } : undefined,
      yesterdaySession: yesterday ? { name: yesterday.name, rpe: yesterday.rpe } : undefined,
      recentRpeAvg,
      daysSinceLastSession: daysSince,
      fatigueFlag: typeof recentRpeAvg === 'number' && recentRpeAvg >= 8.5,
    };
  } catch (err) {
    console.warn('[generate-macra-daily-insight] FWP training fetch failed:', err);
    return null;
  }
};

const loadMacroTarget = async (uid: string): Promise<{ calories: number; protein: number; carbs: number; fat: number } | null> => {
  try {
    const snap = await db.collection('macro-profile').doc(uid).collection('macro-recommendations').orderBy('createdAt', 'desc').limit(1).get();
    if (!snap.empty) {
      const d = snap.docs[0].data();
      return {
        calories: Math.round(numberish(d.calories)),
        protein: Math.round(numberish(d.protein)),
        carbs: Math.round(numberish(d.carbs)),
        fat: Math.round(numberish(d.fat)),
      };
    }
    const userSnap = await db.collection('users').doc(uid).get();
    const personal = (userSnap.data()?.macros as Record<string, unknown> | undefined)?.personal as Record<string, unknown> | undefined;
    if (personal) {
      return {
        calories: Math.round(numberish(personal.calories)),
        protein: Math.round(numberish(personal.protein)),
        carbs: Math.round(numberish(personal.carbs)),
        fat: Math.round(numberish(personal.fat)),
      };
    }
    return null;
  } catch {
    return null;
  }
};

const loadWeightTrend = async (uid: string): Promise<{ recentKg: number; sevenDayDeltaKg: number } | null> => {
  try {
    const snap = await db.collection('users').doc(uid).get();
    const arr = snap.data()?.bodyWeight;
    if (!Array.isArray(arr) || arr.length === 0) return null;
    const sorted = arr
      .map((w: Record<string, unknown>) => ({
        kg: numberish(w.newWeight) / 2.20462,
        ts: epochMs(w.updatedAt) || epochMs(w.createdAt),
      }))
      .filter(w => w.kg > 0 && w.ts > 0)
      .sort((a, b) => b.ts - a.ts);
    if (sorted.length === 0) return null;
    const recent = sorted[0];
    const weekAgo = sorted.find(w => Date.now() - w.ts >= 6 * 24 * 60 * 60 * 1000);
    return {
      recentKg: recent.kg,
      sevenDayDeltaKg: weekAgo ? recent.kg - weekAgo.kg : 0,
    };
  } catch {
    return null;
  }
};

const distributionByBucket = (meals: MealRecord[], timezone: string): { morning: number; midday: number; evening: number; late: number } => {
  const buckets = { morning: 0, midday: 0, evening: 0, late: 0 };
  for (const m of meals) {
    if (m.createdAt <= 0) continue;
    const h = localHour(new Date(m.createdAt), timezone);
    if (h < 11) buckets.morning += m.protein;
    else if (h < 16) buckets.midday += m.protein;
    else if (h < 21) buckets.evening += m.protein;
    else buckets.late += m.protein;
  }
  return buckets;
};

const buildContextBlock = (params: {
  profile: MacraProfile | null;
  sport: SportContext | null;
  todayMeals: MealRecord[];
  history: DayTotal[];
  frequentFoods: string[];
  training: FwpTrainingContext | null;
  target: { calories: number; protein: number; carbs: number; fat: number } | null;
  weightTrend: { recentKg: number; sevenDayDeltaKg: number } | null;
  dayKey: string;
  hourLocal: number;
  timezone: string;
}): string => {
  const totals = params.todayMeals.reduce((a, m) => ({
    calories: a.calories + m.calories,
    protein: a.protein + m.protein,
    carbs: a.carbs + m.carbs,
    fat: a.fat + m.fat,
  }), { calories: 0, protein: 0, carbs: 0, fat: 0 });

  const dist = distributionByBucket(params.todayMeals, params.timezone);

  const lines: string[] = [];
  lines.push(`Local time: ${params.hourLocal}:00 (${params.timezone}). Date: ${params.dayKey}.`);
  if (params.hourLocal < 21) {
    lines.push('Window: there is still time today for the user to act on this insight.');
  } else {
    lines.push('Window: day is essentially closed; frame insight as next-day adjustment, not "you should eat X tonight".');
  }

  if (params.profile) {
    const p = params.profile;
    lines.push(`Profile: ${p.sex || '?'}, activity ${p.activityLevel || '?'}, goal ${p.goalDirection || '?'}, pace ${p.pace || '?'}${p.dietaryPreference && p.dietaryPreference !== 'none' ? `, diet ${p.dietaryPreference}` : ''}.`);
  }

  if (params.sport) {
    const s = params.sport;
    lines.push(`Sport: ${s.sportName || s.sportId}${s.position ? ` (${s.position})` : ''}.`);
    if (s.macraNutritionContext) lines.push(`Sport nutrition policy: ${s.macraNutritionContext}`);
    if (s.riskFlags && s.riskFlags.length > 0) lines.push(`Sport risk flags: ${s.riskFlags.join(', ')}.`);
  }

  if (params.target) {
    const t = params.target;
    lines.push(`Daily target: ${t.calories}kcal P${t.protein}g C${t.carbs}g F${t.fat}g.`);
  }

  lines.push(`Today totals: ${totals.calories}kcal P${totals.protein}g C${totals.carbs}g F${totals.fat}g across ${params.todayMeals.length} meals.`);
  lines.push(`Today protein distribution: morning ${dist.morning}g, midday ${dist.midday}g, evening ${dist.evening}g, late ${dist.late}g.`);

  if (params.todayMeals.length > 0) {
    const mealList = params.todayMeals
      .sort((a, b) => a.createdAt - b.createdAt)
      .map(m => `- ${m.name}: ${m.calories}kcal P${m.protein}g C${m.carbs}g F${m.fat}g`)
      .join('\n');
    lines.push(`Meals today:\n${mealList}`);
  }

  if (params.history.length > 0) {
    const window = params.history.slice(0, 14);
    const proteinTarget = params.target?.protein || 0;
    const proteinHits = proteinTarget > 0 ? window.filter(d => d.protein >= proteinTarget * 0.92).length : 0;
    lines.push(`Last ${window.length} days: avg ${Math.round(window.reduce((s, d) => s + d.calories, 0) / window.length)}kcal/day, avg P${Math.round(window.reduce((s, d) => s + d.protein, 0) / window.length)}g/day. Days protein hit (\u226592% target): ${proteinHits}/${window.length}.`);
  }

  if (params.frequentFoods.length > 0) {
    lines.push(`Top foods (last 30d): ${params.frequentFoods.join(', ')}.`);
  }

  if (params.training) {
    const t = params.training;
    const parts: string[] = [];
    if (t.todaySession) parts.push(`today: ${t.todaySession.name}${t.todaySession.rpe ? ` RPE ${t.todaySession.rpe}` : ''}`);
    if (t.yesterdaySession) parts.push(`yesterday: ${t.yesterdaySession.name}${t.yesterdaySession.rpe ? ` RPE ${t.yesterdaySession.rpe}` : ''}`);
    if (typeof t.recentRpeAvg === 'number') parts.push(`recent avg RPE ${t.recentRpeAvg.toFixed(1)}`);
    if (typeof t.daysSinceLastSession === 'number') parts.push(`${t.daysSinceLastSession}d since last session`);
    if (t.fatigueFlag) parts.push('fatigue flag: yes');
    if (parts.length > 0) lines.push(`FWP training: ${parts.join('; ')}.`);
  }

  if (params.weightTrend) {
    const w = params.weightTrend;
    const dirNote = w.sevenDayDeltaKg === 0
      ? 'flat'
      : `${w.sevenDayDeltaKg > 0 ? '+' : ''}${(w.sevenDayDeltaKg * 2.20462).toFixed(1)}lb over last 7d`;
    lines.push(`Weight trend: ${(w.recentKg * 2.20462).toFixed(1)}lb (${dirNote}).`);
  }

  return lines.join('\n');
};

const SYSTEM_PROMPT = [
  "You are Nora, Macra's nutrition coach. You produce ONE daily insight that is specific, useful, and unique to this user — not generic 'eat more protein' advice.",
  "",
  'Pick the SINGLE most useful angle for this person right now from these categories:',
  '- predictive: it is still early enough to act today; project where they will land and recommend a specific food + amount',
  '- pattern: a multi-day pattern worth surfacing (e.g. misses cluster on no-lift days, weekend protein dips)',
  '- distribution: when they ate matters more than how much (e.g. 80% of protein landed after 6pm)',
  '- outcome: tie food to weight trend or goal trajectory',
  '- training_coupled: tie food to the workout/recovery context (FWP RPE, fatigue, today/tomorrow training)',
  '- pantry: reference foods they actually log (not generic "Greek yogurt") with a one-tap closer',
  "",
  'Rules:',
  '- Reference at least one specific number or food from the context. No generic advice.',
  '- If the day is essentially closed (late evening), frame as next-day adjustment, never "eat X tonight".',
  '- If sport context is supplied, use sport-specific framing (game-day, training load, position demand).',
  "- Don't moralize ('good'/'bad'). Don't restate the math.",
  "- Never refer to meals as 'meal 1/2/3' — use the names they logged.",
  '- Keep response under 280 chars.',
  "",
  'Return ONLY valid JSON matching this schema:',
  '{',
  '  "type": "predictive|pattern|distribution|outcome|training_coupled|pantry",',
  '  "title": "<42 chars>",',
  '  "response": "<1-3 sentences, <280 chars>",',
  '  "icon": "<SF Symbol name>"',
  '}',
].join('\n');

interface InsightResult {
  type: string;
  title: string;
  response: string;
  icon: string;
}

const parseInsight = (raw: string): InsightResult => {
  const trimmed = raw.trim();
  const data = JSON.parse(trimmed);
  return {
    type: stringish(data.type) || 'pattern',
    title: stringish(data.title) || "Today's read",
    response: stringish(data.response) || trimmed,
    icon: stringish(data.icon) || 'sparkles',
  };
};

export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: corsHeaders, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  let body: RequestBody = {};
  try { body = JSON.parse(event.body || '{}'); } catch {
    return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const internalToken = getHeader(event.headers, INTERNAL_TOKEN_HEADER);
  const expectedInternal = process.env.MACRA_INSIGHT_INTERNAL_TOKEN;
  const isInternalCaller = Boolean(internalToken && expectedInternal && internalToken === expectedInternal);

  let uid: string | null = null;
  if (isInternalCaller) {
    uid = stringish(body.userId) || null;
    if (!uid) {
      return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'userId required for internal caller' }) };
    }
  } else {
    uid = await verifyAuth(getHeader(event.headers, 'authorization'));
    if (!uid) {
      return { statusCode: 401, headers: corsHeaders, body: JSON.stringify({ error: 'Unauthorized' }) };
    }
  }

  const timezone = stringish(body.timezone) || 'America/New_York';
  const now = new Date();
  const dayKey = stringish(body.date) || tzDayKey(now, timezone);
  const hourLocal = localHour(now, timezone);

  const profile = await loadMacraProfile(uid);
  const [sport, todayMeals, history, frequentFoods, training, target, weightTrend] = await Promise.all([
    loadSportContext(uid, profile),
    loadMealsForDay(uid, dayKey),
    loadDailyTotals(uid, dayKey, 14),
    loadFrequentFoods(uid, 30),
    loadFwpTraining(uid, dayKey, timezone),
    loadMacroTarget(uid),
    loadWeightTrend(uid),
  ]);

  if (todayMeals.length === 0 && hourLocal < 14) {
    return {
      statusCode: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ skipped: true, reason: 'no_meals_yet_early_day' }),
    };
  }

  const contextBlock = buildContextBlock({
    profile, sport, todayMeals, history, frequentFoods, training, target, weightTrend,
    dayKey, hourLocal, timezone,
  });

  const bridgeBase = resolveBridgeBaseUrl(event);
  const bridgeAuth = isInternalCaller
    ? { 'x-pulsecheck-internal-bridge': '1' }
    : { Authorization: `Bearer ${(getHeader(event.headers, 'authorization') || '').split('Bearer ')[1]}` };

  let insightRaw: string;
  try {
    const response = await fetch(`${bridgeBase}/api/openai/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'openai-organization': 'macraDailyInsight',
        ...bridgeAuth,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        max_tokens: 600,
        temperature: 0.5,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: `Context:\n${contextBlock}` },
        ],
      }),
    });
    if (!response.ok) {
      const text = await response.text();
      console.error('[generate-macra-daily-insight] bridge error', response.status, text.slice(0, 300));
      return { statusCode: 502, headers: corsHeaders, body: JSON.stringify({ error: 'insight_bridge_failed' }) };
    }
    const data = await response.json();
    insightRaw = data?.choices?.[0]?.message?.content || '';
  } catch (err) {
    console.error('[generate-macra-daily-insight] fetch error:', err);
    return { statusCode: 502, headers: corsHeaders, body: JSON.stringify({ error: 'insight_bridge_failed' }) };
  }

  let insight: InsightResult;
  try {
    insight = parseInsight(insightRaw);
  } catch {
    console.error('[generate-macra-daily-insight] parse failed:', insightRaw.slice(0, 300));
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: 'insight_parse_failed' }) };
  }

  const persist = body.persist !== false;
  if (persist) {
    try {
      await db.collection('users').doc(uid).collection('macraInsights').doc(dayKey).set({
        ...insight,
        dayKey,
        timezone,
        generatedAt: admin.firestore.FieldValue.serverTimestamp(),
        generatedAtEpochMs: Date.now(),
        source: isInternalCaller ? 'scheduled' : 'manual',
      }, { merge: true });
    } catch (err) {
      console.warn('[generate-macra-daily-insight] persist failed (continuing):', err);
    }
  }

  return {
    statusCode: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify({ insight, dayKey, timezone }),
  };
};
