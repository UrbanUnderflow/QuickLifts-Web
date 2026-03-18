import type {
  PulseCheckProtocolPracticeDimensionScores,
  PulseCheckProtocolPracticeInputMode,
  PulseCheckProtocolPracticeScorecard,
  PulseCheckProtocolPracticeSession,
  PulseCheckProtocolPracticeTurn,
  PulseCheckProtocolPracticeVoiceSignals,
} from './types';

export interface ProtocolPracticeTurnSpec {
  id: string;
  label: string;
  promptText: string;
  placeholder: string;
  targetedDimensions: Array<keyof PulseCheckProtocolPracticeDimensionScores>;
  keywordSignals?: Partial<Record<keyof PulseCheckProtocolPracticeDimensionScores, string[]>>;
  adaptiveFollowUps?: Array<{
    id: string;
    targetDimension: keyof PulseCheckProtocolPracticeDimensionScores;
    promptText: string;
  }>;
}

export type ProtocolPracticeAdaptiveFollowUp = NonNullable<ProtocolPracticeTurnSpec['adaptiveFollowUps']>[number];

export interface ProtocolPracticeSpec {
  id: string;
  version: string;
  legacyExerciseId: string;
  protocolFamilyId: string;
  protocolVariantId: string;
  title: string;
  inputModes: PulseCheckProtocolPracticeInputMode[];
  transcriptReviewEnabled: boolean;
  practiceIntro: string;
  evaluationLead: string;
  nextRepFocus: string;
  rubricLabels: Record<keyof PulseCheckProtocolPracticeDimensionScores, string>;
  turns: ProtocolPracticeTurnSpec[];
}

type ProtocolPracticeSubmissionInput = {
  responseText: string;
  modality: 'text' | 'voice';
  usedAdaptiveFollowUp?: boolean;
  followUpPromptId?: string;
  followUpPromptText?: string;
  transcriptReviewed?: boolean;
  voiceSignals?: PulseCheckProtocolPracticeVoiceSignals;
};

export type ProtocolPracticeTurnEvaluation = {
  turn: PulseCheckProtocolPracticeTurn;
  shouldUseAdaptiveFollowUp: boolean;
  followUpPrompt?: ProtocolPracticeAdaptiveFollowUp;
};

function normalizeText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function countKeywordHits(response: string, keywords: string[] | undefined) {
  if (!keywords?.length) return 0;
  const normalized = normalizeText(response);
  return keywords.reduce((count, keyword) => {
    const target = normalizeText(keyword);
    return target && normalized.includes(target) ? count + 1 : count;
  }, 0);
}

function averageDimensionScores(turns: PulseCheckProtocolPracticeTurn[]): PulseCheckProtocolPracticeDimensionScores {
  if (!turns.length) {
    return {
      signalAwareness: 1,
      techniqueFidelity: 1,
      languageQuality: 1,
      shiftQuality: 1,
      coachability: 1,
    };
  }

  const totals = turns.reduce<PulseCheckProtocolPracticeDimensionScores>((accumulator, turn) => ({
    signalAwareness: accumulator.signalAwareness + turn.scores.signalAwareness,
    techniqueFidelity: accumulator.techniqueFidelity + turn.scores.techniqueFidelity,
    languageQuality: accumulator.languageQuality + turn.scores.languageQuality,
    shiftQuality: accumulator.shiftQuality + turn.scores.shiftQuality,
    coachability: accumulator.coachability + turn.scores.coachability,
  }), {
    signalAwareness: 0,
    techniqueFidelity: 0,
    languageQuality: 0,
    shiftQuality: 0,
    coachability: 0,
  });

  return {
    signalAwareness: Number((totals.signalAwareness / turns.length).toFixed(1)),
    techniqueFidelity: Number((totals.techniqueFidelity / turns.length).toFixed(1)),
    languageQuality: Number((totals.languageQuality / turns.length).toFixed(1)),
    shiftQuality: Number((totals.shiftQuality / turns.length).toFixed(1)),
    coachability: Number((totals.coachability / turns.length).toFixed(1)),
  };
}

function scoreDimension(response: string, keywords: string[] | undefined, targeted: boolean) {
  if (!targeted) return 3;
  const trimmed = response.trim();
  if (!trimmed) return 1;

  const hits = countKeywordHits(trimmed, keywords);
  const wordCount = normalizeText(trimmed).split(' ').filter(Boolean).length;

  if (hits >= 3 || (hits >= 2 && wordCount >= 9)) return 5;
  if (hits >= 2 || (hits >= 1 && wordCount >= 7)) return 4;
  if (hits >= 1 || wordCount >= 5) return 3;
  if (wordCount >= 2) return 2;
  return 1;
}

function buildTurnStrengths(scores: PulseCheckProtocolPracticeDimensionScores, spec: ProtocolPracticeSpec) {
  const strengths: string[] = [];
  const labels = spec.rubricLabels;
  (Object.keys(scores) as Array<keyof PulseCheckProtocolPracticeDimensionScores>).forEach((key) => {
    if (scores[key] >= 4) {
      strengths.push(`${labels[key]} came through clearly.`);
    }
  });
  return strengths;
}

