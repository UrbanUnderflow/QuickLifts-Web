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
import { getSimSpecByLegacyExerciseId } from './taxonomy';
import { BODY_SCAN_SETTLE_TEXT } from '../../../content/bodyScanScript';

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

// The six self-contained sims render through their dedicated runtime engines;
// everything else uses GenericExercisePlayerView.
const SIM_MODULE_IDS = new Set([
  'focus-3-second-reset',
  'focus-noise-gate',
  'decision-brake-point',
  'decision-signal-window',
  'decision-sequence-shift',
  'focus-endurance-lock',
]);

// Reset uses a small set of fixed phase cues in addition to dynamic round text.
const RESET_MODULE_ID = 'focus-3-second-reset';

function simMetricLabel(exercise: MentalExercise): string {
  return getSimSpecByLegacyExerciseId(exercise.id)?.athleteMetricLabel ?? 'Task performance';
}

// Mirrors each engine's static pre-round rule readout
// (SimRuntimeEngineViews.swift introNarrationText). These are spoken once the
// athlete enters the live engine, before any dynamic round cues. Endurance
// Lock's readout is prefixed by a per-variant introLabel, so every label the
// runtime can produce gets its own clip.
const SIM_ENGINE_RULE_READOUTS: Record<string, string[]> = {
  'focus-noise-gate': [
    'Noise Gate. A number stays at the top. Find that same number in the field and tap it. Some rounds add a flashing marker or crowd sound. Those are distractions. Ready. Set. Begin.',
  ],
  'decision-brake-point': [
    'Brake Point. Match each arrow with left or right. On some trials, a delayed red stop signal appears. If it appears, do not tap. Ready. Set. Begin.',
  ],
  'decision-signal-window': [
    'Signal Window. Decide whether most arrows point left or right, then choose that direction. Ready. Set. Begin.',
  ],
  'decision-sequence-shift': [
    'Sequence Shift. Use the letter or number rule shown. Left means vowel or odd. Right means consonant or even. Ready. Set. Begin.',
  ],
  'focus-endurance-lock': [
    'Endurance Lock. Wait for the center visual signal, then tap it once. The waiting time changes, but the signal and rule stay the same. Ready. Set. Begin.',
  ],
};

// Static Reset phase cues. Round counters and interruption labels stay live TTS.
const RESET_GAME_CUES: string[] = [
  'Reset. Match each arrow with left or right. Some trials add an interruption and a fixed reset interval before the same arrow task returns.',
  'Interruption.',
  'Reset interval. Pause. Reorient. Return.',
];

// Mirrors GenericExercisePlayerView narrationScriptForCurrentPhase (.cueWord).
const CUE_WORD_PROMPT_TEXT =
  "Choose a short anchor word like focus, locked, or ready. You'll use it to return to this state on demand.";

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

function sportPackIntroText(
  exercise: MentalExercise,
  description: string | undefined,
  applicationCue: string,
): string {
  const segments = [
    'Nora here.',
    `${exercise.name}.`,
    description || exercise.description,
    applicationCue,
  ];
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
// per-engine one, never the generic task-performance fallback.
function simIntroText(exercise: MentalExercise): string {
  const spec = getSimSpecByLegacyExerciseId(exercise.id);
  return [
    'Nora here.',
    `${exercise.name}.`,
    spec?.athleteTaskDescription ?? exercise.description,
    `Your core metric today is ${simMetricLabel(exercise)}.`,
    spec?.resultBoundary,
    "Tap begin when you're ready.",
  ].filter(Boolean).join(' ');
}

function sportPackSimIntroText(
  exercise: MentalExercise,
  description: string | undefined,
  applicationCue: string,
): string {
  const spec = getSimSpecByLegacyExerciseId(exercise.id);
  return [
    'Nora here.',
    `${exercise.name}.`,
    description || spec?.athleteTaskDescription || exercise.description,
    `Your core metric today is ${simMetricLabel(exercise)}.`,
    applicationCue,
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

  if (interaction.kind === 'nervesRehearsal' && interaction.nervesRehearsal) {
    const config = interaction.nervesRehearsal;
    push('awareness-prompt', 'Awareness Prompt', config.awarenessPrompt);
    push('awareness-feedback', 'Awareness Feedback', config.awarenessFeedback);
    push('meaning-prompt', 'Meaning Prompt', config.meaningPrompt);
    config.meaningChoices.forEach((choice, index) => {
      push(`meaning-feedback-${index + 1}`, `Meaning Feedback ${index + 1}`, choice.feedback);
    });
    push('cue-prompt', 'Cue Prompt', config.cuePrompt);
    config.rehearsalRounds.forEach((round, index) => {
      push(`rehearsal-${index + 1}`, `Rehearsal ${index + 1}`, round.pressureCue);
    });
    push('reflection-prompt', 'Reflection Prompt', config.reflectionPrompt);
    push('close-prompt', 'Close', config.closePrompt);
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

    scripts.push({
      ...base,
      slot: 'intro',
      cueKey: `${exercise.id}-narration-intro`,
      label: `${exercise.name} — Intro`,
      text: isSim ? simIntroText(exercise) : genericIntroText(exercise),
    });

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

      // Curriculum-wide sport content packs. These lines are emitted for
      // every archetype so the athlete's selected OpenAI voice can be warmed
      // before playback. Slots are archetype-prefixed; lookup remains
      // byte-hash based on the exact spoken text.
      (exercise.sportContentPacks ?? []).forEach((pack) => {
        const packPrefix = `sport-${pack.archetype}`;
        scripts.push({
          ...base,
          slot: `${packPrefix}-intro`,
          cueKey: `${exercise.id}-narration-${packPrefix}-intro`,
          label: `${exercise.name} — ${pack.label} Intro`,
          text: sportPackIntroText(exercise, pack.description, pack.applicationCue),
        });

        if (pack.interaction) {
          interactionScripts(pack.interaction).forEach(({ slot, label, text }) => {
            scripts.push({
              ...base,
              slot: `${packPrefix}-${slot}`,
              cueKey: `${exercise.id}-narration-${packPrefix}-${slot}`,
              label: `${exercise.name} — ${pack.label} ${label}`,
              text,
            });
          });
        } else {
          (pack.prompts ?? []).forEach((text, index) => {
            scripts.push({
              ...base,
              slot: `${packPrefix}-step-${index + 1}`,
              cueKey: `${exercise.id}-narration-${packPrefix}-step-${index + 1}`,
              label: `${exercise.name} — ${pack.label} Step ${index + 1}`,
              text,
            });
          });
        }
      });

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

    if (isSim) {
      (exercise.sportContentPacks ?? []).forEach((pack) => {
        const slot = `sport-${pack.archetype}-intro`;
        scripts.push({
          ...base,
          slot,
          cueKey: `${exercise.id}-narration-${slot}`,
          label: `${exercise.name} — ${pack.label} Intro`,
          text: sportPackSimIntroText(
            exercise,
            pack.description,
            pack.applicationCue,
          ),
        });
      });
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
