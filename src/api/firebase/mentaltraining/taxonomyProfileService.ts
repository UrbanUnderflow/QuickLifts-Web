import type { BaselineAssessment, MentalCheckIn } from './types';
import { BiggestChallenge } from './types';
import {
  clampScore,
  computePillarScores,
  createEmptyModifierScores,
  createEmptySkillScores,
  DurationMode,
  getSimSpec,
  PressureType,
  ProgramPrescription,
  rankSkills,
  scoreToLabel,
  SessionType,
  SimSessionRecord,
  TaxonomyModifier,
  TaxonomyProfile,
  TaxonomySkill,
  TaxonomyCheckInState,
} from './taxonomy';

function humanizeTaxonomyLabel(value: string): string {
  return value.split('_').join(' ');
}

function baselineRatingToScore(rating: number): number {
  return clampScore(30 + rating * 12);
}

function average(values: number[], fallback = 50): number {
  if (!values.length) return fallback;
  return clampScore(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function averageFromSessions(sessions: SimSessionRecord[], key: string, fallback = 50): number {
  const values = sessions
    .map((session) => session.supportingMetrics[key])
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  return average(values, fallback);
}

function createTrendSummary(profile: TaxonomyProfile): string[] {
  const strongest = profile.strongestSkills[0];
  const weakest = profile.weakestSkills[0];
  const pressure = Object.entries(profile.pressureSensitivity)
    .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))[0];

  const summary: string[] = [];
  if (strongest) {
    summary.push(`${humanizeTaxonomyLabel(strongest)} is currently a ${scoreToLabel(profile.skillScores[strongest])} skill.`);
  }
  if (weakest) {
    summary.push(`${humanizeTaxonomyLabel(weakest)} is the current bottleneck in the program.`);
  }
  if (pressure?.[0]) {
    summary.push(`${humanizeTaxonomyLabel(pressure[0])} is the most disruptive pressure channel right now.`);
  }
  return summary;
}

export function buildTaxonomyCheckInState(input: {
  readinessScore: number;
  energyLevel?: number;
  stressLevel?: number;
  sleepQuality?: number;
  moodWord?: string;
  priorProfile?: TaxonomyProfile | null;
}): TaxonomyCheckInState {
  const readiness = clampScore(input.readinessScore * 20);
  const energy = typeof input.energyLevel === 'number' ? clampScore(input.energyLevel * 20) : readiness;
  const stressPenalty = typeof input.stressLevel === 'number' ? input.stressLevel * 8 : 16;
  const sleepSupport = typeof input.sleepQuality === 'number' ? input.sleepQuality * 8 : 20;
  const priorSensitivity = input.priorProfile?.pressureSensitivity ?? {};

  const modifierScores = {
    [TaxonomyModifier.Readiness]: readiness,
    [TaxonomyModifier.Fatigability]: clampScore((energy + sleepSupport) / 2),
    [TaxonomyModifier.Consistency]: clampScore(input.priorProfile?.modifierScores[TaxonomyModifier.Consistency] ?? 50),
    [TaxonomyModifier.PressureSensitivity]: clampScore(100 - stressPenalty),
  };

  const likelyPressureSensitivity = Object.entries(priorSensitivity)
    .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
    .slice(0, 2)
    .map(([pressure]) => pressure as PressureType);

  const recommendedSessionType =
    readiness < 45 ? SessionType.RecoveryRep :
    readiness < 60 ? SessionType.Probe :
    SessionType.TrainingRep;

  const recommendedDurationMode =
    readiness < 45 ? DurationMode.QuickProbe :
    readiness < 65 ? DurationMode.StandardRep :
    DurationMode.StandardRep;

  return {
    readinessScore: readiness,
    energyLevel: input.energyLevel,
    stressLevel: input.stressLevel,
    sleepQuality: input.sleepQuality,
    moodWord: input.moodWord,
    modifierScores,
    likelyPressureSensitivity,
    recommendedSessionType,
    recommendedDurationMode,
    generatedAt: Date.now(),
  };
}

