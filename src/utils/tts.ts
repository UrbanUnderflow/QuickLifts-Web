import {
  AiVoiceConfig,
  OPENAI_VOICES,
  VoiceChoice,
  normalizeAiVoiceConfig,
  normalizeElevenLabsSettings,
  shouldUseElevenLabsVoiceDefaults,
} from '../lib/aiVoice';
import { resolvePulseCheckFunctionUrl } from '../api/firebase/mentaltraining/pulseCheckFunctionsUrl';

type SpeakOptions = {
  /** Called when narration finishes successfully */
  onEnd?: () => void;
  /** Called when narration errors */
  onError?: (err: unknown) => void;
  /** Disable browser speech fallback when exact provider fidelity matters */
  fallbackToBrowser?: boolean;
};

type SpeakRequest = {
  text: string;
  provider?: 'openai' | 'elevenlabs';
  voice?: string;
  format?: string;
  presetId?: string | null;
  settings?: {
    stability: number;
    similarityBoost: number;
    style: number;
    useSpeakerBoost: boolean;
    speed: number;
  } | null;
  punctuationPauses?: boolean | null;
};

export type { AiVoiceConfig, VoiceChoice };
export { OPENAI_VOICES };

let cachedVoiceConfig: AiVoiceConfig | null = null;
let voiceFetchInFlight: Promise<void> | null = null;
let lastFetchAttempt = 0;
const REFETCH_INTERVAL_MS = 5000; // Retry every 5 seconds if no voice was cached
const VOICE_CONFIG_STORAGE_KEY = 'pulsecheck-ai-voice-config';
const SILENT_PRIME_AUDIO_SRC = 'data:audio/wav;base64,UklGRkQDAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YSADAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==';

function cacheVoiceConfigLocally(config: AiVoiceConfig | null) {
  cachedVoiceConfig = config;
  if (typeof window === 'undefined') return;
  try {
    if (config) {
      window.localStorage.setItem(VOICE_CONFIG_STORAGE_KEY, JSON.stringify(config));
    } else {
      window.localStorage.removeItem(VOICE_CONFIG_STORAGE_KEY);
    }
  } catch {}
}

function hydrateVoiceConfigFromStorage() {
  if (typeof window === 'undefined' || cachedVoiceConfig) return cachedVoiceConfig;
  try {
    const raw = window.localStorage.getItem(VOICE_CONFIG_STORAGE_KEY);
    if (!raw) return null;
    const parsed = normalizeAiVoiceConfig(JSON.parse(raw) as Partial<AiVoiceConfig>);
    cachedVoiceConfig = parsed;
    return parsed;
  } catch {
    return null;
  }
}

export function persistVoiceConfig(config: Partial<AiVoiceConfig> | null | undefined) {
  if (!config) {
    cacheVoiceConfigLocally(null);
    return;
  }
  cacheVoiceConfigLocally(normalizeAiVoiceConfig(config));
}

async function fetchGlobalVoiceIfNeeded() {
  if (typeof window === 'undefined') return;
  
  // If we already have a cached voice, use it
  if (cachedVoiceConfig) return cachedVoiceConfig;
  const storedConfig = hydrateVoiceConfigFromStorage();
  if (storedConfig) return storedConfig;
  
  // If a fetch is in progress, wait for it
  if (voiceFetchInFlight) {
    await voiceFetchInFlight;
    return cachedVoiceConfig;
  }
  
  // Rate limit fetch attempts (prevents spamming if auth isn't ready)
  const now = Date.now();
  if (now - lastFetchAttempt < REFETCH_INTERVAL_MS) return;
  lastFetchAttempt = now;

  voiceFetchInFlight = (async () => {
    try {
      // Lazy import to avoid pulling firebase into initial bundles unless needed
      const { doc, getDoc } = await import('firebase/firestore');
      const { db } = await import('../api/firebase/config');
      const ref = doc(db, 'app-config', 'ai-voice');
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const normalized = normalizeAiVoiceConfig(snap.data() as any);
        cacheVoiceConfigLocally(normalized);
        console.log('[TTS] Loaded admin voice config:', normalized);
      } else {
        console.warn('[TTS] ai-voice config doc not found - using default voice');
      }
    } catch (err) {
      // If read fails (rules/env/auth not ready), allow retry on next call
      console.warn('[TTS] Failed to fetch voice config (will retry):', err);
      lastFetchAttempt = 0; // Allow immediate retry on next call
    } finally {
      voiceFetchInFlight = null;
    }
  })();

  await voiceFetchInFlight;
  const resolvedConfig: AiVoiceConfig | null = cachedVoiceConfig;
  console.log('[TTS] fetchGlobalVoiceIfNeeded resolved', {
    hasCachedVoice: Boolean(resolvedConfig),
    provider: (resolvedConfig as any)?.provider ?? null,
    voiceId: (resolvedConfig as any)?.voiceId ?? null,
  });
  return resolvedConfig;
}

