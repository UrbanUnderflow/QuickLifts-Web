import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { admin } from './config/firebase';
import { GENERATE_CAPTION } from '../../src/api/anthropic/featureRouting';
import {
  buildAdminFallbackLogger,
  callWithFallback,
} from '../../src/api/anthropic/callWithFallback';

interface GenerateCaptionRequest {
  exerciseName: string;
  category: string;
  tags: string[];
}

const SYSTEM_PROMPT =
  'You are a technical fitness instructor who provides clear, concise form cues. You focus solely on proper exercise execution without adding motivational phrases.';

const buildPrompt = ({ exerciseName, category, tags }: GenerateCaptionRequest) => `
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

const callAnthropic = async (request: GenerateCaptionRequest): Promise<string> => {
  const client = new Anthropic();
  const response = await client.messages.create({
    model: GENERATE_CAPTION.model,
    max_tokens: GENERATE_CAPTION.maxTokens,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: buildPrompt(request) }],
  });
  const text = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('')
    .trim();
  if (!text) throw new Error('Anthropic response missing text content');
  return text;
};

const callOpenAI = async (request: GenerateCaptionRequest, apiKey: string): Promise<string> => {
  const openai = new OpenAI({ apiKey });
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: buildPrompt(request) },
    ],
    temperature: 0.5,
    max_tokens: 50,
  });
  return response.choices[0]?.message?.content?.trim() || '';
};

const handler = async (event: any) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method Not Allowed' }),
    };
  }

  try {
    const body = event.body ? (JSON.parse(event.body) as GenerateCaptionRequest) : null;
    const { exerciseName, category, tags } = body || ({} as GenerateCaptionRequest);

    if (!exerciseName) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Exercise name is required' }),
      };
    }

    if (!process.env.ANTHROPIC_API_KEY && !process.env.OPEN_AI_SECRET_KEY) {
      console.error('[generateCaption] No provider key configured (need ANTHROPIC_API_KEY or OPEN_AI_SECRET_KEY)');
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'No provider key configured' }),
      };
    }

    const request: GenerateCaptionRequest = { exerciseName, category, tags };
    const logger = buildAdminFallbackLogger(admin.firestore());

    const { result: rawCaption, providerUsed, fallbackTriggered } = await callWithFallback({
      feature: GENERATE_CAPTION,
      anthropicCall: () => callAnthropic(request),
      openaiCall: () => {
        const apiKey = process.env.OPEN_AI_SECRET_KEY;
        if (!apiKey) throw new Error('OPEN_AI_SECRET_KEY not configured for fallback');
        return callOpenAI(request, apiKey);
      },
      logger,
    });

    const cleanedCaption = rawCaption.replace(/^["'](.*)["']$/g, '$1');

    return {
      statusCode: 200,
      body: JSON.stringify({
        caption: cleanedCaption,
        providerUsed,
        fallbackTriggered,
      }),
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
