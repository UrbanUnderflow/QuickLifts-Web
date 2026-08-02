import type { SportScenarioArchetype } from './types';

export const MENTAL_SKILLS_BASELINE_VERSION = 3;

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
export type MentalSkillFamiliarity = 'new_to_me' | 'know_it' | 'practiced_it';
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
    setbackPrompt: 'Your first callout is different from what you expected. What thought helps you keep presenting your best look?',
    pressurePrompt: 'Your class is being called and your heart starts beating faster.',
    bodyPrompt: 'What is the earliest body signal you would notice before walking onstage?',
    controllableCue: 'Posture, posing, transitions, and stage presence',
    resultDistraction: 'Trying to calculate your placing during callouts',
    comparisonDistraction: 'Watching another competitor and judging your own physique',
    usefulPhrase: 'I feel nervous. Stand tall and present my best look.',
    mentalRehearsalSteps: ['See the stage entrance', 'See the first callout', 'Picture one unexpected moment', 'See yourself adjust and finish every pose'],
    reflectionPrompt: 'After a show does not go as planned, which review helps you improve?',
  },
  judged: {
    setting: 'before your routine begins',
    setbackPrompt: 'You make an early mistake in your routine. What thought helps you continue the next skill?',
    pressurePrompt: 'Your name is called and your heart starts beating faster.',
    bodyPrompt: 'What is the earliest body signal you would notice before your routine?',
    controllableCue: 'Your setup, technique, and next skill',
    resultDistraction: 'Trying to guess the judges’ score',
    comparisonDistraction: 'Comparing your routine with another athlete’s routine',
    usefulPhrase: 'I feel nervous. Breathe, set, and complete the next skill.',
    mentalRehearsalSteps: ['See the starting position', 'Picture the opening skill', 'Picture one mistake or delay', 'See yourself reset and finish the routine'],
    reflectionPrompt: 'After a routine does not go as planned, which review helps you improve?',
  },
  invasion: {
    setting: 'before an important game',
    setbackPrompt: 'You make an early mistake that everyone sees. What thought helps you make the next play?',
    pressurePrompt: 'The score is close and your heart starts beating faster.',
    bodyPrompt: 'What is the earliest body signal you would notice before an important game?',
    controllableCue: 'Your assignment, spacing, and the next play',
    resultDistraction: 'Thinking about the final score before the game is over',
    comparisonDistraction: 'Watching an opponent and deciding they are better than you',
    usefulPhrase: 'I feel nervous. Breathe and make the next play.',
    mentalRehearsalSteps: ['See the opening play', 'Picture the game getting close', 'Picture one mistake or bad call', 'See yourself reset and make the next play'],
    reflectionPrompt: 'After a game does not go as planned, which review helps you improve?',
  },
  net_racket: {
    setting: 'before an important match',
    setbackPrompt: 'You lose a point you expected to win. What thought helps you prepare for the next point?',
    pressurePrompt: 'The next point matters and your heart starts beating faster.',
    bodyPrompt: 'What is the earliest body signal you would notice before an important match?',
    controllableCue: 'Your breath, ready position, and plan for the next point',
    resultDistraction: 'Thinking about the match result before it is finished',
    comparisonDistraction: 'Watching the opponent and deciding they cannot be beaten',
    usefulPhrase: 'I feel nervous. Breathe, get ready, and play this point.',
    mentalRehearsalSteps: ['See the first serve or receive', 'Picture a close point', 'Picture losing one point', 'See yourself reset and play the next point'],
    reflectionPrompt: 'After a match does not go as planned, which review helps you improve?',
  },
  race: {
    setting: 'before an important race',
    setbackPrompt: 'Your start or early pace is different from your plan. What thought helps you race the next section?',
    pressurePrompt: 'You are called to the start and your heart starts beating faster.',
    bodyPrompt: 'What is the earliest body signal you would notice before an important race?',
    controllableCue: 'Your breathing, technique, and pace for the next section',
    resultDistraction: 'Thinking about your final time before you finish',
    comparisonDistraction: 'Watching another racer and abandoning your own plan',
    usefulPhrase: 'I feel nervous. Breathe, hold my form, and race this section.',
    mentalRehearsalSteps: ['See the start', 'Picture settling into pace', 'Picture one difficult section', 'See yourself respond and finish with strong form'],
    reflectionPrompt: 'After a race does not go as planned, which review helps you improve?',
  },
  precision: {
    setting: 'before an important shot',
    setbackPrompt: 'Your last shot misses the target. What thought helps you prepare for the next shot?',
    pressurePrompt: 'You step up for the next shot and your heart starts beating faster.',
    bodyPrompt: 'What is the earliest body signal you would notice before an important shot?',
    controllableCue: 'Your setup, target, breathing, and routine',
    resultDistraction: 'Thinking about the final result before taking the shot',
    comparisonDistraction: 'Watching another athlete and changing your routine',
    usefulPhrase: 'I feel nervous. Breathe, see the target, and complete my routine.',
    mentalRehearsalSteps: ['See the setup', 'See the target clearly', 'Picture one distraction', 'See yourself return to the routine and take the shot'],
    reflectionPrompt: 'After a competition does not go as planned, which review helps you improve?',
  },
  combat: {
    setting: 'before an important match',
    setbackPrompt: 'Your opponent scores first. What thought helps you return to your plan?',
    pressurePrompt: 'You are called to compete and your heart starts beating faster.',
    bodyPrompt: 'What is the earliest body signal you would notice before an important match?',
    controllableCue: 'Your stance, breathing, distance, and next exchange',
    resultDistraction: 'Thinking about winning or losing during the exchange',
    comparisonDistraction: 'Looking at the opponent and deciding they are too strong',
    usefulPhrase: 'I feel nervous. Breathe, set my stance, and read the next exchange.',
    mentalRehearsalSteps: ['See the opening exchange', 'Picture the opponent scoring', 'Picture yourself returning to stance', 'See yourself follow the plan through the finish'],
    reflectionPrompt: 'After a match does not go as planned, which review helps you improve?',
  },
  attempt: {
    setting: 'before an important attempt',
    setbackPrompt: 'Your first attempt does not go as planned. What thought helps you prepare for the next attempt?',
    pressurePrompt: 'Your next attempt is called and your heart starts beating faster.',
    bodyPrompt: 'What is the earliest body signal you would notice before an important attempt?',
    controllableCue: 'Your setup, breathing, technique, and first movement',
    resultDistraction: 'Thinking about the final result before the attempt',
    comparisonDistraction: 'Watching another athlete and changing your plan',
    usefulPhrase: 'I feel nervous. Breathe, set up, and complete this attempt.',
    mentalRehearsalSteps: ['See the setup', 'Picture the first movement', 'Picture one difficult moment', 'See yourself adjust and finish the attempt'],
    reflectionPrompt: 'After an attempt does not go as planned, which review helps you improve?',
  },
  general: {
    setting: 'before an important performance',
    setbackPrompt: 'The start does not go as planned. What thought helps you return to what you can control?',
    pressurePrompt: 'The performance is about to begin and your heart starts beating faster.',
    bodyPrompt: 'What is the earliest body signal you would notice before an important performance?',
    controllableCue: 'Your breathing, preparation, and next action',
    resultDistraction: 'Thinking about the result before the performance is finished',
    comparisonDistraction: 'Watching someone else and judging your own ability',
    usefulPhrase: 'I feel nervous. Breathe and complete the next action.',
    mentalRehearsalSteps: ['See the start', 'Picture the first action', 'Picture one difficult moment', 'See yourself adjust and finish'],
    reflectionPrompt: 'After a performance does not go as planned, which review helps you improve?',
  },
};

export function baselineSportPack(archetype: SportScenarioArchetype): BaselineSportPack {
  return packs[archetype] || packs.general;
}

const familiarityScore: Record<MentalSkillFamiliarity, number> = {
  new_to_me: 20,
  know_it: 55,
  practiced_it: 85,
};

const componentWeight: Record<MentalSkillEvidenceComponent, number> = {
  recognize: 25,
  understand: 20,
  choose: 20,
  rehearse: 15,
};

function clamp(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
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