function buildTurnMisses(scores: PulseCheckProtocolPracticeDimensionScores, spec: ProtocolPracticeSpec) {
  const misses: string[] = [];
  const labels = spec.rubricLabels;
  (Object.keys(scores) as Array<keyof PulseCheckProtocolPracticeDimensionScores>).forEach((key) => {
    if (scores[key] <= 2) {
      misses.push(`${labels[key]} still needs a stronger rep.`);
    }
  });
  return misses;
}

function buildTurnFeedback(
  spec: ProtocolPracticeSpec,
  turnSpec: ProtocolPracticeTurnSpec,
  scores: PulseCheckProtocolPracticeDimensionScores,
  misses: string[],
  strengths: string[]
) {
  const weakestDimension = (Object.entries(scores) as Array<[keyof PulseCheckProtocolPracticeDimensionScores, number]>)
    .sort((left, right) => left[1] - right[1])[0]?.[0];
  const weakestLabel = weakestDimension ? spec.rubricLabels[weakestDimension] : 'the technique';

  if (misses.length) {
    return `${strengths[0] || 'Good first rep.'} Tighten ${weakestLabel.toLowerCase()} on the next answer so the technique sounds more like something you'd actually use under pressure.`;
  }

  if (turnSpec.targetedDimensions.includes('shiftQuality')) {
    return 'That sounded more usable. Keep the same tone and make the next answer even more specific to the moment.';
  }

  return 'Good. That sounds like a real rep, not a generic answer. Keep going.';
}

function summarizeVoiceSignals(turns: PulseCheckProtocolPracticeTurn[]) {
  const voiceTurns = turns.filter((turn) => turn.voiceSignals?.confidenceQualified);
  if (!voiceTurns.length) return undefined;

  const averageConfidence = voiceTurns.reduce((total, turn) => total + (turn.voiceSignals?.transcriptConfidence || 0), 0) / voiceTurns.length;
  const averageWpm = voiceTurns.reduce((total, turn) => total + (turn.voiceSignals?.wordsPerMinute || 0), 0) / voiceTurns.length;

  return `Voice capture looked usable across ${voiceTurns.length} turn${voiceTurns.length === 1 ? '' : 's'} with ${(averageConfidence * 100).toFixed(0)}% average transcript confidence and ${Math.round(averageWpm)} WPM pacing.`;
}

function createSpec(input: Omit<ProtocolPracticeSpec, 'version' | 'transcriptReviewEnabled'>): ProtocolPracticeSpec {
  return {
    version: 'v1',
    transcriptReviewEnabled: true,
    ...input,
  };
}

