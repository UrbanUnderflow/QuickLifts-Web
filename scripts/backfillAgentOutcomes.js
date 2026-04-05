#!/usr/bin/env node

/**
 * Backfill or repair outcome-linked execute tasks and agent-outcomes docs.
 *
 * Usage:
 *   node scripts/backfillAgentOutcomes.js --dry-run
 *   node scripts/backfillAgentOutcomes.js --mission-id=<missionId>
 *   node scripts/backfillAgentOutcomes.js --mission-id=<missionId> --repair
 *   node scripts/backfillAgentOutcomes.js --mission-id=<missionId> --repair --quarantine-ambiguous
 *
 * Auth:
 * - Prefers ./serviceAccountKey.json at repo root
 * - Falls back to Application Default Credentials
 */

const fs = require('fs');
const path = require('path');
const { initializeApp, applicationDefault, cert, getApps } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const {
  buildExecuteTaskContract,
  buildOutcomeRecord,
  normalizeMissionPolicy,
  OUTCOME_COLLECTION,
} = require('./missionOsV2');

const TASK_COLLECTION = 'agent-tasks';
const MISSION_DOC = 'company-config/mission-status';

function parseArgs(argv) {
  const args = {
    dryRun: argv.includes('--dry-run'),
    repair: argv.includes('--repair'),
    quarantineAmbiguous: argv.includes('--quarantine-ambiguous'),
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
    }, 'agent-outcomes-backfill');
  }

  return initializeApp({
    credential: applicationDefault(),
  }, 'agent-outcomes-backfill');
}

async function loadMissionStatus(db, missionId) {
  const snap = await db.doc(MISSION_DOC).get();
  const mission = snap.exists ? (snap.data() || {}) : {};
  if (!missionId || mission.missionId === missionId) return mission;
  return {
    ...mission,
    missionId,
  };
}

function normalizeTaskSort(a, b) {
  const aMs = a.updatedAt?.toMillis?.() || a.createdAt?.toMillis?.() || 0;
  const bMs = b.updatedAt?.toMillis?.() || b.createdAt?.toMillis?.() || 0;
  return bMs - aMs;
}

function normalizeText(value) {
  return String(value || '').trim();
}

function roundScore(value) {
  const parsed = Number(value || 0);
  if (!Number.isFinite(parsed)) return undefined;
  return Math.round(parsed * 100) / 100;
}