export function getBrowserVoices(): VoiceChoice[] {
  if (typeof window === 'undefined') return [];
  const synth = window.speechSynthesis;
  if (!synth) return [];
  const voices = synth.getVoices?.() || [];
  return voices
    .filter((v) => v && v.name)
    .map((v) => ({
      provider: 'browser' as const,
      id: v.name,
      label: `${v.name}${v.lang ? ` (${v.lang})` : ''}`,
    }));
}

let currentAudio: HTMLAudioElement | null = null;
let currentObjectUrl: string | null = null;

function cleanupAudio() {
  if (currentAudio) {
    try {
      currentAudio.pause();
    } catch {}
    currentAudio.onended = null;
    currentAudio.onerror = null;
    currentAudio = null;
  }
  if (currentObjectUrl) {
    try {
      URL.revokeObjectURL(currentObjectUrl);
    } catch {}
    currentObjectUrl = null;
  }
}

function stopBrowserSpeech() {
  if (typeof window === 'undefined') return;
  const synth = window.speechSynthesis;
  if (!synth) return;
  try {
    synth.cancel();
  } catch {}
}

export function stopNarration() {
  cleanupAudio();
  stopBrowserSpeech();
}

export async function primeNarrationPlayback() {
  if (typeof window === 'undefined') return false;
  try {
    const audio = new Audio(SILENT_PRIME_AUDIO_SRC);
    audio.muted = true;
    (audio as HTMLAudioElement & { playsInline?: boolean }).playsInline = true;
    await audio.play();
    audio.pause();
    audio.currentTime = 0;
    console.log('[TTS] Narration playback primed', {
      currentTime: audio.currentTime,
      muted: audio.muted,
    });
    return true;
  } catch (error) {
    console.warn('[TTS] Failed to prime narration playback', error);
    return false;
  }
}

async function speakViaNetlifyTTS(req: SpeakRequest, opts: SpeakOptions) {
  console.log('[TTS] speakViaNetlifyTTS request', {
    provider: req.provider ?? null,
    voice: req.voice ?? null,
    presetId: req.presetId ?? null,
    punctuationPauses: req.punctuationPauses ?? null,
    textLength: req.text.length,
    previewText: req.text.slice(0, 80),
  });
  // Hit our Netlify function which uses OPEN_AI_SECRET_KEY server-side.
  const ttsUrl = resolvePulseCheckFunctionUrl('/.netlify/functions/tts-mental-step');
  console.log('[TTS] speakViaNetlifyTTS url', { ttsUrl });
  const res = await fetch(ttsUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });

  console.log('[TTS] speakViaNetlifyTTS response', {
    ok: res.ok,
    status: res.status,
    contentType: res.headers.get('content-type'),
  });

  if (!res.ok) throw new Error(`tts-mental-step failed: ${res.status}`);

  const contentType = res.headers.get('content-type') || '';
  if (!contentType.startsWith('audio/')) {
    // In case function returned JSON error but with 200 (shouldn’t)
    throw new Error('tts-mental-step returned non-audio content');
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);

  cleanupAudio();
  stopBrowserSpeech();

  currentObjectUrl = url;
  currentAudio = new Audio(url);
  currentAudio.onended = () => {
    cleanupAudio();
    opts.onEnd?.();
  };
  currentAudio.onerror = (e) => {
    console.warn('[TTS] audio element playback error', e);
    cleanupAudio();
    opts.onError?.(e);
  };

  // iOS/Safari sometimes needs explicit play() catch handling
  console.log('[TTS] attempting audio.play()');
  await currentAudio.play();
  console.log('[TTS] audio.play() resolved');
}

function speakViaBrowserTTS(text: string, opts: SpeakOptions, voiceName?: string) {
  if (typeof window === 'undefined') return;
  const synth = window.speechSynthesis;
  if (!synth) throw new Error('speechSynthesis not available');

  cleanupAudio();
  stopBrowserSpeech();

  const utter = new SpeechSynthesisUtterance(text);
  // “Nora-ish” defaults (can be tuned later)
  utter.rate = 1.02;
  utter.pitch = 1.0;
  utter.volume = 1.0;

  if (voiceName) {
    const voices = synth.getVoices?.() || [];
    const match = voices.find((v) => v.name === voiceName);
    if (match) utter.voice = match;
  }

  utter.onend = () => opts.onEnd?.();
  utter.onerror = (e) => opts.onError?.(e);
  synth.speak(utter);
}

/**
 * Clear the cached voice ID (useful for testing or when admin updates the voice).
 */
export function clearVoiceCache() {
  cacheVoiceConfigLocally(null);
  lastFetchAttempt = 0;
  console.log('[TTS] Voice cache cleared');
}

