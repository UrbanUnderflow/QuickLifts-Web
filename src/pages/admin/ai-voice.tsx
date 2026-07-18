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
import { collection, doc, getDoc, getDocs, query, setDoc, where } from 'firebase/firestore';
import { getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage';
import { auth, db, storage } from '../../api/firebase/config';
import type { SimAudioAssetRef } from '../../api/firebase/mentaltraining/audioAssetService';
import type { PulseCheckProtocolDefinition } from '../../api/firebase/mentaltraining';
import { SIM_VARIANTS_COLLECTION } from '../../api/firebase/mentaltraining/collections';
import {
  buildModuleNarrationScripts,
  hashNarrationText,
  MODULE_NARRATION_ENGINE_KEY,
  type ModuleNarrationScript,
} from '../../api/firebase/mentaltraining/moduleNarrationScripts';
import { persistVoiceConfig, speakStep, stopNarration } from '../../utils/tts';
import { NORA_DYNAMIC_LINES, type NoraDynamicLine } from '../../lib/noraOnboardingVoice';
import { resolvePulseCheckFunctionUrl } from '../../api/firebase/mentaltraining/pulseCheckFunctionsUrl';
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
import protocolSeed from '../../api/firebase/mentaltraining/pulsecheckProtocolRegistry.json';

// ──────────────────────────────────────────────────────────
// CONSTANTS
// ──────────────────────────────────────────────────────────
const CONFIG_COLLECTION = 'app-config';
const CONFIG_DOC_ID = 'ai-voice';

const sampleScripts = [
  "You're safe. Let your shoulders drop. Find one point and stay with it.",
  'Notice the urge to rush. Slow down by 5%. Precision over panic.',
  "If your mind wanders, that's the rep. Return to the target calmly.",
  // Nora landing-page hero (generated via scripts/generate-nora-landing-audio.js → public/audio/nora/nora-hero.mp3)
  "I notice things. That your sleep dropped before your bench stalled. That the days you skip breakfast are the days your voice goes quiet. I'm Nora. I pay attention — so you don't have to carry it alone.",
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
  prompt: string;
  durationSeconds: number;
  generationMode?: 'sfx' | 'speech';
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
    prompt: 'Soothing mindful app-launch sound with a soft low pulse, gentle airy bloom, and a clean peaceful resolve, premium mental-focus identity, no speech, no melody, no harsh transients',
    durationSeconds: 3,
  },
  {
    id: 'pc-mind-coach',
    label: 'Mind Coach Greeting',
    description: 'Plays when Nora first speaks or a new session begins.',
    icon: <MessageSquare className="w-4 h-4" />,
    category: 'pulsecheck',
    file: 'mind-coach-greeting',
    platform: 'pulsecheck',
    prompt: 'Warm restrained welcome cue for a trusted mental performance coach arriving, soft felt tone with a subtle luminous shimmer, calm and human, no speech, no melody',
    durationSeconds: 2,
  },
  {
    id: 'pc-action-card',
    label: 'Action Card Appear',
    description: 'Subtle chime when a new mental training card enters the screen.',
    icon: <Zap className="w-4 h-4" />,
    category: 'pulsecheck',
    file: 'action-card-appear',
    platform: 'pulsecheck',
    prompt: 'Short subtle premium chime as a mental training action card enters, soft rounded attack with a faint focused shimmer, confident and calm, no speech, no melody',
    durationSeconds: 1,
  },
  {
    id: 'pc-message-received',
    label: 'Message Received',
    description: 'Nora chat notification — incoming response.',
    icon: <Bell className="w-4 h-4" />,
    category: 'notification',
    file: 'message-received',
    platform: 'pulsecheck',
    prompt: 'Gentle incoming coach-message notification, two soft warm tones with a clear but non-urgent arrival, mindful and premium, no speech, no harsh digital ping',
    durationSeconds: 1.2,
  },
  {
    id: 'pc-message-sent',
    label: 'Message Sent',
    description: 'Soft confirmation when user sends a message.',
    icon: <MessageSquare className="w-4 h-4" />,
    category: 'ui',
    file: 'message-sent',
    platform: 'pulsecheck',
    prompt: 'Very short soft message-send confirmation, smooth tactile tick with a tiny airy release, restrained and reassuring, no speech, no melody, no reverb tail',
    durationSeconds: 0.5,
  },
  {
    id: 'pc-breathing-gong',
    label: 'Breathing Gong',
    description: 'Used in breathing and focus exercises. Bowl gong resonance.',
    icon: <Music className="w-4 h-4" />,
    category: 'pulsecheck',
    file: 'breathing-gong',
    platform: 'pulsecheck',
    prompt: 'Single calming meditation bowl gong for paced breathing, warm rounded fundamental with a smooth natural decay, centered and peaceful, no speech, no background music',
    durationSeconds: 8,
  },
  {
    id: 'pc-success-chime',
    label: 'Success Chime',
    description: 'Baseline completed or mental task achieved.',
    icon: <CheckCircle className="w-4 h-4" />,
    category: 'celebration',
    file: 'success-chime',
    platform: 'pulsecheck',
    prompt: 'Brief restrained success chime for completing a mental training task, warm ascending two-note resolve with a soft shimmer, proud but never game-like, no speech',
    durationSeconds: 1.5,
  },
  {
    id: 'pc-subtle-click',
    label: 'Subtle Click',
    description: 'Generic UI interaction tap sound.',
    icon: <Zap className="w-4 h-4" />,
    category: 'ui',
    file: 'subtle-click',
    platform: 'pulsecheck',
    prompt: 'Tiny soft matte interface click, precise and tactile like a smooth switch engaging, near-subliminal, dark and premium, no speech, no music, no reverb',
    durationSeconds: 0.35,
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
    prompt: 'Signature Fit With Pulse launch heartbeat, two deep warm athletic heart pulses followed by a subtle modern energy bloom, confident and welcoming, no speech, no melody',
    durationSeconds: 3,
  },
  {
    id: 'community-big-celebration',
    label: 'Big Celebration',
    description: 'Major achievement — round completion, personal record.',
    icon: <Sparkles className="w-4 h-4" />,
    category: 'celebration',
    file: 'bigCelebration',
    platform: 'community',
    prompt: 'Major fitness achievement celebration with an energetic rising impact, bright layered sparkles, and a triumphant clean finish, bold and modern, no speech, no recognizable melody',
    durationSeconds: 5,
  },
  {
    id: 'community-medium-celebration',
    label: 'Medium Celebration',
    description: 'Mid-level win — streak, milestone, leaderboard move.',
    icon: <Sparkles className="w-4 h-4" />,
    category: 'celebration',
    file: 'mediumCelebration',
    platform: 'community',
    prompt: 'Medium fitness milestone celebration, upbeat rising tonal burst with crisp sparkle accents and a satisfying resolve, energetic but compact, no speech, no recognizable melody',
    durationSeconds: 3,
  },
  {
    id: 'community-mini-celebration',
    label: 'Mini Celebration',
    description: 'Small win confirmation — exercise complete, rep logged.',
    icon: <CheckCircle className="w-4 h-4" />,
    category: 'celebration',
    file: 'miniCelebration',
    platform: 'community',
    prompt: 'Tiny upbeat fitness win confirmation, quick bright pop with a short sparkling tail, satisfying and friendly, no speech, no melody, under one second',
    durationSeconds: 0.8,
  },
  {
    id: 'community-success',
    label: 'Success',
    description: 'General success event — workout saved, check-in submitted.',
    icon: <CheckCircle className="w-4 h-4" />,
    category: 'celebration',
    file: 'success',
    platform: 'community',
    prompt: 'Clean universal success cue for a saved workout or submitted check-in, warm two-note confirmation with a polished digital finish, positive and concise, no speech',
    durationSeconds: 1.2,
  },
  {
    id: 'community-great-job',
    label: 'Great Job',
    description: 'Congratulatory voice line — halfway point or final rep.',
    icon: <Volume2 className="w-4 h-4" />,
    category: 'workout',
    file: 'greatJob',
    platform: 'community',
    prompt: 'Great job!',
    durationSeconds: 1.5,
    generationMode: 'speech',
  },
  {
    id: 'community-checkin',
    label: 'Check-in Chime',
    description: 'Fires when an athlete checks into a session or round.',
    icon: <Bell className="w-4 h-4" />,
    category: 'notification',
    file: 'chekin',
    platform: 'community',
    prompt: 'Friendly athlete check-in notification, quick warm arrival chime with a light energetic pulse, social and welcoming, no speech, no harsh alarm tone',
    durationSeconds: 1.2,
  },
  {
    id: 'community-nearby-checkin-success',
    label: 'Nearby Check-In Success',
    description: 'Celebration sound when a member checks in nearby and earns event points.',
    icon: <Sparkles className="w-4 h-4" />,
    category: 'celebration',
    file: 'nearby-checkin-success',
    platform: 'community',
    prompt: 'Nearby event check-in success celebration, bright location ping resolving into a cheerful compact sparkle burst, rewarding and social, no speech, no melody',
    durationSeconds: 2,
  },
  {
    id: 'community-start-clock',
    label: 'Start Clock',
    description: 'Beep sequence marking the beginning of a timed set.',
    icon: <Play className="w-4 h-4" />,
    category: 'workout',
    file: 'startClock',
    platform: 'community',
    prompt: 'Crisp athletic timer-start signal, short three-part electronic count-in resolving to a decisive start beep, clear in a gym, no speech, no music',
    durationSeconds: 1.5,
  },
  {
    id: 'community-half-way',
    label: 'Halfway There',
    description: 'Audible signal at 50% through a timed exercise.',
    icon: <Volume2 className="w-4 h-4" />,
    category: 'workout',
    file: 'half-way-there',
    platform: 'community',
    prompt: 'Halfway there.',
    durationSeconds: 1.5,
    generationMode: 'speech',
  },
  {
    id: 'community-10s-left',
    label: '10 Seconds Left',
    description: 'Countdown warning — 10 seconds remaining in a set.',
    icon: <Volume2 className="w-4 h-4" />,
    category: 'workout',
    file: '10-seconds-left',
    platform: 'community',
    prompt: 'Ten seconds left.',
    durationSeconds: 1.5,
    generationMode: 'speech',
  },
  {
    id: 'community-5s-left',
    label: '5 Seconds Left',
    description: 'Urgent countdown — 5 seconds remaining in a set.',
    icon: <Volume2 className="w-4 h-4" />,
    category: 'workout',
    file: '5-seconds-left',
    platform: 'community',
    prompt: 'Five seconds left.',
    durationSeconds: 1.5,
    generationMode: 'speech',
  },
  {
    id: 'community-completion',
    label: 'Completion',
    description: 'End-of-set completion tone.',
    icon: <CheckCircle className="w-4 h-4" />,
    category: 'workout',
    file: 'Completion1',
    platform: 'community',
    prompt: 'End-of-set workout completion sound, decisive athletic impact resolving into a bright uplifting finish, satisfying after intense effort, no speech, no melody',
    durationSeconds: 2,
  },
  {
    id: 'community-chain-reaction',
    label: 'Chain Reaction',
    description: 'Plays when a cascade/combo event occurs in a round.',
    icon: <Sparkles className="w-4 h-4" />,
    category: 'celebration',
    file: 'chain_reaction',
    platform: 'community',
    prompt: 'Rapid cascading combo celebration, a sequence of energetic rising pops and sparkling impacts that accelerates into a compact payoff, playful and modern, no speech',
    durationSeconds: 2.5,
  },
];

const CATEGORY_LABELS: Record<string, string> = {
  splash: 'Splash & Launch',
  celebration: 'Celebrations',
  workout: 'Workout Signals',
  notification: 'Notifications',
  ui: 'UI Interactions',
  pulsecheck: 'Mental Training',
};

const CATEGORY_ORDER = ['splash', 'pulsecheck', 'celebration', 'workout', 'notification', 'ui'];

// ──────────────────────────────────────────────────────────
// PULSE RITUAL — SOUND EFFECTS LIBRARY
//
// Design tone for every clip: soft, intentional, peaceful, calming.
// No mechanical clicks. No game-y dings. Singing bowls, water,
// breath, warm felt taps. Sounds that lower the heart rate.
//
// Generation: hand each `prompt` to the OpenAI audio model through
// the authenticated OpenAI bridge, then download the
// returned blob as `{file}.mp3` to drop into the Pulse Ritual iOS
// bundle under Resources/Sounds/.
// ──────────────────────────────────────────────────────────

type PulseRitualSound = {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  category: 'onboarding' | 'daily' | 'milestone' | 'navigation' | 'pulsecheck-moment' | 'pulsecheck-utility';
  /// Filename (without extension) used by the iOS bundle. Pair with
  /// the call site in HapticsService / SoundService.
  file: string;
  /// Sound-design prompt — describes the desired sonic texture in
  /// natural language. Tuned for the "calming, intentional" voice.
  prompt: string;
  durationSeconds: number;
  /// Lower influence (~0.3) gives the model more freedom; higher
  /// (~0.6) asks it to follow the prompt more literally. Soft / abstract
  /// cues usually sound better with lower influence.
  promptInfluence?: number;
  /// Existing iOS trigger point the sound should fire alongside.
  /// Helps the engineer wire `SoundService.play(...)` next to the
  /// matching `HapticsService.X()` call.
  pairedHapticNote: string;
  /// Priority order for which sounds to generate + ship first.
  priority: 'high' | 'medium' | 'low';
};

const RITUAL_SOUNDS: PulseRitualSound[] = [
  // ── Daily cadence — must be the quietest in the set; users hear
  // these dozens of times a week.
  {
    id: 'ritual-water-tap',
    label: 'Water Tap',
    description:
      'Fires when the user taps WATER on a drop card or Garden plant. Most frequent sound in the app — must never feel grating.',
    icon: <Music className="w-4 h-4" />,
    category: 'daily',
    file: 'ritual-water-tap',
    prompt:
      'Single soft water droplet landing on a still pond, gentle plip with a short ripple decay, calm and peaceful, very short, no music, no speech, no reverb tail',
    durationSeconds: 1,
    promptInfluence: 0.45,
    pairedHapticNote: 'HapticsService.waterTap() in DropCardView + GardenPlantCard + PotView',
    priority: 'high',
  },
  {
    id: 'ritual-all-watered-today',
    label: 'Daily Three Complete',
    description:
      'Plays once per day when wateredCount transitions to 3-of-3. A quiet "settling into place," not a fanfare.',
    icon: <CheckCircle className="w-4 h-4" />,
    category: 'daily',
    file: 'ritual-all-watered-today',
    prompt:
      'Very brief three-note settling exhale chord, soft glass bell harmonics, peaceful resolution, gentle low-to-mid frequency, calming, no music, no speech, no reverb tail',
    durationSeconds: 1.4,
    promptInfluence: 0.5,
    pairedHapticNote: 'Fires alongside the rhythm-building banner in TodayView when count == 3',
    priority: 'high',
  },
  {
    id: 'ritual-onboarding-pick',
    label: 'Onboarding Pick',
    description:
      'Chip select during onboarding (Grow, Fall-off, Windows, Ritual Picks). Played in quick succession — must be the softest sound in the whole set.',
    icon: <Zap className="w-4 h-4" />,
    category: 'daily',
    file: 'ritual-onboarding-pick',
    prompt:
      'Very soft felt-marble tap, brief warm wood tone, intentional and quiet, calming, very short, no music, no speech',
    durationSeconds: 0.4,
    promptInfluence: 0.4,
    pairedHapticNote: 'HapticsService.selection() in ChipView + WindowsView + onboarding chip rows',
    priority: 'medium',
  },

  // ── Milestone moments — ceremonial, larger emotional weight.
  // The user hears these rarely so they can carry more presence.
  {
    id: 'ritual-seed-planted',
    label: 'Seed Planted',
    description:
      'Plays when a fresh seed lands in a pot — both first-onboarding plant and post-bloom replant from the Greenhouse. Pairs with the golden seed-drop animation.',
    icon: <Sparkles className="w-4 h-4" />,
    category: 'milestone',
    file: 'ritual-seed-planted',
    prompt:
      'Soft warm earth settling, a gentle low thud followed by a subtle golden shimmer tail, peaceful and intentional, brief, calming, no music, no speech',
    durationSeconds: 1.6,
    promptInfluence: 0.5,
    pairedHapticNote: 'Fires when PotView.firePlanting() runs (ritualId transitions nil → some)',
    priority: 'high',
  },
  {
    id: 'ritual-sprout-celebration',
    label: 'Sprout Celebration (Day 7)',
    description:
      'The hero milestone sound. Plays when StageCelebrationView opens for a sprout transition. Single calming bowl tone with breath-like attack and release.',
    icon: <Sparkles className="w-4 h-4" />,
    category: 'milestone',
    file: 'ritual-sprout-celebration',
    prompt:
      'Soft singing bowl tone, peaceful breath-like attack and slow release, calming meditation chime, single warm mid-range tone, gentle resonance, no music, no speech',
    durationSeconds: 1.6,
    promptInfluence: 0.5,
    pairedHapticNote: 'StageCelebrationView with stage == .sprout',
    priority: 'high',
  },
  {
    id: 'ritual-bloom-celebration',
    label: 'Bloom Celebration (Day 28)',
    description:
      'Same family as Sprout but a fifth higher with a subtle harmonic shimmer overlay — reads as "richer" without being louder.',
    icon: <Sparkles className="w-4 h-4" />,
    category: 'milestone',
    file: 'ritual-bloom-celebration',
    prompt:
      'Soft singing bowl tone with a light harmonic shimmer overlay, peaceful breath-like attack and slow release, mid-high tone with gentle sparkle, calming and ceremonial, no music, no speech',
    durationSeconds: 1.9,
    promptInfluence: 0.55,
    pairedHapticNote: 'StageCelebrationView with stage == .bloom',
    priority: 'high',
  },
  {
    id: 'ritual-garden-lock',
    label: 'Garden Plant Locked',
    description:
      'Plays when the user confirms BloomLockView and a bloomed habit is moved into the Garden permanently. Slow-decay bell, longer than the bloom tone.',
    icon: <Sparkles className="w-4 h-4" />,
    category: 'milestone',
    file: 'ritual-garden-lock',
    prompt:
      'Slow-decay meditation bell, ceremonial single tone with long peaceful release, warm low-mid frequency, contemplative, no music, no speech',
    durationSeconds: 2.4,
    promptInfluence: 0.55,
    pairedHapticNote: 'Fires when RitualStore.lockBloomToGarden() runs from BloomLockView',
    priority: 'medium',
  },
  {
    id: 'ritual-expansion-pick',
    label: 'Sprout / Bloom Expansion Accepted',
    description:
      'Very short ascending shimmer when the user picks the next version of a routine from ProgressionEventView. Marks the commitment to the expanded habit.',
    icon: <CheckCircle className="w-4 h-4" />,
    category: 'milestone',
    file: 'ritual-expansion-pick',
    prompt:
      'Very short ascending shimmer, three quick gentle glass tones rising in pitch, peaceful affirmation, calming, very brief, no music, no speech',
    durationSeconds: 0.8,
    promptInfluence: 0.5,
    pairedHapticNote: 'Fires when ProgressionEventView onAccept callback runs (sproutPlant / bloomPlant)',
    priority: 'medium',
  },

  // ── Navigation & movement — lowest-priority polish. Risk of
  // becoming noise; ship only after the higher-tier sounds land well.
  {
    id: 'ritual-move-seed',
    label: 'Move Seed Between Pots',
    description:
      'Plays when the user moves a planted seed/sprout/bloom from one pot to another via the overflow menu.',
    icon: <Zap className="w-4 h-4" />,
    category: 'navigation',
    file: 'ritual-move-seed',
    prompt:
      'Soft whoosh slide, gentle airy transition tone, peaceful movement sound, very brief, calming, no music, no speech',
    durationSeconds: 0.7,
    promptInfluence: 0.4,
    pairedHapticNote: 'Fires when RitualStore.moveSeed() runs (DropCardView move menu)',
    priority: 'low',
  },
  {
    id: 'ritual-tab-change',
    label: 'Tab Change',
    description:
      'Bottom tab bar tap. Almost-silent felt tap — ship only if it adds to the feel rather than becoming noise.',
    icon: <Zap className="w-4 h-4" />,
    category: 'navigation',
    file: 'ritual-tab-change',
    prompt:
      'Almost-silent felt tap, very brief warm low tone, navigation feedback, soft and peaceful, very short, no music, no speech',
    durationSeconds: 0.3,
    promptInfluence: 0.35,
    pairedHapticNote: 'Tab switch in MainTabView / TabRouter',
    priority: 'low',
  },
  {
    id: 'ritual-rhythm-cell-tap',
    label: 'Rhythm Cell Tap',
    description:
      '28-day grid cell tap that opens DayDetailModalView. Could share asset with onboarding-pick; included separately in case you want a distinct timbre.',
    icon: <Zap className="w-4 h-4" />,
    category: 'navigation',
    file: 'ritual-rhythm-cell-tap',
    prompt:
      'Very soft glass tap, brief gentle ping, calming UI feedback, very short, no music, no speech',
    durationSeconds: 0.3,
    promptInfluence: 0.4,
    pairedHapticNote: 'HapticsService.selection() in RhythmView cell tap',
    priority: 'low',
  },

  // ── Onboarding "big moments" — fire once each per install. These
  // set the emotional ceiling for the whole product, so they're
  // higher priority than daily SFX even though they're rare.
  {
    id: 'ritual-welcome-orb-intro',
    label: 'Welcome Orb Intro',
    description:
      'Plays as the welcome orb scales in and the halo rings expand. First sound the user hears from Pulse Ritual.',
    icon: <Sparkles className="w-4 h-4" />,
    category: 'onboarding',
    file: 'ritual-welcome-orb-intro',
    prompt:
      'Long ambient inhale tone, breathy soft pad rising from silence, peaceful and meditative, very slow attack with gentle bloom, calming first-touch sound, no music, no speech',
    durationSeconds: 2.6,
    promptInfluence: 0.55,
    pairedHapticNote: 'WelcomeView.onAppear orb intro animation',
    priority: 'high',
  },
  {
    id: 'ritual-chip-trio-complete',
    label: 'Chip Selection Complete',
    description:
      'Quiet acknowledgement when the user finishes a multi-pick onboarding row (e.g. picked 2 of 2 Grow chips). Reads as "you\'re done here," not a celebration.',
    icon: <CheckCircle className="w-4 h-4" />,
    category: 'onboarding',
    file: 'ritual-chip-trio-complete',
    prompt:
      'Soft warm two-note settling tone, gentle felt resonance, peaceful acknowledgement, very brief, calming, no music, no speech',
    durationSeconds: 0.7,
    promptInfluence: 0.5,
    pairedHapticNote: 'GrowView / FallOffView when pick count hits the required max',
    priority: 'medium',
  },
  {
    id: 'ritual-picks-trio-complete',
    label: 'Ritual Picks Trio Complete',
    description:
      'Plays the moment the user lands the 3rd seed on the Ritual Picks screen. Three seed icons line up and briefly form a triangle constellation as this fires.',
    icon: <Sparkles className="w-4 h-4" />,
    category: 'onboarding',
    file: 'ritual-picks-trio-complete',
    prompt:
      'Short three-note ascending chord, soft glass bell harmonics, peaceful triad in the same key, gentle resonance, calming, very brief, no music, no speech',
    durationSeconds: 1.2,
    promptInfluence: 0.55,
    pairedHapticNote: 'RitualPicksView when all 3 seeds are picked',
    priority: 'high',
  },
  {
    id: 'ritual-reveal-handoff',
    label: 'Reveal Hand-off',
    description:
      'The hero onboarding moment. Plays during the orb-dissolves-into-3-seeds animation on the Reveal screen — combines a slow orb dissolve with three soft golden seed thuds as each seed lands in its phantom pot.',
    icon: <Sparkles className="w-4 h-4" />,
    category: 'onboarding',
    file: 'ritual-reveal-handoff',
    prompt:
      'Slow ambient orb dissolve sound followed by three soft warm earth thuds in sequence, gentle golden shimmer between the thuds, peaceful and ceremonial, calming first-ritual handoff moment, no music, no speech',
    durationSeconds: 3.2,
    promptInfluence: 0.55,
    pairedHapticNote: 'RevealView runIntro animation (orb-to-seeds transition)',
    priority: 'high',
  },
  {
    id: 'ritual-first-seed-ceremony',
    label: 'First Seed Ceremony',
    description:
      'Hero moment — fires the very first time a seed is planted (the user picks their first ritual on the Ritual Picks screen). Full-screen overlay teaches the three pillars: Mind, Body, Spirit. Ceremonial, slightly longer than the regular seed-planted sound.',
    icon: <Sparkles className="w-4 h-4" />,
    category: 'onboarding',
    file: 'ritual-first-seed-ceremony',
    prompt:
      'Slow ceremonial earth settle followed by a gentle ascending three-note chord, soft warm golden shimmer, peaceful and intentional, longer reverb tail than the regular seed-planted sound, calming first-ritual moment, no music, no speech',
    durationSeconds: 3.5,
    promptInfluence: 0.55,
    pairedHapticNote: 'RitualPicksView when pickedCount transitions 0 → 1',
    priority: 'high',
  },
  {
    id: 'ritual-start-watering-sweep',
    label: 'Start Watering Sunrise',
    description:
      'Plays as the "Start watering" tap cross-fades from the Reveal screen into the Today tab. Soft sunrise swell that resolves into a single water-tap as the user lands in the app.',
    icon: <Sparkles className="w-4 h-4" />,
    category: 'onboarding',
    file: 'ritual-start-watering-sweep',
    prompt:
      'Soft sunrise swell, warm pad gradually brightening over two seconds, resolving into a single gentle water droplet at the end, peaceful and welcoming, calming, no music, no speech',
    durationSeconds: 2.8,
    promptInfluence: 0.55,
    pairedHapticNote: 'RevealView "Start watering" CTA tap before onStart()',
    priority: 'high',
  },
];

