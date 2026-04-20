import { Handler } from '@netlify/functions';
import { admin, db, headers as corsHeaders } from './config/firebase';

interface MealItem {
  name: string;
  quantity: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

interface Meal {
  title: string;
  items: MealItem[];
}

interface GeneratedPlan {
  meals: Meal[];
  notes?: string;
}

interface RequestBody {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  goal?: string;
  dietaryPreference?: string;
  mealsPerDay?: number;
  forceRegenerate?: boolean;
  extraContext?: string;
  imageUrls?: string[];
}

const MACRA_PLAN_COLLECTION = 'macraSuggestedMealPlans';
const MACRO_TOLERANCE = 0.05;

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
    console.error('[generate-macra-meal-plan] Auth verification failed:', err);
    return null;
  }
};

const resolveBridgeBaseUrl = (event: { headers?: Record<string, string | undefined> }): string => {
  const host = getHeader(event.headers, 'host') || process.env.URL || 'https://fitwithpulse.ai';
  if (host.startsWith('http://') || host.startsWith('https://')) return host;
  return `https://${host}`;
};

const macrosMatch = (a: { calories: number; protein: number; carbs: number; fat: number },
                     b: { calories: number; protein: number; carbs: number; fat: number }): boolean => {
  const within = (x: number, y: number) => {
    if (y === 0) return x === 0;
    return Math.abs(x - y) / y <= MACRO_TOLERANCE;
  };
  return within(a.calories, b.calories) && within(a.protein, b.protein)
      && within(a.carbs, b.carbs) && within(a.fat, b.fat);
};

const buildPrompt = (req: RequestBody, mealsCount: number): string => {
  const goalLine = req.goal ? `The user's goal is: ${req.goal}.` : '';
  const dietLine = req.dietaryPreference && req.dietaryPreference.toLowerCase() !== 'none'
    ? `They follow a ${req.dietaryPreference} diet — respect it strictly.`
    : '';
  const extraLine = req.extraContext && req.extraContext.trim().length > 0
    ? `Additional context from the user for you to weigh: """${req.extraContext.trim().slice(0, 1200)}"""`
    : '';
  const imageHintLine = (req.imageUrls && req.imageUrls.length > 0)
    ? `The user also attached ${req.imageUrls.length} image(s). Use them as context — e.g. food they have on hand, their fridge, prior meals, a restaurant menu, their physique for context on goals, etc.`
    : '';
  return [
    `Build a simple one-day meal plan with exactly ${mealsCount} meals.`,
    `Label meals "Meal 1", "Meal 2", "Meal 3", etc. Do NOT use breakfast / lunch / dinner / snack labels.`,
    `Daily totals must sum close to: ${req.calories} kcal, ${req.protein}g protein, ${req.carbs}g carbs, ${req.fat}g fat. Within ~5% is acceptable.`,
    goalLine,
    dietLine,
    extraLine,
    imageHintLine,
    `Each meal should list 2-4 food items. For each item provide: name, quantity (e.g. "4 oz", "1 cup", "2 large"), calories (integer), protein (integer g), carbs (integer g), fat (integer g).`,
    `Keep foods common and approachable — things people can buy at a normal grocery store and prepare in under 15 minutes.`,
    `Respond with JSON only, matching this schema exactly:`,
    `{"meals":[{"title":"Meal 1","items":[{"name":"...","quantity":"...","calories":0,"protein":0,"carbs":0,"fat":0}]}],"notes":"optional short coaching note under 200 chars"}`
  ].filter(Boolean).join(' ');
};