async function resolveVoiceChoiceSource(
  voiceChoice: VoiceChoice | null = null
): Promise<{ choice: VoiceChoice; source: 'explicit' | 'admin' | 'default' }> {
  if (voiceChoice?.provider) {
    console.log('[TTS] resolveVoiceChoiceSource explicit choice', voiceChoice);
    return { choice: voiceChoice, source: 'explicit' };
  }

  const adminVoice = await fetchGlobalVoiceIfNeeded();
  if (adminVoice) {
    console.log('[TTS] resolveVoiceChoiceSource admin voice', {
      provider: adminVoice.provider,
      voiceId: adminVoice.voiceId,
      presetId: adminVoice.presetId ?? null,
    });
    return {
      choice:
        adminVoice.provider === 'elevenlabs'
          ? {
              provider: 'elevenlabs',
              id: adminVoice.voiceId,
              label: adminVoice.voiceId,
              presetId: adminVoice.presetId || null,
              settings: adminVoice.elevenLabsSettings || null,
              punctuationPauses: adminVoice.punctuationPauses ?? true,
            }
          : {
              provider: 'openai',
              id: adminVoice.voiceId,
              label: adminVoice.voiceId,
            },
      source: 'admin',
    };
  }

  console.log('[TTS] resolveVoiceChoiceSource default voice', OPENAI_VOICES[0]);
  return { choice: OPENAI_VOICES[0], source: 'default' };
}

export async function getResolvedVoiceChoice(voiceChoice: VoiceChoice | null = null) {
  return (await resolveVoiceChoiceSource(voiceChoice)).choice;
}

export async function buildSpeakRequest(
  text: string,
  voiceChoice: VoiceChoice | null = null
): Promise<SpeakRequest> {
  const { choice } = await resolveVoiceChoiceSource(voiceChoice);
  const serverChoice = choice.provider === 'browser' ? OPENAI_VOICES[0] : choice;
  const request: SpeakRequest = {
    text: (text || '').trim(),
    provider: serverChoice.provider === 'elevenlabs' ? 'elevenlabs' : 'openai',
    voice: serverChoice.id || 'alloy',
    format: 'mp3',
    presetId: serverChoice.provider === 'elevenlabs' ? serverChoice.presetId || null : null,
    settings:
      serverChoice.provider === 'elevenlabs'
        ? shouldUseElevenLabsVoiceDefaults(serverChoice.presetId, serverChoice.settings || undefined)
          ? null
          : normalizeElevenLabsSettings(serverChoice.settings || undefined, serverChoice.presetId)
        : null,
    punctuationPauses:
      serverChoice.provider === 'elevenlabs'
        ? serverChoice.punctuationPauses ?? true
        : null,
  };
  console.log('[TTS] buildSpeakRequest', request);
  return request;
}

/**
 * Narrate a step. Prefers server TTS (OpenAI) when configured, falls back to browser speech synthesis.
 */
export async function speakStep(
  text: string,
  opts: SpeakOptions = {},
  voiceChoice: VoiceChoice | null = null
) {
  const clean = (text || '').trim();
  console.log('[TTS] speakStep invoked', {
    textLength: clean.length,
    previewText: clean.slice(0, 80),
    fallbackToBrowser: opts.fallbackToBrowser ?? true,
    explicitVoiceChoice: voiceChoice ?? null,
  });
  if (!clean) {
    opts.onEnd?.();
    return;
  }

  const { choice: chosen, source } = await resolveVoiceChoiceSource(voiceChoice);
  if (source === 'admin') {
    console.log('[TTS] Using admin-configured voice:', chosen);
  } else if (source === 'default') {
    console.log('[TTS] No admin voice configured, using default');
  }

  // If they explicitly chose a browser voice, use it directly.
  if (chosen?.provider === 'browser') {
    try {
      speakViaBrowserTTS(clean, opts, chosen.id);
      return;
    } catch (err) {
      opts.onError?.(err);
      return;
    }
  }

  // Otherwise prefer OpenAI TTS, fallback to browser speech.
  try {
    await speakViaNetlifyTTS(await buildSpeakRequest(clean, chosen), opts);
  } catch (_err) {
    const shouldForceExactVoice = source !== 'default';
    console.warn('[TTS] speakStep primary TTS failed', {
      error: _err,
      source,
      chosen,
      shouldForceExactVoice,
      fallbackToBrowser: opts.fallbackToBrowser ?? true,
    });
    if (opts.fallbackToBrowser === false || shouldForceExactVoice) {
      opts.onError?.(_err);
      return;
    }
    try {
      console.log('[TTS] falling back to browser speech synthesis');
      speakViaBrowserTTS(clean, opts);
    } catch (err2) {
      console.warn('[TTS] browser speech fallback failed', err2);
      opts.onError?.(err2);
    }
  }
}
