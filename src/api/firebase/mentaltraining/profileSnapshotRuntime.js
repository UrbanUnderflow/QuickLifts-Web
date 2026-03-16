const PROFILE_VERSION = 'taxonomy-v1';
const SNAPSHOT_WRITER_VERSION = 'profile-snapshot-writer-v1';

const BIGGEST_CHALLENGE = {
  PRE_COMPETITION_ANXIETY: 'pre_competition_anxiety',
  FOCUS_DURING_COMPETITION: 'focus_during_competition',
  BOUNCING_BACK_FROM_SETBACKS: 'bouncing_back_from_setbacks',
  PERFORMING_UNDER_PRESSURE: 'performing_under_pressure',
};

const PRESSURE_TYPE = {
  VISUAL: 'visual_distraction',
  EVALUATIVE: 'evaluative_threat',
  UNCERTAINTY: 'uncertainty',
  COMPOUNDING_ERROR: 'compounding_error',
};

const TAXONOMY_PILLARS = ['focus', 'composure', 'decision'];
const TAXONOMY_SKILLS = [
  'sustained_attention',
  'selective_attention',
  'attentional_shifting',
  'error_recovery_speed',
  'emotional_interference_control',
  'pressure_stability',
  'response_inhibition',
  'working_memory_updating',
  'cue_discrimination',
];
const TAXONOMY_MODIFIERS = ['readiness', 'fatigability', 'consistency', 'pressure_sensitivity'];

const PROFILE_EXPLANATION_TEMPLATES = {
  emphasis_growth_v1: (slots) =>
    `${slots.currentEmphasis} is active because ${slots.growthArea} is the clearest way to improve against ${slots.pressurePattern}.`,
  emphasis_milestone_v1: (slots) =>
    `Nora is prioritizing ${slots.currentEmphasis} next so you can ${slots.growthGoal} before ${slots.nextMilestone}.`,
  emphasis_dual_v1: (slots) =>
    `${slots.currentEmphasis} is active because ${slots.growthArea} is the clearest lever right now. Nora is training it next so you can ${slots.growthGoal} before ${slots.nextMilestone}.`,
};

const BANNED_NARRATIVE_PATTERNS = [
  /\bdiagnos/i,
  /\bclinical\b/i,
  /\bdisorder\b/i,
  /\bdepress/i,
  /\bpanic\b/i,
  /\btrauma\b/i,
  /\bmental health\b/i,
  /\btherap/i,
  /\banxiety disorder\b/i,
];

const SIM_REGISTRY = {
  reset: {
    id: 'reset',
    name: 'Reset',
    legacyExerciseId: 'focus-3-second-reset',
    targetSkills: ['error_recovery_speed', 'attentional_shifting', 'pressure_stability'],
    pressureTypes: ['evaluative_threat', 'compounding_error', 'visual_distraction'],
    recommendedDurations: {
      quick_probe: 120,
      standard_rep: 180,
      extended_stress_test: 360,
    },
  },
  noise_gate: {
    id: 'noise_gate',
    name: 'Noise Gate',
    legacyExerciseId: 'focus-noise-gate',
    targetSkills: ['selective_attention', 'cue_discrimination'],
    pressureTypes: ['visual_distraction', 'audio_distraction'],
    recommendedDurations: {
      quick_probe: 110,
      standard_rep: 180,
      extended_stress_test: 330,
    },
  },
  brake_point: {
    id: 'brake_point',
    name: 'Brake Point',
    legacyExerciseId: 'decision-brake-point',
    targetSkills: ['response_inhibition'],
    pressureTypes: ['time_pressure', 'uncertainty'],
    recommendedDurations: {
      quick_probe: 90,
      standard_rep: 150,
      extended_stress_test: 300,
    },
  },
  signal_window: {
    id: 'signal_window',
    name: 'Signal Window',
    legacyExerciseId: 'decision-signal-window',
    targetSkills: ['cue_discrimination', 'selective_attention'],
    pressureTypes: ['time_pressure', 'uncertainty', 'visual_distraction'],
    recommendedDurations: {
      quick_probe: 100,
      standard_rep: 165,
      extended_stress_test: 300,
    },
  },
  sequence_shift: {
    id: 'sequence_shift',
    name: 'Sequence Shift',
    legacyExerciseId: 'decision-sequence-shift',
    targetSkills: ['working_memory_updating', 'attentional_shifting'],
    pressureTypes: ['uncertainty', 'compounding_error'],
    recommendedDurations: {
      quick_probe: 100,
      standard_rep: 180,
      extended_stress_test: 320,
    },
  },
  endurance_lock: {
    id: 'endurance_lock',
    name: 'Endurance Lock',
    legacyExerciseId: 'focus-endurance-lock',
    targetSkills: ['sustained_attention', 'pressure_stability'],
    pressureTypes: ['fatigue', 'time_pressure'],
    recommendedDurations: {
      quick_probe: 120,
      standard_rep: 240,
      extended_stress_test: 480,
    },
  },
};

