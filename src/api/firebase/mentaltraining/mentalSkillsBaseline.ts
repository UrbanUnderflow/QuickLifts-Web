import type { SportScenarioArchetype } from './types';

export const MENTAL_SKILLS_BASELINE_VERSION = 5;

export type MentalSkillFamily =
  | 'breathing_body_awareness'
  | 'visualization'
  | 'attention_cues'
  | 'self_talk_reframing'
  | 'emotional_regulation'
  | 'reflection_learning'
  | 'belief_identity'
  | 'coherence';

export type MentalSkillStage = 'discovering' | 'recognizing' | 'choosing' | 'rehearsing';
export type MentalSkillFamiliarity =
  | 'new_to_me'
  | 'heard_of_it'
  | 'know_it'
  | 'practiced_it'
  | 'use_it';
export type MentalSkillEvidenceComponent = 'recognize' | 'understand' | 'choose' | 'rehearse';

export interface MentalSkillsCurrentState {
  mood: 'drained' | 'off' | 'okay' | 'solid' | 'locked_in';
  rest: number;
  energy: number;
  confidence: number;
  motivation: number;
  sportConnection: number;
  selfBelief: number;
  improvementBelief: number;
}

export interface MentalSkillEvidence {
  challengeId: string;
  family: MentalSkillFamily;
  component: MentalSkillEvidenceComponent;
  score: number;
  selectedOptionId?: string;
}

export interface MentalSkillFamilyScore {
  familiarity: number;
  recognize?: number;
  understand?: number;
  choose?: number;
  rehearse?: number;
  score: number;
  stage: MentalSkillStage;
}

export interface MentalSkillsBaselineRecord {
  version: number;
  completedAt: number;
  source: string;
  sportName?: string;
  sportArchetype: SportScenarioArchetype;
  currentState: MentalSkillsCurrentState;
  familiarity: Record<MentalSkillFamily, MentalSkillFamiliarity>;
  familyScores: Record<MentalSkillFamily, MentalSkillFamilyScore>;
  overallCompetencyScore: number;
  beliefScore: number;
  coherenceKnowledgeScore: number;
  strengths: MentalSkillFamily[];
  startingFocus: MentalSkillFamily[];
  disciplineFocus: {
    championMindset: MentalSkillFamily;
    mentalPerformance: MentalSkillFamily;
    emotionalRegulation: MentalSkillFamily;
  };
  evidence: MentalSkillEvidence[];
}

export const MENTAL_SKILL_FAMILIES: MentalSkillFamily[] = [
  'breathing_body_awareness',
  'visualization',
  'attention_cues',
  'self_talk_reframing',
  'emotional_regulation',
  'reflection_learning',
  'belief_identity',
  'coherence',
];

export const MENTAL_SKILL_FAMILY_LABELS: Record<MentalSkillFamily, string> = {
  breathing_body_awareness: 'Breathing and body awareness',
  visualization: 'Visualization',
  attention_cues: 'Attention cues',
  self_talk_reframing: 'Self-talk and reframing',
  emotional_regulation: 'Emotional regulation',
  reflection_learning: 'Reflection and learning',
  belief_identity: 'Belief and identity',
  coherence: 'Coherence',
};

export const MENTAL_SKILL_STAGE_LABELS: Record<MentalSkillStage, string> = {
  discovering: 'Discovering',
  recognizing: 'Recognizing',
  choosing: 'Choosing',
  rehearsing: 'Rehearsing',
};

export interface MentalSkillFamiliarityLevel {
  id: MentalSkillFamiliarity;
  label: string;
  score: number;
}

export const MENTAL_SKILL_FAMILIARITY_LEVELS: MentalSkillFamiliarityLevel[] = [
  { id: 'new_to_me', label: 'I have not learned this yet', score: 15 },
  { id: 'heard_of_it', label: 'I have heard of this', score: 35 },
  { id: 'know_it', label: 'I understand the basic idea', score: 55 },
  { id: 'practiced_it', label: 'I have tried this in practice', score: 75 },
  { id: 'use_it', label: 'I use this on purpose', score: 95 },
];

