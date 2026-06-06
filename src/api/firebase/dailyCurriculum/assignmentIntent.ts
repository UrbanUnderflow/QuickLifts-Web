import { TaxonomyPillar } from '../mentaltraining/taxonomy';
import type {
  CurriculumAssignmentArtifactKind,
  CurriculumAssignmentIntent,
  ProgressionLevel,
} from './types';

const PILLAR_LABELS: Record<TaxonomyPillar, string> = {
  [TaxonomyPillar.Composure]: 'Composure',
  [TaxonomyPillar.Focus]: 'Focus',
  [TaxonomyPillar.Decision]: 'Decision control',
};

const DEFAULT_WINDOW_DAYS = 30;
const DEFAULT_STEADY_SESSION_THRESHOLD = 3;

const clampPositiveInt = (value: number, fallback: number): number => {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(1, Math.round(value));
};

const articleFor = (kind: CurriculumAssignmentArtifactKind): string =>
  kind === 'protocol' ? 'protocol' : 'simulation';

const focusNameFor = (
  drivingPillar: TaxonomyPillar,
  progressionLevel: ProgressionLevel,
): string => `${PILLAR_LABELS[drivingPillar]} ${progressionLevel} plan`;

const nextStepFor = (
  kind: CurriculumAssignmentArtifactKind,
  drivingPillar: TaxonomyPillar,
): string =>
  kind === 'protocol'
    ? `Nora will either keep this reset in place or move you to the next ${PILLAR_LABELS[drivingPillar].toLowerCase()} protocol.`
    : `Nora will either progress the pressure or move you to the next ${PILLAR_LABELS[drivingPillar].toLowerCase()} simulation.`;

export interface BuildCurriculumAssignmentIntentInput {
  kind: CurriculumAssignmentArtifactKind;
  assetLabel: string;
  drivingPillar: TaxonomyPillar;
  cognitivePillar: TaxonomyPillar;
  progressionLevel: ProgressionLevel;
  actualReps: number;
  recommendedFrequency: number;
  pairedAssignmentLabel?: string;
  windowDays?: number;
  steadySessionThreshold?: number;
}

export const buildCurriculumAssignmentIntent = ({
  kind,
  assetLabel,
  drivingPillar,
  cognitivePillar,
  progressionLevel,
  actualReps,
  recommendedFrequency,
  pairedAssignmentLabel,
  windowDays = DEFAULT_WINDOW_DAYS,
  steadySessionThreshold = DEFAULT_STEADY_SESSION_THRESHOLD,
}: BuildCurriculumAssignmentIntentInput): CurriculumAssignmentIntent => {
  const targetReps = clampPositiveInt(recommendedFrequency, 1);
  const completedReps = Math.max(0, Math.floor(Number.isFinite(actualReps) ? actualReps : 0));
  const currentRep = Math.min(targetReps, completedReps + 1);
  const pillarLabel = PILLAR_LABELS[drivingPillar];
  const artifactName = assetLabel.trim() || (kind === 'protocol' ? 'today\'s protocol' : 'today\'s simulation');
  const artifactKindLabel = articleFor(kind);
  const repetitionIntentional = completedReps > 0;
  const badgeLabel = repetitionIntentional ? 'Same by design' : 'Planned practice';
  const sequenceLabel = `Practice ${currentRep} of ${targetReps}`;
  const progressLabel = `${sequenceLabel} in this ${windowDays}-day window`;
  const repeatSentence = repetitionIntentional
    ? `You have seen ${artifactName} before because daily familiarity is the point, not random assignment.`
    : `This starts a planned ${artifactKindLabel} exposure in your current training window.`;
  const pairedSentence = pairedAssignmentLabel
    ? ` It is paired with ${pairedAssignmentLabel} so the reset and pressure work train the same focus.`
    : '';

  return {
    version: 'v1',
    source: 'curriculum-engine',
    artifactKind: kind,
    focusName: focusNameFor(drivingPillar, progressionLevel),
    badgeLabel,
    repetitionIntentional,
    whyThisToday: `${artifactName} is queued because ${pillarLabel.toLowerCase()} has the biggest practice gap in your recent work. ${repeatSentence}${pairedSentence}`,
    sequenceLabel,
    progressLabel,
    currentRep,
    targetReps,
    windowDays,
    progressionCriteria: `Move forward after ${targetReps} planned practices in this window or ${steadySessionThreshold} steady completions in a row.`,
    reassessmentLabel: `Nora reassesses this ${artifactKindLabel} after each completion and at the end of the ${windowDays}-day window.`,
    nextLikelyStep: nextStepFor(kind, drivingPillar),
    drivingPillar,
    cognitivePillar,
    pairedAssignmentLabel,
  };
};
