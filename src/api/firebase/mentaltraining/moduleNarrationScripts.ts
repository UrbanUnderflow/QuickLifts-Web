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
// STATIC engine cues (pre-round rule readouts, Reset game phase calls) are
// pre-generated below. Only cues containing runtime state (round counters,
// live scores, "Rep X of Y" focus practice lines, sim summary lines) remain
// live TTS by design.
// =============================================================================

import { SEEDED_EXERCISES } from './exerciseLibraryService';
import type { MentalExercise, ModuleInteraction } from './types';

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

// The Reset game renders through ResetSwitchGameView, which has NO intro or
// completion narration — only in-game phase cues (see RESET_GAME_CUES).
const RESET_MODULE_ID = 'focus-3-second-reset';

// Mirrors PulseCheckFallbackSimDescriptor.coreMetricName (SimRuntimePlayerView.swift)
// after iOS's `.replacingOccurrences(of: "_", with: " ").capitalized`. The seeded
// modules have no stored buildArtifact, so iOS always narrates the fallback
// descriptor's metric label. Sims built with a CUSTOM artifact (variantName or
// athleteLabels.description differing from the seed) fall back to live TTS.
const SIM_CORE_METRIC_LABELS: Record<string, string> = {
  'focus-noise-gate': 'Decision Latency',
  'decision-brake-point': 'Stop Latency',
  'decision-signal-window': 'Timing Accuracy',
  'decision-sequence-shift': 'Switch Accuracy',
  'focus-endurance-lock': 'Late Session Stability',
};

// Mirrors each engine's static pre-round rule readout
// (SimRuntimeEngineViews.swift introNarrationText). These are spoken once the
// athlete enters the live engine, before any dynamic round cues. Endurance
// Lock's readout is prefixed by a per-variant introLabel, so every label the
// runtime can produce gets its own clip.
const SIM_ENGINE_RULE_READOUTS: Record<string, string[]> = {
  'focus-noise-gate': [
    'Noise Gate. Memorize the live target before clutter starts. When the options appear, select the live target and ignore the distractors. Ready. Set. Begin.',
  ],
  'decision-brake-point': [
    'Brake Point. Tap Commit for go, green, clear, or open. Tap Brake for stop, red, brake, fake, hold, check, brake now, or abort. One tap decides the round. Ready. Set. Begin.',
  ],
  'decision-signal-window': [
    'Signal Window. Pick the live target before the window closes. Ignore plausible wrong decoys. One choice decides the round. Ready. Set. Begin.',
  ],
  'decision-sequence-shift': [
    'Sequence Shift. Follow the active rule. When the rule changes, drop the old rule and answer using the new one. Ready. Set. Begin.',
  ],
  'focus-endurance-lock': [
    'Hold clean execution as fatigue accumulates across the session. Wait for the pulse window, tap inside the active window, and stay with the cadence as fatigue rises. Ready. Set. Begin.',
    'Hold the same task cleanly while the display state gets noisier. Wait for the pulse window, tap inside the active window, and stay with the cadence as fatigue rises. Ready. Set. Begin.',
    'Hold form while the final blocks become more consequential. Wait for the pulse window, tap inside the active window, and stay with the cadence as fatigue rises. Ready. Set. Begin.',
  ],
};

// Mirrors ResetSwitchGameView's static phase cues (lockInNarrationCue,
// resetPhaseMessage, disruption/reset/second-chance calls). Round counters
// and score readouts stay live TTS by design.
const RESET_GAME_CUES: string[] = [
  'Tap the pulse.',
  'Watch the path. Remember the shape it draws.',
  'Remember the sequence.',
  'Disruption. Hold steady.',
  'Reset. Breathe. Re-engage.',
  'Re-anchor now.',
  'Match the path.',
  'Repeat the sequence.',
  'Second chance. Tap the target.',
  'Second chance. Repeat it.',
];

