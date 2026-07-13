// =============================================================================
// Module narration scripts — the source of truth for pre-generated Nora
// spoken narration across every sim and protocol module.
//
// WHY: spoken module narration was synthesized live at playback (ElevenLabs
// via tts-mental-step), which fails to SILENCE on iOS. These scripts let the
// admin ai-voice dashboard pre-generate a stored clip for every line Nora
// speaks, keyed by a hash of the exact text. iOS checks the stored index
// before any live TTS call (NoraVoiceService), so live TTS becomes the
// fallback instead of the default.
//
// CRITICAL INVARIANT: each script's `text` must BYTE-MATCH the string the
// iOS players compute at runtime (GenericExercisePlayerView
// introNarrationText/completionNarrationText, per-phase and per-prompt
// narration; SimRuntimePlayerView intro/completion). The texts are derived
// from the same module configs (SEEDED_EXERCISES), so they stay in sync as
// long as the iOS formula mirrors below are kept current. A mismatch is
// safe — iOS just falls back to live TTS for that line.
//
// Engine in-run cues (round counters, live scores in SimRuntimeEngineViews,
// ResetSwitchGameView phase calls) contain runtime state and remain live
// TTS by design.
// =============================================================================

import { SEEDED_EXERCISES } from './exerciseLibraryService';
import type { MentalExercise } from './types';

export const MODULE_NARRATION_ENGINE_KEY = 'pulsecheck-module-narration';

export type ModuleNarrationScript = {
  moduleId: string;
  moduleName: string;
  category: string;
  slot: string;
  cueKey: string;
  label: string;
  text: string;
};

// djb2 over UTF-16 code units — must match hashString in ai-voice.tsx's
// buildGeneratedDocId AND the Swift mirror in NoraVoiceService (AudioService.swift).
export function hashNarrationText(input: string): string {
  let hash = 5381;
  for (let index = 0; index < input.length; index += 1) {
    hash = ((hash << 5) + hash) ^ input.charCodeAt(index);
  }
  return (hash >>> 0).toString(16);
}

// The six self-contained sims render through SimRuntimePlayerView /
// ResetSwitchGameView; everything else uses GenericExercisePlayerView.
const SIM_MODULE_IDS = new Set([
  'focus-3-second-reset',
  'focus-noise-gate',
  'decision-brake-point',
  'decision-signal-window',
  'decision-sequence-shift',
  'focus-endurance-lock',
]);

// Mirrors BodyScanGuidanceStep.settleText (GenericExercisePlayerView.swift).
const BODY_SCAN_SETTLE_TEXT =
  'Settle onto your back if you can, or sit fully supported. Put the phone down now. Close your eyes and take two easy breaths. You will hear the next step automatically; no tapping until we finish.';

const trimmed = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

// Mirrors GenericExercisePlayerView.introNarrationText.
function genericIntroText(exercise: MentalExercise): string {
  const segments = ['Nora here.', `${exercise.name}.`, exercise.description];
  const config: any = exercise.exerciseConfig?.config ?? {};
  if (exercise.exerciseConfig?.type === 'focus') {
    const firstInstruction = trimmed((config.instructions ?? [])[0]);
    if (firstInstruction) segments.push(`First, ${firstInstruction}`);
  }
  segments.push("Find a quiet space, tap begin when you're ready, and I'll coach you through the rep.");
  return segments.join(' ');
}

// Mirrors GenericExercisePlayerView.completionNarrationText.
function genericCompletionText(exercise: MentalExercise): string {
  return `And that's the end of the ${exercise.name} protocol. Great job. How do you feel?`;
}

// Mirrors SimRuntimePlayerView.introNarrationText for seeded modules
// (no buildArtifact: description from the module, metric label default).
function simIntroText(exercise: MentalExercise): string {
  return [
    'Nora here.',
    `${exercise.name}.`,
    exercise.description,
    'Your core metric today is Clean execution.',
    "Tap begin when you're ready.",
  ].join(' ');
}

// Mirrors SimRuntimePlayerView.completionNarrationText.
function simCompletionText(exercise: MentalExercise): string {
  return `And that's the end of the ${exercise.name} simulation game. Great job. How do you feel?`;
}

// Mirrors BodyScanGuidanceStep.script hands-free detection.
function isHandsFreeBodyScanScript(instructions: string[]): boolean {
  if (instructions.length < 8) return false;
  return instructions.some((instruction) => {
    const lower = instruction.toLowerCase();
    return lower.includes('not need to tap')
      || lower.includes('let the phone be done')
      || lower.includes('no tapping')
      || lower.includes('next step automatically');
  });
}

function contentStepTexts(exercise: MentalExercise): string[] {
  const type = exercise.exerciseConfig?.type;
  const config: any = exercise.exerciseConfig?.config ?? {};

  if (type === 'breathing') {
    // Each phase's instruction is narrated verbatim at phase start;
    // dedupe repeated instructions (cycles repeat phases).
    const texts: string[] = [];
    (config.phases ?? []).forEach((phase: { instruction?: string }) => {
      const text = trimmed(phase?.instruction);
      if (text && !texts.includes(text)) texts.push(text);
    });
    return texts;
  }

  if (type === 'focus') {
    const instructions = (config.instructions ?? [])
      .map((value: unknown) => trimmed(value))
      .filter((value: string) => value.length > 0);
    if (exercise.id === 'focus-body-scan' && isHandsFreeBodyScanScript(instructions)) {
      return [BODY_SCAN_SETTLE_TEXT, ...instructions.slice(1)];
    }
    return instructions;
  }

  if (type === 'visualization' || type === 'mindset' || type === 'confidence') {
    return (config.prompts ?? [])
      .map((value: unknown) => trimmed(value))
      .filter((value: string) => value.length > 0);
  }

  return [];
}

export function buildModuleNarrationScripts(): ModuleNarrationScript[] {
  const scripts: ModuleNarrationScript[] = [];

  SEEDED_EXERCISES.forEach((exercise) => {
    const isSim = SIM_MODULE_IDS.has(exercise.id);
    const base = {
      moduleId: exercise.id,
      moduleName: exercise.name,
      category: String(exercise.category ?? ''),
    };

    scripts.push({
      ...base,
      slot: 'intro',
      cueKey: `${exercise.id}-narration-intro`,
      label: `${exercise.name} — Intro`,
      text: isSim ? simIntroText(exercise) : genericIntroText(exercise),
    });

    if (!isSim) {
      contentStepTexts(exercise).forEach((text, index) => {
        scripts.push({
          ...base,
          slot: `step-${index + 1}`,
          cueKey: `${exercise.id}-narration-step-${index + 1}`,
          label: `${exercise.name} — Step ${index + 1}`,
          text,
        });
      });
    }

    scripts.push({
      ...base,
      slot: 'complete',
      cueKey: `${exercise.id}-narration-complete`,
      label: `${exercise.name} — Completion`,
      text: isSim ? simCompletionText(exercise) : genericCompletionText(exercise),
    });
  });

  return scripts;
}
