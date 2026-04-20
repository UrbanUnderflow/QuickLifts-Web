import { Handler } from '@netlify/functions';
import { admin, headers as corsHeaders } from './config/firebase';

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

const resolveOpenAIKey = (): string | null => {
  return process.env.OPENAI_API_KEY?.trim() || process.env.OPEN_AI_SECRET_KEY?.trim() || null;
};

const buildContextBlock = (body: RequestBody): string => {
  const sumCalories = body.meals.reduce((s, m) => s + (m.calories || 0), 0);
  const sumProtein = body.meals.reduce((s, m) => s + (m.protein || 0), 0);
  const sumCarbs = body.meals.reduce((s, m) => s + (m.carbs || 0), 0);
  const sumFat = body.meals.reduce((s, m) => s + (m.fat || 0), 0);

  const targetLine = body.target
    ? `Daily target: ${body.target.calories ?? '?'} kcal, ${body.target.protein ?? '?'}g protein, ${body.target.carbs ?? '?'}g carbs, ${body.target.fat ?? '?'}g fat.`
    : `Daily target: not set.`;

  const goalLine = body.goal && body.goal.trim().length > 0
    ? `User goal: ${body.goal.trim().slice(0, 140)}.`
    : '';

  const mealsList = body.meals.length === 0
    ? 'No meals logged yet today.'
    : body.meals.map((m, i) => `${i + 1}. ${m.name} — ${m.calories} kcal, ${m.protein}P ${m.carbs}C ${m.fat}F`).join('\n');

  return [
    targetLine,
    goalLine,
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

  const apiKey = resolveOpenAIKey();
  if (!apiKey) {
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'OpenAI key not configured' })
    };
  }

  const systemPrompt = [
    "You are Nora, Macra's warm but concise sports nutritionist AI.",
    "Always refer to yourself as Nora when the user addresses the AI.",
    "Analyze the user's eating day + macro target and answer directly.",
    "Keep responses under 180 words. Plain text. No markdown headers. Bullet points allowed.",
    "If the data is empty or thin, ask for one specific piece of info rather than guessing."
  ].join(' ');

  const contextBlock = buildContextBlock(body);

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
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
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
      throw new Error(`OpenAI ${response.status}: ${errText.slice(0, 500)}`);
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
