import { Handler } from '@netlify/functions';
import { admin, db, headers as corsHeaders } from './config/firebase';

interface MealContext {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
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

const resolveBridgeBaseUrl = (event: { headers?: Record<string, string | undefined> }): string => {
  const host = getHeader(event.headers, 'host') || process.env.URL || 'https://fitwithpulse.ai';
  if (host.startsWith('http://') || host.startsWith('https://')) return host;
  return `https://${host}`;
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

      return {
        order: numberFromUnknown(entry.order) ?? 0,
        name,
        calories,
        protein,
        carbs,
        fat,
        isCompleted: entry.isCompleted === true,
        notes: stringFromUnknown(entry.notes)
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
  const lines = mealPlan.meals.map((m) => {
    const tag = m.isCompleted
      ? '[COMPLETED — ALREADY EATEN — IMMUTABLE]'
      : '[PENDING — ADJUSTABLE: this is a meal you may suggest swapping/reducing/removing]';
    const noteSuffix = m.notes ? ` — note: ${m.notes.slice(0, 160)}` : '';
    return `${m.order}. ${tag} ${m.name} — ${m.calories} kcal, ${m.protein}P ${m.carbs}C ${m.fat}F${noteSuffix}`;
  }).join('\n');

  return [
    header,
    'Treat the meal plan as the user\'s intended day. When the user asks "how should I adjust my plan to fit X", reason ONLY from PENDING planned meals (and the new food itself). NEVER suggest changes to COMPLETED or already-logged meals.',
    `Planned meals (in order):\n${lines}`
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

const buildContextBlock = (
  body: RequestBody,
  profile: MacraProfileContext | null,
  pulseCheckContext: PulseCheckAthleteContext | null,
  mealPlan: MealPlanContext | null,
  userDoc: UserDocContext | null
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

  const mealsList = body.meals.length === 0
    ? `No meals logged for ${logDateContext.logLabel}.`
    : body.meals.map((m, i) => `${i + 1}. [ALREADY EATEN — IMMUTABLE] ${m.name} — ${m.calories} kcal, ${m.protein}P ${m.carbs}C ${m.fat}F`).join('\n');

  const attachedMeals = Array.isArray(body.attachedMeals) ? body.attachedMeals : [];
  const attachedMealsBlock = attachedMeals.length === 0
    ? ''
    : [
        `User attached ${attachedMeals.length} meal${attachedMeals.length === 1 ? '' : 's'} from other days for additional context. These are NOT part of the selected log totals — treat them as reference examples the user wants you to consider:`,
        attachedMeals.map((m, i) => {
          const dateTag = m.loggedOnLabel ? ` (logged ${m.loggedOnLabel})` : '';
          return `${i + 1}. ${m.name}${dateTag} — ${m.calories} kcal, ${m.protein}P ${m.carbs}C ${m.fat}F`;
        }).join('\n')
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
    `Meals logged for ${logDateContext.logLabel}:\n${mealsList}`,
    attachedMealsBlock
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

  const bridgeBase = resolveBridgeBaseUrl(event);
  const userToken = (getHeader(event.headers, 'authorization') || '').split('Bearer ')[1];
  if (!userToken) {
    return { statusCode: 401, headers: corsHeaders, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  const systemPrompt = [
    "You are Nora, Macra's warm but direct performance nutrition coach.",
    "Speak directly as Nora in first person. Use 'I' and 'you'; never refer to yourself in third person or begin with phrases like 'Nora suggests', 'Nora recommends', or 'Nora notices'.",
    "",
    "=== ABSOLUTE HARD RULE — LOGGED & COMPLETED MEALS CANNOT BE CHANGED ===",
    "Any meal tagged [ALREADY EATEN — IMMUTABLE] or [COMPLETED — ALREADY EATEN — IMMUTABLE] in the Context block has been physically consumed. It is in the past. There is no way to undo, swap, replace, remove, reduce the portion of, or substitute it. Treat it like a closed entry in a journal.",
    "ONLY meals tagged [PENDING — ADJUSTABLE] and the net-new food the user is asking about can be modified.",
    "If you draft a response that suggests changing an immutable meal, STOP and rewrite it before sending. Do not output text that proposes editing a logged or completed meal under any circumstance.",
    "",
    "FORBIDDEN OUTPUTS (never produce text like these — they suggest modifying immutable meals):",
    "  ✗ \"Replace your [logged meal] with chicken breast…\"",
    "  ✗ \"Swap the [logged meal] for…\"",
    "  ✗ \"Reduce your [logged meal] portion…\"",
    "  ✗ \"Skip the [logged meal] and have…\"  (when the meal is tagged immutable)",
    "  ✗ \"Replace the cookies and cream with…\"  (if cookies and cream is tagged immutable)",
    "",
    "CORRECT BEHAVIOR when the user asks how to fit a new food:",
    "  1. Identify [PENDING — ADJUSTABLE] meals — those are your adjustment surface.",
    "  2. Propose specific swaps/portion changes on PENDING meals to make room.",
    "  3. If there are NO pending meals (everything is already logged or completed), say so explicitly: 'Everything you've eaten today is already locked in — I can't unwind it. Looking at your remaining options for fitting [new food]: …' Then offer (a) eat less of / skip the new food, (b) accept the overage with a clear impact note, or (c) bank it forward to tomorrow's target.",
    "",
    "Sample correct response when user wants to add brownies and only has logged (immutable) meals plus a pending cream of rice:",
    "  \"Your Elev8 cookies & cream and the first brownie are already in the bank — I can't undo those. To fit a second brownie (~95 kcal, 16g carbs), I'd shrink your pending cream of rice by ~30g (drops it to ~10g carbs) so your day lands at 405 kcal / 51g carbs / 11g fat — under your 131g carb target.\"",
    "",
    "Sample correct response when EVERY meal on the day is immutable and there are no pending planned meals:",
    "  \"Everything you've logged is already eaten and you don't have any pending meals on the plan today. I can't move anything that's done. Two brownies would put you at 405 kcal / 51g carbs — still well under your 131g carb target, so it's safe to have them. If you want to leave more headroom, eat one instead of two. Either way, none of your earlier meals are getting swapped.\"",
    "",
    "=== Reasoning order ===",
    "Athlete context → phase → goal/division → risk → macro feedback.",
    "Always read the full Context block before answering. The user profile (onboarding fields), Macra profile, sport context, active meal plan, daily target, and the selected day's logged meals are ALL available — use whichever are load-bearing.",
    "Do not assume allowable intake = logged so far + new item. The plan is the intended day; logged so far is partial progress.",
    "",
    "=== Date / temporal rules ===",
    "Honor the selected food log date exactly. If the context says Yesterday or another past date, discuss that log in past tense and never call it today.",
    "For completed past logs, never ask how the user will adjust meals for the rest of that day. Give next comparable day or going-forward guidance instead.",
    "",
    "=== Sport / phase rules ===",
    "If sport-specific PulseCheck context or prompting policy is supplied, use it as product-owned context before macro target comparison.",
    "User-set macro targets are inputs to audit, not truth. If a target conflicts with body size, timeline, division, conditioning, or stated goal, flag it clearly and coach from context.",
    "Being under a user-set target is not automatically a problem; assess whether the target itself fits the athlete and phase before suggesting changes.",
    "If the user appears to be a physique competitor, classify the phase first: contest prep, peak week, post-show reverse, off-season, or unknown.",
    "For physique competitors within 8 weeks of a show, prioritize competition readiness, digestion consistency, visual predictability, and adherence over general health advice.",
    "In that near-show context, do not casually recommend fruit, whole grains, high-variance foods, generic starchy vegetables, or new food variables. Favor predictable sources already common in prep such as rice, cream of rice, measured white/russet potatoes if tolerated, and lean proteins.",
    "Call out relevant risks such as flatness, spillover, rebound, digestion changes, and target mismatch. Recommend small controlled adjustments only, usually 25-50g carbs max, unless the user asks for a full plan.",
    "",
    "=== Numbers & formatting ===",
    "Mandatory numbers rule: if you recommend adding, reducing, increasing, decreasing, bumping, pulling, or adjusting calories/macros, include an exact gram or calorie amount and the resulting target or range. Vague advice like 'increase carbs' is not allowed.",
    "When recommending a carb adjustment, say the exact delta and source, for example '+25g carbs from rice or cream of rice' or 'hold carbs at 160-175g'. If no change is needed, say no change.",
    "For non-competitor users, give balanced sports-nutrition advice while still sanity-checking targets against the profile.",
    "Keep responses under 220 words. Plain text. No markdown headers. Bullet points allowed.",
    "Do not end with generic follow-up questions. Ask one specific question only when critical context is missing and the answer would materially change the recommendation."
  ].join('\n');

  const [profile, pulseCheckContext, mealPlan, userDoc] = await Promise.all([
    loadMacraProfile(uid),
    loadPulseCheckAthleteContext(uid),
    loadActiveMealPlan(uid),
    loadUserDocument(uid)
  ]);
  const contextBlock = buildContextBlock(body, profile, pulseCheckContext, mealPlan, userDoc);

  const messages: ChatMessage[] = [];
  messages.push({ role: 'user', content: `Context:\n${contextBlock}` } as any);

  const historyTail = Array.isArray(body.history) ? body.history.slice(-6) : [];
  for (const msg of historyTail) {
    if ((msg.role === 'user' || msg.role === 'assistant') && typeof msg.content === 'string') {
      messages.push({ role: msg.role, content: msg.content.slice(0, 800) });
    }
  }

  messages.push({ role: 'user', content: body.query.trim().slice(0, 800) });

  try {
    const response = await fetch(`${bridgeBase}/api/openai/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${userToken}`,
        'openai-organization': 'noraNutritionChat'
      },
      body: JSON.stringify({
        // gpt-4o (full) for nutrition reasoning — mini was making logical
        // errors like suggesting users "swap" already-logged meals.
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages
        ],
        max_tokens: 500,
        temperature: 0.35
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`AI bridge ${response.status}: ${errText.slice(0, 500)}`);
    }

    const payload = await response.json() as any;
    const rawReply = payload?.choices?.[0]?.message?.content?.trim();
    const reply = rawReply ? directNoraReply(rawReply) : '';
    if (!reply) throw new Error('Nora returned no content');

    return {
      statusCode: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ reply, generatedAt: Date.now() })
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
