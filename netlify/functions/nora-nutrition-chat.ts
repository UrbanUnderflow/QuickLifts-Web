import { Handler } from '@netlify/functions';
import { admin, db, headers as corsHeaders } from './config/firebase';

interface MealContext {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
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

const buildContextBlock = (
  body: RequestBody,
  profile: MacraProfileContext | null,
  pulseCheckContext: PulseCheckAthleteContext | null
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
    : body.meals.map((m, i) => `${i + 1}. ${m.name} — ${m.calories} kcal, ${m.protein}P ${m.carbs}C ${m.fat}F`).join('\n');

  return [
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
    `Selected food log (${logDateContext.logLabel}) totals: ${sumCalories} kcal, ${sumProtein}g P, ${sumCarbs}g C, ${sumFat}g F across ${body.meals.length} meal${body.meals.length === 1 ? '' : 's'}.`,
    `Meals logged for ${logDateContext.logLabel}:\n${mealsList}`
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
    "Reason in this order: athlete context, phase, goal/division, risk, then macro feedback.",
    "Honor the selected food log date exactly. If the context says Yesterday or another past date, discuss that log in past tense and never call it today.",
    "For completed past logs, never ask how the user will adjust meals for the rest of that day. Give next comparable day or going-forward guidance instead.",
    "If sport-specific PulseCheck context or prompting policy is supplied, use it as product-owned context before macro target comparison.",
    "User-set macro targets are inputs to audit, not truth. If a target conflicts with body size, timeline, division, conditioning, or stated goal, flag it clearly and coach from context.",
    "Being under a user-set target is not automatically a problem; assess whether the target itself fits the athlete and phase before suggesting changes.",
    "If the user appears to be a physique competitor, classify the phase first: contest prep, peak week, post-show reverse, off-season, or unknown.",
    "For physique competitors within 8 weeks of a show, prioritize competition readiness, digestion consistency, visual predictability, and adherence over general health advice.",
    "In that near-show context, do not casually recommend fruit, whole grains, high-variance foods, generic starchy vegetables, or new food variables. Favor predictable sources already common in prep such as rice, cream of rice, measured white/russet potatoes if tolerated, and lean proteins.",
    "Call out relevant risks such as flatness, spillover, rebound, digestion changes, and target mismatch. Recommend small controlled adjustments only, usually 25-50g carbs max, unless the user asks for a full plan.",
    "Mandatory numbers rule: if you recommend adding, reducing, increasing, decreasing, bumping, pulling, or adjusting calories/macros, include an exact gram or calorie amount and the resulting target or range. Vague advice like 'increase carbs' is not allowed.",
    "When recommending a carb adjustment, say the exact delta and source, for example '+25g carbs from rice or cream of rice' or 'hold carbs at 160-175g'. If no change is needed, say no change.",
    "For non-competitor users, give balanced sports-nutrition advice while still sanity-checking targets against the profile.",
    "Keep responses under 220 words. Plain text. No markdown headers. Bullet points allowed.",
    "Do not end with generic follow-up questions. Ask one specific question only when critical context is missing and the answer would materially change the recommendation."
  ].join(' ');

  const [profile, pulseCheckContext] = await Promise.all([
    loadMacraProfile(uid),
    loadPulseCheckAthleteContext(uid)
  ]);
  const contextBlock = buildContextBlock(body, profile, pulseCheckContext);

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
        model: 'gpt-4o-mini',
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
    const reply = payload?.choices?.[0]?.message?.content?.trim();
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
