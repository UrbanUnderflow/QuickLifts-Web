'use strict';

const {
  normalizeString,
  normalizeArray,
  normalizeMissionInstancePolicy,
  normalizeResolvedReadinessSignal,
  normalizeExecuteGateMode,
  normalizeScoreGateMode,
} = require('./missionAdmissionTypes');
const {
  EXTERNAL_ACCOUNT_ACTIVATION_PLAYBOOK_ID,
  getMissionPlaybook,
  resolveMissionPlaybook,
} = require('./missionPlaybooks');

const DEFAULT_COMMERCIAL_PRIMARY_DOMAIN = 'activation';
const DEFAULT_CLEANUP_TTL_HOURS = 24;
const CANARY_SPECULATIVE_ACTIONS = Object.freeze([
  'preprovision-org-team-shell',
  'reserve-admin-membership',
]);

function resolveMissionPlaybookId(rawMission = {}, overrides = {}) {
  const explicit = normalizeString(overrides.playbookId || rawMission.playbookId || rawMission.playbookRef);
  if (explicit) return explicit;
  if (Boolean(overrides.canary ?? rawMission.canary)) return EXTERNAL_ACCOUNT_ACTIVATION_PLAYBOOK_ID;
  return '';
}

function seedReadinessSignalsFromPlaybook(playbook, existingSignals = []) {
  const signalsById = new Map(
    normalizeArray(existingSignals)
      .map(normalizeResolvedReadinessSignal)
      .filter((signal) => signal.id)
      .map((signal) => [signal.id, signal])
  );

  for (const template of normalizeArray(playbook?.readinessSignalTemplates)) {
    const templateId = normalizeString(template?.id);
    if (!templateId) continue;
    if (!signalsById.has(templateId)) {
      signalsById.set(templateId, normalizeResolvedReadinessSignal({
        id: templateId,
        label: template.label,
        state: 'missing',
        proofTemplateId: template.proofTemplateId,
        sourceOfTruth: template.sourceOfTruth,
        successEvent: template.successEvent,
        freshnessMinutes: template.freshnessMinutes,
      }));
    }
  }

  return Array.from(signalsById.values());
}

function buildMissionInstancePolicy(rawMission = {}, overrides = {}) {
  const playbookId = resolveMissionPlaybookId(rawMission, overrides);
  const playbook = playbookId ? resolveMissionPlaybook({ playbookId }) : null;
  const readinessSignals = seedReadinessSignalsFromPlaybook(playbook, overrides.readinessSignals || rawMission.readinessSignals);
  const currentStageId = normalizeString(
    overrides.currentStageId ||
    rawMission.currentStageId ||
    playbook?.stageGraph?.[0]?.id ||
    ''
  );
  const currentStageOrdinal = Number(
    overrides.currentStageOrdinal ||
    rawMission.currentStageOrdinal ||
    playbook?.stageGraph?.find((stage) => stage.id === currentStageId)?.ordinal ||
    0
  ) || 0;

  return normalizeMissionInstancePolicy({
    missionId: normalizeString(overrides.missionId || rawMission.missionId),
    playbookId,
    playbookVersion: Number(playbook?.version || overrides.playbookVersion || rawMission.playbookVersion || 0) || 0,
    playbookFamily: normalizeString(playbook?.family),
    currentStageId,
    currentStageOrdinal,
    readinessSignals,
    speculativeActionsAllowed: normalizeArray(overrides.speculativeActionsAllowed || rawMission.speculativeActionsAllowed),
    requiredApprovals: normalizeArray(overrides.requiredApprovals || rawMission.requiredApprovals),
    commercialPrimaryDomain: normalizeString(overrides.commercialPrimaryDomain || rawMission.commercialPrimaryDomain || playbook?.primaryDomain || DEFAULT_COMMERCIAL_PRIMARY_DOMAIN),
    cleanupTTLHours: Number(overrides.cleanupTTLHours || rawMission.cleanupTTLHours || DEFAULT_CLEANUP_TTL_HOURS) || DEFAULT_CLEANUP_TTL_HOURS,
    executeGateMode: normalizeExecuteGateMode(overrides.executeGateMode || rawMission.executeGateMode || 'strict'),
    scoreGateMode: normalizeScoreGateMode(overrides.scoreGateMode || rawMission.scoreGateMode || 'credited-and-net'),
    canary: Boolean(overrides.canary ?? rawMission.canary),
    allowSpeculative: Boolean(overrides.allowSpeculative ?? rawMission.allowSpeculative),
    targetEntityPolicy: overrides.targetEntityPolicy || rawMission.targetEntityPolicy || {},
    notes: normalizeString(overrides.notes || rawMission.notes),
  });
}

function buildCanaryMissionInstancePolicy(rawMission = {}, overrides = {}) {
  const missionPolicy = buildMissionInstancePolicy(rawMission, {
    ...overrides,
    canary: true,
    playbookId: overrides.playbookId || rawMission.playbookId || EXTERNAL_ACCOUNT_ACTIVATION_PLAYBOOK_ID,
    executeGateMode: 'allow-speculative',
    cleanupTTLHours: Number(overrides.cleanupTTLHours || rawMission.cleanupTTLHours || 336) || 336,
    speculativeActionsAllowed: Array.from(new Set([
      ...CANARY_SPECULATIVE_ACTIONS,
      ...normalizeArray(overrides.speculativeActionsAllowed || rawMission.speculativeActionsAllowed),
    ])),
    commercialPrimaryDomain: normalizeString(overrides.commercialPrimaryDomain || rawMission.commercialPrimaryDomain || DEFAULT_COMMERCIAL_PRIMARY_DOMAIN),
  });

  return {
    ...missionPolicy,
    canary: true,
    executeGateMode: 'allow-speculative',
    speculativeActionsAllowed: Array.from(new Set([
      ...CANARY_SPECULATIVE_ACTIONS,
      ...normalizeArray(missionPolicy.speculativeActionsAllowed),
    ])),
  };
}

function resolveMissionInstancePolicy(rawMission = {}, overrides = {}) {
  return buildMissionInstancePolicy(rawMission, overrides);
}

module.exports = {
  CANARY_SPECULATIVE_ACTIONS,
  resolveMissionPlaybookId,
  resolveMissionPlaybook,
  seedReadinessSignalsFromPlaybook,
  buildMissionInstancePolicy,
  buildCanaryMissionInstancePolicy,
  resolveMissionInstancePolicy,
};
