import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPEN_AI_SECRET_KEY,
});

function clampArray(arr, max) {
  if (!Array.isArray(arr)) return [];
  return arr.slice(0, Math.max(0, max));
}

function normalizeString(s) {
  return String(s || '').trim();
}

function buildAllowedList(allowedMoves) {
  const userSelected = Array.isArray(allowedMoves?.userSelected) ? allowedMoves.userSelected : [];
  const backupByBodyPart = allowedMoves?.backupByBodyPart || {};

  const normalizedUserSelected = userSelected
    .map((m) => ({ id: normalizeString(m.id), name: normalizeString(m.name) }))
    .filter((m) => m.id && m.name);

  // If user selected is empty, use backup by body part with caps (token control).
  let normalizedBackup = [];
  if (normalizedUserSelected.length === 0) {
    const parts = Object.keys(backupByBodyPart || {});
    for (const part of parts) {
      const moves = clampArray(backupByBodyPart[part], 50)
        .map((m) => ({ id: normalizeString(m.id), name: normalizeString(m.name) }))
        .filter((m) => m.id && m.name);
      // Also cap overall
      normalizedBackup.push(...moves);
      if (normalizedBackup.length >= 400) break;
    }
  }

  const allow = normalizedUserSelected.length > 0 ? normalizedUserSelected : normalizedBackup;
  return allow;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const {
      templateTitle,
      templateDescription,
      instructions,
      allowedMoves,
      numberOfUniqueStacks,
      bodyPartFocusPerStack,
      screenTimeEnabled,
      maxMovesPerStack,
      timeBudgetMinutesPerStack,
    } = req.body || {};

    const title = normalizeString(templateTitle);
    const desc = normalizeString(templateDescription);
    const instr = normalizeString(instructions);

    const stacksCount = Math.max(1, Math.min(14, Number(numberOfUniqueStacks) || 1));
    const movesPerStack = Math.max(1, Math.min(12, Number(maxMovesPerStack) || 8));
    const timeBudget = timeBudgetMinutesPerStack === null || timeBudgetMinutesPerStack === undefined
      ? null
      : Number(timeBudgetMinutesPerStack);

    const allowed = buildAllowedList(allowedMoves);
    if (!allowed || allowed.length === 0) {
      res.status(400).json({ error: 'No allowed moves provided.' });
      return;
    }

    const allowedLines = allowed.map((m) => `${m.id} :: ${m.name}`);
    const focus = Array.isArray(bodyPartFocusPerStack) ? bodyPartFocusPerStack : [];

    const focusLines = Array.from({ length: stacksCount }, (_, i) => {
      const group = Array.isArray(focus[i]) ? focus[i].map(normalizeString).filter(Boolean) : [];
      if (!group.length) return `Stack ${i + 1} focus: (no specific focus)`;
      return `Stack ${i + 1} focus: ${group.join(', ')}`;
    }).join('\n');

    const modeLine = screenTimeEnabled ? 'TIMED MODE: Use screenTime seconds per exercise.' : 'REPS/SETS MODE: Provide sets and reps per exercise.';

    const prompt = `
You are a JSON-generating fitness AI. Return PURE JSON only, with NO markdown, no backticks, and no extra text.

GOAL:
- Generate EXACTLY ${stacksCount} unique workout stacks for a Round.
- Each stack MUST contain EXACTLY ${movesPerStack} exercises.
- You MUST ONLY use exercises from the ALLOWED MOVES list below.
- Each exercise MUST be referenced by its ID and name exactly as listed.

ROUND CONTEXT:
- Title: ${title || 'Untitled'}
- Description: ${desc || '(none)'}
- Instructions: ${instr || '(none)'}

STACK FOCUS (if specified):
${focusLines}

CONSTRAINTS:
- ${modeLine}
- Time budget per stack (minutes): ${timeBudget === null || Number.isNaN(timeBudget) ? 'null' : timeBudget}
- Keep programming coherent (warm-up to compound to accessory).

ALLOWED MOVES (id :: name):
${allowedLines.join('\n')}

RESPONSE SHAPE (JSON only):
{
  "thinking": "1-2 sentences",
  "stacks": [
    {
      "title": "Stack title",
      "description": "Short description",
      "exercises": [
        {
          "id": "exerciseId",
          "name": "exerciseName",
          "category": {
            "id": "weight-training",
            "reps": ["12","10","8"],
            "sets": 3,
            "weight": 0,
            "screenTime": 0,
            "selectedVideo": {}
          }
        }
      ]
    }
  ]
}

RULES:
- Return ONLY valid JSON.
- Exactly ${stacksCount} stacks.
- Exactly ${movesPerStack} exercises per stack.
- Exercise IDs must match a provided allowed ID.
- For TIMED MODE, set category.screenTime to a non-zero number (seconds) and set sets=1, reps=[""].
`;

    const response = await openai.chat.completions.create({
      model: 'o3-mini',
      messages: [
        {
          role: 'system',
          content: 'You are an elite fitness trainer and strict JSON generator. Output JSON only.',
        },
        { role: 'user', content: prompt },
      ],
      max_completion_tokens: 9000,
    });

    const raw = response?.choices?.[0]?.message?.content || '';

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (_e) {
      // attempt minimal cleanup if model returned fenced JSON
      const cleaned = raw
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();
      parsed = JSON.parse(cleaned);
    }

    if (!parsed || !Array.isArray(parsed.stacks)) {
      res.status(400).json({ error: 'Invalid AI response shape', raw });
      return;
    }

    // Basic validation (do not mutate IDs—client will validate/match too)
    const validatedStacks = parsed.stacks
      .filter((s) => s && Array.isArray(s.exercises))
      .map((s) => ({
        title: normalizeString(s.title) || 'Workout',
        description: normalizeString(s.description) || '',
        exercises: s.exercises
          .map((ex) => ({
            id: normalizeString(ex.id),
            name: normalizeString(ex.name),
            category: ex.category || {},
          }))
          .filter((ex) => ex.id && ex.name),
      }));

    res.status(200).json({
      thinking: typeof parsed.thinking === 'string' ? parsed.thinking : '',
      stacks: validatedStacks,
    });
  } catch (error) {
    console.error('[generateRoundV2] Error:', error);
    res.status(500).json({ error: 'Failed to generate round' });
  }
}

