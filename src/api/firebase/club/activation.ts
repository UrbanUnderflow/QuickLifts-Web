import {
  ClubActivationQuestionDefinition,
  ClubActivationResponse,
} from './types';

export const SYSTEM_ACTIVATION_QUESTIONS: ClubActivationQuestionDefinition[] = [
  new ClubActivationQuestionDefinition({
    id: 'fitness_level',
    title: 'Fitness level',
    description: 'Match members by pace, confidence, and training expectations.',
    type: 'single_select',
    options: [
      { id: 'beginner', label: 'Beginner' },
      { id: 'intermediate', label: 'Intermediate' },
      { id: 'advanced', label: 'Advanced' },
    ],
  }),
  new ClubActivationQuestionDefinition({
    id: 'primary_goal',
    title: 'Primary goal',
    description: 'Understand what each member is trying to achieve right now.',
    type: 'single_select',
    options: [
      { id: 'consistency', label: 'Stay consistent' },
      { id: 'performance', label: 'Improve performance' },
      { id: 'strength', label: 'Build strength' },
      { id: 'fat_loss', label: 'Lose fat' },
      { id: 'endurance', label: 'Build endurance' },
      { id: 'community', label: 'Find community' },
    ],
  }),
  new ClubActivationQuestionDefinition({
    id: 'preferred_workout_type',
    title: 'Preferred workout type',
    description: 'Useful for clubs with multiple workout styles or formats.',
    type: 'single_select',
    options: [
      { id: 'run', label: 'Running' },
      { id: 'strength', label: 'Strength' },
      { id: 'hiit', label: 'HIIT' },
      { id: 'mobility', label: 'Mobility' },
      { id: 'mixed', label: 'A mix of everything' },
    ],
  }),
  new ClubActivationQuestionDefinition({
    id: 'weekly_availability',
    title: 'Weekly availability',
    description: 'Most important scheduling signal for accountability pairing.',
    type: 'multi_select',
    options: [
      { id: 'weekday_mornings', label: 'Weekday mornings' },
      { id: 'weekday_lunch', label: 'Weekday lunch' },
      { id: 'weekday_evenings', label: 'Weekday evenings' },
      { id: 'saturday', label: 'Saturday' },
      { id: 'sunday', label: 'Sunday' },
    ],
  }),
  new ClubActivationQuestionDefinition({
    id: 'location_neighborhood',
    title: 'Location / neighborhood',
    description: 'Supports local clubs that meet up in person.',
    type: 'short_text',
    placeholder: 'Ex. Midtown Atlanta, West Loop, Venice',
  }),
  new ClubActivationQuestionDefinition({
    id: 'accountability_style',
    title: 'Accountability style',
    description: 'Helps hosts suggest partners with compatible communication styles.',
    type: 'single_select',
    options: [
      { id: 'gentle', label: 'Gentle encouragement' },
      { id: 'direct', label: 'Direct check-ins' },
      { id: 'structured', label: 'Structured accountability' },
      { id: 'flexible', label: 'Flexible / low pressure' },
    ],
  }),
];

export const SYSTEM_ACTIVATION_QUESTION_MAP = SYSTEM_ACTIVATION_QUESTIONS.reduce<
  Record<string, ClubActivationQuestionDefinition>
>((accumulator, question) => {
  accumulator[question.id] = question;
  return accumulator;
}, {});

export const getClubActivationQuestionsByIds = (
  questionIds: string[]
): ClubActivationQuestionDefinition[] =>
  questionIds
    .map((questionId) => SYSTEM_ACTIVATION_QUESTION_MAP[questionId])
    .filter((question): question is ClubActivationQuestionDefinition => Boolean(question));

export const isClubActivationResponseComplete = (
  question: ClubActivationQuestionDefinition,
  response?: ClubActivationResponse | null
): boolean => {
  if (!response) {
    return false;
  }

  if (question.type === 'short_text') {
    return Boolean(response.textValue?.trim());
  }

  return response.selectedOptionIds.length > 0;
};