const SEEDED_PROTOCOL_PRACTICE_SPECS: ProtocolPracticeSpec[] = [
  createSpec({
    id: 'practice-regulation-acute-downshift',
    legacyExerciseId: 'breathing-physiological-sigh',
    protocolFamilyId: 'regulation-acute_downshift',
    protocolVariantId: 'regulation-acute_downshift--physiological-sigh',
    title: 'Physiological Sigh Practice',
    inputModes: ['text', 'voice', 'mixed'],
    practiceIntro: 'Now let’s put this into practice. Answer me directly so we can turn that spike into a usable downshift.',
    evaluationLead: 'Here is how your acute-downshift rep looked.',
    nextRepFocus: 'Name the spike quickly, then pair it with a shorter, sharper exhale-driven reset.',
    rubricLabels: {
      signalAwareness: 'Signal awareness',
      techniqueFidelity: 'Breath-technique fidelity',
      languageQuality: 'Language quality',
      shiftQuality: 'State shift',
      coachability: 'Coachability',
    },
    turns: [
      {
        id: 'notice-spike',
        label: 'Notice the spike',
        promptText: 'What is your body doing right now that tells you the stress spike is real?',
        placeholder: 'Type what you notice in your body...',
        targetedDimensions: ['signalAwareness', 'languageQuality'],
        keywordSignals: {
          signalAwareness: ['heart', 'breath', 'tight', 'butterflies', 'sweaty', 'tense', 'racing'],
          languageQuality: ['right now', 'breath', 'body', 'chest'],
        },
        adaptiveFollowUps: [
          { id: 'notice-spike-followup', targetDimension: 'signalAwareness', promptText: 'Give me one body cue, not a story. What sensation are you noticing first?' },
        ],
      },
      {
        id: 'apply-breath',
        label: 'Apply the sigh',
        promptText: 'Tell me exactly how you will do the sigh on the next rep.',
        placeholder: 'Describe the inhale + exhale sequence...',
        targetedDimensions: ['techniqueFidelity', 'coachability'],
        keywordSignals: {
          techniqueFidelity: ['double inhale', 'two inhales', 'long exhale', 'slow exhale', 'extended exhale', 'nose'],
          coachability: ['first', 'then', 'next'],
        },
        adaptiveFollowUps: [
          { id: 'apply-breath-followup', targetDimension: 'techniqueFidelity', promptText: 'Tighten the technique. I need the order: two inhales, then one long exhale.' },
        ],
      },
      {
        id: 'state-shift',
        label: 'Name the shift',
        promptText: 'After the sigh, what should feel different before you step back into execution?',
        placeholder: 'Describe the change you want...',
        targetedDimensions: ['shiftQuality', 'languageQuality'],
        keywordSignals: {
          shiftQuality: ['calmer', 'slower', 'steady', 'clear', 'settled', 'controlled', 'reset'],
          languageQuality: ['ready', 'execute', 'next rep'],
        },
      },
    ],
  }),
  createSpec({
    id: 'practice-regulation-steady-regulation',
    legacyExerciseId: 'breathing-box',
    protocolFamilyId: 'regulation-steady_regulation',
    protocolVariantId: 'regulation-steady_regulation--box-breathing',
    title: 'Box Breathing Practice',
    inputModes: ['text', 'voice', 'mixed'],
    practiceIntro: 'Let’s make this usable. I want you to explain the steady rhythm like you are about to use it between attempts.',
    evaluationLead: 'Here is how your steady-regulation rep looked.',
    nextRepFocus: 'Keep the answer simple and rhythmic so the cadence feels deployable under pressure.',
    rubricLabels: {
      signalAwareness: 'State awareness',
      techniqueFidelity: 'Cadence fidelity',
      languageQuality: 'Language quality',
      shiftQuality: 'Composure shift',
      coachability: 'Coachability',
    },
    turns: [
      {
        id: 'when-to-use',
        label: 'Use window',
        promptText: 'When would you use this version instead of an emergency reset?',
        placeholder: 'Describe the moment you would deploy it...',
        targetedDimensions: ['signalAwareness', 'languageQuality'],
        keywordSignals: {
          signalAwareness: ['between reps', 'between attempts', 'pre lift', 'pre competition', 'steady', 'composure'],
          languageQuality: ['control', 'steady', 'composed'],
        },
      },
      {
        id: 'cadence',
        label: 'Cadence',
        promptText: 'Talk me through the cadence you will follow.',
        placeholder: 'Describe the equal breathing pattern...',
        targetedDimensions: ['techniqueFidelity', 'coachability'],
        keywordSignals: {
          techniqueFidelity: ['inhale', 'hold', 'exhale', 'hold', 'four', 'equal'],
          coachability: ['count', 'cadence', 'rhythm'],
        },
        adaptiveFollowUps: [
          { id: 'cadence-followup', targetDimension: 'techniqueFidelity', promptText: 'Make it tighter. I need the equal inhale, hold, exhale, hold rhythm in your answer.' },
        ],
      },
      {
        id: 'desired-state',
        label: 'Desired state',
        promptText: 'What should change in your body or attention if the box breath works?',
        placeholder: 'Describe the composure shift...',
        targetedDimensions: ['shiftQuality'],
        keywordSignals: {
          shiftQuality: ['slower', 'steady', 'calm', 'clear', 'settled', 'focused'],
        },
      },
    ],
  }),
  createSpec({
    id: 'practice-regulation-focus-narrowing',
    legacyExerciseId: 'focus-body-scan',
    protocolFamilyId: 'regulation-focus_narrowing',
    protocolVariantId: 'regulation-focus_narrowing--body-scan-awareness',
    title: 'Body Scan Awareness Practice',
    inputModes: ['text', 'voice', 'mixed'],
    practiceIntro: 'Now apply it. I want you to name what you notice and what tension you would release before the next technical rep.',
    evaluationLead: 'Here is how your body-scan rep looked.',
    nextRepFocus: 'Make the body cue more specific and tie it directly to release or refocus.',
    rubricLabels: {
      signalAwareness: 'Body awareness',
      techniqueFidelity: 'Scan fidelity',
      languageQuality: 'Language quality',
      shiftQuality: 'Release shift',
      coachability: 'Coachability',
    },
    turns: [
      {
        id: 'scan-find',
        label: 'Find the tension',
        promptText: 'What part of your body is carrying the most unnecessary tension right now?',
        placeholder: 'Name the body area and sensation...',
        targetedDimensions: ['signalAwareness'],
        keywordSignals: {
          signalAwareness: ['jaw', 'shoulders', 'hands', 'neck', 'chest', 'hips', 'tight', 'tense'],
        },
      },
      {
        id: 'release-plan',
        label: 'Release plan',
        promptText: 'How will you release that tension before you execute?',
        placeholder: 'Describe the release action...',
        targetedDimensions: ['techniqueFidelity', 'shiftQuality'],
        keywordSignals: {
          techniqueFidelity: ['relax', 'drop', 'soften', 'release', 'unclench'],
          shiftQuality: ['looser', 'free', 'cleaner', 'smooth'],
        },
      },
      {
        id: 'attention-return',
        label: 'Attention return',
        promptText: 'Once the tension drops, what will your attention return to?',
        placeholder: 'Name the next useful cue...',
        targetedDimensions: ['languageQuality', 'coachability'],
        keywordSignals: {
          languageQuality: ['next cue', 'target', 'execution', 'technique', 'movement'],
          coachability: ['next', 'return', 'back'],
        },
      },
    ],
  }),
  createSpec({
    id: 'practice-regulation-cognitive-reframe',
    legacyExerciseId: 'mindset-nerves-excitement',
    protocolFamilyId: 'regulation-cognitive_reframe',
    protocolVariantId: 'regulation-cognitive_reframe--nerves-to-excitement-reframe',
    title: 'Nerves To Excitement Practice',
    inputModes: ['text', 'voice', 'mixed'],
    practiceIntro: 'Now we practice the reframe. Answer like you are about to say this to yourself before a real rep.',
    evaluationLead: 'Here is how your reframe rep looked.',
    nextRepFocus: 'Keep the language short, embodied, and pointed toward readiness rather than fear.',
    rubricLabels: {
      signalAwareness: 'Signal awareness',
      techniqueFidelity: 'Reframe fidelity',
      languageQuality: 'Performance language',
      shiftQuality: 'Readiness shift',
      coachability: 'Coachability',
    },
    turns: [
      {
        id: 'notice-symptoms',
        label: 'Notice symptoms',
        promptText: 'What symptoms tell you the pressure is real right now?',
        placeholder: 'Name the sensations you notice...',
        targetedDimensions: ['signalAwareness'],
        keywordSignals: {
          signalAwareness: ['heart', 'butterflies', 'palms', 'breath', 'sweaty', 'racing', 'nervous'],
        },
      },
      {
        id: 'reframe-language',
        label: 'Reframe language',
        promptText: 'Now reframe those symptoms as readiness, not danger.',
        placeholder: 'Write the reframe you would actually say...',
        targetedDimensions: ['techniqueFidelity', 'languageQuality', 'coachability'],
        keywordSignals: {
          techniqueFidelity: ['excited', 'ready', 'fuel', 'opportunity', 'matters'],
          languageQuality: ['i am', 'this means', 'i m ready', 'i am ready'],
          coachability: ['not fear', 'not scared', 'instead'],
        },
        adaptiveFollowUps: [
          { id: 'reframe-language-followup', targetDimension: 'techniqueFidelity', promptText: 'Tighten the reframe. I need you to turn the same body signal into readiness, not just describe nerves.' },
        ],
      },
      {
        id: 'competition-script',
        label: 'Competition script',
        promptText: 'Give me your competition-ready line in one sentence.',
        placeholder: 'Write the sentence you would carry into the rep...',
        targetedDimensions: ['shiftQuality', 'languageQuality'],
        keywordSignals: {
          shiftQuality: ['ready', 'fuel', 'go', 'attack', 'compete', 'execute'],
          languageQuality: ['i', 'my', 'this'],
        },
      },
    ],
  }),
  createSpec({
    id: 'practice-priming-activation-breathing',
    legacyExerciseId: 'breathing-activation',
    protocolFamilyId: 'priming-activation_upshift',
    protocolVariantId: 'priming-activation_upshift--activation-breathing',
    title: 'Activation Breathing Practice',
    inputModes: ['text', 'voice', 'mixed'],
    practiceIntro: 'Let’s make sure the upshift is controlled. I want clear language about how you raise activation without getting sloppy.',
    evaluationLead: 'Here is how your activation rep looked.',
    nextRepFocus: 'Aim for energized and sharp, not rushed.',
    rubricLabels: {
      signalAwareness: 'Underactivation awareness',
      techniqueFidelity: 'Activation fidelity',
      languageQuality: 'Activation language',
      shiftQuality: 'Upshift quality',
      coachability: 'Coachability',
    },
    turns: [
      {
        id: 'flat-state',
        label: 'Flat state',
        promptText: 'What tells you that you are flat or underactivated right now?',
        placeholder: 'Describe the low-energy signs...',
        targetedDimensions: ['signalAwareness'],
        keywordSignals: {
          signalAwareness: ['flat', 'slow', 'sluggish', 'low energy', 'underactivated', 'sleepy', 'heavy'],
        },
      },
      {
        id: 'upsift-plan',
        label: 'Upshift plan',
        promptText: 'How will you use the breath to raise activation without losing control?',
        placeholder: 'Describe the breath and the control...',
        targetedDimensions: ['techniqueFidelity', 'coachability'],
        keywordSignals: {
          techniqueFidelity: ['inhale', 'sharp', 'quick', 'controlled', 'raise', 'energize'],
          coachability: ['without', 'control', 'steady'],
        },
      },
      {
        id: 'ready-state',
        label: 'Ready state',
        promptText: 'What should your state feel like after the activation breath works?',
        placeholder: 'Name the target state...',
        targetedDimensions: ['shiftQuality', 'languageQuality'],
        keywordSignals: {
          shiftQuality: ['sharp', 'awake', 'ready', 'explosive', 'focused', 'on'],
          languageQuality: ['ready', 'go', 'attack'],
        },
      },
    ],
  }),
  createSpec({
    id: 'practice-priming-cue-word',
    legacyExerciseId: 'focus-cue-word',
    protocolFamilyId: 'priming-focus_narrowing',
    protocolVariantId: 'priming-focus_narrowing--cue-word-anchoring',
    title: 'Cue Word Anchoring Practice',
    inputModes: ['text', 'voice', 'mixed'],
    practiceIntro: 'Now sharpen it. I want one cue word and a clear explanation of what it anchors.',
    evaluationLead: 'Here is how your cue-word rep looked.',
    nextRepFocus: 'Keep the cue shorter and more action-linked.',
    rubricLabels: {
      signalAwareness: 'Focus awareness',
      techniqueFidelity: 'Cue fidelity',
      languageQuality: 'Cue language',
      shiftQuality: 'Attention shift',
      coachability: 'Coachability',
    },
    turns: [
      {
        id: 'focus-problem',
        label: 'Focus problem',
        promptText: 'What is pulling your attention away from the next action?',
        placeholder: 'Name the distraction...',
        targetedDimensions: ['signalAwareness'],
        keywordSignals: {
          signalAwareness: ['distraction', 'noise', 'crowd', 'thoughts', 'mistake', 'outcome', 'overthinking'],
        },
      },
      {
        id: 'cue-word',
        label: 'Cue word',
        promptText: 'What one or two word cue will you use to anchor the next action?',
        placeholder: 'Type your cue word...',
        targetedDimensions: ['techniqueFidelity', 'languageQuality'],
        keywordSignals: {
          techniqueFidelity: ['quick', 'smooth', 'drive', 'eyes', 'breathe', 'tall', 'fast'],
          languageQuality: ['one', 'word', 'cue'],
        },
      },
      {
        id: 'anchor-execution',
        label: 'Anchor execution',
        promptText: 'How does that cue bring you back to execution?',
        placeholder: 'Explain how the cue helps...',
        targetedDimensions: ['shiftQuality', 'coachability'],
        keywordSignals: {
          shiftQuality: ['next action', 'focus', 'execution', 'back', 'attention'],
          coachability: ['bring', 'back', 'return'],
        },
      },
    ],
  }),
  createSpec({
    id: 'practice-priming-imagery',
    legacyExerciseId: 'viz-perfect-execution',
    protocolFamilyId: 'priming-imagery_priming',
    protocolVariantId: 'priming-imagery_priming--perfect-execution-replay',
    title: 'Perfect Execution Replay Practice',
    inputModes: ['text', 'voice', 'mixed'],
    practiceIntro: 'Now rehearse it like it is real. I want sensory detail and clean execution language.',
    evaluationLead: 'Here is how your imagery rep looked.',
    nextRepFocus: 'Add more sensory detail and keep the image tied to the next real action.',
    rubricLabels: {
      signalAwareness: 'Execution awareness',
      techniqueFidelity: 'Imagery fidelity',
      languageQuality: 'Imagery language',
      shiftQuality: 'Readiness shift',
      coachability: 'Coachability',
    },
    turns: [
      {
        id: 'see-moment',
        label: 'See the moment',
        promptText: 'What is the exact moment you are about to rehearse?',
        placeholder: 'Describe the moment...',
        targetedDimensions: ['signalAwareness', 'languageQuality'],
        keywordSignals: {
          signalAwareness: ['next rep', 'next shot', 'next lift', 'next play', 'moment'],
          languageQuality: ['exact', 'moment', 'see'],
        },
      },
      {
        id: 'feel-execution',
        label: 'Feel execution',
        promptText: 'Describe what perfect execution looks and feels like.',
        placeholder: 'Describe the movement and feel...',
        targetedDimensions: ['techniqueFidelity', 'languageQuality'],
        keywordSignals: {
          techniqueFidelity: ['smooth', 'clean', 'timing', 'tempo', 'feel', 'see', 'hear'],
          languageQuality: ['looks', 'feels', 'movement', 'release', 'drive'],
        },
      },
      {
        id: 'carry-forward',
        label: 'Carry it forward',
        promptText: 'What is the one thing you will carry from the image into the real rep?',
        placeholder: 'Name the carry-forward cue...',
        targetedDimensions: ['shiftQuality', 'coachability'],
        keywordSignals: {
          shiftQuality: ['carry', 'next rep', 'cue', 'execution', 'real'],
          coachability: ['one thing', 'next'],
        },
      },
    ],
  }),
  createSpec({
    id: 'practice-priming-confidence',
    legacyExerciseId: 'confidence-power-pose',
    protocolFamilyId: 'priming-confidence_priming',
    protocolVariantId: 'priming-confidence_priming--power-posing',
    title: 'Power Posing Practice',
    inputModes: ['text', 'voice', 'mixed'],
    practiceIntro: 'Let’s make the posture cue useful. I want the answer tied to presence and readiness, not hype.',
    evaluationLead: 'Here is how your confidence-priming rep looked.',
    nextRepFocus: 'Keep the posture cue grounded in presence and action.',
    rubricLabels: {
      signalAwareness: 'Confidence awareness',
      techniqueFidelity: 'Posture cue fidelity',
      languageQuality: 'Confidence language',
      shiftQuality: 'Presence shift',
      coachability: 'Coachability',
    },
    turns: [
      {
        id: 'posture-change',
        label: 'Posture change',
        promptText: 'What changes in your posture when you want to look and feel more ready?',
        placeholder: 'Describe the posture change...',
        targetedDimensions: ['signalAwareness', 'techniqueFidelity'],
        keywordSignals: {
          signalAwareness: ['shoulders', 'chest', 'tall', 'stance', 'head', 'posture'],
          techniqueFidelity: ['open', 'stacked', 'grounded', 'upright'],
        },
      },
      {
        id: 'meaning',
        label: 'Meaning',
        promptText: 'What does that posture communicate to your own mind before the rep?',
        placeholder: 'Describe the internal message...',
        targetedDimensions: ['languageQuality'],
        keywordSignals: {
          languageQuality: ['ready', 'present', 'capable', 'composed', 'confident'],
        },
      },
      {
        id: 'action-link',
        label: 'Action link',
        promptText: 'How will you connect that posture to the next action?',
        placeholder: 'Link it to execution...',
        targetedDimensions: ['shiftQuality', 'coachability'],
        keywordSignals: {
          shiftQuality: ['next action', 'step in', 'execute', 'go', 'rep'],
          coachability: ['connect', 'link', 'carry'],
        },
      },
    ],
  }),
  createSpec({
    id: 'practice-recovery-breathing',
    legacyExerciseId: 'breathing-recovery',
    protocolFamilyId: 'recovery-recovery_downregulation',
    protocolVariantId: 'recovery-recovery_downregulation--recovery-breathing',
    title: 'Recovery Breathing Practice',
    inputModes: ['text', 'voice', 'mixed'],
    practiceIntro: 'Now we turn the cooldown into a real recovery rep. Tell me how you would guide yourself back toward baseline.',
    evaluationLead: 'Here is how your recovery-breathing rep looked.',
    nextRepFocus: 'Keep the exhale and the recovery goal more explicit.',
    rubricLabels: {
      signalAwareness: 'Recovery awareness',
      techniqueFidelity: 'Recovery-breath fidelity',
      languageQuality: 'Recovery language',
      shiftQuality: 'Downregulation shift',
      coachability: 'Coachability',
    },
    turns: [
      {
        id: 'post-load-state',
        label: 'Post-load state',
        promptText: 'What signs tell you your system is still carrying load?',
        placeholder: 'Describe the carryover...',
        targetedDimensions: ['signalAwareness'],
        keywordSignals: {
          signalAwareness: ['heart', 'breath', 'amped', 'tight', 'wired', 'carryover', 'stress'],
        },
      },
      {
        id: 'recovery-breath-plan',
        label: 'Recovery breath',
        promptText: 'How will you use the exhale to move back toward recovery?',
        placeholder: 'Describe the exhale-led breath...',
        targetedDimensions: ['techniqueFidelity', 'coachability'],
        keywordSignals: {
          techniqueFidelity: ['exhale', 'longer exhale', 'slow', 'downregulate', 'baseline'],
          coachability: ['toward', 'back', 'recover'],
        },
      },
      {
        id: 'target-recovery-state',
        label: 'Target recovery state',
        promptText: 'What should feel different if the recovery breath works?',
        placeholder: 'Describe the target recovery state...',
        targetedDimensions: ['shiftQuality', 'languageQuality'],
        keywordSignals: {
          shiftQuality: ['slower', 'calm', 'recovered', 'settled', 'baseline'],
          languageQuality: ['recover', 'reset', 'down'],
        },
      },
    ],
  }),
  createSpec({
    id: 'practice-recovery-478',
    legacyExerciseId: 'breathing-478',
    protocolFamilyId: 'recovery-recovery_downregulation',
    protocolVariantId: 'recovery-recovery_downregulation--4-7-8-relaxation-breathing',
    title: '4-7-8 Relaxation Practice',
    inputModes: ['text', 'voice', 'mixed'],
    practiceIntro: 'Let’s make the wind-down specific. I want the answer to sound like a true evening or deep-recovery reset.',
    evaluationLead: 'Here is how your deeper recovery rep looked.',
    nextRepFocus: 'Keep the longer hold/exhale and the sleep-tilted use case clear.',
    rubricLabels: {
      signalAwareness: 'Recovery-window awareness',
      techniqueFidelity: '4-7-8 fidelity',
      languageQuality: 'Relaxation language',
      shiftQuality: 'Deeper-settle shift',
      coachability: 'Coachability',
    },
    turns: [
      {
        id: 'when-this-version',
        label: 'When this version',
        promptText: 'When would you choose this deeper recovery breath over a faster cooldown?',
        placeholder: 'Describe the use window...',
        targetedDimensions: ['signalAwareness', 'languageQuality'],
        keywordSignals: {
          signalAwareness: ['evening', 'sleep', 'late', 'wind down', 'deeper recovery'],
          languageQuality: ['deeper', 'slow', 'settle'],
        },
      },
      {
        id: '478-cadence',
        label: '4-7-8 cadence',
        promptText: 'Talk me through the 4-7-8 cadence you are about to use.',
        placeholder: 'Describe the 4-7-8 count...',
        targetedDimensions: ['techniqueFidelity'],
        keywordSignals: {
          techniqueFidelity: ['4', '7', '8', 'inhale', 'hold', 'exhale'],
        },
      },
      {
        id: 'deep-settle',
        label: 'Deep settle',
        promptText: 'What should your body or mind feel like after a good 4-7-8 set?',
        placeholder: 'Describe the deeper settle...',
        targetedDimensions: ['shiftQuality'],
        keywordSignals: {
          shiftQuality: ['sleepy', 'calm', 'settled', 'quiet', 'down', 'heavy'],
        },
      },
    ],
  }),
  createSpec({
    id: 'practice-recovery-process-focus',
    legacyExerciseId: 'mindset-process-focus',
    protocolFamilyId: 'recovery-recovery_reflection',
    protocolVariantId: 'recovery-recovery_reflection--process-over-outcome',
    title: 'Process Over Outcome Practice',
    inputModes: ['text', 'voice', 'mixed'],
    practiceIntro: 'Now apply the reset. I want you to move from result-spiral back to the next controllable action.',
    evaluationLead: 'Here is how your process-focus rep looked.',
    nextRepFocus: 'Reduce outcome language and make the next controllable cue more concrete.',
    rubricLabels: {
      signalAwareness: 'Outcome-spiral awareness',
      techniqueFidelity: 'Process-focus fidelity',
      languageQuality: 'Process language',
      shiftQuality: 'Refocus shift',
      coachability: 'Coachability',
    },
    turns: [
      {
        id: 'outcome-thought',
        label: 'Outcome thought',
        promptText: 'What outcome thought is pulling you away from execution right now?',
        placeholder: 'Name the outcome thought...',
        targetedDimensions: ['signalAwareness'],
        keywordSignals: {
          signalAwareness: ['winning', 'losing', 'score', 'result', 'outcome', 'what if'],
        },
      },
      {
        id: 'process-cue',
        label: 'Process cue',
        promptText: 'What is the next controllable process cue you can return to?',
        placeholder: 'Name the process cue...',
        targetedDimensions: ['techniqueFidelity', 'languageQuality'],
        keywordSignals: {
          techniqueFidelity: ['cue', 'breath', 'feet', 'release', 'core', 'eyes', 'technique'],
          languageQuality: ['control', 'next', 'process'],
        },
      },
      {
        id: 'judgement-reset',
        label: 'Judgement reset',
        promptText: 'How will you judge the next rep by process instead of result?',
        placeholder: 'Describe the process-based judgement...',
        targetedDimensions: ['shiftQuality', 'coachability'],
        keywordSignals: {
          shiftQuality: ['process', 'execution', 'controllable', 'next rep'],
          coachability: ['judge', 'focus', 'return'],
        },
      },
    ],
  }),
  createSpec({
    id: 'practice-recovery-evidence-journal',
    legacyExerciseId: 'confidence-evidence-journal',
    protocolFamilyId: 'recovery-recovery_reflection',
    protocolVariantId: 'recovery-recovery_reflection--evidence-journal',
    title: 'Evidence Journal Practice',
    inputModes: ['text', 'voice', 'mixed'],
    practiceIntro: 'Let’s ground the recovery in facts. Give me proof, not vibes.',
    evaluationLead: 'Here is how your evidence-journal rep looked.',
    nextRepFocus: 'Use more concrete proof and less generic reassurance.',
    rubricLabels: {
      signalAwareness: 'Confidence-drag awareness',
      techniqueFidelity: 'Evidence fidelity',
      languageQuality: 'Evidence language',
      shiftQuality: 'Belief shift',
      coachability: 'Coachability',
    },
    turns: [
      {
        id: 'self-doubt',
        label: 'Self-doubt',
        promptText: 'What doubt or drag are you trying to interrupt right now?',
        placeholder: 'Name the doubt...',
        targetedDimensions: ['signalAwareness'],
        keywordSignals: {
          signalAwareness: ['doubt', 'confidence', 'not ready', 'not enough', 'uncertain', 'questioning'],
        },
      },
      {
        id: 'proof',
        label: 'Proof',
        promptText: 'Give me one concrete piece of evidence that you are prepared or progressing.',
        placeholder: 'Write one real piece of proof...',
        targetedDimensions: ['techniqueFidelity', 'languageQuality'],
        keywordSignals: {
          techniqueFidelity: ['practice', 'trained', 'completed', 'progress', 'proof', 'evidence', 'did'],
          languageQuality: ['specific', 'real', 'fact'],
        },
        adaptiveFollowUps: [
          { id: 'proof-followup', targetDimension: 'techniqueFidelity', promptText: 'Make it more concrete. Give me one fact someone else could verify.' },
        ],
      },
      {
        id: 'belief-reset',
        label: 'Belief reset',
        promptText: 'How does that evidence change the way you should talk to yourself next?',
        placeholder: 'Describe the updated self-talk...',
        targetedDimensions: ['shiftQuality', 'coachability'],
        keywordSignals: {
          shiftQuality: ['ready', 'capable', 'proven', 'earned', 'prepared'],
          coachability: ['next', 'talk', 'say'],
        },
      },
    ],
  }),
];

