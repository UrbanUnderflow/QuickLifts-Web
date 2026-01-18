import type { Handler } from '@netlify/functions';
import OpenAI from 'openai';
import crypto from 'crypto';

type RequestBody = {
  text: string;
  // optional “Nora” voice selector (provider dependent)
  voice?: string;
  // 'mp3' | 'wav' etc (provider dependent) – default mp3
  format?: string;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

function json(statusCode: number, body: unknown) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
    body: JSON.stringify(body),
  };
}

export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method not allowed' });
  }

  if (!process.env.OPENAI_API_KEY) {
    return json(400, { error: 'OPENAI_API_KEY not configured' });
  }

  let body: RequestBody;
  try {
    body = event.body ? JSON.parse(event.body) : ({} as RequestBody);
  } catch {
    return json(400, { error: 'Invalid JSON body' });
  }

  const text = typeof body.text === 'string' ? body.text.trim() : '';
  if (!text) return json(400, { error: 'Missing `text`' });
  if (text.length > 800) return json(400, { error: 'Text too long (max 800 chars)' });

  const voice = typeof body.voice === 'string' && body.voice.trim() ? body.voice.trim() : 'alloy';
  const format = typeof body.format === 'string' && body.format.trim() ? body.format.trim() : 'mp3';

  // cheap cache hint (clients can cache per text)
  const etag = crypto.createHash('sha256').update(`${voice}:${format}:${text}`).digest('hex');

  try {
    // OpenAI TTS (Audio Speech). Model/voice names may differ per account/region.
    // If this fails, the client should fall back to browser speech synthesis.
    const speech = await openai.audio.speech.create({
      model: 'gpt-4o-mini-tts',
      voice,
      input: text,
      format,
    } as any);

    // openai sdk returns a Response-like object with arrayBuffer()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const buf = Buffer.from(await (speech as any).arrayBuffer());
    const base64 = buf.toString('base64');

    return {
      statusCode: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': format === 'wav' ? 'audio/wav' : 'audio/mpeg',
        'Cache-Control': 'public, max-age=31536000, immutable',
        ETag: etag,
      },
      isBase64Encoded: true,
      body: base64,
    };
  } catch (error: any) {
    console.error('[tts-mental-step] failed', error);
    return json(500, { error: 'TTS generation failed' });
  }
};

