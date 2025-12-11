import OpenAI from 'openai';

interface GenerateCaptionRequest {
  exerciseName: string;
  category: string;
  tags: string[];
}

const handler = async (event: any) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method Not Allowed' }),
    };
  }

  try {
    const body = event.body ? JSON.parse(event.body) as GenerateCaptionRequest : null;
    const { exerciseName, category, tags } = body || {};

    if (!exerciseName) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Exercise name is required' }),
      };
    }

    const apiKey = process.env.OPEN_AI_SECRET_KEY;
    if (!apiKey) {
      console.error('[generateCaption] Missing OPEN_AI_SECRET_KEY env var');
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'OpenAI API key not configured' }),
      };
    }

    const openai = new OpenAI({ apiKey });

    const prompt = `
      Create a single, technical form cue or tip for this exercise. Focus only on proper execution or a key technique point.

      Exercise Name: ${exerciseName}
      Category: ${category}
      Tags: ${(tags || []).join(', ')}

      Caption Requirements:
      - One clear, specific form cue or technical tip
      - No motivational phrases or exclamations
      - No generic encouragement or "let's" statements
      - Focus purely on technique or execution
      - Maximum 15 words
      - Do not use exclamation marks
      - Do not add phrases like "let's go", "let's unlock", etc.
    `;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            'You are a technical fitness instructor who provides clear, concise form cues. You focus solely on proper exercise execution without adding motivational phrases.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.5,
      max_tokens: 50,
    });

    const generatedCaption = response.choices[0]?.message?.content?.trim() || '';
    const cleanedCaption = generatedCaption.replace(/^["'](.*)["']$/g, '$1');

    return {
      statusCode: 200,
      body: JSON.stringify({ caption: cleanedCaption }),
    };
  } catch (error) {
    console.error('[generateCaption] Error generating caption:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal Server Error' }),
    };
  }
};

export { handler };







