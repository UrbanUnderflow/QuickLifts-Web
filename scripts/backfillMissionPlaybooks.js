#!/usr/bin/env node

/**
 * Backfill mission playbook/admission fields onto mission, task, and outcome records.
 *
 * Usage:
 *   node scripts/backfillMissionPlaybooks.js --dry-run
 *   node scripts/backfillMissionPlaybooks.js --mission-id=<missionId> --dry-run
 *   node scripts/backfillMissionPlaybooks.js --mission-id=<missionId> --apply
 *
 * Notes:
 * - Defaults to dry-run. Pass --apply to write Firestore patches.
 * - Prefers ./serviceAccountKey.json at repo root and falls back to ADC.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { initializeApp, applicationDefault, cert, getApps } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const {
  OUTCOME_COLLECTION,
  normalizeMissionPolicy,
  toMillis,
  buildTaskAdmission,
  inferTaskActionType,
} = require('./missionOsV2');
const {
  getMissionPlaybook,
  resolveMissionPlaybook,
} = require('./missionPlaybooks');
const {
  buildCanaryMissionInstancePolicy,
  resolveMissionInstancePolicy,
} = require('./missionPolicies');
const {
  mapScoreBuckets,
} = require('./missionReadiness');
const {
  buildMissionReplayPatch,
  loadMissionRecord,
} = require('./replayMissionOutcomeSummary');

const TASK_COLLECTION = 'agent-tasks';
const MISSION_DOC = 'company-config/mission-status';
const MISSION_RUNS = 'mission-runs';

function parseArgs(argv) {
  const apply = argv.includes('--apply');
  const explicitDryRun = argv.includes('--dry-run');
  const args = {
    apply,
    dryRun: explicitDryRun || !apply,
    missionId: '',
    limit: 0,
  };

  for (const arg of argv) {
    if (arg.startsWith('--mission-id=')) args.missionId = arg.split('=')[1]?.trim() || '';
    if (arg.startsWith('--limit=')) args.limit = Number.parseInt(arg.split('=')[1] || '0', 10) || 0;
  }

  return args;
}

function initAdminApp() {
  if (getApps().length > 0) return getApps()[0];

  const keyPath = path.join(__dirname, '..', 'serviceAccountKey.json');
  if (fs.existsSync(keyPath)) {
    return initializeApp({
      credential: cert(require(keyPath)),
    }, 'mission-playbook-backfill');
  }

  return initializeApp({
    credential: applicationDefault(),
  }, 'mission-playbook-backfill');
}

function normalizeText(value) {
  return String(value || '').trim();
}

function normalizeArray(value) {
  return Array.isArray(value) ? value : [];
}

function roundScore(value) {
  const parsed = Number(value || 0);
  if (!Number.isFinite(parsed)) return 0;
  return Math.round(parsed * 100) / 100;
}

function stripUndefinedDeep(value) {
  if (Array.isArray(value)) {
    return value.map((item) => stripUndefinedDeep(item));
  }
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, entryValue]) => entryValue !== undefined)
        .map(([key, entryValue]) => [key, stripUndefinedDeep(entryValue)])
    );
  }
  return value;
}

function slugify(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function buildMissionPolicyLayer(mission) {
  if (mission?.canary) return buildCanaryMissionInstancePolicy(mission, { missionId: mission?.missionId });
  return resolveMissionInstancePolicy(mission, { missionId: mission?.missionId });
}

function findActionPolicy(playbook, actionType) {
  if (!playbook || !actionType) return null;
  const normalized = normalizeText(actionType);
  return normalizeArray(playbook.actionPolicies).find((policy) =>
    normalizeText(policy?.actionType) === normalized || normalizeText(policy?.id) === normalized
  ) || null;
}

function inferActionPolicy(playbook, task) {
  if (!playbook) return { actionPolicy: null, matchMethod: 'none' };

  const explicitCandidates = [
    task?.playbookActionType,
    task?.actionType,
    task?.actionPolicyId,
    task?.taskType,
    task?.metadata?.actionType,
  ].map(normalizeText).filter(Boolean);

  for (const candidate of explicitCandidates) {
    const actionPolicy = findActionPolicy(playbook, candidate);
    if (actionPolicy) return { actionPolicy, matchMethod: 'explicit' };
  }

  const runtimeInferred = normalizeText(inferTaskActionType(task));
  if (runtimeInferred && runtimeInferred !== 'unspecified-execute-action') {
    const actionPolicy = findActionPolicy(playbook, runtimeInferred);
    if (actionPolicy) return { actionPolicy, matchMethod: 'inferred' };
  }

  const haystack = slugify([task?.name, task?.description].filter(Boolean).join(' '));
  if (!haystack) return { actionPolicy: null, matchMethod: 'none' };

  const matches = normalizeArray(playbook.actionPolicies)
    .map((policy) => {
      const actionType = slugify(policy.actionType);
      const labelTokens = slugify(policy.label).split('-').filter((token) => token.length >= 4);
      const direct = actionType && haystack.includes(actionType);
      const labelMatch = labelTokens.length > 0 && labelTokens.every((token) => haystack.includes(token));
      const score = direct ? 100 : (labelMatch ? labelTokens.length : 0);
      return { policy, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score);

  if (matches.length === 1) return { actionPolicy: matches[0].policy, matchMethod: 'inferred' };
  if (matches.length > 1 && matches[0].score > matches[1].score) return { actionPolicy: matches[0].policy, matchMethod: 'inferred' };
  return { actionPolicy: null, matchMethod: matches.length > 0 ? 'ambiguous' : 'none' };
}

function mergeApprovalEvents(missionContext, task) {
  return [
    ...normalizeArray(missionContext?.approvalEvents),
    ...normalizeArray(task?.approvalEvents),
  ];
}

function buildScoreItem(task, outcome, actionPolicy) {
  const score = outcome?.score || {};
  const creditedOutcomeScore = Number(
    score?.creditedOutcomeScore ??
    task?.expectedCreditedScore ??
    task?.creditedOutcomeScore ??
    0
  ) || 0;
  const netOutcomeScore = Number(
    score?.netOutcomeScore ??
    task?.expectedNetScore ??
    task?.netOutcomeScore ??
    creditedOutcomeScore
  ) || 0;
  const businessDebtScore = Number(
    score?.businessDebtScore ??
    task?.businessDebtScore ??
    0
  ) || 0;

  return {
    id: outcome?.id || task?.outcomeId || task?.id,
    score: {
      creditedOutcomeScore,
      netOutcomeScore,
      businessDebtScore,
    },
    sideEffectClass: normalizeText(task?.sideEffectClass || actionPolicy?.sideEffectClass),
    speculative: Boolean(task?.speculative),
    commercialCreditEligible: task?.commercialCreditEligible,
    creditBucket: normalizeText(task?.creditBucket),
    actionPolicy: actionPolicy || {},
  };
}

function resolveCleanupBy(task, actionPolicy) {
  if (task?.cleanupBy) return task.cleanupBy;
  const ttlHours = Number(actionPolicy?.cleanupTTLHours || 0) || 0;
  const anchorMs = toMillis(task?.createdAt) || toMillis(task?.updatedAt);
  if (!ttlHours || !anchorMs) return null;
  return new Date(anchorMs + (ttlHours * 60 * 60 * 1000));
}

function buildTaskAdmissionPatch({ task, outcome, missionContext, missionPolicyLayer, runtimeMissionPolicy, playbook, now }) {
  const { actionPolicy, matchMethod } = inferActionPolicy(playbook, task);
  const basePatch = {
    playbookId: missionContext.playbookId || null,
    playbookVersion: missionContext.playbookVersion || 0,
    playbookFamily: missionContext.playbookFamily || null,
    currentStageId: normalizeText(task?.currentStageId || missionContext.currentStageId) || null,
    currentStageOrdinal: Number(task?.currentStageOrdinal || missionContext.currentStageOrdinal || 0) || 0,
    readinessSignals: normalizeArray(task?.readinessSignals).length > 0 ? task.readinessSignals : missionContext.readinessSignals,
    playbookMatchMethod: matchMethod,
  };

  if (!actionPolicy) {
    return {
      taskPatch: basePatch,
      outcomePatch: basePatch,
      actionPolicy: null,
      admission: null,
      matchMethod,
    };
  }

  const requiredStage = normalizeArray(playbook?.stageGraph).find((stage) => stage.id === actionPolicy.requiredStageId) || null;
  const expectedCreditedScore = Number(
    outcome?.score?.creditedOutcomeScore ??
    task?.expectedCreditedScore ??
    task?.creditedOutcomeScore ??
    0
  ) || 0;
  const expectedNetScore = Number(
    outcome?.score?.netOutcomeScore ??
    task?.expectedNetScore ??
    task?.netOutcomeScore ??
    expectedCreditedScore
  ) || 0;
  const businessDebtScore = Number(
    outcome?.score?.businessDebtScore ??
    task?.businessDebtScore ??
    0
  ) || 0;
  const effectiveMissionPolicy = {
    ...runtimeMissionPolicy,
    missionId: normalizeText(task?.missionId || missionContext.missionId || runtimeMissionPolicy?.missionId),
    playbookId: missionContext.playbookId || runtimeMissionPolicy?.playbookId || missionPolicyLayer.playbookId || playbook?.id || '',
    playbookVersion: Number(missionContext.playbookVersion || runtimeMissionPolicy?.playbookVersion || missionPolicyLayer.playbookVersion || playbook?.version || 0) || 0,
    playbookFamily: missionContext.playbookFamily || runtimeMissionPolicy?.playbookFamily || playbook?.family || '',
    currentStageId: normalizeText(task?.currentStageId || missionContext.currentStageId || runtimeMissionPolicy?.currentStageId),
    currentStageOrdinal: Number(task?.currentStageOrdinal || missionContext.currentStageOrdinal || runtimeMissionPolicy?.currentStageOrdinal || 0) || 0,
    readinessSignals: normalizeArray(task?.readinessSignals).length > 0 ? task.readinessSignals : missionContext.readinessSignals,
    approvalEvents: mergeApprovalEvents(missionContext, task),
    executeGateMode: missionPolicyLayer.executeGateMode === 'allow-speculative' ? 'allow-speculative' : (runtimeMissionPolicy?.executeGateMode || 'strict'),
    scoreGateMode: runtimeMissionPolicy?.scoreGateMode || missionPolicyLayer?.scoreGateMode || 'credited-and-net',
    cleanupTTLHours: Number(missionPolicyLayer.cleanupTTLHours || runtimeMissionPolicy?.cleanupTTLHours || 0) || 0,
    allowSpeculative: Boolean(
      runtimeMissionPolicy?.allowSpeculative
      || missionPolicyLayer.executeGateMode === 'allow-speculative'
      || normalizeArray(missionPolicyLayer.speculativeActionsAllowed).includes(actionPolicy.actionType)
    ),
  };
  const admissionFields = buildTaskAdmission(
    {
      ...task,
      actionType: actionPolicy.actionType,
      sideEffectClass: task?.sideEffectClass || actionPolicy.sideEffectClass,
    },
    {
      missionPolicy: effectiveMissionPolicy,
      actionType: actionPolicy.actionType,
      outcomeId: normalizeText(task?.outcomeId || outcome?.id),
      expectedCreditedScore,
      expectedNetScore,
      expectedOutcomeScore: expectedNetScore,
      proofCompileStatus: task?.proofCompileStatus || 'dry-run-passed',
      approvalEvents: mergeApprovalEvents(missionContext, task),
      now,
    }
  );
  const admission = admissionFields.admissionDecision || null;
  const scoreSummary = mapScoreBuckets([{
    id: outcome?.id || task?.outcomeId || task?.id,
    score: {
      creditedOutcomeScore: expectedCreditedScore,
      netOutcomeScore: expectedNetScore,
      businessDebtScore,
    },
    sideEffectClass: admissionFields.sideEffectClass,
    speculative: admissionFields.speculative,
    commercialCreditEligible: admissionFields.commercialCreditEligible,
    creditBucket: admissionFields.creditBucket,
    stageGateStatus: admissionFields.stageGateStatus,
    actionPolicy,
  }]);

  const patch = {
    ...basePatch,
    playbookActionType: actionPolicy.actionType,
    requiredStageId: actionPolicy.requiredStageId || null,
    requiredStageOrdinal: Number(requiredStage?.ordinal || 0) || 0,
    requiredReadinessSignalIds: admission?.missingReadinessSignalIds?.length > 0
      ? Array.from(new Set([...(actionPolicy.requiredReadinessSignalIds || []), ...(admission.missingReadinessSignalIds || [])]))
      : (actionPolicy.requiredReadinessSignalIds || []),
    requiredApprovalTypes: actionPolicy.requiredApprovalTypes || [],
    requiredApprovalEventIds: admission?.requiredApprovalEventIds || [],
    stageGateStatus: admissionFields.stageGateStatus,
    stageBlockReasonCode: admission?.blockReasonCode || null,
    stageBlockReasonDetail: admission?.blockReasonDetail || null,
    scoreGateStatus: admission?.scoreGateStatus || 'failed',
    sideEffectClass: admissionFields.sideEffectClass,
    creditBucket: admissionFields.creditBucket,
    commercialCreditEligible: admissionFields.commercialCreditEligible,
    speculative: admissionFields.speculative,
    speculativeLifecycleState: task?.speculativeLifecycleState || (admissionFields.speculative ? 'speculative-created' : 'none'),
    cleanupState: admissionFields.cleanupState,
    cleanupBy: admissionFields.cleanupBy || null,
    executionScore: roundScore(scoreSummary.executionScore),
    commercialMovementScore: roundScore(scoreSummary.commercialMovementScore),
    admissionVersion: admission?.admissionVersion,
    admitExecuteTask: admission?.admitExecuteTask ?? false,
    actionType: actionPolicy.actionType,
    currentStageId: admissionFields.currentStageId || basePatch.currentStageId,
    emittedReadinessSignalIds: admissionFields.emittedReadinessSignalIds || [],
    admissionDecision: admission || null,
  };

  return {
    taskPatch: patch,
    outcomePatch: patch,
    actionPolicy,
    admission,
    matchMethod,
  };
}

async function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const db = getFirestore(initAdminApp());
  const mission = await loadMissionRecord(db, args.missionId);
  const missionId = normalizeText(args.missionId || mission?.missionId);

  if (!missionId) {
    throw new Error('Missing mission id. Pass --mission-id=<missionId> or set a current mission in company-config/mission-status.');
  }

  const missionPolicyLayer = buildMissionPolicyLayer({ ...mission, missionId });
  const runtimeMissionPolicy = normalizeMissionPolicy({ ...mission, missionId });
  const playbook = resolveMissionPlaybook({ playbookId: missionPolicyLayer.playbookId, canary: missionPolicyLayer.canary })
    || getMissionPlaybook();

  const outcomeSnap = await db.collection(OUTCOME_COLLECTION).where('missionId', '==', missionId).get();
  const outcomes = outcomeSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  const outcomesById = new Map(outcomes.map((outcome) => [normalizeText(outcome.id), outcome]));
  const tasksById = new Map();
  const missionContext = {
    ...buildMissionReplayPatch({
      mission: { ...mission, missionId },
      outcomes,
      tasks: [],
      now: new Date(),
    }),
    missionId,
    approvalEvents: mission?.approvalEvents || [],
  };

  const taskSnap = await db.collection(TASK_COLLECTION).where('missionId', '==', missionId).get();
  const tasks = taskSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  for (const task of tasks) tasksById.set(task.id, { ...task });
  const selectedTasks = args.limit > 0 ? tasks.slice(0, args.limit) : tasks;

  let matched = 0;
  let unmatched = 0;
  let ambiguous = 0;
  let updatedOutcomes = 0;

  for (const task of selectedTasks) {
    const outcome = outcomesById.get(normalizeText(task?.outcomeId)) || null;
    const result = buildTaskAdmissionPatch({
      task,
      outcome,
      missionContext,
      missionPolicyLayer,
      runtimeMissionPolicy,
      playbook,
      now: new Date(),
    });

    if (result.matchMethod === 'explicit' || result.matchMethod === 'inferred') matched += 1;
    else if (result.matchMethod === 'ambiguous') ambiguous += 1;
    else unmatched += 1;

    const mutableTask = tasksById.get(task.id);
    if (mutableTask) Object.assign(mutableTask, result.taskPatch);
    if (outcome?.id) {
      const mutableOutcome = outcomesById.get(normalizeText(outcome.id));
      if (mutableOutcome) Object.assign(mutableOutcome, result.outcomePatch);
    }

    if (args.dryRun) {
      console.log([
        `🧪 ${task.id}`,
        `   task="${task.name || 'Untitled task'}"`,
        `   playbook=${result.taskPatch.playbookId || '—'}`,
        `   action=${result.taskPatch.playbookActionType || '—'} (${result.matchMethod})`,
        `   gate=${result.taskPatch.stageGateStatus || '—'}`,
        `   score=${result.taskPatch.scoreGateStatus || '—'}`,
        `   admit=${result.taskPatch.admitExecuteTask ?? '—'}`,
      ].join('\n'));
      continue;
    }

    const batch = db.batch();
    batch.set(db.collection(TASK_COLLECTION).doc(task.id), {
      ...stripUndefinedDeep(result.taskPatch),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    if (outcome?.id) {
      updatedOutcomes += 1;
      batch.set(db.collection(OUTCOME_COLLECTION).doc(outcome.id), {
        ...stripUndefinedDeep(result.outcomePatch),
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
    }

    await batch.commit();
  }

  if (!args.dryRun) {
    const refreshedMissionSummary = buildMissionReplayPatch({
      mission: { ...mission, missionId },
      outcomes: Array.from(outcomesById.values()),
      tasks: Array.from(tasksById.values()),
      now: new Date(),
    });
    const missionPatch = stripUndefinedDeep({
      missionId,
      ...refreshedMissionSummary,
      updatedAt: FieldValue.serverTimestamp(),
    });
    await db.doc(MISSION_DOC).set(missionPatch, { merge: true });
    await db.collection(MISSION_RUNS).doc(missionId).set(missionPatch, { merge: true });
  }

  const modeLabel = args.dryRun ? 'dry run' : 'write run';
  console.log(`\n✅ Mission playbook backfill ${modeLabel} complete.`);
  console.log(`   Mission: ${missionId}`);
  console.log(`   Tasks scanned: ${selectedTasks.length}`);
  console.log(`   Matched action policies: ${matched}`);
  console.log(`   Ambiguous task matches: ${ambiguous}`);
  console.log(`   Unmatched tasks: ${unmatched}`);
  console.log(`   Linked outcomes updated: ${args.dryRun ? 'dry-run' : updatedOutcomes}`);
}

if (require.main === module) {
  main().catch((err) => {
    console.error('❌ Mission playbook backfill failed:', err?.message || err);
    process.exit(1);
  });
}

module.exports = {
  MISSION_DOC,
  MISSION_RUNS,
  TASK_COLLECTION,
  buildMissionPolicyLayer,
  buildScoreItem,
  buildTaskAdmissionPatch,
  inferActionPolicy,
  initAdminApp,
  main,
  mergeApprovalEvents,
  parseArgs,
  resolveCleanupBy,
};
