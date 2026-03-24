const AUTHORING_RULES_VERSION = 'training_plan_authoring_v1';
const ARCHETYPE_VERSION = '2026-03-23';
const DEFAULT_EXPLORATORY_WINDOW = 2;
const MAX_EXPLORATORY_WINDOW = 3;

const SKILL_TO_PRIMARY_SIM = {
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

const SIM_LIBRARY = {
  reset: { label: 'Reset', standardDurationSeconds: 180, extendedDurationSeconds: 240 },
  noise_gate: { label: 'Noise Gate', standardDurationSeconds: 240, extendedDurationSeconds: 300 },
  brake_point: { label: 'Brake Point', standardDurationSeconds: 210, extendedDurationSeconds: 270 },
  signal_window: { label: 'Signal Window', standardDurationSeconds: 240, extendedDurationSeconds: 300 },
  sequence_shift: { label: 'Sequence Shift', standardDurationSeconds: 240, extendedDurationSeconds: 300 },
  endurance_lock: { label: 'Endurance Lock', standardDurationSeconds: 300, extendedDurationSeconds: 420 },
};

const PROTOCOL_LIBRARY = {
  regulation_reset: {
    id: 'protocol-box-breathing',
    label: 'Box Breathing',
    protocolClass: 'regulation',
    durationSeconds: 180,
  },
  acute_downshift: {
    id: 'protocol-physiological-sigh',
    label: 'Physiological Sigh',
    protocolClass: 'regulation',
    durationSeconds: 120,
  },
  body_awareness: {
    id: 'protocol-body-scan-reset',
    label: 'Body Scan Awareness',
    protocolClass: 'regulation',
    durationSeconds: 240,
  },
  focus_cue: {
    id: 'protocol-cue-word-anchoring',
    label: 'Cue Word Anchoring',
    protocolClass: 'priming',
    durationSeconds: 120,
  },
  activation_upshift: {
    id: 'protocol-activation-breathing',
    label: 'Activation Breathing',
    protocolClass: 'priming',
    durationSeconds: 120,
  },
  recovery_reset: {
    id: 'protocol-recovery-breathing',
    label: 'Recovery Breathing',
    protocolClass: 'recovery',
    durationSeconds: 180,
  },
};

function normalizeTag(value) {
  if (!value) return '';
  return String(value).trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

function humanizeLabel(value) {
  if (!value) return '';
  return String(value)
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function buildTrainingPlanId(athleteId, assignedBy, now) {
  return `${athleteId}_plan_${assignedBy || 'nora'}_${now}`;
}

function buildProgramPrescriptionId(athleteId, activeProgram) {
  if (!athleteId || !activeProgram || typeof activeProgram.generatedAt !== 'number') {
    return null;
  }

  return `${athleteId}_program_${activeProgram.generatedAt}`;
}

function resolveFocusSkill(profile) {
  return profile?.weakestSkills?.[0] || 'sustained_attention';
}

function resolvePrimarySimId(focusSkill, activeProgram) {
  if (activeProgram?.recommendedSimId) {
    return activeProgram.recommendedSimId;
  }
  return SKILL_TO_PRIMARY_SIM[focusSkill] || 'endurance_lock';
}

function resolveSecondarySimId(primarySimId) {
  switch (primarySimId) {
    case 'endurance_lock':
      return 'noise_gate';
    case 'noise_gate':
      return 'endurance_lock';
    case 'reset':
      return 'brake_point';
    case 'brake_point':
      return 'reset';
    case 'sequence_shift':
      return 'signal_window';
    case 'signal_window':
      return 'sequence_shift';
    default:
      return primarySimId;
  }
}

function resolveFallbackPlanType({ snapshot, activeProgram }) {
  if (
    snapshot?.recommendedRouting === 'protocol_only'
    || activeProgram?.sessionType === 'recovery_rep'
  ) {
    return 'protocol_focused';
  }

  if (snapshot?.recommendedRouting === 'protocol_then_sim' || snapshot?.recommendedRouting === 'sim_then_protocol') {
    return 'mixed';
  }

  return 'sim_focused';
}

function shouldAvoidAssessmentLoop({ recentPlans = [], trigger, assignedBy }) {
  if (assignedBy === 'coach' || trigger === 'coach_manual' || trigger === 'significant_profile_change') {
    return false;
  }

  const lastPrimaryPlan = (Array.isArray(recentPlans) ? recentPlans : [])
    .filter((plan) => plan?.isPrimary)
    .sort((left, right) => Number(right?.updatedAt || right?.createdAt || 0) - Number(left?.updatedAt || left?.createdAt || 0))[0];

  return lastPrimaryPlan?.planType === 'assessment';
}

function pickAvailableSimRecord(liveSimRegistry = [], requestedSimId) {
  const registry = Array.isArray(liveSimRegistry) ? liveSimRegistry.filter((record) => record?.isActive !== false) : [];
  if (!registry.length) {
    return { record: null, fallbackReason: null };
  }

  const requestedTag = normalizeTag(requestedSimId);
  const directMatch = registry.find((record) => {
    const recordId = normalizeTag(record?.id);
    const recordSimSpecId = normalizeTag(record?.simSpecId);
    return requestedTag && (recordId === requestedTag || recordSimSpecId === requestedTag);
  }) || null;

  if (directMatch) {
    return { record: directMatch, fallbackReason: null };
  }

  const familyMatch = registry.find((record) => {
    const familyTag = normalizeTag(record?.variantSource?.family || record?.engineKey || record?.buildArtifact?.engineKey);
    return requestedTag && familyTag === requestedTag;
  }) || null;

  if (familyMatch) {
    return {
      record: familyMatch,
      fallbackReason: `${humanizeLabel(requestedSimId)} was unavailable, so Nora fell back to the nearest published sim family.`,
    };
  }

  return {
    record: registry[0] || null,
    fallbackReason: `${humanizeLabel(requestedSimId)} was unavailable, so Nora used the nearest published sim that is currently launchable.`,
  };
}

function resolveInventoryAwareSim(primarySimId, liveSimRegistry) {
  const baseSim = SIM_LIBRARY[primarySimId] || SIM_LIBRARY.endurance_lock;
  const { record, fallbackReason } = pickAvailableSimRecord(liveSimRegistry, primarySimId);
  const resolvedSimSpecId = record?.simSpecId || record?.id || primarySimId || 'endurance_lock';

  return {
    simSpecId: resolvedSimSpecId,
    label: record?.name || baseSim?.label || humanizeLabel(resolvedSimSpecId),
    standardDurationSeconds: baseSim?.standardDurationSeconds || 180,
    extendedDurationSeconds: baseSim?.extendedDurationSeconds || 240,
    fallbackReason,
  };
}

function resolveInventoryAwareProtocol(protocolKey, liveProtocolRegistry) {
  const baseProtocol = PROTOCOL_LIBRARY[protocolKey];
  if (!baseProtocol) {
    return null;
  }

  const registry = Array.isArray(liveProtocolRegistry)
    ? liveProtocolRegistry.filter((record) => record?.isActive !== false && record?.publishStatus === 'published')
    : [];

  if (!registry.length) {
    return {
      id: baseProtocol.id,
      label: baseProtocol.label,
      protocolClass: baseProtocol.protocolClass,
      durationSeconds: baseProtocol.durationSeconds,
      fallbackReason: null,
    };
  }

  const exactMatch = registry.find((record) => normalizeTag(record?.id) === normalizeTag(baseProtocol.id)) || null;
  if (exactMatch) {
    return {
      id: exactMatch.id,
      label: exactMatch.label || baseProtocol.label,
      protocolClass: exactMatch.protocolClass || baseProtocol.protocolClass,
      durationSeconds: exactMatch.durationSeconds || baseProtocol.durationSeconds,
      fallbackReason: null,
    };
  }

  const classFallback = registry.find((record) => record?.protocolClass === baseProtocol.protocolClass) || null;
  if (classFallback) {
    return {
      id: classFallback.id,
      label: classFallback.label || baseProtocol.label,
      protocolClass: classFallback.protocolClass || baseProtocol.protocolClass,
      durationSeconds: classFallback.durationSeconds || baseProtocol.durationSeconds,
      fallbackReason: `${baseProtocol.label} was unavailable, so Nora used the nearest published ${humanizeLabel(baseProtocol.protocolClass)} protocol.`,
    };
  }

  return {
    id: baseProtocol.id,
    label: baseProtocol.label,
    protocolClass: baseProtocol.protocolClass,
    durationSeconds: baseProtocol.durationSeconds,
    fallbackReason: `${baseProtocol.label} was unavailable in live inventory, so the seeded protocol mapping was used as a temporary fallback.`,
  };
}

function buildSimStep({
  planId,
  stepIndex,
  stepLabel,
  simSpecId,
  durationSeconds,
  actionType = 'sim',
  targetSkills,
  executionPattern = 'single',
  archetypeStepKey,
}) {
  return {
    id: `${planId}_step_${String(stepIndex).padStart(4, '0')}`,
    stepIndex,
    stepLabel,
    stepStatus: 'planned',
    actionType,
    exerciseId: simSpecId,
    simSpecId,
    executionPattern,
    targetSkills,
    archetypeStepKey,
    plannedDurationSeconds: durationSeconds,
  };
}

function buildProtocolStep({
  planId,
  stepIndex,
  stepLabel,
  protocolId,
  protocolClass,
  durationSeconds,
  targetSkills,
  actionType = 'protocol',
  executionPattern = 'single',
  archetypeStepKey,
  simSpecId,
}) {
  return {
    id: `${planId}_step_${String(stepIndex).padStart(4, '0')}`,
    stepIndex,
    stepLabel,
    stepStatus: 'planned',
    actionType,
    exerciseId: protocolId,
    protocolId,
    protocolClass,
    simSpecId: simSpecId || undefined,
    executionPattern,
    targetSkills,
    archetypeStepKey,
    plannedDurationSeconds: durationSeconds,
  };
}

function resolvePlanType({ activeProgram, snapshot, lowConfidence, avoidAssessmentLoop = false }) {
  if (lowConfidence) {
    return avoidAssessmentLoop
      ? resolveFallbackPlanType({ snapshot, activeProgram })
      : 'assessment';
  }

  if (snapshot?.recommendedRouting === 'protocol_then_sim' || snapshot?.recommendedRouting === 'sim_then_protocol') {
    return 'mixed';
  }

  if (
    snapshot?.recommendedRouting === 'protocol_only'
    || activeProgram?.sessionType === 'recovery_rep'
  ) {
    return 'protocol_focused';
  }

  if (activeProgram?.sessionType === 'probe' || activeProgram?.sessionType === 'reassessment') {
    return avoidAssessmentLoop
      ? resolveFallbackPlanType({ snapshot, activeProgram })
      : 'assessment';
  }

  return 'sim_focused';
}

function resolveArchetype({ planType, primarySimId, focusSkill, liveSimRegistry, liveProtocolRegistry }) {
  const fallbackReasons = [];
  const primarySim = resolveInventoryAwareSim(primarySimId, liveSimRegistry);
  const secondarySim = resolveInventoryAwareSim(resolveSecondarySimId(primarySimId), liveSimRegistry);
  const acuteDownshift = resolveInventoryAwareProtocol('acute_downshift', liveProtocolRegistry);
  const regulationReset = resolveInventoryAwareProtocol('regulation_reset', liveProtocolRegistry);
  const bodyAwareness = resolveInventoryAwareProtocol('body_awareness', liveProtocolRegistry);
  const focusCue = resolveInventoryAwareProtocol('focus_cue', liveProtocolRegistry);
  const recoveryReset = resolveInventoryAwareProtocol('recovery_reset', liveProtocolRegistry);

  [
    primarySim?.fallbackReason,
    secondarySim?.fallbackReason,
    acuteDownshift?.fallbackReason,
    regulationReset?.fallbackReason,
    bodyAwareness?.fallbackReason,
    focusCue?.fallbackReason,
    recoveryReset?.fallbackReason,
  ].filter(Boolean).forEach((reason) => fallbackReasons.push(reason));

  const inventoryFallbackReason = fallbackReasons.length
    ? Array.from(new Set(fallbackReasons)).join(' ')
    : null;

  switch (planType) {
    case 'protocol_focused':
      return {
        archetypeId: 'protocol_state_stabilization_v1',
        title: 'State Stabilization Block',
        goal: 'Steady your state first so later reps have cleaner footing.',
        progressMode: 'days',
        targetCount: 5,
        inventoryFallbackReason,
        buildSteps(planId) {
          return [
            buildProtocolStep({
              planId,
              stepIndex: 1,
              stepLabel: `Day 1: ${acuteDownshift.label}`,
              protocolId: acuteDownshift.id,
              protocolClass: acuteDownshift.protocolClass,
              durationSeconds: acuteDownshift.durationSeconds,
              targetSkills: [focusSkill],
              archetypeStepKey: 'downshift_entry',
            }),
            buildProtocolStep({
              planId,
              stepIndex: 2,
              stepLabel: `Day 2: ${regulationReset.label}`,
              protocolId: regulationReset.id,
              protocolClass: regulationReset.protocolClass,
              durationSeconds: regulationReset.durationSeconds,
              targetSkills: [focusSkill],
              archetypeStepKey: 'steady_regulation',
            }),
            buildProtocolStep({
              planId,
              stepIndex: 3,
              stepLabel: `Day 3: ${bodyAwareness.label}`,
              protocolId: bodyAwareness.id,
              protocolClass: bodyAwareness.protocolClass,
              durationSeconds: bodyAwareness.durationSeconds,
              targetSkills: [focusSkill],
              archetypeStepKey: 'body_awareness',
            }),
            buildProtocolStep({
              planId,
              stepIndex: 4,
              stepLabel: `Day 4: ${focusCue.label}`,
              protocolId: focusCue.id,
              protocolClass: focusCue.protocolClass,
              durationSeconds: focusCue.durationSeconds,
              targetSkills: [focusSkill],
              archetypeStepKey: 'focus_cue',
            }),
            buildProtocolStep({
              planId,
              stepIndex: 5,
              stepLabel: `Day 5: ${recoveryReset.label}`,
              protocolId: recoveryReset.id,
              protocolClass: recoveryReset.protocolClass,
              durationSeconds: recoveryReset.durationSeconds,
              targetSkills: [focusSkill],
              archetypeStepKey: 'recovery_exit',
            }),
          ];
        },
      };
    case 'mixed':
      return {
        archetypeId: 'mixed_regulate_then_build_v1',
        title: `${humanizeLabel(focusSkill)} Mixed Build`,
        goal: 'Blend state regulation and direct reps so today’s state does not block skill growth.',
        progressMode: 'sessions',
        targetCount: 4,
        inventoryFallbackReason,
        buildSteps(planId) {
          return [
            buildProtocolStep({
              planId,
              stepIndex: 1,
              stepLabel: `Session 1: ${acuteDownshift.label} -> ${primarySim.label}`,
              protocolId: acuteDownshift.id,
              protocolClass: acuteDownshift.protocolClass,
              durationSeconds: acuteDownshift.durationSeconds + primarySim.standardDurationSeconds,
              targetSkills: [focusSkill],
              executionPattern: 'protocol_then_sim',
              archetypeStepKey: 'regulate_then_rep',
              simSpecId: primarySim.simSpecId,
            }),
            buildProtocolStep({
              planId,
              stepIndex: 2,
              stepLabel: `Session 2: ${regulationReset.label} -> ${primarySim.label}`,
              protocolId: regulationReset.id,
              protocolClass: regulationReset.protocolClass,
              durationSeconds: regulationReset.durationSeconds + primarySim.standardDurationSeconds,
              targetSkills: [focusSkill],
              executionPattern: 'protocol_then_sim',
              archetypeStepKey: 'steady_then_rep',
              simSpecId: primarySim.simSpecId,
            }),
            buildProtocolStep({
              planId,
              stepIndex: 3,
              stepLabel: `Session 3: ${focusCue.label} -> ${secondarySim.label}`,
              protocolId: focusCue.id,
              protocolClass: focusCue.protocolClass,
              durationSeconds: focusCue.durationSeconds + secondarySim.standardDurationSeconds,
              targetSkills: [focusSkill],
              executionPattern: 'protocol_then_sim',
              archetypeStepKey: 'cue_then_transfer',
              simSpecId: secondarySim.simSpecId,
            }),
            buildSimStep({
              planId,
              stepIndex: 4,
              stepLabel: `Session 4: ${primarySim.label} Reassessment`,
              simSpecId: primarySim.simSpecId,
              durationSeconds: primarySim.extendedDurationSeconds,
              actionType: 'lighter_sim',
              targetSkills: [focusSkill],
              executionPattern: 'single',
              archetypeStepKey: 'mixed_reassessment',
            }),
          ];
        },
      };
    case 'assessment':
      return {
        archetypeId: 'assessment_recalibration_v1',
        title: 'Calibration Block',
        goal: 'Use a short calibration block to confirm the true bottleneck before locking a longer build.',
        progressMode: 'sessions',
        targetCount: 3,
        inventoryFallbackReason,
        buildSteps(planId) {
          return [
            buildSimStep({
              planId,
              stepIndex: 1,
              stepLabel: `${primarySim.label} Probe`,
              simSpecId: primarySim.simSpecId,
              durationSeconds: primarySim.standardDurationSeconds,
              actionType: 'lighter_sim',
              targetSkills: [focusSkill],
              executionPattern: 'single',
              archetypeStepKey: 'probe',
            }),
            buildProtocolStep({
              planId,
              stepIndex: 2,
              stepLabel: `${focusCue.label} -> ${primarySim.label}`,
              protocolId: focusCue.id,
              protocolClass: focusCue.protocolClass,
              durationSeconds: focusCue.durationSeconds + primarySim.standardDurationSeconds,
              targetSkills: [focusSkill],
              executionPattern: 'protocol_then_sim',
              archetypeStepKey: 'calibration_bridge',
              simSpecId: primarySim.simSpecId,
            }),
            buildSimStep({
              planId,
              stepIndex: 3,
              stepLabel: `${primarySim.label} Reassessment`,
              simSpecId: primarySim.simSpecId,
              durationSeconds: primarySim.standardDurationSeconds,
              actionType: 'lighter_sim',
              targetSkills: [focusSkill],
              executionPattern: 'single',
              archetypeStepKey: 'assessment_reassessment',
            }),
          ];
        },
      };
    case 'sim_focused':
    default: {
      return {
        archetypeId: 'sim_skill_build_v1',
        title: `${humanizeLabel(focusSkill)} Skill Build`,
        goal: `Build ${humanizeLabel(focusSkill)} through a sequenced sim block that moves from steadiness to transfer.`,
        progressMode: 'sessions',
        targetCount: 5,
        inventoryFallbackReason,
        buildSteps(planId) {
          return [
            buildSimStep({
              planId,
              stepIndex: 1,
              stepLabel: `Session 1: ${primarySim.label}`,
              simSpecId: primarySim.simSpecId,
              durationSeconds: primarySim.standardDurationSeconds,
              targetSkills: [focusSkill],
              archetypeStepKey: 'entry_rep',
            }),
            buildSimStep({
              planId,
              stepIndex: 2,
              stepLabel: `Session 2: ${primarySim.label} Extended`,
              simSpecId: primarySim.simSpecId,
              durationSeconds: primarySim.extendedDurationSeconds,
              targetSkills: [focusSkill],
              archetypeStepKey: 'extended_rep',
            }),
            buildSimStep({
              planId,
              stepIndex: 3,
              stepLabel: `Session 3: ${secondarySim.label} Transfer`,
              simSpecId: secondarySim.simSpecId,
              durationSeconds: secondarySim.standardDurationSeconds,
              targetSkills: [focusSkill],
              archetypeStepKey: 'transfer_rep',
            }),
            buildSimStep({
              planId,
              stepIndex: 4,
              stepLabel: `Session 4: ${primarySim.label} Under Load`,
              simSpecId: primarySim.simSpecId,
              durationSeconds: primarySim.extendedDurationSeconds,
              targetSkills: [focusSkill],
              archetypeStepKey: 'load_rep',
            }),
            buildSimStep({
              planId,
              stepIndex: 5,
              stepLabel: `Session 5: ${primarySim.label} Reassessment`,
              simSpecId: primarySim.simSpecId,
              durationSeconds: primarySim.standardDurationSeconds,
              actionType: 'lighter_sim',
              targetSkills: [focusSkill],
              archetypeStepKey: 'reassessment',
            }),
          ];
        },
      };
    }
  }
}

function syncTrainingPlanProgression(plan) {
  const normalizedSteps = Array.isArray(plan?.steps)
    ? [...plan.steps].sort((left, right) => Number(left?.stepIndex || 0) - Number(right?.stepIndex || 0))
    : [];

  const completedSteps = normalizedSteps.filter((step) => step?.stepStatus === 'completed');
  const activeTodayStep = normalizedSteps.find((step) => step?.stepStatus === 'active_today') || null;
  const nextPlannedStep = normalizedSteps.find((step) => !['completed', 'superseded', 'skipped'].includes(String(step?.stepStatus || ''))) || null;

  const completedCount = completedSteps.length;
  const lastCompletedStepIndex = completedSteps.length
    ? Number(completedSteps[completedSteps.length - 1]?.stepIndex || 0) || null
    : null;
  const currentStepIndex =
    Number(activeTodayStep?.stepIndex || nextPlannedStep?.stepIndex || 0) || null;
  const nextDueStepIndex =
    plan?.status === 'completed'
      ? null
      : Number(nextPlannedStep?.stepIndex || 0) || null;

  let status = plan?.status || 'active';
  if (typeof plan?.targetCount === 'number' && plan.targetCount > 0 && completedCount >= plan.targetCount) {
    status = 'completed';
  } else if (
    (plan?.targetCount === null || typeof plan?.targetCount !== 'number' || plan.targetCount <= 0)
    && normalizedSteps.length > 0
    && normalizedSteps.every((step) => ['completed', 'superseded', 'skipped'].includes(String(step?.stepStatus || '')))
  ) {
    status = 'completed';
  }

  return {
    ...plan,
    status,
    completedCount,
    steps: normalizedSteps,
    currentStepIndex,
    nextDueStepIndex,
    lastCompletedStepIndex,
  };
}

function resolveNextDuePlanStep(plan) {
  const steps = Array.isArray(plan?.steps)
    ? [...plan.steps].sort((left, right) => Number(left?.stepIndex || 0) - Number(right?.stepIndex || 0))
    : [];

  const indexedStep = typeof plan?.nextDueStepIndex === 'number'
    ? steps.find((step) => Number(step?.stepIndex || 0) === Number(plan.nextDueStepIndex))
    : null;

  if (indexedStep && !['completed', 'superseded', 'skipped', 'overridden'].includes(String(indexedStep?.stepStatus || ''))) {
    return indexedStep;
  }

  return steps.find((step) => !['completed', 'superseded', 'skipped', 'overridden'].includes(String(step?.stepStatus || ''))) || null;
}

function resolveSignificantProfileChange({ plan, profile, activeProgram, snapshot, recentAssignments = [] }) {
  if (!plan || plan.status !== 'active') {
    return { shouldSupersede: false, reason: null };
  }

  const focusSkill = resolveFocusSkill(profile);
  if (plan.authoringFocusSkill && plan.authoringFocusSkill !== focusSkill) {
    return {
      shouldSupersede: true,
      reason: `Primary bottleneck shifted from ${humanizeLabel(plan.authoringFocusSkill)} to ${humanizeLabel(focusSkill)}.`,
    };
  }

  const recentOverrides = recentAssignments.filter((assignment) =>
    ['overridden', 'deferred', 'superseded'].includes(String(assignment?.status || ''))
  ).length;
  if (recentOverrides >= 2 && plan.planType !== 'protocol_focused') {
    return {
      shouldSupersede: true,
      reason: 'Repeated state-driven overrides suggest the current block no longer fits the athlete state.',
    };
  }

  if (
    plan.planType === 'sim_focused'
    && (snapshot?.overallReadiness === 'red' || activeProgram?.sessionType === 'recovery_rep')
  ) {
    return {
      shouldSupersede: true,
      reason: 'Current readiness moved into a regulation-first posture that no longer fits a sim-focused block.',
    };
  }

  return { shouldSupersede: false, reason: null };
}

function resolvePlanAuthoringTrigger({
  primaryPlan,
  recentPlans = [],
  profile,
  activeProgram,
  snapshot,
  recentAssignments = [],
  hasBaselineAssessment,
}) {
  if (!hasBaselineAssessment) {
    return {
      shouldAuthor: false,
      trigger: null,
      reason: 'baseline_incomplete',
      exploratoryWindowRepCount: Math.min(
        recentAssignments.filter((assignment) => assignment?.status === 'completed').length,
        MAX_EXPLORATORY_WINDOW
      ),
      lowConfidence: true,
    };
  }

  const completedAssignments = recentAssignments.filter((assignment) => assignment?.status === 'completed');
  const exploratoryWindowRepCount = Math.min(completedAssignments.length, MAX_EXPLORATORY_WINDOW);
  const lowConfidence = !profile?.weakestSkills?.[0] || !activeProgram?.recommendedSimId;

  if (primaryPlan?.status === 'completed') {
    return {
      shouldAuthor: true,
      trigger: 'plan_completed',
      reason: 'Primary plan completed; author the next block from the latest profile.',
      exploratoryWindowRepCount,
      lowConfidence,
    };
  }

  const significantShift = resolveSignificantProfileChange({
    plan: primaryPlan,
    profile,
    activeProgram,
    snapshot,
    recentAssignments,
  });
  if (significantShift.shouldSupersede) {
    return {
      shouldAuthor: true,
      trigger: 'significant_profile_change',
      reason: significantShift.reason,
      exploratoryWindowRepCount,
      lowConfidence,
    };
  }

  if (!primaryPlan) {
    const lastPrimaryPlan = (Array.isArray(recentPlans) ? recentPlans : [])
      .filter((plan) => plan?.isPrimary)
      .sort((left, right) => Number(right?.updatedAt || right?.createdAt || 0) - Number(left?.updatedAt || left?.createdAt || 0))[0];

    if (
      lowConfidence
      && lastPrimaryPlan?.planType === 'assessment'
      && exploratoryWindowRepCount >= DEFAULT_EXPLORATORY_WINDOW
    ) {
      return {
        shouldAuthor: true,
        trigger: 'exploratory_window_complete',
        reason: 'Exploratory window completed after an assessment cycle; author a starter block instead of repeating assessment.',
        exploratoryWindowRepCount,
        lowConfidence,
      };
    }

    if (lowConfidence && exploratoryWindowRepCount < DEFAULT_EXPLORATORY_WINDOW) {
      return {
        shouldAuthor: false,
        trigger: null,
        reason: 'awaiting_exploratory_window',
        exploratoryWindowRepCount,
        lowConfidence,
      };
    }

    return {
      shouldAuthor: true,
      trigger: lowConfidence ? 'exploratory_window_complete' : 'baseline_complete',
      reason: lowConfidence
        ? 'Exploratory window completed; author the first plan from the calibration reps.'
        : 'Baseline complete and no primary plan exists.',
      exploratoryWindowRepCount,
      lowConfidence,
    };
  }

  return {
    shouldAuthor: false,
    trigger: null,
    reason: 'primary_plan_still_valid',
    exploratoryWindowRepCount,
    lowConfidence,
  };
}

function buildTrainingPlan({
  athleteId,
  assignedBy = 'nora',
  coachId,
  trigger,
  profile,
  activeProgram,
  snapshot,
  sourceDate,
  timezone,
  sourceStateSnapshotId,
  sourceProfileSnapshotId,
  sourceProgramPrescriptionId,
  sourceProgramGeneratedAt,
  exploratoryWindowRepCount = 0,
  lowConfidence = false,
  recentPlans = [],
  liveSimRegistry,
  liveProtocolRegistry,
  now = Date.now(),
}) {
  const focusSkill = resolveFocusSkill(profile);
  const primarySimId = resolvePrimarySimId(focusSkill, activeProgram);
  const avoidAssessmentLoop = shouldAvoidAssessmentLoop({
    recentPlans,
    trigger,
    assignedBy,
  });
  const planType = resolvePlanType({
    activeProgram,
    snapshot,
    lowConfidence,
    avoidAssessmentLoop,
  });
  const archetype = resolveArchetype({
    planType,
    primarySimId,
    focusSkill,
    liveSimRegistry,
    liveProtocolRegistry,
  });
  const planId = buildTrainingPlanId(athleteId, assignedBy, now);
  const steps = archetype.buildSteps(planId);

  const plan = {
    id: planId,
    athleteId,
    title: archetype.title,
    goal: archetype.goal,
    planType,
    status: 'active',
    isPrimary: true,
    progressMode: archetype.progressMode,
    targetCount: archetype.targetCount,
    completedCount: 0,
    steps,
    assignedBy,
    coachId: coachId || undefined,
    targetSkills: [focusSkill],
    authoringTrigger: trigger,
    authoringFocusSkill: focusSkill,
    archetypeId: archetype.archetypeId,
    archetypeVersion: ARCHETYPE_VERSION,
    authoringRulesVersion: AUTHORING_RULES_VERSION,
    sourceStateSnapshotId: sourceStateSnapshotId || undefined,
    sourceProfileSnapshotId: sourceProfileSnapshotId || null,
    sourceProgramPrescriptionId: sourceProgramPrescriptionId || null,
    sourceProgramGeneratedAt: typeof sourceProgramGeneratedAt === 'number' ? sourceProgramGeneratedAt : null,
    sourceDailyTaskId: undefined,
    sourceDate,
    timezone,
    startDate: sourceDate,
    endDate: null,
    cadence: archetype.progressMode === 'days' ? 'daily' : 'session_progression',
    primaryPlanMetric: humanizeLabel(focusSkill),
    latestResultSummary: null,
    latestResultAt: null,
    exploratoryWindowRepCount,
    inventoryFallbackReason: archetype.inventoryFallbackReason,
    supersededByPlanId: null,
    supersededReason: null,
    pausedAt: null,
    resumedAt: null,
    createdAt: now,
    updatedAt: now,
  };

  return syncTrainingPlanProgression(plan);
}

module.exports = {
  ARCHETYPE_VERSION,
  AUTHORING_RULES_VERSION,
  DEFAULT_EXPLORATORY_WINDOW,
  MAX_EXPLORATORY_WINDOW,
  SIM_LIBRARY,
  PROTOCOL_LIBRARY,
  buildProgramPrescriptionId,
  buildTrainingPlan,
  buildTrainingPlanId,
  humanizeLabel,
  resolveArchetype,
  resolvePlanAuthoringTrigger,
  resolvePlanType,
  resolvePrimarySimId,
  resolveSecondarySimId,
  resolveSignificantProfileChange,
  resolveNextDuePlanStep,
  resolveFocusSkill,
  syncTrainingPlanProgression,
};