// ──────────────────────────────────────────────────────────
// PULSECHECK MOMENT SFX
// Same generation pipeline as Pulse Ritual, different sonic
// identity: dark, premium, athletic — restrained impact over
// softness. Delivered to iOS via `pulsecheck-sfx-assets/{id}`
// (PulseCheck SoundService hydrates + caches on app open, so
// regens reach devices without an app rebuild).
// ──────────────────────────────────────────────────────────

const PULSECHECK_SOUNDS: PulseRitualSound[] = [
  {
    id: 'pulsecheck-path-step-advance',
    label: 'Path Step Advance',
    description:
      'Fires as a finished step fills in on the junior Path trail (spring pop + medium haptic). The most frequent moment sound — quiet, deep, satisfying, never a fanfare.',
    icon: <CheckCircle className="w-4 h-4" />,
    category: 'pulsecheck-moment',
    file: 'pulsecheck-path-step-advance',
    prompt:
      'Single deep soft percussive thump with a very short bright crystalline tick at the end, dark and premium, tight and dry, satisfying progress confirmation, very short, no music, no speech, no reverb tail',
    durationSeconds: 0.8,
    promptInfluence: 0.5,
    pairedHapticNote: 'HapticsService.stepAdvance() in JuniorPathView.syncMoments()',
    priority: 'high',
  },
  {
    id: 'pulsecheck-path-dot-stamp',
    label: 'Adherence Dot Stamp',
    description:
      'Fires once per day as today\'s Showing Up dot stamps in on the Path (rigid haptic). A firm stamp press — the sound of showing up.',
    icon: <CheckCircle className="w-4 h-4" />,
    category: 'pulsecheck-moment',
    file: 'pulsecheck-path-dot-stamp',
    prompt:
      'Quick firm rubber stamp press onto paper with a subtle low wooden thud, tight and dry, decisive and satisfying, very short, no music, no speech, no reverb tail',
    durationSeconds: 0.6,
    promptInfluence: 0.5,
    pairedHapticNote: 'HapticsService.stamp() in JuniorPathView.syncMoments()',
    priority: 'high',
  },
  {
    id: 'pulsecheck-rank-earned',
    label: 'Rank Earned',
    description:
      'Ceremony sound for passing a checkpoint gate and earning a rank (STEADY, LOCKED IN, CLUTCH...). Identity moment — restrained triumph, esports rank-up energy without cheese.',
    icon: <Sparkles className="w-4 h-4" />,
    category: 'pulsecheck-moment',
    file: 'pulsecheck-rank-earned',
    prompt:
      'Rising three-note synth swell resolving into a bright restrained metallic shimmer, dark arena atmosphere, modern esports rank-up, confident and premium, no cheesy fanfare, no music melody, no speech',
    durationSeconds: 2.4,
    promptInfluence: 0.55,
    pairedHapticNote: 'HapticsService.celebrate() — rank gate ceremony (upcoming)',
    priority: 'high',
  },
  {
    id: 'pulsecheck-trophy-earned',
    label: 'Trophy Earned',
    description:
      'An adherence milestone lands in the trophy case (First Step, 7 Days Strong, The Comeback...). Warm and golden, one beat of celebration.',
    icon: <Sparkles className="w-4 h-4" />,
    category: 'pulsecheck-moment',
    file: 'pulsecheck-trophy-earned',
    prompt:
      'Single warm golden bell strike with a soft short whoosh landing into place, celebratory but minimal and premium, brief sparkle decay, no music, no speech',
    durationSeconds: 1.6,
    promptInfluence: 0.5,
    pairedHapticNote: 'HapticsService.celebrate() — trophy fly-in (upcoming)',
    priority: 'medium',
  },
  {
    id: 'pulsecheck-season-unlock',
    label: 'Guided Season Unlock',
    description:
      'The finale: Foundation complete, the Guided Season lock opens. The single most produced moment in the app — cinematic arrival, gold giving way to teal.',
    icon: <Sparkles className="w-4 h-4" />,
    category: 'pulsecheck-moment',
    file: 'pulsecheck-season-unlock',
    prompt:
      'Heavy metal lock unlatching followed by a deep cinematic bloom swell with airy shimmer rising over two seconds, triumphant arrival, dark premium and emotional, no melody, no speech',
    durationSeconds: 3.5,
    promptInfluence: 0.55,
    pairedHapticNote: 'HapticsService.celebrate() — Foundation finale ceremony (upcoming)',
    priority: 'medium',
  },
  {
    id: 'pulsecheck-day-complete',
    label: 'All Three Trained',
    description:
      'Plays once per day on Home when the athlete finishes all three pillars. Quiet resolution, the day settling closed — heard daily, must never grate.',
    icon: <CheckCircle className="w-4 h-4" />,
    category: 'pulsecheck-moment',
    file: 'pulsecheck-day-complete',
    prompt:
      'Three quick soft ascending marimba-like notes resolving into a gentle warm settle, quiet daily completion, dark and calm, satisfying resolution, no reverb tail, no speech',
    durationSeconds: 1.4,
    promptInfluence: 0.5,
    pairedHapticNote: 'JuniorHomeView dayCompleteBanner appearance',
    priority: 'medium',
  },
];

// Navigation and selection utilities — heard dozens of times per
// session, so these must be the quietest sounds in the whole set.
// Near-subliminal texture, never a chime.
const PULSECHECK_UTILITY_SOUNDS: PulseRitualSound[] = [
  {
    id: 'pulsecheck-tab-change',
    label: 'Tab Change',
    description:
      'Main tab bar switch (Home / Path / Profile). The most frequent sound in the app — near-subliminal, must never grate.',
    icon: <Music className="w-4 h-4" />,
    category: 'pulsecheck-utility',
    file: 'pulsecheck-tab-change',
    prompt:
      'Very soft dark felt tap with a faint short airy sweep, minimal and premium, near-subliminal interface navigation tick, extremely short, no music, no speech, no reverb tail',
    durationSeconds: 0.4,
    promptInfluence: 0.45,
    pairedHapticNote: 'MainTabView selectedTab onChange, with HapticsService.selection()',
    priority: 'high',
  },
  {
    id: 'pulsecheck-select',
    label: 'Selection Tick',
    description:
      'Chip and option selection everywhere: check-in chips, reflection choices, pillar tabs, pickers. Played in quick succession — the softest sound in the set.',
    icon: <Music className="w-4 h-4" />,
    category: 'pulsecheck-utility',
    file: 'pulsecheck-select',
    prompt:
      'Tiny soft matte click like a smooth precise switch engaging, dark and quiet, the quietest possible confirmation tick, extremely short, no music, no speech, no reverb',
    durationSeconds: 0.35,
    promptInfluence: 0.45,
    pairedHapticNote: 'Alongside every HapticsService.selection() call (pillar tabs, chips)',
    priority: 'high',
  },
  {
    id: 'pulsecheck-primary-action',
    label: 'Primary Action',
    description:
      'Pressing a primary CTA that starts training: Start This Step, Start buttons on daily cards. A confident beginning, not a celebration.',
    icon: <Zap className="w-4 h-4" />,
    category: 'pulsecheck-utility',
    file: 'pulsecheck-primary-action',
    prompt:
      'Short confident soft low thud with a subtle brief rising airy accent, premium button press that starts something, dark and restrained, very short, no music, no speech',
    durationSeconds: 0.5,
    promptInfluence: 0.5,
    pairedHapticNote: 'Start buttons: JuniorPathView currentNodeCard, JuniorHomeView todo cards',
    priority: 'high',
  },
  {
    id: 'pulsecheck-drill-hit',
    label: 'Drill Hit',
    description:
      'Correct pick in a choice drill round (interactive modules). Tight and satisfying, restrained — the athlete hears this while training.',
    icon: <CheckCircle className="w-4 h-4" />,
    category: 'pulsecheck-utility',
    file: 'pulsecheck-drill-hit',
    prompt:
      'Quick bright soft ping with a tight satisfying snap, correct answer confirmation, modern and restrained, very short, no music, no speech, no reverb tail',
    durationSeconds: 0.6,
    promptInfluence: 0.5,
    pairedHapticNote: 'InteractiveModuleContent choice drill select() when isTarget',
    priority: 'medium',
  },
  {
    id: 'pulsecheck-drill-miss',
    label: 'Drill Miss',
    description:
      'Wrong pick in a choice drill round. Neutral information, never punishment — no buzzer energy, junior athletes hear this too.',
    icon: <Music className="w-4 h-4" />,
    category: 'pulsecheck-utility',
    file: 'pulsecheck-drill-miss',
    prompt:
      'Soft low muted double thud, gentle neutral miss cue, warm and dark, never harsh or punishing, very short, no buzzer, no music, no speech',
    durationSeconds: 0.5,
    promptInfluence: 0.5,
    pairedHapticNote: 'InteractiveModuleContent choice drill select() when not isTarget',
    priority: 'medium',
  },
];

const ALL_SFX_SOUNDS: PulseRitualSound[] = [...RITUAL_SOUNDS, ...PULSECHECK_SOUNDS, ...PULSECHECK_UTILITY_SOUNDS];

const RITUAL_CATEGORY_LABELS: Record<string, string> = {
  onboarding: 'Onboarding Moments',
  daily: 'Daily Cadence',
  milestone: 'Milestone Moments',
  navigation: 'Navigation & Movement',
  'pulsecheck-moment': 'PulseCheck · Path & Ceremony Moments',
  'pulsecheck-utility': 'PulseCheck · Navigation & Selection',
};

const RITUAL_CATEGORY_ORDER: PulseRitualSound['category'][] = ['onboarding', 'daily', 'milestone', 'navigation', 'pulsecheck-moment', 'pulsecheck-utility'];

