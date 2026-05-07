import { Handler } from '@netlify/functions';
import {
  buildAdminAuditLogger,
  callAnthropic as callAnthropicCore,
} from '../../src/api/anthropic/serverBridge';
import { admin, db, headers as corsHeaders } from './config/firebase';
import { MACRA_DAILY_INSIGHT } from '../../src/api/anthropic/featureRouting';
import {
  buildNutritionFactLedger,
  formatDelta,
  selectCandidateInsight,
  validateAndAssembleInsight,
  type CandidateInsight,
  type DayTotal,
  type MacroTotals,
  type MealRecord,
  type NutritionFactLedger,
  type ValidatedNutritionInsight,
} from './utils/nutritionReasoningLayer';

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
  preferredCandidateId?: string;
  previousCandidateId?: string;
  previousType?: string;
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

const tzDayKey = (date: Date, timezone: string): string => {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return fmt.format(date);
};

const legacyDayKey = (isoDayKey: string): string | null => {
  const match = isoDayKey.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return `${match[2]}${match[3]}${match[1]}`;
};

const addDaysToIsoDayKey = (isoDayKey: string, days: number): string => {
  const [year, month, day] = isoDayKey.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days, 12, 0, 0));
  return date.toISOString().slice(0, 10);
};

const timezoneOffsetMs = (date: Date, timezone: string): number => {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const parts = Object.fromEntries(fmt.formatToParts(date).map(part => [part.type, part.value]));
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return asUtc - date.getTime();
};

const zonedStartOfDayUtcMs = (isoDayKey: string, timezone: string): number => {
  const [year, month, day] = isoDayKey.split('-').map(Number);
  const utcGuess = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
  const firstPass = new Date(utcGuess.getTime() - timezoneOffsetMs(utcGuess, timezone));
  return utcGuess.getTime() - timezoneOffsetMs(firstPass, timezone);
};

const mealIsoDayKey = (meal: MealRecord, fallbackTimezone: string): string => {
  const timezone = meal.loggedTimeZoneIdentifier || fallbackTimezone;
  return tzDayKey(new Date(meal.createdAt), timezone);
};