// Mirrors GenericExercisePlayerView narrationScriptForCurrentPhase (.cueWord).
const CUE_WORD_PROMPT_TEXT =
  "Choose a short anchor word like focus, locked, or ready. You'll use it to return to this state on demand.";

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
  segments.push("Find a quiet space, tap begin when you're ready, and I'll coach you through it.");
  return segments.join(' ');
}

// Mirrors GenericExercisePlayerView.completionNarrationText.
function genericCompletionText(exercise: MentalExercise): string {
  return `And that's the end of the ${exercise.name} protocol. Great job. How do you feel?`;
}

// Mirrors SimRuntimePlayerView.introNarrationText for seeded modules. iOS
// builds a fallback runtime artifact for every seeded sim (variantName =
// exercise.name, description = exercise.description, coreMetricName from
// PulseCheckFallbackSimDescriptor), so the spoken metric label is the
// per-engine one, never the "Clean execution" default.
function simIntroText(exercise: MentalExercise): string {
  return [
    'Nora here.',
    `${exercise.name}.`,
    exercise.description,
    `Your core metric today is ${SIM_CORE_METRIC_LABELS[exercise.id] ?? 'Clean execution'}.`,
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

// Everything InteractiveModuleContent.swift narrates for an interaction
// config: round prompts and choice feedback (choiceDrill), pick/dwell/close
// prompts (guidedDwell), setup/loop/close prompts (lockedReplay). Countdown
// numbers and button labels are visual only.
function interactionScripts(interaction: ModuleInteraction): Array<{ slot: string; label: string; text: string }> {
  const entries: Array<{ slot: string; label: string; text: string }> = [];
  const push = (slot: string, label: string, text: string | undefined) => {
    const trimmedText = trimmed(text);
    if (trimmedText) entries.push({ slot, label, text: trimmedText });
  };

  if (interaction.kind === 'choiceDrill') {
    // Pick phase ("what ifs" elicitation) — narrated once before the rounds
    // when pickChoices is present. Chips themselves are taps, never spoken.
    if ((interaction.pickChoices ?? []).length > 0) {
      push('pick-prompt', 'Pick Prompt', interaction.pickPrompt);
    }
    (interaction.rounds ?? []).forEach((round, roundIndex) => {
      push(`drill-round-${roundIndex + 1}`, `Round ${roundIndex + 1} Prompt`, round.prompt);
      (round.choices ?? []).forEach((choice, choiceIndex) => {
        push(
          `drill-round-${roundIndex + 1}-feedback-${choiceIndex + 1}`,
          `Round ${roundIndex + 1} Feedback ${choiceIndex + 1}`,
          choice.feedback,
        );
      });
    });
    // Sport scenario packs: every pack round prompt/feedback needs its own
    // pre-generated clip (iOS narrates resolved pack text verbatim, so the
    // byte-hash must resolve against these lines). Packs without rounds
    // (chips-only overlays) add no lines.
    (interaction.scenarioPacks ?? []).forEach((pack) => {
      const packLabel = pack.label || pack.archetype;
      (pack.rounds ?? []).forEach((round, roundIndex) => {
        push(
          `pack-${pack.archetype}-round-${roundIndex + 1}`,
          `${packLabel} — Round ${roundIndex + 1} Prompt`,
          round.prompt,
        );
        (round.choices ?? []).forEach((choice, choiceIndex) => {
          push(
            `pack-${pack.archetype}-round-${roundIndex + 1}-feedback-${choiceIndex + 1}`,
            `${packLabel} — Round ${roundIndex + 1} Feedback ${choiceIndex + 1}`,
            choice.feedback,
          );
        });
      });
    });
  }

  if (interaction.kind === 'guidedDwell') {
    push('pick-prompt', 'Pick Prompt', interaction.pickPrompt);
    push('dwell-prompt', 'Dwell Guidance', interaction.dwellPrompt);
    push('close-prompt', 'Close', interaction.closePrompt);
  }

  if (interaction.kind === 'lockedReplay') {
    (interaction.setupPrompts ?? []).forEach((text, index) => {
      push(`setup-${index + 1}`, `Setup ${index + 1}`, text);
    });
    push('loop-prompt', 'Run Guidance', interaction.loopPrompt);
    push('close-prompt', 'Close', interaction.closePrompt);
  }

  return entries;
}

export function buildModuleNarrationScripts(): ModuleNarrationScript[] {
  const scripts: ModuleNarrationScript[] = [];

  SEEDED_EXERCISES.forEach((exercise) => {
    const isSim = SIM_MODULE_IDS.has(exercise.id);
    const isResetGame = exercise.id === RESET_MODULE_ID;
    const base = {
      moduleId: exercise.id,
      moduleName: exercise.name,
      category: String(exercise.category ?? ''),
    };

    // ResetSwitchGameView never narrates an intro or completion — emitting
    // those slots would fake coverage for clips iOS can never play.
    if (!isResetGame) {
      scripts.push({
        ...base,
        slot: 'intro',
        cueKey: `${exercise.id}-narration-intro`,
        label: `${exercise.name} — Intro`,
        text: isSim ? simIntroText(exercise) : genericIntroText(exercise),
      });
    }

    if (!isSim) {
      // Modules with an interaction config render the interactive mechanic —
      // iOS never plays the passive prompt steps for them, so emitting
      // step-N slots would fake coverage. Emit the mechanic's lines instead
      // (mirrors InteractiveModuleContent.swift narration call sites).
      const interaction = exercise.interaction;
      if (interaction) {
        interactionScripts(interaction).forEach(({ slot, label, text }) => {
          scripts.push({
            ...base,
            slot,
            cueKey: `${exercise.id}-narration-${slot}`,
            label: `${exercise.name} — ${label}`,
            text,
          });
        });
      } else {
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

      // The Anchor Word flow speaks a static prompt before word selection.
      if (exercise.exerciseConfig?.type === 'focus'
        && (exercise.exerciseConfig?.config as any)?.type === 'cue_word') {
        scripts.push({
          ...base,
          slot: 'cue-word-prompt',
          cueKey: `${exercise.id}-narration-cue-word-prompt`,
          label: `${exercise.name} — Anchor Word Prompt`,
          text: CUE_WORD_PROMPT_TEXT,
        });
      }
    }

    // Post-module reflection prompts, spoken as each question appears
    // (ModuleReflectionView narrates stored-first like every other line).
    (exercise.reflection?.questions ?? []).forEach((question) => {
      const text = trimmed(question.prompt);
      if (!text) return;
      scripts.push({
        ...base,
        slot: `reflection-${question.id}`,
        cueKey: `${exercise.id}-narration-reflection-${question.id}`,
        label: `${exercise.name} — Reflection: ${question.id}`,
        text,
      });
    });

    // Static in-engine rule readouts, spoken as the live sim starts.
    (SIM_ENGINE_RULE_READOUTS[exercise.id] ?? []).forEach((text, index) => {
      scripts.push({
        ...base,
        slot: `engine-rules-${index + 1}`,
        cueKey: `${exercise.id}-narration-engine-rules-${index + 1}`,
        label: `${exercise.name} — Engine Rules ${index + 1}`,
        text,
      });
    });

    if (isResetGame) {
      RESET_GAME_CUES.forEach((text, index) => {
        scripts.push({
          ...base,
          slot: `game-cue-${index + 1}`,
          cueKey: `${exercise.id}-narration-game-cue-${index + 1}`,
          label: `${exercise.name} — Game Cue ${index + 1}`,
          text,
        });
      });
    }

    if (!isResetGame) {
      scripts.push({
        ...base,
        slot: 'complete',
        cueKey: `${exercise.id}-narration-complete`,
        label: `${exercise.name} — Completion`,
        text: isSim ? simCompletionText(exercise) : genericCompletionText(exercise),
      });
    }
  });

  return scripts;
}