const RITUAL_PRIORITY_BADGE: Record<PulseRitualSound['priority'], { label: string; classes: string }> = {
  high: { label: 'Priority · High', classes: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25' },
  medium: { label: 'Priority · Medium', classes: 'bg-amber-500/15 text-amber-300 border-amber-500/25' },
  low: { label: 'Priority · Low', classes: 'bg-zinc-700/40 text-zinc-400 border-zinc-700/50' },
};

// ──────────────────────────────────────────────────────────
// VISION PRO RESET — IMMERSIVE SOUND SETS
// Dynamically generated via ElevenLabs and stored in Firebase.
// These are spatial SFX tied to trial stage transitions in the
// visionOS immersive space, NOT static files from /public/audio.
// ──────────────────────────────────────────────────────────

const VP_ENGINE_KEY = 'vision-pro-reset';

interface VPCueDef {
  cueKey: string;
  label: string;
  description: string;
  stageTag: 'lockIn' | 'disruption' | 'recovery' | 'tap' | 'transition' | 'briefing' | 'countdown';
  generationMode: 'sfx' | 'speech';
  prompt: string;
  durationSeconds: number;
}

const VP_RESET_CUES: VPCueDef[] = [
  {
    cueKey: 'lockInAmbientDrone',
    label: 'Lock-In Drone',
    description: 'Ambient void hum during the pre-tap orb focus phase.',
    stageTag: 'lockIn',
    generationMode: 'sfx',
    prompt: 'Deep low-frequency meditation drone, subtle electronic void atmosphere, immersive spatial ambient hum, no music, no speech',
    durationSeconds: 5,
  },
  {
    cueKey: 'disruptionImpactSlam',
    label: 'Disruption Slam',
    description: 'Visceral pressure slam on disruption stage entry.',
    stageTag: 'disruption',
    generationMode: 'sfx',
    prompt: 'Sudden intense stadium crowd surge, sharp disruptive slam, competitive sports pressure sound, short and visceral, no music, no speech',
    durationSeconds: 3,
  },
  {
    cueKey: 'recoveryWindowPing',
    label: 'Recovery Ping',
    description: 'Urgent alert ping when the recovery window opens.',
    stageTag: 'recovery',
    generationMode: 'sfx',
    prompt: 'Clear urgent recovery signal ping, bright electronic alert tone, sports performance sound, crisp and attention-grabbing',
    durationSeconds: 2,
  },
  {
    cueKey: 'tapConfirmChime',
    label: 'Tap Confirm',
    description: 'Soft satisfying chime confirming the orb tap.',
    stageTag: 'tap',
    generationMode: 'sfx',
    prompt: 'Soft satisfying confirmation chime, brief tonal response, clean completion sound effect',
    durationSeconds: 1,
  },
  {
    cueKey: 'blockTransitionSettle',
    label: 'Block Settle',
    description: 'Quiet grounding tone between reps.',
    stageTag: 'transition',
    generationMode: 'sfx',
    prompt: 'Quiet settling tone, brief calm resolution, between-rep pause, subtle and grounding',
    durationSeconds: 2,
  },
  {
    cueKey: 'noraResetPreBriefIntro',
    label: 'Nora Intro Brief',
    description: 'Spoken explanation of the Reset chamber before measurement begins.',
    stageTag: 'briefing',
    generationMode: 'speech',
    prompt: "We're about to run Reset. First, hold your focus on the orb. When pressure appears, stay calm. Only pinch when the orb turns green. Early pinches count as false starts. Keep your eyes steady, recover quickly, and let the chamber measure how well you reset for the next play.",
    durationSeconds: 18,
  },
  {
    cueKey: 'noraResetReadyPrompt',
    label: 'Nora Ready Prompt',
    description: 'Spoken readiness prompt before the spoken countdown.',
    stageTag: 'briefing',
    generationMode: 'speech',
    prompt: 'Are you ready to begin? Say yes when you are ready.',
    durationSeconds: 4,
  },
  {
    cueKey: 'noraResetCountdown3',
    label: 'Countdown 3',
    description: 'Spoken countdown signal: 3.',
    stageTag: 'countdown',
    generationMode: 'speech',
    prompt: 'Three.',
    durationSeconds: 1,
  },
  {
    cueKey: 'noraResetCountdown2',
    label: 'Countdown 2',
    description: 'Spoken countdown signal: 2.',
    stageTag: 'countdown',
    generationMode: 'speech',
    prompt: 'Two.',
    durationSeconds: 1,
  },
  {
    cueKey: 'noraResetCountdown1',
    label: 'Countdown 1',
    description: 'Spoken countdown signal: 1.',
    stageTag: 'countdown',
    generationMode: 'speech',
    prompt: 'One.',
    durationSeconds: 1,
  },
  {
    cueKey: 'noraResetCountdownBegin',
    label: 'Countdown Begin',
    description: 'Spoken start signal that hands off into measurement.',
    stageTag: 'countdown',
    generationMode: 'speech',
    prompt: 'Begin.',
    durationSeconds: 1,
  },
];

const VP_STAGE_PALETTE: Record<VPCueDef['stageTag'], { label: string; color: string; dimColor: string }> = {
  lockIn:     { label: 'Lock-In',     color: '#00D4AA', dimColor: 'rgba(0,212,170,0.15)' },
  disruption: { label: 'Disruption',  color: '#FF453A', dimColor: 'rgba(255,69,58,0.15)' },
  recovery:   { label: 'Recovery',    color: '#30D158', dimColor: 'rgba(48,209,88,0.15)'  },
  tap:        { label: 'Tap',         color: '#00D4AA', dimColor: 'rgba(0,212,170,0.12)'  },
  transition: { label: 'Transition',  color: '#8E8E93', dimColor: 'rgba(142,142,147,0.12)'},
  briefing:   { label: 'Pre-Brief',   color: '#8B5CF6', dimColor: 'rgba(139,92,246,0.15)' },
  countdown:  { label: 'Countdown',   color: '#FFD60A', dimColor: 'rgba(255,214,10,0.15)' },
};

type AdminAudioTab = 'coverage' | 'voice' | 'moduleNarrations' | 'macraOnboarding' | 'pulseCheckTutorial' | 'appLibrary' | 'pulseCheckAppSounds' | 'ritual' | 'pulsecheckSfx' | 'registrySims' | 'visionPro' | 'protocols' | 'runAlerts';

// Every spoken line Nora narrates across sims and protocols, derived from
// the module configs so stored clips byte-match runtime speech.
const MODULE_NARRATION_SCRIPTS: ModuleNarrationScript[] = buildModuleNarrationScripts();

// ── Coverage audit (read-only rollup of every expected cue vs sim-audio-assets) ──
type CoverageRow = {
  label: string;
  cueKey: string;
  present: boolean;
};

type CoverageSection = {
  id: string;
  title: string;
  generateHint: string;
  rows: CoverageRow[];
  note?: string;
};

type RegistrySimAudioAssetEntry = {
  variantId: string;
  variantName: string;
  family: string;
  engineKey: string | null;
  archetype: string | null;
  buildStatus: string | null;
  publishedModuleId: string | null;
  cueKey: string;
  asset: SimAudioAssetRef;
};

type ProtocolCueDef = {
  cueKey: string;
  protocolId: string;
  label: string;
  protocolClass: 'regulation' | 'priming' | 'recovery';
  responseFamily: string;
  description: string;
  prompt: string;
  durationSeconds: number;
  runtimeRole?: 'signature' | 'transition' | 'ambient';
  loop?: boolean;
  promptInfluence?: number;
};

const PROTOCOL_ENGINE_KEY = 'pulsecheck-protocols';

const PROTOCOL_CLASS_PALETTE: Record<ProtocolCueDef['protocolClass'], { label: string; color: string; dimColor: string }> = {
  regulation: { label: 'Regulation', color: '#38BDF8', dimColor: 'rgba(56,189,248,0.14)' },
  priming: { label: 'Priming', color: '#F59E0B', dimColor: 'rgba(245,158,11,0.14)' },
  recovery: { label: 'Recovery', color: '#34D399', dimColor: 'rgba(52,211,153,0.14)' },
};

function buildProtocolCuePrompt(record: Pick<ProtocolCueDef, 'label' | 'protocolClass' | 'responseFamily'>) {
  switch (record.responseFamily) {
    case 'acute_downshift':
      return 'A soft but immediate physiological reset phrase, airy inhale shimmer followed by a long exhale release, calming, precise, no music, no speech.';
    case 'steady_regulation':
      return 'A balanced paced-breath signal, even pulse, composed and grounded, subtle performance breathing signal, no music, no speech.';
    case 'focus_narrowing':
      return record.protocolClass === 'priming'
        ? 'A sharp attentional lock signal, focused click-chime hybrid, clean and precise, preparing the next action, no music, no speech.'
        : 'A body-awareness narrowing signal, soft inward bell with grounded resonance, calming and precise, no music, no speech.';
    case 'cognitive_reframe':
      return 'An uplifted reframing signal, bright but controlled rise, pressure becoming opportunity, short and motivating, no speech.';
    case 'activation_upshift':
      return 'A compact energizing activation hit, inhale-led surge with athletic readiness, crisp and controlled, no music, no speech.';
    case 'imagery_priming':
      return 'A cinematic execution-prime signal, clean anticipatory shimmer with focused forward motion, vivid but restrained, no speech.';
    case 'confidence_priming':
      return 'A poised embodied confidence signal, upright and expansive tonal lift, subtle authority without hype, no speech.';
    case 'recovery_downregulation':
      return 'A deep recovery signal, slow resolving breath-like tone, soft parasympathetic downshift, restorative and spacious, no speech.';
    case 'recovery_reflection':
      return 'A reflective post-session signal, grounded piano-like tone bed with quiet resolution, thoughtful and steady, no speech.';
    default:
      return `${record.label} protocol signature sound, athletic mental training sound effect, polished, short, no speech.`;
  }
}

function buildProtocolCueDescription(record: Pick<ProtocolCueDef, 'label' | 'protocolClass' | 'responseFamily'>) {
  switch (record.protocolClass) {
    case 'regulation':
      return `Signature start signal for ${record.label}, tuned for calming, composure, and state control.`;
    case 'priming':
      return `Signature start signal for ${record.label}, tuned for readiness, precision, and competitive entry.`;
    case 'recovery':
      return `Signature start signal for ${record.label}, tuned for downshift, processing, and recovery posture.`;
    default:
      return `Signature sound for ${record.label}.`;
  }
}

const PROTOCOL_SIGNATURE_CUES: ProtocolCueDef[] = (protocolSeed as Array<{
  id: string;
  label: string;
  protocolClass: 'regulation' | 'priming' | 'recovery';
  responseFamily: string;
}>).map((record) => ({
  cueKey: `${record.id}-signature`,
  protocolId: record.id,
  label: `${record.label} Signature`,
  protocolClass: record.protocolClass,
  responseFamily: record.responseFamily,
  description: buildProtocolCueDescription(record),
  prompt: buildProtocolCuePrompt(record),
  durationSeconds: record.protocolClass === 'recovery' ? 6 : record.protocolClass === 'priming' ? 3 : 4,
  runtimeRole: 'signature',
}));

const BODY_SCAN_RUNTIME_CUES: ProtocolCueDef[] = [
  {
    cueKey: 'protocol-body-scan-reset-body-scan-transition',
    protocolId: 'protocol-body-scan-reset',
    label: 'Body Scan Transition Signal',
    protocolClass: 'regulation',
    responseFamily: 'focus_narrowing',
    runtimeRole: 'transition',
    description: 'Soft step-transition signal for Body Scan Awareness so quiet holds feel active instead of stalled.',
    prompt:
      'A very soft calming transition signal for a guided body scan: breath-like airy chime, warm glass resonance, gentle exhale tail, subtle and reassuring, no melody, no music, no speech.',
    durationSeconds: 2,
    promptInfluence: 0.42,
  },
  {
    cueKey: 'protocol-body-scan-reset-body-scan-ambient',
    protocolId: 'protocol-body-scan-reset',
    label: 'Body Scan Ambient Bed',
    protocolClass: 'regulation',
    responseFamily: 'focus_narrowing',
    runtimeRole: 'ambient',
    description: 'Looping calming white ambient bed under Body Scan Awareness while Nora guides the user hands-free.',
    prompt:
      'Seamless looping calming white ambient background sound for a guided body scan: soft warm white noise, gentle air tone, very subtle low cushion, meditative, no melody, no music, no water, no speech, no birds, no harsh hiss.',
    durationSeconds: 8,
    loop: true,
    promptInfluence: 0.48,
  },
];

const PROTOCOL_SOUND_CUES: ProtocolCueDef[] = [
  ...PROTOCOL_SIGNATURE_CUES,
  ...BODY_SCAN_RUNTIME_CUES,
];

type RunAlertCueDef = {
  cueKey: string;
  label: string;
  intent: 'phonePlacement' | 'stillActive';
  description: string;
  prompt: string;
  durationSeconds: number;
  bundleTarget: string;
};

const RUN_ALERT_ENGINE_KEY = 'community-run-alerts';

type FixedNarrationCue = {
  cueKey: string;
  label: string;
  stepIndex: number;
  prompt: string;
};

type MacraOnboardingNarrationCue = FixedNarrationCue;
type PulseCheckTutorialNarrationCue = FixedNarrationCue;

const MACRA_ONBOARDING_ENGINE_KEY = 'macra-onboarding';
const PULSECHECK_TUTORIAL_ENGINE_KEY = 'pulsecheck-home-tutorial';
const PULSECHECK_TUTORIAL_NARRATION_CONFIG_FIELD = 'pulseCheckTutorialNarrations';

const MACRA_ONBOARDING_NARRATION_CUES: MacraOnboardingNarrationCue[] = [
  {
    cueKey: 'welcome',
    label: 'Welcome',
    stepIndex: 1,
    prompt: 'Welcome to Macra. I am Nora. I will help turn your goal into numbers, meals, and decisions you can actually follow.',
  },
  {
    cueKey: 'primary_focus',
    label: 'Primary Focus',
    stepIndex: 2,
    prompt: 'Before the numbers, tell me what you want food to help with most. I will use that to shape the plan around your real life.',
  },
  {
    cueKey: 'primary_focus_selection_loseBodyFat',
    label: 'Primary Focus · Lose Body Fat',
    stepIndex: 2,
    prompt: "Good. I'll shape the plan around: lose body fat.",
  },
  {
    cueKey: 'primary_focus_selection_buildMuscle',
    label: 'Primary Focus · Build Muscle',
    stepIndex: 2,
    prompt: "Good. I'll shape the plan around: build muscle.",
  },
  {
    cueKey: 'primary_focus_selection_eatConsistently',
    label: 'Primary Focus · Eat Consistently',
    stepIndex: 2,
    prompt: "Good. I'll shape the plan around: eat with more consistency.",
  },
  {
    cueKey: 'primary_focus_selection_stopGuessing',
    label: 'Primary Focus · Stop Guessing',
    stepIndex: 2,
    prompt: "Good. I'll shape the plan around: stop guessing what fits.",
  },
  {
    cueKey: 'primary_focus_selection_supportTraining',
    label: 'Primary Focus · Support Training',
    stepIndex: 2,
    prompt: "Good. I'll shape the plan around: support training days.",
  },
  {
    cueKey: 'meet_nora',
    label: 'Meet Nora',
    stepIndex: 2,
    prompt: 'I am here to make food feel less random. Answer a few questions, and I will shape the plan around your body and your life.',
  },
  {
    cueKey: 'coach_assigned_plan',
    label: 'Coach Assigned Plan',
    stepIndex: 3,
    prompt: 'I found a coach assigned plan for you. If this is the plan you want to use, I can bring it into Macra and keep your nutrition aligned.',
  },
  {
    cueKey: 'fwp_macros_handoff',
    label: 'FWP Macros Handoff',
    stepIndex: 4,
    prompt: 'I found macro targets from your Fit With Pulse profile. You can use those here, or we can reassess them together.',
  },
  {
    cueKey: 'sex',
    label: 'Sex',
    stepIndex: 5,
    prompt: 'First, choose the biological sex you want me to use for your calorie and macro estimate.',
  },
  {
    cueKey: 'age',
    label: 'Age',
    stepIndex: 6,
    prompt: 'Next, add your age. This helps me estimate your baseline needs more accurately.',
  },
  {
    cueKey: 'height',
    label: 'Height',
    stepIndex: 7,
    prompt: 'Now add your height. I use it with your weight and activity to build a better starting target.',
  },
  {
    cueKey: 'current_weight',
    label: 'Current Weight',
    stepIndex: 8,
    prompt: 'Tell me where you are starting today. This is just the baseline, not a judgment.',
  },
  {
    cueKey: 'goal_weight',
    label: 'Goal Weight',
    stepIndex: 9,
    prompt: 'Now choose the weight you want to move toward. I will use this to shape the pace of your plan.',
  },
  {
    cueKey: 'pace',
    label: 'Pace',
    stepIndex: 10,
    prompt: 'Pick the pace that feels sustainable. Faster is not always better if it makes the plan harder to live with.',
  },
  {
    cueKey: 'activity_level',
    label: 'Activity Level',
    stepIndex: 11,
    prompt: 'Choose the activity level that best matches your normal week. If you regularly play a sport, choose athlete and I will ask which one.',
  },
  {
    cueKey: 'sport_selection',
    label: 'Sport Selection',
    stepIndex: 12,
    prompt: 'Choose the sport you play most often. I will use it to tune fueling, training days, and game day recommendations.',
  },
  {
    cueKey: 'dietary_preference',
    label: 'Dietary Preference',
    stepIndex: 13,
    prompt: 'Tell me any dietary preference you want respected. I will tailor meal suggestions around it.',
  },
  {
    cueKey: 'biggest_struggle',
    label: 'Biggest Struggle',
    stepIndex: 14,
    prompt: 'Choose the thing that usually breaks the plan for you. This tells me where to coach hardest.',
  },
  {
    cueKey: 'generating_plan',
    label: 'Generating Plan',
    stepIndex: 15,
    prompt: 'I am turning your answers into a calorie target, macro targets, and a simple starting plan.',
  },
  {
    cueKey: 'prediction',
    label: 'Prediction',
    stepIndex: 16,
    prompt: 'Here is the projected path. These numbers are a starting point, and I will adapt as your real logs come in.',
  },
  {
    cueKey: 'plan_ready',
    label: 'Plan Ready',
    stepIndex: 17,
    prompt: 'I start with simple meals that fit your numbers. The more you log, the more I learn what you like, what you dislike, and how to make the plan more personal.',
  },
  {
    cueKey: 'features',
    label: 'Features',
    stepIndex: 18,
    prompt: 'These are the tools I will use with you: photo logging, macro targets, labels, meal planning, and daily coaching.',
  },
  {
    cueKey: 'notification_preferences',
    label: 'Notification Preferences',
    stepIndex: 19,
    prompt: 'Before you unlock Macra, choose when you want me to pull you back on track. This is your first commitment to the plan.',
  },
  {
    cueKey: 'commit_trial',
    label: 'Commit Trial',
    stepIndex: 20,
    prompt: 'Your plan is ready. Unlock Macra to start using your targets, meal plan, scanner, and Nora coaching.',
  },
];

const PULSECHECK_TUTORIAL_NARRATION_CUES: PulseCheckTutorialNarrationCue[] = [
  {
    cueKey: 'goal',
    label: 'The Goal',
    stepIndex: 1,
    prompt: 'Hey, this is the lay of the land. PulseCheck trains the mental side of performance: composure, focus, and decision control under pressure.',
  },
  {
    cueKey: 'protocols',
    label: 'Protocols',
    stepIndex: 2,
    prompt: 'Protocols are guided training for regulation. They help athletes settle emotion, steady the body, and recover focus before the next moment.',
  },
  {
    cueKey: 'sims',
    label: 'Sims',
    stepIndex: 3,
    prompt: 'Sims sharpen cognitive skills: attention, inhibition, decision speed, and pressure reading. They make the mind faster and cleaner in live sport.',
  },
  {
    cueKey: 'automaticity',
    label: 'Automaticity',
    stepIndex: 4,
    prompt: 'Automaticity means the right response starts without a long internal debate. The goal is muscle memory for the mind, so trained patterns move closer to subconscious response in game moments.',
  },
];

const RUN_ALERT_PALETTE: Record<RunAlertCueDef['intent'], { label: string; color: string; dimColor: string }> = {
  phonePlacement: { label: 'Phone Placement', color: '#F97316', dimColor: 'rgba(249,115,22,0.14)' },
  stillActive: { label: 'Still Active', color: '#E0FE10', dimColor: 'rgba(224,254,16,0.12)' },
};

const RUN_ALERT_CUES: RunAlertCueDef[] = [
  {
    cueKey: 'phone-on-body-reminder',
    label: 'Phone On Body Reminder',
    intent: 'phonePlacement',
    description: 'Long, assertive spoken alert for runs where the phone is no longer moving with the athlete.',
    prompt: 'Pulse alert. Keep your phone on your body so distance and pace stay accurate. Pick it up and keep it with you now.',
    durationSeconds: 7,
    bundleTarget: 'run-phone-on-body-alert.mp3',
  },
  {
    cueKey: 'still-active-run-reminder',
    label: 'Still Active Run Reminder',
    intent: 'stillActive',
    description: 'Long spoken reminder for sessions that appear finished but are still running in the app.',
    prompt: 'Pulse alert. Your run is still active. If you finished, open the app and end your run now so your summary stays accurate.',
    durationSeconds: 8,
    bundleTarget: 'run-still-active-alert.mp3',
  },
];

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

function buildGeneratedDocId(engineKey: string, cueKey: string, prompt: string) {
  return `sfx-${vpSlugify(engineKey)}-${cueKey}-${vpHashString(prompt)}`;
}

const AudioTabButton: React.FC<{
  active: boolean;
  icon: React.ReactNode;
  label: string;
  description: string;
  onClick: () => void;
}> = ({ active, icon, label, description, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={`flex min-w-[170px] flex-1 items-start gap-3 rounded-2xl border px-4 py-3 text-left transition-all ${
      active
        ? 'border-[#E0FE10]/30 bg-[#E0FE10]/10 text-white shadow-[0_10px_40px_rgba(224,254,16,0.08)]'
        : 'border-white/[0.08] bg-white/[0.02] text-zinc-300 hover:border-white/[0.14] hover:bg-white/[0.04]'
    }`}
  >
    <div className={`mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl ${active ? 'bg-[#E0FE10]/15 text-[#E0FE10]' : 'bg-white/5 text-zinc-500'}`}>
      {icon}
    </div>
    <div className="min-w-0">
      <div className="text-sm font-semibold">{label}</div>
      <div className="mt-1 text-xs leading-relaxed text-zinc-500">{description}</div>
    </div>
  </button>
);

const RegistrySimAssetCard: React.FC<{
  entry: RegistrySimAudioAssetEntry;
  isPlaying: boolean;
  onPlay: () => void;
  onStop: () => void;
}> = ({ entry, isPlaying, onPlay, onStop }) => (
  <motion.div
    layout
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    className={`rounded-xl border p-4 transition-all duration-200 ${
      isPlaying
        ? 'border-cyan-400/30 bg-cyan-400/5'
        : 'border-white/[0.07] bg-white/[0.02] hover:border-white/[0.12] hover:bg-white/[0.04]'
    }`}
  >
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-white">{entry.asset.label}</span>
          <span className="rounded-md border border-cyan-500/20 bg-cyan-500/10 px-1.5 py-0.5 text-[10px] font-medium text-cyan-200">
            {entry.cueKey}
          </span>
          <span className="rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] font-medium text-zinc-400">
            {entry.asset.provider}
          </span>
        </div>
        <p className="mt-1 text-xs leading-relaxed text-zinc-500">{entry.asset.prompt}</p>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-zinc-600">
          <span>Variant: {entry.variantName}</span>
          {entry.buildStatus ? (
            <>
              <span>•</span>
              <span>{entry.buildStatus}</span>
            </>
          ) : null}
          {entry.publishedModuleId ? (
            <>
              <span>•</span>
              <span>{entry.publishedModuleId}</span>
            </>
          ) : null}
        </div>
      </div>

      <button
        onClick={isPlaying ? onStop : onPlay}
        className={`flex-shrink-0 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
          isPlaying
            ? 'border border-cyan-400/25 bg-cyan-400/15 text-cyan-200 hover:bg-cyan-400/20'
            : 'border border-zinc-700 bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white'
        }`}
      >
        {isPlaying ? (
          <>
            <Square className="h-3 w-3" /> Stop
          </>
        ) : (
          <>
            <Play className="h-3 w-3" /> Preview
          </>
        )}
      </button>
    </div>

    <div className="mt-3 rounded-lg border border-white/[0.04] bg-zinc-950/60 px-2 py-1.5">
      <code className="break-all text-[10px] font-mono text-zinc-600">{entry.asset.storagePath}</code>
    </div>
  </motion.div>
);

// ──────────────────────────────────────────────────────────
// SOUND CARD
// ──────────────────────────────────────────────────────────
const SoundCard: React.FC<{
  sound: typeof SOUND_EFFECTS[0];
  asset: SimAudioAssetRef | null;
  generating: boolean;
  generationError?: string;
  isPlaying: boolean;
  onRegenerate: () => void;
  onPlay: () => void;
  onStop: () => void;
}> = ({ sound, asset, generating, generationError, isPlaying, onRegenerate, onPlay, onStop }) => {
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
              {asset?.downloadURL && (
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md border border-emerald-700/30 bg-emerald-900/20 text-emerald-400">
                  Generated
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-500 mt-0.5 leading-relaxed">{sound.description}</p>
            <code className="text-[10px] text-zinc-600 font-mono mt-1 block">
              {sound.durationSeconds}s · {sound.generationMode === 'speech' ? 'ElevenLabs voice' : 'OpenAI SFX'} · {sound.file}.mp3
            </code>
          </div>
        </div>

        <div className="flex flex-shrink-0 flex-col gap-1.5">
          <button
            onClick={onRegenerate}
            disabled={generating}
            className={`flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
              generating
                ? 'cursor-wait border-purple-500/25 bg-purple-500/10 text-purple-300'
                : 'border-purple-500/30 bg-purple-500/15 text-purple-300 hover:bg-purple-500/20'
            }`}
          >
            {generating
              ? <><Loader2 className="w-3 h-3 animate-spin" />Generating</>
              : <><RotateCcw className="w-3 h-3" />Regenerate</>}
          </button>
          <button
            onClick={isPlaying ? onStop : onPlay}
            disabled={generating}
            className={`flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-50 ${
              isPlaying
                ? 'bg-[#E0FE10]/15 border border-[#E0FE10]/25 text-[#E0FE10] hover:bg-[#E0FE10]/20'
                : 'bg-zinc-800 border border-zinc-700 text-zinc-300 hover:bg-zinc-700 hover:text-white'
            }`}
          >
            {isPlaying ? <><Square className="w-3 h-3" />Stop</> : <><Play className="w-3 h-3" />Preview</>}
          </button>
        </div>
      </div>

      {generationError && (
        <div className="mt-3 rounded-lg border border-red-700/40 bg-red-900/20 px-3 py-2 text-[11px] text-red-200">
          {generationError}
        </div>
      )}

      {asset?.downloadURL && (
        <div className="mt-3 rounded-lg border border-emerald-700/30 bg-emerald-900/10 px-3 py-2 text-[10px] text-emerald-300/80">
          <span className="mr-1.5 uppercase tracking-wider text-emerald-400/70">Saved</span>
          {new Date(asset.updatedAt).toLocaleString()} · <code className="break-all font-mono">{asset.storagePath}</code>
        </div>
      )}

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
          <code className="text-[10px] text-zinc-600 font-mono mt-1 block">
            {cue.durationSeconds}s · {cue.generationMode === 'speech' ? 'ElevenLabs / Nora voice line' : 'OpenAI SFX'} · {cue.cueKey}
          </code>
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

const ProtocolSoundCard: React.FC<{
  cue: ProtocolCueDef;
  asset: SimAudioAssetRef | null;
  generating: boolean;
  isPlaying: boolean;
  onGenerate: () => void;
  onPlay: () => void;
  onStop: () => void;
}> = ({ cue, asset, generating, isPlaying, onGenerate, onPlay, onStop }) => {
  const palette = PROTOCOL_CLASS_PALETTE[cue.protocolClass];
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
        <div
          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg"
          style={{ background: palette.dimColor, border: `1px solid ${palette.color}30` }}
        >
          <Music className="h-4 w-4" style={{ color: palette.color }} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-white">{cue.label}</span>
            <span
              className="rounded-md border px-1.5 py-0.5 text-[10px] font-semibold"
              style={{ color: palette.color, background: palette.dimColor, borderColor: `${palette.color}30` }}
            >
              {palette.label}
            </span>
            <span className="rounded-md border border-white/[0.08] bg-white/[0.03] px-1.5 py-0.5 text-[10px] font-medium text-zinc-400">
              {cue.responseFamily.replace(/_/g, ' ')}
            </span>
            {generating ? (
              <span className="flex items-center gap-1 rounded-md border border-amber-700/30 bg-amber-900/20 px-1.5 py-0.5 text-[10px] font-medium text-amber-300">
                <Loader2 className="h-2.5 w-2.5 animate-spin" />Generating…
              </span>
            ) : isReady ? (
              <span className="rounded-md border border-emerald-700/30 bg-emerald-900/20 px-1.5 py-0.5 text-[10px] font-medium text-emerald-400">
                Ready
              </span>
            ) : (
              <span className="rounded-md border border-zinc-700 bg-zinc-800 px-1.5 py-0.5 text-[10px] font-medium text-zinc-500">
                Not Generated
              </span>
            )}
          </div>
          <p className="mt-1 text-xs leading-relaxed text-zinc-500">{cue.description}</p>
          <code className="mt-1 block text-[10px] font-mono text-zinc-600">
            {cue.durationSeconds}s · OpenAI SFX · {cue.runtimeRole ?? 'signature'}{cue.loop ? ' · loop' : ''} · {cue.protocolId}
          </code>
        </div>

        <div className="flex flex-shrink-0 items-center gap-1.5">
          {isReady && !generating && (
            <button
              onClick={isPlaying ? onStop : onPlay}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                isPlaying
                  ? 'border border-white/20 bg-white/10 text-white hover:bg-white/15'
                  : 'border border-zinc-700 bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white'
              }`}
            >
              {isPlaying ? <><Square className="h-3 w-3" />Stop</> : <><Play className="h-3 w-3" />Preview</>}
            </button>
          )}
          <button
            onClick={onGenerate}
            disabled={generating}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
              generating
                ? 'cursor-not-allowed border border-zinc-700 bg-zinc-800 text-zinc-500'
                : isReady
                  ? 'border border-zinc-700 bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white'
                  : 'border bg-white/5 text-white hover:bg-white/10'
            }`}
            style={!generating && !isReady ? { borderColor: `${palette.color}40`, color: palette.color, background: palette.dimColor } : undefined}
          >
            {generating ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : isReady ? (
              <><RotateCcw className="h-3 w-3" />Regen</>
            ) : (
              <><Wand2 className="h-3 w-3" />Generate</>
            )}
          </button>
        </div>
      </div>

      {isPlaying && (
        <div className="mt-3 flex h-4 items-center gap-0.5">
          {Array.from({ length: 20 }).map((_, i) => (
            <motion.div
              key={i}
              className="w-1 rounded-full"
              style={{ background: palette.color }}
              animate={{ height: ['4px', `${Math.random() * 14 + 4}px`, '4px'] }}
              transition={{ duration: 0.5 + Math.random() * 0.4, repeat: Infinity, delay: i * 0.07, ease: 'easeInOut' }}
            />
          ))}
        </div>
      )}

      {isReady && asset && (
        <div className="mt-2 rounded-lg border border-white/[0.04] bg-zinc-950/60 px-2 py-1.5">
          <code className="break-all text-[10px] font-mono text-zinc-600">{asset.storagePath}</code>
        </div>
      )}
    </motion.div>
  );
};

const RunAlertSoundCard: React.FC<{
  cue: RunAlertCueDef;
  asset: SimAudioAssetRef | null;
  generating: boolean;
  isPlaying: boolean;
  onGenerate: () => void;
  onPlay: () => void;
  onStop: () => void;
}> = ({ cue, asset, generating, isPlaying, onGenerate, onPlay, onStop }) => {
  const palette = RUN_ALERT_PALETTE[cue.intent];
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
        <div
          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg"
          style={{ background: palette.dimColor, border: `1px solid ${palette.color}30` }}
        >
          <Bell className="h-4 w-4" style={{ color: palette.color }} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-white">{cue.label}</span>
            <span
              className="rounded-md border px-1.5 py-0.5 text-[10px] font-semibold"
              style={{ color: palette.color, background: palette.dimColor, borderColor: `${palette.color}30` }}
            >
              {palette.label}
            </span>
            <span className="rounded-md border border-white/[0.08] bg-white/[0.03] px-1.5 py-0.5 text-[10px] font-medium text-zinc-400">
              iOS alert voice
            </span>
            {generating ? (
              <span className="flex items-center gap-1 rounded-md border border-amber-700/30 bg-amber-900/20 px-1.5 py-0.5 text-[10px] font-medium text-amber-300">
                <Loader2 className="h-2.5 w-2.5 animate-spin" />Generating…
              </span>
            ) : isReady ? (
              <span className="rounded-md border border-emerald-700/30 bg-emerald-900/20 px-1.5 py-0.5 text-[10px] font-medium text-emerald-400">
                Ready
              </span>
            ) : (
              <span className="rounded-md border border-zinc-700 bg-zinc-800 px-1.5 py-0.5 text-[10px] font-medium text-zinc-500">
                Not Generated
              </span>
            )}
          </div>
          <p className="mt-1 text-xs leading-relaxed text-zinc-500">{cue.description}</p>
          <code className="mt-1 block text-[10px] font-mono text-zinc-600">
            {cue.durationSeconds}s · ElevenLabs speech · {cue.bundleTarget}
          </code>
        </div>

        <div className="flex flex-shrink-0 items-center gap-1.5">
          {isReady && !generating && (
            <button
              onClick={isPlaying ? onStop : onPlay}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                isPlaying
                  ? 'border border-white/20 bg-white/10 text-white hover:bg-white/15'
                  : 'border border-zinc-700 bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white'
              }`}
            >
              {isPlaying ? <><Square className="h-3 w-3" />Stop</> : <><Play className="h-3 w-3" />Preview</>}
            </button>
          )}
          <button
            onClick={onGenerate}
            disabled={generating}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
              generating
                ? 'cursor-not-allowed border border-zinc-700 bg-zinc-800 text-zinc-500'
                : isReady
                  ? 'border border-zinc-700 bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white'
                  : 'border bg-white/5 text-white hover:bg-white/10'
            }`}
            style={!generating && !isReady ? { borderColor: `${palette.color}40`, color: palette.color, background: palette.dimColor } : undefined}
          >
            {generating ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : isReady ? (
              <><RotateCcw className="h-3 w-3" />Regen</>
            ) : (
              <><Wand2 className="h-3 w-3" />Generate</>
            )}
          </button>
        </div>
      </div>

      {isPlaying && (
        <div className="mt-3 flex h-4 items-center gap-0.5">
          {Array.from({ length: 20 }).map((_, i) => (
            <motion.div
              key={i}
              className="w-1 rounded-full"
              style={{ background: palette.color }}
              animate={{ height: ['4px', `${Math.random() * 14 + 4}px`, '4px'] }}
              transition={{ duration: 0.5 + Math.random() * 0.4, repeat: Infinity, delay: i * 0.07, ease: 'easeInOut' }}
            />
          ))}
        </div>
      )}

      {isReady && asset && (
        <div className="mt-2 rounded-lg border border-white/[0.04] bg-zinc-950/60 px-2 py-1.5">
          <code className="break-all text-[10px] font-mono text-zinc-600">{asset.storagePath}</code>
        </div>
      )}
    </motion.div>
  );
};

const FixedNarrationCard: React.FC<{
  cue: FixedNarrationCue;
  asset: SimAudioAssetRef | null;
  generating: boolean;
  isPlaying: boolean;
  onGenerate: () => void;
  onPlay: () => void;
  onStop: () => void;
}> = ({ cue, asset, generating, isPlaying, onGenerate, onPlay, onStop }) => {
  const isReady = Boolean(asset?.downloadURL);

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
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-[#E0FE10]/25 bg-[#E0FE10]/12">
          <Smartphone className="h-4 w-4 text-[#E0FE10]" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-white">{cue.label}</span>
            <span className="rounded-md border border-[#E0FE10]/20 bg-[#E0FE10]/10 px-1.5 py-0.5 text-[10px] font-semibold text-[#E0FE10]">
              Step {cue.stepIndex}
            </span>
            <span className="rounded-md border border-white/[0.08] bg-white/[0.03] px-1.5 py-0.5 text-[10px] font-medium text-zinc-400">
              {cue.cueKey}
            </span>
            {generating ? (
              <span className="flex items-center gap-1 rounded-md border border-amber-700/30 bg-amber-900/20 px-1.5 py-0.5 text-[10px] font-medium text-amber-300">
                <Loader2 className="h-2.5 w-2.5 animate-spin" />Generating…
              </span>
            ) : isReady ? (
              <span className="rounded-md border border-emerald-700/30 bg-emerald-900/20 px-1.5 py-0.5 text-[10px] font-medium text-emerald-400">
                Ready
              </span>
            ) : (
              <span className="rounded-md border border-zinc-700 bg-zinc-800 px-1.5 py-0.5 text-[10px] font-medium text-zinc-500">
                Not Generated
              </span>
            )}
          </div>
          <p className="mt-1 text-xs leading-relaxed text-zinc-400">{cue.prompt}</p>
          {isReady && asset ? (
            <code className="mt-2 block break-all text-[10px] font-mono text-zinc-600">{asset.storagePath}</code>
          ) : null}
        </div>

        <div className="flex flex-shrink-0 items-center gap-1.5">
          {isReady && !generating && (
            <button
              onClick={isPlaying ? onStop : onPlay}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                isPlaying
                  ? 'border border-[#E0FE10]/25 bg-[#E0FE10]/15 text-[#E0FE10] hover:bg-[#E0FE10]/20'
                  : 'border border-zinc-700 bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white'
              }`}
            >
              {isPlaying ? <><Square className="h-3 w-3" />Stop</> : <><Play className="h-3 w-3" />Preview</>}
            </button>
          )}
          <button
            onClick={onGenerate}
            disabled={generating}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
              generating
                ? 'cursor-not-allowed border border-zinc-700 bg-zinc-800 text-zinc-500'
                : isReady
                  ? 'border border-zinc-700 bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white'
                  : 'border border-[#E0FE10]/30 bg-[#E0FE10]/15 text-[#E0FE10] hover:bg-[#E0FE10]/25'
            }`}
          >
            {generating ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : isReady ? (
              <><RotateCcw className="h-3 w-3" />Regen</>
            ) : (
              <><Wand2 className="h-3 w-3" />Generate</>
            )}
          </button>
        </div>
      </div>

      {isPlaying && (
        <div className="mt-3 flex h-4 items-center gap-0.5">
          {Array.from({ length: 20 }).map((_, i) => (
            <motion.div
              key={i}
              className="w-1 rounded-full bg-[#E0FE10]"
              animate={{ height: ['4px', `${Math.random() * 14 + 4}px`, '4px'] }}
              transition={{ duration: 0.5 + Math.random() * 0.4, repeat: Infinity, delay: i * 0.07, ease: 'easeInOut' }}
            />
          ))}
        </div>
      )}
    </motion.div>
  );
};

// ──────────────────────────────────────────────────────────
// MAIN PAGE
// ──────────────────────────────────────────────────────────
const AdminAiVoice: React.FC = () => {
  const [activeTab, setActiveTab] = useState<AdminAudioTab>('voice');

  // Coverage audit state (read-only rollup; see Coverage tab)
  const [coverageSections, setCoverageSections] = useState<CoverageSection[]>([]);
  const [coverageLoading, setCoverageLoading] = useState(false);
  const [coverageError, setCoverageError] = useState<string | null>(null);
  const [coverageLoadedAt, setCoverageLoadedAt] = useState<Date | null>(null);

  // Module narration state (pre-generated spoken clips per sim/protocol)
  const [moduleNarrationAssets, setModuleNarrationAssets] = useState<Record<string, SimAudioAssetRef | null>>({});
  const [moduleNarrationLoading, setModuleNarrationLoading] = useState(false);
  const [moduleNarrationLoadError, setModuleNarrationLoadError] = useState<string | null>(null);
  const [moduleNarrationGenerating, setModuleNarrationGenerating] = useState<Record<string, boolean>>({});
  const [moduleNarrationGenErrors, setModuleNarrationGenErrors] = useState<Record<string, string>>({});
  const [moduleNarrationBulkRunning, setModuleNarrationBulkRunning] = useState(false);
  const [moduleNarrationPlayingId, setModuleNarrationPlayingId] = useState<string | null>(null);
  const moduleNarrationAudioRef = useRef<HTMLAudioElement | null>(null);

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
  // Dynamic Nora lines (name inserted at play time, synthesized on the fly).
  const [dynamicLineName, setDynamicLineName] = useState('Tre');
  const [dynamicLinePlayingId, setDynamicLinePlayingId] = useState<string | null>(null);

  // Sound effects state
  const [playingSound, setPlayingSound] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [appSoundAssets, setAppSoundAssets] = useState<Record<string, SimAudioAssetRef | null>>({});
  const [appSoundGenerating, setAppSoundGenerating] = useState<Record<string, boolean>>({});
  const [appSoundGenErrors, setAppSoundGenErrors] = useState<Record<string, string>>({});
  const [appSoundLoading, setAppSoundLoading] = useState(false);
  const [appSoundLoadError, setAppSoundLoadError] = useState<string | null>(null);

  // Pulse Ritual generation state — generated audio is uploaded to
  // Firebase Storage and tracked in Firestore at
  // `ritual-sfx-assets/{soundId}` so it survives page reloads and
  // regeneration can be skipped on return visits. Downloads pull
  // from the Storage downloadURL.
  const [ritualAssets, setRitualAssets] = useState<Record<string, SimAudioAssetRef | null>>({});
  const [ritualGenerating, setRitualGenerating] = useState<Record<string, boolean>>({});
  const [ritualLoading, setRitualLoading] = useState(false);
  const [ritualLoadError, setRitualLoadError] = useState<string | null>(null);
  const [ritualGenErrors, setRitualGenErrors] = useState<Record<string, string>>({});
  // Refinement loop — designer types plain-English feedback, OpenAI
  // rewrites the prompt, then we regenerate with the new prompt.
  const [ritualFeedback, setRitualFeedback] = useState<Record<string, string>>({});
  const [ritualEffectivePrompts, setRitualEffectivePrompts] = useState<Record<string, string>>({});
  const [ritualRefining, setRitualRefining] = useState<Record<string, boolean>>({});

  // Vision Pro immersive sound set state
  const [vpAssets, setVPAssets] = useState<Record<string, SimAudioAssetRef | null>>({});
  const [vpGenerating, setVPGenerating] = useState<Record<string, boolean>>({});
  const [vpLoading, setVPLoading] = useState(false);
  const [vpLoadError, setVPLoadError] = useState<string | null>(null);
  const [vpGenErrors, setVPGenErrors] = useState<Record<string, string>>({});
  const [vpPlayingId, setVPPlayingId] = useState<string | null>(null);
  const vpAudioRef = useRef<HTMLAudioElement | null>(null);
  const [vpSectionsOpen, setVPSectionsOpen] = useState<Record<string, boolean>>({ resetTrial: true });

  const [protocolAssets, setProtocolAssets] = useState<Record<string, SimAudioAssetRef | null>>({});
  const [protocolGenerating, setProtocolGenerating] = useState<Record<string, boolean>>({});
  const [protocolLoading, setProtocolLoading] = useState(false);
  const [protocolLoadError, setProtocolLoadError] = useState<string | null>(null);
  const [protocolGenErrors, setProtocolGenErrors] = useState<Record<string, string>>({});
  const [protocolPlayingId, setProtocolPlayingId] = useState<string | null>(null);
  const protocolAudioRef = useRef<HTMLAudioElement | null>(null);
  const [registrySimAssets, setRegistrySimAssets] = useState<RegistrySimAudioAssetEntry[]>([]);
  const [registrySimLoading, setRegistrySimLoading] = useState(false);
  const [registrySimLoadError, setRegistrySimLoadError] = useState<string | null>(null);
  const [registrySimPlayingId, setRegistrySimPlayingId] = useState<string | null>(null);
  const registrySimAudioRef = useRef<HTMLAudioElement | null>(null);
  const [runAlertAssets, setRunAlertAssets] = useState<Record<string, SimAudioAssetRef | null>>({});
  const [runAlertGenerating, setRunAlertGenerating] = useState<Record<string, boolean>>({});
  const [runAlertLoading, setRunAlertLoading] = useState(false);
  const [runAlertLoadError, setRunAlertLoadError] = useState<string | null>(null);
  const [runAlertGenErrors, setRunAlertGenErrors] = useState<Record<string, string>>({});
  const [runAlertPlayingId, setRunAlertPlayingId] = useState<string | null>(null);
  const runAlertAudioRef = useRef<HTMLAudioElement | null>(null);
  const [macraOnboardingAssets, setMacraOnboardingAssets] = useState<Record<string, SimAudioAssetRef | null>>({});
  const [macraOnboardingGenerating, setMacraOnboardingGenerating] = useState<Record<string, boolean>>({});
  const [macraOnboardingLoading, setMacraOnboardingLoading] = useState(false);
  const [macraOnboardingLoadError, setMacraOnboardingLoadError] = useState<string | null>(null);
  const [macraOnboardingGenErrors, setMacraOnboardingGenErrors] = useState<Record<string, string>>({});
  const [macraOnboardingPlayingId, setMacraOnboardingPlayingId] = useState<string | null>(null);
  const macraOnboardingAudioRef = useRef<HTMLAudioElement | null>(null);
  const [pulseCheckTutorialAssets, setPulseCheckTutorialAssets] = useState<Record<string, SimAudioAssetRef | null>>({});
  const [pulseCheckTutorialGenerating, setPulseCheckTutorialGenerating] = useState<Record<string, boolean>>({});
  const [pulseCheckTutorialLoading, setPulseCheckTutorialLoading] = useState(false);
  const [pulseCheckTutorialLoadError, setPulseCheckTutorialLoadError] = useState<string | null>(null);
  const [pulseCheckTutorialGenErrors, setPulseCheckTutorialGenErrors] = useState<Record<string, string>>({});
  const [pulseCheckTutorialPlayingId, setPulseCheckTutorialPlayingId] = useState<string | null>(null);
  const pulseCheckTutorialAudioRef = useRef<HTMLAudioElement | null>(null);
  const [protocolSectionsOpen, setProtocolSectionsOpen] = useState<Record<ProtocolCueDef['protocolClass'], boolean>>({
    regulation: true,
    priming: true,
    recovery: true,
  });
  const [librarySectionsOpen, setLibrarySectionsOpen] = useState<Record<string, boolean>>(
    Object.fromEntries(CATEGORY_ORDER.map((category, index) => [category, index < 2])) as Record<string, boolean>
  );

  const voiceLabel = useMemo(() => {
    const source = provider === 'elevenlabs' ? ELEVENLABS_VOICES : OPENAI_VOICES;
    return source.find((v) => v.id === selectedVoiceId)?.label || selectedVoiceId;
  }, [provider, selectedVoiceId]);

  const presetMeta = useMemo(
    () => ELEVENLABS_PRESETS.find((p) => p.id === selectedPresetId) || getElevenLabsPreset(),
    [selectedPresetId]
  );

  // Keep each app's sound inventory isolated in its own dashboard tab.
  const communityAppSounds = useMemo(
    () => SOUND_EFFECTS.filter((sound) => sound.platform === 'community' || sound.platform === 'both'),
    []
  );
  const pulseCheckAppSounds = useMemo(
    () => SOUND_EFFECTS.filter((sound) => sound.platform === 'pulsecheck' || sound.platform === 'both'),
    []
  );
  const groupedCommunitySounds = useMemo(() => {
    const groups: Record<string, typeof SOUND_EFFECTS> = {};
    for (const cat of CATEGORY_ORDER) {
      groups[cat] = communityAppSounds.filter((sound) => sound.category === cat);
    }
    return groups;
  }, [communityAppSounds]);
  const groupedPulseCheckAppSounds = useMemo(() => {
    const groups: Record<string, typeof SOUND_EFFECTS> = {};
    for (const cat of CATEGORY_ORDER) {
      groups[cat] = pulseCheckAppSounds.filter((sound) => sound.category === cat);
    }
    return groups;
  }, [pulseCheckAppSounds]);

  const groupedProtocolCues = useMemo(() => {
    return PROTOCOL_SOUND_CUES.reduce<Record<ProtocolCueDef['protocolClass'], ProtocolCueDef[]>>(
      (acc, cue) => {
        acc[cue.protocolClass].push(cue);
        return acc;
      },
      {
        regulation: [],
        priming: [],
        recovery: [],
      }
    );
  }, []);

  const groupedRegistrySimAssets = useMemo(() => {
    const grouped = registrySimAssets.reduce<Record<string, Record<string, RegistrySimAudioAssetEntry[]>>>((acc, entry) => {
      if (!acc[entry.family]) acc[entry.family] = {};
      if (!acc[entry.family][entry.variantName]) acc[entry.family][entry.variantName] = [];
      acc[entry.family][entry.variantName].push(entry);
      return acc;
    }, {});

    return Object.entries(grouped)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([family, variants]) => ({
        family,
        variants: Object.entries(variants)
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([variantName, entries]) => ({
            variantName,
            entries: [...entries].sort((left, right) => left.asset.label.localeCompare(right.asset.label)),
          })),
      }));
  }, [registrySimAssets]);

  const toggleLibrarySection = (sectionKey: string) => {
    setLibrarySectionsOpen((prev) => ({ ...prev, [sectionKey]: !prev[sectionKey] }));
  };

  const toggleProtocolSection = (sectionKey: ProtocolCueDef['protocolClass']) => {
    setProtocolSectionsOpen((prev) => ({ ...prev, [sectionKey]: !prev[sectionKey] }));
  };

  const toggleVPSection = (sectionKey: string) => {
    setVPSectionsOpen((prev) => ({ ...prev, [sectionKey]: !prev[sectionKey] }));
  };

  const APP_SFX_COLLECTION = 'app-sfx-assets';

  const loadAppSoundAssets = async () => {
    setAppSoundLoading(true);
    setAppSoundLoadError(null);
    try {
      const results: Record<string, SimAudioAssetRef | null> = {};
      await Promise.all(
        SOUND_EFFECTS.map(async (sound) => {
          const snap = await getDoc(doc(db, APP_SFX_COLLECTION, sound.id));
          results[sound.id] = snap.exists() ? (snap.data() as SimAudioAssetRef) : null;
        })
      );
      setAppSoundAssets(results);
    } catch (e: any) {
      setAppSoundLoadError(e?.message || 'Failed to load app sound effects');
    } finally {
      setAppSoundLoading(false);
    }
  };

  const stopRegistrySimSound = () => {
    if (registrySimAudioRef.current) {
      registrySimAudioRef.current.pause();
      registrySimAudioRef.current.currentTime = 0;
      registrySimAudioRef.current = null;
    }
    setRegistrySimPlayingId(null);
  };

  const playRegistrySimSound = (assetId: string, url: string) => {
    stopRegistrySimSound();
    setRegistrySimPlayingId(assetId);
    const audio = new Audio(url);
    registrySimAudioRef.current = audio;
    audio.volume = 0.8;
    audio.play().catch(() => setRegistrySimPlayingId(null));
    audio.onended = () => setRegistrySimPlayingId(null);
    audio.onerror = () => setRegistrySimPlayingId(null);
  };

  // ── VP load: read Firestore for all Reset audio docs
  const loadVPAssets = async () => {
    setVPLoading(true);
    setVPLoadError(null);
    try {
      const results: Record<string, SimAudioAssetRef | null> = {};
      await Promise.all(
        VP_RESET_CUES.map(async (cue) => {
          const docId = buildGeneratedDocId(VP_ENGINE_KEY, cue.cueKey, cue.prompt);
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

  const loadRegistrySimAssets = async () => {
    setRegistrySimLoading(true);
    setRegistrySimLoadError(null);
    try {
      const snap = await getDocs(collection(db, SIM_VARIANTS_COLLECTION));
      const nextEntries: RegistrySimAudioAssetEntry[] = [];

      snap.docs.forEach((variantDoc) => {
        const data = variantDoc.data() as Record<string, any>;
        const runtimeAudioAssets =
          (data.runtimeConfig?.audioAssets as Record<string, SimAudioAssetRef> | undefined)
          ?? (data.buildArtifact?.stimulusModel?.audioAssets as Record<string, SimAudioAssetRef> | undefined)
          ?? {};

        Object.entries(runtimeAudioAssets).forEach(([cueKey, asset]) => {
          if (!asset?.downloadURL) return;
          nextEntries.push({
            variantId: variantDoc.id,
            variantName: String(data.name ?? variantDoc.id),
            family: String(data.family ?? 'Unknown Family'),
            engineKey: typeof data.engineKey === 'string' ? data.engineKey : null,
            archetype: typeof data.archetypeOverride === 'string'
              ? data.archetypeOverride
              : typeof data.runtimeConfig?.archetype === 'string'
                ? data.runtimeConfig.archetype
                : null,
            buildStatus: typeof data.buildStatus === 'string' ? data.buildStatus : null,
            publishedModuleId: typeof data.publishedModuleId === 'string' ? data.publishedModuleId : null,
            cueKey,
            asset: asset as SimAudioAssetRef,
          });
        });
      });

      nextEntries.sort((left, right) => {
        const familyCompare = left.family.localeCompare(right.family);
        if (familyCompare !== 0) return familyCompare;
        const variantCompare = left.variantName.localeCompare(right.variantName);
        if (variantCompare !== 0) return variantCompare;
        return left.asset.label.localeCompare(right.asset.label);
      });

      setRegistrySimAssets(nextEntries);
    } catch (e: any) {
      setRegistrySimLoadError(e?.message || 'Failed to load registry sim audio assets');
    } finally {
      setRegistrySimLoading(false);
    }
  };

  const getTtsMentalStepUrl = () => {
    return resolvePulseCheckFunctionUrl('/.netlify/functions/tts-mental-step');
  };

  const OPENAI_SFX_BRIDGE_ENDPOINT = '/api/openai/v1/chat/completions';
  const OPENAI_SFX_FEATURE_ID = 'pulsecheckSoundEffects';
  const OPENAI_SFX_MODEL = 'gpt-audio-1.5';

  const generateSfxBlob = async (
    prompt: string,
    durationSeconds: number,
    options?: { loop?: boolean; promptInfluence?: number }
  ) => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error('Firebase auth session required for OpenAI sound generation. Sign in again, then retry.');
    }

    const normalizedDuration = Math.max(0.25, Math.min(12, Number(durationSeconds) || 4));
    const promptInfluence = Math.max(0, Math.min(1, Number(options?.promptInfluence) || 0.35));
    const idToken = await currentUser.getIdToken();
    const res = await fetch(OPENAI_SFX_BRIDGE_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
        'openai-organization': OPENAI_SFX_FEATURE_ID,
      },
      body: JSON.stringify({
        model: OPENAI_SFX_MODEL,
        modalities: ['text', 'audio'],
        audio: { voice: 'alloy', format: 'mp3' },
        max_completion_tokens: 2000,
        messages: [
          {
            role: 'system',
            content:
              'You are a professional sound-design engine. Generate only the requested nonverbal sound effect. Never speak, whisper, sing, narrate, describe the result, or include intelligible words. Do not add unrelated music. Honor the requested duration and loop behavior as closely as possible.',
          },
          {
            role: 'user',
            content: [
              `Create a ${normalizedDuration.toFixed(2)}-second MP3 sound effect.`,
              options?.loop
                ? 'Make the beginning and ending connect as a seamless loop.'
                : 'Make it a self-contained one-shot and end cleanly.',
              `Prompt fidelity: ${promptInfluence.toFixed(2)} out of 1.00.`,
              `Sound-design brief: ${prompt.trim()}`,
              'Return the sound itself, with no spoken description or human vocalization.',
            ].join('\n'),
          },
        ],
      }),
    });

    const responseText = await res.text();
    let payload: any = null;
    try {
      payload = responseText ? JSON.parse(responseText) : null;
    } catch {}
    const audio = payload?.choices?.[0]?.message?.audio?.data;
    if (!res.ok) {
      const bridgeMessage = payload?.error?.message || payload?.message;
      throw new Error(bridgeMessage || `OpenAI bridge request failed (${res.status} ${res.statusText})`);
    }
    if (typeof audio !== 'string' || !audio) {
      throw new Error('OpenAI bridge response did not include generated audio data');
    }

    const binary = window.atob(audio);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);

    return {
      blob: new Blob([bytes], { type: 'audio/mpeg' }),
      providerId: 'openai' as const,
      contentType: 'audio/mpeg',
    };
  };

  const generateSpeechBlob = async (prompt: string) => {
    const elevenLabsVoiceId =
      provider === 'elevenlabs' && ELEVENLABS_VOICES.some((voice) => voice.id === selectedVoiceId)
        ? selectedVoiceId
        : ELEVENLABS_VOICES[0]?.id;

    if (!elevenLabsVoiceId) {
      throw new Error('No ElevenLabs Nora voice is configured for spoken Reset lines.');
    }

    const settings = shouldUseElevenLabsVoiceDefaults(selectedPresetId) ? null : elevenLabsSettings;
    const response = await fetch(getTtsMentalStepUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: prompt,
        provider: 'elevenlabs',
        voice: elevenLabsVoiceId,
        format: 'mp3',
        presetId: selectedPresetId || null,
        settings,
        punctuationPauses,
        // Stored library clips must only ever be Nora's ElevenLabs voice:
        // fail loudly here instead of silently baking in the OpenAI
        // runtime-fallback voice.
        disableFallback: true,
      }),
    });

    if (!response.ok) {
      let message = `Voice generation failed: ${response.status}`;
      try {
        const payload = await response.json();
        message = payload?.error || message;
      } catch {}
      throw new Error(message);
    }

    const blob = await response.blob();
    return {
      blob,
      providerId: 'elevenlabs' as const,
      contentType: blob.type || 'audio/mpeg',
    };
  };

  const regenerateAppSound = async (sound: typeof SOUND_EFFECTS[0]) => {
    setAppSoundGenerating((prev) => ({ ...prev, [sound.id]: true }));
    setAppSoundGenErrors((prev) => {
      const next = { ...prev };
      delete next[sound.id];
      return next;
    });

    try {
      const generated = sound.generationMode === 'speech'
        ? await generateSpeechBlob(sound.prompt)
        : await generateSfxBlob(sound.prompt, sound.durationSeconds);

      const path = `pulsecheck-sfx/app-library/${sound.platform}/${sound.id}/${sound.file}.mp3`;
      const sRef = storageRef(storage, path);
      const snapshot = await uploadBytes(sRef, generated.blob, { contentType: generated.contentType });
      const downloadURL = await getDownloadURL(snapshot.ref);
      const gsUrl = `gs://${snapshot.ref.bucket}/${snapshot.ref.fullPath}`;
      const now = Date.now();
      const previous = appSoundAssets[sound.id];

      const assetRecord: SimAudioAssetRef = {
        id: sound.id,
        cueKey: sound.id,
        label: sound.label,
        prompt: sound.prompt,
        provider: generated.providerId,
        format: 'mp3',
        contentType: generated.contentType,
        storagePath: path,
        gsUrl,
        downloadURL,
        createdAt: previous?.createdAt ?? now,
        updatedAt: now,
      };

      await setDoc(doc(db, APP_SFX_COLLECTION, sound.id), {
        ...assetRecord,
        family: sound.platform === 'pulsecheck' ? 'pulsecheck-app' : 'fit-with-pulse-app',
        platform: sound.platform,
        category: sound.category,
        file: sound.file,
        generationMode: sound.generationMode ?? 'sfx',
        durationSeconds: sound.durationSeconds,
      });

      setAppSoundAssets((prev) => ({ ...prev, [sound.id]: assetRecord }));
    } catch (err: any) {
      console.error('[app sfx] generation failed', err);
      setAppSoundGenErrors((prev) => ({
        ...prev,
        [sound.id]: err?.message || 'Sound generation failed',
      }));
    } finally {
      setAppSoundGenerating((prev) => ({ ...prev, [sound.id]: false }));
    }
  };

  // ── VP generate: call SFX or Nora TTS → Firebase Storage → Firestore
  const generateVPSound = async (cue: VPCueDef) => {
    setVPGenerating((prev) => ({ ...prev, [cue.cueKey]: true }));
    setVPGenErrors((prev) => { const n = { ...prev }; delete n[cue.cueKey]; return n; });
    try {
      let blob: Blob;
      let providerId: SimAudioAssetRef['provider'] = 'openai';
      let contentType = 'audio/mpeg';

      if (cue.generationMode === 'speech') {
        const speech = await generateSpeechBlob(cue.prompt);
        blob = speech.blob;
        providerId = speech.providerId;
        contentType = speech.contentType;
      } else {
        const sfx = await generateSfxBlob(cue.prompt, cue.durationSeconds);
        blob = sfx.blob;
        providerId = sfx.providerId;
        contentType = sfx.contentType;
      }

      // 3. Upload to Firebase Storage
      const assetId = buildGeneratedDocId(VP_ENGINE_KEY, cue.cueKey, cue.prompt);
      const path = `sim-audio-assets/${vpSlugify(VP_ENGINE_KEY)}/${cue.cueKey}/${assetId}.mp3`;
      const sRef = storageRef(storage, path);
      const snapshot = await uploadBytes(sRef, blob, { contentType });
      const downloadURL = await getDownloadURL(snapshot.ref);
      const gsUrl = `gs://${snapshot.ref.bucket}/${snapshot.ref.fullPath}`;

      // 4. Write Firestore doc
      const now = Date.now();
      const assetRecord: SimAudioAssetRef = {
        id: assetId,
        cueKey: cue.cueKey,
        label: cue.label,
        prompt: cue.prompt,
        provider: providerId,
        format: 'mp3',
        contentType,
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
        archetype: cue.generationMode === 'speech' ? 'voice_channel' : 'audio_channel',
        stageTag: cue.stageTag,
        generationMode: cue.generationMode,
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

  const loadProtocolAssets = async () => {
    setProtocolLoading(true);
    setProtocolLoadError(null);
    try {
      const results: Record<string, SimAudioAssetRef | null> = {};
      await Promise.all(
        PROTOCOL_SOUND_CUES.map(async (cue) => {
          const docId = buildGeneratedDocId(PROTOCOL_ENGINE_KEY, cue.cueKey, cue.prompt);
          const snap = await getDoc(doc(db, 'sim-audio-assets', docId));
          results[cue.cueKey] = snap.exists() ? (snap.data() as SimAudioAssetRef) : null;
        })
      );
      setProtocolAssets(results);
    } catch (e: any) {
      setProtocolLoadError(e?.message || 'Failed to load protocol sounds');
    } finally {
      setProtocolLoading(false);
    }
  };

  const generateProtocolSound = async (cue: ProtocolCueDef) => {
    setProtocolGenerating((prev) => ({ ...prev, [cue.cueKey]: true }));
    setProtocolGenErrors((prev) => {
      const next = { ...prev };
      delete next[cue.cueKey];
      return next;
    });
    try {
      const sfx = await generateSfxBlob(cue.prompt, cue.durationSeconds, {
        loop: cue.loop,
        promptInfluence: cue.promptInfluence,
      });
      const assetId = buildGeneratedDocId(PROTOCOL_ENGINE_KEY, cue.cueKey, cue.prompt);
      const path = `sim-audio-assets/${vpSlugify(PROTOCOL_ENGINE_KEY)}/${cue.cueKey}/${assetId}.mp3`;
      const sRef = storageRef(storage, path);
      const snapshot = await uploadBytes(sRef, sfx.blob, { contentType: sfx.contentType });
      const downloadURL = await getDownloadURL(snapshot.ref);
      const gsUrl = `gs://${snapshot.ref.bucket}/${snapshot.ref.fullPath}`;
      const now = Date.now();
      const assetRecord: SimAudioAssetRef = {
        id: assetId,
        cueKey: cue.cueKey,
        label: cue.label,
        prompt: cue.prompt,
        provider: sfx.providerId,
        format: 'mp3',
        contentType: sfx.contentType,
        storagePath: path,
        gsUrl,
        downloadURL,
        createdAt: protocolAssets[cue.cueKey]?.createdAt ?? now,
        updatedAt: now,
      };
      await setDoc(doc(db, 'sim-audio-assets', assetId), {
        ...assetRecord,
        family: PROTOCOL_ENGINE_KEY,
        engineKey: PROTOCOL_ENGINE_KEY,
        archetype: 'audio_channel',
        protocolId: cue.protocolId,
        protocolClass: cue.protocolClass,
        responseFamily: cue.responseFamily,
        runtimeRole: cue.runtimeRole ?? 'signature',
        loop: Boolean(cue.loop),
      });
      setProtocolAssets((prev) => ({ ...prev, [cue.cueKey]: assetRecord }));
    } catch (e: any) {
      const msg = e?.message || 'Generation failed';
      setProtocolGenErrors((prev) => ({ ...prev, [cue.cueKey]: msg }));
      console.error(`[Protocol SFX] ${cue.cueKey}:`, msg);
    } finally {
      setProtocolGenerating((prev) => ({ ...prev, [cue.cueKey]: false }));
    }
  };

  const stopProtocolSound = () => {
    if (protocolAudioRef.current) {
      protocolAudioRef.current.pause();
      protocolAudioRef.current.currentTime = 0;
      protocolAudioRef.current = null;
    }
    setProtocolPlayingId(null);
  };

  const playProtocolSound = (cue: ProtocolCueDef, url: string) => {
    stopProtocolSound();
    setProtocolPlayingId(cue.cueKey);
    const audio = new Audio(url);
    audio.loop = Boolean(cue.loop);
    protocolAudioRef.current = audio;
    audio.volume = cue.runtimeRole === 'ambient' ? 0.35 : 0.75;
    audio.play().catch(() => setProtocolPlayingId(null));
    audio.onended = () => setProtocolPlayingId(null);
    audio.onerror = () => setProtocolPlayingId(null);
  };

  const loadRunAlertAssets = async () => {
    setRunAlertLoading(true);
    setRunAlertLoadError(null);
    try {
      const results: Record<string, SimAudioAssetRef | null> = {};
      await Promise.all(
        RUN_ALERT_CUES.map(async (cue) => {
          const docId = buildGeneratedDocId(RUN_ALERT_ENGINE_KEY, cue.cueKey, cue.prompt);
          const snap = await getDoc(doc(db, 'sim-audio-assets', docId));
          results[cue.cueKey] = snap.exists() ? (snap.data() as SimAudioAssetRef) : null;
        })
      );
      setRunAlertAssets(results);
    } catch (e: any) {
      setRunAlertLoadError(e?.message || 'Failed to load run alert voice lines');
    } finally {
      setRunAlertLoading(false);
    }
  };

  const generateRunAlertSound = async (cue: RunAlertCueDef) => {
    setRunAlertGenerating((prev) => ({ ...prev, [cue.cueKey]: true }));
    setRunAlertGenErrors((prev) => {
      const next = { ...prev };
      delete next[cue.cueKey];
      return next;
    });
    try {
      const speech = await generateSpeechBlob(cue.prompt);
      const assetId = buildGeneratedDocId(RUN_ALERT_ENGINE_KEY, cue.cueKey, cue.prompt);
      const path = `sim-audio-assets/${vpSlugify(RUN_ALERT_ENGINE_KEY)}/${cue.cueKey}/${assetId}.mp3`;
      const sRef = storageRef(storage, path);
      const snapshot = await uploadBytes(sRef, speech.blob, { contentType: speech.contentType });
      const downloadURL = await getDownloadURL(snapshot.ref);
      const gsUrl = `gs://${snapshot.ref.bucket}/${snapshot.ref.fullPath}`;
      const now = Date.now();
      const assetRecord: SimAudioAssetRef = {
        id: assetId,
        cueKey: cue.cueKey,
        label: cue.label,
        prompt: cue.prompt,
        provider: speech.providerId,
        format: 'mp3',
        contentType: speech.contentType,
        storagePath: path,
        gsUrl,
        downloadURL,
        createdAt: runAlertAssets[cue.cueKey]?.createdAt ?? now,
        updatedAt: now,
      };
      await setDoc(doc(db, 'sim-audio-assets', assetId), {
        ...assetRecord,
        family: RUN_ALERT_ENGINE_KEY,
        engineKey: RUN_ALERT_ENGINE_KEY,
        archetype: 'voice_channel',
        intent: cue.intent,
        bundleTarget: cue.bundleTarget,
      });
      setRunAlertAssets((prev) => ({ ...prev, [cue.cueKey]: assetRecord }));
    } catch (e: any) {
      const msg = e?.message || 'Generation failed';
      setRunAlertGenErrors((prev) => ({ ...prev, [cue.cueKey]: msg }));
      console.error(`[Run Alerts] ${cue.cueKey}:`, msg);
    } finally {
      setRunAlertGenerating((prev) => ({ ...prev, [cue.cueKey]: false }));
    }
  };

  const stopRunAlertSound = () => {
    if (runAlertAudioRef.current) {
      runAlertAudioRef.current.pause();
      runAlertAudioRef.current.currentTime = 0;
      runAlertAudioRef.current = null;
    }
    setRunAlertPlayingId(null);
  };

  const playRunAlertSound = (cueKey: string, url: string) => {
    stopRunAlertSound();
    setRunAlertPlayingId(cueKey);
    const audio = new Audio(url);
    runAlertAudioRef.current = audio;
    audio.volume = 0.9;
    audio.play().catch(() => setRunAlertPlayingId(null));
    audio.onended = () => setRunAlertPlayingId(null);
    audio.onerror = () => setRunAlertPlayingId(null);
  };

  const loadMacraOnboardingAssets = async () => {
    setMacraOnboardingLoading(true);
    setMacraOnboardingLoadError(null);
    try {
      const snap = await getDoc(doc(db, CONFIG_COLLECTION, CONFIG_DOC_ID));
      const rawAssets = (snap.data()?.macraOnboardingNarrations ?? {}) as Record<string, SimAudioAssetRef>;
      const results: Record<string, SimAudioAssetRef | null> = {};
      MACRA_ONBOARDING_NARRATION_CUES.forEach((cue) => {
        results[cue.cueKey] = rawAssets[cue.cueKey] ?? null;
      });
      setMacraOnboardingAssets(results);
    } catch (e: any) {
      setMacraOnboardingLoadError(e?.message || 'Failed to load Macra onboarding narrations');
    } finally {
      setMacraOnboardingLoading(false);
    }
  };

  const generateMacraOnboardingNarration = async (cue: MacraOnboardingNarrationCue) => {
    setMacraOnboardingGenerating((prev) => ({ ...prev, [cue.cueKey]: true }));
    setMacraOnboardingGenErrors((prev) => {
      const next = { ...prev };
      delete next[cue.cueKey];
      return next;
    });
    try {
      const speech = await generateSpeechBlob(cue.prompt);
      const assetId = buildGeneratedDocId(MACRA_ONBOARDING_ENGINE_KEY, cue.cueKey, cue.prompt);
      const path = `sim-audio-assets/${vpSlugify(MACRA_ONBOARDING_ENGINE_KEY)}/${cue.cueKey}/${assetId}.mp3`;
      const sRef = storageRef(storage, path);
      const snapshot = await uploadBytes(sRef, speech.blob, { contentType: speech.contentType });
      const downloadURL = await getDownloadURL(snapshot.ref);
      const gsUrl = `gs://${snapshot.ref.bucket}/${snapshot.ref.fullPath}`;
      const now = Date.now();
      const assetRecord: SimAudioAssetRef = {
        id: assetId,
        cueKey: cue.cueKey,
        label: cue.label,
        prompt: cue.prompt,
        provider: speech.providerId,
        format: 'mp3',
        contentType: speech.contentType,
        storagePath: path,
        gsUrl,
        downloadURL,
        createdAt: macraOnboardingAssets[cue.cueKey]?.createdAt ?? now,
        updatedAt: now,
      };

      await setDoc(doc(db, 'sim-audio-assets', assetId), {
        ...assetRecord,
        family: MACRA_ONBOARDING_ENGINE_KEY,
        engineKey: MACRA_ONBOARDING_ENGINE_KEY,
        archetype: 'voice_channel',
        app: 'macra',
        stepIndex: cue.stepIndex,
      });

      const configRef = doc(db, CONFIG_COLLECTION, CONFIG_DOC_ID);
      const configSnap = await getDoc(configRef);
      const existingNarrations = (configSnap.data()?.macraOnboardingNarrations ?? {}) as Record<string, SimAudioAssetRef>;
      await setDoc(configRef, {
        macraOnboardingNarrations: {
          ...existingNarrations,
          [cue.cueKey]: assetRecord,
        },
        updatedAt: now,
      }, { merge: true });

      setMacraOnboardingAssets((prev) => ({ ...prev, [cue.cueKey]: assetRecord }));
    } catch (e: any) {
      const msg = e?.message || 'Generation failed';
      setMacraOnboardingGenErrors((prev) => ({ ...prev, [cue.cueKey]: msg }));
      console.error(`[Macra Onboarding] ${cue.cueKey}:`, msg);
    } finally {
      setMacraOnboardingGenerating((prev) => ({ ...prev, [cue.cueKey]: false }));
    }
  };

  const generateMissingMacraOnboardingNarrations = async () => {
    for (const cue of MACRA_ONBOARDING_NARRATION_CUES) {
      if (!macraOnboardingAssets[cue.cueKey]?.downloadURL) {
        await generateMacraOnboardingNarration(cue);
      }
    }
  };

  const stopMacraOnboardingNarration = () => {
    if (macraOnboardingAudioRef.current) {
      macraOnboardingAudioRef.current.pause();
      macraOnboardingAudioRef.current.currentTime = 0;
      macraOnboardingAudioRef.current = null;
    }
    setMacraOnboardingPlayingId(null);
  };

  const playMacraOnboardingNarration = (cueKey: string, url: string) => {
    stopMacraOnboardingNarration();
    setMacraOnboardingPlayingId(cueKey);
    const audio = new Audio(url);
    macraOnboardingAudioRef.current = audio;
    audio.volume = 0.9;
    audio.play().catch(() => setMacraOnboardingPlayingId(null));
    audio.onended = () => setMacraOnboardingPlayingId(null);
    audio.onerror = () => setMacraOnboardingPlayingId(null);
  };

  const loadPulseCheckTutorialAssets = async () => {
    setPulseCheckTutorialLoading(true);
    setPulseCheckTutorialLoadError(null);
    try {
      const snap = await getDoc(doc(db, CONFIG_COLLECTION, CONFIG_DOC_ID));
      const rawAssets = (snap.data()?.[PULSECHECK_TUTORIAL_NARRATION_CONFIG_FIELD] ?? {}) as Record<string, SimAudioAssetRef>;
      const results: Record<string, SimAudioAssetRef | null> = {};
      PULSECHECK_TUTORIAL_NARRATION_CUES.forEach((cue) => {
        results[cue.cueKey] = rawAssets[cue.cueKey] ?? null;
      });
      setPulseCheckTutorialAssets(results);
    } catch (e: any) {
      setPulseCheckTutorialLoadError(e?.message || 'Failed to load PulseCheck tutorial narrations');
    } finally {
      setPulseCheckTutorialLoading(false);
    }
  };

  const generatePulseCheckTutorialNarration = async (cue: PulseCheckTutorialNarrationCue) => {
    setPulseCheckTutorialGenerating((prev) => ({ ...prev, [cue.cueKey]: true }));
    setPulseCheckTutorialGenErrors((prev) => {
      const next = { ...prev };
      delete next[cue.cueKey];
      return next;
    });
    try {
      const speech = await generateSpeechBlob(cue.prompt);
      const assetId = buildGeneratedDocId(PULSECHECK_TUTORIAL_ENGINE_KEY, cue.cueKey, cue.prompt);
      const path = `sim-audio-assets/${vpSlugify(PULSECHECK_TUTORIAL_ENGINE_KEY)}/${cue.cueKey}/${assetId}.mp3`;
      const sRef = storageRef(storage, path);
      const snapshot = await uploadBytes(sRef, speech.blob, { contentType: speech.contentType });
      const downloadURL = await getDownloadURL(snapshot.ref);
      const gsUrl = `gs://${snapshot.ref.bucket}/${snapshot.ref.fullPath}`;
      const now = Date.now();
      const assetRecord: SimAudioAssetRef = {
        id: assetId,
        cueKey: cue.cueKey,
        label: cue.label,
        prompt: cue.prompt,
        provider: speech.providerId,
        format: 'mp3',
        contentType: speech.contentType,
        storagePath: path,
        gsUrl,
        downloadURL,
        createdAt: pulseCheckTutorialAssets[cue.cueKey]?.createdAt ?? now,
        updatedAt: now,
      };

      await setDoc(doc(db, 'sim-audio-assets', assetId), {
        ...assetRecord,
        family: PULSECHECK_TUTORIAL_ENGINE_KEY,
        engineKey: PULSECHECK_TUTORIAL_ENGINE_KEY,
        archetype: 'voice_channel',
        app: 'pulsecheck',
        screen: 'nora_home_tutorial',
        stepIndex: cue.stepIndex,
      });

      const configRef = doc(db, CONFIG_COLLECTION, CONFIG_DOC_ID);
      const configSnap = await getDoc(configRef);
      const existingNarrations = (configSnap.data()?.[PULSECHECK_TUTORIAL_NARRATION_CONFIG_FIELD] ?? {}) as Record<string, SimAudioAssetRef>;
      await setDoc(configRef, {
        [PULSECHECK_TUTORIAL_NARRATION_CONFIG_FIELD]: {
          ...existingNarrations,
          [cue.cueKey]: assetRecord,
        },
        updatedAt: now,
      }, { merge: true });

      setPulseCheckTutorialAssets((prev) => ({ ...prev, [cue.cueKey]: assetRecord }));
    } catch (e: any) {
      const msg = e?.message || 'Generation failed';
      setPulseCheckTutorialGenErrors((prev) => ({ ...prev, [cue.cueKey]: msg }));
      console.error(`[PulseCheck Tutorial] ${cue.cueKey}:`, msg);
    } finally {
      setPulseCheckTutorialGenerating((prev) => ({ ...prev, [cue.cueKey]: false }));
    }
  };

  const generateMissingPulseCheckTutorialNarrations = async () => {
    for (const cue of PULSECHECK_TUTORIAL_NARRATION_CUES) {
      if (!pulseCheckTutorialAssets[cue.cueKey]?.downloadURL) {
        await generatePulseCheckTutorialNarration(cue);
      }
    }
  };

  const stopPulseCheckTutorialNarration = () => {
    if (pulseCheckTutorialAudioRef.current) {
      pulseCheckTutorialAudioRef.current.pause();
      pulseCheckTutorialAudioRef.current.currentTime = 0;
      pulseCheckTutorialAudioRef.current = null;
    }
    setPulseCheckTutorialPlayingId(null);
  };

  const playPulseCheckTutorialNarration = (cueKey: string, url: string) => {
    stopPulseCheckTutorialNarration();
    setPulseCheckTutorialPlayingId(cueKey);
    const audio = new Audio(url);
    pulseCheckTutorialAudioRef.current = audio;
    audio.volume = 0.9;
    audio.play().catch(() => setPulseCheckTutorialPlayingId(null));
    audio.onended = () => setPulseCheckTutorialPlayingId(null);
    audio.onerror = () => setPulseCheckTutorialPlayingId(null);
  };

  const loadConfig = async () => {
    setLoading(true);
    setError(null);
    try {
      const ref = doc(db, CONFIG_COLLECTION, CONFIG_DOC_ID);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const data = normalizeAiVoiceConfig(snap.data() as Partial<AiVoiceConfig>);
        persistVoiceConfig(data);
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

  // ── Module narrations: pre-generated spoken clips for every sim and
  // protocol line, so iOS plays stored audio and live TTS is only the
  // fallback. Assets are keyed by cueKey + a hash of the exact text
  // (promptHash) that iOS matches at playback.
  const loadModuleNarrationAssets = async () => {
    setModuleNarrationLoading(true);
    setModuleNarrationLoadError(null);
    try {
      const snap = await getDocs(query(
        collection(db, 'sim-audio-assets'),
        where('engineKey', '==', MODULE_NARRATION_ENGINE_KEY),
      ));
      const byCueKey = new Map<string, SimAudioAssetRef & { prompt?: string }>();
      snap.docs.forEach((assetDoc) => {
        const data = assetDoc.data() as SimAudioAssetRef & { prompt?: string };
        if (data?.cueKey && data?.downloadURL) byCueKey.set(data.cueKey, data);
      });
      const results: Record<string, SimAudioAssetRef | null> = {};
      MODULE_NARRATION_SCRIPTS.forEach((script) => {
        const candidate = byCueKey.get(script.cueKey);
        // A stale clip (script text changed since generation) counts as
        // missing so the dashboard prompts a regeneration.
        results[script.cueKey] = candidate && candidate.prompt === script.text ? candidate : null;
      });
      setModuleNarrationAssets(results);
    } catch (e: any) {
      setModuleNarrationLoadError(e?.message || 'Failed to load module narrations');
    } finally {
      setModuleNarrationLoading(false);
    }
  };

  const generateModuleNarration = async (script: ModuleNarrationScript) => {
    setModuleNarrationGenerating((prev) => ({ ...prev, [script.cueKey]: true }));
    setModuleNarrationGenErrors((prev) => {
      const next = { ...prev };
      delete next[script.cueKey];
      return next;
    });
    try {
      const speech = await generateSpeechBlob(script.text);
      const assetId = buildGeneratedDocId(MODULE_NARRATION_ENGINE_KEY, script.cueKey, script.text);
      const path = `sim-audio-assets/${vpSlugify(MODULE_NARRATION_ENGINE_KEY)}/${script.cueKey}/${assetId}.mp3`;
      const sRef = storageRef(storage, path);
      const snapshot = await uploadBytes(sRef, speech.blob, { contentType: speech.contentType });
      const downloadURL = await getDownloadURL(snapshot.ref);
      const gsUrl = `gs://${snapshot.ref.bucket}/${snapshot.ref.fullPath}`;
      const now = Date.now();
      const assetRecord: SimAudioAssetRef = {
        id: assetId,
        cueKey: script.cueKey,
        label: script.label,
        prompt: script.text,
        provider: speech.providerId,
        format: 'mp3',
        contentType: speech.contentType,
        storagePath: path,
        gsUrl,
        downloadURL,
        createdAt: moduleNarrationAssets[script.cueKey]?.createdAt ?? now,
        updatedAt: now,
      };

      await setDoc(doc(db, 'sim-audio-assets', assetId), {
        ...assetRecord,
        family: MODULE_NARRATION_ENGINE_KEY,
        engineKey: MODULE_NARRATION_ENGINE_KEY,
        archetype: 'voice_channel',
        app: 'pulsecheck',
        moduleId: script.moduleId,
        slot: script.slot,
        // iOS resolves stored narration by hashing the runtime text —
        // promptHash must always be hashNarrationText(prompt).
        promptHash: hashNarrationText(script.text),
      });

      setModuleNarrationAssets((prev) => ({ ...prev, [script.cueKey]: assetRecord }));
    } catch (e: any) {
      const msg = e?.message || 'Generation failed';
      setModuleNarrationGenErrors((prev) => ({ ...prev, [script.cueKey]: msg }));
      console.error(`[Module Narration] ${script.cueKey}:`, msg);
    } finally {
      setModuleNarrationGenerating((prev) => ({ ...prev, [script.cueKey]: false }));
    }
  };

  const generateMissingModuleNarrations = async () => {
    if (moduleNarrationBulkRunning) return;
    setModuleNarrationBulkRunning(true);
    try {
      for (const script of MODULE_NARRATION_SCRIPTS) {
        if (!moduleNarrationAssets[script.cueKey]?.downloadURL) {
          // Sequential on purpose: ElevenLabs rate limits, and each clip
          // is only a few seconds of synthesis.
          // eslint-disable-next-line no-await-in-loop
          await generateModuleNarration(script);
        }
      }
    } finally {
      setModuleNarrationBulkRunning(false);
    }
  };

  const stopModuleNarrationPlayback = () => {
    if (moduleNarrationAudioRef.current) {
      moduleNarrationAudioRef.current.pause();
      moduleNarrationAudioRef.current.currentTime = 0;
      moduleNarrationAudioRef.current = null;
    }
    setModuleNarrationPlayingId(null);
  };

  const playModuleNarration = (cueKey: string, url: string) => {
    stopModuleNarrationPlayback();
    setModuleNarrationPlayingId(cueKey);
    const audio = new Audio(url);
    moduleNarrationAudioRef.current = audio;
    audio.volume = 0.9;
    audio.play().catch(() => setModuleNarrationPlayingId(null));
    audio.onended = () => setModuleNarrationPlayingId(null);
    audio.onerror = () => setModuleNarrationPlayingId(null);
  };

  // ── Coverage audit loader: every expected cue checked against the
  // sim-audio-assets inventory, in one pass. Read-only; generation
  // stays on the per-section tabs.
  const loadCoverage = async () => {
    setCoverageLoading(true);
    setCoverageError(null);
    try {
      const checkCueSet = async (
        cues: Array<{ cueKey: string; prompt: string; label?: string }>,
        engineKey: string,
      ): Promise<CoverageRow[]> => {
        const rows = await Promise.all(cues.map(async (cue) => {
          const docId = buildGeneratedDocId(engineKey, cue.cueKey, cue.prompt);
          const snap = await getDoc(doc(db, 'sim-audio-assets', docId));
          return {
            label: cue.label || cue.cueKey,
            cueKey: cue.cueKey,
            present: snap.exists() && Boolean((snap.data() as any)?.downloadURL),
          };
        }));
        return rows;
      };

      // Published sim variants: stored audio is only expected for audio
      // archetypes; visual archetypes narrate live and carry no assets.
      const variantsSnap = await getDocs(collection(db, SIM_VARIANTS_COLLECTION));
      const simRows: CoverageRow[] = [];
      let visualOnlyPublished = 0;
      variantsSnap.docs.forEach((variantDoc) => {
        const data = variantDoc.data() as Record<string, any>;
        if (typeof data.publishedModuleId !== 'string' || !data.publishedModuleId) return;
        const archetype = typeof data.archetypeOverride === 'string'
          ? data.archetypeOverride
          : typeof data.runtimeConfig?.archetype === 'string'
            ? data.runtimeConfig.archetype
            : null;
        const attached = Object.values(
          (data.runtimeConfig?.audioAssets ?? data.buildArtifact?.stimulusModel?.audioAssets ?? {}) as Record<string, SimAudioAssetRef>,
        ).filter((asset) => Boolean(asset?.downloadURL)).length;
        const needsAudio = archetype === 'audio_channel' || archetype === 'combined_channel';
        if (!needsAudio) {
          visualOnlyPublished += 1;
          return;
        }
        simRows.push({
          label: `${String(data.name ?? variantDoc.id)} (${String(data.family ?? 'family?')})`,
          cueKey: `${attached} audio asset(s) attached`,
          present: attached > 0,
        });
      });

      const [protocolRows, vpRows, runAlertRows, macraRows, tutorialRows] = await Promise.all([
        checkCueSet(PROTOCOL_SOUND_CUES, PROTOCOL_ENGINE_KEY),
        checkCueSet(VP_RESET_CUES, VP_ENGINE_KEY),
        checkCueSet(RUN_ALERT_CUES, RUN_ALERT_ENGINE_KEY),
        checkCueSet(MACRA_ONBOARDING_NARRATION_CUES, MACRA_ONBOARDING_ENGINE_KEY),
        checkCueSet(PULSECHECK_TUTORIAL_NARRATION_CUES, PULSECHECK_TUTORIAL_ENGINE_KEY),
      ]);

      // Module narrations: one query, matched by cueKey + exact text so
      // stale clips (script changed since generation) read as missing.
      const narrationSnap = await getDocs(query(
        collection(db, 'sim-audio-assets'),
        where('engineKey', '==', MODULE_NARRATION_ENGINE_KEY),
      ));
      const narrationByCueKey = new Map<string, { prompt?: string; downloadURL?: string }>();
      narrationSnap.docs.forEach((assetDoc) => {
        const data = assetDoc.data() as { cueKey?: string; prompt?: string; downloadURL?: string };
        if (data?.cueKey && data?.downloadURL) narrationByCueKey.set(data.cueKey, data);
      });
      const moduleNarrationRows: CoverageRow[] = MODULE_NARRATION_SCRIPTS.map((script) => {
        const candidate = narrationByCueKey.get(script.cueKey);
        return {
          label: script.label,
          cueKey: script.cueKey,
          present: Boolean(candidate && candidate.prompt === script.text),
        };
      });

      setCoverageSections([
        {
          id: 'moduleNarrations',
          title: 'Module spoken narrations — every sim + protocol line',
          generateHint: 'Generate on the Module Narrations tab',
          rows: moduleNarrationRows,
          note: 'Engine in-run cues with live state (round counters, scores) remain live TTS by design.',
        },
        {
          id: 'protocols',
          title: 'Protocol Library — signature + runtime sounds',
          generateHint: 'Generate on the Protocols tab',
          rows: protocolRows,
        },
        {
          id: 'sims',
          title: 'Sim Library — published variants with audio archetypes',
          generateHint: 'Generate on the Registry Sims tab',
          rows: simRows,
          note: visualOnlyPublished > 0
            ? `${visualOnlyPublished} published variant(s) use visual-only archetypes: no stored audio expected, spoken narration is live TTS.`
            : undefined,
        },
        {
          id: 'visionPro',
          title: 'Vision Pro reset chamber',
          generateHint: 'Generate on the Vision Pro tab',
          rows: vpRows,
        },
        {
          id: 'runAlerts',
          title: 'Run alerts',
          generateHint: 'Generate on the Run Alerts tab',
          rows: runAlertRows,
        },
        {
          id: 'macra',
          title: 'Macra onboarding voice',
          generateHint: 'Generate on the Macra Onboarding tab',
          rows: macraRows,
        },
        {
          id: 'tutorial',
          title: 'PulseCheck tutorial voice',
          generateHint: 'Generate on the PulseCheck Tutorial tab',
          rows: tutorialRows,
        },
      ]);
      setCoverageLoadedAt(new Date());
    } catch (e: any) {
      setCoverageError(e?.message || 'Failed to load narration coverage');
    } finally {
      setCoverageLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'coverage' && !coverageLoading && coverageSections.length === 0) {
      loadCoverage();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  useEffect(() => {
    loadConfig();
    loadAppSoundAssets();
    loadVPAssets();
    loadRitualAssets();
    loadRegistrySimAssets();
    loadProtocolAssets();
    loadRunAlertAssets();
    loadMacraOnboardingAssets();
    loadPulseCheckTutorialAssets();
    loadModuleNarrationAssets();
    return () => {
      stopNarration();
      stopSoundEffect();
      stopVPSound();
      stopRegistrySimSound();
      stopProtocolSound();
      stopRunAlertSound();
      stopMacraOnboardingNarration();
      stopPulseCheckTutorialNarration();
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

  // Dynamic Nora line preview — same voice config as the main preview, but the
  // text is built with the entered name and synthesized on the fly.
  const handlePlayDynamicLine = async (line: NoraDynamicLine) => {
    setError(null);
    stopNarration();
    setPlaying(false);
    setDynamicLinePlayingId(line.id);
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
      await speakStep(
        line.build(dynamicLineName),
        { onEnd: () => setDynamicLinePlayingId(null), onError: () => setDynamicLinePlayingId(null), fallbackToBrowser: false },
        choice
      );
    } catch {
      setError('Preview failed. Check provider API key and voice settings.');
      setDynamicLinePlayingId(null);
    }
  };

  const handleStopDynamicLine = () => { stopNarration(); setDynamicLinePlayingId(null); };

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
      persistVoiceConfig(payload);
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
    playAudioUrl(appSoundAssets[sound.id]?.downloadURL ?? `/audio/sfx/${sound.file}.mp3`);
  };

  // ── Pulse Ritual generation / preview / download handlers ────────
  // Mirrors the VP pattern: generate → upload to Firebase Storage →
  // write a Firestore doc at `ritual-sfx-assets/{soundId}`. The
  // downloadURL survives page reloads so previously generated sounds
  // come back with a Regen / Preview / Download row instead of
  // silently losing the audio.

  const RITUAL_SFX_COLLECTION = 'ritual-sfx-assets';
  const PULSECHECK_SFX_COLLECTION = 'pulsecheck-sfx-assets';

  // PulseCheck moment sounds ride the exact same generate/refine/persist
  // rails as Pulse Ritual — only the Firestore collection, Storage
  // folder, and family tag differ, resolved per sound.
  const isPulseCheckSfx = (sound: PulseRitualSound) => sound.category === 'pulsecheck-moment';
  const sfxCollectionFor = (sound: PulseRitualSound) =>
    isPulseCheckSfx(sound) ? PULSECHECK_SFX_COLLECTION : RITUAL_SFX_COLLECTION;
  const sfxStorageFolderFor = (sound: PulseRitualSound) =>
    isPulseCheckSfx(sound) ? 'pulsecheck-sfx' : 'ritual-sfx';
  const sfxFamilyFor = (sound: PulseRitualSound) =>
    isPulseCheckSfx(sound) ? 'pulsecheck' : 'pulse-ritual';

  const loadRitualAssets = async () => {
    setRitualLoading(true);
    setRitualLoadError(null);
    try {
      const results: Record<string, SimAudioAssetRef | null> = {};
      const prompts: Record<string, string> = {};
      await Promise.all(
        ALL_SFX_SOUNDS.map(async (sound) => {
          const snap = await getDoc(doc(db, sfxCollectionFor(sound), sound.id));
          if (snap.exists()) {
            const data = snap.data() as SimAudioAssetRef & { effectivePrompt?: string };
            results[sound.id] = data;
            // Persisted refined prompt overrides the static spec prompt
            // so the next regen continues from the latest iteration.
            if (data.effectivePrompt && data.effectivePrompt !== sound.prompt) {
              prompts[sound.id] = data.effectivePrompt;
            }
          } else {
            results[sound.id] = null;
          }
        })
      );
      setRitualAssets(results);
      setRitualEffectivePrompts(prompts);
    } catch (e: any) {
      setRitualLoadError(e?.message || 'Failed to load Pulse Ritual sounds');
    } finally {
      setRitualLoading(false);
    }
  };

  /// Generate (or regenerate) a Pulse Ritual sound. `overridePrompt`
  /// is set by the refinement loop so iterations don't lose the
  /// designer's edits. The effective prompt is stored on the asset
  /// record so future loads continue from the latest version.
  const generateRitualSound = async (
    sound: PulseRitualSound,
    overridePrompt?: string,
    feedbackForHistory?: string
  ) => {
    const effectivePrompt = (overridePrompt ?? ritualEffectivePrompts[sound.id] ?? sound.prompt).trim();

    setRitualGenErrors((prev) => {
      const next = { ...prev };
      delete next[sound.id];
      return next;
    });
    setRitualGenerating((prev) => ({ ...prev, [sound.id]: true }));
    try {
      const sfx = await generateSfxBlob(effectivePrompt, sound.durationSeconds, {
        promptInfluence: sound.promptInfluence,
      });

      // Upload to Firebase Storage at a stable path so previews on
      // future visits keep working.
      const path = `${sfxStorageFolderFor(sound)}/${sound.id}/${sound.file}.mp3`;
      const sRef = storageRef(storage, path);
      const snapshot = await uploadBytes(sRef, sfx.blob, { contentType: sfx.contentType });
      const downloadURL = await getDownloadURL(snapshot.ref);
      const gsUrl = `gs://${snapshot.ref.bucket}/${snapshot.ref.fullPath}`;

      const now = Date.now();
      const previous = ritualAssets[sound.id];
      const assetRecord: SimAudioAssetRef = {
        id: sound.id,
        cueKey: sound.id,
        label: sound.label,
        prompt: sound.prompt,
        provider: sfx.providerId,
        format: 'mp3',
        contentType: sfx.contentType,
        storagePath: path,
        gsUrl,
        downloadURL,
        createdAt: previous?.createdAt ?? now,
        updatedAt: now,
      };
      // Track refinement history as an append-only array on the doc
      // so the designer can see what feedback produced what prompt.
      const existingHistory = ((previous as any)?.refinementHistory ?? []) as Array<{
        at: number;
        feedback: string;
        prompt: string;
      }>;
      const refinementHistory =
        feedbackForHistory && overridePrompt
          ? [...existingHistory, { at: now, feedback: feedbackForHistory, prompt: overridePrompt }]
          : existingHistory;

      await setDoc(doc(db, sfxCollectionFor(sound), sound.id), {
        ...assetRecord,
        family: sfxFamilyFor(sound),
        category: sound.category,
        file: sound.file,
        priority: sound.priority,
        durationSeconds: sound.durationSeconds,
        effectivePrompt,
        refinementHistory,
      });

      setRitualAssets((prev) => ({
        ...prev,
        [sound.id]: { ...assetRecord, refinementHistory, effectivePrompt } as any,
      }));
      if (overridePrompt) {
        setRitualEffectivePrompts((prev) => ({ ...prev, [sound.id]: effectivePrompt }));
        setRitualFeedback((prev) => ({ ...prev, [sound.id]: '' }));
      }
    } catch (err: any) {
      console.error('[ritual sfx] generation failed', err);
      setRitualGenErrors((prev) => ({
        ...prev,
        [sound.id]: err?.message || 'Generation failed',
      }));
    } finally {
      setRitualGenerating((prev) => ({ ...prev, [sound.id]: false }));
    }
  };

  /// Pipe the designer's feedback through OpenAI to refine the prompt
  /// for this sound, then regenerate with the refined prompt. The
  /// refined prompt + feedback get persisted onto the Firestore doc
  /// so the iteration history is visible on future loads.
  const refineAndRegenRitualSound = async (sound: PulseRitualSound) => {
    const feedback = (ritualFeedback[sound.id] ?? '').trim();
    if (!feedback) return;
    const currentPrompt = ritualEffectivePrompts[sound.id] ?? sound.prompt;

    setRitualGenErrors((prev) => {
      const next = { ...prev };
      delete next[sound.id];
      return next;
    });
    setRitualRefining((prev) => ({ ...prev, [sound.id]: true }));
    try {
      const res = await fetch('/api/admin/refine-sfx-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          originalPrompt: currentPrompt,
          feedback,
          label: sound.label,
          description: sound.description,
          durationSeconds: sound.durationSeconds,
        }),
      });
      const payload = await res.json();
      if (!res.ok || !payload?.refinedPrompt) {
        throw new Error(payload?.error || 'Refinement failed');
      }
      await generateRitualSound(sound, payload.refinedPrompt as string, feedback);
    } catch (err: any) {
      console.error('[ritual sfx] refinement failed', err);
      setRitualGenErrors((prev) => ({
        ...prev,
        [sound.id]: err?.message || 'Refinement failed',
      }));
    } finally {
      setRitualRefining((prev) => ({ ...prev, [sound.id]: false }));
    }
  };

  /// Discard the refined prompt and reset to the original spec.
  const resetRitualPrompt = async (sound: PulseRitualSound) => {
    setRitualEffectivePrompts((prev) => {
      const next = { ...prev };
      delete next[sound.id];
      return next;
    });
    setRitualFeedback((prev) => ({ ...prev, [sound.id]: '' }));
    const existing = ritualAssets[sound.id];
    if (existing) {
      await setDoc(
        doc(db, sfxCollectionFor(sound), sound.id),
        { effectivePrompt: sound.prompt },
        { merge: true }
      );
      setRitualAssets((prev) => ({
        ...prev,
        [sound.id]: { ...(existing as any), effectivePrompt: sound.prompt },
      }));
    }
  };

  const previewRitualSound = (sound: PulseRitualSound) => {
    const asset = ritualAssets[sound.id];
    if (!asset?.downloadURL) return;
    stopSoundEffect();
    setPlayingSound(sound.id);
    playAudioUrl(asset.downloadURL);
  };

  const downloadRitualSound = async (sound: PulseRitualSound) => {
    const asset = ritualAssets[sound.id];
    if (!asset?.downloadURL) return;
    try {
      const res = await fetch(asset.downloadURL);
      const blob = await res.blob();
      const a = document.createElement('a');
      const url = URL.createObjectURL(blob);
      a.href = url;
      a.download = `${sound.file}.mp3`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('[ritual sfx] download failed', err);
    }
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
                Configure Nora's voice, Macra onboarding narration, PulseCheck tutorial narration, app sound libraries, immersive Vision Pro sound sets, and generated PulseCheck protocol signature audio.
              </p>
            </div>
            <button
              onClick={() => {
                loadConfig();
                loadMacraOnboardingAssets();
                loadPulseCheckTutorialAssets();
              }}
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

          <div className="mb-6 flex flex-wrap gap-3">
            <AudioTabButton
              active={activeTab === 'voice'}
              icon={<Mic2 className="h-4 w-4" />}
              label="Nora Voice"
              description="Global narration voice, provider selection, presets, and preview."
              onClick={() => setActiveTab('voice')}
            />
            <AudioTabButton
              active={activeTab === 'coverage'}
              icon={<CheckCircle className="h-4 w-4" />}
              label="Coverage Audit"
              description="One-screen rollup of every expected audio cue vs what's actually generated in sim-audio-assets."
              onClick={() => setActiveTab('coverage')}
            />
            <AudioTabButton
              active={activeTab === 'moduleNarrations'}
              icon={<Mic2 className="h-4 w-4" />}
              label="Module Narrations"
              description="Pre-generated Nora spoken clips for every sim and protocol — stored audio first, live TTS only as fallback."
              onClick={() => setActiveTab('moduleNarrations')}
            />
            <AudioTabButton
              active={activeTab === 'macraOnboarding'}
              icon={<Smartphone className="h-4 w-4" />}
              label="Macra Onboarding"
              description="Pre-generated Nora voice clips for each Macra onboarding step."
              onClick={() => setActiveTab('macraOnboarding')}
            />
            <AudioTabButton
              active={activeTab === 'pulseCheckTutorial'}
              icon={<MessageSquare className="h-4 w-4" />}
              label="PulseCheck Tutorial"
              description="Pre-generated Nora voice clips for the home tutorial sheet."
              onClick={() => setActiveTab('pulseCheckTutorial')}
            />
            <AudioTabButton
              active={activeTab === 'appLibrary'}
              icon={<Music className="h-4 w-4" />}
              label="Fit With Pulse App Sounds"
              description="Fit With Pulse app sound effects with category-based preview."
              onClick={() => setActiveTab('appLibrary')}
            />
            <AudioTabButton
              active={activeTab === 'pulseCheckAppSounds'}
              icon={<Smartphone className="h-4 w-4" />}
              label="PulseCheck App Sounds"
              description="Core PulseCheck app sound effects for launch, selections, messaging, training, and success moments."
              onClick={() => setActiveTab('pulseCheckAppSounds')}
            />
            <AudioTabButton
              active={activeTab === 'ritual'}
              icon={<Sparkles className="h-4 w-4" />}
              label="Pulse Ritual"
              description="Soft, intentional, peaceful SFX for the Pulse Ritual iOS app. Generate, preview, download."
              onClick={() => setActiveTab('ritual')}
            />
            <AudioTabButton
              active={activeTab === 'pulsecheckSfx'}
              icon={<Volume2 className="h-4 w-4" />}
              label="PulseCheck Moments"
              description="Path and ceremony moment SFX for the PulseCheck app: dark, premium, athletic. Delivered over the air."
              onClick={() => setActiveTab('pulsecheckSfx')}
            />
            <AudioTabButton
              active={activeTab === 'registrySims'}
              icon={<Volume2 className="h-4 w-4" />}
              label="Registry Sims"
              description="Generated sim audio assets grouped by family and variant from the variant registry."
              onClick={() => setActiveTab('registrySims')}
            />
            <AudioTabButton
              active={activeTab === 'visionPro'}
              icon={<Eye className="h-4 w-4" />}
              label="Vision Pro"
              description="Immersive chamber sounds, spoken countdowns, and trial-specific audio packages."
              onClick={() => setActiveTab('visionPro')}
            />
            <AudioTabButton
              active={activeTab === 'protocols'}
              icon={<Wand2 className="h-4 w-4" />}
              label="Protocols"
              description="Generated signature sound effects for every PulseCheck protocol in the registry."
              onClick={() => setActiveTab('protocols')}
            />
            <AudioTabButton
              active={activeTab === 'runAlerts'}
              icon={<Bell className="h-4 w-4" />}
              label="Run Alerts"
              description="Generated spoken alerts for off-body phone detection and runs left active too long."
              onClick={() => setActiveTab('runAlerts')}
            />
          </div>

          {/* ════════════════════════
              SECTION 0: COVERAGE AUDIT
          ════════════════════════ */}
          {activeTab === 'coverage' && (
            <div className="rounded-2xl bg-zinc-900/40 border border-white/10 backdrop-blur-xl mb-6 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div>
                  <div className="font-semibold text-white">Narration &amp; Audio Coverage</div>
                  <div className="text-xs text-zinc-500">
                    Every expected cue checked against the sim-audio-assets inventory{coverageLoadedAt ? ` · checked ${coverageLoadedAt.toLocaleTimeString()}` : ''}
                  </div>
                </div>
                <button
                  onClick={loadCoverage}
                  disabled={coverageLoading}
                  className="flex items-center gap-2 rounded-xl border border-zinc-700 px-4 py-2 text-sm text-zinc-300 transition hover:text-zinc-100 disabled:opacity-50"
                >
                  {coverageLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  Re-run audit
                </button>
              </div>

              <div className="mb-4 rounded-xl border border-sky-700/40 bg-sky-950/30 px-4 py-3 text-xs leading-relaxed text-sky-200">
                Spoken module narration (intros, phase cues, completion lines in sims and protocols) is synthesized live at
                playback via ElevenLabs — it is not a stored asset and cannot be "missing" from a library. If a module
                plays silently on iOS, that is a failed live TTS call (iOS falls back to silence, web falls back to
                browser speech). This audit covers the STORED audio: protocol signatures, runtime beds, sim variant
                audio packages, and pre-generated voice lines.
              </div>

              {coverageError && (
                <div className="mb-4 rounded-xl border border-rose-700/60 bg-rose-950/30 px-4 py-3 text-sm text-rose-200">{coverageError}</div>
              )}

              {coverageLoading && coverageSections.length === 0 ? (
                <div className="flex items-center gap-2 py-8 text-zinc-400 text-sm">
                  <Loader2 className="h-4 w-4 animate-spin" /> Auditing every cue against sim-audio-assets…
                </div>
              ) : (
                <div className="space-y-4">
                  {coverageSections.map((section) => {
                    const presentCount = section.rows.filter((r) => r.present).length;
                    const missing = section.rows.filter((r) => !r.present);
                    const complete = section.rows.length > 0 && missing.length === 0;
                    return (
                      <div key={section.id} className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-4">
                        <div className="flex flex-wrap items-center gap-3">
                          <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${complete ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200' : 'border-rose-500/30 bg-rose-500/10 text-rose-200'}`}>
                            {presentCount} / {section.rows.length} generated
                          </span>
                          <span className="text-sm font-medium text-zinc-100">{section.title}</span>
                          {!complete && <span className="text-xs text-zinc-500">{section.generateHint}</span>}
                        </div>
                        {section.note && (
                          <div className="mt-2 text-xs text-zinc-500">{section.note}</div>
                        )}
                        {missing.length > 0 && (
                          <div className="mt-3 space-y-1">
                            {missing.map((row) => (
                              <div key={row.cueKey + row.label} className="flex flex-wrap items-center gap-2 rounded-lg border border-rose-800/40 bg-rose-950/20 px-3 py-1.5 text-xs">
                                <span className="text-rose-200">{row.label}</span>
                                <span className="font-mono text-rose-300/60">{row.cueKey}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        {presentCount > 0 && (
                          <details className="mt-2">
                            <summary className="cursor-pointer text-xs text-zinc-500 hover:text-zinc-300">Show {presentCount} generated</summary>
                            <div className="mt-2 space-y-1">
                              {section.rows.filter((r) => r.present).map((row) => (
                                <div key={row.cueKey + row.label} className="flex flex-wrap items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-1.5 text-xs">
                                  <span className="text-zinc-300">{row.label}</span>
                                  <span className="font-mono text-zinc-600">{row.cueKey}</span>
                                </div>
                              ))}
                            </div>
                          </details>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ════════════════════════
              SECTION 0.5: MODULE NARRATIONS
          ════════════════════════ */}
          {activeTab === 'moduleNarrations' && (() => {
            const generatedCount = MODULE_NARRATION_SCRIPTS.filter((s) => moduleNarrationAssets[s.cueKey]?.downloadURL).length;
            const moduleGroups = MODULE_NARRATION_SCRIPTS.reduce<Record<string, { moduleName: string; category: string; scripts: ModuleNarrationScript[] }>>((acc, script) => {
              acc[script.moduleId] ||= { moduleName: script.moduleName, category: script.category, scripts: [] };
              acc[script.moduleId].scripts.push(script);
              return acc;
            }, {});
            return (
              <div className="rounded-2xl bg-zinc-900/40 border border-white/10 backdrop-blur-xl mb-6 p-5">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                  <div>
                    <div className="font-semibold text-white">Module Spoken Narrations</div>
                    <div className="text-xs text-zinc-500">
                      Every line Nora speaks in the sim and protocol players, pre-generated with the configured voice.
                      iOS plays these stored clips and only falls back to live TTS on a miss.
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${generatedCount === MODULE_NARRATION_SCRIPTS.length ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200' : 'border-amber-500/30 bg-amber-500/10 text-amber-200'}`}>
                      {generatedCount} / {MODULE_NARRATION_SCRIPTS.length} generated
                    </span>
                    <button
                      onClick={loadModuleNarrationAssets}
                      disabled={moduleNarrationLoading || moduleNarrationBulkRunning}
                      className="flex items-center gap-2 rounded-xl border border-zinc-700 px-3 py-2 text-sm text-zinc-300 transition hover:text-zinc-100 disabled:opacity-50"
                    >
                      {moduleNarrationLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    </button>
                    <button
                      onClick={generateMissingModuleNarrations}
                      disabled={moduleNarrationBulkRunning || generatedCount === MODULE_NARRATION_SCRIPTS.length}
                      className="flex items-center gap-2 rounded-xl border border-[#E0FE10]/40 bg-[#E0FE10]/10 px-4 py-2 text-sm font-medium text-[#E0FE10] transition hover:bg-[#E0FE10]/20 disabled:opacity-50"
                    >
                      {moduleNarrationBulkRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                      {moduleNarrationBulkRunning ? 'Generating…' : `Generate ${MODULE_NARRATION_SCRIPTS.length - generatedCount} Missing`}
                    </button>
                  </div>
                </div>

                <div className="mb-4 rounded-xl border border-sky-700/40 bg-sky-950/30 px-4 py-3 text-xs leading-relaxed text-sky-200">
                  Clips are matched to playback by an exact hash of the spoken text. If a module's copy or config changes,
                  its clips show as stale/missing here — regenerate them. Static in-sim rule readouts and Reset game
                  phase cues are pre-generated; only cues containing live state (round counters, scores, "Rep X of Y"
                  practice lines, sim summaries) remain live TTS by design. Sims running a custom build artifact whose
                  name or athlete description differs from the seed fall back to live TTS for their intro. Changing the
                  Nora voice on the Voice tab does not retroactively update stored clips; regenerate after a voice change.
                </div>

                {moduleNarrationLoadError && (
                  <div className="mb-4 rounded-xl border border-rose-700/60 bg-rose-950/30 px-4 py-3 text-sm text-rose-200">{moduleNarrationLoadError}</div>
                )}

                <div className="space-y-4">
                  {Object.entries(moduleGroups).map(([moduleId, group]) => {
                    const groupGenerated = group.scripts.filter((s) => moduleNarrationAssets[s.cueKey]?.downloadURL).length;
                    const groupComplete = groupGenerated === group.scripts.length;
                    return (
                      <div key={moduleId} className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-4">
                        <div className="flex flex-wrap items-center gap-3 mb-3">
                          <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${groupComplete ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200' : 'border-amber-500/30 bg-amber-500/10 text-amber-200'}`}>
                            {groupGenerated} / {group.scripts.length}
                          </span>
                          <span className="text-sm font-medium text-zinc-100">{group.moduleName}</span>
                          <span className="text-xs uppercase tracking-wide text-zinc-600">{group.category}</span>
                          <span className="font-mono text-xs text-zinc-600">{moduleId}</span>
                        </div>
                        <div className="space-y-1.5">
                          {group.scripts.map((script) => {
                            const asset = moduleNarrationAssets[script.cueKey];
                            const isGenerating = Boolean(moduleNarrationGenerating[script.cueKey]);
                            const genError = moduleNarrationGenErrors[script.cueKey];
                            return (
                              <div key={script.cueKey} className="rounded-lg border border-zinc-800/70 bg-zinc-900/40 px-3 py-2">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="w-20 shrink-0 font-mono text-xs text-zinc-500">{script.slot}</span>
                                  <span className="flex-1 min-w-[200px] text-xs text-zinc-300">{script.text}</span>
                                  {asset?.downloadURL ? (
                                    <>
                                      <button
                                        onClick={() => (moduleNarrationPlayingId === script.cueKey ? stopModuleNarrationPlayback() : playModuleNarration(script.cueKey, asset.downloadURL))}
                                        className="flex items-center gap-1 rounded-lg border border-zinc-700 px-2 py-1 text-xs text-zinc-300 transition hover:text-white"
                                      >
                                        {moduleNarrationPlayingId === script.cueKey ? <Square className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                                        {moduleNarrationPlayingId === script.cueKey ? 'Stop' : 'Play'}
                                      </button>
                                      <button
                                        onClick={() => generateModuleNarration(script)}
                                        disabled={isGenerating || moduleNarrationBulkRunning}
                                        className="rounded-lg border border-zinc-700 px-2 py-1 text-xs text-zinc-400 transition hover:text-zinc-200 disabled:opacity-50"
                                      >
                                        {isGenerating ? 'Regenerating…' : 'Regenerate'}
                                      </button>
                                    </>
                                  ) : (
                                    <button
                                      onClick={() => generateModuleNarration(script)}
                                      disabled={isGenerating || moduleNarrationBulkRunning}
                                      className="flex items-center gap-1 rounded-lg border border-[#E0FE10]/40 bg-[#E0FE10]/10 px-2.5 py-1 text-xs font-medium text-[#E0FE10] transition hover:bg-[#E0FE10]/20 disabled:opacity-50"
                                    >
                                      {isGenerating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                                      {isGenerating ? 'Generating…' : 'Generate'}
                                    </button>
                                  )}
                                </div>
                                {genError && (
                                  <div className="mt-1 text-xs text-rose-300">{genError}</div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* ════════════════════════
              SECTION 1: AI VOICE
          ════════════════════════ */}
          {activeTab === 'voice' && (
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

                    {/* Dynamic Nora lines — name is inserted at play time, so these
                        are synthesized live (no stored file) using the voice above. */}
                    <div className="mt-8 rounded-2xl border border-white/10 bg-zinc-950/40 p-5">
                      <div className="flex flex-col gap-1">
                        <div className="text-white font-medium">Dynamic Nora Lines</div>
                        <div className="text-xs text-zinc-500">
                          Personalized lines that insert a name on the fly (no stored MP3). Type a name and play it with the current voice.
                        </div>
                      </div>

                      <div className="mt-4 flex items-center gap-3">
                        <label className="text-xs text-zinc-400">Coach name</label>
                        <input
                          value={dynamicLineName}
                          onChange={(e) => setDynamicLineName(e.target.value)}
                          placeholder="Tre"
                          className="w-48 rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-white/10"
                        />
                      </div>

                      <div className="mt-4 space-y-3">
                        {NORA_DYNAMIC_LINES.map((line) => {
                          const isPlaying = dynamicLinePlayingId === line.id;
                          return (
                            <div key={line.id} className="rounded-xl border border-zinc-800 bg-black/30 p-4">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="text-sm font-semibold text-white">{line.label}</div>
                                  <div className="mt-0.5 text-xs text-zinc-500">{line.description}</div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => (isPlaying ? handleStopDynamicLine() : void handlePlayDynamicLine(line))}
                                  className="flex flex-shrink-0 items-center gap-2 rounded-xl bg-zinc-800 border border-zinc-700 px-4 py-2 text-sm text-white transition-colors hover:bg-zinc-700"
                                >
                                  {isPlaying ? <Square className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                                  {isPlaying ? 'Stop' : 'Play'}
                                </button>
                              </div>
                              <div className="mt-3 rounded-lg border border-white/5 bg-zinc-900/60 px-3 py-2 text-sm italic text-zinc-300">
                                “{line.build(dynamicLineName)}”
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
	          )}

	          {activeTab === 'macraOnboarding' && (
	          <div className="rounded-2xl bg-zinc-900/40 border border-white/10 backdrop-blur-xl p-5">
	            <div className="mb-1 flex items-center justify-between gap-3">
	              <div className="flex items-center gap-3">
	                <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#E0FE10]/25 bg-[#E0FE10]/12">
	                  <Smartphone className="h-4 w-4 text-[#E0FE10]" />
	                </div>
	                <div>
	                  <div className="font-semibold text-white">Macra Onboarding Nora Narrations</div>
	                  <div className="mt-0.5 text-xs text-zinc-500">
	                    Generate each fixed onboarding line once, store the MP3 URL on the AI voice config, then Macra iOS fetches and plays it by step key.
	                  </div>
	                </div>
	              </div>
	              <div className="flex flex-shrink-0 items-center gap-2">
	                <button
	                  onClick={generateMissingMacraOnboardingNarrations}
	                  disabled={Object.values(macraOnboardingGenerating).some(Boolean)}
	                  className="flex items-center gap-2 rounded-xl border border-[#E0FE10]/30 bg-[#E0FE10]/15 px-3 py-1.5 text-xs font-semibold text-[#E0FE10] transition-colors hover:bg-[#E0FE10]/20 disabled:opacity-50"
	                >
	                  <Wand2 className="h-3.5 w-3.5" />
	                  Generate Missing
	                </button>
	                <button
	                  onClick={loadMacraOnboardingAssets}
	                  disabled={macraOnboardingLoading}
	                  className="flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs text-white transition-colors hover:bg-zinc-700 disabled:opacity-50"
	                >
	                  {macraOnboardingLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
	                  Refresh
	                </button>
	              </div>
	            </div>

	            <AnimatePresence>
	              {macraOnboardingLoadError && (
	                <motion.div
	                  initial={{ opacity: 0, height: 0 }}
	                  animate={{ opacity: 1, height: 'auto' }}
	                  exit={{ opacity: 0, height: 0 }}
	                  className="mt-3 rounded-xl border border-red-700/40 bg-red-900/20 p-3 text-xs text-red-200"
	                >
	                  {macraOnboardingLoadError}
	                </motion.div>
	              )}
	            </AnimatePresence>

	            <div className="mt-4 flex items-start gap-3 rounded-xl border border-white/[0.05] bg-zinc-950/60 p-3 text-xs text-zinc-400">
	              <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-zinc-500" />
	              <div>
	                Assets are written to <code className="font-mono text-zinc-300">app-config/ai-voice.macraOnboardingNarrations</code> and uploaded under <code className="font-mono text-zinc-300">sim-audio-assets/macra-onboarding/</code>. Regenerate a line whenever its copy changes.
	              </div>
	            </div>

	            <div className="mt-5 grid grid-cols-1 gap-3">
	              {MACRA_ONBOARDING_NARRATION_CUES.map((cue) => (
	                <div key={cue.cueKey}>
	                  <FixedNarrationCard
	                    cue={cue}
	                    asset={macraOnboardingAssets[cue.cueKey] ?? null}
	                    generating={macraOnboardingGenerating[cue.cueKey] ?? false}
	                    isPlaying={macraOnboardingPlayingId === cue.cueKey}
	                    onGenerate={() => generateMacraOnboardingNarration(cue)}
	                    onPlay={() => {
	                      const url = macraOnboardingAssets[cue.cueKey]?.downloadURL;
	                      if (url) playMacraOnboardingNarration(cue.cueKey, url);
	                    }}
	                    onStop={stopMacraOnboardingNarration}
	                  />
	                  <AnimatePresence>
	                    {macraOnboardingGenErrors[cue.cueKey] && (
	                      <motion.div
	                        initial={{ opacity: 0, height: 0 }}
	                        animate={{ opacity: 1, height: 'auto' }}
	                        exit={{ opacity: 0, height: 0 }}
	                        className="mt-1 rounded-lg border border-red-700/30 bg-red-900/20 px-3 py-2 text-[11px] text-red-300"
	                      >
	                        {macraOnboardingGenErrors[cue.cueKey]}
	                      </motion.div>
	                    )}
	                  </AnimatePresence>
	                </div>
	              ))}
	            </div>

	            <div className="mt-5 flex flex-wrap items-center gap-4 border-t border-white/[0.05] pt-4 text-xs text-zinc-500">
	              <div>
	                <span className="font-semibold text-zinc-300">{Object.values(macraOnboardingAssets).filter(Boolean).length}</span>
	                {' / '}{MACRA_ONBOARDING_NARRATION_CUES.length} lines generated
	              </div>
	              {Object.values(macraOnboardingGenerating).some(Boolean) && (
	                <div className="flex items-center gap-1.5 text-amber-400">
	                  <Loader2 className="h-3 w-3 animate-spin" />
	                  {Object.values(macraOnboardingGenerating).filter(Boolean).length} generating…
	                </div>
	              )}
	              <div className="ml-auto text-zinc-600">
	                Firestore: <code className="font-mono">app-config/ai-voice</code> · Storage: <code className="font-mono">sim-audio-assets/macra-onboarding/</code>
	              </div>
	            </div>
	          </div>
	          )}

	          {activeTab === 'pulseCheckTutorial' && (
	          <div className="rounded-2xl bg-zinc-900/40 border border-white/10 backdrop-blur-xl p-5">
	            <div className="mb-1 flex items-center justify-between gap-3">
	              <div className="flex items-center gap-3">
	                <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#E0FE10]/25 bg-[#E0FE10]/12">
	                  <MessageSquare className="h-4 w-4 text-[#E0FE10]" />
	                </div>
	                <div>
	                  <div className="font-semibold text-white">PulseCheck Tutorial Nora Narrations</div>
	                  <div className="mt-0.5 text-xs text-zinc-500">
	                    Generate each fixed home tutorial line once, store the MP3 URL on the AI voice config, then PulseCheck iOS fetches and plays it by tutorial key.
	                  </div>
	                </div>
	              </div>
	              <div className="flex flex-shrink-0 items-center gap-2">
	                <button
	                  onClick={generateMissingPulseCheckTutorialNarrations}
	                  disabled={Object.values(pulseCheckTutorialGenerating).some(Boolean)}
	                  className="flex items-center gap-2 rounded-xl border border-[#E0FE10]/30 bg-[#E0FE10]/15 px-3 py-1.5 text-xs font-semibold text-[#E0FE10] transition-colors hover:bg-[#E0FE10]/20 disabled:opacity-50"
	                >
	                  <Wand2 className="h-3.5 w-3.5" />
	                  Generate Missing
	                </button>
	                <button
	                  onClick={loadPulseCheckTutorialAssets}
	                  disabled={pulseCheckTutorialLoading}
	                  className="flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs text-white transition-colors hover:bg-zinc-700 disabled:opacity-50"
	                >
	                  {pulseCheckTutorialLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
	                  Refresh
	                </button>
	              </div>
	            </div>

	            <AnimatePresence>
	              {pulseCheckTutorialLoadError && (
	                <motion.div
	                  initial={{ opacity: 0, height: 0 }}
	                  animate={{ opacity: 1, height: 'auto' }}
	                  exit={{ opacity: 0, height: 0 }}
	                  className="mt-3 rounded-xl border border-red-700/40 bg-red-900/20 p-3 text-xs text-red-200"
	                >
	                  {pulseCheckTutorialLoadError}
	                </motion.div>
	              )}
	            </AnimatePresence>

	            <div className="mt-4 flex items-start gap-3 rounded-xl border border-white/[0.05] bg-zinc-950/60 p-3 text-xs text-zinc-400">
	              <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-zinc-500" />
	              <div>
	                Assets are written to <code className="font-mono text-zinc-300">app-config/ai-voice.{PULSECHECK_TUTORIAL_NARRATION_CONFIG_FIELD}</code> and uploaded under <code className="font-mono text-zinc-300">sim-audio-assets/{PULSECHECK_TUTORIAL_ENGINE_KEY}/</code>. Regenerate a line whenever its copy changes.
	              </div>
	            </div>

	            <div className="mt-5 grid grid-cols-1 gap-3">
	              {PULSECHECK_TUTORIAL_NARRATION_CUES.map((cue) => (
	                <div key={cue.cueKey}>
	                  <FixedNarrationCard
	                    cue={cue}
	                    asset={pulseCheckTutorialAssets[cue.cueKey] ?? null}
	                    generating={pulseCheckTutorialGenerating[cue.cueKey] ?? false}
	                    isPlaying={pulseCheckTutorialPlayingId === cue.cueKey}
	                    onGenerate={() => generatePulseCheckTutorialNarration(cue)}
	                    onPlay={() => {
	                      const url = pulseCheckTutorialAssets[cue.cueKey]?.downloadURL;
	                      if (url) playPulseCheckTutorialNarration(cue.cueKey, url);
	                    }}
	                    onStop={stopPulseCheckTutorialNarration}
	                  />
	                  <AnimatePresence>
	                    {pulseCheckTutorialGenErrors[cue.cueKey] && (
	                      <motion.div
	                        initial={{ opacity: 0, height: 0 }}
	                        animate={{ opacity: 1, height: 'auto' }}
	                        exit={{ opacity: 0, height: 0 }}
	                        className="mt-1 rounded-lg border border-red-700/30 bg-red-900/20 px-3 py-2 text-[11px] text-red-300"
	                      >
	                        {pulseCheckTutorialGenErrors[cue.cueKey]}
	                      </motion.div>
	                    )}
	                  </AnimatePresence>
	                </div>
	              ))}
	            </div>

	            <div className="mt-5 flex flex-wrap items-center gap-4 border-t border-white/[0.05] pt-4 text-xs text-zinc-500">
	              <div>
	                <span className="font-semibold text-zinc-300">{Object.values(pulseCheckTutorialAssets).filter(Boolean).length}</span>
	                {' / '}{PULSECHECK_TUTORIAL_NARRATION_CUES.length} lines generated
	              </div>
	              {Object.values(pulseCheckTutorialGenerating).some(Boolean) && (
	                <div className="flex items-center gap-1.5 text-amber-400">
	                  <Loader2 className="h-3 w-3 animate-spin" />
	                  {Object.values(pulseCheckTutorialGenerating).filter(Boolean).length} generating…
	                </div>
	              )}
	              <div className="ml-auto text-zinc-600">
	                Firestore: <code className="font-mono">app-config/ai-voice</code> · Storage: <code className="font-mono">sim-audio-assets/{PULSECHECK_TUTORIAL_ENGINE_KEY}/</code>
	              </div>
	            </div>
	          </div>
	          )}

	          {/* ════════════════════════
	              SECTION 2: SOUND EFFECTS
	          ════════════════════════ */}
          {(activeTab === 'appLibrary' || activeTab === 'pulseCheckAppSounds') && (() => {
            const isPulseCheckLibrary = activeTab === 'pulseCheckAppSounds';
            const soundsByCategory = isPulseCheckLibrary ? groupedPulseCheckAppSounds : groupedCommunitySounds;
            const librarySounds = isPulseCheckLibrary ? pulseCheckAppSounds : communityAppSounds;

            return (
          <div className="rounded-2xl bg-zinc-900/40 border border-white/10 backdrop-blur-xl p-5">
            <div className="flex items-center gap-3 mb-6">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                isPulseCheckLibrary
                  ? 'bg-[#8B5CF6]/15 border border-[#8B5CF6]/25'
                  : 'bg-[#E0FE10]/10 border border-[#E0FE10]/20'
              }`}>
                {isPulseCheckLibrary
                  ? <Smartphone className="w-4 h-4 text-purple-400" />
                  : <Music className="w-4 h-4 text-[#E0FE10]" />}
              </div>
              <div>
                <div className="font-semibold text-white">
                  {isPulseCheckLibrary ? 'PulseCheck App Sounds' : 'Fit With Pulse App Sounds'}
                </div>
                <div className="text-xs text-zinc-500">
                  All {librarySounds.length} {isPulseCheckLibrary ? 'PulseCheck iOS' : 'Fit With Pulse'} sounds. Click Preview to hear them.
                </div>
                {appSoundLoadError && (
                  <div className="mt-1 text-[11px] text-red-300">{appSoundLoadError}</div>
                )}
              </div>
              <div className="ml-auto flex items-center gap-2">
                <button
                  onClick={loadAppSoundAssets}
                  disabled={appSoundLoading}
                  className="flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-700 disabled:opacity-50"
                >
                  {appSoundLoading
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <RefreshCw className="h-3.5 w-3.5" />}
                  Refresh
                </button>
                {playingSound && (
                  <button onClick={stopSoundEffect} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-300 text-xs hover:bg-zinc-700">
                    <VolumeX className="w-3.5 h-3.5" />Stop All
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-8">
              {CATEGORY_ORDER.map((cat) => {
                const sounds = soundsByCategory[cat];
                if (!sounds?.length) return null;
                const isOpen = librarySectionsOpen[cat] ?? true;
                return (
                  <div key={cat} className="rounded-2xl border border-white/[0.06] bg-black/10">
                    <button
                      type="button"
                      onClick={() => toggleLibrarySection(cat)}
                      className="flex w-full items-center gap-2 px-4 py-4 text-left"
                    >
                      <span className="text-xs font-semibold uppercase tracking-[0.15em] text-zinc-500">{CATEGORY_LABELS[cat]}</span>
                      <div className="h-px flex-1 bg-white/[0.05]" />
                      <span className="text-xs text-zinc-600">{sounds.length} sounds</span>
                      {isOpen ? <ChevronUp className="h-4 w-4 text-zinc-500" /> : <ChevronDown className="h-4 w-4 text-zinc-500" />}
                    </button>
                    <AnimatePresence initial={false}>
                      {isOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="grid grid-cols-1 gap-3 px-4 pb-4 sm:grid-cols-2">
                            {sounds.map((sound) => (
                              <SoundCard
                                key={sound.id}
                                sound={sound}
                                asset={appSoundAssets[sound.id] ?? null}
                                generating={Boolean(appSoundGenerating[sound.id])}
                                generationError={appSoundGenErrors[sound.id]}
                                isPlaying={playingSound === sound.id}
                                onRegenerate={() => regenerateAppSound(sound)}
                                onPlay={() => playSoundEffect(sound)}
                                onStop={stopSoundEffect}
                              />
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>

            {/* Legend */}
            <div className="mt-8 flex flex-wrap gap-3 text-xs text-zinc-500 border-t border-white/[0.05] pt-5">
              <div className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${isPulseCheckLibrary ? 'bg-[#8B5CF6]/60' : 'bg-[#E0FE10]/60'}`} />
                {isPulseCheckLibrary ? 'PulseCheck iOS App' : 'Fit With Pulse App (iOS/Android)'}
              </div>
              <div className="ml-auto text-zinc-600">
                Preview uses the latest generated Firebase asset, with <code className="font-mono">/public/audio/</code> as fallback
              </div>
            </div>
          </div>
            );
          })()}

          {(activeTab === 'ritual' || activeTab === 'pulsecheckSfx') && (
          <div className="rounded-2xl bg-zinc-900/40 border border-white/10 backdrop-blur-xl p-5">
            <div className="mb-6 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-teal-500/15 border border-teal-500/25 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-teal-300" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-white">
                  {activeTab === 'ritual' ? 'Pulse Ritual Sound Effects' : 'PulseCheck Moment Sound Effects'}
                </div>
                <div className="text-xs text-zinc-500">
                  {activeTab === 'ritual' ? (
                    <>Soft, intentional, peaceful — {RITUAL_SOUNDS.length} sounds. Generated audio is persisted to Firebase Storage and survives reloads — download into the iOS bundle as <code className="font-mono">Resources/Sounds/&lt;file&gt;.mp3</code>.</>
                  ) : (
                    <>Dark, premium, athletic — {PULSECHECK_SOUNDS.length} sounds for path and ceremony moments. Delivered over the air via <code className="font-mono">pulsecheck-sfx-assets</code>: the app hydrates + caches on launch, so regens reach devices without a rebuild.</>
                  )}
                </div>
                {ritualLoadError && (
                  <div className="mt-2 text-[11px] text-red-300">{ritualLoadError}</div>
                )}
              </div>
              <div className="ml-auto flex items-center gap-2">
                {ritualLoading && (
                  <span className="flex items-center gap-1.5 text-[11px] text-zinc-500">
                    <Loader2 className="w-3 h-3 animate-spin" />Loading
                  </span>
                )}
                <button
                  onClick={loadRitualAssets}
                  disabled={ritualLoading}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-300 text-xs hover:bg-zinc-700 disabled:opacity-50"
                >
                  <RefreshCw className="w-3.5 h-3.5" />Refresh
                </button>
                {playingSound && (
                  <button
                    onClick={stopSoundEffect}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-300 text-xs hover:bg-zinc-700"
                  >
                    <VolumeX className="w-3.5 h-3.5" />Stop preview
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-8">
              {RITUAL_CATEGORY_ORDER.map((cat) => {
                const sounds = (activeTab === 'pulsecheckSfx' ? PULSECHECK_SOUNDS : RITUAL_SOUNDS).filter((s) => s.category === cat);
                if (sounds.length === 0) return null;
                return (
                  <div key={cat} className="rounded-2xl border border-white/[0.06] bg-black/10">
                    <div className="flex items-center gap-2 px-4 py-4">
                      <span className="text-xs font-semibold uppercase tracking-[0.15em] text-zinc-500">
                        {RITUAL_CATEGORY_LABELS[cat]}
                      </span>
                      <div className="h-px flex-1 bg-white/[0.05]" />
                      <span className="text-xs text-zinc-600">{sounds.length} sounds</span>
                    </div>
                    <div className="grid grid-cols-1 gap-3 px-4 pb-4">
                      {sounds.map((sound) => {
                        const generating = Boolean(ritualGenerating[sound.id]);
                        const refining = Boolean(ritualRefining[sound.id]);
                        const asset = ritualAssets[sound.id];
                        const generated = Boolean(asset?.downloadURL);
                        const error = ritualGenErrors[sound.id];
                        const isPlaying = playingSound === sound.id;
                        const priorityBadge = RITUAL_PRIORITY_BADGE[sound.priority];
                        const effectivePrompt = ritualEffectivePrompts[sound.id];
                        const hasRefinement = Boolean(effectivePrompt && effectivePrompt !== sound.prompt);
                        const feedbackText = ritualFeedback[sound.id] ?? '';
                        const history = ((asset as any)?.refinementHistory ?? []) as Array<{
                          at: number;
                          feedback: string;
                          prompt: string;
                        }>;

                        return (
                          <motion.div
                            key={sound.id}
                            layout
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            className={`rounded-xl border p-4 transition-all duration-200 ${
                              isPlaying
                                ? 'border-teal-400/40 bg-teal-500/[0.04]'
                                : 'border-white/[0.07] bg-white/[0.02] hover:border-white/[0.12]'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-start gap-3 min-w-0">
                                <div
                                  className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${
                                    isPlaying ? 'bg-teal-500/20 text-teal-300' : 'bg-white/5 text-zinc-400'
                                  }`}
                                >
                                  {sound.icon}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-sm font-semibold text-white">{sound.label}</span>
                                    <span
                                      className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md border ${priorityBadge.classes}`}
                                    >
                                      {priorityBadge.label}
                                    </span>
                                    <span className="text-[10px] text-zinc-500">
                                      {sound.durationSeconds}s
                                    </span>
                                  </div>
                                  <p className="text-xs text-zinc-500 mt-1 leading-relaxed">{sound.description}</p>

                                  {hasRefinement ? (
                                    <>
                                      <p className="text-[11px] text-teal-300/85 mt-2 leading-relaxed">
                                        <span className="text-teal-400/70 uppercase tracking-wider text-[9px] mr-1">Refined Prompt</span>
                                        {effectivePrompt}
                                      </p>
                                      <details className="mt-1">
                                        <summary className="text-[10px] text-zinc-600 cursor-pointer hover:text-zinc-400">
                                          Original spec prompt
                                        </summary>
                                        <p className="text-[10px] text-zinc-500 mt-1 leading-relaxed">{sound.prompt}</p>
                                      </details>
                                    </>
                                  ) : (
                                    <p className="text-[11px] text-zinc-400 mt-2 leading-relaxed">
                                      <span className="text-zinc-500 uppercase tracking-wider text-[9px] mr-1">Prompt</span>
                                      {sound.prompt}
                                    </p>
                                  )}

                                  <p className="text-[10px] text-zinc-600 mt-2">
                                    <span className="uppercase tracking-wider mr-1">Pairs with</span>
                                    {sound.pairedHapticNote}
                                  </p>
                                  <code className="text-[10px] text-zinc-600 font-mono mt-2 block">
                                    {sound.file}.mp3
                                  </code>
                                </div>
                              </div>

                              <div className="flex flex-shrink-0 flex-col gap-1.5">
                                <button
                                  onClick={() => generateRitualSound(sound)}
                                  disabled={generating}
                                  className={`flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                                    generating
                                      ? 'bg-teal-500/10 border-teal-500/25 text-teal-300 cursor-wait'
                                      : generated
                                      ? 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700'
                                      : 'bg-teal-500/15 border-teal-500/30 text-teal-300 hover:bg-teal-500/20'
                                  }`}
                                >
                                  {generating ? (
                                    <><Loader2 className="w-3 h-3 animate-spin" />Generating</>
                                  ) : generated ? (
                                    <><RotateCcw className="w-3 h-3" />Regen</>
                                  ) : (
                                    <><Wand2 className="w-3 h-3" />Generate</>
                                  )}
                                </button>

                                {generated && (
                                  <>
                                    <button
                                      onClick={isPlaying ? stopSoundEffect : () => previewRitualSound(sound)}
                                      className={`flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                                        isPlaying
                                          ? 'bg-teal-500/15 border-teal-500/30 text-teal-300'
                                          : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700'
                                      }`}
                                    >
                                      {isPlaying ? (
                                        <><Square className="w-3 h-3" />Stop</>
                                      ) : (
                                        <><Play className="w-3 h-3" />Preview</>
                                      )}
                                    </button>

                                    <button
                                      onClick={() => downloadRitualSound(sound)}
                                      className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700"
                                    >
                                      <Save className="w-3 h-3" />Download
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>

                            {error && (
                              <div className="mt-3 rounded-lg border border-red-700/40 bg-red-900/20 px-3 py-2 text-[11px] text-red-200">
                                {error}
                              </div>
                            )}

                            {generated && asset && (
                              <div className="mt-3 rounded-lg border border-emerald-700/30 bg-emerald-900/10 px-3 py-2 text-[10px] text-emerald-300/80 leading-relaxed">
                                <span className="uppercase tracking-wider text-emerald-400/70 mr-1.5">Saved</span>
                                {new Date(asset.updatedAt).toLocaleString()} ·{' '}
                                <code className="font-mono text-emerald-300/70 break-all">{asset.storagePath}</code>
                              </div>
                            )}

                            {generated && (
                              <div className="mt-3 rounded-lg border border-white/[0.06] bg-black/20 p-3">
                                <div className="flex items-center justify-between gap-2 mb-2">
                                  <label className="text-[10px] uppercase tracking-wider text-zinc-500">
                                    Feedback on this take
                                  </label>
                                  {hasRefinement && (
                                    <button
                                      onClick={() => resetRitualPrompt(sound)}
                                      className="text-[10px] text-zinc-500 hover:text-zinc-300 underline-offset-2 hover:underline"
                                    >
                                      Reset to spec prompt
                                    </button>
                                  )}
                                </div>
                                <textarea
                                  value={feedbackText}
                                  onChange={(e) =>
                                    setRitualFeedback((prev) => ({ ...prev, [sound.id]: e.target.value }))
                                  }
                                  placeholder='e.g. "too sharp, soften the attack" or "needs more reverb decay" or "feels too cheerful"'
                                  rows={2}
                                  disabled={refining || generating}
                                  className="w-full resize-none rounded-md border border-white/[0.08] bg-black/40 px-3 py-2 text-xs text-zinc-200 placeholder:text-zinc-600 focus:border-teal-400/40 focus:outline-none disabled:opacity-50"
                                />
                                <div className="mt-2 flex items-center justify-between gap-2">
                                  <span className="text-[10px] text-zinc-600">
                                    {history.length > 0
                                      ? `${history.length} refinement${history.length === 1 ? '' : 's'} so far`
                                      : 'OpenAI rewrites the prompt with your feedback, then regenerates.'}
                                  </span>
                                  <button
                                    onClick={() => refineAndRegenRitualSound(sound)}
                                    disabled={!feedbackText.trim() || refining || generating}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                                      !feedbackText.trim() || refining || generating
                                        ? 'bg-teal-500/5 border-teal-500/15 text-teal-300/40 cursor-not-allowed'
                                        : 'bg-teal-500/15 border-teal-500/30 text-teal-300 hover:bg-teal-500/20'
                                    }`}
                                  >
                                    {refining ? (
                                      <><Loader2 className="w-3 h-3 animate-spin" />Refining prompt</>
                                    ) : generating ? (
                                      <><Loader2 className="w-3 h-3 animate-spin" />Regenerating</>
                                    ) : (
                                      <><Wand2 className="w-3 h-3" />Refine + regen</>
                                    )}
                                  </button>
                                </div>

                                {history.length > 0 && (
                                  <details className="mt-3">
                                    <summary className="text-[10px] text-zinc-500 cursor-pointer hover:text-zinc-300">
                                      Refinement history
                                    </summary>
                                    <ol className="mt-2 space-y-2">
                                      {history.map((entry, idx) => (
                                        <li
                                          key={`${entry.at}-${idx}`}
                                          className="rounded-md border border-white/[0.04] bg-black/30 px-2 py-1.5"
                                        >
                                          <div className="text-[10px] text-zinc-500">
                                            {new Date(entry.at).toLocaleString()}
                                          </div>
                                          <div className="text-[11px] text-zinc-300 mt-0.5">
                                            <span className="text-zinc-500 mr-1">Feedback:</span>
                                            {entry.feedback}
                                          </div>
                                          <div className="text-[10px] text-zinc-500 mt-0.5 leading-snug">
                                            <span className="text-zinc-600 mr-1 uppercase tracking-wider">Prompt</span>
                                            {entry.prompt}
                                          </div>
                                        </li>
                                      ))}
                                    </ol>
                                  </details>
                                )}
                              </div>
                            )}

                            {isPlaying && (
                              <div className="flex items-center gap-0.5 mt-3 h-4">
                                {Array.from({ length: 20 }).map((_, i) => (
                                  <motion.div
                                    key={i}
                                    className="w-1 bg-teal-400 rounded-full"
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
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-8 flex flex-wrap gap-3 text-xs text-zinc-500 border-t border-white/[0.05] pt-5">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-teal-400/60" />
                Pulse Ritual iOS App
              </div>
              <div className="ml-auto text-zinc-600">
                Generation calls <code className="font-mono">OpenAI Audio via bridge</code> · downloads save as
                {' '}<code className="font-mono">&lt;file&gt;.mp3</code>
              </div>
            </div>
          </div>
          )}

          {activeTab === 'registrySims' && (
          <div className="rounded-2xl bg-zinc-900/40 border border-white/10 backdrop-blur-xl p-5 mt-6">
            <div className="mb-1 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-cyan-500/25 bg-cyan-500/12">
                  <Volume2 className="h-4 w-4 text-cyan-300" />
                </div>
                <div>
                  <div className="font-semibold text-white">Registry Sim Audio Assets</div>
                  <div className="mt-0.5 text-xs text-zinc-500">
                    Read-only view of generated sim audio already resolved onto variant records during build and publish.
                  </div>
                </div>
              </div>
              <button
                onClick={loadRegistrySimAssets}
                disabled={registrySimLoading}
                className="flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs text-white transition-colors hover:bg-zinc-700 disabled:opacity-50"
              >
                {registrySimLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                Refresh
              </button>
            </div>

            <AnimatePresence>
              {registrySimLoadError && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-3 rounded-xl border border-red-700/40 bg-red-900/20 p-3 text-xs text-red-200"
                >
                  {registrySimLoadError}
                </motion.div>
              )}
            </AnimatePresence>

            <div className="mt-4 flex items-start gap-3 rounded-xl border border-white/[0.05] bg-zinc-950/60 p-3 text-xs text-zinc-400">
              <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-zinc-500" />
              <div>
                This page does not regenerate sim audio. It reads the resolved <code className="font-mono text-zinc-300">audioAssets</code> attached to <code className="font-mono text-zinc-300">sim-variants</code> records and lets you preview the stored files that were already generated into <code className="font-mono text-zinc-300">sim-audio-assets/...</code>.
              </div>
            </div>

            <div className="mt-5 space-y-4">
              {groupedRegistrySimAssets.length === 0 && !registrySimLoading ? (
                <div className="rounded-2xl border border-white/[0.06] bg-black/10 px-4 py-6 text-sm text-zinc-500">
                  No registry sim audio assets found yet.
                </div>
              ) : null}

              {groupedRegistrySimAssets.map((familyGroup) => (
                <div key={familyGroup.family} className="rounded-2xl border border-white/[0.06] bg-black/10">
                  <div className="flex items-center gap-3 px-4 py-4">
                    <span className="rounded-md border border-cyan-500/30 bg-cyan-500/12 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-200">
                      Family
                    </span>
                    <span className="text-sm font-semibold text-white">{familyGroup.family}</span>
                    <div className="h-px flex-1 bg-white/[0.05]" />
                    <span className="text-xs text-zinc-600">
                      {familyGroup.variants.reduce((sum, variant) => sum + variant.entries.length, 0)} assets
                    </span>
                  </div>

                  <div className="grid grid-cols-1 gap-4 px-4 pb-4">
                    {familyGroup.variants.map((variantGroup) => {
                      const firstEntry = variantGroup.entries[0];
                      return (
                        <div key={`${familyGroup.family}-${variantGroup.variantName}`} className="rounded-xl border border-white/[0.05] bg-zinc-950/30 p-4">
                          <div className="mb-3 flex flex-wrap items-center gap-2">
                            <span className="text-sm font-semibold text-white">{variantGroup.variantName}</span>
                            {firstEntry?.archetype ? (
                              <span className="rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] font-medium text-zinc-400">
                                {firstEntry.archetype}
                              </span>
                            ) : null}
                            {firstEntry?.buildStatus ? (
                              <span className="rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] font-medium text-zinc-400">
                                {firstEntry.buildStatus}
                              </span>
                            ) : null}
                          </div>
                          <div className="grid grid-cols-1 gap-3">
                            {variantGroup.entries.map((entry) => (
                              <RegistrySimAssetCard
                                key={`${entry.variantId}-${entry.asset.id}`}
                                entry={entry}
                                isPlaying={registrySimPlayingId === entry.asset.id}
                                onPlay={() => playRegistrySimSound(entry.asset.id, entry.asset.downloadURL)}
                                onStop={stopRegistrySimSound}
                              />
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-4 border-t border-white/[0.05] pt-4 text-xs text-zinc-500">
              <div>
                <span className="font-semibold text-zinc-300">{registrySimAssets.length}</span> registry-linked audio assets
              </div>
              <div className="ml-auto text-zinc-600">
                Firestore: <code className="font-mono">sim-variants</code> + <code className="font-mono">sim-audio-assets</code>
              </div>
            </div>
          </div>
          )}

          {/* ════════════════════════
              SECTION 3: VISION PRO IMMERSIVE SOUNDS
          ════════════════════════ */}
          {activeTab === 'visionPro' && (
          <div className="rounded-2xl bg-zinc-900/40 border border-white/10 backdrop-blur-xl p-5 mt-6">
            <div className="flex items-center justify-between gap-3 mb-1">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(0,212,170,0.12)', border: '1px solid rgba(0,212,170,0.25)' }}>
                  <Eye className="w-4 h-4" style={{ color: '#00D4AA' }} />
                </div>
                <div>
                  <div className="font-semibold text-white flex items-center gap-2">
                    Vision Pro — Reset Trial Sounds
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md border" style={{ color: '#00D4AA', background: 'rgba(0,212,170,0.1)', borderColor: 'rgba(0,212,170,0.25)' }}>
                      visionOS
                    </span>
                  </div>
                  <div className="text-xs text-zinc-500 mt-0.5">
                    Immersive Reset audio library for both spatial chamber SFX and Nora's spoken pre-brief lines. Stored in Firebase and streamed by the headset at runtime.
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

            <div className="mt-4 rounded-2xl border border-white/[0.06] bg-black/10">
              <button
                type="button"
                onClick={() => toggleVPSection('resetTrial')}
                className="flex w-full items-center gap-3 px-4 py-4 text-left"
              >
                <span className="text-sm font-semibold text-white">Vision Pro — Reset Trial Sounds</span>
                <div className="h-px flex-1 bg-white/[0.05]" />
                <span className="text-xs text-zinc-600">{Object.values(vpAssets).filter(Boolean).length} / {VP_RESET_CUES.length} generated</span>
                {vpSectionsOpen.resetTrial ? <ChevronUp className="h-4 w-4 text-zinc-500" /> : <ChevronDown className="h-4 w-4 text-zinc-500" />}
              </button>

              <AnimatePresence initial={false}>
                {vpSectionsOpen.resetTrial && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="px-4 pb-4">
                      <AnimatePresence>
                        {vpLoadError && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="mt-3 rounded-xl border border-red-700/40 bg-red-900/20 p-3 text-xs text-red-200"
                          >
                            {vpLoadError}
                          </motion.div>
                        )}
                      </AnimatePresence>

                      <div className="mt-4 flex items-start gap-3 rounded-xl border border-white/[0.05] bg-zinc-950/60 p-3 text-xs text-zinc-400">
                        <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-zinc-500" />
                        <div>
                          Generated audio is stored at <code className="font-mono text-zinc-300">sim-audio-assets/vision-pro-reset/</code> in Firebase Storage.
                          The visionOS app reads <code className="font-mono text-zinc-300">downloadURL</code> at session start to preload chamber SFX and Nora&apos;s spoken pre-brief.
                          Spoken lines are generated with <strong className="text-zinc-200">ElevenLabs</strong> right here beside the chamber sounds, using the Nora voice controls from the section above when available.
                        </div>
                      </div>

                      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
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
                            <AnimatePresence>
                              {vpGenErrors[cue.cueKey] && (
                                <motion.div
                                  initial={{ opacity: 0, height: 0 }}
                                  animate={{ opacity: 1, height: 'auto' }}
                                  exit={{ opacity: 0, height: 0 }}
                                  className="mt-1 rounded-lg border border-red-700/30 bg-red-900/20 px-3 py-2 text-[11px] text-red-300"
                                >
                                  {vpGenErrors[cue.cueKey]}
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        ))}
                      </div>

                      <div className="mt-5 flex flex-wrap items-center gap-4 border-t border-white/[0.05] pt-4 text-xs text-zinc-500">
                        <div>
                          <span className="font-semibold text-zinc-300">{Object.values(vpAssets).filter(Boolean).length}</span>
                          {' / '}{VP_RESET_CUES.length} sounds generated
                        </div>
                        {Object.values(vpGenerating).some(Boolean) && (
                          <div className="flex items-center gap-1.5 text-amber-400">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            {Object.values(vpGenerating).filter(Boolean).length} generating…
                          </div>
                        )}
                        <div className="ml-auto text-zinc-600">
                          Firestore: <code className="font-mono">sim-audio-assets</code> · Storage: <code className="font-mono">sim-audio-assets/vision-pro-reset/</code>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
          )}

          {activeTab === 'protocols' && (
          <div className="mt-6 rounded-2xl border border-white/10 bg-zinc-900/40 p-5 backdrop-blur-xl">
            <div className="mb-1 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-cyan-500/25 bg-cyan-500/12">
                  <Music className="h-4 w-4 text-cyan-300" />
                </div>
                <div>
                  <div className="font-semibold text-white">PulseCheck Protocol Sounds</div>
                  <div className="mt-0.5 text-xs text-zinc-500">
                    Signature entry sounds for each live protocol. Stored in Firebase and grouped by regulation, priming, and recovery.
                  </div>
                </div>
              </div>
              <button
                onClick={loadProtocolAssets}
                disabled={protocolLoading}
                className="flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs text-white transition-colors hover:bg-zinc-700 disabled:opacity-50"
              >
                {protocolLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                Refresh
              </button>
            </div>

            <AnimatePresence>
              {protocolLoadError && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-3 rounded-xl border border-red-700/40 bg-red-900/20 p-3 text-xs text-red-200"
                >
                  {protocolLoadError}
                </motion.div>
              )}
            </AnimatePresence>

            <div className="mt-4 flex items-start gap-3 rounded-xl border border-white/[0.05] bg-zinc-950/60 p-3 text-xs text-zinc-400">
              <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-zinc-500" />
              <div>
                Protocol sounds include generated signature sounds plus runtime-specific assets like Body Scan transition and ambient sounds. These assets are stored under <code className="font-mono text-zinc-300">sim-audio-assets/pulsecheck-protocols/</code> for the app to resolve by audio key.
              </div>
            </div>

            <div className="mt-5 space-y-4">
              {(['regulation', 'priming', 'recovery'] as const).map((protocolClass) => {
                const cues = groupedProtocolCues[protocolClass];
                const palette = PROTOCOL_CLASS_PALETTE[protocolClass];
                const open = protocolSectionsOpen[protocolClass];
                return (
                  <div key={protocolClass} className="rounded-2xl border border-white/[0.06] bg-black/10">
                    <button
                      type="button"
                      onClick={() => toggleProtocolSection(protocolClass)}
                      className="flex w-full items-center gap-3 px-4 py-4 text-left"
                    >
                      <span
                        className="rounded-md border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]"
                        style={{ color: palette.color, background: palette.dimColor, borderColor: `${palette.color}30` }}
                      >
                        {palette.label}
                      </span>
                      <span className="text-sm font-semibold text-white">{palette.label} Protocol Sounds</span>
                      <div className="h-px flex-1 bg-white/[0.05]" />
                      <span className="text-xs text-zinc-600">
                        {cues.filter((cue) => protocolAssets[cue.cueKey]).length} / {cues.length} generated
                      </span>
                      {open ? <ChevronUp className="h-4 w-4 text-zinc-500" /> : <ChevronDown className="h-4 w-4 text-zinc-500" />}
                    </button>

                    <AnimatePresence initial={false}>
                      {open && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="grid grid-cols-1 gap-3 px-4 pb-4">
                            {cues.map((cue) => (
                              <div key={cue.cueKey}>
                                <ProtocolSoundCard
                                  cue={cue}
                                  asset={protocolAssets[cue.cueKey] ?? null}
                                  generating={protocolGenerating[cue.cueKey] ?? false}
                                  isPlaying={protocolPlayingId === cue.cueKey}
                                  onGenerate={() => generateProtocolSound(cue)}
                                  onPlay={() => {
                                    const url = protocolAssets[cue.cueKey]?.downloadURL;
                                    if (url) playProtocolSound(cue, url);
                                  }}
                                  onStop={stopProtocolSound}
                                />
                                <AnimatePresence>
                                  {protocolGenErrors[cue.cueKey] && (
                                    <motion.div
                                      initial={{ opacity: 0, height: 0 }}
                                      animate={{ opacity: 1, height: 'auto' }}
                                      exit={{ opacity: 0, height: 0 }}
                                      className="mt-1 rounded-lg border border-red-700/30 bg-red-900/20 px-3 py-2 text-[11px] text-red-300"
                                    >
                                      {protocolGenErrors[cue.cueKey]}
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </div>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-4 border-t border-white/[0.05] pt-4 text-xs text-zinc-500">
              <div>
                <span className="font-semibold text-zinc-300">{Object.values(protocolAssets).filter(Boolean).length}</span>
                {' / '}{PROTOCOL_SOUND_CUES.length} sounds generated
              </div>
              {Object.values(protocolGenerating).some(Boolean) && (
                <div className="flex items-center gap-1.5 text-amber-400">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  {Object.values(protocolGenerating).filter(Boolean).length} generating…
                </div>
              )}
              <div className="ml-auto text-zinc-600">
                Firestore: <code className="font-mono">sim-audio-assets</code> · Storage: <code className="font-mono">sim-audio-assets/pulsecheck-protocols/</code>
              </div>
            </div>
          </div>
          )}

          {activeTab === 'runAlerts' && (
          <div className="mt-6 rounded-2xl border border-white/10 bg-zinc-900/40 p-5 backdrop-blur-xl">
            <div className="mb-1 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-orange-500/25 bg-orange-500/12">
                  <Bell className="h-4 w-4 text-orange-300" />
                </div>
                <div>
                  <div className="font-semibold text-white">Run Warning Voice Lines</div>
                  <div className="mt-0.5 text-xs text-zinc-500">
                    ElevenLabs-spoken run alerts for phone placement loss and runs that appear finished but remain active.
                  </div>
                </div>
              </div>
              <button
                onClick={loadRunAlertAssets}
                disabled={runAlertLoading}
                className="flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs text-white transition-colors hover:bg-zinc-700 disabled:opacity-50"
              >
                {runAlertLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                Refresh
              </button>
            </div>

            <AnimatePresence>
              {runAlertLoadError && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-3 rounded-xl border border-red-700/40 bg-red-900/20 p-3 text-xs text-red-200"
                >
                  {runAlertLoadError}
                </motion.div>
              )}
            </AnimatePresence>

            <div className="mt-4 flex items-start gap-3 rounded-xl border border-white/[0.05] bg-zinc-950/60 p-3 text-xs text-zinc-400">
              <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-zinc-500" />
              <div>
                These voice lines are stored in <code className="font-mono text-zinc-300">sim-audio-assets/community-run-alerts/</code>.
                Generate and preview them here with the current Nora ElevenLabs voice. QuickLifts now syncs the latest files from <code className="font-mono text-zinc-300">/api/audio/run-alerts</code> into iOS <code className="font-mono text-zinc-300">Library/Sounds</code> using the target filename shown on each card, matching the same remote-audio delivery pattern used by Vision Pro.
                Until the app completes its first sync, it falls back to <code className="font-mono text-zinc-300">Bell.wav</code> for local notification sound.
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-3">
              {RUN_ALERT_CUES.map((cue) => (
                <div key={cue.cueKey}>
                  <RunAlertSoundCard
                    cue={cue}
                    asset={runAlertAssets[cue.cueKey] ?? null}
                    generating={runAlertGenerating[cue.cueKey] ?? false}
                    isPlaying={runAlertPlayingId === cue.cueKey}
                    onGenerate={() => generateRunAlertSound(cue)}
                    onPlay={() => {
                      const url = runAlertAssets[cue.cueKey]?.downloadURL;
                      if (url) playRunAlertSound(cue.cueKey, url);
                    }}
                    onStop={stopRunAlertSound}
                  />
                  <AnimatePresence>
                    {runAlertGenErrors[cue.cueKey] && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mt-1 rounded-lg border border-red-700/30 bg-red-900/20 px-3 py-2 text-[11px] text-red-300"
                      >
                        {runAlertGenErrors[cue.cueKey]}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-4 border-t border-white/[0.05] pt-4 text-xs text-zinc-500">
              <div>
                <span className="font-semibold text-zinc-300">{Object.values(runAlertAssets).filter(Boolean).length}</span>
                {' / '}{RUN_ALERT_CUES.length} lines generated
              </div>
              {Object.values(runAlertGenerating).some(Boolean) && (
                <div className="flex items-center gap-1.5 text-amber-400">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  {Object.values(runAlertGenerating).filter(Boolean).length} generating…
                </div>
              )}
              <div className="ml-auto text-zinc-600">
                Firestore: <code className="font-mono">sim-audio-assets</code> · Storage: <code className="font-mono">sim-audio-assets/community-run-alerts/</code>
              </div>
            </div>
          </div>
          )}

        </motion.div>
      </div>
    </AdminRouteGuard>
  );
};

export default AdminAiVoice;
