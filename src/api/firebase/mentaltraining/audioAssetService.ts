import { db, storage } from '../config';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { SIM_AUDIO_ASSETS_COLLECTION } from './collections';
import type { SimVariantArchetype, SimVariantRecord } from './variantRegistryService';

export interface SimAudioAssetRef {
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
}

interface AudioCueTemplate {
  cueKey: string;
  label: string;
  prompt: string;
  durationSeconds: number;
  loop?: boolean;
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function hashString(input: string) {
  let hash = 5381;
  for (let index = 0; index < input.length; index += 1) {
    hash = ((hash << 5) + hash) ^ input.charCodeAt(index);
  }
  return (hash >>> 0).toString(16);
}

function getVariantArchetype(record: SimVariantRecord): SimVariantArchetype {
  return (record.archetypeOverride ?? record.runtimeConfig?.archetype ?? 'baseline') as SimVariantArchetype;
}

function buildCueTemplates(record: SimVariantRecord): AudioCueTemplate[] {
  const engineKey = record.engineKey ?? (
    record.family === 'Reset' ? 'reset'
      : record.family === 'Noise Gate' ? 'noise_gate'
        : null
  );
  const archetype = getVariantArchetype(record);
  if (!engineKey || !['audio_channel', 'combined_channel'].includes(archetype)) {
    return [];
  }

  if (engineKey === 'reset') {
    return [
      {
        cueKey: 'crowd_surge',
        label: 'Crowd Surge',
        prompt: 'A sudden realistic sports crowd surge in a packed arena, short and intense, no music, no speech, game-ready sound effect.',
        durationSeconds: 4,
      },
      {
        cueKey: 'whistle_blast',
        label: 'Whistle Blast',
        prompt: 'A sharp referee whistle blast in a loud indoor sports arena, crisp, urgent, no music, no speech.',
        durationSeconds: 2,
      },
      {
        cueKey: 'buzzer_shock',
        label: 'Buzzer Shock',
        prompt: 'A harsh basketball or shot-clock buzzer hit, short, urgent, competitive sports sound effect, no music.',
        durationSeconds: 2,
      },
      {
        cueKey: 'startle_cue',
        label: 'Startle Cue',
        prompt: 'A sudden startle-like arena cue or crowd sting, brief and disruptive, sports-safe, no music, no speech.',
        durationSeconds: 2,
      },
    ];
  }

  return [
    {
      cueKey: 'crowd_bed',
      label: 'Crowd Bed',
      prompt: 'A looping sports crowd bed in a live arena, moderate intensity, no announcer call, no music.',
      durationSeconds: 5,
      loop: true,
    },
    {
      cueKey: 'commentary_overlap',
      label: 'Commentary Overlap',
      prompt: 'Short overlapping sports commentary crowd chatter, distracting but not intelligible, no music.',
      durationSeconds: 4,
    },
    {
      cueKey: 'whistle_blast',
      label: 'Whistle Blast',
      prompt: 'A sharp referee whistle blast in a busy sports environment, clean and attention-grabbing.',
      durationSeconds: 2,
    },
    {
      cueKey: 'buzzer_shock',
      label: 'Buzzer Shock',
      prompt: 'A loud arena buzzer shock cue for competitive play, short and urgent, no music.',
      durationSeconds: 2,
    },
  ];
}

function buildAssetDocId(record: SimVariantRecord, cue: AudioCueTemplate) {
  const engineKey = record.engineKey ?? slugify(record.family);
  return `sfx-${engineKey}-${cue.cueKey}-${hashString(cue.prompt)}`;
}

function base64ToBlob(base64: string, contentType: string) {
  const binary = typeof window !== 'undefined' ? window.atob(base64) : Buffer.from(base64, 'base64').toString('binary');
  const length = binary.length;
  const bytes = new Uint8Array(length);
  for (let index = 0; index < length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new Blob([bytes], { type: contentType });
}

async function generateCueAudio(cue: AudioCueTemplate) {
  const response = await fetch('/api/mentaltraining/generate-sfx', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt: cue.prompt,
      durationSeconds: cue.durationSeconds,
      loop: cue.loop ?? false,
    }),
  });

  const payload = await response.json();
  if (!response.ok || !payload?.audio) {
    throw new Error(payload?.error || 'Failed to generate sound effect');
  }

  return {
    base64Audio: payload.audio as string,
    format: (payload.format ?? 'mp3') as 'mp3',
    contentType: (payload.contentType ?? 'audio/mpeg') as string,
    provider: 'elevenlabs' as const,
  };
}

