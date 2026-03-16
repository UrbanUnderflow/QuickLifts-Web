import React, { useEffect, useMemo, useRef, useState } from 'react';
import Head from 'next/head';
import AdminRouteGuard from '../../components/auth/AdminRouteGuard';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mic2, Play, Square, Save, Info, RefreshCw, Sparkles,
  SlidersHorizontal, Volume2, VolumeX, Music, Bell,
  Smartphone, Zap, CheckCircle, MessageSquare, ChevronDown, ChevronUp,
  Loader2, Wand2, RotateCcw, Eye,
} from 'lucide-react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage';
import { db, storage } from '../../api/firebase/config';
import type { SimAudioAssetRef } from '../../api/firebase/mentaltraining/audioAssetService';
import { clearVoiceCache, speakStep, stopNarration } from '../../utils/tts';
import {
  AiVoiceConfig,
  ELEVENLABS_PRESETS,
  ELEVENLABS_VOICES,
  ElevenLabsVoiceSettings,
  OPENAI_VOICES,
  VoiceChoice,
  getElevenLabsPreset,
  normalizeAiVoiceConfig,
  normalizeElevenLabsSettings,
  shouldUseElevenLabsVoiceDefaults,
} from '../../lib/aiVoice';

// ──────────────────────────────────────────────────────────
// CONSTANTS
// ──────────────────────────────────────────────────────────
const CONFIG_COLLECTION = 'app-config';
const CONFIG_DOC_ID = 'ai-voice';

const sampleScripts = [
  "You're safe. Let your shoulders drop. Find one point and stay with it.",
  'Notice the urge to rush. Slow down by 5%. Precision over panic.',
  "If your mind wanders, that's the rep. Return to the target calmly.",
];

// All Pulse Community app sound effects + PulseCheck sounds
const SOUND_EFFECTS: {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  category: 'splash' | 'celebration' | 'workout' | 'notification' | 'ui' | 'pulsecheck';
  file: string;    // path relative to /audio/ or iOS bundle name
  platform: 'community' | 'pulsecheck' | 'both';
}[] = [
  // ── PulseCheck
  {
    id: 'pc-splash',
    label: 'PulseCheck Splash',
    description: 'Plays on app launch for mental focus. Soothing, mindful tone.',
    icon: <Smartphone className="w-4 h-4" />,
    category: 'splash',
    file: 'pulse-splash',
    platform: 'pulsecheck',
  },
  {
    id: 'pc-mind-coach',
    label: 'Mind Coach Greeting',
    description: 'Plays when Nora first speaks or a new session begins.',
    icon: <MessageSquare className="w-4 h-4" />,
    category: 'pulsecheck',
    file: 'mind-coach-greeting',
    platform: 'pulsecheck',
  },
  {
    id: 'pc-action-card',
    label: 'Action Card Appear',
    description: 'Subtle chime when a new mental training card enters the screen.',
    icon: <Zap className="w-4 h-4" />,
    category: 'pulsecheck',
    file: 'action-card-appear',
    platform: 'pulsecheck',
  },
  {
    id: 'pc-message-received',
    label: 'Message Received',
    description: 'Nora chat notification — incoming response.',
    icon: <Bell className="w-4 h-4" />,
    category: 'notification',
    file: 'message-received',
    platform: 'pulsecheck',
  },
  {
    id: 'pc-message-sent',
    label: 'Message Sent',
    description: 'Soft confirmation when user sends a message.',
    icon: <MessageSquare className="w-4 h-4" />,
    category: 'ui',
    file: 'message-sent',
    platform: 'pulsecheck',
  },
  {
    id: 'pc-breathing-gong',
    label: 'Breathing Gong',
    description: 'Used in breathing and focus exercises. Bowl gong resonance.',
    icon: <Music className="w-4 h-4" />,
    category: 'pulsecheck',
    file: 'breathing-gong',
    platform: 'pulsecheck',
  },
  {
    id: 'pc-success-chime',
    label: 'Success Chime',
    description: 'Baseline completed or mental task achieved.',
    icon: <CheckCircle className="w-4 h-4" />,
    category: 'celebration',
    file: 'success-chime',
    platform: 'pulsecheck',
  },
  {
    id: 'pc-subtle-click',
    label: 'Subtle Click',
    description: 'Generic UI interaction tap sound.',
    icon: <Zap className="w-4 h-4" />,
    category: 'ui',
    file: 'subtle-click',
    platform: 'pulsecheck',
  },

  // ── Pulse Community App
  {
    id: 'community-pulse-beat',
    label: 'Pulse Beat',
    description: 'The signature Pulse community heartbeat. Plays on app splash/launch.',
    icon: <Smartphone className="w-4 h-4" />,
    category: 'splash',
    file: 'PulseBeat1',
    platform: 'community',
  },
  {
    id: 'community-big-celebration',
    label: 'Big Celebration',
    description: 'Major achievement — round completion, personal record.',
    icon: <Sparkles className="w-4 h-4" />,
    category: 'celebration',
    file: 'bigCelebration',
    platform: 'community',
  },
  {
    id: 'community-medium-celebration',
    label: 'Medium Celebration',
    description: 'Mid-level win — streak, milestone, leaderboard move.',
    icon: <Sparkles className="w-4 h-4" />,
    category: 'celebration',
    file: 'mediumCelebration',
    platform: 'community',
  },
  {
    id: 'community-mini-celebration',
    label: 'Mini Celebration',
    description: 'Small win confirmation — exercise complete, rep logged.',
    icon: <CheckCircle className="w-4 h-4" />,
    category: 'celebration',
    file: 'miniCelebration',
    platform: 'community',
  },
  {
    id: 'community-success',
    label: 'Success',
    description: 'General success event — workout saved, check-in submitted.',
    icon: <CheckCircle className="w-4 h-4" />,
    category: 'celebration',
    file: 'success',
    platform: 'community',
  },
  {
    id: 'community-great-job',
    label: 'Great Job',
    description: 'Congratulatory voice line — halfway point or final rep.',
    icon: <Volume2 className="w-4 h-4" />,
    category: 'workout',
    file: 'greatJob',
    platform: 'community',
  },
  {
    id: 'community-checkin',
    label: 'Check-in Chime',
    description: 'Fires when an athlete checks into a session or round.',
    icon: <Bell className="w-4 h-4" />,
    category: 'notification',
    file: 'chekin',
    platform: 'community',
  },
  {
    id: 'community-start-clock',
    label: 'Start Clock',
    description: 'Beep sequence marking the beginning of a timed set.',
    icon: <Play className="w-4 h-4" />,
    category: 'workout',
    file: 'startClock',
    platform: 'community',
  },
  {
    id: 'community-half-way',
    label: 'Halfway There',
    description: 'Audible cue at 50% through a timed exercise.',
    icon: <Volume2 className="w-4 h-4" />,
    category: 'workout',
    file: 'half-way-there',
    platform: 'community',
  },
  {
    id: 'community-10s-left',
    label: '10 Seconds Left',
    description: 'Countdown warning — 10 seconds remaining in a set.',
    icon: <Volume2 className="w-4 h-4" />,
    category: 'workout',
    file: '10-seconds-left',
    platform: 'community',
  },
  {
    id: 'community-5s-left',
    label: '5 Seconds Left',
    description: 'Urgent countdown — 5 seconds remaining in a set.',
    icon: <Volume2 className="w-4 h-4" />,
    category: 'workout',
    file: '5-seconds-left',
    platform: 'community',
  },
  {
    id: 'community-completion',
    label: 'Completion',
    description: 'End-of-set completion tone.',
    icon: <CheckCircle className="w-4 h-4" />,
    category: 'workout',
    file: 'Completion1',
    platform: 'community',
  },
  {
    id: 'community-chain-reaction',
    label: 'Chain Reaction',
    description: 'Plays when a cascade/combo event occurs in a round.',
    icon: <Sparkles className="w-4 h-4" />,
    category: 'celebration',
    file: 'chain_reaction',
    platform: 'community',
  },
];

