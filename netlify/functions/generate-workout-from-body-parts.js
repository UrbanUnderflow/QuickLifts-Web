// Netlify Function: generate-workout-from-body-parts
// Mirrors the iOS GPTService.generateWorkout / RemoteConfigService.defaultGenerateWorkoutPrompt
// Takes selected body parts + candidate exercise names and returns grouped exercise names [[String]]

const { headers } = require('./config/firebase');

// Copied from iOS RemoteConfigService.defaultGenerateWorkoutPrompt (Swift),
// adapted to JS template string with the same placeholders.
const DEFAULT_GENERATE_WORKOUT_PROMPT = `
Assume the role of a personal fitness trainer specialized in creating tailored workout plans. The individual has specified their preferred body parts to target during the workout and has shared their fitness goals. Your task is to output ONLY the names of the exercises as an array, formatted as follows:

[ [ExerciseName, ExerciseName], [ExerciseName, ExerciseName], [ExerciseName, ExerciseName] ]

CRITICAL REQUIREMENT: YOU MUST INCLUDE EXACTLY 6 EXERCISES (3 PAIRS) - THIS IS NON-NEGOTIABLE
- If you cannot find enough exercises for the requested body parts, YOU MUST select complementary exercises or exercises that work nearby muscle groups to reach exactly 6
- Even if some exercises are not perfect matches, you MUST still output exactly 6 exercises
- NEVER return fewer than 6 exercises under any circumstances

BALANCED BODY PART REPRESENTATION REQUIREMENT:
- EACH requested body part in "{{bodyParts}}" MUST be represented by AT LEAST 2 exercises
- For example: If body parts are "Biceps, Calves", you MUST include at least 2 bicep exercises AND at least 2 calf exercises
- This ensures users get a complete workout for all requested muscle groups
- If a body part has fewer available exercises, use ALL available exercises for that body part

IMPORTANT: STRICT RULES TO FOLLOW
DO NOT INCLUDE ANY EXTRA TEXT. No introductions, explanations, markdown formatting, or commentary.
RETURN ONLY THE ARRAY. The response must start and end with the array. No additional characters.
DO NOT USE QUOTES, CODE BLOCKS, OR JSON MARKDOWN. Just return the array in plain text format.
THE WORKOUT MUST HAVE EXACTLY 6 EXERCISES—NO EXCEPTIONS. If needed, choose the closest possible match to fill all 6 slots.
The final output must match this exact structure:
[["Exercise A", "Exercise B"], ["Exercise C", "Exercise D"], ["Exercise E", "Exercise F"]]

Workout Plan Requirements
Target body parts: "{{bodyParts}}"
Fitness goal: "{{goal}}"
Choose exercises from: "{{exerciseList}}"
If predefined exercises exist: "{{withPreDefinedExercises}}", they must be included first
Ensure each superset pairs different muscle groups
Begin with larger muscle groups, ending with smaller ones

SELECTION PRIORITY:
1. Include all predefined exercises first: "{{withPreDefinedExercises}}" (if any)
2. Choose exercises that target the requested body parts: "{{bodyParts}}" - ENSURE BALANCED REPRESENTATION
3. If not enough exercises are available for the requested body parts, select exercises that:
   - Target complementary or synergistic muscle groups
   - Work nearby muscle groups
   - Support the overall "{{goal}}"
4. You MUST fill all 6 slots even if some selections are less ideal

FINAL CHECK:
- Have you included EXACTLY 6 exercises? If not, add more until you have exactly 6.
- Does each body part in "{{bodyParts}}" have at least 2 exercises? If not, replace exercises to ensure balance.
- Are they arranged in 3 pairs? If not, reorganize them into 3 pairs.
- Is your response ONLY the array with no additional text? If not, remove all extra text.
- Remember: ALWAYS output exactly 6 exercises (3 pairs) with BALANCED body part representation.
`;