function extractSequencingFields(record = {}) {
  const fields = {
    playbookId: normalizeText(record.playbookId) || undefined,
    playbookVersion: Number(record.playbookVersion || 0) || undefined,
    playbookFamily: normalizeText(record.playbookFamily) || undefined,
    playbookActionType: normalizeText(record.playbookActionType || record.actionType) || undefined,
    currentStageId: normalizeText(record.currentStageId) || undefined,
    currentStageOrdinal: Number(record.currentStageOrdinal || 0) || undefined,
    requiredStageId: normalizeText(record.requiredStageId) || undefined,
    requiredStageOrdinal: Number(record.requiredStageOrdinal || 0) || undefined,
    stageGateStatus: normalizeText(record.stageGateStatus) || undefined,
    stageBlockReasonCode: normalizeText(record.stageBlockReasonCode || record.blockReasonCode) || undefined,
    stageBlockReasonDetail: normalizeText(record.stageBlockReasonDetail || record.blockReasonDetail) || undefined,
    scoreGateStatus: normalizeText(record.scoreGateStatus) || undefined,
    admissionVersion: Number(record.admissionVersion || 0) || undefined,
    sideEffectClass: normalizeText(record.sideEffectClass) || undefined,
    creditBucket: normalizeText(record.creditBucket) || undefined,
    commercialCreditEligible: typeof record.commercialCreditEligible === 'boolean' ? record.commercialCreditEligible : undefined,
    speculative: typeof record.speculative === 'boolean' ? record.speculative : undefined,
    speculativeLifecycleState: normalizeText(record.speculativeLifecycleState || record.lifecycleState) || undefined,
    cleanupState: normalizeText(record.cleanupState) || undefined,
    cleanupBy: record.cleanupBy || undefined,
    requiredApprovalTypes: Array.isArray(record.requiredApprovalTypes)
      ? record.requiredApprovalTypes.map(normalizeText).filter(Boolean)
      : undefined,
    requiredApprovalEventIds: Array.isArray(record.requiredApprovalEventIds)
      ? record.requiredApprovalEventIds.map(normalizeText).filter(Boolean)
      : undefined,
    readinessSignals: Array.isArray(record.readinessSignals) ? record.readinessSignals : undefined,
    executionScore: roundScore(record.executionScore),
    commercialMovementScore: roundScore(record.commercialMovementScore),
  };

  return Object.fromEntries(
    Object.entries(fields).filter(([, value]) => {
      if (value === undefined) return false;
      if (Array.isArray(value) && value.length === 0) return false;
      return true;
    })
  );
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const db = getFirestore(initAdminApp());
  const mission = await loadMissionStatus(db, args.missionId);
  const missionId = args.missionId || String(mission?.missionId || '').trim();

  let taskQuery = db.collection(TASK_COLLECTION);
  if (missionId) {
    taskQuery = taskQuery.where('missionId', '==', missionId);
    console.log(`🎯 Restricting backfill to mission ${missionId}`);
  }

  const taskSnap = await taskQuery.get();
  const taskDocs = taskSnap.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }))
    .filter((task) => {
      const hasOutcomeShape = Boolean(task?.outcomeId || task?.proofPacket || task?.mode === 'execute' || Number(task?.specVersion || 0) >= 2);
      return hasOutcomeShape;
    })
    .sort(normalizeTaskSort);

  const selectedTasks = args.limit > 0 ? taskDocs.slice(0, args.limit) : taskDocs;
  const missionPolicy = normalizeMissionPolicy(mission);

  let planned = 0;
  let repaired = 0;
  let createdOutcomes = 0;
  let quarantined = 0;
  let skipped = 0;

  console.log(`📦 Candidate execute tasks: ${selectedTasks.length}`);

  for (const task of selectedTasks) {
    const contract = buildExecuteTaskContract(task, {
      missionPolicy,
      missionId: task.missionId || missionId,
      assignee: task.assignee,
      plannerSource: task.plannerSource || 'mission-supervisor',
      outcomeId: task.outcomeId,
      parentOutcomeId: task.parentOutcomeId,
      supersedesOutcomeId: task.supersedesOutcomeId,
      outcomeClass: task.outcomeClass,
      outcomeDomain: task.outcomeDomain,
      expectedAttribution: task.expectedAttribution,
    });

    const outcomeRecord = buildOutcomeRecord(
      {
        ...task,
        missionId: task.missionId || missionId,
        assignee: task.assignee,
      },
      {
        missionPolicy,
        outcomeId: contract.outcomeId,
        parentOutcomeId: contract.parentOutcomeId,
        supersedesOutcomeId: contract.supersedesOutcomeId,
        proofPacket: contract.proofPacket,
        outcomeClass: contract.outcomeClass,
        outcomeDomain: contract.outcomeDomain,
        status: task.outcomeStatus || contract.outcomeStatus || 'planned',
        primaryTaskIds: [task.id],
      }
    );

    const taskPatch = {
      specVersion: contract.specVersion,
      mode: contract.mode,
      plannerSource: contract.plannerSource,
      taskClass: contract.taskClass,
      objectiveId: contract.objectiveId,
      artifactSpec: contract.artifactSpec,
      acceptanceChecks: contract.acceptanceChecks,
      dependencyIds: contract.dependencyIds,
      verificationPolicy: contract.verificationPolicy,
      priorityScore: contract.priorityScore,
      expiresAt: contract.expiresAt,
      outcomeId: contract.outcomeId,
      parentOutcomeId: contract.parentOutcomeId,
      supersedesOutcomeId: contract.supersedesOutcomeId,
      outcomeClass: contract.outcomeClass,
      outcomeDomain: contract.outcomeDomain,
      outcomeRole: contract.outcomeRole,
      proofPacket: contract.proofPacket,
      policyRefs: contract.policyRefs,
      expectedAttribution: contract.expectedAttribution,
      expectedOutcomeScore: contract.expectedOutcomeScore,
      expectedImpactScore: contract.expectedImpactScore,
      expectedCreditedScore: contract.expectedCreditedScore,
      expectedNetScore: contract.expectedNetScore,
      proofCompileStatus: contract.proofCompileStatus,
      proofCompileErrors: contract.proofCompileErrors,
      compiledProofPacketHash: contract.compiledProofPacketHash,
      expectedSignalWindow: contract.expectedSignalWindow,
      outcomeStatus: contract.outcomeStatus,
      ...extractSequencingFields(task),
      updatedAt: FieldValue.serverTimestamp(),
    };

    const shouldQuarantine = !contract.hasContract || !contract.executeGatePassed;
    const nextStatus = shouldQuarantine && args.quarantineAmbiguous
      ? 'quarantined'
      : (shouldQuarantine ? 'needs-spec' : null);

    const outcomeRef = db.collection(OUTCOME_COLLECTION).doc(contract.outcomeId);
    const existingOutcome = await outcomeRef.get();

    if (args.dryRun) {
      planned += 1;
      if (shouldQuarantine && args.quarantineAmbiguous) quarantined += 1;
      else if (shouldQuarantine) skipped += 1;
      else if (!existingOutcome.exists) createdOutcomes += 1;
      else repaired += 1;

      console.log([
        `🧪 ${task.id}`,
        `   task="${task.name || 'Untitled task'}"`,
        `   outcome=${contract.outcomeId}`,
        `   compile=${contract.proofCompileStatus}`,
        `   gate=${contract.executeGatePassed ? 'passed' : 'blocked'}`,
        nextStatus ? `   nextStatus=${nextStatus}` : '',
        !existingOutcome.exists ? '   outcomeWrite=create' : '   outcomeWrite=merge',
      ].filter(Boolean).join('\n'));
      continue;
    }

    const batch = db.batch();
    if (args.repair || !task.outcomeId || !task.proofPacket || !task.proofCompileStatus) {
      if (nextStatus) taskPatch.status = nextStatus;
      if (nextStatus === 'quarantined') {
        taskPatch.quarantineReason = 'outcome-backfill-ambiguous-contract';
        taskPatch.quarantinedAt = FieldValue.serverTimestamp();
      }
      batch.set(db.collection(TASK_COLLECTION).doc(task.id), taskPatch, { merge: true });
    }

    if (!existingOutcome.exists || args.repair) {
      batch.set(outcomeRef, {
        ...outcomeRecord,
        ...extractSequencingFields(task),
        updatedAt: FieldValue.serverTimestamp(),
        createdAt: existingOutcome.exists ? (existingOutcome.data()?.createdAt || FieldValue.serverTimestamp()) : FieldValue.serverTimestamp(),
      }, { merge: true });
    }

    await batch.commit();
    if (shouldQuarantine && args.quarantineAmbiguous) quarantined += 1;
    else if (shouldQuarantine) skipped += 1;
    else if (!existingOutcome.exists) createdOutcomes += 1;
    else repaired += 1;
  }

  const modeLabel = args.dryRun ? 'dry run' : 'write run';
  console.log(`\n✅ Agent outcome backfill ${modeLabel} complete.`);
  console.log(`   Planned: ${planned || selectedTasks.length}`);
  console.log(`   Created outcomes: ${createdOutcomes}`);
  console.log(`   Repaired: ${repaired}`);
  console.log(`   Quarantined: ${quarantined}`);
  console.log(`   Needs-spec / skipped: ${skipped}`);
}

main().catch((err) => {
  console.error('❌ Agent outcome backfill failed:', err?.message || err);
  process.exit(1);
});
