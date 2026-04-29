import { Handler } from '@netlify/functions';
import Anthropic from '@anthropic-ai/sdk';
import { admin, db, headers as corsHeaders } from './config/firebase';
import { NORA_NUTRITION_CHAT } from '../../src/api/anthropic/featureRouting';

interface IngredientContext {
  name: string;
  quantity: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

interface MealContext {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  ingredients?: IngredientContext[];
}

interface AttachedMealContext extends MealContext {
  loggedOnLabel?: string;
  loggedOnKey?: string;
}

interface MacroTargetContext {
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface MacraProfileContext {
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

interface PlannedMealContext {
  order: number;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  isCompleted: boolean;
  notes?: string;
  ingredients?: IngredientContext[];
}

interface MealPlanContext {
  planName?: string;
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  meals: PlannedMealContext[];
}

interface UserDocContext {
  email?: string;
  registrationEntryPoint?: string;
  subscriptionType?: string;
  hasCompletedMacraOnboarding?: boolean;
  ageYears?: number;
  extraFields: Record<string, string | number | boolean>;
}

interface PulseCheckAthleteContext {
  sport?: string;
  position?: string;
  seasonPhase?: string;
  primaryMentalChallenge?: string;
  primaryPerformanceGoal?: string;
  sportId?: string;
  sportName?: string;
  schemaVersion?: number;
  attributes?: Record<string, unknown>;
  prompting?: {
    noraContext?: string;
    macraNutritionContext?: string;
    riskFlags?: string[];
    restrictedAdvice?: string[];
    recommendedLanguage?: string[];
  };
  attributeDefinitions?: Array<{
    key: string;
    label: string;
    includeInMacraContext?: boolean;
    includeInNoraContext?: boolean;
    options?: Array<{ label: string; value: string }>;
  }>;
}

interface RequestBody {
  query: string;
  meals: MealContext[];
  attachedMeals?: AttachedMealContext[];
  target?: MacroTargetContext;
  history?: ChatMessage[];
  goal?: string;
  threadDate?: string;
  threadDateKey?: string;
  threadDateLabel?: string;
  selectedDate?: string;
  selectedDateKey?: string;
  selectedDateLabel?: string;
  logDate?: string;
  logDateKey?: string;
  logDateLabel?: string;
  currentDate?: string;
  currentDateKey?: string;
  timezone?: string;
  isToday?: boolean;
}

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
    const token = authHeader.split('Bearer ')[1];
    const decoded = await admin.auth().verifyIdToken(token);
    return decoded.uid;
  } catch (err) {
    console.error('[nora-nutrition-chat] Auth verification failed:', err);
    return null;
  }
};

const numberFromUnknown = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
};

const stringFromUnknown = (value: unknown): string | undefined => {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
};

const stringListFromUnknown = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => stringFromUnknown(entry))
    .filter((entry): entry is string => Boolean(entry));
};

// Historical meal context — server-side load of N-day rolling totals and
// frequent foods so Nora can reason about trends instead of saying "I only
// see today's log." Mirrors the helpers in generate-macra-daily-insight.ts.

interface HistoricalDayTotal {
  dayKey: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  mealCount: number;
}

interface HistoricalMealContext {
  recentDays: HistoricalDayTotal[];
  frequentFoods: string[];
}

const epochMsFromUnknown = (value: unknown): number => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value > 1e12 ? value : value * 1000;
  }
  if (value && typeof value === 'object' && '_seconds' in (value as Record<string, unknown>)) {
    const seconds = numberFromUnknown((value as Record<string, unknown>)._seconds);
    return typeof seconds === 'number' ? seconds * 1000 : 0;
  }
  if (value && typeof value === 'object' && 'toMillis' in (value as Record<string, unknown>)) {
    try {
      return (value as { toMillis: () => number }).toMillis();
    } catch {
      return 0;
    }
  }
  return 0;
};

const tzDayKey = (date: Date, timezone: string): string => {
  try {
    const fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return fmt.format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
};

const loadDailyTotals = async (
  uid: string,
  todayKey: string,
  days: number,
  timezone: string,
): Promise<HistoricalDayTotal[]> => {
  try {
    const cutoffSec = (Date.now() - days * 24 * 60 * 60 * 1000) / 1000;
    const snap = await db
      .collection('users')
      .doc(uid)
      .collection('mealLogs')
      .where('createdAt', '>=', cutoffSec)
      .limit(500)
      .get();

    const byDay = new Map<string, HistoricalDayTotal>();
    for (const doc of snap.docs) {
      const data = doc.data();
      const createdAt = epochMsFromUnknown(data.createdAt);
      if (createdAt <= 0) continue;
      const key =
        stringFromUnknown(data.dayKey) || tzDayKey(new Date(createdAt), timezone);
      const existing =
        byDay.get(key) ||
        { dayKey: key, calories: 0, protein: 0, carbs: 0, fat: 0, mealCount: 0 };
      existing.calories += Math.round(numberFromUnknown(data.calories) ?? 0);
      existing.protein += Math.round(numberFromUnknown(data.protein) ?? 0);
      existing.carbs += Math.round(numberFromUnknown(data.carbs) ?? 0);
      existing.fat += Math.round(numberFromUnknown(data.fat) ?? 0);
      existing.mealCount += 1;
      byDay.set(key, existing);
    }
    return Array.from(byDay.values())
      .filter((d) => d.dayKey !== todayKey)
      .sort((a, b) => b.dayKey.localeCompare(a.dayKey))
      .slice(0, days);
  } catch (err) {
    console.warn('[nora-nutrition-chat] daily totals fetch failed:', err);
    return [];
  }
};

const loadFrequentFoods = async (uid: string, days: number): Promise<string[]> => {
  try {
    const cutoffSec = (Date.now() - days * 24 * 60 * 60 * 1000) / 1000;
    const snap = await db
      .collection('users')
      .doc(uid)
      .collection('mealLogs')
      .where('createdAt', '>=', cutoffSec)
      .limit(500)
      .get();
    const counts = new Map<string, number>();
    for (const doc of snap.docs) {
      const name =
        stringFromUnknown(doc.data().name) || stringFromUnknown(doc.data().foodName);
      if (!name) continue;
      counts.set(name, (counts.get(name) || 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name]) => name);
  } catch (err) {
    console.warn('[nora-nutrition-chat] frequent foods fetch failed:', err);
    return [];
  }
};

const loadHistoricalMealContext = async (
  uid: string,
  todayKey: string,
  timezone: string,
): Promise<HistoricalMealContext> => {
  const [recentDays, frequentFoods] = await Promise.all([
    loadDailyTotals(uid, todayKey, 14, timezone),
    loadFrequentFoods(uid, 30),
  ]);
  return { recentDays, frequentFoods };
};

type LogDayRelation = 'today' | 'yesterday' | 'past' | 'future' | 'unknown';

interface LogDateContext {
  currentLabel: string;
  currentValue: string;
  logLabel: string;
  logValue: string;
  relation: LogDayRelation;
  timezone?: string;
  instruction: string;
}

const parseMacraDayKey = (value?: string): Date | null => {
  if (!value || !/^\d{8}$/.test(value)) return null;
  const month = Number(value.slice(0, 2));
  const day = Number(value.slice(2, 4));
  const year = Number(value.slice(4, 8));
  if (month < 1 || month > 12 || day < 1 || day > 31 || year < 1900) return null;
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const parseDateish = (value?: string): Date | null => {
  if (!value) return null;
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) {
    return new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate()));
  }
  const dateOnly = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!dateOnly) return null;
  const year = Number(dateOnly[1]);
  const month = Number(dateOnly[2]);
  const day = Number(dateOnly[3]);
  const fallback = new Date(Date.UTC(year, month - 1, day));
  return Number.isNaN(fallback.getTime()) ? null : fallback;
};

