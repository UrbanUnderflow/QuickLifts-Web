import {
  AiVoiceConfig,
  OPENAI_VOICES,
  VoiceChoice,
  normalizeAiVoiceConfig,
  normalizeElevenLabsSettings,
  shouldUseElevenLabsVoiceDefaults,
} from '../lib/aiVoice';

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

async function fetchGlobalVoiceIfNeeded() {
  if (typeof window === 'undefined') return;
  
  // If we already have a cached voice, use it
  if (cachedVoiceConfig) return;
  
  // If a fetch is in progress, wait for it
  if (voiceFetchInFlight) return voiceFetchInFlight;
  
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
        cachedVoiceConfig = normalizeAiVoiceConfig(snap.data() as any);
        console.log('[TTS] Loaded admin voice config:', cachedVoiceConfig);
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

  return voiceFetchInFlight;
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

async function speakViaNetlifyTTS(req: SpeakRequest, opts: SpeakOptions) {
  // Hit our Netlify function which uses OPEN_AI_SECRET_KEY server-side.
  const res = await fetch('/.netlify/functions/tts-mental-step', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
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
    cleanupAudio();
    opts.onError?.(e);
  };

  // iOS/Safari sometimes needs explicit play() catch handling
  await currentAudio.play();
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
  cachedVoiceConfig = null;
  lastFetchAttempt = 0;
  console.log('[TTS] Voice cache cleared');
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
  if (!clean) {
    opts.onEnd?.();
    return;
  }

  // If no explicit voiceChoice passed, use global admin-configured voice (when available).
  if (!voiceChoice) {
    await fetchGlobalVoiceIfNeeded();
    if (cachedVoiceConfig) {
      voiceChoice = cachedVoiceConfig.provider === 'elevenlabs'
        ? {
            provider: 'elevenlabs',
            id: cachedVoiceConfig.voiceId,
            label: cachedVoiceConfig.voiceId,
            presetId: cachedVoiceConfig.presetId || null,
            settings: cachedVoiceConfig.elevenLabsSettings || null,
            punctuationPauses: cachedVoiceConfig.punctuationPauses ?? true,
          }
        : {
            provider: 'openai',
            id: cachedVoiceConfig.voiceId,
            label: cachedVoiceConfig.voiceId,
          };
      console.log('[TTS] Using admin-configured voice:', cachedVoiceConfig);
    } else {
      console.log('[TTS] No admin voice configured, using default');
    }
  }

  const chosen = voiceChoice?.provider ? voiceChoice : OPENAI_VOICES[0];

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
    await speakViaNetlifyTTS(
      {
        text: clean,
        provider: chosen?.provider === 'elevenlabs' ? 'elevenlabs' : 'openai',
        voice: chosen?.id || 'alloy',
        format: 'mp3',
        presetId: chosen?.provider === 'elevenlabs' ? chosen.presetId || null : null,
        settings:
          chosen?.provider === 'elevenlabs'
            ? shouldUseElevenLabsVoiceDefaults(chosen.presetId, chosen.settings || undefined)
              ? null
              : normalizeElevenLabsSettings(chosen.settings || undefined, chosen.presetId)
            : null,
        punctuationPauses:
          chosen?.provider === 'elevenlabs'
            ? chosen.punctuationPauses ?? true
            : null,
      },
      opts
    );
  } catch (_err) {
    if (opts.fallbackToBrowser === false) {
      opts.onError?.(_err);
      return;
    }
    try {
      speakViaBrowserTTS(clean, opts);
    } catch (err2) {
      opts.onError?.(err2);
    }
  }
}
