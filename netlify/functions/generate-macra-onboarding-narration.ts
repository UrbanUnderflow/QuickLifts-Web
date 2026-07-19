import type { Handler } from '@netlify/functions';
import { randomUUID } from 'crypto';
import { admin, db, headers as corsHeaders } from './config/firebase';
import {
  normalizeAiVoiceConfig,
  normalizeElevenLabsSettings,
  shouldUseElevenLabsVoiceDefaults,
} from '../../src/lib/aiVoice';
import type { AiVoiceConfig, ElevenLabsVoiceSettings } from '../../src/lib/aiVoice';

type RequestBody = {
  stepId?: string;
  text?: string;
};

type StoredNarrationAsset = {
  id: string;
  cueKey: string;
  label: string;
  prompt: string;
  provider: 'elevenlabs';
  format: 'mp3';
  contentType: string;
  storagePath: string;
  gsUrl: string;
  downloadURL: string;
  createdAt: number;
  updatedAt: number;
};

const CONFIG_COLLECTION = 'app-config';
const CONFIG_DOC_ID = 'ai-voice';
const NARRATION_FIELD = 'macraOnboardingNarrations';
const ENGINE_KEY = 'macra-onboarding';
const DEFAULT_ELEVENLABS_VOICE_ID = '21m00Tcm4TlvDq8ikWAM';
const DEFAULT_ELEVENLABS_PRESET_ID = 'expressive';
const DEFAULT_STORAGE_BUCKET = 'quicklifts-dd3f1.appspot.com';
const MAX_TEXT_LENGTH = 800;

function json(statusCode: number, body: unknown) {
  return {
    statusCode,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  };
}

function getHeader(headers: Record<string, string | undefined>, name: string): string | undefined {
  const direct = headers[name];
  if (direct) return direct;
  const key = Object.keys(headers).find((candidate) => candidate.toLowerCase() === name.toLowerCase());
  return key ? headers[key] : undefined;
}

