import { Handler } from '@netlify/functions';
import Anthropic from '@anthropic-ai/sdk';
import { admin, db, headers as corsHeaders } from './config/firebase';
import { MACRA_MEAL_PLAN } from '../../src/api/anthropic/featureRouting';

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
    `Daily totals must sum close to: ${req.calories} kcal, ${req.protein}g protein, ${req.carbs}g carbs, ${req.fat}g fat. Within ~5% is acceptable, but treat user-set macros as context to satisfy, not proof that the plan is appropriate for every goal.`,
    goalLine,
    dietLine,
    extraLine,
    imageHintLine,
    `If the user context implies physique competition prep, men's physique, bodybuilding, peak week, post-show reverse, or being within 8 weeks of a show, use prep-coach logic: predictable foods, repeatable digestion, small changes, and no casual additions of fruit, whole grains, high-variance foods, or generic starchy vegetables unless explicitly requested or already part of their plan.`,
    `For near-show physique athletes, prefer controlled carb sources such as rice, cream of rice, potatoes, or already-tolerated oats, paired with lean proteins and measured fats.`,
    `Each meal should list 2-4 food items. For each item provide: name, quantity (e.g. "4 oz", "1 cup", "2 large"), calories (integer), protein (integer g), carbs (integer g), fat (integer g).`,
    `Keep foods common and approachable — things people can buy at a normal grocery store and prepare in under 15 minutes.`,
    `Respond with JSON only, matching this schema exactly:`,
    `{"meals":[{"title":"Meal 1","items":[{"name":"...","quantity":"...","calories":0,"protein":0,"carbs":0,"fat":0}]}],"notes":"optional short coaching note under 200 chars"}`
  ].filter(Boolean).join(' ');
};

// Phase B+ Macra full-cutover: Anthropic Sonnet 4.6 with forced tool-use for JSON output.
//
// JSON OUTPUT PATTERN — read this if you're migrating another OpenAI endpoint
// that used `response_format: { type: 'json_object' }`:
//
// Anthropic's Messages API has no JSON-mode flag. The production-grade pattern
// is to declare a single tool whose `input_schema` IS the JSON shape you want,
// then force the model to call it with `tool_choice: { type: 'tool', name: ... }`.
// The model's response will contain a `tool_use` block whose `.input` field is
// the parsed JSON object. This is more reliable than prefilled-`{` tricks.
//
// TODO(prompt-cache): system prompt is ~70 tokens — below Sonnet 4.6's 2048-token
// minimum cacheable prefix. Add `cache_control: {type: 'ephemeral'}` if/when the
// system prompt grows past that threshold.

const MEAL_PLAN_TOOL_NAME = 'submit_meal_plan';

const MEAL_PLAN_TOOL_SCHEMA = {
  type: 'object' as const,
  properties: {
    meals: {
      type: 'array' as const,
      items: {
        type: 'object' as const,
        properties: {
          title: { type: 'string' as const, description: 'e.g. "Meal 1"' },
          items: {
            type: 'array' as const,
            items: {
              type: 'object' as const,
              properties: {
                name: { type: 'string' as const },
                quantity: { type: 'string' as const, description: 'e.g. "4 oz", "1 cup"' },
                calories: { type: 'integer' as const, minimum: 0 },
                protein: { type: 'integer' as const, minimum: 0 },
                carbs: { type: 'integer' as const, minimum: 0 },
                fat: { type: 'integer' as const, minimum: 0 },
              },
              required: ['name', 'quantity', 'calories', 'protein', 'carbs', 'fat'],
            },
          },
        },
        required: ['title', 'items'],
      },
    },
    notes: {
      type: 'string' as const,
      description: 'Optional short coaching note under 200 chars',
    },
  },
  required: ['meals'],
};

const callAnthropic = async (prompt: string): Promise<GeneratedPlan> => {
  const client = new Anthropic();

  const response = await client.messages.create({
    model: MACRA_MEAL_PLAN.model,
    max_tokens: MACRA_MEAL_PLAN.maxTokens,
    system:
      "You are Nora, Macra's performance nutrition coach. Build context-aware meal plans, and when physique-prep context exists, prioritize stage-readiness, digestion consistency, and predictable foods.",
    tools: [
      {
        name: MEAL_PLAN_TOOL_NAME,
        description: 'Submit the generated meal plan in the structured schema.',
        input_schema: MEAL_PLAN_TOOL_SCHEMA,
      },
    ],
    tool_choice: { type: 'tool', name: MEAL_PLAN_TOOL_NAME },
    messages: [{ role: 'user', content: prompt }],
  });

  const toolUse = response.content.find(
    (block): block is Anthropic.ToolUseBlock =>
      block.type === 'tool_use' && block.name === MEAL_PLAN_TOOL_NAME,
  );
  if (!toolUse) {
    throw new Error('Anthropic response missing forced tool_use block');
  }

  const parsed = toolUse.input as GeneratedPlan;
  if (!Array.isArray(parsed?.meals)) {
    throw new Error('Model response missing meals array');
  }
  return parsed;
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

  // Phase B+ full cutover: server-side Anthropic SDK call (no bridge round-trip).
  // Requires ANTHROPIC_API_KEY in Netlify env. The Firebase token was already
  // verified above via verifyAuth(); we no longer need to relay it.
  try {
    const prompt = buildPrompt(body, mealsCount);
    const plan = await callAnthropic(prompt);

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
