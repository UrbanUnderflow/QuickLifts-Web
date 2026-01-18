type SpeakOptions = {
  /** Called when narration finishes successfully */
  onEnd?: () => void;
  /** Called when narration errors */
  onError?: (err: unknown) => void;
};

type SpeakRequest = {
  text: string;
  voice?: string;
  format?: string;
};

export type VoiceChoice =
  | { provider: 'openai'; id: string; label: string }
  | { provider: 'browser'; id: string; label: string };

export const OPENAI_VOICES: VoiceChoice[] = [
  { provider: 'openai', id: 'alloy', label: 'Nora (Alloy)' },
  { provider: 'openai', id: 'echo', label: 'Echo' },
  { provider: 'openai', id: 'fable', label: 'Fable' },
  { provider: 'openai', id: 'onyx', label: 'Onyx' },
  { provider: 'openai', id: 'nova', label: 'Nova' },
  { provider: 'openai', id: 'shimmer', label: 'Shimmer' },
];

let cachedOpenAiVoiceId: string | null = null;
let voiceFetchInFlight: Promise<void> | null = null;
let lastFetchAttempt = 0;
const REFETCH_INTERVAL_MS = 5000; // Retry every 5 seconds if no voice was cached

async function fetchGlobalVoiceIfNeeded() {
  if (typeof window === 'undefined') return;
  
  // If we already have a cached voice, use it
  if (cachedOpenAiVoiceId) return;
  
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
      // eslint-disable-next-line import/no-cycle
      const { db } = await import('../api/firebase/config');
      const ref = doc(db, 'app-config', 'ai-voice');
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const data = snap.data() as any;
        if (typeof data?.voiceId === 'string' && data.voiceId.trim()) {
          cachedOpenAiVoiceId = data.voiceId.trim();
          console.log('[TTS] Loaded admin voice config:', cachedOpenAiVoiceId);
        } else {
          console.warn('[TTS] ai-voice doc exists but voiceId is missing or empty');
        }
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
      // eslint-disable-next-line no-empty
    } catch {}
    currentAudio.onended = null;
    currentAudio.onerror = null;
    currentAudio = null;
  }
  if (currentObjectUrl) {
    try {
      URL.revokeObjectURL(currentObjectUrl);
      // eslint-disable-next-line no-empty
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
    // eslint-disable-next-line no-empty
  } catch {}
}

export function stopNarration() {
  cleanupAudio();
  stopBrowserSpeech();
}

async function speakViaNetlifyTTS(req: SpeakRequest, opts: SpeakOptions) {
  // Hit our Netlify function which uses OPENAI_API_KEY server-side.
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
  cachedOpenAiVoiceId = null;
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
    if (cachedOpenAiVoiceId) {
      voiceChoice = { provider: 'openai', id: cachedOpenAiVoiceId, label: cachedOpenAiVoiceId };
      console.log('[TTS] Using admin-configured voice:', cachedOpenAiVoiceId);
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
        voice: chosen?.provider === 'openai' ? chosen.id : 'alloy',
        format: 'mp3',
      },
      opts
    );
  } catch (err) {
    try {
      speakViaBrowserTTS(clean, opts);
    } catch (err2) {
      opts.onError?.(err2);
    }
  }
}