const CATEGORY_LABELS: Record<string, string> = {
  splash: 'Splash & Launch',
  celebration: 'Celebrations',
  workout: 'Workout Cues',
  notification: 'Notifications',
  ui: 'UI Interactions',
  pulsecheck: 'Mental Training',
};

const CATEGORY_ORDER = ['splash', 'pulsecheck', 'celebration', 'workout', 'notification', 'ui'];

// ──────────────────────────────────────────────────────────
// VISION PRO RESET — IMMERSIVE SOUND CUES
// Dynamically generated via ElevenLabs and stored in Firebase.
// These are spatial SFX tied to trial stage transitions in the
// visionOS immersive space, NOT static files from /public/audio.
// ──────────────────────────────────────────────────────────

const VP_ENGINE_KEY = 'vision-pro-reset';

interface VPCueDef {
  cueKey: string;
  label: string;
  description: string;
  stageTag: 'lockIn' | 'disruption' | 'recovery' | 'tap' | 'transition';
  prompt: string;
  durationSeconds: number;
}

const VP_RESET_CUES: VPCueDef[] = [
  {
    cueKey: 'lockInAmbientDrone',
    label: 'Lock-In Drone',
    description: 'Ambient void hum during the pre-tap orb focus phase.',
    stageTag: 'lockIn',
    prompt: 'Deep low-frequency meditation drone, subtle electronic void atmosphere, immersive spatial ambient hum, no music, no speech',
    durationSeconds: 5,
  },
  {
    cueKey: 'disruptionImpactSlam',
    label: 'Disruption Slam',
    description: 'Visceral pressure slam on disruption stage entry.',
    stageTag: 'disruption',
    prompt: 'Sudden intense stadium crowd surge, sharp disruptive slam, competitive sports pressure sound, short and visceral, no music, no speech',
    durationSeconds: 3,
  },
  {
    cueKey: 'recoveryWindowPing',
    label: 'Recovery Ping',
    description: 'Urgent alert ping when the recovery window opens.',
    stageTag: 'recovery',
    prompt: 'Clear urgent recovery signal ping, bright electronic alert tone, sports performance cue, crisp and attention-grabbing',
    durationSeconds: 2,
  },
  {
    cueKey: 'tapConfirmChime',
    label: 'Tap Confirm',
    description: 'Soft satisfying chime confirming the orb tap.',
    stageTag: 'tap',
    prompt: 'Soft satisfying confirmation chime, brief tonal response, clean completion sound effect',
    durationSeconds: 1,
  },
  {
    cueKey: 'blockTransitionSettle',
    label: 'Block Settle',
    description: 'Quiet grounding tone between reps.',
    stageTag: 'transition',
    prompt: 'Quiet settling tone, brief calm resolution, between-rep pause, subtle and grounding',
    durationSeconds: 2,
  },
];

const VP_STAGE_PALETTE: Record<VPCueDef['stageTag'], { label: string; color: string; dimColor: string }> = {
  lockIn:     { label: 'Lock-In',     color: '#00D4AA', dimColor: 'rgba(0,212,170,0.15)' },
  disruption: { label: 'Disruption',  color: '#FF453A', dimColor: 'rgba(255,69,58,0.15)' },
  recovery:   { label: 'Recovery',    color: '#30D158', dimColor: 'rgba(48,209,88,0.15)'  },
  tap:        { label: 'Tap',         color: '#00D4AA', dimColor: 'rgba(0,212,170,0.12)'  },
  transition: { label: 'Transition',  color: '#8E8E93', dimColor: 'rgba(142,142,147,0.12)'},
};