const dayDiff = (logDate: Date | null, currentDate: Date | null): number | null => {
  if (!logDate || !currentDate) return null;
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((logDate.getTime() - currentDate.getTime()) / msPerDay);
};

const compactDateValue = (...values: Array<string | undefined>): string => {
  return values
    .map((value) => stringFromUnknown(value))
    .filter((value): value is string => Boolean(value))
    .join(' / ');
};

const resolveLogDateContext = (body: RequestBody): LogDateContext => {
  const rawLogLabel = stringFromUnknown(body.threadDateLabel)
    || stringFromUnknown(body.selectedDateLabel)
    || stringFromUnknown(body.logDateLabel);
  const rawLogDate = stringFromUnknown(body.threadDate)
    || stringFromUnknown(body.selectedDate)
    || stringFromUnknown(body.logDate);
  const rawLogKey = stringFromUnknown(body.threadDateKey)
    || stringFromUnknown(body.selectedDateKey)
    || stringFromUnknown(body.logDateKey);
  const rawCurrentDate = stringFromUnknown(body.currentDate) || new Date().toISOString();
  const rawCurrentKey = stringFromUnknown(body.currentDateKey);
  const logLabel = rawLogLabel || rawLogKey || rawLogDate || 'selected log date';
  const currentLabel = rawCurrentKey || rawCurrentDate;
  const logValue = compactDateValue(rawLogKey, rawLogDate) || 'not supplied';
  const currentValue = compactDateValue(rawCurrentKey, rawCurrentDate);
  const labelLower = logLabel.toLowerCase();

  const logDate = parseMacraDayKey(rawLogKey) || parseDateish(rawLogDate);
  const currentDate = parseMacraDayKey(rawCurrentKey) || parseDateish(rawCurrentDate);
  const diff = dayDiff(logDate, currentDate);

  let relation: LogDayRelation = 'unknown';
  if (body.isToday === true || labelLower === 'today') {
    relation = 'today';
  } else if (labelLower === 'yesterday' || diff === -1) {
    relation = 'yesterday';
  } else if (diff !== null && diff < -1) {
    relation = 'past';
  } else if (diff !== null && diff > 0) {
    relation = 'future';
  } else if (body.isToday === false) {
    relation = 'past';
  }

  const instruction = relation === 'today'
    ? 'The selected food log is today. You may discuss remaining meals only when the user asks for same-day planning.'
    : relation === 'yesterday' || relation === 'past'
      ? 'The selected food log is a completed past log. Use past tense, do not call it today, and do not ask how the user will adjust meals for the rest of that day. If giving actions, frame them as next comparable day or going forward.'
      : relation === 'future'
        ? 'The selected food log is a future/planned date. Treat it as planning, not a completed day.'
        : 'The selected food log date is supplied by the app. Do not assume it is today unless explicitly labeled Today.';

  return {
    currentLabel,
    currentValue,
    logLabel,
    logValue,
    relation,
    timezone: stringFromUnknown(body.timezone),
    instruction
  };
};

const directNoraReply = (reply: string): string => {
  return reply
    .trim()
    .replace(
      /^Nora suggests the following observations for your current eating day, especially with your goal of ([^:\n]+):/i,
      "Here's what I'm seeing in this log, especially with your goal of $1:"
    )
    .replace(
      /^Nora suggests the following observations for your current eating day:/i,
      "Here's what I'm seeing in this log:"
    )
    .replace(/^Nora suggests the following observations:/i, "Here's what I'm seeing:")
    .replace(/^Nora suggests that you\b/i, 'I suggest you')
    .replace(/^Nora suggests\b/i, 'I suggest')
    .replace(/^Nora recommends that you\b/i, 'I recommend you')
    .replace(/^Nora recommends\b/i, 'I recommend')
    .replace(/^Nora (notices|sees)\b/i, 'I notice');
};

const loadActiveMealPlan = async (uid: string): Promise<MealPlanContext | null> => {
  try {
    // The iOS client filters by `userId` + `isActive` and orders by `createdAt`
    // ascending, but for Nora context we want the most recently authored
    // plan if multiples exist — sort desc and take 1.
    const snap = await db.collection('meal-plan')
      .where('userId', '==', uid)
      .where('isActive', '==', true)
      .get();
    if (snap.empty) return null;

    const docs: Array<{ id: string; data: Record<string, unknown> }> = snap.docs
      .map((d: any) => ({ id: d.id as string, data: (d.data() || {}) as Record<string, unknown> }))
      .sort((a: { data: Record<string, unknown> }, b: { data: Record<string, unknown> }) => {
        const ac = numberFromUnknown(a.data.createdAt) ?? 0;
        const bc = numberFromUnknown(b.data.createdAt) ?? 0;
        return bc - ac;
      });
    const data = docs[0].data;

    const planName = stringFromUnknown(data.planName);
    const plannedRaw: Array<Record<string, unknown>> = Array.isArray(data.plannedMeals)
      ? (data.plannedMeals as Array<Record<string, unknown>>)
      : [];

    const meals: PlannedMealContext[] = plannedRaw.map((entry) => {
      const subRaw = Array.isArray(entry.meals)
        ? (entry.meals as Array<Record<string, unknown>>)
        : entry.meal && typeof entry.meal === 'object'
          ? [entry.meal as Record<string, unknown>]
          : [];
      const calories = subRaw.reduce((s, m) => s + (numberFromUnknown(m.calories) || 0), 0);
      const protein = subRaw.reduce((s, m) => s + (numberFromUnknown(m.protein) || 0), 0);
      const carbs = subRaw.reduce((s, m) => s + (numberFromUnknown(m.carbs) || 0), 0);
      const fat = subRaw.reduce((s, m) => s + (numberFromUnknown(m.fat) || 0), 0);
      const name = subRaw.length === 0
        ? 'Planned meal'
        : subRaw.map((m) => stringFromUnknown(m.name) || 'Meal').join(' + ');

      // Flatten ingredient detail across all sub-meals into one list so the
      // model sees per-ingredient macros it can suggest swapping/reducing.
      const ingredients: IngredientContext[] = [];
      for (const sub of subRaw) {
        const detailed = Array.isArray(sub.detailedIngredients)
          ? (sub.detailedIngredients as Array<Record<string, unknown>>)
          : [];
        for (const ing of detailed) {
          const ingName = stringFromUnknown(ing.name);
          if (!ingName) continue;
          ingredients.push({
            name: ingName,
            quantity: stringFromUnknown(ing.quantity) || '',
            calories: numberFromUnknown(ing.calories) || 0,
            protein: numberFromUnknown(ing.protein) || 0,
            carbs: numberFromUnknown(ing.carbs) || 0,
            fat: numberFromUnknown(ing.fat) || 0
          });
        }
      }

      return {
        order: numberFromUnknown(entry.order) ?? 0,
        name,
        calories,
        protein,
        carbs,
        fat,
        isCompleted: entry.isCompleted === true,
        notes: stringFromUnknown(entry.notes),
        ingredients: ingredients.length > 0 ? ingredients : undefined
      };
    }).sort((a, b) => a.order - b.order);

    const totalCalories = meals.reduce((s, m) => s + m.calories, 0);
    const totalProtein = meals.reduce((s, m) => s + m.protein, 0);
    const totalCarbs = meals.reduce((s, m) => s + m.carbs, 0);
    const totalFat = meals.reduce((s, m) => s + m.fat, 0);

    return { planName, totalCalories, totalProtein, totalCarbs, totalFat, meals };
  } catch (err) {
    console.warn('[nora-nutrition-chat] Could not load active meal plan:', err);
    return null;
  }
};

