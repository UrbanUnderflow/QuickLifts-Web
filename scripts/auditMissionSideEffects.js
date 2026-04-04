#!/usr/bin/env node

/**
 * Audit durable side effects that appear to have been created before readiness/approval gates.
 *
 * Usage:
 *   node scripts/auditMissionSideEffects.js --mission-id=<missionId>
 *   node scripts/auditMissionSideEffects.js --mission-id=<missionId> --json
 *
 * Notes:
 * - Read-only by design. No Firestore writes.
 * - Prefers ./serviceAccountKey.json at repo root and falls back to ADC.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { initializeApp, applicationDefault, cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { OUTCOME_COLLECTION, toMillis } = require('./missionOsV2');
const { resolveMissionPlaybook } = require('./missionPlaybooks');
const { buildCanaryMissionInstancePolicy, resolveMissionInstancePolicy } = require('./missionPolicies');
const { buildMissionReplayPatch, loadMissionRecord } = require('./replayMissionOutcomeSummary');
const { inferActionPolicy } = require('./backfillMissionPlaybooks');

const TASK_COLLECTION = 'agent-tasks';
const DURABLE_SIDE_EFFECTS = new Set(['internal-durable', 'external-durable']);

function parseArgs(argv) {
  const args = {
    missionId: '',
    json: argv.includes('--json'),
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
    }, 'mission-side-effect-audit');
  }

  return initializeApp({
    credential: applicationDefault(),
  }, 'mission-side-effect-audit');
}

function normalizeText(value) {
  return String(value || '').trim();
}

function normalizeArray(value) {
  return Array.isArray(value) ? value : [];
}

function buildMissionPolicyLayer(mission) {
  if (mission?.canary) return buildCanaryMissionInstancePolicy(mission, { missionId: mission?.missionId });
  return resolveMissionInstancePolicy(mission, { missionId: mission?.missionId });
}

function resolveActionPolicy(playbook, record) {
  const direct = normalizeText(record?.playbookActionType || record?.actionType);
  if (direct) {
    const exact = normalizeArray(playbook?.actionPolicies).find((policy) => normalizeText(policy.actionType) === direct);
    if (exact) return exact;
  }
  return inferActionPolicy(playbook, record).actionPolicy;
}

function isOutcomeRecord(record) {
  return Array.isArray(record?.primaryTaskIds);
}

function hasExplicitEffectTimestamp(record) {
  const candidates = [
    record?.sideEffectCreatedAt,
    record?.executedAt,
    record?.deliveredAt,
    record?.completedAt,
    record?.startedAt,
    record?.artifactVerifiedAt,
    record?.outcomeObservationStartedAt,
    record?.confirmedAt,
    record?.outcomeConfirmedAt,
  ];

  return candidates.some((candidate) => toMillis(candidate) > 0);
}

function shouldAuditRecord(record) {
  const status = normalizeText(record?.status).toLowerCase();
  if (hasExplicitEffectTimestamp(record)) return true;

  if (isOutcomeRecord(record)) {
    return ['confirmed', 'artifact-verified', 'observing', 'failed', 'reversed', 'expired', 'waived', 'superseded'].includes(status);
  }

  return ['done', 'needs-review'].includes(status);
}

function extractEffectTimestamp(record) {
  const candidates = [
    record?.sideEffectCreatedAt,
    record?.executedAt,
    record?.deliveredAt,
    record?.completedAt,
    record?.startedAt,
    record?.artifactVerifiedAt,
    record?.outcomeObservationStartedAt,
    record?.confirmedAt,
    record?.outcomeConfirmedAt,
  ];

  if (shouldAuditRecord(record)) {
    candidates.push(record?.updatedAt, record?.createdAt);
  }

  for (const candidate of candidates) {
    const millis = toMillis(candidate);
    if (millis > 0) return { millis, value: candidate };
  }

  return { millis: 0, value: null };
}

function indexSignals(signals = []) {
  return new Map(normalizeArray(signals).map((signal) => [normalizeText(signal?.id), signal]));
}

function resolveRequiredSignals(record, actionPolicy, missionSummary) {
  const explicit = normalizeArray(record?.requiredReadinessSignalIds).map(normalizeText).filter(Boolean);
  if (explicit.length > 0) return explicit;
  const fromAction = normalizeArray(actionPolicy?.requiredReadinessSignalIds).map(normalizeText).filter(Boolean);
  if (fromAction.length > 0) return fromAction;
  if (normalizeText(record?.requiredStageId) && normalizeText(record?.requiredStageId) === normalizeText(missionSummary?.currentStageId)) {
    return normalizeArray(missionSummary?.readinessSignals)
      .filter((signal) => normalizeText(signal?.stageId) === normalizeText(record?.requiredStageId))
      .map((signal) => normalizeText(signal?.id))
      .filter(Boolean);
  }
  return [];
}

function evaluateSignalViolations(requiredSignalIds, readinessSignals, effectAtMs) {
  const violations = [];
  const signalById = indexSignals(readinessSignals);

  for (const signalId of requiredSignalIds) {
    const signal = signalById.get(signalId);
    if (!signal) {
      violations.push({ signalId, reason: 'missing-signal-record' });
      continue;
    }

    const state = normalizeText(signal.state).toLowerCase();
    if (state !== 'verified' && state !== 'waived') {
      violations.push({ signalId, reason: `signal-${state || 'not-ready'}` });
      continue;
    }

    const verifiedAtMs = toMillis(signal.verifiedAt || signal.resolvedAt || signal.updatedAt);
    if (verifiedAtMs > 0 && effectAtMs > 0 && verifiedAtMs > effectAtMs) {
      violations.push({ signalId, reason: 'verified-after-side-effect' });
    }
  }

  return violations;
}

function auditRecord(record, missionSummary, playbook) {
  const actionPolicy = resolveActionPolicy(playbook, record);
  const sideEffectClass = normalizeText(record?.sideEffectClass || actionPolicy?.sideEffectClass).toLowerCase();
  if (!DURABLE_SIDE_EFFECTS.has(sideEffectClass)) return null;
  if (!shouldAuditRecord(record)) return null;

  const effect = extractEffectTimestamp(record);
  if (!effect.millis) return null;

  const readinessSignals = normalizeArray(record?.readinessSignals).length > 0
    ? record.readinessSignals
    : normalizeArray(missionSummary?.readinessSignals);
  const requiredSignalIds = resolveRequiredSignals(record, actionPolicy, missionSummary);
  const signalViolations = evaluateSignalViolations(requiredSignalIds, readinessSignals, effect.millis);
  const requiredApprovalTypes = normalizeArray(record?.requiredApprovalTypes).length > 0
    ? record.requiredApprovalTypes
    : normalizeArray(actionPolicy?.requiredApprovalTypes);
  const requiredApprovalEventIds = normalizeArray(record?.requiredApprovalEventIds).map(normalizeText).filter(Boolean);

  const violations = [];
  if (signalViolations.length > 0) {
    violations.push('durable-side-effect-before-readiness');
  }
  if (requiredApprovalTypes.length > 0 && requiredApprovalEventIds.length === 0) {
    violations.push('durable-side-effect-before-approval');
  }
  if (sideEffectClass === 'external-durable' && ['blocked', 'speculative'].includes(normalizeText(record?.stageGateStatus).toLowerCase())) {
    violations.push('external-durable-side-effect-without-stage-clearance');
  }

  if (violations.length === 0) return null;

  return {
    recordType: normalizeText(isOutcomeRecord(record) ? 'outcome' : 'task'),
    id: normalizeText(record?.id),
    missionId: normalizeText(record?.missionId),
    title: normalizeText(record?.title || record?.name) || 'Untitled record',
    playbookId: normalizeText(record?.playbookId || missionSummary?.playbookId),
    playbookActionType: normalizeText(record?.playbookActionType || actionPolicy?.actionType),
    sideEffectClass,
    effectAt: new Date(effect.millis).toISOString(),
    stageGateStatus: normalizeText(record?.stageGateStatus || missionSummary?.stageGateStatus),
    requiredReadinessSignalIds: requiredSignalIds,
    signalViolations,
    requiredApprovalTypes,
    requiredApprovalEventIds,
    cleanupState: normalizeText(record?.cleanupState),
    violations,
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
  const missionSummary = buildMissionReplayPatch({
    mission: { ...mission, missionId },
    outcomes,
    now: new Date(),
  });
  const missionPolicy = buildMissionPolicyLayer({ ...mission, missionId });
  const playbook = resolveMissionPlaybook({ playbookId: missionPolicy.playbookId, canary: missionPolicy.canary });

  const taskSnap = await db.collection(TASK_COLLECTION).where('missionId', '==', missionId).get();
  const tasks = taskSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  const records = [
    ...tasks,
    ...outcomes,
  ];

  const findings = records
    .map((record) => auditRecord(record, { ...missionSummary, missionId }, playbook))
    .filter(Boolean)
    .sort((left, right) => Date.parse(right.effectAt) - Date.parse(left.effectAt));
  const limitedFindings = args.limit > 0 ? findings.slice(0, args.limit) : findings;

  if (args.json) {
    console.log(JSON.stringify({
      missionId,
      findingCount: limitedFindings.length,
      findings: limitedFindings,
    }, null, 2));
    return limitedFindings;
  }

  console.log(`🔎 Mission side-effect audit for ${missionId}`);
  console.log(`   Findings: ${limitedFindings.length}`);
  for (const finding of limitedFindings) {
    console.log([
      `- ${finding.recordType}:${finding.id} :: ${finding.title}`,
      `  action=${finding.playbookActionType || '—'} sideEffect=${finding.sideEffectClass} gate=${finding.stageGateStatus || '—'} effectAt=${finding.effectAt}`,
      `  violations=${finding.violations.join(', ')}`,
      `  readiness=${finding.signalViolations.map((violation) => `${violation.signalId}:${violation.reason}`).join(', ') || 'clear'}`,
      `  approvals=${finding.requiredApprovalTypes.length > 0 ? `${finding.requiredApprovalTypes.join(', ')} / active=${finding.requiredApprovalEventIds.join(', ') || 'none'}` : 'none'}`,
    ].join('\n'));
  }

  return limitedFindings;
}

if (require.main === module) {
  main().catch((err) => {
    console.error('❌ Mission side-effect audit failed:', err?.message || err);
    process.exit(1);
  });
}

module.exports = {
  DURABLE_SIDE_EFFECTS,
  TASK_COLLECTION,
  auditRecord,
  evaluateSignalViolations,
  extractEffectTimestamp,
  initAdminApp,
  main,
  parseArgs,
  resolveRequiredSignals,
};
