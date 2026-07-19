import type { Handler } from '@netlify/functions';
import OpenAI from 'openai';
import crypto from 'crypto';
import {
  OPENAI_VOICES,
  normalizeAiVoiceConfig,
  normalizeElevenLabsSettings,
} from '../../src/lib/aiVoice';
import { db } from './config/firebase';

type RequestBody = {
  text: string;
  // optional “Nora” voice selector (provider dependent)
  provider?: 'openai' | 'elevenlabs';
  voice?: string;
  /** OpenAI voice to use only if an ElevenLabs runtime request fails. */
  fallbackVoice?: string | null;
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
  /** When true, an ElevenLabs failure returns the error instead of falling
   *  back to OpenAI. The ai-voice pre-generation dashboard sets this: stored
   *  library clips must only ever be Nora's ElevenLabs voice, so admin
   *  generation fails loudly rather than baking an off-brand clip into the
   *  library. Runtime clients (iOS live-TTS misses) omit it and get the
   *  fallback automatically. */
  disableFallback?: boolean;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(statusCode: number, body: unknown) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
    body: JSON.stringify(body),
  };
}

function getHeader(headers: Record<string, string | undefined> | undefined, name: string) {
  if (!headers) return undefined;
  const match = Object.keys(headers).find((key) => key.toLowerCase() === name.toLowerCase());
  return match ? headers[match] : undefined;
}

function resolveOpenAIApiKey() {
  return process.env.OPEN_AI_SECRET_KEY?.trim() || process.env.OPENAI_API_KEY?.trim() || '';
}

function isLocalRequest(headers: Record<string, string | undefined> | undefined) {
  const host = (getHeader(headers, 'host') || '').toLowerCase();
  return host.includes('localhost') || host.includes('127.0.0.1') || host.startsWith('0.0.0.0');
}

async function relayLocalRequestToProduction(event: Parameters<Handler>[0]) {
  const origin = (process.env.VOICE_PROXY_BASE || process.env.NEXT_PUBLIC_SITE_URL || 'https://fitwithpulse.ai').replace(/\/+$/, '');
  const response = await fetch(`${origin}/.netlify/functions/tts-mental-step`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: event.body || '{}',
  });
  const contentType = response.headers.get('content-type') || 'application/octet-stream';
  const buffer = Buffer.from(await response.arrayBuffer());
  const isAudio = contentType.startsWith('audio/');

  return {
    statusCode: response.status,
    headers: {
      ...corsHeaders,
      'Content-Type': contentType,
      'Cache-Control': response.headers.get('cache-control') || 'no-store',
      ...(response.headers.get('x-tts-provider') ? { 'X-TTS-Provider': response.headers.get('x-tts-provider')! } : {}),
      ...(response.headers.get('x-tts-voice') ? { 'X-TTS-Voice': response.headers.get('x-tts-voice')! } : {}),
    },
    isBase64Encoded: isAudio,
    body: isAudio ? buffer.toString('base64') : buffer.toString('utf8'),
  };
}

function addPunctuationPauses(text: string) {
  return text
    .replace(/\s+/g, ' ')
    .replace(/([.!?])\s+/g, '$1\n')
    .replace(/([,;:])\s+/g, '$1  ')
    .trim();
}

const OPENAI_VOICE_IDS = new Set(
  OPENAI_VOICES
    .filter((voice) => voice.provider === 'openai')
    .map((voice) => voice.id)
);
const DEFAULT_OPENAI_FALLBACK_VOICE = 'nova';

async function resolveOpenAIFallbackVoice(requestedVoice?: string | null) {
  const requested = typeof requestedVoice === 'string' ? requestedVoice.trim() : '';
  if (OPENAI_VOICE_IDS.has(requested)) return requested;

  try {
    const snapshot = await db.collection('app-config').doc('ai-voice').get();
    if (snapshot.exists) {
      const config = normalizeAiVoiceConfig(snapshot.data());
      const configured = config.openAiVoiceId?.trim() || '';
      if (OPENAI_VOICE_IDS.has(configured)) return configured;
    }
  } catch (error) {
    console.warn('[tts-mental-step] could not load configured OpenAI fallback voice', error);
  }

  return DEFAULT_OPENAI_FALLBACK_VOICE;
}

async function synthesizeWithOpenAI(text: string, voice: string, format: string) {
  const apiKey = resolveOpenAIApiKey();
  if (!apiKey) throw new Error('OpenAI TTS is not configured');
  const openai = new OpenAI({ apiKey });
  const speech = await openai.audio.speech.create({
    model: 'gpt-4o-mini-tts',
    voice,
    input: text,
    format,
  } as any);
  return Buffer.from(await (speech as any).arrayBuffer());
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

  const missingSelectedProviderKey = provider === 'elevenlabs'
    ? !process.env.ELEVEN_LABS_API_KEY
    : !resolveOpenAIApiKey();
  if (missingSelectedProviderKey && isLocalRequest(event.headers)) {
    try {
      return await relayLocalRequestToProduction(event);
    } catch (error) {
      console.error('[tts-mental-step] local production relay failed', error);
    }
  }

  // cheap cache hint (clients can cache per text)
  const etag = crypto
    .createHash('sha256')
    .update(`${provider}:${voice}:${body.fallbackVoice || ''}:${format}:${body.presetId || ''}:${punctuationPauses}:${synthesisText}:${JSON.stringify(elevenLabsSettings)}`)
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
        // Pass the upstream reason through: 401 quota_exceeded (out of
        // credits), 401 invalid_api_key, 429 too_many_concurrent_requests
        // (rate limit) all look identical as a bare 502. The ai-voice
        // dashboard surfaces this error string verbatim in the console.
        let detail = '';
        try {
          const raw = await response.text();
          try {
            const payload = JSON.parse(raw);
            detail = payload?.detail?.status || payload?.detail?.message || raw.slice(0, 200);
          } catch {
            detail = raw.slice(0, 200);
          }
        } catch {}
        console.error('[tts-mental-step] ElevenLabs error', response.status, detail);

        // Runtime fallback: a live-TTS miss should still speak even when
        // ElevenLabs is out of credits (e.g. quota_exceeded until the cycle
        // renews). Pre-generation opts out via disableFallback so the stored
        // library never picks up an OpenAI-voiced clip.
        if (body.disableFallback !== true && resolveOpenAIApiKey()) {
          try {
            const fallbackVoice = await resolveOpenAIFallbackVoice(body.fallbackVoice);
            const fallbackBuf = await synthesizeWithOpenAI(synthesisText, fallbackVoice, 'mp3');
            console.warn('[tts-mental-step] served OpenAI fallback after ElevenLabs failure', response.status, detail, { fallbackVoice });
            return {
              statusCode: 200,
              headers: {
                ...corsHeaders,
                'Content-Type': 'audio/mpeg',
                'Cache-Control': 'no-store',
                'X-TTS-Provider': 'openai-fallback',
                'X-TTS-Voice': fallbackVoice,
                ETag: etag,
              },
              isBase64Encoded: true,
              body: fallbackBuf.toString('base64'),
            };
          } catch (fallbackError) {
            console.error('[tts-mental-step] OpenAI fallback also failed', fallbackError);
          }
        }

        return json(502, {
          error: `ElevenLabs TTS generation failed (upstream ${response.status}${detail ? `: ${detail}` : ''})`,
        });
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

    if (!resolveOpenAIApiKey()) {
      return json(400, { error: 'OPEN_AI_SECRET_KEY not configured' });
    }

    const buf = await synthesizeWithOpenAI(text, voice, format);
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