function buildTurnId(turnSpec: ProtocolPracticeTurnSpec) {
  return `${turnSpec.id}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function getProtocolPracticeSpecByLegacyExerciseId(legacyExerciseId?: string | null): ProtocolPracticeSpec | null {
  const normalizedId = legacyExerciseId?.trim();
  if (!normalizedId) return null;
  return SEEDED_PROTOCOL_PRACTICE_SPECS.find((spec) => spec.legacyExerciseId === normalizedId) || null;
}

export function getProtocolPracticeSpecByVariantId(protocolVariantId?: string | null): ProtocolPracticeSpec | null {
  const normalizedId = protocolVariantId?.trim();
  if (!normalizedId) return null;
  return SEEDED_PROTOCOL_PRACTICE_SPECS.find((spec) => spec.protocolVariantId === normalizedId) || null;
}

export function evaluateProtocolPracticeTurn(
  spec: ProtocolPracticeSpec,
  turnSpec: ProtocolPracticeTurnSpec,
  input: ProtocolPracticeSubmissionInput,
  priorTurns: PulseCheckProtocolPracticeTurn[]
): ProtocolPracticeTurnEvaluation {
  const responseText = input.responseText.trim();
  const scores: PulseCheckProtocolPracticeDimensionScores = {
    signalAwareness: scoreDimension(responseText, turnSpec.keywordSignals?.signalAwareness, turnSpec.targetedDimensions.includes('signalAwareness')),
    techniqueFidelity: scoreDimension(responseText, turnSpec.keywordSignals?.techniqueFidelity, turnSpec.targetedDimensions.includes('techniqueFidelity')),
    languageQuality: scoreDimension(responseText, turnSpec.keywordSignals?.languageQuality, turnSpec.targetedDimensions.includes('languageQuality')),
    shiftQuality: scoreDimension(responseText, turnSpec.keywordSignals?.shiftQuality, turnSpec.targetedDimensions.includes('shiftQuality')),
    coachability: Math.min(5, Math.max(1, priorTurns.length ? priorTurns[priorTurns.length - 1].scores.coachability + (responseText.split(/\s+/).length >= 4 ? 1 : 0) : scoreDimension(responseText, turnSpec.keywordSignals?.coachability, turnSpec.targetedDimensions.includes('coachability')))),
  };

  if (!turnSpec.targetedDimensions.includes('coachability')) {
    scores.coachability = priorTurns.length ? Math.max(2, Math.min(5, priorTurns[priorTurns.length - 1].scores.coachability)) : 3;
  }

  const strengths = buildTurnStrengths(scores, spec);
  const misses = buildTurnMisses(scores, spec);
  const weakestTarget = turnSpec.targetedDimensions
    .map((dimension) => [dimension, scores[dimension]] as const)
    .sort((left, right) => left[1] - right[1])[0];
  const followUpPrompt = weakestTarget && weakestTarget[1] <= 2
    ? turnSpec.adaptiveFollowUps?.find((followUp) => followUp.targetDimension === weakestTarget[0])
    : undefined;

  return {
    turn: {
      id: buildTurnId(turnSpec),
      promptId: turnSpec.id,
      promptLabel: turnSpec.label,
      promptText: turnSpec.promptText,
      responseText,
      modality: input.modality,
      followUpPromptId: input.followUpPromptId,
      followUpPromptText: input.followUpPromptText,
      usedAdaptiveFollowUp: input.usedAdaptiveFollowUp,
      transcriptReviewed: input.transcriptReviewed,
      voiceSignals: input.voiceSignals,
      scores,
      strengths,
      misses,
      noraFeedback: buildTurnFeedback(spec, turnSpec, scores, misses, strengths),
      submittedAt: Date.now(),
    },
    shouldUseAdaptiveFollowUp: Boolean(followUpPrompt && !input.usedAdaptiveFollowUp),
    followUpPrompt,
  };
}

export function evaluateProtocolPracticeSession(
  spec: ProtocolPracticeSpec,
  turns: PulseCheckProtocolPracticeTurn[]
): PulseCheckProtocolPracticeScorecard {
  const dimensionScores = averageDimensionScores(turns);
  const allStrengths = Array.from(new Set(turns.flatMap((turn) => turn.strengths))).slice(0, 3);
  const allMisses = Array.from(new Set(turns.flatMap((turn) => turn.misses))).slice(0, 3);
  const overallScore = Number((
    (
      dimensionScores.signalAwareness +
      dimensionScores.techniqueFidelity +
      dimensionScores.languageQuality +
      dimensionScores.shiftQuality +
      dimensionScores.coachability
    ) / 5
  ).toFixed(1));
  const voiceSignalsSummary = summarizeVoiceSignals(turns);
  const coachabilityTrend =
    turns.length >= 2 && turns[turns.length - 1].scores.coachability > turns[0].scores.coachability
      ? 'improving'
      : turns.some((turn) => turn.scores.coachability <= 2)
        ? 'needs_support'
        : 'steady';

  const evaluationSummary =
    overallScore >= 4
      ? `${spec.evaluationLead} You sound like you can actually deploy this protocol under pressure.`
      : overallScore >= 3
        ? `${spec.evaluationLead} The technique is taking shape, but one more sharper rep would make it more competition-ready.`
        : `${spec.evaluationLead} You understand the idea, but the language still needs to sound more like a true applied rep.`;

  return {
    overallScore,
    dimensionScores,
    strengths: allStrengths.length ? allStrengths : ['You stayed engaged through the rep.'],
    improvementAreas: allMisses.length ? allMisses : ['Keep making the language more specific to the moment.'],
    evaluationSummary,
    nextRepFocus: spec.nextRepFocus,
    coachabilityTrend,
    voiceSignalsSummary,
  };
}

export function createProtocolPracticeSessionDraft(
  spec: ProtocolPracticeSpec,
  context?: {
    protocolId?: string;
    protocolFamilyId?: string;
    protocolVariantId?: string;
  }
): PulseCheckProtocolPracticeSession {
  return {
    specId: spec.id,
    specVersion: spec.version,
    protocolId: context?.protocolId,
    protocolFamilyId: context?.protocolFamilyId || spec.protocolFamilyId,
    protocolVariantId: context?.protocolVariantId || spec.protocolVariantId,
    inputModesAllowed: spec.inputModes,
    transcriptReviewEnabled: spec.transcriptReviewEnabled,
    transcriptReviewUsed: false,
    adaptiveFollowUpsUsed: 0,
    turns: [],
  };
}

export const protocolPracticeConversationService = {
  listSpecs() {
    return SEEDED_PROTOCOL_PRACTICE_SPECS.slice();
  },
  getByLegacyExerciseId: getProtocolPracticeSpecByLegacyExerciseId,
  getByVariantId: getProtocolPracticeSpecByVariantId,
  createSessionDraft: createProtocolPracticeSessionDraft,
  evaluateTurn: evaluateProtocolPracticeTurn,
  evaluateSession: evaluateProtocolPracticeSession,
};