async function storeGeneratedCue(record: SimVariantRecord, cue: AudioCueTemplate): Promise<SimAudioAssetRef> {
  const assetId = buildAssetDocId(record, cue);
  const generated = await generateCueAudio(cue);
  const blob = base64ToBlob(generated.base64Audio, generated.contentType);
  const storagePath = `sim-audio-assets/${slugify(record.family)}/${cue.cueKey}/${assetId}.${generated.format}`;
  const storageRef = ref(storage, storagePath);
  const snapshot = await uploadBytes(storageRef, blob, {
    contentType: generated.contentType,
    customMetadata: {
      cueKey: cue.cueKey,
      family: record.family,
      variant: record.name,
    },
  });
  const downloadURL = await getDownloadURL(snapshot.ref);
  const gsUrl = `gs://${snapshot.ref.bucket}/${snapshot.ref.fullPath}`;
  const now = Date.now();
  const assetRecord: SimAudioAssetRef = {
    id: assetId,
    cueKey: cue.cueKey,
    label: cue.label,
    prompt: cue.prompt,
    provider: generated.provider,
    format: generated.format,
    contentType: generated.contentType,
    storagePath,
    gsUrl,
    downloadURL,
    createdAt: now,
    updatedAt: now,
  };
  await setDoc(doc(db, SIM_AUDIO_ASSETS_COLLECTION, assetId), {
    ...assetRecord,
    family: record.family,
    engineKey: record.engineKey ?? null,
    archetype: getVariantArchetype(record),
  });
  return assetRecord;
}

async function resolveCueAsset(record: SimVariantRecord, cue: AudioCueTemplate): Promise<SimAudioAssetRef> {
  const assetId = buildAssetDocId(record, cue);
  const assetSnap = await getDoc(doc(db, SIM_AUDIO_ASSETS_COLLECTION, assetId));
  if (assetSnap.exists()) {
    return assetSnap.data() as SimAudioAssetRef;
  }
  return storeGeneratedCue(record, cue);
}

export async function resolveVariantAudioAssets(record: SimVariantRecord): Promise<SimVariantRecord> {
  const templates = buildCueTemplates(record);
  if (templates.length === 0) return record;

  const existingAssets = (record.runtimeConfig?.audioAssets ?? {}) as Record<string, SimAudioAssetRef>;
  const resolvedEntries = await Promise.all(templates.map(async (cue) => {
    if (existingAssets[cue.cueKey]?.downloadURL) {
      return [cue.cueKey, existingAssets[cue.cueKey]] as const;
    }
    try {
      const resolved = await resolveCueAsset(record, cue);
      return [cue.cueKey, resolved] as const;
    } catch (error: any) {
      console.warn(
        `[audioAssetService] Failed to resolve audio cue "${cue.cueKey}" for ${record.name}. Falling back to synthetic runtime audio.`,
        error?.message || error
      );
      return null;
    }
  }));

  const audioAssets = Object.fromEntries(
    resolvedEntries.filter((entry): entry is readonly [string, SimAudioAssetRef] => Boolean(entry))
  );
  return {
    ...record,
    runtimeConfig: {
      ...(record.runtimeConfig ?? {}),
      audioAssets: {
        ...existingAssets,
        ...audioAssets,
      },
    },
  };
}