export function bootstrapTaxonomyProfile(
  assessment?: BaselineAssessment | null
): TaxonomyProfile {
  const skillScores = createEmptySkillScores();
  const modifierScores = createEmptyModifierScores();

  if (assessment) {
    const focus = baselineRatingToScore(assessment.focusRating);
    const confidence = baselineRatingToScore(assessment.confidenceRating);
    const resilience = baselineRatingToScore(assessment.resilienceRating);
    const arousal = baselineRatingToScore(assessment.arousalControlRating);

    skillScores[TaxonomySkill.SustainedAttention] = focus;
    skillScores[TaxonomySkill.SelectiveAttention] = focus;
    skillScores[TaxonomySkill.AttentionalShifting] = clampScore((focus + resilience) / 2);
    skillScores[TaxonomySkill.ErrorRecoverySpeed] = resilience;
    skillScores[TaxonomySkill.EmotionalInterferenceControl] = clampScore((arousal + confidence) / 2);
    skillScores[TaxonomySkill.PressureStability] = clampScore((confidence + resilience + arousal) / 3);
    skillScores[TaxonomySkill.ResponseInhibition] = clampScore((focus + arousal) / 2);
    skillScores[TaxonomySkill.WorkingMemoryUpdating] = clampScore((focus + confidence) / 2);
    skillScores[TaxonomySkill.CueDiscrimination] = focus;

    if (assessment.biggestChallenge === BiggestChallenge.BouncingBackFromSetbacks) {
      skillScores[TaxonomySkill.ErrorRecoverySpeed] = clampScore(skillScores[TaxonomySkill.ErrorRecoverySpeed] - 10);
    }
    if (assessment.biggestChallenge === BiggestChallenge.PerformingUnderPressure) {
      skillScores[TaxonomySkill.PressureStability] = clampScore(skillScores[TaxonomySkill.PressureStability] - 10);
    }
    if (assessment.biggestChallenge === BiggestChallenge.FocusDuringCompetition) {
      skillScores[TaxonomySkill.SelectiveAttention] = clampScore(skillScores[TaxonomySkill.SelectiveAttention] - 10);
      skillScores[TaxonomySkill.SustainedAttention] = clampScore(skillScores[TaxonomySkill.SustainedAttention] - 8);
    }

    modifierScores[TaxonomyModifier.Readiness] =
      assessment.currentPracticeFrequency === 'daily' ? 68 :
      assessment.currentPracticeFrequency === 'weekly' ? 60 :
      48;
    modifierScores[TaxonomyModifier.Fatigability] = clampScore((focus + arousal) / 2);
    modifierScores[TaxonomyModifier.Consistency] =
      assessment.pressureResponse === 'same_as_training' || assessment.pressureResponse === 'rise_to_occasion'
        ? 64
        : 48;
    modifierScores[TaxonomyModifier.PressureSensitivity] =
      assessment.pressureResponse === 'freeze_perform_worse' ? 35 :
      assessment.pressureResponse === 'anxious_push_through' ? 48 :
      65;
  }

  const pillarScores = computePillarScores(skillScores);
  const overallScore = clampScore(
    (Object.values(pillarScores).reduce((sum, value) => sum + value, 0) +
      Object.values(modifierScores).reduce((sum, value) => sum + value, 0)) /
      (Object.keys(pillarScores).length + Object.keys(modifierScores).length)
  );

  const profile: TaxonomyProfile = {
    overallScore,
    pillarScores,
    skillScores,
    modifierScores,
    pressureSensitivity: {},
    strongestSkills: rankSkills(skillScores, 'desc').slice(0, 3),
    weakestSkills: rankSkills(skillScores, 'asc').slice(0, 3),
    trendSummary: [],
    updatedAt: Date.now(),
  };

  profile.trendSummary = createTrendSummary(profile);
  return profile;
}

