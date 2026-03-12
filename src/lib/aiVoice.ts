export type AiVoiceProvider = 'openai' | 'elevenlabs';

export type ElevenLabsVoiceSettings = {
  stability: number;
  similarityBoost: number;
  style: number;
  useSpeakerBoost: boolean;
  speed: number;
};

export type AiVoiceConfig = {
  provider: AiVoiceProvider;
  voiceId: string;
  updatedAt: number;
  presetId?: string | null;
  elevenLabsSettings?: ElevenLabsVoiceSettings | null;
  punctuationPauses?: boolean | null;
};

export type VoiceChoice =
  | { provider: 'openai'; id: string; label: string }
  | { provider: 'browser'; id: string; label: string }
  | {
      provider: 'elevenlabs';
      id: string;
      label: string;
      presetId?: string | null;
      settings?: ElevenLabsVoiceSettings | null;
      punctuationPauses?: boolean | null;
    };

export type ElevenLabsPreset = {
  id: string;
  label: string;
  description: string;
  settings?: ElevenLabsVoiceSettings;
  useVoiceDefaults?: boolean;
};

export const OPENAI_VOICES: VoiceChoice[] = [
  { provider: 'openai', id: 'alloy', label: 'Nora (Alloy)' },
  { provider: 'openai', id: 'echo', label: 'Echo' },
  { provider: 'openai', id: 'fable', label: 'Fable' },
  { provider: 'openai', id: 'onyx', label: 'Onyx' },
  { provider: 'openai', id: 'nova', label: 'Nova' },
  { provider: 'openai', id: 'shimmer', label: 'Shimmer' },
];

export const ELEVENLABS_VOICES: VoiceChoice[] = [
  { provider: 'elevenlabs', id: '21m00Tcm4TlvDq8ikWAM', label: 'Rachel' },
  { provider: 'elevenlabs', id: 'EST9Ui6982FZPSi7gCHi', label: 'Elise' },
  { provider: 'elevenlabs', id: 'gJx1vCzNCD1EQHT212Ls', label: 'Ava' },
  { provider: 'elevenlabs', id: 'EXAVITQu4vr4xnSDxMaL', label: 'Bella' },
  { provider: 'elevenlabs', id: 'MF3mGyEYCl7XYWbV9V6O', label: 'Elli' },
  { provider: 'elevenlabs', id: 'XB0fDUnXU5powFXDhCwa', label: 'Charlotte' },
  { provider: 'elevenlabs', id: 'piTKgcLEGmPE4e6mEKli', label: 'Nicole' },
];

export const ELEVENLABS_PRESETS: ElevenLabsPreset[] = [
  {
    id: 'default',
    label: 'Default',
    description: 'Use the voice author’s native ElevenLabs defaults with no override.',
    useVoiceDefaults: true,
  },
  {
    id: 'grounded',
    label: 'Grounded',
    description: 'Stable and calm with light variation.',
    settings: {
      stability: 0.52,
      similarityBoost: 0.78,
      style: 0.28,
      useSpeakerBoost: true,
      speed: 0.96,
    },
  },
  {
    id: 'expressive',
    label: 'Expressive',
    description: 'More natural emphasis without sounding theatrical.',
    settings: {
      stability: 0.34,
      similarityBoost: 0.82,
      style: 0.65,
      useSpeakerBoost: true,
      speed: 0.94,
    },
  },
  {
    id: 'animated',
    label: 'Animated',
    description: 'Stronger inflection and more dramatic delivery.',
    settings: {
      stability: 0.24,
      similarityBoost: 0.8,
      style: 0.82,
      useSpeakerBoost: true,
      speed: 0.98,
    },
  },
];

export const DEFAULT_ELEVENLABS_PRESET_ID = 'expressive';

const clamp = (value: unknown, min = 0, max = 1, fallback = 0) => {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(max, Math.max(min, numeric));
};

export function getElevenLabsPreset(presetId?: string | null) {
  return (
    ELEVENLABS_PRESETS.find((preset) => preset.id === presetId) ||
    ELEVENLABS_PRESETS.find((preset) => preset.id === DEFAULT_ELEVENLABS_PRESET_ID) ||
    ELEVENLABS_PRESETS[0]
  );
}

export function normalizeElevenLabsSettings(
  settings?: Partial<ElevenLabsVoiceSettings> | null,
  presetId?: string | null
): ElevenLabsVoiceSettings {
  const fallback =
    getElevenLabsPreset(presetId).settings ||
    getElevenLabsPreset(DEFAULT_ELEVENLABS_PRESET_ID).settings || {
      stability: 0.34,
      similarityBoost: 0.82,
      style: 0.65,
      useSpeakerBoost: true,
      speed: 0.94,
    };

  return {
    stability: clamp(settings?.stability, 0, 1, fallback.stability),
    similarityBoost: clamp(settings?.similarityBoost, 0, 1, fallback.similarityBoost),
    style: clamp(settings?.style, 0, 1, fallback.style),
    useSpeakerBoost:
      typeof settings?.useSpeakerBoost === 'boolean'
        ? settings.useSpeakerBoost
        : fallback.useSpeakerBoost,
    speed: clamp(settings?.speed, 0.7, 1.2, fallback.speed),
  };
}

export function shouldUseElevenLabsVoiceDefaults(
  presetId?: string | null,
  settings?: Partial<ElevenLabsVoiceSettings> | null
) {
  const preset = getElevenLabsPreset(presetId);
  return Boolean(preset.useVoiceDefaults && !settings);
}

export function normalizeAiVoiceConfig(raw?: Partial<AiVoiceConfig> | null): AiVoiceConfig {
  const provider: AiVoiceProvider = raw?.provider === 'elevenlabs' ? 'elevenlabs' : 'openai';
  const defaultOpenAiVoice = OPENAI_VOICES[0]?.id || 'alloy';
  const defaultElevenLabsVoice = ELEVENLABS_VOICES[0]?.id || '21m00Tcm4TlvDq8ikWAM';
  const preset = getElevenLabsPreset(raw?.presetId);

  return {
    provider,
    voiceId:
      typeof raw?.voiceId === 'string' && raw.voiceId.trim()
        ? raw.voiceId.trim()
        : provider === 'elevenlabs'
          ? defaultElevenLabsVoice
          : defaultOpenAiVoice,
    updatedAt: typeof raw?.updatedAt === 'number' ? raw.updatedAt : Date.now(),
    presetId: provider === 'elevenlabs' ? raw?.presetId || preset.id : null,
    elevenLabsSettings:
      provider === 'elevenlabs'
        ? normalizeElevenLabsSettings(raw?.elevenLabsSettings || undefined, raw?.presetId || preset.id)
        : null,
    punctuationPauses:
      provider === 'elevenlabs'
        ? typeof raw?.punctuationPauses === 'boolean'
          ? raw.punctuationPauses
          : true
        : null,
  };
}