function humanizeTaxonomyLabel(value) {
  return String(value || '').split('_').join(' ');
}

function clampScore(score, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(Number(score || 0) * 10) / 10));
}

function scoreToLabel(score) {
  if (score >= 70) return 'strong';
  if (score >= 45) return 'developing';
  return 'weak';
}

function createEmptySkillScores(initial = 50) {
  return TAXONOMY_SKILLS.reduce((acc, skill) => {
    acc[skill] = initial;
    return acc;
  }, {});
}

function createEmptyModifierScores(initial = 50) {
  return TAXONOMY_MODIFIERS.reduce((acc, modifier) => {
    acc[modifier] = initial;
    return acc;
  }, {});
}

function computePillarScores(skillScores) {
  const groups = {
    focus: ['sustained_attention', 'selective_attention', 'attentional_shifting'],
    composure: ['error_recovery_speed', 'emotional_interference_control', 'pressure_stability'],
    decision: ['response_inhibition', 'working_memory_updating', 'cue_discrimination'],
  };

  return TAXONOMY_PILLARS.reduce((acc, pillar) => {
    const skills = groups[pillar];
    acc[pillar] = clampScore(skills.reduce((sum, skill) => sum + (skillScores[skill] ?? 50), 0) / skills.length);
    return acc;
  }, {});
}

function rankSkills(skillScores, direction) {
  return [...TAXONOMY_SKILLS].sort((left, right) =>
    direction === 'asc'
      ? (skillScores[left] ?? 0) - (skillScores[right] ?? 0)
      : (skillScores[right] ?? 0) - (skillScores[left] ?? 0)
  );
}

function baselineRatingToScore(rating) {
  return clampScore(30 + Number(rating || 0) * 12);
}