export interface BaselineSetbackResponseProfile {
  id: string;
  label: string;
  beliefScore: number;
  selfTalkScore: number;
  reflectionScore: number;
}

export const BASELINE_SETBACK_RESPONSE_PROFILES: BaselineSetbackResponseProfile[] = [
  {
    id: 'belief_replay',
    label: 'I would keep going, but part of my attention would stay on what went wrong.',
    beliefScore: 78,
    selfTalkScore: 72,
    reflectionScore: 68,
  },
  {
    id: 'belief_compare',
    label: 'I would look at the other athletes to figure out whether I was falling behind.',
    beliefScore: 48,
    selfTalkScore: 42,
    reflectionScore: 38,
  },
  {
    id: 'belief_recover',
    label: 'I would return to my next action and review the setback after I finish.',
    beliefScore: 100,
    selfTalkScore: 100,
    reflectionScore: 95,
  },
  {
    id: 'belief_fixed',
    label: 'I would wonder whether this meant I was not ready for this level.',
    beliefScore: 18,
    selfTalkScore: 20,
    reflectionScore: 25,
  },
  {
    id: 'belief_overcorrect',
    label: 'I would change something immediately so I could make up for the setback.',
    beliefScore: 60,
    selfTalkScore: 55,
    reflectionScore: 48,
  },
  {
    id: 'belief_suppress',
    label: 'I would tell myself it did not matter and try to push the thought away.',
    beliefScore: 38,
    selfTalkScore: 35,
    reflectionScore: 20,
  },
];

export interface BaselineReflectionResponseProfile {
  id: string;
  label: string;
  reflectionScore: number;
  beliefScore: number;
}

export const BASELINE_REFLECTION_RESPONSE_PROFILES: BaselineReflectionResponseProfile[] = [
  {
    id: 'reflection_replay_everything',
    label: 'I would replay the whole performance and keep thinking about every mistake.',
    reflectionScore: 58,
    beliefScore: 52,
  },
  {
    id: 'reflection_specific_plan',
    label: 'I would name what happened, choose one part I can improve, and plan how to practice it.',
    reflectionScore: 100,
    beliefScore: 95,
  },
  {
    id: 'reflection_outside_control',
    label: 'I would focus mostly on the result, the judges, the opponent, or another part I could not control.',
    reflectionScore: 44,
    beliefScore: 48,
  },
  {
    id: 'reflection_ask_then_plan',
    label: 'I would ask a coach what they noticed, then choose one thing to work on next.',
    reflectionScore: 88,
    beliefScore: 84,
  },
  {
    id: 'reflection_avoid',
    label: 'I would avoid reviewing it and hope the next performance goes better.',
    reflectionScore: 28,
    beliefScore: 34,
  },
  {
    id: 'reflection_fixed',
    label: 'I would decide the result proves I am not talented enough for this level.',
    reflectionScore: 15,
    beliefScore: 18,
  },
];

export interface BaselineBodyAwarenessResponseProfile {
  id: string;
  label: string;
  bodyAwarenessScore: number;
  emotionalAwarenessScore: number;
}

export const BASELINE_BODY_AWARENESS_RESPONSE_PROFILES: BaselineBodyAwarenessResponseProfile[] = [
  { id: 'body_heart', label: 'My heart starts beating faster.', bodyAwarenessScore: 95, emotionalAwarenessScore: 90 },
  { id: 'body_breath', label: 'My breathing becomes faster or shallower.', bodyAwarenessScore: 95, emotionalAwarenessScore: 90 },
  { id: 'body_muscles', label: 'My muscles tighten.', bodyAwarenessScore: 92, emotionalAwarenessScore: 88 },
  { id: 'body_thoughts', label: 'My thoughts start moving faster.', bodyAwarenessScore: 90, emotionalAwarenessScore: 86 },
  {
    id: 'body_unsure_signal',
    label: 'I know I feel nervous, but I cannot tell which change happens first.',
    bodyAwarenessScore: 60,
    emotionalAwarenessScore: 68,
  },
  {
    id: 'body_notice_late',
    label: 'I usually notice the change after the performance has already started.',
    bodyAwarenessScore: 38,
    emotionalAwarenessScore: 46,
  },
  {
    id: 'body_do_not_notice',
    label: 'I usually do not notice a body change.',
    bodyAwarenessScore: 18,
    emotionalAwarenessScore: 24,
  },
];

