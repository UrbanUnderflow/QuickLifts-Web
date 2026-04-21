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

interface RequestBody {
  query: string;
  meals: MealContext[];
  target?: MacroTargetContext;
  history?: ChatMessage[];
  goal?: string;
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
  return `Current logged intake-to-bodyweight ratios: ${fixed(totals.calories / weightLb, 1)} kcal/lb, ${fixed(totals.protein / weightLb, 2)}g protein/lb, ${fixed(totals.carbs / weightLb, 2)}g carbs/lb, ${fixed(totals.fat / weightLb, 2)}g fat/lb.`;
};

const containsPhysiquePrepSignal = (body: RequestBody): boolean => {
  const text = [
    body.query,
    body.goal,
    ...(body.history || []).map(msg => msg.content)
  ].filter(Boolean).join(' ').toLowerCase();

  return /\b(men'?s physique|bodybuild(?:er|ing)?|classic physique|bikini|figure|wellness|contest prep|competition|nationals|stage|show day|peak week|post-show|reverse diet|weeks? out|prep)\b/.test(text);
};

const buildContextBlock = (body: RequestBody, profile: MacraProfileContext | null): string => {
  const sumCalories = body.meals.reduce((s, m) => s + (m.calories || 0), 0);
  const sumProtein = body.meals.reduce((s, m) => s + (m.protein || 0), 0);
  const sumCarbs = body.meals.reduce((s, m) => s + (m.carbs || 0), 0);
  const sumFat = body.meals.reduce((s, m) => s + (m.fat || 0), 0);
  const totals = { calories: sumCalories, protein: sumProtein, carbs: sumCarbs, fat: sumFat };

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
    ? 'No meals logged yet today.'
    : body.meals.map((m, i) => `${i + 1}. ${m.name} — ${m.calories} kcal, ${m.protein}P ${m.carbs}C ${m.fat}F`).join('\n');

  return [
    buildProfileLine(profile),
    targetLine,
    buildMacroRatioLine(body.target, profile),
    buildIntakeRatioLine(totals, profile),
    goalLine,
    prepSignalLine,
    `Today so far: ${sumCalories} kcal, ${sumProtein}g P, ${sumCarbs}g C, ${sumFat}g F across ${body.meals.length} meal${body.meals.length === 1 ? '' : 's'}.`,
    `Meals logged:\n${mealsList}`
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
    "User-set macro targets are inputs to audit, not truth. If a target conflicts with body size, timeline, division, conditioning, or stated goal, flag it clearly and coach from context.",
    "If the user appears to be a physique competitor, classify the phase first: contest prep, peak week, post-show reverse, off-season, or unknown.",
    "For physique competitors within 8 weeks of a show, prioritize competition readiness, digestion consistency, visual predictability, and adherence over general health advice.",
    "In that near-show context, do not casually recommend fruit, whole grains, high-variance foods, or generic starchy vegetables. Favor predictable sources already common in prep such as rice, cream of rice, potatoes, oats only if already tolerated, and lean proteins.",
    "Call out relevant risks such as flatness, spillover, rebound, digestion changes, and target mismatch. Recommend small controlled adjustments only, usually 25-50g carbs max, unless the user asks for a full plan.",
    "For non-competitor users, give balanced sports-nutrition advice while still sanity-checking targets against the profile.",
    "Keep responses under 220 words. Plain text. No markdown headers. Bullet points allowed.",
    "If critical context is missing, ask for one specific detail instead of pretending certainty."
  ].join(' ');

  const profile = await loadMacraProfile(uid);
  const contextBlock = buildContextBlock(body, profile);

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
        temperature: 0.7
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
