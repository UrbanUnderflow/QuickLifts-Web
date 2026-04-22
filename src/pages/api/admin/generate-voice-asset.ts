// Admin-side generator that synthesizes a voice clip using the Nora voice
// configured at /admin/ai-voice and writes the mp3 to
// `public/audio/<dir>/<filename>.mp3`.
//
// Voice resolution:
//   - Reads the currently selected Nora voice from Firestore doc
//     `app-config/ai-voice` (unless the caller overrides voice/provider/
//     profile explicitly).
//
// Generation path:
//   1. If ELEVEN_LABS_API_KEY is set locally, call ElevenLabs directly.
//   2. Otherwise proxy to the production deploy's
//      /.netlify/functions/tts-mental-step (which has the key on Netlify).
//
// POST body (all optional — endpoint auto-resolves from Firestore):
//   {
//     text: string,                   // required
//     filename: string,                // required, e.g. "nora-hero.mp3"
//     dir?: string,                    // default "nora"
//     voice?: string,                  // override ElevenLabs voice id
//     provider?: 'elevenlabs' | 'openai',
//     presetId?: 'default' | 'grounded' | 'expressive' | 'animated',
//     settings?: ElevenLabsVoiceSettings,
//     punctuationPauses?: boolean,
//   }

import type { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs/promises';
import path from 'path';
import {
  AiVoiceConfig,
  ElevenLabsVoiceSettings,
  normalizeAiVoiceConfig,
  normalizeElevenLabsSettings,
  shouldUseElevenLabsVoiceDefaults,
} from '../../../lib/aiVoice';

type RequestBody = {
  text?: string;
  filename?: string;
  dir?: string;
  voice?: string;
  provider?: 'elevenlabs' | 'openai';
  presetId?: string | null;
  settings?: Partial<ElevenLabsVoiceSettings> | null;
  punctuationPauses?: boolean;
};

function sanitizeSegment(segment: string) {
  return segment.replace(/[^a-zA-Z0-9_-]/g, '');
}

function sanitizeFilename(name: string) {
  const cleaned = name.replace(/[^a-zA-Z0-9._-]/g, '');
  if (!cleaned.endsWith('.mp3')) return `${cleaned}.mp3`;
  return cleaned;
}

function addPunctuationPauses(text: string) {
  return text
    .replace(/\s+/g, ' ')
    .replace(/([.!?])\s+/g, '$1\n')
    .replace(/([,;:])\s+/g, '$1  ')
    .trim();
}

/**
 * Fetches the admin-selected Nora voice from Firestore using the public
 * REST API + web API key (matching the client read in /admin/ai-voice).
 */
async function fetchAdminVoiceConfig(): Promise<AiVoiceConfig | null> {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!projectId || !apiKey) return null;

  try {
    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/app-config/ai-voice?key=${apiKey}`;
    const resp = await fetch(url);
    if (!resp.ok) return null;
    const doc = await resp.json();
    const fields = doc?.fields || {};
    const raw: Record<string, unknown> = {
      provider: fields.provider?.stringValue,
      voiceId: fields.voiceId?.stringValue,
      presetId: fields.presetId?.stringValue,
      punctuationPauses: fields.punctuationPauses?.booleanValue,
      updatedAt: fields.updatedAt?.integerValue
        ? Number(fields.updatedAt.integerValue)
        : undefined,
    };
    const settingsMap = fields.elevenLabsSettings?.mapValue?.fields;
    if (settingsMap) {
      raw.elevenLabsSettings = {
        stability: Number(settingsMap.stability?.doubleValue ?? settingsMap.stability?.integerValue ?? 0),
        similarityBoost: Number(settingsMap.similarityBoost?.doubleValue ?? settingsMap.similarityBoost?.integerValue ?? 0),
        style: Number(settingsMap.style?.doubleValue ?? settingsMap.style?.integerValue ?? 0),
        useSpeakerBoost: Boolean(settingsMap.useSpeakerBoost?.booleanValue),
        speed: Number(settingsMap.speed?.doubleValue ?? settingsMap.speed?.integerValue ?? 1),
      };
    }
    return normalizeAiVoiceConfig(raw as Partial<AiVoiceConfig>);
  } catch {
    return null;
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const body = (req.body || {}) as RequestBody;
  const { text, filename, dir = 'nora' } = body;

  if (!text || !text.trim()) return res.status(400).json({ error: 'Missing `text`' });
  if (!filename || !filename.trim()) return res.status(400).json({ error: 'Missing `filename`' });
  if (text.length > 2000) return res.status(400).json({ error: 'Text too long (max 2000 chars)' });

  const safeDir = sanitizeSegment(dir) || 'nora';
  const safeFilename = sanitizeFilename(filename);
  const targetDir = path.join(process.cwd(), 'public', 'audio', safeDir);
  const targetPath = path.join(targetDir, safeFilename);

  // Pull the admin-selected Nora voice config (may be null if unavailable).
  const adminConfig = await fetchAdminVoiceConfig();

  const provider = body.provider ?? adminConfig?.provider ?? 'elevenlabs';
  const voiceId = body.voice ?? adminConfig?.voiceId ?? '21m00Tcm4TlvDq8ikWAM';
  const presetId = body.presetId ?? adminConfig?.presetId ?? 'expressive';
  const punctuationPauses =
    typeof body.punctuationPauses === 'boolean'
      ? body.punctuationPauses
      : (adminConfig?.punctuationPauses ?? true);
  const voiceSettings: ElevenLabsVoiceSettings | null = shouldUseElevenLabsVoiceDefaults(presetId)
    ? null
    : normalizeElevenLabsSettings(
        body.settings ?? adminConfig?.elevenLabsSettings ?? undefined,
        presetId
      );

  let mp3: Buffer | null = null;
  let providerUsed: 'elevenlabs' | 'openai' = provider;
  let resolvedVia: 'local' | 'proxy' = 'local';

  const elevenLabsKey = process.env.ELEVEN_LABS_API_KEY;
  const openAiKey = process.env.OPEN_AI_SECRET_KEY;

  const synthesisText =
    provider === 'elevenlabs' && punctuationPauses ? addPunctuationPauses(text) : text;

  if (provider === 'elevenlabs' && elevenLabsKey) {
    const resp = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'xi-api-key': elevenLabsKey },
      body: JSON.stringify({
        text: synthesisText,
        model_id: 'eleven_multilingual_v2',
        output_format: 'mp3_44100_128',
        ...(voiceSettings
          ? {
              voice_settings: {
                stability: voiceSettings.stability,
                similarity_boost: voiceSettings.similarityBoost,
                style: voiceSettings.style,
                use_speaker_boost: voiceSettings.useSpeakerBoost,
                speed: voiceSettings.speed,
              },
            }
          : {}),
      }),
    });
    if (!resp.ok) {
      const detail = await resp.text();
      return res.status(502).json({
        error: 'ElevenLabs generation failed',
        status: resp.status,
        detail: detail.slice(0, 400),
      });
    }
    mp3 = Buffer.from(await resp.arrayBuffer());
  } else if (provider === 'openai' && openAiKey) {
    const resp = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${openAiKey}`,
      },
      body: JSON.stringify({
        model: 'tts-1-hd',
        input: text,
        voice: voiceId || 'nova',
        response_format: 'mp3',
      }),
    });
    if (!resp.ok) {
      const detail = await resp.text();
      return res.status(502).json({
        error: 'OpenAI TTS generation failed',
        status: resp.status,
        detail: detail.slice(0, 400),
      });
    }
    mp3 = Buffer.from(await resp.arrayBuffer());
    providerUsed = 'openai';
  } else {
    // Proxy to production deploy (which has the key) via the same
    // tts-mental-step function the admin regen buttons use.
    resolvedVia = 'proxy';
    const proxyBase = process.env.VOICE_PROXY_BASE || 'https://quickliftsapp.com';
    const resp = await fetch(`${proxyBase}/.netlify/functions/tts-mental-step`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        provider,
        voice: voiceId,
        format: 'mp3',
        presetId,
        settings: voiceSettings,
        punctuationPauses,
      }),
    });
    if (!resp.ok) {
      const detail = await resp.text();
      return res.status(502).json({
        error: 'Proxy to production tts-mental-step failed',
        status: resp.status,
        detail: detail.slice(0, 400),
      });
    }
    const contentType = resp.headers.get('content-type') || '';
    if (contentType.includes('audio')) {
      mp3 = Buffer.from(await resp.arrayBuffer());
    } else {
      // Netlify returns base64-encoded body when content-type is audio/mpeg
      // but some edge cases return JSON with base64.
      const payload: any = await resp.json().catch(() => null);
      if (payload?.audio) {
        mp3 = Buffer.from(payload.audio as string, 'base64');
      } else {
        return res.status(502).json({ error: 'Production TTS returned no audio' });
      }
    }
    providerUsed = provider;
  }

  if (!mp3) {
    return res.status(500).json({ error: 'No audio produced' });
  }

  await fs.mkdir(targetDir, { recursive: true });
  await fs.writeFile(targetPath, new Uint8Array(mp3.buffer, mp3.byteOffset, mp3.byteLength));

  const relPath = `/audio/${safeDir}/${safeFilename}`;
  return res.status(200).json({
    success: true,
    provider: providerUsed,
    voice: voiceId,
    presetId,
    resolvedVia,
    adminConfigApplied: Boolean(adminConfig && !body.voice && !body.provider),
    path: relPath,
    bytes: mp3.length,
  });
}