export interface BaselineBreathPracticeResponseProfile {
  id: string;
  label: string;
  breathingScore: number;
  coherenceScore: number;
}

export const BASELINE_BREATH_PRACTICE_RESPONSE_PROFILES: BaselineBreathPracticeResponseProfile[] = [
  { id: 'breath_full_steady', label: 'I breathed in slowly and breathed out slowly.', breathingScore: 95, coherenceScore: 92 },
  { id: 'breath_brief_drift', label: 'I breathed in slowly, but I lost focus before I finished breathing out.', breathingScore: 82, coherenceScore: 78 },
  { id: 'breath_rushed', label: 'I breathed in and out, but both parts were faster than instructed.', breathingScore: 66, coherenceScore: 62 },
  { id: 'breath_pace_unsure', label: 'I completed both parts, but I was unsure how to breathe slowly.', breathingScore: 52, coherenceScore: 48 },
  { id: 'breath_restart', label: 'I stopped before I finished breathing in and breathing out.', breathingScore: 38, coherenceScore: 36 },
  { id: 'breath_not_yet', label: 'I did not complete the slow inhale and slow exhale.', breathingScore: 20, coherenceScore: 20 },
];

export interface BaselineAttentionResponseProfile {
  id: string;
  label: string;
  score: number;
}

export function baselineAttentionResponseProfiles(pack: BaselineSportPack): BaselineAttentionResponseProfile[] {
  return [
    { id: 'attention_split', label: `I would split my attention between ${pack.controllableCue.toLowerCase()} and the result.`, score: 78 },
    { id: 'attention_compare', label: pack.comparisonDistraction, score: 30 },
    { id: 'attention_control', label: pack.controllableCue, score: 100 },
    { id: 'attention_result_then_return', label: `I would think about the result first, then try to return to ${pack.controllableCue.toLowerCase()}.`, score: 66 },
    { id: 'attention_reassurance', label: 'I would look for a coach, teammate, or supporter to show me that I am doing okay.', score: 52 },
    { id: 'attention_result', label: pack.resultDistraction, score: 20 },
  ];
}

export interface BaselineSelfTalkResponseProfile {
  id: string;
  label: string;
  emotionalRegulationScore: number;
  selfTalkScore: number;
}

export function baselineSelfTalkResponseProfiles(pack: BaselineSportPack): BaselineSelfTalkResponseProfile[] {
  return [
    { id: 'emotion_positive_only', label: 'I am going to do great. Nothing will go wrong.', emotionalRegulationScore: 64, selfTalkScore: 60 },
    { id: 'emotion_useful', label: pack.usefulPhrase, emotionalRegulationScore: 100, selfTalkScore: 100 },
    { id: 'emotion_distract', label: 'I would try to think about something else so I do not notice the nerves.', emotionalRegulationScore: 48, selfTalkScore: 46 },
    { id: 'emotion_plan_with_nerves', label: 'I feel nervous, and I can still follow my plan.', emotionalRegulationScore: 88, selfTalkScore: 88 },
    { id: 'emotion_fight', label: 'I must make every nervous feeling disappear before I can perform.', emotionalRegulationScore: 30, selfTalkScore: 26 },
    { id: 'emotion_identity', label: 'Feeling nervous means I am not ready.', emotionalRegulationScore: 18, selfTalkScore: 18 },
  ];
}

export interface BaselineSportPack {
  setting: string;
  setbackPrompt: string;
  pressurePrompt: string;
  bodyPrompt: string;
  controllableCue: string;
  resultDistraction: string;
  comparisonDistraction: string;
  usefulPhrase: string;
  mentalRehearsalSteps: [string, string, string, string];
  reflectionPrompt: string;
}