const callBridge = async (prompt: string, bridgeBase: string, userToken: string): Promise<GeneratedPlan> => {
  const response = await fetch(`${bridgeBase}/api/openai/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${userToken}`,
      'openai-organization': 'macraMealPlan'
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'You are a registered dietitian creating simple daily meal plans. Return valid JSON only, no prose.' },
        { role: 'user', content: prompt }
      ],
      max_tokens: 1500,
      temperature: 0.7
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`AI bridge ${response.status}: ${errText.slice(0, 500)}`);
  }

  const payload = await response.json() as any;
  const raw = payload?.choices?.[0]?.message?.content;
  if (!raw) throw new Error('Bridge returned no content');

  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed?.meals)) throw new Error('Model response missing meals array');
  return parsed as GeneratedPlan;
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

  if (!Number.isFinite(body.calories) || body.calories <= 0) {
    return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'calories required' }) };
  }
  if (!Number.isFinite(body.protein) || !Number.isFinite(body.carbs) || !Number.isFinite(body.fat)) {
    return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'protein, carbs, fat required' }) };
  }

  const mealsCount = Math.min(Math.max(body.mealsPerDay || 4, 2), 6);
  const docRef = db.collection('users').doc(uid).collection(MACRA_PLAN_COLLECTION).doc('current');

  if (!body.forceRegenerate) {
    try {
      const snap = await docRef.get();
      if (snap.exists) {
        const cached = snap.data() as any;
        if (cached?.inputMacros && macrosMatch(cached.inputMacros, body)
            && cached?.goal === (body.goal || '')
            && cached?.dietaryPreference === (body.dietaryPreference || '')
            && cached?.plan) {
          return {
            statusCode: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            body: JSON.stringify({ plan: cached.plan, cached: true, generatedAt: cached.generatedAt ?? null })
          };
        }
      }
    } catch (err) {
      console.warn('[generate-macra-meal-plan] Cache lookup failed, regenerating:', err);
    }
  }

  const bridgeBase = resolveBridgeBaseUrl(event);
  const userToken = (getHeader(event.headers, 'authorization') || '').split('Bearer ')[1];
  if (!userToken) {
    return { statusCode: 401, headers: corsHeaders, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  try {
    const prompt = buildPrompt(body, mealsCount);
    const plan = await callBridge(prompt, bridgeBase, userToken);

    const normalized: GeneratedPlan = {
      meals: plan.meals.map((m, i) => ({
        title: m.title && m.title.trim() ? m.title : `Meal ${i + 1}`,
        items: Array.isArray(m.items) ? m.items.map(item => ({
          name: String(item.name || '').trim(),
          quantity: String(item.quantity || '').trim(),
          calories: Math.max(0, Math.round(Number(item.calories) || 0)),
          protein: Math.max(0, Math.round(Number(item.protein) || 0)),
          carbs: Math.max(0, Math.round(Number(item.carbs) || 0)),
          fat: Math.max(0, Math.round(Number(item.fat) || 0))
        })) : []
      })),
      notes: typeof plan.notes === 'string' ? plan.notes.slice(0, 240) : undefined
    };

    const generatedAt = Date.now();

    // Archive the current plan into the history subcollection before overwriting,
    // so users can revisit/reapply a previous Nora-generated plan from the UI.
    try {
      const currentSnap = await docRef.get();
      if (currentSnap.exists) {
        const current = currentSnap.data();
        if (current && current.plan) {
          const historyId = String(current.generatedAt ?? Date.now());
          await db.collection('users').doc(uid)
            .collection(MACRA_PLAN_COLLECTION)
            .doc('history').collection('items')
            .doc(historyId)
            .set({
              ...current,
              archivedAt: generatedAt,
              source: 'nora'
            }, { merge: false });
        }
      }
    } catch (err) {
      console.warn('[generate-macra-meal-plan] Failed to archive previous plan:', err);
    }

    await docRef.set({
      userId: uid,
      plan: normalized,
      inputMacros: {
        calories: body.calories,
        protein: body.protein,
        carbs: body.carbs,
        fat: body.fat
      },
      goal: body.goal || '',
      dietaryPreference: body.dietaryPreference || '',
      mealsPerDay: mealsCount,
      generatedAt,
      extraContext: body.extraContext || null,
      imageUrls: body.imageUrls || []
    }, { merge: false });

    return {
      statusCode: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan: normalized, cached: false, generatedAt })
    };
  } catch (err: any) {
    console.error('[generate-macra-meal-plan] Generation failed:', err);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: err?.message || 'Generation failed' })
    };
  }
};
