#!/usr/bin/env node

/**
 * Rebuild mission outcome summary fields from agent-outcomes and sequencing state.
 *
 * Usage:
 *   node scripts/replayMissionOutcomeSummary.js --dry-run
 *   node scripts/replayMissionOutcomeSummary.js --mission-id=<missionId> --dry-run
 *   node scripts/replayMissionOutcomeSummary.js --mission-id=<missionId> --advance-observations --apply
 *
 * Notes:
 * - Defaults to dry-run. Pass --apply to write mission-status / mission-runs patches.
 * - Prefers ./serviceAccountKey.json at repo root and falls back to ADC.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { initializeApp, applicationDefault, cert, getApps } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const {
  OUTCOME_COLLECTION,
  summarizeMissionOutcomes,
  advanceOutcomeObservation,
  normalizeMissionPolicy,
} = require('./missionOsV2');
const {
  buildCanaryMissionInstancePolicy,
  resolveMissionInstancePolicy,
} = require('./missionPolicies');
const {
  resolveMissionPlaybook,
} = require('./missionPlaybooks');
const {
  buildSpeculativeLifecycleSnapshot,
  evaluateStageGate,
  evaluateStageRegression,
  mapScoreBuckets,
  resolveReadinessSignals,
} = require('./missionReadiness');

const MISSION_DOC = 'company-config/mission-status';
const MISSION_RUNS = 'mission-runs';
const TASK_COLLECTION = 'agent-tasks';

function parseArgs(argv) {
  const apply = argv.includes('--apply');
  const explicitDryRun = argv.includes('--dry-run');
  const args = {
    apply,
    dryRun: explicitDryRun || !apply,
    advanceObservations: argv.includes('--advance-observations'),
    missionId: '',
  };

  for (const arg of argv) {
    if (arg.startsWith('--mission-id=')) args.missionId = arg.split('=')[1]?.trim() || '';
  }

  return args;
}

function initAdminApp() {
  if (getApps().length > 0) return getApps()[0];

  const keyPath = path.join(__dirname, '..', 'serviceAccountKey.json');
  if (fs.existsSync(keyPath)) {
    return initializeApp({
      credential: cert(require(keyPath)),
    }, 'mission-outcome-replay');
  }

  return initializeApp({
    credential: applicationDefault(),
  }, 'mission-outcome-replay');
}

function normalizeText(value) {
  return String(value || '').trim();
}

function normalizeScoreGateMode(value, fallback = 'credited-and-net') {
  const normalized = normalizeText(value).toLowerCase();
  if (normalized === 'credited-only' || normalized === 'net-only' || normalized === 'credited-and-net') return normalized;
  return fallback;
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

async function loadMissionRecord(db, missionId) {
  const missionSnap = await db.doc(MISSION_DOC).get();
  const currentMission = missionSnap.exists ? (missionSnap.data() || {}) : {};
  const currentMissionId = normalizeText(currentMission.missionId);
  if (!missionId || missionId === currentMissionId) return currentMission;

  const runSnap = await db.collection(MISSION_RUNS).doc(missionId).get();
  if (runSnap.exists) {
    return {
      ...runSnap.data(),
      missionId,
    };
  }

  return {
    ...currentMission,
    missionId,
  };
}

function resolveMissionPolicyLayer(mission) {
  if (mission?.canary) return buildCanaryMissionInstancePolicy(mission, { missionId: mission?.missionId });
  return resolveMissionInstancePolicy(mission, { missionId: mission?.missionId });
}

function deriveCurrentStageFromReadiness(stageGraph = [], readinessSignals = [], fallbackStageId = '') {
  const stages = Array.isArray(stageGraph) ? [...stageGraph] : [];
  if (stages.length === 0) return { currentStageId: normalizeText(fallbackStageId), currentStageOrdinal: 0 };

  const stateBySignalId = new Map(
    readinessSignals.map((signal) => [normalizeText(signal?.id), normalizeText(signal?.state).toLowerCase()])
  );

  const satisfiedStages = stages.filter((stage) =>
    Array.isArray(stage.entrySignalIds) &&
    stage.entrySignalIds.every((signalId) => {
      const state = stateBySignalId.get(normalizeText(signalId));
      return state === 'verified' || state === 'waived';
    })
  );

  const currentStage = satisfiedStages.sort((left, right) => (Number(right.ordinal || 0) || 0) - (Number(left.ordinal || 0) || 0))[0]
    || stages.find((stage) => stage.id === fallbackStageId)
    || stages[0];

  return {
    currentStageId: normalizeText(currentStage?.id),
    currentStageOrdinal: Number(currentStage?.ordinal || 0) || 0,
  };
}

function deriveScoreGateStatus({ mission, missionPolicy, scoreSummary }) {
  const runtimePolicy = normalizeMissionPolicy(mission || {});
  const scoreGateMode = normalizeScoreGateMode(
    missionPolicy?.scoreGateMode || runtimePolicy.executeGateMode,
    runtimePolicy.executeGateMode === 'credited-only' || runtimePolicy.executeGateMode === 'net-only'
      ? runtimePolicy.executeGateMode
      : 'credited-and-net'
  );
  const credited = Number(scoreSummary?.creditedOutcomeScore || 0) || 0;
  const net = Number(scoreSummary?.netOutcomeScore || 0) || 0;

  switch (scoreGateMode) {
    case 'credited-only':
      return credited >= Number(runtimePolicy.plannerMinimumCreditedScore || 0) ? 'passed' : 'failed';
    case 'net-only':
      return net >= Number(runtimePolicy.plannerMinimumNetScore || 0) ? 'passed' : 'failed';
    case 'credited-and-net':
    default:
      return credited >= Number(runtimePolicy.plannerMinimumCreditedScore || 0)
        && net >= Number(runtimePolicy.plannerMinimumNetScore || 0)
        ? 'passed'
        : 'failed';
  }
}

function normalizeOutcomeForBuckets(outcome) {
  const sideEffectClass = normalizeText(outcome?.sideEffectClass)
    || (normalizeText(outcome?.creditBucket).toLowerCase() === 'commercial' ? 'external-durable' : 'internal-durable');
  const speculative = Boolean(outcome?.speculative || outcome?.lifecycle?.speculative);
  const creditBucket = normalizeText(outcome?.creditBucket)
    || (sideEffectClass === 'external-durable' && !speculative ? 'commercial' : 'execution');

  return {
    ...outcome,
    sideEffectClass,
    speculative,
    creditBucket,
    score: outcome?.score || {
      creditedOutcomeScore: Number(outcome?.creditedOutcomeScore || 0) || 0,
      netOutcomeScore: Number(outcome?.netOutcomeScore || 0) || 0,
      businessDebtScore: Number(outcome?.businessDebtScore || 0) || 0,
    },
  };
}

function taskCountsAsVerified(task = {}) {
  const status = normalizeText(task?.status).toLowerCase();
  const verificationState = normalizeText(task?.verificationStatus || task?.verificationState).toLowerCase();
  return (
    status === 'done' ||
    verificationState === 'verified' ||
    verificationState === 'verified-auto' ||
    verificationState === 'verified-human'
  );
}

function mergeReadinessSignalsFromTasks(existingSignals = [], tasks = [], now = new Date()) {
  const byId = new Map(
    (Array.isArray(existingSignals) ? existingSignals : [])
      .filter((signal) => normalizeText(signal?.id))
      .map((signal) => [normalizeText(signal.id), { ...signal }])
  );

  for (const task of Array.isArray(tasks) ? tasks : []) {
    if (!taskCountsAsVerified(task)) continue;
    const emittedSignalIds = Array.isArray(task?.emittedReadinessSignalIds)
      ? task.emittedReadinessSignalIds.map((item) => normalizeText(item)).filter(Boolean)
      : [];
    if (emittedSignalIds.length === 0) continue;
    const verifiedAt = task?.doneAt || task?.verifiedAt || task?.updatedAt || now;

    for (const signalId of emittedSignalIds) {
      const previous = byId.get(signalId) || { id: signalId, label: signalId };
      byId.set(signalId, {
        ...previous,
        id: signalId,
        state: 'verified',
        verifiedAt,
        reason: previous.reason || 'verified-by-task',
        metadata: {
          ...(previous.metadata || {}),
          verifiedByTaskId: task.id || null,
          verifiedByTaskName: task.name || null,
        },
        sourceSnapshot: previous.sourceSnapshot || {
          taskId: task.id || null,
          taskName: task.name || null,
        },
      });
    }
  }

  return Array.from(byId.values());
}

function buildMissionReplayPatch({ mission, outcomes = [], tasks = [], now = new Date() }) {
  const missionPolicy = resolveMissionPolicyLayer(mission || {});
  const playbook = resolveMissionPlaybook({ playbookId: missionPolicy.playbookId, canary: missionPolicy.canary });
  const stageGraph = Array.isArray(playbook?.stageGraph) ? playbook.stageGraph : [];
  const mergedReadinessSignals = mergeReadinessSignalsFromTasks(missionPolicy.readinessSignals || [], tasks, now);
  const readinessSignals = resolveReadinessSignals(mergedReadinessSignals, {
    missionPolicy: {
      executeGateMode: missionPolicy.executeGateMode === 'allow-speculative' ? 'allow-speculative' : 'strict',
    },
    approvalEvents: mission?.approvalEvents || [],
    requiredApprovalTypes: missionPolicy.requiredApprovals || [],
    now,
  });
  const stageState = deriveCurrentStageFromReadiness(stageGraph, readinessSignals, missionPolicy.currentStageId);
  const currentStage = stageGraph.find((stage) => stage.id === stageState.currentStageId) || null;
  const stageGate = evaluateStageGate({
    stageGraph,
    currentStageId: stageState.currentStageId,
    requiredStageId: stageState.currentStageId,
    resolvedReadinessSignals: readinessSignals,
    requiredReadinessSignalIds: Array.isArray(currentStage?.entrySignalIds) ? currentStage.entrySignalIds : [],
    approvalEvents: mission?.approvalEvents || [],
    requiredApprovalTypes: missionPolicy.requiredApprovals || [],
    missionPolicy: {
      executeGateMode: missionPolicy.executeGateMode === 'allow-speculative' ? 'allow-speculative' : 'strict',
    },
    sideEffectClass: 'internal-durable',
    allowSpeculative: missionPolicy.executeGateMode === 'allow-speculative' || missionPolicy.allowSpeculative,
    speculative: Boolean(mission?.speculative),
    now,
  });
  const stageRegression = evaluateStageRegression({
    stageGraph,
    currentStageId: stageState.currentStageId,
    resolvedReadinessSignals: readinessSignals,
    now,
  });
  const scoreSummary = mapScoreBuckets(outcomes.map(normalizeOutcomeForBuckets));
  const scoreGateStatus = deriveScoreGateStatus({ mission, missionPolicy, scoreSummary });
  const lifecycle = buildSpeculativeLifecycleSnapshot({
    speculative: Boolean(mission?.speculative || stageGate.status === 'speculative' || outcomes.some((outcome) => outcome?.speculative)),
    speculativeLifecycleState: normalizeText(mission?.speculativeLifecycleState) || (Boolean(mission?.speculative) ? 'speculative-created' : 'none'),
    stageGateStatus: stageGate.status,
    cleanupBy: mission?.cleanupBy || null,
    stageRegression,
    now,
  });

  return {
    missionId: normalizeText(mission?.missionId),
    playbookId: normalizeText(missionPolicy.playbookId) || null,
    playbookVersion: Number(missionPolicy.playbookVersion || 0) || 0,
    playbookFamily: normalizeText(missionPolicy.playbookFamily) || null,
    executeGateMode: normalizeText(missionPolicy.executeGateMode) || null,
    scoreGateMode: normalizeText(missionPolicy.scoreGateMode) || null,
    speculativeActionsAllowed: Array.isArray(missionPolicy.speculativeActionsAllowed) ? missionPolicy.speculativeActionsAllowed : [],
    requiredApprovals: Array.isArray(missionPolicy.requiredApprovals) ? missionPolicy.requiredApprovals : [],
    commercialPrimaryDomain: normalizeText(missionPolicy.commercialPrimaryDomain) || null,
    cleanupTTLHours: Number(missionPolicy.cleanupTTLHours || 0) || 0,
    currentStageId: stageState.currentStageId || null,
    currentStageOrdinal: stageState.currentStageOrdinal || 0,
    stageGateStatus: stageGate.status,
    stageBlockReasonCode: stageGate.blockReasonCode || null,
    stageBlockReasonDetail: stageGate.blockReasonDetail || null,
    scoreGateStatus,
    readinessSignals,
    requiredApprovalTypes: missionPolicy.requiredApprovals || [],
    requiredApprovalEventIds: stageGate.requiredApprovalEventIds || [],
    speculative: lifecycle.speculative,
    speculativeLifecycleState: lifecycle.lifecycleState || null,
    cleanupState: normalizeText(mission?.cleanupState) || lifecycle.cleanupState || null,
    cleanupBy: lifecycle.cleanupBy || mission?.cleanupBy || null,
    executionScore: roundScore(scoreSummary.executionScore),
    commercialMovementScore: roundScore(scoreSummary.commercialMovementScore),
    stageRegression,
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

  const outcomeSnap = await db.collection(OUTCOME_COLLECTION).where('missionId', '==', missionId).get();
  const outcomes = outcomeSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  const taskSnap = await db.collection(TASK_COLLECTION).where('missionId', '==', missionId).get();
  const tasks = taskSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  const now = Date.now();

  let advancedCount = 0;
  if (args.advanceObservations) {
    for (const outcome of outcomes) {
      const patch = advanceOutcomeObservation(outcome, now);
      if (!patch) continue;
      advancedCount += 1;
      if (!args.dryRun) {
        await db.collection(OUTCOME_COLLECTION).doc(outcome.id).set({
          ...patch,
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
      }
      Object.assign(outcome, patch);
    }
  }

  const summary = summarizeMissionOutcomes(outcomes);
  const replayPatch = buildMissionReplayPatch({
    mission: { ...mission, missionId },
    outcomes,
    tasks,
    now: new Date(now),
  });

  const patch = {
    missionId,
    updatedAt: FieldValue.serverTimestamp(),
    supervisorHeartbeatAt: FieldValue.serverTimestamp(),
    ...summary,
    ...replayPatch,
  };

  if (args.dryRun) {
    console.log(`🧪 Mission ${missionId} outcome replay`);
    console.log(`   Outcomes: ${outcomes.length}`);
    console.log(`   Advanced observing outcomes: ${advancedCount}`);
    console.log(`   Replay patch: ${JSON.stringify({ ...patch, updatedAt: '[serverTimestamp]', supervisorHeartbeatAt: '[serverTimestamp]' }, null, 2)}`);
    return patch;
  }

  const sanitizedPatch = stripUndefinedDeep(patch);
  await db.doc(MISSION_DOC).set(sanitizedPatch, { merge: true });
  await db.collection(MISSION_RUNS).doc(missionId).set(sanitizedPatch, { merge: true });

  console.log(`✅ Mission ${missionId} outcome summary rebuilt.`);
  console.log(`   Outcomes: ${outcomes.length}`);
  console.log(`   Advanced observing outcomes: ${advancedCount}`);
  return patch;
}

if (require.main === module) {
  main().catch((err) => {
    console.error('❌ Mission outcome replay failed:', err?.message || err);
    process.exit(1);
  });
}

module.exports = {
  MISSION_DOC,
  MISSION_RUNS,
  buildMissionReplayPatch,
  deriveCurrentStageFromReadiness,
  deriveScoreGateStatus,
  initAdminApp,
  loadMissionRecord,
  main,
  normalizeOutcomeForBuckets,
  parseArgs,
  resolveMissionPolicyLayer,
};