const packs: Record<SportScenarioArchetype, BaselineSportPack> = {
  stage: {
    setting: 'backstage before prejudging',
    setbackPrompt: 'Your first callout is different from what you expected. Which thought is closest to what would go through your mind first?',
    pressurePrompt: 'Your class is being called and your heart starts beating faster.',
    bodyPrompt: 'What is the earliest body signal you would notice before walking onstage?',
    controllableCue: 'Posture, posing, transitions, and stage presence',
    resultDistraction: 'Trying to calculate your placing during callouts',
    comparisonDistraction: 'Watching another competitor and judging your own physique',
    usefulPhrase: 'I feel nervous. Stand tall and present my best look.',
    mentalRehearsalSteps: ['See the stage entrance', 'See the first callout', 'Picture one unexpected moment', 'See yourself adjust and finish every pose'],
    reflectionPrompt: 'After a show does not go as planned, what would you most likely do first when you review it?',
  },
  judged: {
    setting: 'before your routine begins',
    setbackPrompt: 'You make an early mistake in your routine. Which thought is closest to what would go through your mind first?',
    pressurePrompt: 'Your name is called and your heart starts beating faster.',
    bodyPrompt: 'What is the earliest body signal you would notice before your routine?',
    controllableCue: 'Your setup, technique, and next skill',
    resultDistraction: 'Trying to guess the judges’ score',
    comparisonDistraction: 'Comparing your routine with another athlete’s routine',
    usefulPhrase: 'I feel nervous. Breathe, set, and complete the next skill.',
    mentalRehearsalSteps: ['See the starting position', 'Picture the opening skill', 'Picture one mistake or delay', 'See yourself reset and finish the routine'],
    reflectionPrompt: 'After a routine does not go as planned, what would you most likely do first when you review it?',
  },
  invasion: {
    setting: 'before an important game',
    setbackPrompt: 'You make an early mistake that everyone sees. Which thought is closest to what would go through your mind first?',
    pressurePrompt: 'The score is close and your heart starts beating faster.',
    bodyPrompt: 'What is the earliest body signal you would notice before an important game?',
    controllableCue: 'Your assignment, spacing, and the next play',
    resultDistraction: 'Thinking about the final score before the game is over',
    comparisonDistraction: 'Watching an opponent and deciding they are better than you',
    usefulPhrase: 'I feel nervous. Breathe and make the next play.',
    mentalRehearsalSteps: ['See the opening play', 'Picture the game getting close', 'Picture one mistake or bad call', 'See yourself reset and make the next play'],
    reflectionPrompt: 'After a game does not go as planned, what would you most likely do first when you review it?',
  },
  net_racket: {
    setting: 'before an important match',
    setbackPrompt: 'You lose a point you expected to win. Which thought is closest to what would go through your mind first?',
    pressurePrompt: 'The next point matters and your heart starts beating faster.',
    bodyPrompt: 'What is the earliest body signal you would notice before an important match?',
    controllableCue: 'Your breath, ready position, and plan for the next point',
    resultDistraction: 'Thinking about the match result before it is finished',
    comparisonDistraction: 'Watching the opponent and deciding they cannot be beaten',
    usefulPhrase: 'I feel nervous. Breathe, get ready, and play this point.',
    mentalRehearsalSteps: ['See the first serve or receive', 'Picture a close point', 'Picture losing one point', 'See yourself reset and play the next point'],
    reflectionPrompt: 'After a match does not go as planned, what would you most likely do first when you review it?',
  },
  race: {
    setting: 'before an important race',
    setbackPrompt: 'Your start or early pace is different from your plan. Which thought is closest to what would go through your mind first?',
    pressurePrompt: 'You are called to the start and your heart starts beating faster.',
    bodyPrompt: 'What is the earliest body signal you would notice before an important race?',
    controllableCue: 'Your breathing, technique, and pace for the next section',
    resultDistraction: 'Thinking about your final time before you finish',
    comparisonDistraction: 'Watching another racer and abandoning your own plan',
    usefulPhrase: 'I feel nervous. Breathe, hold my form, and race this section.',
    mentalRehearsalSteps: ['See the start', 'Picture settling into pace', 'Picture one difficult section', 'See yourself respond and finish with strong form'],
    reflectionPrompt: 'After a race does not go as planned, what would you most likely do first when you review it?',
  },
  precision: {
    setting: 'before an important shot',
    setbackPrompt: 'Your last shot misses the target. Which thought is closest to what would go through your mind first?',
    pressurePrompt: 'You step up for the next shot and your heart starts beating faster.',
    bodyPrompt: 'What is the earliest body signal you would notice before an important shot?',
    controllableCue: 'Your setup, target, breathing, and routine',
    resultDistraction: 'Thinking about the final result before taking the shot',
    comparisonDistraction: 'Watching another athlete and changing your routine',
    usefulPhrase: 'I feel nervous. Breathe, see the target, and complete my routine.',
    mentalRehearsalSteps: ['See the setup', 'See the target clearly', 'Picture one distraction', 'See yourself return to the routine and take the shot'],
    reflectionPrompt: 'After a competition does not go as planned, what would you most likely do first when you review it?',
  },
  combat: {
    setting: 'before an important match',
    setbackPrompt: 'Your opponent scores first. Which thought is closest to what would go through your mind first?',
    pressurePrompt: 'You are called to compete and your heart starts beating faster.',
    bodyPrompt: 'What is the earliest body signal you would notice before an important match?',
    controllableCue: 'Your stance, breathing, distance, and next exchange',
    resultDistraction: 'Thinking about winning or losing during the exchange',
    comparisonDistraction: 'Looking at the opponent and deciding they are too strong',
    usefulPhrase: 'I feel nervous. Breathe, set my stance, and read the next exchange.',
    mentalRehearsalSteps: ['See the opening exchange', 'Picture the opponent scoring', 'Picture yourself returning to stance', 'See yourself follow the plan through the finish'],
    reflectionPrompt: 'After a match does not go as planned, what would you most likely do first when you review it?',
  },
  attempt: {
    setting: 'before an important attempt',
    setbackPrompt: 'Your first attempt does not go as planned. Which thought is closest to what would go through your mind first?',
    pressurePrompt: 'Your next attempt is called and your heart starts beating faster.',
    bodyPrompt: 'What is the earliest body signal you would notice before an important attempt?',
    controllableCue: 'Your setup, breathing, technique, and first movement',
    resultDistraction: 'Thinking about the final result before the attempt',
    comparisonDistraction: 'Watching another athlete and changing your plan',
    usefulPhrase: 'I feel nervous. Breathe, set up, and complete this attempt.',
    mentalRehearsalSteps: ['See the setup', 'Picture the first movement', 'Picture one difficult moment', 'See yourself adjust and finish the attempt'],
    reflectionPrompt: 'After an attempt does not go as planned, what would you most likely do first when you review it?',
  },
  general: {
    setting: 'before an important performance',
    setbackPrompt: 'The start does not go as planned. Which thought is closest to what would go through your mind first?',
    pressurePrompt: 'The performance is about to begin and your heart starts beating faster.',
    bodyPrompt: 'What is the earliest body signal you would notice before an important performance?',
    controllableCue: 'Your breathing, preparation, and next action',
    resultDistraction: 'Thinking about the result before the performance is finished',
    comparisonDistraction: 'Watching someone else and judging your own ability',
    usefulPhrase: 'I feel nervous. Breathe and complete the next action.',
    mentalRehearsalSteps: ['See the start', 'Picture the first action', 'Picture one difficult moment', 'See yourself adjust and finish'],
    reflectionPrompt: 'After a performance does not go as planned, what would you most likely do first when you review it?',
  },
};

