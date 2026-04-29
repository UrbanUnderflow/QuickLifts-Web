/**
 * classify-challenge-type
 *
 * Admin-only Netlify function that classifies a (legacy / typeless) challenge
 * into the canonical `ChallengeType` enum using Claude Haiku.
 *
 * The caller (the Admin Lever in /admin/adminLevers) sends the challenge's
 * title, subtitle, and the list of denormalized workout names that already
 * live on the `sweatlist-collection` doc — no need to fan-out to per-workout
 * documents to make a confident call.
 *
 * Auth:
 *   - Bearer ID token of a signed-in admin user (must have an `admin/{email}` doc).
 *   - Hard-fails if `ANTHROPIC_API_KEY` is not set in the deployed environment.
 *
 * Caching:
 *   - The system prompt + enum spec are stable across the entire batch run, so
 *     prompt caching gives us a ~10% effective rate from the second call onward.
 *
 * The function never writes to Firestore — it just returns the inferred enum
 * + reasoning. The caller (admin lever) decides whether to commit the change
 * during a live run.
 */

import { Handler } from '@netlify/functions';
import { admin, db, headers as corsHeaders } from './config/firebase';

const ANTHROPIC_MODEL = 'claude-haiku-4-5';
const ANTHROPIC_API_VERSION = '2023-06-01';

// Mirrors `ChallengeType` in QuickLifts/Models/Challenge.swift. Keep in sync.
const VALID_TYPES = ['lift', 'run', 'bike', 'burn', 'stretch', 'hybrid', 'nutrition'] as const;
type ChallengeTypeValue = (typeof VALID_TYPES)[number];

interface RequestBody {
  challengeId?: string;
  challengeTitle?: string;
  challengeSubtitle?: string;
  workoutTitles?: string[];
}

interface ClassificationResult {
  inferredType: ChallengeTypeValue;
  confidence: 'high' | 'medium' | 'low';
  reasoning: string;
}

const SYSTEM_PROMPT = `You classify a fitness challenge into one of seven canonical types.

The seven valid values are exactly:
  - "lift"      → Weight training, strength workouts (squats, bench, deadlifts, hypertrophy, powerlifting, push/pull/legs, etc.)
  - "run"       → Running, cardio runs, 5k/10k/half/marathon training, track work
  - "bike"      → Cycling, indoor cycling, peloton, road cycling, gravel
  - "burn"      → HIIT, fat burn, conditioning, metabolic, circuits with high heart-rate intent
  - "stretch"   → Flexibility, mobility, yoga, recovery, foam rolling, dynamic warmups, prehab/rehab
  - "hybrid"    → Genuinely mixed strength + cardio (e.g. CrossFit-style WODs combining lifts and cardio)
  - "nutrition" → Nutrition-focused: hit calorie/macro target, no workouts

Rules:
1. Pick the SINGLE best match based on the workout names + challenge title/subtitle.
2. If the workouts are obviously a mobility/flexibility/yoga focus, use "stretch" — that bucket explicitly covers mobility.
3. Use "hybrid" only when it's clearly a cardio-AND-strength program. A lift program with one cardio finisher is still "lift".
4. Default to "lift" only if the evidence genuinely points there, NOT as a fallback for ambiguous cases. Use "low" confidence when unsure.
5. Reply with strict JSON, no surrounding text. Schema:
   {"inferredType": "<one of: lift|run|bike|burn|stretch|hybrid|nutrition>", "confidence": "<high|medium|low>", "reasoning": "<one short sentence>"}
`;

const buildUserPrompt = (body: RequestBody): string => {
  const lines: string[] = [];
  lines.push(`Challenge title: ${body.challengeTitle?.trim() || '(blank)'}`);
  if (body.challengeSubtitle?.trim()) {
    lines.push(`Subtitle: ${body.challengeSubtitle.trim()}`);
  }
  const titles = (body.workoutTitles || [])
    .map((t) => t?.trim())
    .filter((t): t is string => !!t);
  if (titles.length > 0) {
    lines.push('');
    lines.push(`Workout names (${titles.length}):`);
    titles.forEach((t, i) => lines.push(`  ${i + 1}. ${t}`));
  } else {
    lines.push('');
    lines.push('No workout names available — classify from title/subtitle only and use "low" confidence.');
  }
  lines.push('');
  lines.push('Respond with JSON only.');
  return lines.join('\n');
};

const verifyAdmin = async (
  authHeader: string | undefined
): Promise<{ ok: true; email: string } | { ok: false; status: number; message: string }> => {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { ok: false, status: 401, message: 'Missing bearer token' };
  }
  let decoded;
  try {
    decoded = await admin.auth().verifyIdToken(authHeader.split('Bearer ')[1]);
  } catch {
    return { ok: false, status: 401, message: 'Invalid token' };
  }
  const email = decoded.email;
  if (!email) {
    return { ok: false, status: 401, message: 'Token missing email' };
  }
  const adminDoc = await db.collection('admin').doc(email).get();
  if (!adminDoc.exists) {
    return { ok: false, status: 403, message: 'Not an admin' };
  }
  return { ok: true, email };
};

const callClaude = async (userPrompt: string): Promise<ClassificationResult> => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY not configured');
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': ANTHROPIC_API_VERSION,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 256,
      // Cache the (long, stable) system prompt across the whole admin-lever
      // batch — every challenge after the first pays the cached rate.
      system: [
        {
          type: 'text',
          text: SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [
        {
          role: 'user',
          content: userPrompt,
        },
      ],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Claude API error ${response.status}: ${text}`);
  }
  const data = (await response.json()) as { content?: Array<{ type: string; text?: string }> };
  const textBlock = data.content?.find((b) => b.type === 'text');
  const raw = textBlock?.text?.trim() || '';
  if (!raw) throw new Error('Empty model response');

  let parsed: any;
  try {
    // Be lenient: strip stray code fences if the model wraps JSON.
    const cleaned = raw
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/, '')
      .replace(/```\s*$/, '')
      .trim();
    parsed = JSON.parse(cleaned);
  } catch (e) {
    throw new Error(`Failed to parse model JSON: ${raw.slice(0, 200)}`);
  }

  const inferredType = String(parsed?.inferredType || '').toLowerCase() as ChallengeTypeValue;
  if (!VALID_TYPES.includes(inferredType)) {
    throw new Error(`Model returned invalid type: ${parsed?.inferredType}`);
  }
  const confidence = (['high', 'medium', 'low'] as const).includes(parsed?.confidence)
    ? parsed.confidence
    : 'medium';
  const reasoning = typeof parsed?.reasoning === 'string' ? parsed.reasoning : '';

  return { inferredType, confidence, reasoning };
};

export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  // Auth (admin only)
  const authResult = await verifyAdmin(event.headers.authorization || event.headers.Authorization);
  if (!authResult.ok) {
    return {
      statusCode: authResult.status,
      headers: corsHeaders,
      body: JSON.stringify({ error: authResult.message }),
    };
  }

  let body: RequestBody;
  try {
    body = event.body ? (JSON.parse(event.body) as RequestBody) : {};
  } catch {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Invalid JSON body' }),
    };
  }

  if (!body.challengeId) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'challengeId required' }),
    };
  }

  try {
    const userPrompt = buildUserPrompt(body);
    const result = await callClaude(userPrompt);
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        challengeId: body.challengeId,
        ...result,
        model: ANTHROPIC_MODEL,
      }),
    };
  } catch (err: any) {
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: err?.message || String(err) }),
    };
  }
};