const sameRequestedDay = (meal: MealRecord, requestedIsoDayKey: string, fallbackTimezone: string): boolean => {
  if (meal.dayKey === requestedIsoDayKey) return true;
  const legacy = legacyDayKey(requestedIsoDayKey);
  if (legacy && meal.dayKey === legacy) return true;
  return mealIsoDayKey(meal, fallbackTimezone) === requestedIsoDayKey;
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

const loadMealsForDay = async (uid: string, dayKey: string, timezone: string): Promise<MealRecord[]> => {
  try {
    const startMs = zonedStartOfDayUtcMs(dayKey, timezone);
    const endMs = zonedStartOfDayUtcMs(addDaysToIsoDayKey(dayKey, 1), timezone);

    // Macra does not persist `dayKey` on mealLogs today. Query a widened
    // createdAt range, then filter with the same "meal's logged timezone"
    // bucketing the iOS app uses. This avoids UTC-day leakage around evening
    // logs and travel.
    const snap = await db.collection('users').doc(uid).collection('mealLogs')
      .where('createdAt', '>=', (startMs - 24 * 60 * 60 * 1000) / 1000)
      .where('createdAt', '<', (endMs + 24 * 60 * 60 * 1000) / 1000)
      .limit(50)
      .get();
    return snap.docs
      .map(d => parseMeal(d.data(), d.id))
      .filter((meal): meal is MealRecord => Boolean(meal) && sameRequestedDay(meal, dayKey, timezone))
      .sort((a, b) => a.createdAt - b.createdAt);
  } catch (err) {
    console.warn('[generate-macra-daily-insight] meals fetch failed:', err);
    return [];
  }
};

const parseMeal = (d: Record<string, unknown>, id?: string): MealRecord | null => {
  const name = stringish(d.name) || stringish(d.foodName) || 'Meal';
  return {
    id,
    name,
    calories: Math.round(numberish(d.calories)),
    protein: Math.round(numberish(d.protein)),
    carbs: Math.round(numberish(d.carbs)),
    fat: Math.round(numberish(d.fat)),
    createdAt: epochMs(d.createdAt),
    dayKey: stringish(d.dayKey),
    loggedTimeZoneIdentifier: stringish(d.loggedTimeZoneIdentifier),
  };
};

const loadDailyTotals = async (uid: string, todayKey: string, days: number, timezone: string): Promise<DayTotal[]> => {
  try {
    const cutoffSec = (Date.now() - days * 24 * 60 * 60 * 1000) / 1000;
    const snap = await db.collection('users').doc(uid).collection('mealLogs')
      .where('createdAt', '>=', cutoffSec)
      .limit(500)
      .get();

    const byDay = new Map<string, DayTotal>();
    for (const doc of snap.docs) {
      const meal = parseMeal(doc.data(), doc.id);
      if (!meal || meal.createdAt <= 0) continue;
      const key = mealIsoDayKey(meal, timezone);
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
  const validTarget = (target: MacroTotals): MacroTotals | null => {
    const values = [target.calories, target.protein, target.carbs, target.fat];
    return values.some(v => v > 0) ? target : null;
  };
  try {
    const snap = await db.collection('macro-profile').doc(uid).collection('macro-recommendations').orderBy('createdAt', 'desc').limit(1).get();
    if (!snap.empty) {
      const d = snap.docs[0].data();
      return validTarget({
        calories: Math.round(numberish(d.calories)),
        protein: Math.round(numberish(d.protein)),
        carbs: Math.round(numberish(d.carbs)),
        fat: Math.round(numberish(d.fat)),
      });
    }
    const userSnap = await db.collection('users').doc(uid).get();
    const personal = (userSnap.data()?.macros as Record<string, unknown> | undefined)?.personal as Record<string, unknown> | undefined;
    if (personal) {
      return validTarget({
        calories: Math.round(numberish(personal.calories)),
        protein: Math.round(numberish(personal.protein)),
        carbs: Math.round(numberish(personal.carbs)),
        fat: Math.round(numberish(personal.fat)),
      });
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
    const h = localHour(new Date(m.createdAt), m.loggedTimeZoneIdentifier || timezone);
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
  target: MacroTotals | null;
  weightTrend: { recentKg: number; sevenDayDeltaKg: number } | null;
  dayKey: string;
  hourLocal: number;
  timezone: string;
  factLedger: NutritionFactLedger;
  selectedCandidate: CandidateInsight;
  candidates: CandidateInsight[];
}): string => {
  const totals = params.factLedger.totals;
  const dist = distributionByBucket(params.todayMeals, params.timezone);

  const lines: string[] = [];
  lines.push(`Local time: ${params.hourLocal}:00 (${params.timezone}). Date: ${params.dayKey}.`);
  lines.push('AUTHORITATIVE FACT LEDGER:');
  lines.push(`- Canonical selected candidate: ${params.selectedCandidate.id} (${params.selectedCandidate.type}).`);
  lines.push(`- Canonical claim: ${params.selectedCandidate.claim}`);
  lines.push(`- Canonical fact: ${params.selectedCandidate.evidence[0] || 'No evidence.'}`);
  lines.push(`- Canonical interpretation: ${params.selectedCandidate.interpretation}`);
  lines.push(`- Canonical action: ${params.selectedCandidate.recommendedAction}`);
  if (params.factLedger.deltas.length > 0) {
    lines.push(`- Macro gaps vs target: ${params.factLedger.deltas.map(formatDelta).join('; ')}.`);
  }
  lines.push(`- Alternate eligible candidates: ${params.candidates.slice(0, 5).map(c => `${c.id}:${c.type}:${Math.round(c.score)}`).join(', ') || 'none'}.`);
  lines.push('Use the fact ledger and selected candidate for all totals/deltas. Do not invent, recalculate, or choose a different coaching angle.');
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
    const contributors = Object.values(params.factLedger.topContributors)
      .map(contributor => contributor ? `${contributor.macro}: ${contributor.mealName} (${contributor.amount}${contributor.unit})` : null)
      .filter(Boolean)
      .join('; ');
    if (contributors) lines.push(`Top contributors today: ${contributors}.`);
  }

  const HISTORY_WINDOW_DAYS = 14;
  const window = params.history.slice(0, HISTORY_WINDOW_DAYS);
  const loggedCount = window.length;
  const unloggedCount = Math.max(0, HISTORY_WINDOW_DAYS - loggedCount);

  if (loggedCount === 0) {
    lines.push(`History: no meals were logged on any of the past ${HISTORY_WINDOW_DAYS} days (excluding today). Tracking consistency itself is the highest-leverage angle today.`);
  } else {
    const proteinTarget = params.target?.protein || 0;
    const proteinHits = proteinTarget > 0 ? window.filter(d => d.protein >= proteinTarget * 0.92).length : 0;
    const avgCal = Math.round(window.reduce((s, d) => s + d.calories, 0) / loggedCount);
    const avgP = Math.round(window.reduce((s, d) => s + d.protein, 0) / loggedCount);

    lines.push(
      `History (past ${HISTORY_WINDOW_DAYS} days, excluding today): ${loggedCount} day(s) logged, ${unloggedCount} day(s) unlogged. ` +
      `Across the ${loggedCount} logged day(s) only: avg ${avgCal}kcal, avg P${avgP}g. ` +
      `Days protein hit (\u226592% target): ${proteinHits}/${loggedCount}. ` +
      `IMPORTANT: averages are computed only across logged days. Never describe these as "X-day average" where X is the window size — they are the average across the days that had logs.`
    );

    if (unloggedCount >= Math.ceil(HISTORY_WINDOW_DAYS / 2)) {
      lines.push(`Logging consistency flag: the user logged on roughly half (or fewer) of the last ${HISTORY_WINDOW_DAYS} days. This is itself a useful angle — call it out if it fits the insight.`);
    } else if (unloggedCount >= 3) {
      lines.push(`Logging gap: ${unloggedCount} of the last ${HISTORY_WINDOW_DAYS} days had no meals logged. Mention only if relevant — don't moralize.`);
    }
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
  "You are Nora, Macra's nutrition coach. You are the copy layer, not the reasoning layer.",
  "",
  'The server already selected the coaching decision. Your job is to make it clear, human, and concise without changing the facts, math, or angle.',
  "",
  'Use only the selected candidate and authoritative fact ledger in the context.',
  "",
  'Output fields:',
  '- title: decision headline, <= 56 chars. Must stand alone.',
  '- fact: exact ledger-backed fact sentence.',
  '- interpretation: why the fact matters. No moralizing.',
  '- action: one concrete next move. Keep it doable.',
  '- confidenceNote: null unless the context explicitly says confidence/data coverage is low.',
  "",
  'Hard rules:',
  '- Never invent, round differently, or calculate nutrition numbers.',
  '- Never use numbers not present in the context.',
  '- Do not choose a different insight type or coaching angle.',
  '- If the day is closed, use tomorrow framing only.',
  '- No moralizing language: good, bad, cheat, failed, clean, dirty.',
  '- No vague actions like "be mindful" or "eat balanced".',
  '- No trend/pattern language unless the selected candidate is a pattern candidate.',
  "",
  'Return ONLY valid JSON matching this schema exactly — no markdown, no prose:',
  '{',
  '  "title": "<decision headline>",',
  '  "fact": "<exact ledger-backed fact>",',
  '  "interpretation": "<why it matters>",',
  '  "action": "<one concrete next step>",',
  '  "confidenceNote": null | "<short data-confidence note>"',
  '}',
].join('\n');

interface GeneratedInsightCopy {
  title: string;
  fact: string;
  interpretation: string;
  action: string;
  confidenceNote: string | null;
}

const parseGeneratedCopy = (raw: string): Partial<GeneratedInsightCopy> => {
  const trimmed = raw.trim();
  const data = JSON.parse(trimmed);

  return {
    title: stringish(data.title),
    fact: stringish(data.fact),
    interpretation: stringish(data.interpretation),
    action: stringish(data.action) || '',
    confidenceNote: data.confidenceNote === null ? null : stringish(data.confidenceNote) || null,
  };
};

const loadPreviousInsightSelection = async (
  uid: string,
  dayKey: string,
): Promise<{ selectedCandidateId?: string; type?: string } | null> => {
  try {
    const snap = await db.collection('users').doc(uid).collection('macraInsights').doc(dayKey).get();
    if (!snap.exists) return null;
    const data = snap.data() || {};
    return {
      selectedCandidateId: stringish(data.selectedCandidateId),
      type: stringish(data.type),
    };
  } catch {
    return null;
  }
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
    loadMealsForDay(uid, dayKey, timezone),
    loadDailyTotals(uid, dayKey, 14, timezone),
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

  const previousSelection = !isInternalCaller
    ? await loadPreviousInsightSelection(uid, dayKey)
    : null;
  const previousCandidateId = stringish(body.previousCandidateId) || previousSelection?.selectedCandidateId;
  const previousType = stringish(body.previousType) || previousSelection?.type;

  const factLedger = buildNutritionFactLedger({
    date: dayKey,
    timezone,
    hourLocal,
    meals: todayMeals,
    target,
    history,
    frequentFoods,
    goalDirection: profile?.goalDirection,
    activityLevel: profile?.activityLevel,
  }, (meal) => localHour(new Date(meal.createdAt), meal.loggedTimeZoneIdentifier || timezone));

  const { selected, candidates, rejectedCandidateIds } = selectCandidateInsight({
    ledger: factLedger,
    meals: todayMeals,
    history,
    frequentFoods,
    previousCandidateId,
    previousType,
  });

  const contextBlock = buildContextBlock({
    profile, sport, todayMeals, history, frequentFoods, training, target, weightTrend,
    dayKey, hourLocal, timezone, factLedger, selectedCandidate: selected, candidates,
  });

  // Phase B+ full cutover routed through serverBridge Core: same gate +
  // audit log as the HTTP bridge for client callers, no round-trip.
  // Forced tool-use for JSON output (see generate-macra-meal-plan.ts for
  // the JSON OUTPUT PATTERN doc block).
  // TODO(prompt-cache): SYSTEM_PROMPT is ~900 tokens — under Sonnet 4.6's 2048
  // minimum. Add cache_control here once it crosses the threshold.
  let insightRaw: string | null = null;
  try {
    const result = await callAnthropicCore(
      {
        featureId: MACRA_DAILY_INSIGHT.featureId,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: `Context:\n${contextBlock}` }],
        tools: [
          {
            name: 'submit_daily_insight',
            description: 'Submit the daily insight in the structured schema.',
            input_schema: {
              type: 'object',
              properties: {
                title: { type: 'string', description: 'Decision headline.' },
                fact: { type: 'string', description: 'Exact ledger-backed fact sentence.' },
                interpretation: { type: 'string', description: 'Why the fact matters.' },
                action: { type: 'string', description: 'One concrete next step.' },
                confidenceNote: {
                  type: ['string', 'null'],
                  description: 'Short data-confidence note, or null when not needed.',
                },
              },
              required: ['title', 'fact', 'interpretation', 'action', 'confidenceNote'],
            },
          },
        ],
        toolChoice: { type: 'tool', name: 'submit_daily_insight' },
        callerContext: {
          transport: 'server-direct',
          caller: 'macra.generate-daily-insight',
          uid,
          dayKey,
        },
      },
      { auditLogger: buildAdminAuditLogger(db) },
    );
    if (!result.toolUseInput) {
      console.error('[generate-macra-daily-insight] response missing forced tool_use block');
      return {
        statusCode: 502,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'insight_bridge_failed' }),
      };
    }
    insightRaw = JSON.stringify(result.toolUseInput);
  } catch (err) {
    console.warn('[generate-macra-daily-insight] anthropic copy layer failed; using deterministic candidate copy:', err);
  }

  let insight: ValidatedNutritionInsight;
  try {
    insight = validateAndAssembleInsight({
      candidate: selected,
      ledger: factLedger,
      generated: insightRaw ? parseGeneratedCopy(insightRaw) : undefined,
      rejectedCandidateIds,
    });
  } catch {
    console.error('[generate-macra-daily-insight] parse failed:', (insightRaw || '').slice(0, 300));
    insight = validateAndAssembleInsight({
      candidate: selected,
      ledger: factLedger,
      rejectedCandidateIds,
    });
  }

  const persist = body.persist !== false;
  if (persist) {
    try {
      await db.collection('users').doc(uid).collection('macraInsights').doc(dayKey).set({
        ...insight,
        dayKey,
        timezone,
        response: insight.points.join('\n'),
        facts: factLedger,
        candidates: candidates.map(candidate => ({
          id: candidate.id,
          type: candidate.type,
          claim: candidate.claim,
          evidence: candidate.evidence,
          interpretation: candidate.interpretation,
          recommendedAction: candidate.recommendedAction,
          confidence: candidate.confidence,
          score: candidate.score,
          scoreBreakdown: candidate.scoreBreakdown,
          guardrails: candidate.guardrails,
        })),
        selectedCandidate: selected,
        nutritionContextSnapshot: {
          date: dayKey,
          timezone,
          ledger: factLedger,
          selectedCandidate: selected,
          candidates,
        },
        generatedAt: admin.firestore.FieldValue.serverTimestamp(),
        generatedAtEpochMs: Date.now(),
        reasoningLayerVersion: factLedger.version,
        source: isInternalCaller ? 'scheduled' : 'manual',
      }, { merge: true });
    } catch (err) {
      console.warn('[generate-macra-daily-insight] persist failed (continuing):', err);
    }
  }

  return {
    statusCode: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify({ insight, dayKey, timezone, facts: factLedger, candidates, selectedCandidate: selected }),
  };
};