function vpSlugify(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function vpHashString(input: string) {
  let hash = 5381;
  for (let i = 0; i < input.length; i += 1) {
    hash = ((hash << 5) + hash) ^ input.charCodeAt(i);
  }
  return (hash >>> 0).toString(16);
}

function buildVPDocId(cue: VPCueDef) {
  return `sfx-${VP_ENGINE_KEY}-${cue.cueKey}-${vpHashString(cue.prompt)}`;
}

// ──────────────────────────────────────────────────────────
// SOUND CARD
// ──────────────────────────────────────────────────────────
const SoundCard: React.FC<{
  sound: typeof SOUND_EFFECTS[0];
  isPlaying: boolean;
  onPlay: () => void;
  onStop: () => void;
}> = ({ sound, isPlaying, onPlay, onStop }) => {
  const platformBadge =
    sound.platform === 'pulsecheck'
      ? { label: 'PulseCheck', color: 'bg-[#8B5CF6]/15 text-purple-300 border-[#8B5CF6]/25' }
      : sound.platform === 'community'
      ? { label: 'Community', color: 'bg-[#E0FE10]/10 text-[#E0FE10] border-[#E0FE10]/20' }
      : { label: 'Both', color: 'bg-blue-900/20 text-blue-300 border-blue-700/30' };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-xl border p-4 transition-all duration-200 ${
        isPlaying
          ? 'border-[#E0FE10]/30 bg-[#E0FE10]/5'
          : 'border-white/[0.07] bg-white/[0.02] hover:border-white/[0.12] hover:bg-white/[0.04]'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div
            className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${
              isPlaying ? 'bg-[#E0FE10]/20 text-[#E0FE10]' : 'bg-white/5 text-zinc-400'
            }`}
          >
            {sound.icon}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-white">{sound.label}</span>
              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md border ${platformBadge.color}`}>
                {platformBadge.label}
              </span>
            </div>
            <p className="text-xs text-zinc-500 mt-0.5 leading-relaxed">{sound.description}</p>
            <code className="text-[10px] text-zinc-600 font-mono mt-1 block">{sound.file}.mp3</code>
          </div>
        </div>

        <button
          onClick={isPlaying ? onStop : onPlay}
          className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            isPlaying
              ? 'bg-[#E0FE10]/15 border border-[#E0FE10]/25 text-[#E0FE10] hover:bg-[#E0FE10]/20'
              : 'bg-zinc-800 border border-zinc-700 text-zinc-300 hover:bg-zinc-700 hover:text-white'
          }`}
        >
          {isPlaying ? (
            <>
              <Square className="w-3 h-3" /> Stop
            </>
          ) : (
            <>
              <Play className="w-3 h-3" /> Preview
            </>
          )}
        </button>
      </div>

      {/* Waveform animation */}
      {isPlaying && (
        <div className="flex items-center gap-0.5 mt-3 h-4">
          {Array.from({ length: 20 }).map((_, i) => (
            <motion.div
              key={i}
              className="w-1 bg-[#E0FE10] rounded-full"
              animate={{ height: ['4px', `${Math.random() * 14 + 4}px`, '4px'] }}
              transition={{
                duration: 0.5 + Math.random() * 0.4,
                repeat: Infinity,
                delay: i * 0.07,
                ease: 'easeInOut',
              }}
            />
          ))}
        </div>
      )}
    </motion.div>
  );
};

// ──────────────────────────────────────────────────────────
// VP SOUND CARD
// ──────────────────────────────────────────────────────────
const VPSoundCard: React.FC<{
  cue: VPCueDef;
  asset: SimAudioAssetRef | null;
  generating: boolean;
  isPlaying: boolean;
  onGenerate: () => void;
  onPlay: () => void;
  onStop: () => void;
}> = ({ cue, asset, generating, isPlaying, onGenerate, onPlay, onStop }) => {
  const palette = VP_STAGE_PALETTE[cue.stageTag];
  const isReady = Boolean(asset?.downloadURL);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-xl border p-4 transition-all duration-200 ${
        isPlaying
          ? 'border-white/20 bg-white/[0.05]'
          : 'border-white/[0.07] bg-white/[0.02] hover:border-white/[0.12] hover:bg-white/[0.04]'
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Stage color dot + icon */}
        <div
          className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ background: palette.dimColor, border: `1px solid ${palette.color}30` }}
        >
          <Eye className="w-4 h-4" style={{ color: palette.color }} />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-white">{cue.label}</span>
            <span
              className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md border"
              style={{ color: palette.color, background: palette.dimColor, borderColor: `${palette.color}30` }}
            >
              {palette.label}
            </span>
            {/* Status badge */}
            {generating ? (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-amber-900/20 text-amber-300 border border-amber-700/30 flex items-center gap-1">
                <Loader2 className="w-2.5 h-2.5 animate-spin" />Generating…
              </span>
            ) : isReady ? (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-emerald-900/20 text-emerald-400 border border-emerald-700/30">
                Ready
              </span>
            ) : (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-zinc-800 text-zinc-500 border border-zinc-700">
                Not Generated
              </span>
            )}
          </div>
          <p className="text-xs text-zinc-500 mt-0.5 leading-relaxed">{cue.description}</p>
          <code className="text-[10px] text-zinc-600 font-mono mt-1 block">{cue.durationSeconds}s · ElevenLabs SFX · {cue.cueKey}</code>
        </div>

        {/* Actions */}
        <div className="flex-shrink-0 flex items-center gap-1.5">
          {isReady && !generating && (
            <button
              onClick={isPlaying ? onStop : onPlay}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                isPlaying
                  ? 'bg-white/10 border border-white/20 text-white hover:bg-white/15'
                  : 'bg-zinc-800 border border-zinc-700 text-zinc-300 hover:bg-zinc-700 hover:text-white'
              }`}
            >
              {isPlaying ? <><Square className="w-3 h-3" />Stop</> : <><Play className="w-3 h-3" />Preview</>}
            </button>
          )}
          <button
            onClick={onGenerate}
            disabled={generating}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              generating
                ? 'bg-zinc-800 border border-zinc-700 text-zinc-500 cursor-not-allowed'
                : isReady
                  ? 'bg-zinc-800 border border-zinc-700 text-zinc-400 hover:bg-zinc-700 hover:text-white'
                  : 'bg-[#00D4AA]/15 border border-[#00D4AA]/30 text-[#00D4AA] hover:bg-[#00D4AA]/25'
            }`}
          >
            {generating ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : isReady ? (
              <><RotateCcw className="w-3 h-3" />Regen</>
            ) : (
              <><Wand2 className="w-3 h-3" />Generate</>
            )}
          </button>
        </div>
      </div>

      {/* Waveform animation when playing */}
      {isPlaying && (
        <div className="flex items-center gap-0.5 mt-3 h-4">
          {Array.from({ length: 20 }).map((_, i) => (
            <motion.div
              key={i}
              className="w-1 rounded-full"
              style={{ background: palette.color }}
              animate={{ height: ['4px', `${Math.random() * 14 + 4}px`, '4px'] }}
              transition={{
                duration: 0.5 + Math.random() * 0.4,
                repeat: Infinity,
                delay: i * 0.07,
                ease: 'easeInOut',
              }}
            />
          ))}
        </div>
      )}

      {/* Storage path when ready */}
      {isReady && asset && (
        <div className="mt-2 px-2 py-1.5 rounded-lg bg-zinc-950/60 border border-white/[0.04]">
          <code className="text-[10px] text-zinc-600 font-mono break-all">{asset.storagePath}</code>
        </div>
      )}
    </motion.div>
  );
};

// ──────────────────────────────────────────────────────────
// MAIN PAGE
// ──────────────────────────────────────────────────────────
const AdminAiVoice: React.FC = () => {
  // Voice config state
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [provider, setProvider] = useState<AiVoiceConfig['provider']>('openai');
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>('alloy');
  const [selectedPresetId, setSelectedPresetId] = useState<string>(getElevenLabsPreset().id);
  const [elevenLabsSettings, setElevenLabsSettings] = useState<ElevenLabsVoiceSettings>(
    normalizeElevenLabsSettings(undefined, getElevenLabsPreset().id)
  );
  const [punctuationPauses, setPunctuationPauses] = useState(true);
  const [sampleText, setSampleText] = useState(sampleScripts[0]);
  const [voiceExpanded, setVoiceExpanded] = useState(true);

  // Sound effects state
  const [playingSound, setPlayingSound] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Vision Pro immersive sound cues state
  const [vpAssets, setVPAssets] = useState<Record<string, SimAudioAssetRef | null>>({});
  const [vpGenerating, setVPGenerating] = useState<Record<string, boolean>>({});
  const [vpLoading, setVPLoading] = useState(false);
  const [vpLoadError, setVPLoadError] = useState<string | null>(null);
  const [vpGenErrors, setVPGenErrors] = useState<Record<string, string>>({});
  const [vpPlayingId, setVPPlayingId] = useState<string | null>(null);
  const vpAudioRef = useRef<HTMLAudioElement | null>(null);

  const voiceLabel = useMemo(() => {
    const source = provider === 'elevenlabs' ? ELEVENLABS_VOICES : OPENAI_VOICES;
    return source.find((v) => v.id === selectedVoiceId)?.label || selectedVoiceId;
  }, [provider, selectedVoiceId]);

  const presetMeta = useMemo(
    () => ELEVENLABS_PRESETS.find((p) => p.id === selectedPresetId) || getElevenLabsPreset(),
    [selectedPresetId]
  );

  // Group sounds by category
  const groupedSounds = useMemo(() => {
    const groups: Record<string, typeof SOUND_EFFECTS> = {};
    for (const cat of CATEGORY_ORDER) {
      groups[cat] = SOUND_EFFECTS.filter((s) => s.category === cat);
    }
    return groups;
  }, []);

  // ── VP load: read Firestore for all 5 cue docs
  const loadVPAssets = async () => {
    setVPLoading(true);
    setVPLoadError(null);
    try {
      const results: Record<string, SimAudioAssetRef | null> = {};
      await Promise.all(
        VP_RESET_CUES.map(async (cue) => {
          const docId = buildVPDocId(cue);
          const snap = await getDoc(doc(db, 'sim-audio-assets', docId));
          results[cue.cueKey] = snap.exists() ? (snap.data() as SimAudioAssetRef) : null;
        })
      );
      setVPAssets(results);
    } catch (e: any) {
      setVPLoadError(e?.message || 'Failed to load Vision Pro sounds');
    } finally {
      setVPLoading(false);
    }
  };

  // ── VP generate: call ElevenLabs SFX API → Firebase Storage → Firestore
  const generateVPSound = async (cue: VPCueDef) => {
    setVPGenerating((prev) => ({ ...prev, [cue.cueKey]: true }));
    setVPGenErrors((prev) => { const n = { ...prev }; delete n[cue.cueKey]; return n; });
    try {
      // 1. Generate via ElevenLabs
      const res = await fetch('/api/mentaltraining/generate-sfx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: cue.prompt, durationSeconds: cue.durationSeconds }),
      });
      const payload = await res.json();
      if (!res.ok || !payload?.audio) {
        throw new Error(payload?.error || 'Sound generation failed');
      }

      // 2. base64 → Blob
      const binary = window.atob(payload.audio as string);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], { type: 'audio/mpeg' });

      // 3. Upload to Firebase Storage
      const assetId = buildVPDocId(cue);
      const path = `sim-audio-assets/${vpSlugify(VP_ENGINE_KEY)}/${cue.cueKey}/${assetId}.mp3`;
      const sRef = storageRef(storage, path);
      const snapshot = await uploadBytes(sRef, blob, { contentType: 'audio/mpeg' });
      const downloadURL = await getDownloadURL(snapshot.ref);
      const gsUrl = `gs://${snapshot.ref.bucket}/${snapshot.ref.fullPath}`;

      // 4. Write Firestore doc
      const now = Date.now();
      const assetRecord: SimAudioAssetRef = {
        id: assetId,
        cueKey: cue.cueKey,
        label: cue.label,
        prompt: cue.prompt,
        provider: 'elevenlabs',
        format: 'mp3',
        contentType: 'audio/mpeg',
        storagePath: path,
        gsUrl,
        downloadURL,
        createdAt: vpAssets[cue.cueKey]?.createdAt ?? now,
        updatedAt: now,
      };
      await setDoc(doc(db, 'sim-audio-assets', assetId), {
        ...assetRecord,
        family: 'vision-pro-reset',
        engineKey: VP_ENGINE_KEY,
        archetype: 'audio_channel',
      });

      setVPAssets((prev) => ({ ...prev, [cue.cueKey]: assetRecord }));
    } catch (e: any) {
      const msg = e?.message || 'Generation failed';
      setVPGenErrors((prev) => ({ ...prev, [cue.cueKey]: msg }));
      console.error(`[VP SFX] ${cue.cueKey}:`, msg);
    } finally {
      setVPGenerating((prev) => ({ ...prev, [cue.cueKey]: false }));
    }
  };

  // ── VP audio preview
  const stopVPSound = () => {
    if (vpAudioRef.current) {
      vpAudioRef.current.pause();
      vpAudioRef.current.currentTime = 0;
      vpAudioRef.current = null;
    }
    setVPPlayingId(null);
  };

  const playVPSound = (cueKey: string, url: string) => {
    stopVPSound();
    setVPPlayingId(cueKey);
    const audio = new Audio(url);
    vpAudioRef.current = audio;
    audio.volume = 0.75;
    audio.play().catch(() => setVPPlayingId(null));
    audio.onended = () => setVPPlayingId(null);
    audio.onerror = () => setVPPlayingId(null);
  };

  const loadConfig = async () => {
    setLoading(true);
    setError(null);
    try {
      const ref = doc(db, CONFIG_COLLECTION, CONFIG_DOC_ID);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const data = normalizeAiVoiceConfig(snap.data() as Partial<AiVoiceConfig>);
        setProvider(data.provider);
        setSelectedVoiceId(data.voiceId);
        setSelectedPresetId(data.presetId || getElevenLabsPreset().id);
        setElevenLabsSettings(normalizeElevenLabsSettings(data.elevenLabsSettings || undefined, data.presetId || undefined));
        setPunctuationPauses(data.punctuationPauses !== false);
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to load config');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConfig();
    loadVPAssets();
    return () => {
      stopNarration();
      stopSoundEffect();
      stopVPSound();
    };
  }, []);

  // ── Voice preview
  const handlePreview = async () => {
    setError(null);
    stopNarration();
    setPlaying(true);
    try {
      const choice: VoiceChoice =
        provider === 'elevenlabs'
          ? {
              provider: 'elevenlabs',
              id: selectedVoiceId,
              label: voiceLabel,
              presetId: selectedPresetId,
              settings: shouldUseElevenLabsVoiceDefaults(selectedPresetId) ? null : elevenLabsSettings,
              punctuationPauses,
            }
          : { provider: 'openai', id: selectedVoiceId, label: voiceLabel };
      await speakStep(sampleText, { onEnd: () => setPlaying(false), onError: () => setPlaying(false), fallbackToBrowser: false }, choice);
    } catch {
      setError('Preview failed. Check provider API key and voice settings.');
      setPlaying(false);
    }
  };

  const handleStop = () => { stopNarration(); setPlaying(false); };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const ref = doc(db, CONFIG_COLLECTION, CONFIG_DOC_ID);
      const payload: AiVoiceConfig = {
        provider,
        voiceId: selectedVoiceId,
        presetId: provider === 'elevenlabs' ? selectedPresetId : null,
        elevenLabsSettings:
          provider === 'elevenlabs' && !shouldUseElevenLabsVoiceDefaults(selectedPresetId)
            ? elevenLabsSettings
            : null,
        punctuationPauses: provider === 'elevenlabs' ? punctuationPauses : null,
        updatedAt: Date.now(),
      };
      await setDoc(ref, payload, { merge: true });
      clearVoiceCache();
    } catch (e: any) {
      setError(e?.message || 'Failed to save config');
    } finally {
      setSaving(false);
    }
  };

  const applyPreset = (presetId: string) => {
    const preset = getElevenLabsPreset(presetId);
    setSelectedPresetId(preset.id);
    setElevenLabsSettings(normalizeElevenLabsSettings(preset.settings, preset.id));
  };

  const updateElevenLabsSetting = (key: keyof Pick<ElevenLabsVoiceSettings, 'stability' | 'similarityBoost' | 'style'>, value: number) => {
    setSelectedPresetId('custom');
    setElevenLabsSettings((prev) => ({ ...prev, [key]: value }));
  };

  // ── Sound effect preview
  const stopSoundEffect = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    setPlayingSound(null);
  };

  const playAudioUrl = (url: string, onDone?: () => void) => {
    const audio = new Audio(url);
    audioRef.current = audio;
    audio.volume = 0.75;
    audio.play().catch((e) => {
      console.warn('[SFX] play failed:', e);
      setPlayingSound(null);
    });
    audio.onended = () => {
      setPlayingSound(null);
      onDone?.();
    };
    audio.onerror = () => {
      console.warn('[SFX] audio error on', url);
      setPlayingSound(null);
    };
  };

  const playSoundEffect = (sound: typeof SOUND_EFFECTS[0]) => {
    stopSoundEffect();
    setPlayingSound(sound.id);
    playAudioUrl(`/audio/sfx/${sound.file}.mp3`);
  };

  return (
    <AdminRouteGuard>
      <Head>
        <title>AI Voice & Sound Effects | Pulse Admin</title>
      </Head>

      <div className="min-h-screen bg-[#0a0a0b] text-white p-6 md:p-8">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="max-w-5xl mx-auto">

          {/* Header */}
          <div className="flex items-start justify-between gap-4 mb-8">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-3">
                <span className="w-11 h-11 rounded-2xl bg-[#E0FE10]/15 border border-[#E0FE10]/20 flex items-center justify-center">
                  <Mic2 className="w-6 h-6 text-[#E0FE10]" />
                </span>
                AI Voice & Sound Effects
              </h1>
              <p className="text-zinc-400 mt-2 text-sm">
                Configure Nora's voice and preview all sound effects across Community and PulseCheck apps.
              </p>
            </div>
            <button
              onClick={loadConfig}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-800 border border-zinc-700 text-white hover:bg-zinc-700 transition-colors"
              disabled={loading}
            >
              <RefreshCw className="w-4 h-4" />
              Reload
            </button>
          </div>

          {/* Error banner */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-6 p-4 rounded-xl bg-red-900/20 border border-red-700/40 text-red-200 text-sm"
              >
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          {/* ════════════════════════
              SECTION 1: AI VOICE
          ════════════════════════ */}
          <div className="rounded-2xl bg-zinc-900/40 border border-white/10 backdrop-blur-xl mb-6">
            {/* Collapsible header */}
            <button
              onClick={() => setVoiceExpanded((v) => !v)}
              className="w-full flex items-center justify-between p-5 text-left"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#E0FE10]/10 border border-[#E0FE10]/20 flex items-center justify-center">
                  <Mic2 className="w-4 h-4 text-[#E0FE10]" />
                </div>
                <div>
                  <div className="font-semibold text-white">Nora Voice Configuration</div>
                  <div className="text-xs text-zinc-500">Global AI narration voice for mental training steps</div>
                </div>
              </div>
              {voiceExpanded ? <ChevronUp className="w-4 h-4 text-zinc-500" /> : <ChevronDown className="w-4 h-4 text-zinc-500" />}
            </button>

            <AnimatePresence initial={false}>
              {voiceExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  className="overflow-hidden"
                >
                  <div className="px-5 pb-5 border-t border-white/[0.06]">
                    <div className="flex items-start gap-3 mt-4 mb-5 text-sm text-zinc-300">
                      <Info className="w-5 h-5 text-zinc-400 mt-0.5" />
                      <div>
                        <div className="text-white font-medium">Security</div>
                        <div className="text-zinc-400">Voice audio is generated server-side via Netlify functions. No API keys are exposed in the browser.</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Left — provider + voice settings */}
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <button
                            type="button"
                            onClick={() => { setProvider('openai'); setSelectedVoiceId((c) => OPENAI_VOICES.some((v) => v.id === c) ? c : OPENAI_VOICES[0].id); }}
                            className={`flex-1 rounded-xl border px-4 py-3 text-left transition-colors ${provider === 'openai' ? 'border-[#E0FE10]/40 bg-[#E0FE10]/10 text-white' : 'border-zinc-700 bg-zinc-800 text-zinc-300'}`}
                          >
                            <div className="text-sm font-semibold">OpenAI</div>
                            <div className="text-xs text-zinc-400 mt-1">Fast baseline previews and default fallback.</div>
                          </button>
                          <button
                            type="button"
                            onClick={() => { setProvider('elevenlabs'); setSelectedVoiceId((c) => ELEVENLABS_VOICES.some((v) => v.id === c) ? c : ELEVENLABS_VOICES[0].id); }}
                            className={`flex-1 rounded-xl border px-4 py-3 text-left transition-colors ${provider === 'elevenlabs' ? 'border-[#E0FE10]/40 bg-[#E0FE10]/10 text-white' : 'border-zinc-700 bg-zinc-800 text-zinc-300'}`}
                          >
                            <div className="text-sm font-semibold flex items-center gap-2"><Sparkles className="w-4 h-4" />ElevenLabs</div>
                            <div className="text-xs text-zinc-400 mt-1">Voice identity plus inflection control.</div>
                          </button>
                        </div>

                        {provider === 'openai' ? (
                          <>
                            <label className="block text-sm text-zinc-400 mb-2">Default OpenAI Voice</label>
                            <select value={selectedVoiceId} onChange={(e) => setSelectedVoiceId(e.target.value)} className="w-full px-4 py-3 rounded-xl bg-zinc-800 border border-zinc-700 text-white focus:outline-none focus:ring-2 focus:ring-white/10" disabled={loading}>
                              {OPENAI_VOICES.filter((v) => v.provider === 'openai').map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
                            </select>
                          </>
                        ) : (
                          <>
                            <label className="block text-sm text-zinc-400 mb-2">ElevenLabs Voice</label>
                            <select value={selectedVoiceId} onChange={(e) => setSelectedVoiceId(e.target.value)} className="w-full px-4 py-3 rounded-xl bg-zinc-800 border border-zinc-700 text-white focus:outline-none focus:ring-2 focus:ring-white/10" disabled={loading}>
                              {ELEVENLABS_VOICES.filter((v) => v.provider === 'elevenlabs').map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
                            </select>

                            <div className="mt-5 flex items-center gap-2 text-sm text-zinc-300"><SlidersHorizontal className="w-4 h-4 text-zinc-400" />Expression Presets</div>
                            <div className="grid grid-cols-1 gap-2 mt-3">
                              {ELEVENLABS_PRESETS.map((preset) => {
                                const active = selectedPresetId === preset.id;
                                return (
                                  <button key={preset.id} type="button" onClick={() => applyPreset(preset.id)} className={`rounded-xl border px-4 py-3 text-left transition-colors ${active ? 'border-[#E0FE10]/40 bg-[#E0FE10]/10' : 'border-zinc-700 bg-zinc-800 hover:bg-zinc-700/60'}`}>
                                    <div className="text-sm font-semibold text-white">{preset.label}</div>
                                    <div className="text-xs text-zinc-400 mt-1">{preset.description}</div>
                                  </button>
                                );
                              })}
                            </div>

                            <div className="mt-5 space-y-4 rounded-xl border border-zinc-800 bg-zinc-950/50 p-4">
                              {shouldUseElevenLabsVoiceDefaults(selectedPresetId) && (
                                <div className="rounded-lg border border-[#E0FE10]/20 bg-[#E0FE10]/8 px-3 py-2 text-xs text-zinc-300">
                                  Default sends no custom ElevenLabs overrides.
                                </div>
                              )}
                              {(['stability', 'similarityBoost', 'style'] as const).map((key) => (
                                <div key={key}>
                                  <div className="flex items-center justify-between text-sm text-zinc-300 mb-2">
                                    <span>{key === 'similarityBoost' ? 'Similarity Boost' : key.charAt(0).toUpperCase() + key.slice(1)}</span>
                                    <span>{elevenLabsSettings[key].toFixed(2)}</span>
                                  </div>
                                  <input type="range" min="0" max="1" step="0.01" value={elevenLabsSettings[key]} onChange={(e) => updateElevenLabsSetting(key, Number(e.target.value))} className="w-full" disabled={shouldUseElevenLabsVoiceDefaults(selectedPresetId)} />
                                </div>
                              ))}
                              <div>
                                <div className="flex items-center justify-between text-sm text-zinc-300 mb-2">
                                  <span>Speed</span>
                                  <span>{elevenLabsSettings.speed.toFixed(2)}</span>
                                </div>
                                <input type="range" min="0.7" max="1.2" step="0.01" value={elevenLabsSettings.speed} onChange={(e) => { setSelectedPresetId('custom'); setElevenLabsSettings((prev) => ({ ...prev, speed: Number(e.target.value) })); }} className="w-full" disabled={shouldUseElevenLabsVoiceDefaults(selectedPresetId)} />
                              </div>
                              <label className="flex items-center justify-between rounded-lg border border-zinc-800 px-3 py-2">
                                <span className="text-sm text-zinc-300">Speaker Boost</span>
                                <input type="checkbox" checked={elevenLabsSettings.useSpeakerBoost} onChange={(e) => { setSelectedPresetId('custom'); setElevenLabsSettings((prev) => ({ ...prev, useSpeakerBoost: e.target.checked })); }} className="h-4 w-4" disabled={shouldUseElevenLabsVoiceDefaults(selectedPresetId)} />
                              </label>
                              <label className="flex items-center justify-between rounded-lg border border-zinc-800 px-3 py-2">
                                <div>
                                  <div className="text-sm text-zinc-300">Respect Punctuation</div>
                                  <div className="text-xs text-zinc-500">Adds short SSML pauses after commas and sentence endings.</div>
                                </div>
                                <input type="checkbox" checked={punctuationPauses} onChange={(e) => setPunctuationPauses(e.target.checked)} className="h-4 w-4" />
                              </label>
                            </div>
                          </>
                        )}
                      </div>

                      {/* Right — preview */}
                      <div>
                        <label className="block text-sm text-zinc-400 mb-2">Preview Script</label>
                        <textarea value={sampleText} onChange={(e) => setSampleText(e.target.value)} className="w-full px-4 py-3 rounded-xl bg-zinc-800 border border-zinc-700 text-white focus:outline-none focus:ring-2 focus:ring-white/10 min-h-[96px]" />
                        <div className="flex flex-wrap gap-2 mt-2">
                          {sampleScripts.map((s) => (
                            <button key={s} onClick={() => setSampleText(s)} className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-white/80 hover:bg-white/10" type="button">Sample</button>
                          ))}
                        </div>
                        <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-950/50 p-4 text-sm text-zinc-400">
                          <div className="text-white font-medium mb-2">Active Preview</div>
                          <div>Provider: <span className="text-zinc-200">{provider === 'elevenlabs' ? 'ElevenLabs' : 'OpenAI'}</span></div>
                          <div>Voice: <span className="text-zinc-200">{voiceLabel}</span></div>
                          {provider === 'elevenlabs' && <div>Preset: <span className="text-zinc-200">{selectedPresetId === 'custom' ? 'Custom' : presetMeta.label}</span></div>}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-6 gap-3">
                      <div className="flex gap-2">
                        {!playing ? (
                          <button onClick={handlePreview} className="flex items-center gap-2 px-5 py-3 rounded-xl bg-zinc-800 border border-zinc-700 text-white hover:bg-zinc-700 transition-colors" disabled={loading}>
                            <Play className="w-4 h-4" />Preview
                          </button>
                        ) : (
                          <button onClick={handleStop} className="flex items-center gap-2 px-5 py-3 rounded-xl bg-zinc-800 border border-zinc-700 text-white hover:bg-zinc-700 transition-colors">
                            <Square className="w-4 h-4" />Stop
                          </button>
                        )}
                      </div>
                      <button onClick={handleSave} className="flex items-center gap-2 px-6 py-3 rounded-xl bg-[#E0FE10] text-black font-semibold hover:bg-[#c8e40e] transition-colors disabled:opacity-60" disabled={loading || saving}>
                        <Save className="w-4 h-4" />
                        {saving ? 'Saving…' : 'Save Default Voice'}
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ════════════════════════
              SECTION 2: SOUND EFFECTS
          ════════════════════════ */}
          <div className="rounded-2xl bg-zinc-900/40 border border-white/10 backdrop-blur-xl p-5">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-8 rounded-lg bg-[#8B5CF6]/15 border border-[#8B5CF6]/25 flex items-center justify-center">
                <Music className="w-4 h-4 text-purple-400" />
              </div>
              <div>
                <div className="font-semibold text-white">Sound Effects Library</div>
                <div className="text-xs text-zinc-500">
                  All {SOUND_EFFECTS.length} sounds across Pulse Community and PulseCheck apps. Click Preview to hear them.
                </div>
              </div>
              {playingSound && (
                <button onClick={stopSoundEffect} className="ml-auto flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-300 text-xs hover:bg-zinc-700">
                  <VolumeX className="w-3.5 h-3.5" />Stop All
                </button>
              )}
            </div>

            <div className="space-y-8">
              {CATEGORY_ORDER.map((cat) => {
                const sounds = groupedSounds[cat];
                if (!sounds?.length) return null;
                return (
                  <div key={cat}>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-xs font-semibold uppercase tracking-[0.15em] text-zinc-500">{CATEGORY_LABELS[cat]}</span>
                      <div className="flex-1 h-px bg-white/[0.05]" />
                      <span className="text-xs text-zinc-600">{sounds.length} sounds</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {sounds.map((sound) => (
                        <SoundCard
                          key={sound.id}
                          sound={sound}
                          isPlaying={playingSound === sound.id}
                          onPlay={() => playSoundEffect(sound)}
                          onStop={stopSoundEffect}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Legend */}
            <div className="mt-8 flex flex-wrap gap-3 text-xs text-zinc-500 border-t border-white/[0.05] pt-5">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#E0FE10]/60" />
                Community App (iOS/Android)
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#8B5CF6]/60" />
                PulseCheck iOS App
              </div>
              <div className="ml-auto text-zinc-600">
                Preview plays from <code className="font-mono">/public/audio/</code> — iOS plays from bundle
              </div>
            </div>
          </div>

          {/* ════════════════════════
              SECTION 3: VISION PRO IMMERSIVE SOUNDS
          ════════════════════════ */}
          <div className="rounded-2xl bg-zinc-900/40 border border-white/10 backdrop-blur-xl p-5 mt-6">
            <div className="flex items-center justify-between gap-3 mb-1">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(0,212,170,0.12)', border: '1px solid rgba(0,212,170,0.25)' }}>
                  <Eye className="w-4 h-4" style={{ color: '#00D4AA' }} />
                </div>
                <div>
                  <div className="font-semibold text-white flex items-center gap-2">
                    Vision Pro — Reset Trial Sound Cues
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md border" style={{ color: '#00D4AA', background: 'rgba(0,212,170,0.1)', borderColor: 'rgba(0,212,170,0.25)' }}>
                      visionOS
                    </span>
                  </div>
                  <div className="text-xs text-zinc-500 mt-0.5">
                    Spatial sound effects for the immersive Reset / Next Play trial. Generated via ElevenLabs and stored in Firebase — not bundled as static files.
                  </div>
                </div>
              </div>
              <button
                onClick={loadVPAssets}
                disabled={vpLoading}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-zinc-800 border border-zinc-700 text-white text-xs hover:bg-zinc-700 transition-colors disabled:opacity-50"
              >
                {vpLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                Refresh
              </button>
            </div>

            {/* Load error */}
            <AnimatePresence>
              {vpLoadError && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-3 p-3 rounded-xl bg-red-900/20 border border-red-700/40 text-red-200 text-xs"
                >
                  {vpLoadError}
                </motion.div>
              )}
            </AnimatePresence>

            {/* How it works callout */}
            <div className="mt-4 flex items-start gap-3 p-3 rounded-xl bg-zinc-950/60 border border-white/[0.05] text-xs text-zinc-400">
              <Info className="w-4 h-4 text-zinc-500 mt-0.5 flex-shrink-0" />
              <div>
                Generated audio is stored at <code className="font-mono text-zinc-300">sim-audio-assets/vision-pro-reset/</code> in Firebase Storage.
                The visionOS app reads <code className="font-mono text-zinc-300">downloadURL</code> at session start to preload spatial audio.
                Click <strong className="text-zinc-200">Generate</strong> to create a cue for the first time, or <strong className="text-zinc-200">Regen</strong> to replace an existing one.
              </div>
            </div>

            {/* Cue cards */}
            <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {VP_RESET_CUES.map((cue) => (
                <div key={cue.cueKey}>
                  <VPSoundCard
                    cue={cue}
                    asset={vpAssets[cue.cueKey] ?? null}
                    generating={vpGenerating[cue.cueKey] ?? false}
                    isPlaying={vpPlayingId === cue.cueKey}
                    onGenerate={() => generateVPSound(cue)}
                    onPlay={() => {
                      const url = vpAssets[cue.cueKey]?.downloadURL;
                      if (url) playVPSound(cue.cueKey, url);
                    }}
                    onStop={stopVPSound}
                  />
                  {/* Per-cue generation error */}
                  <AnimatePresence>
                    {vpGenErrors[cue.cueKey] && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mt-1 px-3 py-2 rounded-lg bg-red-900/20 border border-red-700/30 text-red-300 text-[11px]"
                      >
                        {vpGenErrors[cue.cueKey]}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </div>

            {/* Status summary footer */}
            <div className="mt-5 flex flex-wrap items-center gap-4 text-xs text-zinc-500 border-t border-white/[0.05] pt-4">
              <div>
                <span className="text-zinc-300 font-semibold">
                  {Object.values(vpAssets).filter(Boolean).length}
                </span>
                {' / '}{VP_RESET_CUES.length} cues generated
              </div>
              {Object.values(vpGenerating).some(Boolean) && (
                <div className="flex items-center gap-1.5 text-amber-400">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  {Object.values(vpGenerating).filter(Boolean).length} generating…
                </div>
              )}
              <div className="ml-auto text-zinc-600">
                Firestore: <code className="font-mono">sim-audio-assets</code> · Storage: <code className="font-mono">sim-audio-assets/vision-pro-reset/</code>
              </div>
            </div>
          </div>

        </motion.div>
      </div>
    </AdminRouteGuard>
  );
};

export default AdminAiVoice;