const loadUserDocument = async (uid: string): Promise<UserDocContext | null> => {
  try {
    const snap = await db.collection('users').doc(uid).get();
    if (!snap.exists) return null;
    const data = snap.data() || {};

    const email = stringFromUnknown(data.email);
    const registrationEntryPoint = stringFromUnknown(data.registrationEntryPoint);
    const subscriptionType = stringFromUnknown(data.subscriptionType);
    const hasCompletedMacraOnboarding = data.hasCompletedMacraOnboarding === true
      ? true
      : data.hasCompletedMacraOnboarding === false
        ? false
        : undefined;

    const birthdateValue = numberFromUnknown(data.birthdate);
    let ageYears: number | undefined;
    if (birthdateValue && birthdateValue > 0) {
      const millis = birthdateValue > 10_000_000_000 ? birthdateValue : birthdateValue * 1000;
      const birth = new Date(millis);
      if (!Number.isNaN(birth.getTime())) {
        const ageMs = Date.now() - birth.getTime();
        const candidate = Math.floor(ageMs / (365.25 * 24 * 60 * 60 * 1000));
        if (candidate > 0 && candidate < 120) ageYears = candidate;
      }
    }

    // Skip noisy/sensitive/already-handled fields when dumping the rest of
    // the user doc. Keeping a deny-list (vs. allow-list) means new onboarding
    // fields land in Nora's context automatically.
    const skipKeys = new Set<string>([
      'id', 'uid', 'createdAt', 'updatedAt',
      'birthdate',
      'profileImageURL', 'profileImage', 'photoURL', 'photoUrl', 'imageURL', 'imageUrl',
      'fcmToken', 'apnsToken', 'deviceToken', 'pushToken', 'tokens',
      'stripeCustomerId', 'stripeAccountId', 'paymentMethodId',
      'email', 'registrationEntryPoint', 'subscriptionType', 'hasCompletedMacraOnboarding',
      'pulseCheckAthleteContext', 'macra'
    ]);

    const extraFields: Record<string, string | number | boolean> = {};
    for (const [key, value] of Object.entries(data)) {
      if (skipKeys.has(key)) continue;
      if (typeof value === 'string') {
        const trimmed = value.trim();
        if (trimmed.length > 0 && trimmed.length <= 240) {
          extraFields[key] = trimmed;
        }
      } else if (typeof value === 'number' && Number.isFinite(value)) {
        extraFields[key] = value;
      } else if (typeof value === 'boolean') {
        extraFields[key] = value;
      }
    }

    return {
      email,
      registrationEntryPoint,
      subscriptionType,
      hasCompletedMacraOnboarding,
      ageYears,
      extraFields
    };
  } catch (err) {
    console.warn('[nora-nutrition-chat] Could not load user document:', err);
    return null;
  }
};

const loadMacraProfile = async (uid: string): Promise<MacraProfileContext | null> => {
  try {
    const snap = await db.collection('users').doc(uid).collection('macra').doc('profile').get();
    if (!snap.exists) return null;
    const data = snap.data() || {};
    return {
      sex: typeof data.sex === 'string' ? data.sex : undefined,
      birthdate: numberFromUnknown(data.birthdate),
      heightCm: numberFromUnknown(data.heightCm),
      currentWeightKg: numberFromUnknown(data.currentWeightKg),
      goalWeightKg: numberFromUnknown(data.goalWeightKg),
      pace: typeof data.pace === 'string' ? data.pace : undefined,
      activityLevel: typeof data.activityLevel === 'string' ? data.activityLevel : undefined,
      dietaryPreference: typeof data.dietaryPreference === 'string' ? data.dietaryPreference : undefined,
      biggestStruggle: typeof data.biggestStruggle === 'string' ? data.biggestStruggle : undefined,
      goalDirection: typeof data.goalDirection === 'string' ? data.goalDirection : undefined
    };
  } catch (err) {
    console.warn('[nora-nutrition-chat] Could not load Macra profile:', err);
    return null;
  }
};