async function verifyUserId(eventHeaders: Record<string, string | undefined>) {
  const authHeader = getHeader(eventHeaders, 'authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;

  try {
    const decoded = await admin.auth().verifyIdToken(authHeader.slice('Bearer '.length));
    return decoded.uid || null;
  } catch {
    return null;
  }
}

function addPunctuationPauses(text: string) {
  return text
    .replace(/\s+/g, ' ')
    .replace(/([.!?])\s+/g, '$1\n')
    .replace(/([,;:])\s+/g, '$1  ')
    .trim();
}

function slugify(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function sanitizeCueKey(value: string) {
  return value.trim().replace(/[^a-zA-Z0-9_-]/g, '_').replace(/^_+|_+$/g, '');
}

function hashString(input: string) {
  let hash = 5381;
  for (let index = 0; index < input.length; index += 1) {
    hash = ((hash << 5) + hash) ^ input.charCodeAt(index);
  }
  return (hash >>> 0).toString(16);
}

function buildGeneratedDocId(engineKey: string, cueKey: string, prompt: string) {
  return `sfx-${slugify(engineKey)}-${cueKey}-${hashString(prompt)}`;
}

function buildAssetLabel(cueKey: string) {
  return cueKey
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function storageBucketName() {
  return process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
    || process.env.FIREBASE_STORAGE_BUCKET
    || DEFAULT_STORAGE_BUCKET;
}

function downloadUrlForStoragePath(bucketName: string, storagePath: string, token: string) {
  return `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(storagePath)}?alt=media&token=${token}`;
}

async function loadConfigSnapshot() {
  return db.collection(CONFIG_COLLECTION).doc(CONFIG_DOC_ID).get();
}

function normalizeStoredNarrationAsset(value: unknown): StoredNarrationAsset | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<StoredNarrationAsset>;
  if (!candidate.downloadURL || !candidate.prompt) return null;
  return candidate as StoredNarrationAsset;
}

function existingAssetForStep(configData: Record<string, any> | undefined, cueKey: string, text: string) {
  const rawAssets = (configData?.[NARRATION_FIELD] ?? {}) as Record<string, unknown>;
  const existing = normalizeStoredNarrationAsset(rawAssets[cueKey]);
  if (existing?.downloadURL && existing.prompt === text) {
    return existing;
  }
  return null;
}

function voiceResolution(configData: Record<string, any> | undefined) {
  const voiceConfig = configData
    ? normalizeAiVoiceConfig(configData as Partial<AiVoiceConfig>)
    : null;
  const shouldUseConfiguredElevenLabsVoice = voiceConfig?.provider === 'elevenlabs';
  const voiceId = shouldUseConfiguredElevenLabsVoice && (voiceConfig?.elevenLabsVoiceId || voiceConfig?.voiceId)
    ? (voiceConfig.elevenLabsVoiceId || voiceConfig.voiceId)
    : DEFAULT_ELEVENLABS_VOICE_ID;
  const presetId = shouldUseConfiguredElevenLabsVoice
    ? voiceConfig?.presetId || DEFAULT_ELEVENLABS_PRESET_ID
    : DEFAULT_ELEVENLABS_PRESET_ID;
  const punctuationPauses = shouldUseConfiguredElevenLabsVoice
    ? voiceConfig?.punctuationPauses ?? true
    : true;
  const settings: ElevenLabsVoiceSettings | null = shouldUseElevenLabsVoiceDefaults(
    presetId,
    shouldUseConfiguredElevenLabsVoice ? voiceConfig?.elevenLabsSettings || undefined : undefined
  )
    ? null
    : normalizeElevenLabsSettings(
        shouldUseConfiguredElevenLabsVoice ? voiceConfig?.elevenLabsSettings || undefined : undefined,
        presetId
      );

  return { voiceId, presetId, punctuationPauses, settings };
}

async function synthesizeElevenLabsAudio(text: string, configData: Record<string, any> | undefined) {
  const elevenLabsKey = process.env.ELEVEN_LABS_API_KEY;
  if (!elevenLabsKey) {
    throw new Error('ElevenLabs is not configured');
  }

  const { voiceId, presetId, punctuationPauses, settings } = voiceResolution(configData);
  const synthesisText = punctuationPauses ? addPunctuationPauses(text) : text;
  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?optimize_streaming_latency=2`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': elevenLabsKey,
      },
      body: JSON.stringify({
        text: synthesisText,
        model_id: 'eleven_multilingual_v2',
        output_format: 'mp3_44100_128',
        ...(settings
          ? {
              voice_settings: {
                stability: settings.stability,
                similarity_boost: settings.similarityBoost,
                style: settings.style,
                use_speaker_boost: settings.useSpeakerBoost,
                speed: settings.speed,
              },
            }
          : {}),
      }),
    }
  );

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    const error = new Error('ElevenLabs narration generation failed');
    (error as Error & { status?: number; detail?: string }).status = response.status;
    (error as Error & { status?: number; detail?: string }).detail = detail.slice(0, 300);
    throw error;
  }

  return {
    audio: Buffer.from(await response.arrayBuffer()),
    voiceId,
    presetId,
  };
}

async function storeNarrationAsset(cueKey: string, text: string, audio: Buffer) {
  const bucketName = storageBucketName();
  const bucket = admin.storage().bucket(bucketName);
  const assetId = buildGeneratedDocId(ENGINE_KEY, cueKey, text);
  const storagePath = `sim-audio-assets/${slugify(ENGINE_KEY)}/${cueKey}/${assetId}.mp3`;
  const downloadToken = randomUUID();
  const file = bucket.file(storagePath);
  const now = Date.now();

  await file.save(audio, {
    resumable: false,
    metadata: {
      contentType: 'audio/mpeg',
      cacheControl: 'public, max-age=31536000',
      metadata: {
        firebaseStorageDownloadTokens: downloadToken,
        app: 'macra',
        cueKey,
        engineKey: ENGINE_KEY,
      },
    },
  });

  const asset: StoredNarrationAsset = {
    id: assetId,
    cueKey,
    label: buildAssetLabel(cueKey),
    prompt: text,
    provider: 'elevenlabs',
    format: 'mp3',
    contentType: 'audio/mpeg',
    storagePath,
    gsUrl: `gs://${bucketName}/${storagePath}`,
    downloadURL: downloadUrlForStoragePath(bucketName, storagePath, downloadToken),
    createdAt: now,
    updatedAt: now,
  };

  await db.collection('sim-audio-assets').doc(assetId).set({
    ...asset,
    family: ENGINE_KEY,
    engineKey: ENGINE_KEY,
    archetype: 'voice_channel',
    app: 'macra',
    generatedBy: 'ios_missing_asset_fallback',
  });

  await db.collection(CONFIG_COLLECTION).doc(CONFIG_DOC_ID).set({
    [NARRATION_FIELD]: {
      [cueKey]: asset,
    },
    updatedAt: now,
  }, { merge: true });

  return asset;
}

export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method not allowed' });
  }

  const userId = await verifyUserId(event.headers || {});
  if (!userId) {
    return json(401, { error: 'Authentication required' });
  }

  let body: RequestBody;
  try {
    body = event.body ? JSON.parse(event.body) : {};
  } catch {
    return json(400, { error: 'Invalid JSON body' });
  }

  const cueKey = typeof body.stepId === 'string' ? sanitizeCueKey(body.stepId) : '';
  const text = typeof body.text === 'string' ? body.text.trim() : '';
  if (!cueKey) {
    return json(400, { error: 'Missing stepId' });
  }
  if (!text) {
    return json(400, { error: 'Missing text' });
  }
  if (text.length > MAX_TEXT_LENGTH) {
    return json(400, { error: `Text too long. Max ${MAX_TEXT_LENGTH} characters.` });
  }

  try {
    const configSnapshot = await loadConfigSnapshot();
    const configData = configSnapshot.data();
    const existing = existingAssetForStep(configData, cueKey, text);
    if (existing) {
      return json(200, { asset: existing, created: false });
    }

    const generated = await synthesizeElevenLabsAudio(text, configData);
    const asset = await storeNarrationAsset(cueKey, text, generated.audio);
    return json(200, {
      asset,
      created: true,
      provider: 'elevenlabs',
      voice: generated.voiceId,
      presetId: generated.presetId,
    });
  } catch (error) {
    console.error('[generate-macra-onboarding-narration] failed', {
      stepId: cueKey,
      userId,
      message: error instanceof Error ? error.message : String(error),
      status: (error as Error & { status?: number }).status || null,
      detail: (error as Error & { detail?: string }).detail || null,
    });
    const message = error instanceof Error && error.message === 'ElevenLabs is not configured'
      ? 'ElevenLabs is not configured'
      : 'Macra onboarding narration generation failed';
    return json(message === 'ElevenLabs is not configured' ? 503 : 502, { error: message });
  }
};
