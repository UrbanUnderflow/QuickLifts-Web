import type { Handler } from '@netlify/functions';
import OpenAI from 'openai';
import crypto from 'crypto';
import { normalizeElevenLabsSettings } from '../../src/lib/aiVoice';

type RequestBody = {
  text: string;
  // optional “Nora” voice selector (provider dependent)
  provider?: 'openai' | 'elevenlabs';
  voice?: string;
  // 'mp3' | 'wav' etc (provider dependent) – default mp3
  format?: string;
  presetId?: string | null;
  settings?: {
    stability?: number;
    similarityBoost?: number;
    style?: number;
    useSpeakerBoost?: boolean;
    speed?: number;
  } | null;
  punctuationPauses?: boolean | null;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const openai = new OpenAI({
  apiKey: process.env.OPEN_AI_SECRET_KEY,
});

function json(statusCode: number, body: unknown) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
    body: JSON.stringify(body),
  };
}

function addPunctuationPauses(text: string) {
  return text
    .replace(/\s+/g, ' ')
    .replace(/([.!?])\s+/g, '$1\n')
    .replace(/([,;:])\s+/g, '$1  ')
    .trim();
}

export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method not allowed' });
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

  const provider = body.provider === 'elevenlabs' ? 'elevenlabs' : 'openai';
  const voice = typeof body.voice === 'string' && body.voice.trim() ? body.voice.trim() : 'alloy';
  const format = typeof body.format === 'string' && body.format.trim() ? body.format.trim() : 'mp3';
  const elevenLabsSettings = body.settings
    ? normalizeElevenLabsSettings(body.settings || undefined, body.presetId || undefined)
    : null;
  const punctuationPauses = body.punctuationPauses === true;
  const synthesisText = provider === 'elevenlabs' && punctuationPauses
    ? addPunctuationPauses(text)
    : text;

  // cheap cache hint (clients can cache per text)
  const etag = crypto
    .createHash('sha256')
    .update(`${provider}:${voice}:${format}:${body.presetId || ''}:${punctuationPauses}:${synthesisText}:${JSON.stringify(elevenLabsSettings)}`)
    .digest('hex');

  try {
    if (provider === 'elevenlabs') {
      if (!process.env.ELEVEN_LABS_API_KEY) {
        return json(400, { error: 'ELEVEN_LABS_API_KEY not configured' });
      }

      const response = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${voice}?optimize_streaming_latency=2`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'xi-api-key': process.env.ELEVEN_LABS_API_KEY,
          },
          body: JSON.stringify({
            text: synthesisText,
            model_id: 'eleven_multilingual_v2',
            output_format: 'mp3_44100_128',
            ...(elevenLabsSettings
              ? {
                  voice_settings: {
                    stability: elevenLabsSettings.stability,
                    similarity_boost: elevenLabsSettings.similarityBoost,
                    style: elevenLabsSettings.style,
                    use_speaker_boost: elevenLabsSettings.useSpeakerBoost,
                    speed: elevenLabsSettings.speed,
                  },
                }
              : {}),
          }),
        }
      );

      if (!response.ok) {
        return json(502, { error: 'ElevenLabs TTS generation failed' });
      }

      const buf = Buffer.from(await response.arrayBuffer());
      return {
        statusCode: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'audio/mpeg',
          'Cache-Control': 'public, max-age=31536000, immutable',
          ETag: etag,
        },
        isBase64Encoded: true,
        body: buf.toString('base64'),
      };
    }

    if (!process.env.OPEN_AI_SECRET_KEY) {
      return json(400, { error: 'OPEN_AI_SECRET_KEY not configured' });
    }

    const speech = await openai.audio.speech.create({
      model: 'gpt-4o-mini-tts',
      voice,
      input: text,
      format,
    } as any);

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