const loadPulseCheckAthleteContext = async (uid: string): Promise<PulseCheckAthleteContext | null> => {
  try {
    const userRef = db.collection('users').doc(uid);
    const [userSnap, athleteContextSnap, sportConfigSnap] = await Promise.all([
      userRef.get(),
      userRef.collection('pulsecheck').doc('athleteContext').get(),
      db.collection('company-config').doc('pulsecheck-sports').get()
    ]);

    const userData = userSnap.data() || {};
    const nestedContext = athleteContextSnap.exists ? (athleteContextSnap.data() || {}) : {};
    const embeddedContext = userData.pulseCheckAthleteContext && typeof userData.pulseCheckAthleteContext === 'object'
      ? userData.pulseCheckAthleteContext as Record<string, unknown>
      : {};
    const mergedContext = { ...embeddedContext, ...nestedContext };
    const sports = Array.isArray(sportConfigSnap.data()?.sports)
      ? sportConfigSnap.data()?.sports as Array<Record<string, unknown>>
      : [];
    const sportName = stringFromUnknown(mergedContext.sportName) || stringFromUnknown(userData.sport);
    const sportId = stringFromUnknown(mergedContext.sportId);
    const sportConfig = sports.find((sport) => {
      const candidateId = stringFromUnknown(sport.id);
      const candidateName = stringFromUnknown(sport.name);
      return (sportId && candidateId === sportId)
        || (sportName && candidateName?.toLowerCase() === sportName.toLowerCase());
    });

    const promptingSource = mergedContext.prompting && typeof mergedContext.prompting === 'object'
      ? mergedContext.prompting as Record<string, unknown>
      : sportConfig?.prompting && typeof sportConfig.prompting === 'object'
        ? sportConfig.prompting as Record<string, unknown>
        : {};

    return {
      sport: stringFromUnknown(userData.sport),
      position: stringFromUnknown(mergedContext.position) || stringFromUnknown(userData.position),
      seasonPhase: stringFromUnknown(mergedContext.seasonPhase) || stringFromUnknown(userData.seasonPhase),
      primaryMentalChallenge: stringFromUnknown(userData.primaryMentalChallenge),
      primaryPerformanceGoal: stringFromUnknown(userData.primaryPerformanceGoal),
      sportId,
      sportName,
      schemaVersion: numberFromUnknown(mergedContext.schemaVersion),
      attributes: mergedContext.attributes && typeof mergedContext.attributes === 'object'
        ? mergedContext.attributes as Record<string, unknown>
        : {},
      prompting: {
        noraContext: stringFromUnknown(promptingSource.noraContext),
        macraNutritionContext: stringFromUnknown(promptingSource.macraNutritionContext),
        riskFlags: stringListFromUnknown(promptingSource.riskFlags),
        restrictedAdvice: stringListFromUnknown(promptingSource.restrictedAdvice),
        recommendedLanguage: stringListFromUnknown(promptingSource.recommendedLanguage)
      },
      attributeDefinitions: Array.isArray(sportConfig?.attributes)
        ? (sportConfig?.attributes as Array<Record<string, unknown>>).map((attribute) => ({
          key: stringFromUnknown(attribute.key) || '',
          label: stringFromUnknown(attribute.label) || stringFromUnknown(attribute.key) || '',
          includeInMacraContext: attribute.includeInMacraContext === true,
          includeInNoraContext: attribute.includeInNoraContext !== false,
          options: Array.isArray(attribute.options)
            ? (attribute.options as Array<Record<string, unknown>>).map((option) => ({
              label: stringFromUnknown(option.label) || '',
              value: stringFromUnknown(option.value) || ''
            })).filter((option) => option.label && option.value)
            : []
        })).filter((attribute) => attribute.key && attribute.label)
        : []
    };
  } catch (err) {
    console.warn('[nora-nutrition-chat] Could not load PulseCheck athlete context:', err);
    return null;
  }
};

const pounds = (kg: number): number => kg * 2.20462;
const fixed = (value: number, digits = 1): string => Number.isFinite(value) ? value.toFixed(digits) : '?';

const ageFromBirthdate = (birthdate?: number): number | undefined => {
  if (!birthdate || birthdate <= 0) return undefined;
  const millis = birthdate > 10_000_000_000 ? birthdate : birthdate * 1000;
  const birth = new Date(millis);
  if (Number.isNaN(birth.getTime())) return undefined;
  const ageMs = Date.now() - birth.getTime();
  const age = Math.floor(ageMs / (365.25 * 24 * 60 * 60 * 1000));
  return age > 0 && age < 120 ? age : undefined;
};

const buildProfileLine = (profile: MacraProfileContext | null): string => {
  if (!profile) return 'Macra profile: not available.';

  const parts: string[] = [];
  if (profile.sex) parts.push(`sex ${profile.sex}`);
  const age = ageFromBirthdate(profile.birthdate);
  if (age) parts.push(`age ${age}`);
  if (profile.heightCm) parts.push(`height ${Math.round(profile.heightCm)} cm`);
  if (profile.currentWeightKg) {
    parts.push(`current weight ${fixed(pounds(profile.currentWeightKg), 0)} lb / ${fixed(profile.currentWeightKg, 1)} kg`);
  }
  if (profile.goalWeightKg) {
    parts.push(`goal weight ${fixed(pounds(profile.goalWeightKg), 0)} lb / ${fixed(profile.goalWeightKg, 1)} kg`);
  }
  if (profile.goalDirection) parts.push(`goal direction ${profile.goalDirection}`);
  if (profile.pace) parts.push(`pace ${profile.pace}`);
  if (profile.activityLevel) parts.push(`activity ${profile.activityLevel}`);
  if (profile.dietaryPreference && profile.dietaryPreference !== 'none') {
    parts.push(`diet ${profile.dietaryPreference}`);
  }
  if (profile.biggestStruggle) parts.push(`struggle ${profile.biggestStruggle}`);

  return parts.length > 0 ? `Macra profile: ${parts.join(', ')}.` : 'Macra profile: saved but sparse.';
};

const formatAttributeValue = (
  value: unknown,
  definition?: NonNullable<PulseCheckAthleteContext['attributeDefinitions']>[number]
): string => {
  if (Array.isArray(value)) {
    return value
      .map((entry) => formatAttributeValue(entry, definition))
      .filter(Boolean)
      .join(', ');
  }

  if (typeof value === 'boolean') return value ? 'yes' : 'no';
  if (typeof value === 'number') return Number.isInteger(value) ? `${value}` : value.toFixed(1);
  const raw = stringFromUnknown(value);
  if (!raw) return '';
  const optionLabel = definition?.options?.find((option) => option.value === raw)?.label;
  return optionLabel || raw.replace(/_/g, ' ');
};

const buildPulseCheckSportContextLine = (context: PulseCheckAthleteContext | null): string => {
  if (!context) return 'PulseCheck sport context: not available.';

  const parts: string[] = [];
  const sport = context.sportName || context.sport;
  if (sport) parts.push(`sport ${sport}`);
  if (context.position) parts.push(`position/division ${context.position}`);
  if (context.seasonPhase) parts.push(`season phase ${context.seasonPhase}`);
  if (context.primaryPerformanceGoal) parts.push(`performance goal ${context.primaryPerformanceGoal}`);
  if (context.primaryMentalChallenge) parts.push(`mental challenge ${context.primaryMentalChallenge}`);

  const attributeLines = Object.entries(context.attributes || {}).reduce<string[]>((acc, [key, value]) => {
    const definition = context.attributeDefinitions?.find((attribute) => attribute.key === key);
    if (definition && definition.includeInMacraContext === false && definition.includeInNoraContext === false) return acc;
    const formatted = formatAttributeValue(value, definition);
    if (!formatted) return acc;
    acc.push(`${definition?.label || key}: ${formatted}`);
    return acc;
  }, []);

  const policyLines = [
    context.prompting?.noraContext ? `Sport Nora context: ${context.prompting.noraContext}` : '',
    context.prompting?.macraNutritionContext ? `Sport Macra nutrition context: ${context.prompting.macraNutritionContext}` : '',
    context.prompting?.riskFlags?.length ? `Sport risk flags: ${context.prompting.riskFlags.join(', ')}.` : '',
    context.prompting?.restrictedAdvice?.length ? `Sport restricted advice: ${context.prompting.restrictedAdvice.join(' ')}` : '',
    context.prompting?.recommendedLanguage?.length ? `Sport language guidance: ${context.prompting.recommendedLanguage.join(' ')}` : ''
  ].filter(Boolean);

  return [
    parts.length > 0 ? `PulseCheck sport context: ${parts.join(', ')}.` : 'PulseCheck sport context: saved but sparse.',
    attributeLines.length > 0 ? `Sport-specific athlete attributes: ${attributeLines.join('; ')}.` : '',
    ...policyLines
  ].filter(Boolean).join('\n');
};