// Helper: build the filled-in prompt string
function buildPrompt({ bodyPartsInput, goal, exerciseList, allExercises, predefinedExercises }) {
  // For prompt text, expand "back" into more descriptive muscles like iOS does.
  const modifiedBodyPartsForPrompt = (bodyPartsInput || []).flatMap((bp) => {
    const p = String(bp || '').toLowerCase();
    if (p === 'back') {
      return ['latissimus dorsi', 'trapezius', 'rhomboids'];
    }
    return [p];
  });

  const bodyPartsAsString = modifiedBodyPartsForPrompt.join(', ') || 'full body';
  const exercisesAsString = (exerciseList || []).join(', ') || (allExercises || []).join(', ');
  const allExercisesAsString = (allExercises || []).join(', ');
  const predefinedExercisesAsStrings = (predefinedExercises || []).join(', ') || 'none';
  const goalString = goal && String(goal).trim().length > 0 ? String(goal) : 'general fitness';

  return DEFAULT_GENERATE_WORKOUT_PROMPT
    .replace(/{{bodyParts}}/g, bodyPartsAsString)
    .replace(/{{goal}}/g, goalString)
    .replace(/{{exerciseList}}/g, exercisesAsString)
    .replace(/{{withPreDefinedExercises}}/g, predefinedExercisesAsStrings)
    .replace(/{{allExercises}}/g, allExercisesAsString);
}

// Helper: parse LLM output into [[string]]
function parseExerciseGroups(rawText) {
  if (!rawText) return [];
  let text = String(rawText).trim();

  // Strip common markdown fences if the model ignores instructions
  text = text.replace(/```json/gi, '```');
  if (text.startsWith('```')) {
    text = text.replace(/^```[a-zA-Z]*\s*/,'').replace(/```$/,'').trim();
  }

  // Try direct JSON parse first
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed) && parsed.every(row => Array.isArray(row))) {
      return parsed;
    }
  } catch (_) {
    // ignore and try to salvage below
  }

  // Try to find the first top-level array in the text
  const match = text.match(/\[\s*\[[\s\S]*\]\s*\]/);
  if (match) {
    try {
      const parsed = JSON.parse(match[0]);
      if (Array.isArray(parsed) && parsed.every(row => Array.isArray(row))) {
        return parsed;
      }
    } catch (_) {
      // fall through
    }
  }

  // As a very last resort, split by newlines and commas into 6 single-item groups
  const candidates = text
    .replace(/[\[\]"']/g, ' ')
    .split(/[\n,]/)
    .map(s => s.trim())
    .filter(Boolean);

  if (!candidates.length) return [];

  const firstSix = candidates.slice(0, 6);
  const groups = [];
  for (let i = 0; i < firstSix.length; i += 2) {
    groups.push(firstSix.slice(i, i + 2));
  }
  return groups;
}

exports.handler = async (event, context) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: 'OK' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Missing OPENAI_API_KEY' })
      };
    }

    const payload = JSON.parse(event.body || '{}');
    const {
      bodyPartsInput = [],
      exerciseList = [],
      allExercises = [],
      predefinedExercises = [],
      goal = ''
    } = payload;

    if (!Array.isArray(bodyPartsInput) || !Array.isArray(exerciseList) || !Array.isArray(allExercises)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid payload: expected arrays for bodyPartsInput, exerciseList, allExercises' })
      };
    }

    const prompt = buildPrompt({
      bodyPartsInput,
      goal,
      exerciseList,
      allExercises,
      predefinedExercises
    });

    // Compose messages: keep it simple, prompt already contains detailed instructions.
    const messages = [
      { role: 'system', content: 'You are a workout generator AI that returns ONLY arrays of exercise names.' },
      { role: 'user', content: prompt }
    ];

    const completionRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages,
        temperature: 0.5,
        max_tokens: 220
      })
    });

    if (!completionRes.ok) {
      const errText = await completionRes.text();
      console.error('[generate-workout-from-body-parts] OpenAI error:', errText);
      return {
        statusCode: 502,
        headers,
        body: JSON.stringify({ error: 'OpenAI error', detail: errText })
      };
    }

    const completion = await completionRes.json();
    const rawContent = completion.choices?.[0]?.message?.content || '';

    const groups = parseExerciseGroups(rawContent);

    if (!groups.length) {
      console.error('[generate-workout-from-body-parts] Unable to parse exercise groups from AI output:', rawContent);
      return {
        statusCode: 502,
        headers,
        body: JSON.stringify({ error: 'Failed to parse AI workout response' })
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ groups })
    };
  } catch (error) {
    console.error('[generate-workout-from-body-parts] Unexpected error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};