function average(values, fallback = 50) {
  if (!values.length) return fallback;
  return clampScore(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function averageFromSessions(sessions, key, fallback = 50) {
  const values = sessions
    .map((session) => session.supportingMetrics?.[key])
    .filter((value) => typeof value === 'number' && Number.isFinite(value));
  return average(values, fallback);
}

function createTrendSummary(profile) {
  const strongest = profile.strongestSkills[0];
  const weakest = profile.weakestSkills[0];
  const pressure = Object.entries(profile.pressureSensitivity || {})
    .sort((left, right) => (right[1] ?? 0) - (left[1] ?? 0))[0];
  const summary = [];

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

function getSimSpec(simId) {
  return SIM_REGISTRY[simId];
}

function bootstrapTaxonomyProfile(assessment) {
  const skillScores = createEmptySkillScores();
  const modifierScores = createEmptyModifierScores();

  if (assessment) {
    const focus = baselineRatingToScore(assessment.focusRating);
    const confidence = baselineRatingToScore(assessment.confidenceRating);
    const resilience = baselineRatingToScore(assessment.resilienceRating);
    const arousal = baselineRatingToScore(assessment.arousalControlRating);

    skillScores.sustained_attention = focus;
    skillScores.selective_attention = focus;
    skillScores.attentional_shifting = clampScore((focus + resilience) / 2);
    skillScores.error_recovery_speed = resilience;
    skillScores.emotional_interference_control = clampScore((arousal + confidence) / 2);
    skillScores.pressure_stability = clampScore((confidence + resilience + arousal) / 3);
    skillScores.response_inhibition = clampScore((focus + arousal) / 2);
    skillScores.working_memory_updating = clampScore((focus + confidence) / 2);
    skillScores.cue_discrimination = focus;

    if (assessment.biggestChallenge === BIGGEST_CHALLENGE.BOUNCING_BACK_FROM_SETBACKS) {
      skillScores.error_recovery_speed = clampScore(skillScores.error_recovery_speed - 10);
    }
    if (assessment.biggestChallenge === BIGGEST_CHALLENGE.PERFORMING_UNDER_PRESSURE) {
      skillScores.pressure_stability = clampScore(skillScores.pressure_stability - 10);
    }
    if (assessment.biggestChallenge === BIGGEST_CHALLENGE.FOCUS_DURING_COMPETITION) {
      skillScores.selective_attention = clampScore(skillScores.selective_attention - 10);
      skillScores.sustained_attention = clampScore(skillScores.sustained_attention - 8);
    }

    modifierScores.readiness =
      assessment.currentPracticeFrequency === 'daily' ? 68 :
      assessment.currentPracticeFrequency === 'weekly' ? 60 :
      48;
    modifierScores.fatigability = clampScore((focus + arousal) / 2);
    modifierScores.consistency =
      assessment.pressureResponse === 'same_as_training' || assessment.pressureResponse === 'rise_to_occasion'
        ? 64
        : 48;
    modifierScores.pressure_sensitivity =
      assessment.pressureResponse === 'freeze_perform_worse' ? 35 :
      assessment.pressureResponse === 'anxious_push_through' ? 48 :
      65;
  }

  const pillarScores = computePillarScores(skillScores);
  const profile = {
    overallScore: clampScore(
      (Object.values(pillarScores).reduce((sum, value) => sum + value, 0) +
        Object.values(modifierScores).reduce((sum, value) => sum + value, 0)) /
        (Object.keys(pillarScores).length + Object.keys(modifierScores).length)
    ),
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

function buildTaxonomyCheckInState(input) {
  const readiness = clampScore(input.readinessScore * 20);
  const energy = typeof input.energyLevel === 'number' ? clampScore(input.energyLevel * 20) : readiness;
  const stressPenalty = typeof input.stressLevel === 'number' ? input.stressLevel * 8 : 16;
  const sleepSupport = typeof input.sleepQuality === 'number' ? input.sleepQuality * 8 : 20;
  const priorSensitivity = input.priorProfile?.pressureSensitivity ?? {};

  const modifierScores = {
    readiness,
    fatigability: clampScore((energy + sleepSupport) / 2),
    consistency: clampScore(input.priorProfile?.modifierScores?.consistency ?? 50),
    pressure_sensitivity: clampScore(100 - stressPenalty),
  };

  const likelyPressureSensitivity = Object.entries(priorSensitivity)
    .sort((left, right) => (right[1] ?? 0) - (left[1] ?? 0))
    .slice(0, 2)
    .map(([pressure]) => pressure);

  const recommendedSessionType =
    readiness < 45 ? 'recovery_rep' :
    readiness < 60 ? 'probe' :
    'training_rep';

  const recommendedDurationMode =
    readiness < 45 ? 'quick_probe' :
    readiness < 65 ? 'standard_rep' :
    'standard_rep';

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

function deriveTaxonomyProfile({ baselineAssessment, checkIns = [], simSessions = [] }) {
  const profile = bootstrapTaxonomyProfile(baselineAssessment);

  for (const session of simSessions) {
    const contribution = clampScore((Number(session.normalizedScore ?? 0) - 50) * 0.2, -20, 20);
    for (const skill of session.targetSkills || []) {
      if (typeof profile.skillScores[skill] === 'number') {
        profile.skillScores[skill] = clampScore(profile.skillScores[skill] + contribution);
      }
    }

    const consistencyIndex = session.supportingMetrics?.consistency_index ?? session.supportingMetrics?.consistencyIndex;
    if (typeof consistencyIndex === 'number') {
      profile.modifierScores.consistency = clampScore(
        average([profile.modifierScores.consistency, 100 - consistencyIndex * 40])
      );
    }

    const degradation = session.supportingMetrics?.degradation_slope_over_time ?? session.supportingMetrics?.degradationSlope;
    if (typeof degradation === 'number') {
      profile.modifierScores.fatigability = clampScore(
        average([profile.modifierScores.fatigability, 100 - degradation * 30])
      );
    }

    for (const pressureType of session.pressureTypes || []) {
      const current = profile.pressureSensitivity[pressureType] ?? 0;
      profile.pressureSensitivity[pressureType] = clampScore(
        average([current, 100 - Number(session.normalizedScore ?? 0)], current || 40)
      );
    }
  }

  profile.modifierScores.readiness = average(
    checkIns
      .map((checkIn) => checkIn.taxonomyState?.readinessScore ?? (typeof checkIn.readinessScore === 'number' ? checkIn.readinessScore * 20 : null))
      .filter((value) => typeof value === 'number'),
    profile.modifierScores.readiness
  );

  profile.modifierScores.pressure_sensitivity = average(
    Object.values(profile.pressureSensitivity).filter((value) => typeof value === 'number'),
    profile.modifierScores.pressure_sensitivity
  );

  profile.modifierScores.consistency = average(
    [
      profile.modifierScores.consistency,
      averageFromSessions(simSessions, 'consistencyIndex', profile.modifierScores.consistency),
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

function prescribeNextSession({ profile, checkInState }) {
  const weakestSkill = profile.weakestSkills[0] || 'error_recovery_speed';
  const readiness = checkInState?.readinessScore ?? profile.modifierScores.readiness;
  const weakestModifier = Object.entries(profile.modifierScores)
    .sort((left, right) => left[1] - right[1])[0]?.[0];

  const skillToSim = {
    sustained_attention: 'endurance_lock',
    selective_attention: 'noise_gate',
    attentional_shifting: 'reset',
    error_recovery_speed: 'reset',
    emotional_interference_control: 'reset',
    pressure_stability: 'reset',
    response_inhibition: 'brake_point',
    working_memory_updating: 'sequence_shift',
    cue_discrimination: 'signal_window',
  };

  let recommendedSimId = skillToSim[weakestSkill] || 'reset';
  if (weakestModifier === 'fatigability') {
    recommendedSimId = 'endurance_lock';
  }

  const sim = getSimSpec(recommendedSimId);
  const sessionType =
    readiness < 45 ? 'recovery_rep' :
    readiness < 60 ? 'probe' :
    weakestModifier === 'consistency' ? 'reassessment' :
    'training_rep';

  const durationMode =
    sessionType === 'recovery_rep' ? 'quick_probe' :
    weakestModifier === 'fatigability' ? 'extended_stress_test' :
    checkInState?.recommendedDurationMode ?? 'standard_rep';

  return {
    recommendedSimId,
    recommendedLegacyExerciseId: sim?.legacyExerciseId,
    sessionType,
    durationMode,
    durationSeconds: sim?.recommendedDurations?.[durationMode] ?? 180,
    rationale:
      sessionType === 'recovery_rep'
        ? `Today reads as a lower-readiness day, so Nora should use ${sim?.name || humanizeTaxonomyLabel(recommendedSimId)} as a lighter rep that still measures the bottleneck.`
        : `The current bottleneck is ${humanizeTaxonomyLabel(weakestSkill)}, so Nora should prescribe ${sim?.name || humanizeTaxonomyLabel(recommendedSimId)} next.`,
    targetSkills: sim?.targetSkills ?? [],
    targetPressureTypes: sim?.pressureTypes ?? [],
    generatedAt: Date.now(),
  };
}

function calculateTransferGap(trainingScore, trialScore) {
  return clampScore(Number(trainingScore || 0) - Number(trialScore || 0), 0, 100);
}

function buildInitialAthleteProgress(athleteId, now = Date.now()) {
  const taxonomyProfile = bootstrapTaxonomyProfile();
  return {
    athleteId,
    mprScore: 1,
    mprLastCalculated: now,
    currentPathway: 'foundation',
    pathwayStep: 0,
    completedPathways: [],
    foundationComplete: false,
    foundationBoxBreathingComplete: false,
    foundationCheckInsComplete: false,
    assessmentNeeded: true,
    totalExercisesMastered: 0,
    totalAssignmentsCompleted: 0,
    currentStreak: 0,
    longestStreak: 0,
    taxonomyProfile,
    activeProgram: prescribeNextSession({ profile: taxonomyProfile }),
    lastProfileSyncAt: now,
    profileVersion: PROFILE_VERSION,
    createdAt: now,
    updatedAt: now,
  };
}

function resolveCurrentEmphasis(profile) {
  return profile?.weakestSkills?.[0] ? humanizeTaxonomyLabel(profile.weakestSkills[0]) : 'foundation control';
}

function resolvePressurePattern(progress, profile) {
  const strongestPressure = profile && Object.entries(profile.pressureSensitivity || {})
    .sort((left, right) => (right[1] ?? 0) - (left[1] ?? 0))[0]?.[0];

  if (strongestPressure) {
    return humanizeTaxonomyLabel(strongestPressure);
  }

  switch (progress?.baselineAssessment?.biggestChallenge) {
    case BIGGEST_CHALLENGE.FOCUS_DURING_COMPETITION:
      return humanizeTaxonomyLabel(PRESSURE_TYPE.VISUAL);
    case BIGGEST_CHALLENGE.BOUNCING_BACK_FROM_SETBACKS:
      return humanizeTaxonomyLabel(PRESSURE_TYPE.COMPOUNDING_ERROR);
    case BIGGEST_CHALLENGE.PRE_COMPETITION_ANXIETY:
    case 'confidence_in_abilities':
    case BIGGEST_CHALLENGE.PERFORMING_UNDER_PRESSURE:
      return humanizeTaxonomyLabel(PRESSURE_TYPE.EVALUATIVE);
    default:
      return humanizeTaxonomyLabel(PRESSURE_TYPE.UNCERTAINTY);
  }
}

function resolveConsistencyState(profile) {
  const consistency = profile?.modifierScores?.consistency ?? 50;
  if (consistency >= 70) return 'stable under load';
  if (consistency >= 55) return 'building steadier reps';
  return 'still inconsistent under pressure';
}

function resolveNextMilestone(progress) {
  if (!progress?.foundationComplete) {
    return 'foundation completion';
  }
  return 'your next program checkpoint';
}

function buildSnapshotSkillSummaries(progress) {
  const profile = progress?.taxonomyProfile;
  if (!profile) return [];
  const strongest = profile.strongestSkills?.[0] ? humanizeTaxonomyLabel(profile.strongestSkills[0]) : 'n/a';
  const weakest = profile.weakestSkills?.[0] ? humanizeTaxonomyLabel(profile.weakestSkills[0]) : 'n/a';
  const rationale = progress.activeProgram?.rationale || 'Profile is calibrating from the latest milestone.';

  return [
    `Strongest skill: ${strongest}.`,
    `Growth area: ${weakest}.`,
    rationale,
  ];
}

function normalizeWhitespace(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function stableSerialize(value) {
  if (value === null || value === undefined) return 'null';
  if (typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableSerialize(item)).join(',')}]`;

  const entries = Object.entries(value).sort(([left], [right]) => left.localeCompare(right));
  return `{${entries.map(([key, nested]) => `${JSON.stringify(key)}:${stableSerialize(nested)}`).join(',')}}`;
}

function hashString(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a_${(hash >>> 0).toString(16)}`;
}

function buildProfileSnapshotKey({ milestoneType, pilotEnrollmentId, manualCheckpointId }) {
  const enrollmentKey = String(pilotEnrollmentId || '').trim() || 'solo';

  if (milestoneType === 'manual_staff_checkpoint') {
    const checkpointKey = String(manualCheckpointId || '').trim() || 'checkpoint';
    return `${enrollmentKey}__manual__${checkpointKey}`;
  }

  return `${enrollmentKey}__${milestoneType}`;
}

function buildProfileSnapshotCanonicalScopeKey({ athleteId, milestoneType, pilotEnrollmentId, manualCheckpointId }) {
  return `${athleteId}__${buildProfileSnapshotKey({ milestoneType, pilotEnrollmentId, manualCheckpointId })}`;
}

function renderProfileExplanation(templateId, slots) {
  return normalizeWhitespace(PROFILE_EXPLANATION_TEMPLATES[templateId](slots));
}

function validateProfileExplanation(narrative) {
  const renderedText = normalizeWhitespace(narrative.renderedText);
  const expectedText = renderProfileExplanation(narrative.templateId, narrative.slots);
  const sentenceCount = renderedText
    .split(/[.!?]+/)
    .map((segment) => segment.trim())
    .filter(Boolean).length;

  if (renderedText !== expectedText) {
    return { valid: false, reason: 'Rendered explanation does not match the approved template output.' };
  }

  if (sentenceCount > 2) {
    return { valid: false, reason: 'Rendered explanation exceeds the two-sentence maximum.' };
  }

  for (const pattern of BANNED_NARRATIVE_PATTERNS) {
    if (pattern.test(renderedText)) {
      return { valid: false, reason: 'Rendered explanation contains blocked clinical or diagnostic language.' };
    }
  }

  return { valid: true };
}

function buildSnapshotFingerprint(input, narrative) {
  return hashString(
    stableSerialize({
      profileVersion: input.profileVersion,
      profilePayload: input.profilePayload,
      narrative: {
        templateId: narrative.templateId,
        templateVersion: narrative.templateVersion,
        renderedText: normalizeWhitespace(narrative.renderedText),
        slots: narrative.slots,
      },
    })
  );
}

function buildCanonicalSnapshot(input, now, revision) {
  const snapshotKey = buildProfileSnapshotKey(input);
  const canonicalScopeKey = buildProfileSnapshotCanonicalScopeKey(input);
  const payloadFingerprint = buildSnapshotFingerprint(input, input.noraExplanation);

  return {
    snapshotKey,
    athleteId: input.athleteId,
    milestoneType: input.milestoneType,
    pilotEnrollmentId: input.pilotEnrollmentId ?? null,
    canonicalScopeKey,
    canonical: true,
    status: 'canonical',
    revision,
    idempotencyKey: `${canonicalScopeKey}__${payloadFingerprint}`,
    payloadFingerprint,
    profileVersion: input.profileVersion,
    writerVersion: input.writerVersion,
    writeReason: input.writeReason,
    capturedAt: input.capturedAt ?? now,
    updatedAt: now,
    supersededAt: null,
    profilePayload: input.profilePayload,
    noraExplanation: {
      ...input.noraExplanation,
      renderedText: normalizeWhitespace(input.noraExplanation.renderedText),
      validated: true,
    },
    sourceRefs: {
      progressUpdatedAt: input.sourceRefs?.progressUpdatedAt ?? null,
      trialCompletedAt: input.sourceRefs?.trialCompletedAt ?? null,
      sourceEventId: input.sourceRefs?.sourceEventId ?? null,
    },
  };
}

function buildProfileSnapshotWriteInput({
  athleteId,
  progress,
  milestoneType,
  capturedAt,
  sourceEventId,
  writeReason = 'initial_capture',
  profileVersion = progress?.profileVersion || PROFILE_VERSION,
  writerVersion = SNAPSHOT_WRITER_VERSION,
}) {
  const profile = progress?.taxonomyProfile || bootstrapTaxonomyProfile(progress?.baselineAssessment);
  const currentEmphasis = resolveCurrentEmphasis(profile);
  const pressurePattern = resolvePressurePattern(progress, profile);
  const nextMilestone = resolveNextMilestone(progress);
  const resolvedCapturedAt = capturedAt ?? progress?.lastProfileSyncAt ?? progress?.updatedAt ?? Date.now();

  const slots = {
    currentEmphasis,
    growthArea: currentEmphasis,
    pressurePattern,
    growthGoal: `stabilize ${currentEmphasis}`,
    nextMilestone,
  };

  return {
    athleteId,
    milestoneType,
    capturedAt: resolvedCapturedAt,
    profileVersion,
    writerVersion,
    writeReason,
    profilePayload: {
      pillarScores: profile.pillarScores,
      skillSummaries: buildSnapshotSkillSummaries(progress),
      modifierScores: profile.modifierScores,
      trendSummary: (profile.trendSummary || []).join(' '),
      currentEmphasis,
      nextMilestone,
      pressurePattern,
      consistencyState: resolveConsistencyState(profile),
    },
    noraExplanation: {
      templateId: 'emphasis_dual_v1',
      templateVersion: '1.0',
      slots,
      renderedText: renderProfileExplanation('emphasis_dual_v1', slots),
    },
    sourceRefs: {
      progressUpdatedAt: progress?.updatedAt ?? null,
      trialCompletedAt: capturedAt ?? null,
      sourceEventId: sourceEventId ?? `${milestoneType}_snapshot:${athleteId}:${resolvedCapturedAt}`,
    },
  };
}

function resolveMilestoneFromSession(session) {
  if (session.profileSnapshotMilestone) {
    return session.profileSnapshotMilestone;
  }

  if (session.trialType === 'baseline_trial') {
    return 'baseline';
  }

  return null;
}

module.exports = {
  PROFILE_VERSION,
  SNAPSHOT_WRITER_VERSION,
  buildTaxonomyCheckInState,
  bootstrapTaxonomyProfile,
  deriveTaxonomyProfile,
  prescribeNextSession,
  calculateTransferGap,
  buildInitialAthleteProgress,
  buildProfileSnapshotWriteInput,
  buildProfileSnapshotKey,
  buildProfileSnapshotCanonicalScopeKey,
  renderProfileExplanation,
  validateProfileExplanation,
  buildSnapshotFingerprint,
  buildCanonicalSnapshot,
  resolveMilestoneFromSession,
};