const buildMacroRatioLine = (
  target: MacroTargetContext | undefined,
  profile: MacraProfileContext | null
): string => {
  const weightKg = profile?.currentWeightKg;
  if (!target || !weightKg || weightKg <= 0) return '';

  const weightLb = pounds(weightKg);
  const ratios: string[] = [];
  if (target.calories) ratios.push(`${fixed(target.calories / weightLb, 1)} kcal/lb`);
  if (target.protein) ratios.push(`${fixed(target.protein / weightLb, 2)}g protein/lb`);
  if (target.carbs) ratios.push(`${fixed(target.carbs / weightLb, 2)}g carbs/lb`);
  if (target.fat) ratios.push(`${fixed(target.fat / weightLb, 2)}g fat/lb`);

  return ratios.length > 0
    ? `Target-to-bodyweight ratios: ${ratios.join(', ')}. Use these to sanity-check whether the user-set target fits their context.`
    : '';
};

const buildIntakeRatioLine = (
  totals: { calories: number; protein: number; carbs: number; fat: number },
  profile: MacraProfileContext | null
): string => {
  const weightKg = profile?.currentWeightKg;
  if (!weightKg || weightKg <= 0 || totals.calories <= 0) return '';

  const weightLb = pounds(weightKg);
  return `Selected log intake-to-bodyweight ratios: ${fixed(totals.calories / weightLb, 1)} kcal/lb, ${fixed(totals.protein / weightLb, 2)}g protein/lb, ${fixed(totals.carbs / weightLb, 2)}g carbs/lb, ${fixed(totals.fat / weightLb, 2)}g fat/lb.`;
};

const containsPhysiquePrepSignal = (body: RequestBody): boolean => {
  const text = [
    body.query,
    body.goal,
    ...(body.history || []).map(msg => msg.content)
  ].filter(Boolean).join(' ').toLowerCase();

  return /\b(men'?s physique|bodybuild(?:er|ing)?|classic physique|bikini|figure|wellness|contest prep|competition|nationals|stage|show day|peak week|post-show|reverse diet|weeks? out|prep)\b/.test(text);
};

const buildMealPlanBlock = (mealPlan: MealPlanContext | null): string => {
  if (!mealPlan) return 'Active meal plan: none on file. Treat day-of guidance as ad-hoc unless the user describes a plan.';
  if (mealPlan.meals.length === 0) {
    const name = mealPlan.planName ? ` "${mealPlan.planName}"` : '';
    return `Active meal plan${name}: exists but has no planned meals. Treat day-of guidance as ad-hoc.`;
  }

  const pendingCount = mealPlan.meals.filter((m) => !m.isCompleted).length;
  const completedCount = mealPlan.meals.length - pendingCount;
  const header = `Active meal plan${mealPlan.planName ? ` "${mealPlan.planName}"` : ''} totals: ${mealPlan.totalCalories} kcal, ${mealPlan.totalProtein}g P, ${mealPlan.totalCarbs}g C, ${mealPlan.totalFat}g F across ${mealPlan.meals.length} planned meal${mealPlan.meals.length === 1 ? '' : 's'} (${pendingCount} pending / ${completedCount} completed).`;

  const renderIngredients = (ings?: IngredientContext[], indent = '   '): string => {
    if (!ings || ings.length === 0) return '';
    return ings.map((ing) => {
      const qty = ing.quantity ? ` (${ing.quantity})` : '';
      return `${indent}- ${ing.name}${qty} — ${ing.calories} kcal, ${ing.protein}P ${ing.carbs}C ${ing.fat}F`;
    }).join('\n');
  };

  const lines = mealPlan.meals.map((m) => {
    const tag = m.isCompleted
      ? '[COMPLETED — ALREADY EATEN — IMMUTABLE]'
      : '[PENDING — ADJUSTABLE]';
    const noteSuffix = m.notes ? ` — note: ${m.notes.slice(0, 160)}` : '';
    const head = `${m.order}. ${tag} ${m.name} — ${m.calories} kcal, ${m.protein}P ${m.carbs}C ${m.fat}F${noteSuffix}`;
    const ingBody = renderIngredients(m.ingredients);
    return ingBody ? `${head}\n${ingBody}` : head;
  }).join('\n');

  return [
    header,
    'Treat the meal plan as the user\'s intended day. PENDING planned meals are the ONLY adjustable surface (along with any net-new food the user is asking about). COMPLETED planned meals and logged meals are immutable history.',
    `Planned meals (in order, with ingredient breakdown when available):\n${lines}`
  ].join('\n');
};

const buildUserDocBlock = (userDoc: UserDocContext | null): string => {
  if (!userDoc) return 'User profile document: not available.';

  const headerParts: string[] = [];
  if (userDoc.ageYears !== undefined) headerParts.push(`age ${userDoc.ageYears}`);
  if (userDoc.registrationEntryPoint) headerParts.push(`came in via ${userDoc.registrationEntryPoint}`);
  if (userDoc.subscriptionType) headerParts.push(`subscription ${userDoc.subscriptionType}`);
  if (userDoc.hasCompletedMacraOnboarding !== undefined) {
    headerParts.push(`Macra onboarding ${userDoc.hasCompletedMacraOnboarding ? 'complete' : 'incomplete'}`);
  }

  const header = headerParts.length > 0
    ? `User profile: ${headerParts.join(', ')}.`
    : 'User profile: minimal top-level fields on record.';

  const extraEntries = Object.entries(userDoc.extraFields);
  if (extraEntries.length === 0) return header;

  // Compact dump of remaining onboarding fields. Order alphabetically so
  // diff'ing adds vs. removes is easy to see in logs.
  const dump = extraEntries
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => {
      if (typeof value === 'boolean') return `${key}: ${value ? 'yes' : 'no'}`;
      return `${key}: ${value}`;
    })
    .join('; ');

  return `${header}\nAdditional onboarding/user fields: ${dump}.`;
};

const buildHistoricalBlock = (history: HistoricalMealContext | null): string => {
  if (!history || (history.recentDays.length === 0 && history.frequentFoods.length === 0)) {
    return 'Historical food log: no logged days in the past 14 days available.';
  }
  const lines: string[] = [];
  if (history.recentDays.length > 0) {
    lines.push(
      `Historical food log — last ${history.recentDays.length} day${
        history.recentDays.length === 1 ? '' : 's'
      } you logged (most recent first; today excluded):`,
    );
    for (const day of history.recentDays) {
      lines.push(
        `  ${day.dayKey}: ${day.calories} kcal, ${day.protein}P ${day.carbs}C ${day.fat}F across ${day.mealCount} meal${
          day.mealCount === 1 ? '' : 's'
        }`,
      );
    }
    lines.push(
      'When discussing trends, reference specific dayKeys from this list. NEVER invent totals not shown here. If the user asks about a day not in this list, say it was unlogged in the available window.',
    );
  }
  if (history.frequentFoods.length > 0) {
    lines.push(
      `Frequent foods (last 30 days, most logged first): ${history.frequentFoods.join(', ')}.`,
    );
    lines.push(
      'Prefer foods from this list when suggesting swaps or additions — they are foods the user actually buys and prepares.',
    );
  }
  return lines.join('\n');
};