export function baselineSportPack(archetype: SportScenarioArchetype): BaselineSportPack {
  return packs[archetype] || packs.general;
}

const familiarityScore = Object.fromEntries(
  MENTAL_SKILL_FAMILIARITY_LEVELS.map((level) => [level.id, level.score]),
) as Record<MentalSkillFamiliarity, number>;

const componentWeight: Record<MentalSkillEvidenceComponent, number> = {
  recognize: 25,
  understand: 20,
  choose: 20,
  rehearse: 15,
};

function clamp(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function scoreSequenceOrder<T extends string | number>(selected: T[], expected: T[]): number {
  if (selected.length !== expected.length || new Set(selected).size !== expected.length) return 0;
  if (expected.some((item) => !selected.includes(item))) return 0;

  let matchingPairs = 0;
  let pairCount = 0;
  for (let left = 0; left < expected.length; left += 1) {
    for (let right = left + 1; right < expected.length; right += 1) {
      pairCount += 1;
      if (selected.indexOf(expected[left]) < selected.indexOf(expected[right])) matchingPairs += 1;
    }
  }

  if (!pairCount) return 100;
  return clamp(30 + ((matchingPairs / pairCount) * 70));
}

export function stageForScore(score: number): MentalSkillStage {
  if (score < 35) return 'discovering';
  if (score < 55) return 'recognizing';
  if (score < 75) return 'choosing';
  return 'rehearsing';
}

export function scoreMentalSkillsBaseline(input: {
  completedAt?: number;
  source: string;
  sportName?: string;
  sportArchetype: SportScenarioArchetype;
  currentState: MentalSkillsCurrentState;
  familiarity: Record<MentalSkillFamily, MentalSkillFamiliarity>;
  evidence: MentalSkillEvidence[];
}): MentalSkillsBaselineRecord {
  const familyScores = {} as Record<MentalSkillFamily, MentalSkillFamilyScore>;

  for (const family of MENTAL_SKILL_FAMILIES) {
    const familyEvidence = input.evidence.filter((item) => item.family === family);
    const componentValues: Partial<Record<MentalSkillEvidenceComponent, number>> = {};
    for (const component of Object.keys(componentWeight) as MentalSkillEvidenceComponent[]) {
      const values = familyEvidence.filter((item) => item.component === component).map((item) => clamp(item.score));
      if (values.length) componentValues[component] = values.reduce((sum, value) => sum + value, 0) / values.length;
    }

    let evidenceTotal = 0;
    let evidenceWeight = 0;
    for (const [component, weight] of Object.entries(componentWeight) as Array<[MentalSkillEvidenceComponent, number]>) {
      const value = componentValues[component];
      if (typeof value === 'number') {
        evidenceTotal += value * weight;
        evidenceWeight += weight;
      }
    }

    const familiarity = familiarityScore[input.familiarity[family]];
    const demonstrated = evidenceWeight > 0 ? evidenceTotal / evidenceWeight : familiarity;
    const score = clamp((familiarity * 0.2) + (demonstrated * 0.8));
    familyScores[family] = {
      familiarity,
      ...componentValues,
      score,
      stage: stageForScore(score),
    };
  }

  const sorted = [...MENTAL_SKILL_FAMILIES].sort((left, right) => familyScores[right].score - familyScores[left].score);
  const lowest = (families: MentalSkillFamily[]) => [...families].sort((left, right) => familyScores[left].score - familyScores[right].score)[0];
  const disciplineFocus = {
    championMindset: lowest(['belief_identity', 'self_talk_reframing', 'reflection_learning']),
    mentalPerformance: lowest(['visualization', 'attention_cues']),
    emotionalRegulation: lowest(['breathing_body_awareness', 'emotional_regulation', 'coherence']),
  };
  const startingFocus = Array.from(new Set(Object.values(disciplineFocus)));
  const overallCompetencyScore = clamp(
    MENTAL_SKILL_FAMILIES.reduce((sum, family) => sum + familyScores[family].score, 0) / MENTAL_SKILL_FAMILIES.length,
  );

  return {
    version: MENTAL_SKILLS_BASELINE_VERSION,
    completedAt: input.completedAt ?? Date.now(),
    source: input.source,
    sportName: input.sportName?.trim() || undefined,
    sportArchetype: input.sportArchetype,
    currentState: input.currentState,
    familiarity: input.familiarity,
    familyScores,
    overallCompetencyScore,
    beliefScore: familyScores.belief_identity.score,
    coherenceKnowledgeScore: familyScores.coherence.score,
    strengths: sorted.slice(0, 3),
    startingFocus,
    disciplineFocus,
    evidence: input.evidence.map((item) => ({ ...item, score: clamp(item.score) })),
  };
}