export function deriveTaxonomyProfile(input: {
  baselineAssessment?: BaselineAssessment | null;
  checkIns?: MentalCheckIn[];
  simSessions?: SimSessionRecord[];
}): TaxonomyProfile {
  const profile = bootstrapTaxonomyProfile(input.baselineAssessment);
  const simSessions = input.simSessions ?? [];
  const checkIns = input.checkIns ?? [];

  for (const session of simSessions) {
    const contribution = clampScore((session.normalizedScore - 50) * 0.2, -20, 20);
    for (const skill of session.targetSkills) {
      profile.skillScores[skill] = clampScore(profile.skillScores[skill] + contribution);
    }

    const consistencyIndex = session.supportingMetrics.consistency_index ?? session.supportingMetrics.consistencyIndex;
    if (typeof consistencyIndex === 'number') {
      profile.modifierScores[TaxonomyModifier.Consistency] = clampScore(
        average([profile.modifierScores[TaxonomyModifier.Consistency], 100 - consistencyIndex * 40])
      );
    }

    const degradation = session.supportingMetrics.degradation_slope_over_time ?? session.supportingMetrics.degradationSlope;
    if (typeof degradation === 'number') {
      profile.modifierScores[TaxonomyModifier.Fatigability] = clampScore(
        average([profile.modifierScores[TaxonomyModifier.Fatigability], 100 - degradation * 30])
      );
    }

    for (const pressureType of session.pressureTypes) {
      const current = profile.pressureSensitivity[pressureType] ?? 0;
      profile.pressureSensitivity[pressureType] = clampScore(
        average([current, 100 - session.normalizedScore], current || 40)
      );
    }
  }

  profile.modifierScores[TaxonomyModifier.Readiness] = average(
    checkIns.map((checkIn) => checkIn.taxonomyState?.readinessScore ?? checkIn.readinessScore * 20),
    profile.modifierScores[TaxonomyModifier.Readiness]
  );

  profile.modifierScores[TaxonomyModifier.PressureSensitivity] = average(
    Object.values(profile.pressureSensitivity).filter((value): value is number => typeof value === 'number'),
    profile.modifierScores[TaxonomyModifier.PressureSensitivity]
  );

  profile.modifierScores[TaxonomyModifier.Consistency] = average(
    [
      profile.modifierScores[TaxonomyModifier.Consistency],
      averageFromSessions(simSessions, 'consistencyIndex', profile.modifierScores[TaxonomyModifier.Consistency]),
    ]
  );

  profile.pillarScores = computePillarScores(profile.skillScores);
  profile.overallScore = clampScore(
    (Object.values(profile.pillarScores).reduce((sum, value) => sum + value, 0) * 0.7 +
      Object.values(profile.modifierScores).reduce((sum, value) => sum + value, 0) * 0.3) /
      (Object.keys(profile.pillarScores).length * 0.7 + Object.keys(profile.modifierScores).length * 0.3)
  );
  profile.strongestSkills = rankSkills(profile.skillScores, 'desc').slice(0, 3);
  profile.weakestSkills = rankSkills(profile.skillScores, 'asc').slice(0, 3);
  profile.updatedAt = Date.now();
  profile.trendSummary = createTrendSummary(profile);

  return profile;
}

export function prescribeNextSession(input: {
  profile: TaxonomyProfile;
  checkInState?: TaxonomyCheckInState | null;
}): ProgramPrescription {
  const { profile, checkInState } = input;
  const weakestSkill = profile.weakestSkills[0] ?? TaxonomySkill.ErrorRecoverySpeed;
  const readiness = checkInState?.readinessScore ?? profile.modifierScores[TaxonomyModifier.Readiness];
  const weakestModifier = [...Object.entries(profile.modifierScores)].sort((a, b) => a[1] - b[1])[0]?.[0] as TaxonomyModifier | undefined;

  const skillToSim: Record<TaxonomySkill, string> = {
    [TaxonomySkill.SustainedAttention]: 'endurance_lock',
    [TaxonomySkill.SelectiveAttention]: 'noise_gate',
    [TaxonomySkill.AttentionalShifting]: 'reset',
    [TaxonomySkill.ErrorRecoverySpeed]: 'reset',
    [TaxonomySkill.EmotionalInterferenceControl]: 'reset',
    [TaxonomySkill.PressureStability]: 'reset',
    [TaxonomySkill.ResponseInhibition]: 'brake_point',
    [TaxonomySkill.WorkingMemoryUpdating]: 'sequence_shift',
    [TaxonomySkill.CueDiscrimination]: 'signal_window',
  };

  let recommendedSimId = skillToSim[weakestSkill];
  if (weakestModifier === TaxonomyModifier.Fatigability) {
    recommendedSimId = 'endurance_lock';
  }

  const sim = getSimSpec(recommendedSimId)!;
  const sessionType =
    readiness < 45 ? SessionType.RecoveryRep :
    readiness < 60 ? SessionType.Probe :
    weakestModifier === TaxonomyModifier.Consistency ? SessionType.Reassessment :
    SessionType.TrainingRep;

  const durationMode =
    sessionType === SessionType.RecoveryRep ? DurationMode.QuickProbe :
    weakestModifier === TaxonomyModifier.Fatigability ? DurationMode.ExtendedStressTest :
    checkInState?.recommendedDurationMode ?? DurationMode.StandardRep;

  return {
    recommendedSimId,
    recommendedLegacyExerciseId: sim.legacyExerciseId,
    sessionType,
    durationMode,
    durationSeconds: sim.recommendedDurations[durationMode],
    rationale:
      sessionType === SessionType.RecoveryRep
        ? `Today reads as a lower-readiness day, so Nora should use ${sim.name} as a lighter rep that still measures the bottleneck.`
        : `The current bottleneck is ${humanizeTaxonomyLabel(weakestSkill)}, so Nora should prescribe ${sim.name} next.`,
    targetSkills: sim.targetSkills,
    targetPressureTypes: sim.pressureTypes,
    generatedAt: Date.now(),
  };
}

export function calculateTransferGap(trainingScore: number, trialScore: number): number {
  return clampScore(trainingScore - trialScore, 0, 100);
}