const buildContextBlock = (
  body: RequestBody,
  profile: MacraProfileContext | null,
  pulseCheckContext: PulseCheckAthleteContext | null,
  mealPlan: MealPlanContext | null,
  userDoc: UserDocContext | null,
  history: HistoricalMealContext | null
): string => {
  const sumCalories = body.meals.reduce((s, m) => s + (m.calories || 0), 0);
  const sumProtein = body.meals.reduce((s, m) => s + (m.protein || 0), 0);
  const sumCarbs = body.meals.reduce((s, m) => s + (m.carbs || 0), 0);
  const sumFat = body.meals.reduce((s, m) => s + (m.fat || 0), 0);
  const totals = { calories: sumCalories, protein: sumProtein, carbs: sumCarbs, fat: sumFat };
  const logDateContext = resolveLogDateContext(body);

  const targetLine = body.target
    ? `User-set daily target: ${body.target.calories ?? '?'} kcal, ${body.target.protein ?? '?'}g protein, ${body.target.carbs ?? '?'}g carbs, ${body.target.fat ?? '?'}g fat. Treat this as an input to audit, not automatic truth.`
    : `Daily target: not set.`;

  const goalLine = body.goal && body.goal.trim().length > 0
    ? `User goal: ${body.goal.trim().slice(0, 140)}.`
    : '';

  const prepSignalLine = containsPhysiquePrepSignal(body)
    ? 'Physique-competitor signal detected in this thread/query. Apply contest-prep phase logic before macro-target gap logic.'
    : '';

  const renderMealIngredients = (ings: IngredientContext[] | undefined, indent = '   '): string => {
    if (!ings || ings.length === 0) return '';
    return ings.map((ing) => {
      const qty = ing.quantity ? ` (${ing.quantity})` : '';
      return `${indent}- ${ing.name}${qty} — ${ing.calories} kcal, ${ing.protein}P ${ing.carbs}C ${ing.fat}F`;
    }).join('\n');
  };

  const mealsList = body.meals.length === 0
    ? `No meals logged for ${logDateContext.logLabel}.`
    : body.meals.map((m, i) => {
        const head = `${i + 1}. [ALREADY EATEN — IMMUTABLE] ${m.name} — ${m.calories} kcal, ${m.protein}P ${m.carbs}C ${m.fat}F`;
        const ingBody = renderMealIngredients(m.ingredients);
        return ingBody ? `${head}\n${ingBody}` : head;
      }).join('\n');

  const attachedMeals = Array.isArray(body.attachedMeals) ? body.attachedMeals : [];
  const attachedMealsBlock = attachedMeals.length === 0
    ? ''
    : [
        `User attached ${attachedMeals.length} meal${attachedMeals.length === 1 ? '' : 's'} from other days for additional context. These are NOT part of the selected log totals — treat them as reference examples the user wants you to consider:`,
        attachedMeals.map((m, i) => {
          const dateTag = m.loggedOnLabel ? ` (logged ${m.loggedOnLabel})` : '';
          const head = `${i + 1}. ${m.name}${dateTag} — ${m.calories} kcal, ${m.protein}P ${m.carbs}C ${m.fat}F`;
          const ingBody = renderMealIngredients(m.ingredients);
          return ingBody ? `${head}\n${ingBody}` : head;
        }).join('\n')
      ].join('\n');

  // Pre-compute the Day Budget for the model so it doesn't have to derive it.
  // Logged + pending-plan + new-food (if implied by the question) vs target.
  const pendingMacros = (mealPlan?.meals || [])
    .filter((m) => !m.isCompleted)
    .reduce(
      (acc, m) => ({
        calories: acc.calories + m.calories,
        protein: acc.protein + m.protein,
        carbs: acc.carbs + m.carbs,
        fat: acc.fat + m.fat
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    );

  const target = body.target || {};
  const fmtMacro = (consumed: number, pending: number, targetVal?: number): string => {
    if (targetVal === undefined || targetVal === null) {
      return `consumed ${consumed} + pending ${pending} = ${consumed + pending} (no target set)`;
    }
    const projected = consumed + pending;
    const remainingAfterLogged = targetVal - consumed;
    const headroomForNewFood = remainingAfterLogged - pending;
    return `consumed ${consumed} + pending ${pending} = projected ${projected} vs target ${targetVal} (remaining-after-logged ${remainingAfterLogged}, headroom-for-new-food ${headroomForNewFood})`;
  };

  const dayBudgetBlock = [
    '=== DAY BUDGET (pre-computed math — use these numbers directly) ===',
    `Calories: ${fmtMacro(sumCalories, pendingMacros.calories, target.calories ?? undefined)}`,
    `Protein:  ${fmtMacro(sumProtein, pendingMacros.protein, target.protein ?? undefined)}`,
    `Carbs:    ${fmtMacro(sumCarbs, pendingMacros.carbs, target.carbs ?? undefined)}`,
    `Fat:      ${fmtMacro(sumFat, pendingMacros.fat, target.fat ?? undefined)}`,
    'Definitions: "consumed" = sum of [ALREADY EATEN — IMMUTABLE] logged meals. "pending" = sum of [PENDING — ADJUSTABLE] planned meals. "headroom-for-new-food" = how much of that macro the user can add (e.g. brownies, snacks, swaps) WITHOUT reducing any pending meal. If headroom ≥ proposed new food, no plan changes are needed. If headroom is negative, that macro is already overcommitted before any new food.'
  ].join('\n');

  return [
    buildUserDocBlock(userDoc),
    buildProfileLine(profile),
    buildPulseCheckSportContextLine(pulseCheckContext),
    `Current date context: ${logDateContext.currentLabel} (${logDateContext.currentValue})${logDateContext.timezone ? `, timezone ${logDateContext.timezone}` : ''}.`,
    `Selected food log date: ${logDateContext.logLabel} (${logDateContext.logValue}); relation to current date: ${logDateContext.relation}.`,
    `Temporal instruction: ${logDateContext.instruction}`,
    targetLine,
    buildMacroRatioLine(body.target, profile),
    buildIntakeRatioLine(totals, profile),
    goalLine,
    prepSignalLine,
    buildMealPlanBlock(mealPlan),
    `Selected food log (${logDateContext.logLabel}) totals: ${sumCalories} kcal, ${sumProtein}g P, ${sumCarbs}g C, ${sumFat}g F across ${body.meals.length} meal${body.meals.length === 1 ? '' : 's'}.`,
    `Meals logged for ${logDateContext.logLabel} (with ingredient breakdown when available):\n${mealsList}`,
    attachedMealsBlock,
    dayBudgetBlock,
    buildHistoricalBlock(history)
  ].filter(Boolean).join('\n');
};

export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: corsHeaders, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  const uid = await verifyAuth(getHeader(event.headers, 'authorization'));
  if (!uid) {
    return { statusCode: 401, headers: corsHeaders, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  let body: RequestBody;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  if (!body.query || typeof body.query !== 'string' || body.query.trim().length === 0) {
    return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'query required' }) };
  }
  if (!Array.isArray(body.meals)) {
    return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'meals array required' }) };
  }

  const systemPrompt = [
    "You are Nora, Macra's warm but direct performance nutrition coach.",
    "",
    "=== VOICE ===",
    "First-person. Use 'I' and 'you'. Never refer to yourself in third person. Never begin with 'Nora suggests', 'Nora recommends', 'Nora notices', or 'Nora thinks'. Be warm but direct — coach, don't lecture.",
    "",
    "=== WHAT'S IN THE CONTEXT BLOCK (every turn) ===",
    "User receives the same structured Context block each turn. Read it top to bottom before answering:",
    "  - User profile + Macra profile + sport/PulseCheck context",
    "  - Daily macro target",
    "  - Active meal plan: each planned meal tagged [PENDING — ADJUSTABLE] or [COMPLETED — ALREADY EATEN — IMMUTABLE], with per-ingredient macros when available",
    "  - Logged meals for the selected day, all tagged [ALREADY EATEN — IMMUTABLE], with per-ingredient macros when available",
    "  - (Optional) attached reference meals from other days",
    "  - DAY BUDGET section: pre-computed math showing 'consumed + pending = projected vs target' with `remaining-after-logged` and `headroom-for-new-food` for each macro. USE THESE NUMBERS DIRECTLY. Do not recompute them.",
    "",
    "=== ABSOLUTE IMMUTABILITY RULE ===",
    "Any item tagged [ALREADY EATEN — IMMUTABLE] or [COMPLETED — ALREADY EATEN — IMMUTABLE] is physically gone. You CANNOT suggest replacing it, removing it, swapping it, reducing its portion, or substituting a different food for it — at the meal level OR the ingredient level. Treat them as closed journal entries.",
    "Adjustable surface = (a) ingredients inside [PENDING — ADJUSTABLE] planned meals, and (b) any net-new food the user is asking about. Nothing else.",
    "Self-check: before sending, scan your draft. If it proposes touching a logged or completed item — at the meal or ingredient level — REWRITE.",
    "",
    "Forbidden output patterns (these all violate immutability):",
    "  ✗ 'Replace your [logged meal/ingredient] with…'",
    "  ✗ 'Swap the [logged meal/ingredient] for…'",
    "  ✗ 'Reduce your [logged meal/ingredient] portion…'",
    "  ✗ 'Skip the [logged meal/ingredient]…'",
    "  ✗ Any change phrased against an [ALREADY EATEN] or [COMPLETED] item.",
    "",
    "=== REASONING FRAMEWORK — apply to ANY question that involves fitting, swapping, adjusting, predicting, or comparing-to-target ===",
    "",
    "Step 1 — Inventory (do this silently, do not narrate it):",
    "  • LOGGED ingredients: list each [IMMUTABLE] ingredient and its macros (use per-ingredient detail if present, else the meal-level totals).",
    "  • PENDING ingredients: list each [PENDING] ingredient and its macros (use per-ingredient detail if present).",
    "  • NEW FOOD: if the user is asking about adding/eating something new, list its name and macros.",
    "",
    "Step 2 — Use the pre-computed Day Budget:",
    "  The Context block already gives you: consumed (logged), pending (pending plan), projected (consumed + pending), target, remaining-after-logged (= target − consumed), and headroom-for-new-food (= remaining-after-logged − pending). Trust these numbers. They are correct.",
    "",
    "Step 3 — Decide:",
    "  CASE A — 'Can I add X?' / 'Help me fit X':",
    "    Compute new_food vs headroom-for-new-food, per macro.",
    "    • If new_food.calories ≤ headroom AND new_food.protein/carbs/fat each ≤ headroom (allow ±5g rounding): the answer is 'IT FITS, NO PLAN CHANGES NEEDED.' Say so plainly and show the actual headroom numbers proving it. Do NOT invent a swap.",
    "    • If new_food exceeds headroom on ≥1 macro: identify the overflowing macro(s). Compute deficit = (consumed + pending + new_food) − target, per macro. Pick PENDING ingredients high in the overflowing macro and propose a precise gram-level reduction (or swap to a leaner option) on those PENDING ingredients sized to close the deficit — not larger.",
    "    • If headroom is ≥0 but new_food still exceeds it AND there are no pending ingredients adjustable: explicitly say 'nothing on the plan is still adjustable, everything is logged.' Offer (a) eat less / skip new food, (b) accept overage with macro impact, or (c) bank forward.",
    "  CASE B — 'Am I on track?' / 'How am I doing?':",
    "    Compare projected (consumed + pending) to target per macro. Call out what's tracking high/low. If pending ingredients keep things in range, say so. If pending overshoots, name the pending ingredient pushing it over and suggest a small portion shift.",
    "  CASE C — 'What am I missing?' / 'What should I add?':",
    "    Find the macro with the largest gap = target − projected. Recommend a specific ingredient + grams that closes the gap. Cross-reference athlete context for sport-appropriate foods.",
    "  CASE D — 'What should I eat next?':",
    "    Find the next [PENDING] meal in plan order. Restate its planned ingredients verbatim (with quantities). If there's no plan, propose a meal whose macros land inside the remaining-after-logged headroom.",
    "  CASE E — Generic / open-ended question:",
    "    Run the inventory + budget math first, then answer the question with those numbers as ground truth.",
    "",
    "Step 4 — Output:",
    "  Always include, when proposing a change:",
    "    • The specific PENDING ingredient(s) you're modifying, by name (with current quantity if known).",
    "    • The exact gram delta (e.g. 'reduce cream of rice by 30g, taking it to ~10g carbs') OR the swap (e.g. 'swap pending cream of rice for 100g cooked white potato').",
    "    • The resulting day totals after the change, per macro, vs target.",
    "    • One-line confirmation that totals now sit ≤ target.",
    "  When NO change is needed, say so first and back it up with the headroom numbers.",
    "",
    "=== WORKED EXAMPLES ===",
    "",
    "Example A — fits without changes (the most common failure mode to avoid):",
    "  Logged (IMMUTABLE): Elev8 cookies & cream — 120 kcal, 25P 3C 2F.",
    "  Pending: Meal 1 — cream of rice 35g (130 kcal, 2P 28C 0F), egg whites 1 cup (126 kcal, 26P 2C 0F). Pre-Workout — cream of rice 70g (260 kcal, 4P 56C 0F).",
    "  Target: 2400 / 200P / 250C / 60F.",
    "  Day Budget says: calories headroom-for-new-food = 1764, carbs headroom = 161, etc.",
    "  User: 'How should I flex meals to fit two brownies (190 kcal, 2P 32C 6F)?'",
    "  CORRECT response: 'Two brownies fit easily — no swaps needed. Headroom after your logged Elev8 and the rest of your pending plan is 1764 kcal / 161g carbs / 38g fat. Two brownies (190 kcal, 32C, 6F) drop into that with room to spare. Day projects to ~826 kcal — you're nowhere near your 2400 target, so the question is more whether you have enough food planned, not whether brownies fit.'",
    "  WRONG response (this is what we are training away from): 'Reduce your cream of rice by 16g…' — this invents a constraint that doesn't exist. There is plenty of headroom; do not make up adjustments.",
    "",
    "Example B — exceeds headroom, trim by exact deficit:",
    "  Logged (IMMUTABLE): chicken & rice 8oz/200g — 650 kcal, 60P 70C 12F. Protein shake — 200 kcal, 40P 5C 1F.",
    "  Pending: Pre-workout — cream of rice 70g (260 kcal, 4P 56C 0F), egg whites 1 cup (126 kcal, 26P 2C 0F). Dinner — white potato 200g (174 kcal, 4P 40C 0F), cooked chicken 6oz (282 kcal, 54P 0C 6F).",
    "  Target: 2000 / 200P / 200C / 55F.",
    "  Day Budget: carbs headroom-for-new-food = 29 (logged 75 + pending 96 = 171 vs target 200, so 29 left).",
    "  User: 'Help me fit two brownies (190 kcal, 2P 32C 6F).'",
    "  Brownies' 32C exceed 29C headroom by 3g.",
    "  CORRECT response: 'Two brownies put you ~3g over carbs (32g brownie carbs vs 29g headroom). Easiest fix: trim your pending cream of rice by ~4g (taking it to ~66g, ~245 kcal / ~52C). Day lands at ~1957 kcal / 134P / 199C / 19F — under all targets. Protein is still ~66g short of your 200g goal, so consider a leaner protein at dinner or a casein shake later.'",
    "",
    "Example C — fully logged day, no pending plan:",
    "  Logged (IMMUTABLE): full day already, totals 2350 / 196P / 245C / 58F. Target 2400/200/250/60. No pending plan items.",
    "  User: 'Can I have two brownies (190 kcal, 32C, 6F)?'",
    "  CORRECT response: 'You've got 50 kcal of headroom and the brownies are 190 — they'd put you ~140 kcal over and ~27g over on carbs. Nothing left on the plan is adjustable; everything is already logged. Three options: have one brownie (~95 kcal, ~16C, ~5g over), have both and accept the overage (mostly carbs/fat — won't blow up a single day), or save them and bake the room into tomorrow. None of your earlier meals are getting swapped.'",
    "",
    "=== TARGET / PHASE RULES ===",
    "User-set macro targets are inputs to audit, not automatic truth. If a target conflicts with body size, timeline, division, conditioning, or stated goal, flag it clearly and coach from context.",
    "Being under target is not automatically a problem; assess whether the target fits the athlete and phase first.",
    "If the user appears to be a physique competitor, classify the phase: contest prep, peak week, post-show reverse, off-season, unknown.",
    "Within 8 weeks of a show, prioritize stage readiness, digestion consistency, visual predictability, and adherence. In that near-show context, do not casually recommend fruit, whole grains, high-variance foods, or generic starchy vegetables — favor predictable prep foods (rice, cream of rice, measured white/russet potatoes, lean proteins).",
    "Call out risks (flatness, spillover, rebound, digestion changes, target mismatch). Default to small adjustments (25–50g carbs max) unless the user asks for a full plan.",
    "If sport-specific PulseCheck context or prompting policy is supplied, apply it BEFORE macro-target gap logic.",
    "",
    "=== DATE / TEMPORAL RULES ===",
    "Honor the selected food log date exactly. Past dates → past tense. Never call a past day 'today'.",
    "For completed past logs, never ask how the user will adjust the rest of that day. Frame guidance as 'next comparable day' or 'going forward'.",
    "",
    "=== FORMAT ===",
    "Plain text, no markdown headers. Short paragraphs and bullet points are fine.",
    "Cap responses at ~220 words.",
    "Numbers are required: every adjustment must include an exact gram/kcal delta AND the resulting macro total. 'Increase carbs' alone is forbidden — say '+25g carbs from cream of rice → 175g carbs total'.",
    "If no change is needed, state that explicitly with the headroom numbers proving it.",
    "Don't end with generic 'let me know if you have other questions'. Ask ONE focused follow-up only when an answer would materially change.",
    "",
    "=== HISTORICAL CONTEXT ===",
    "The context block includes a 'Historical food log' section with per-day macro totals for the last 14 logged days, plus a 'Frequent foods' list from the last 30 days.",
    "When the user asks about trends ('how have I been eating', 'over the last few days', 'this week'), reason from the Historical food log block. Reference specific dayKeys (e.g. '2025-04-26: 1980 kcal, 280P 130C 50F') to ground claims.",
    "NEVER invent totals not present in the Historical block. If asked about a date not in the list, say it was unlogged in the available window — never guess.",
    "If the Historical block reports 'no logged days available', acknowledge the gap and frame guidance off today's log + targets only. Do not pretend to see history.",
    "When suggesting swaps or additions, prefer foods from the 'Frequent foods' list — the user actually buys and prepares them."
  ].join('\n');

  const userTimezone = stringFromUnknown(body.timezone) || 'America/New_York';
  const todayKey = tzDayKey(new Date(), userTimezone);

  const [profile, pulseCheckContext, mealPlan, userDoc, historical] = await Promise.all([
    loadMacraProfile(uid),
    loadPulseCheckAthleteContext(uid),
    loadActiveMealPlan(uid),
    loadUserDocument(uid),
    loadHistoricalMealContext(uid, todayKey, userTimezone)
  ]);
  const contextBlock = buildContextBlock(body, profile, pulseCheckContext, mealPlan, userDoc, historical);

  const messages: ChatMessage[] = [];
  messages.push({ role: 'user', content: `Context:\n${contextBlock}` } as any);

  const historyTail = Array.isArray(body.history) ? body.history.slice(-6) : [];
  for (const msg of historyTail) {
    if ((msg.role === 'user' || msg.role === 'assistant') && typeof msg.content === 'string') {
      messages.push({ role: msg.role, content: msg.content.slice(0, 800) });
    }
  }

  messages.push({ role: 'user', content: body.query.trim().slice(0, 800) });

  // Phase B+ full cutover: Anthropic Sonnet 4.6 plain-text reply.
  // TODO(prompt-cache): systemPrompt is per-user-dynamic (built from profile +
  // PulseCheck context + meal plan + user doc), so it doesn't share across
  // calls. Caching only helps if we extract the static voice/rules section.
  try {
    const client = new Anthropic();
    const response = await client.messages.create({
      model: NORA_NUTRITION_CHAT.model,
      max_tokens: NORA_NUTRITION_CHAT.maxTokens,
      system: systemPrompt,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    });

    const rawReply = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('')
      .trim();
    const reply = rawReply ? directNoraReply(rawReply) : '';
    if (!reply) throw new Error('Nora returned no content');

    return {
      statusCode: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reply,
        generatedAt: Date.now(),
        providerUsed: 'anthropic',
        modelUsed: NORA_NUTRITION_CHAT.model,
      })
    };
  } catch (err: any) {
    console.error('[nora-nutrition-chat] Chat failed:', err);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: err?.message || 'Chat failed' })
    };
  }
};
