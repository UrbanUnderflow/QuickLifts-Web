#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { initializeApp, applicationDefault, cert, getApps } = require('firebase-admin/app');
const { getFirestore, FieldValue, Timestamp } = require('firebase-admin/firestore');
const {
  OUTCOME_COLLECTION,
  buildExecuteTaskContract,
  buildObjectiveId,
  MISSION_SYSTEM_VERSION,
  normalizeMissionPolicy,
  recordMissionRunEvent,
} = require('./missionOsV2');
const {
  buildCanaryMissionInstancePolicy,
} = require('./missionPolicies');
const {
  normalizeResolvedReadinessSignal,
} = require('./missionAdmissionTypes');

const TASK_COLLECTION = 'agent-tasks';
const MISSION_DOC = 'company-config/mission-status';
const MISSION_RUNS = 'mission-runs';
const NORTH_STAR_DOC = 'company-config/north-star';
const ORGANIZATIONS_COLLECTION = 'pulsecheck-organizations';
const TEAMS_COLLECTION = 'pulsecheck-teams';
const ORG_MEMBERSHIPS_COLLECTION = 'pulsecheck-organization-memberships';
const TEAM_MEMBERSHIPS_COLLECTION = 'pulsecheck-team-memberships';
const INVITE_LINKS_COLLECTION = 'pulsecheck-invite-links';

const CANARY_ORGANIZATION_ID = 'revival-strength-functional-bodybuilding';
const CANARY_TEAM_ID = 'revival-strength-functional-bodybuilding--persist';
const TARGET_BRIEF_PATH = 'docs/pulsecheck/canary-target-brief.md';
const DEFAULT_OLD_MISSION_ID = 'canary-coach-led-org-1775320145';

function parseArgs(argv) {
  const args = {
    apply: argv.includes('--apply'),
    dryRun: !argv.includes('--apply'),
    oldMissionId: '',
    newMissionId: '',
    keepPaused: argv.includes('--keep-paused'),
  };

  for (const arg of argv) {
    if (arg.startsWith('--old-mission-id=')) args.oldMissionId = arg.split('=')[1]?.trim() || '';
    if (arg.startsWith('--new-mission-id=')) args.newMissionId = arg.split('=')[1]?.trim() || '';
  }

  return args;
}

function initAdminApp() {
  if (getApps().length > 0) return getApps()[0];

  const keyPath = path.join(__dirname, '..', 'serviceAccountKey.json');
  if (fs.existsSync(keyPath)) {
    return initializeApp({ credential: cert(require(keyPath)) }, 'restart-pulsecheck-coach-led-canary');
  }

  return initializeApp({ credential: applicationDefault() }, 'restart-pulsecheck-coach-led-canary');
}

function normalizeText(value) {
  return String(value || '').trim();
}

function stripUndefinedDeep(value) {
  if (Array.isArray(value)) return value.map((item) => stripUndefinedDeep(item));
  if (value && typeof value === 'object' && !(value instanceof Date) && !(value instanceof Timestamp)) {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, entryValue]) => entryValue !== undefined)
        .map(([key, entryValue]) => [key, stripUndefinedDeep(entryValue)])
    );
  }
  return value;
}

function buildTargetSignal(oldMission, oldMissionId, now) {
  const oldSignal = Array.isArray(oldMission?.readinessSignals)
    ? oldMission.readinessSignals.find((signal) => normalizeText(signal?.id) === 'target-identity-locked')
    : null;

  return normalizeResolvedReadinessSignal({
    ...(oldSignal || {}),
    id: 'target-identity-locked',
    label: oldSignal?.label || 'Target identity locked',
    state: 'verified',
    sourceOfTruth: oldSignal?.sourceOfTruth || 'crm',
    successEvent: oldSignal?.successEvent || 'target identity confirmed and locked for mission use',
    verifiedAt: now,
    reason: 'carried-forward-from-prior-canary-run',
    metadata: {
      ...(oldSignal?.metadata || {}),
      carriedForwardFromMissionId: oldMissionId,
      sourceBriefPath: TARGET_BRIEF_PATH,
    },
    sourceSnapshot: {
      ...(oldSignal?.sourceSnapshot || {}),
      carriedForwardFromMissionId: oldMissionId,
      sourceBriefPath: TARGET_BRIEF_PATH,
    },
    missionId: null,
  });
}

function buildRestartTaskDefinitions() {
  return [
    {
      key: 'contact-route',
      assignee: 'Scout',
      objective: 'Confirm the direct contact path to the external owner and lock the preferred outreach route before any live send.',
      name: 'Confirm the direct contact path for Marcus Filly and lock the preferred outreach route',
      description: 'Verify the real owner contact route for Marcus Filly, record the preferred outreach channel, and update the canary brief so downstream outreach uses a confirmed owner path instead of public-source guesswork.',
      taskClass: 'execute-unit',
      priority: 'high',
      priorityScore: 95,
      complexity: 2,
      actionType: 'contact-path-confirmation',
      artifactSpec: {
        kind: 'content_asset',
        targets: [TARGET_BRIEF_PATH],
        successDefinition: 'The canary brief names a confirmed direct contact route and preferred outreach channel for the external owner.',
        mustTouchRepo: true,
        impactScope: 'supporting',
      },
      acceptanceChecks: [
        {
          kind: 'file',
          label: 'Canary brief exists',
          commandOrPath: TARGET_BRIEF_PATH,
          expectedSignal: 'contains the confirmed contact route and outreach owner path',
        },
        {
          kind: 'manual-spot-check',
          label: 'Owner route verified',
          commandOrPath: 'crm/lead/LEAD-0007',
          expectedSignal: 'preferred direct contact route is explicit and usable for live outreach',
        },
      ],
      verificationPolicy: {
        automatedAuthority: true,
        humanSpotCheck: 'exceptions-and-sample',
        sampleRate: 0.2,
      },
    },
    {
      key: 'outreach-asset',
      assignee: 'Solara',
      objective: 'Produce the send-ready outreach asset for the target owner with a concrete ask and no fabricated contact assumptions.',
      name: 'Build the send-ready outreach asset for Marcus Filly',
      description: 'Create the exact outreach package for Marcus Filly using the confirmed owner route, including the concrete ask, value framing, and the next-step request that moves the canary toward interest confirmation.',
      taskClass: 'execute-unit',
      priority: 'high',
      priorityScore: 90,
      complexity: 2,
      actionType: 'outreach-asset-creation',
      dependencyKeys: ['contact-route'],
      artifactSpec: {
        kind: 'content_asset',
        targets: ['docs/pulsecheck/canary-outreach-package.md'],
        successDefinition: 'A send-ready outreach package exists for the target owner with one concrete CTA.',
        mustTouchRepo: true,
        impactScope: 'supporting',
      },
      acceptanceChecks: [
        {
          kind: 'file',
          label: 'Outreach package exists',
          commandOrPath: 'docs/pulsecheck/canary-outreach-package.md',
          expectedSignal: 'contains the specific outreach copy and CTA for Marcus Filly',
        },
        {
          kind: 'manual-spot-check',
          label: 'Outreach package is send-ready',
          commandOrPath: 'docs/pulsecheck/canary-outreach-package.md',
          expectedSignal: 'operator can send it without rewriting or inventing missing context',
        },
      ],
      verificationPolicy: {
        automatedAuthority: true,
        humanSpotCheck: 'exceptions-and-sample',
        sampleRate: 0.2,
      },
    },
    {
      key: 'send-outreach',
      assignee: 'Nora',
      objective: 'Send and confirm the first warm outreach before any provisioning begins.',
      name: 'Send the first outreach to Marcus Filly using the approved route',
      description: 'Use the confirmed owner route and the send-ready outreach asset to deliver the first live outreach. Do not treat delivery as interest; this task only counts once the outbound send is logged through the agreed source of truth.',
      taskClass: 'delivery',
      priority: 'high',
      priorityScore: 88,
      complexity: 2,
      actionType: 'send-outreach',
      dependencyKeys: ['outreach-asset'],
      artifactSpec: {
        kind: 'external_action',
        targets: ['crm/lead/LEAD-0007'],
        successDefinition: 'The first outreach is actually delivered to the target owner through the confirmed route.',
        mustTouchRepo: false,
        impactScope: 'user-facing',
      },
      acceptanceChecks: [
        {
          kind: 'manual-spot-check',
          label: 'Outreach delivered',
          commandOrPath: 'crm/lead/LEAD-0007',
          expectedSignal: 'one real outbound send is logged against the target owner',
        },
        {
          kind: 'firestore',
          label: 'Mission outcome reflects outreach send',
          commandOrPath: 'company-config/mission-status',
          expectedSignal: 'readiness signal outreach-sent becomes verified after delivery',
        },
      ],
      verificationPolicy: {
        automatedAuthority: true,
        humanSpotCheck: 'exceptions-and-sample',
        sampleRate: 0.2,
      },
    },
    {
      key: 'confirm-interest',
      assignee: 'Scout',
      objective: 'Confirm explicit interest and owner email before provisioning or activation.',
      name: 'Record explicit interest confirmation from Marcus Filly before provisioning begins',
      description: 'Capture explicit interest or acceptance from Marcus Filly and update the source-of-truth canary record so provisioning starts only after real commercial readiness exists.',
      taskClass: 'execute-unit',
      priority: 'high',
      priorityScore: 86,
      complexity: 2,
      actionType: 'confirm-interest',
      dependencyKeys: ['send-outreach'],
      artifactSpec: {
        kind: 'firestore_change',
        targets: ['company-config/mission-status'],
        successDefinition: 'The mission records explicit target interest and advances the readiness state beyond outreach-sent.',
        mustTouchRepo: false,
        impactScope: 'supporting',
      },
      acceptanceChecks: [
        {
          kind: 'manual-spot-check',
          label: 'Interest confirmation exists',
          commandOrPath: 'crm/lead/LEAD-0007',
          expectedSignal: 'explicit owner interest is recorded with date and source',
        },
        {
          kind: 'firestore',
          label: 'Interest readiness verified',
          commandOrPath: 'company-config/mission-status',
          expectedSignal: 'readiness signal interest-confirmed becomes verified',
        },
      ],
      verificationPolicy: {
        automatedAuthority: true,
        humanSpotCheck: 'exceptions-and-sample',
        sampleRate: 0.2,
      },
    },
    {
      key: 'confirm-owner-email',
      assignee: 'Scout',
      objective: 'Confirm explicit interest and owner email before provisioning or activation.',
      name: 'Confirm the owner email for the admin activation handoff',
      description: 'Verify Marcus Filly’s preferred owner email and bind it into the canary record so activation-link generation uses a confirmed destination rather than a public guess.',
      taskClass: 'execute-unit',
      priority: 'high',
      priorityScore: 84,
      complexity: 2,
      actionType: 'confirm-owner-email',
      dependencyKeys: ['confirm-interest'],
      artifactSpec: {
        kind: 'content_asset',
        targets: [TARGET_BRIEF_PATH],
        successDefinition: 'The canary record includes a confirmed owner email that is safe to use for activation handoff.',
        mustTouchRepo: true,
        impactScope: 'supporting',
      },
      acceptanceChecks: [
        {
          kind: 'file',
          label: 'Canary brief updated with owner email status',
          commandOrPath: TARGET_BRIEF_PATH,
          expectedSignal: 'owner email status is explicit and no longer unverified',
        },
        {
          kind: 'manual-spot-check',
          label: 'Confirmed owner email exists',
          commandOrPath: 'crm/lead/LEAD-0007',
          expectedSignal: 'preferred owner email is confirmed and usable for admin activation',
        },
      ],
      verificationPolicy: {
        automatedAuthority: true,
        humanSpotCheck: 'exceptions-and-sample',
        sampleRate: 0.2,
      },
    },
    {
      key: 'provision-shell',
      assignee: 'Nora',
      objective: 'Provision the org/team container only after earned readiness.',
      name: 'Provision the organization and initial team shell for the selected canary target',
      description: 'Provision the PulseCheck organization and first team for Revival Strength / Functional Bodybuilding only after interest and owner-email readiness are both earned, so the container reflects a real warm target instead of speculative prep.',
      taskClass: 'execute-unit',
      priority: 'high',
      priorityScore: 82,
      complexity: 3,
      actionType: 'preprovision-org-team-shell',
      dependencyKeys: ['confirm-owner-email'],
      artifactSpec: {
        kind: 'firestore_change',
        targets: [ORGANIZATIONS_COLLECTION, TEAMS_COLLECTION],
        successDefinition: 'A real org/team shell exists for the canary only after the target is warm and the owner email is confirmed.',
        mustTouchRepo: false,
        impactScope: 'internal',
      },
      acceptanceChecks: [
        {
          kind: 'firestore',
          label: 'Organization exists',
          commandOrPath: `${ORGANIZATIONS_COLLECTION}/${CANARY_ORGANIZATION_ID}`,
          expectedSignal: 'organization doc exists for the confirmed canary target',
        },
        {
          kind: 'firestore',
          label: 'Team exists',
          commandOrPath: `${TEAMS_COLLECTION}/${CANARY_TEAM_ID}`,
          expectedSignal: 'team doc exists with the correct invite posture and routing defaults',
        },
      ],
      verificationPolicy: {
        automatedAuthority: true,
        humanSpotCheck: 'exceptions-and-sample',
        sampleRate: 0.2,
      },
    },
    {
      key: 'create-activation-link',
      assignee: 'Solara',
      objective: 'Generate and send the admin activation handoff only after owner confirmation.',
      name: 'Generate the admin activation handoff package for the confirmed owner',
      description: 'Create the first admin activation link and handoff package only after the owner email is confirmed and the org/team shell exists for the warm target.',
      taskClass: 'execute-unit',
      priority: 'high',
      priorityScore: 80,
      complexity: 2,
      actionType: 'create-activation-link',
      dependencyKeys: ['provision-shell'],
      artifactSpec: {
        kind: 'firestore_change',
        targets: [INVITE_LINKS_COLLECTION, 'docs/pulsecheck/canary-admin-handoff.md'],
        successDefinition: 'An addressable admin activation link exists and the send-ready handoff package is attached to it.',
        mustTouchRepo: true,
        impactScope: 'internal',
      },
      acceptanceChecks: [
        {
          kind: 'firestore',
          label: 'Activation link exists',
          commandOrPath: INVITE_LINKS_COLLECTION,
          expectedSignal: 'one admin-activation invite exists for the confirmed owner',
        },
        {
          kind: 'file',
          label: 'Handoff package exists',
          commandOrPath: 'docs/pulsecheck/canary-admin-handoff.md',
          expectedSignal: 'contains the live activation handoff package and next step',
        },
      ],
      verificationPolicy: {
        automatedAuthority: true,
        humanSpotCheck: 'exceptions-and-sample',
        sampleRate: 0.2,
      },
    },
    {
      key: 'send-activation-link',
      assignee: 'Nora',
      objective: 'Generate and send the admin activation handoff only after owner confirmation.',
      name: 'Send the first admin activation link to the confirmed owner',
      description: 'Deliver the admin activation handoff through the confirmed owner email only after the activation link exists and the mission owner has approved the send.',
      taskClass: 'delivery',
      priority: 'high',
      priorityScore: 78,
      complexity: 2,
      actionType: 'send-activation-link',
      dependencyKeys: ['create-activation-link'],
      artifactSpec: {
        kind: 'external_action',
        targets: [INVITE_LINKS_COLLECTION],
        successDefinition: 'The first admin activation link is delivered to the confirmed owner through the approved route.',
        mustTouchRepo: false,
        impactScope: 'user-facing',
      },
      acceptanceChecks: [
        {
          kind: 'manual-spot-check',
          label: 'Activation send is logged',
          commandOrPath: INVITE_LINKS_COLLECTION,
          expectedSignal: 'activation delivery is logged against the confirmed owner',
        },
        {
          kind: 'firestore',
          label: 'Activation send readiness advances',
          commandOrPath: 'company-config/mission-status',
          expectedSignal: 'readiness signal activation-link-sent becomes verified',
        },
      ],
      verificationPolicy: {
        automatedAuthority: true,
        humanSpotCheck: 'exceptions-and-sample',
        sampleRate: 0.2,
      },
    },
    {
      key: 'confirm-activation',
      assignee: 'Nora',
      objective: 'Verify the first real admin activation and the downstream invite path after the owner takes control.',
      name: 'Confirm one real admin activation for the restarted canary',
      description: 'Confirm that the external owner redeems the activation link and becomes the controlling org admin and team admin for the coach-led organization.',
      taskClass: 'execute-unit',
      priority: 'high',
      priorityScore: 76,
      complexity: 3,
      actionType: 'confirm-redemption',
      dependencyKeys: ['send-activation-link'],
      artifactSpec: {
        kind: 'firestore_change',
        targets: [ORG_MEMBERSHIPS_COLLECTION, TEAM_MEMBERSHIPS_COLLECTION],
        successDefinition: 'The confirmed owner redeems the activation link and becomes the real org/team admin in source-of-truth collections.',
        mustTouchRepo: false,
        impactScope: 'user-facing',
      },
      acceptanceChecks: [
        {
          kind: 'firestore',
          label: 'Organization admin membership exists',
          commandOrPath: ORG_MEMBERSHIPS_COLLECTION,
          expectedSignal: 'confirmed owner is active as org-admin',
        },
        {
          kind: 'firestore',
          label: 'Team admin membership exists',
          commandOrPath: TEAM_MEMBERSHIPS_COLLECTION,
          expectedSignal: 'confirmed owner is active as team-admin',
        },
      ],
      verificationPolicy: {
        automatedAuthority: true,
        humanSpotCheck: 'exceptions-and-sample',
        sampleRate: 0.2,
      },
    },
    {
      key: 'verify-readiness',
      assignee: 'Sage',
      objective: 'Verify the first real admin activation and the downstream invite path after the owner takes control.',
      name: 'Verify the downstream invite readiness contract after admin activation',
      description: 'Verify the organization/team container can accept downstream staff or athlete invites after the first admin takes control, with no manual Firestore repair or legacy bridge steps.',
      taskClass: 'constraint',
      priority: 'high',
      priorityScore: 74,
      complexity: 2,
      actionType: 'verify-downstream-invite-readiness',
      dependencyKeys: ['confirm-activation'],
      artifactSpec: {
        kind: 'firestore_change',
        targets: [ORGANIZATIONS_COLLECTION, TEAMS_COLLECTION, ORG_MEMBERSHIPS_COLLECTION, TEAM_MEMBERSHIPS_COLLECTION],
        successDefinition: 'The restarted canary container is ready for downstream invites through the org/team model with no manual repair.',
        mustTouchRepo: false,
        impactScope: 'internal',
      },
      acceptanceChecks: [
        {
          kind: 'firestore',
          label: 'Container invite posture is valid',
          commandOrPath: `${TEAMS_COLLECTION}/${CANARY_TEAM_ID}`,
          expectedSignal: 'team invite posture and routing defaults support downstream invites',
        },
        {
          kind: 'manual-spot-check',
          label: 'No repair required',
          commandOrPath: 'company-config/mission-status',
          expectedSignal: 'container passes readiness without manual Firestore repair',
        },
      ],
      verificationPolicy: {
        automatedAuthority: true,
        humanSpotCheck: 'exceptions-and-sample',
        sampleRate: 0.2,
      },
    },
  ];
}

function computeObjectiveProgress(taskRecords) {
  const progress = {};
  for (const task of taskRecords) {
    const objectiveId = normalizeText(task.objectiveId);
    if (!objectiveId) continue;
    const entry = progress[objectiveId] || {
      title: task.northStarObjectiveLink || task.northStarObjective || objectiveId,
      verifiedDeliverableCount: 0,
      openTaskCount: 0,
      completedTaskCount: 0,
      blockedTaskCount: 0,
      needsReviewTaskCount: 0,
    };
    const status = normalizeText(task.status).toLowerCase();
    if (status === 'done') entry.completedTaskCount += 1;
    else if (status === 'needs-review') entry.needsReviewTaskCount += 1;
    else if (status === 'blocked') {
      entry.blockedTaskCount += 1;
      entry.openTaskCount += 1;
    } else if (status === 'todo' || status === 'in-progress' || status === 'needs-spec') {
      entry.openTaskCount += 1;
    }
    progress[objectiveId] = entry;
  }
  return progress;
}

async function collectDocs(query) {
  const snap = await query.get();
  return snap.docs.map((doc) => ({ id: doc.id, ref: doc.ref, data: doc.data() }));
}

async function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const db = getFirestore(initAdminApp());
  const now = new Date();
  const nowTs = Timestamp.fromDate(now);

  const missionStatusSnap = await db.doc(MISSION_DOC).get();
  const liveMission = missionStatusSnap.exists ? (missionStatusSnap.data() || {}) : {};
  const oldMissionId = normalizeText(args.oldMissionId || liveMission.missionId || DEFAULT_OLD_MISSION_ID);
  const newMissionId = normalizeText(args.newMissionId || `canary-coach-led-org-restart-${Date.now()}`);

  if (!oldMissionId) {
    throw new Error('Unable to resolve the old canary mission id.');
  }

  const northStarSnap = await db.doc(NORTH_STAR_DOC).get();
  const northStar = northStarSnap.exists ? (northStarSnap.data() || {}) : {};
  const oldMissionRunSnap = await db.collection(MISSION_RUNS).doc(oldMissionId).get();
  const oldMissionRun = oldMissionRunSnap.exists ? (oldMissionRunSnap.data() || {}) : {};

  const oldTasks = await collectDocs(db.collection(TASK_COLLECTION).where('missionId', '==', oldMissionId));
  const oldOutcomes = await collectDocs(db.collection(OUTCOME_COLLECTION).where('missionId', '==', oldMissionId));
  const orgMemberships = await collectDocs(db.collection(ORG_MEMBERSHIPS_COLLECTION).where('organizationId', '==', CANARY_ORGANIZATION_ID));
  const teamMemberships = await collectDocs(db.collection(TEAM_MEMBERSHIPS_COLLECTION).where('teamId', '==', CANARY_TEAM_ID));
  const inviteLinksByOrg = await collectDocs(db.collection(INVITE_LINKS_COLLECTION).where('organizationId', '==', CANARY_ORGANIZATION_ID));
  const inviteLinksByTeam = await collectDocs(db.collection(INVITE_LINKS_COLLECTION).where('teamId', '==', CANARY_TEAM_ID));
  const inviteLinks = Array.from(new Map([...inviteLinksByOrg, ...inviteLinksByTeam].map((doc) => [doc.id, doc]))).map(([, doc]) => doc);

  const targetSignal = buildTargetSignal(liveMission, oldMissionId, now);
  const seededMissionPolicy = buildCanaryMissionInstancePolicy({
    missionId: newMissionId,
    canary: true,
    systemVersion: MISSION_SYSTEM_VERSION,
    mode: 'execute',
    currentStageId: 'target-selected',
    scoreGateMode: 'credited-and-net',
    readinessSignals: [targetSignal],
  }, {
    missionId: newMissionId,
    systemVersion: MISSION_SYSTEM_VERSION,
    mode: 'execute',
    currentStageId: 'target-selected',
    readinessSignals: [targetSignal],
    scoreGateMode: 'credited-and-net',
  });
  const missionPolicy = normalizeMissionPolicy({
    ...seededMissionPolicy,
    missionId: newMissionId,
    canary: true,
    systemVersion: MISSION_SYSTEM_VERSION,
    mode: 'execute',
    currentStageId: 'target-selected',
    scoreGateMode: 'credited-and-net',
    executeGateMode: 'allow-speculative',
    startedAt: now,
  });

  const taskDefinitions = buildRestartTaskDefinitions();
  const refByKey = new Map(taskDefinitions.map((task) => [task.key, db.collection(TASK_COLLECTION).doc()]));
  const createdTasks = [];
  const createdOutcomes = [];

  let releasedCount = 0;
  for (const definition of taskDefinitions) {
    const dependencyIds = Array.isArray(definition.dependencyKeys)
      ? definition.dependencyKeys.map((key) => refByKey.get(key)?.id).filter(Boolean)
      : [];
    const executeContract = buildExecuteTaskContract({
      name: definition.name,
      description: definition.description,
      priority: definition.priority,
      complexity: definition.complexity,
      actionType: definition.actionType,
      artifactSpec: definition.artifactSpec,
      acceptanceChecks: definition.acceptanceChecks,
      northStarObjective: definition.objective,
      northStarObjectiveLink: definition.objective,
      verificationPolicy: definition.verificationPolicy,
      dependencyIds,
    }, {
      plannerSource: 'mission-restart',
      taskClass: definition.taskClass,
      objectiveId: definition.objective,
      priorityScore: definition.priorityScore,
      expiresInHours: 72,
      missionPolicy,
      missionId: newMissionId,
      assignee: definition.assignee,
      actionType: definition.actionType,
    });

    const dependenciesPending = dependencyIds.length > 0;
    let status = 'blocked';
    if (!executeContract.hasContract) {
      status = 'needs-spec';
    } else if (executeContract.admissionDecision?.admitExecuteTask === true && !dependenciesPending) {
      releasedCount += 1;
      status = releasedCount <= missionPolicy.maxQueuedExecuteTasksPerAgent ? 'todo' : 'blocked';
    }

    const ref = refByKey.get(definition.key);
    const objectiveId = executeContract.objectiveId || buildObjectiveId(definition.objective, 'OBJECTIVE');
    const taskRecord = stripUndefinedDeep({
      id: ref.id,
      name: definition.name,
      description: `${definition.description}\n\n**North Star Impact:** ${definition.objective}`,
      assignee: definition.assignee,
      status,
      priority: definition.priority,
      complexity: definition.complexity,
      source: 'mission-restart',
      missionId: newMissionId,
      objectiveCode: `MISSION-${normalizeText(definition.assignee).toUpperCase()}`,
      northStarObjective: definition.objective,
      northStarObjectiveSource: 'primary',
      northStarObjectiveLink: definition.objective,
      northStarDirectImpact: definition.objective,
      agentProposedObjectiveId: '',
      agentProposedObjectiveTitle: '',
      missionRestartedAt: nowTs,
      createdAt: nowTs,
      updatedAt: nowTs,
      specVersion: executeContract.specVersion,
      mode: executeContract.mode,
      plannerSource: executeContract.plannerSource,
      taskClass: executeContract.taskClass,
      objectiveId,
      artifactSpec: executeContract.artifactSpec,
      acceptanceChecks: executeContract.acceptanceChecks,
      dependencyIds: executeContract.dependencyIds,
      verificationPolicy: executeContract.verificationPolicy,
      priorityScore: executeContract.priorityScore,
      expiresAt: executeContract.expiresAt || null,
      quarantineReason: executeContract.quarantineReason || '',
      quarantinedAt: executeContract.quarantinedAt || null,
      verificationResult: executeContract.verificationResult || null,
      outcomeId: executeContract.outcomeId,
      parentOutcomeId: executeContract.parentOutcomeId,
      supersedesOutcomeId: executeContract.supersedesOutcomeId,
      outcomeClass: executeContract.outcomeClass,
      outcomeDomain: executeContract.outcomeDomain,
      outcomeRole: executeContract.outcomeRole,
      proofPacket: executeContract.proofPacket,
      policyRefs: executeContract.policyRefs,
      expectedAttribution: executeContract.expectedAttribution,
      expectedOutcomeScore: executeContract.expectedOutcomeScore,
      expectedImpactScore: executeContract.expectedImpactScore,
      expectedCreditedScore: executeContract.expectedCreditedScore,
      expectedNetScore: executeContract.expectedNetScore,
      proofCompileStatus: executeContract.proofCompileStatus,
      proofCompileErrors: executeContract.proofCompileErrors,
      compiledProofPacketHash: executeContract.compiledProofPacketHash,
      expectedSignalWindow: executeContract.expectedSignalWindow,
      playbookId: executeContract.playbookId,
      playbookVersion: executeContract.playbookVersion,
      actionType: executeContract.actionType,
      currentStageId: executeContract.currentStageId,
      sideEffectClass: executeContract.sideEffectClass,
      creditBucket: executeContract.creditBucket,
      stageGateStatus: executeContract.stageGateStatus,
      stageBlockReason: executeContract.stageBlockReason,
      speculative: executeContract.speculative === true,
      cleanupBy: executeContract.cleanupBy || null,
      cleanupState: executeContract.cleanupState || 'none',
      readinessSignals: executeContract.readinessSignals,
      commercialCreditEligible: executeContract.commercialCreditEligible === true,
      admissionDecision: executeContract.admissionDecision,
      emittedReadinessSignalIds: executeContract.emittedReadinessSignalIds,
      requiredReadinessSignalIds: executeContract.requiredReadinessSignalIds,
      outcomeStatus: 'planned',
    });

    createdTasks.push({ ref, data: taskRecord, taskKey: definition.key });
    if (executeContract.outcomeRecord) {
      createdOutcomes.push({
        ref: db.collection(OUTCOME_COLLECTION).doc(executeContract.outcomeId || undefined),
        data: stripUndefinedDeep({
          ...executeContract.outcomeRecord,
          id: executeContract.outcomeId,
          missionId: newMissionId,
          objectiveId,
          primaryTaskIds: [ref.id],
          status: 'planned',
          createdAt: nowTs,
          updatedAt: nowTs,
        }),
      });
    }
  }

  const objectiveProgress = computeObjectiveProgress(createdTasks.map((task) => task.data));
  const missionSummary = 'Coach-led organization canary restarted from the earned target-selection stage. Speculative provisioning was retired; no commercial progress counts until outreach, interest, owner-email confirmation, and activation are earned in order.';
  const agentObjectives = {
    scout: 'Confirm the direct contact path to the external owner and lock the preferred outreach route before any live send.',
    solara: 'Produce the send-ready outreach asset for the target owner with a concrete ask and no fabricated contact assumptions.',
    nora: 'Provision and activate the coach-led organization only after earned readiness is verified.',
    sage: 'Verify the downstream invite readiness contract only after the first admin activation is real.',
  };

  const newMissionPatch = stripUndefinedDeep({
    status: args.keepPaused ? 'paused' : 'active',
    missionPhase: args.keepPaused ? 'paused' : 'execution',
    missionId: newMissionId,
    northStarTitle: northStar.title || 'Provision one real coach-led organization, activate its first team admin, and verify that the container is ready for downstream invites.',
    missionSummary,
    kickoffChatId: '',
    agentObjectives,
    taskCount: createdTasks.length,
    createdTaskIds: createdTasks.map((task) => task.ref.id),
    startedAt: nowTs,
    updatedAt: nowTs,
    pausedAt: args.keepPaused ? nowTs : null,
    lastVerifiedDeliverableAt: null,
    verifiedDeliverableCount: 0,
    autopauseReason: '',
    objectiveProgress,
    quarantinedTaskCount: 0,
    plannedOutcomeCount: createdOutcomes.length,
    observingOutcomeCount: 0,
    confirmedOutcomeCount: 0,
    reversedOutcomeCount: 0,
    guardrailFailureCount: 0,
    terminalOutcomeScore: 0,
    enablingOutcomeScore: 0,
    learningOutcomeScore: 0,
    invalidationOutcomeScore: 0,
    constraintOutcomeScore: 0,
    creditedOutcomeScore: 0,
    netOutcomeScore: 0,
    businessDebtScore: 0,
    waivedOutcomeCount: 0,
    waivedCreditedScore: 0,
    canceledOutcomeCount: 0,
    supersededOutcomeCount: 0,
    executionScore: 0,
    commercialMovementScore: 0,
    speculativeOutcomeCount: 0,
    plannerState: args.keepPaused ? 'paused' : 'supervising',
    ...missionPolicy,
  });

  const cleanupSummary = {
    organizationId: CANARY_ORGANIZATION_ID,
    teamId: CANARY_TEAM_ID,
    deletedOrganization: true,
    deletedTeam: true,
    deletedOrganizationMembershipCount: orgMemberships.length,
    deletedTeamMembershipCount: teamMemberships.length,
    deletedInviteLinkCount: inviteLinks.length,
  };

  if (args.dryRun) {
    console.log(JSON.stringify({
      oldMissionId,
      newMissionId,
      cleanupSummary,
      newMissionPatch: {
        ...newMissionPatch,
        startedAt: '[timestamp]',
        updatedAt: '[timestamp]',
        pausedAt: args.keepPaused ? '[timestamp]' : null,
      },
      seededTasks: createdTasks.map((task) => ({
        id: task.ref.id,
        name: task.data.name,
        status: task.data.status,
        assignee: task.data.assignee,
        actionType: task.data.actionType,
        dependencyIds: task.data.dependencyIds,
        stageGateStatus: task.data.stageGateStatus,
      })),
    }, null, 2));
    return { oldMissionId, newMissionId, cleanupSummary };
  }

  const batch = db.batch();

  const orgRef = db.collection(ORGANIZATIONS_COLLECTION).doc(CANARY_ORGANIZATION_ID);
  const teamRef = db.collection(TEAMS_COLLECTION).doc(CANARY_TEAM_ID);
  batch.delete(orgRef);
  batch.delete(teamRef);
  for (const membership of orgMemberships) batch.delete(membership.ref);
  for (const membership of teamMemberships) batch.delete(membership.ref);
  for (const invite of inviteLinks) batch.delete(invite.ref);

  for (const task of oldTasks) {
    const actionType = normalizeText(task.data?.actionType);
    const patch = {
      restartSupersededByMissionId: newMissionId,
      restartRetiredAt: nowTs,
      updatedAt: nowTs,
    };
    if (actionType === 'preprovision-org-team-shell') {
      patch.cleanupState = 'retired';
      patch.cleanupBy = null;
      patch.restartCleanupReason = 'speculative-shell-retired-before-restart';
    } else if (normalizeText(task.data?.status).toLowerCase() !== 'done') {
      patch.status = 'canceled';
      patch.canceledAt = nowTs;
      patch.restartCleanupReason = 'superseded-by-clean-restart';
    }
    batch.set(task.ref, stripUndefinedDeep(patch), { merge: true });
  }

  for (const outcome of oldOutcomes) {
    const actionType = normalizeText(outcome.data?.actionType);
    const patch = {
      restartSupersededByMissionId: newMissionId,
      restartRetiredAt: nowTs,
      updatedAt: nowTs,
    };
    if (actionType === 'preprovision-org-team-shell') {
      patch.cleanupState = 'retired';
      patch.cleanupBy = null;
      patch.restartCleanupReason = 'speculative-shell-retired-before-restart';
    } else if (['executing', 'planned', 'artifact-verified', 'observing'].includes(normalizeText(outcome.data?.status).toLowerCase())) {
      patch.status = 'canceled';
      patch.canceledAt = nowTs;
      patch.restartCleanupReason = 'superseded-by-clean-restart';
    }
    batch.set(outcome.ref, stripUndefinedDeep(patch), { merge: true });
  }

  batch.set(db.collection(MISSION_RUNS).doc(oldMissionId), stripUndefinedDeep({
    restartSupersededByMissionId: newMissionId,
    restartRetiredAt: nowTs,
    restartCleanupSummary: cleanupSummary,
    restartReason: 'retired speculative shell and restarted from earned readiness sequence',
    missionSummary: `${oldMissionRun.missionSummary || oldMissionRun.northStarTitle || 'Canary mission'} was superseded by ${newMissionId} after the speculative shell was retired.`,
    updatedAt: nowTs,
  }), { merge: true });

  batch.set(db.doc(MISSION_DOC), newMissionPatch, { merge: false });
  batch.set(db.collection(MISSION_RUNS).doc(newMissionId), newMissionPatch, { merge: true });

  for (const task of createdTasks) {
    batch.set(task.ref, task.data, { merge: false });
  }
  for (const outcome of createdOutcomes) {
    batch.set(outcome.ref, outcome.data, { merge: true });
  }

  await batch.commit();

  await recordMissionRunEvent(db, FieldValue, oldMissionId, 'restart-cleanup', {
    supersededByMissionId: newMissionId,
    cleanupSummary,
  });
  await recordMissionRunEvent(db, FieldValue, newMissionId, 'mission-restarted', {
    restartedFromMissionId: oldMissionId,
    cleanupSummary,
    carriedForwardSignalIds: ['target-identity-locked'],
  });
  for (const task of createdTasks) {
    await recordMissionRunEvent(db, FieldValue, newMissionId, 'created-task', {
      agentId: normalizeText(task.data.assignee).toLowerCase(),
      taskId: task.ref.id,
      taskName: task.data.name,
      status: task.data.status,
      taskClass: task.data.taskClass,
      objectiveId: task.data.objectiveId,
      mode: task.data.mode,
      outcomeId: task.data.outcomeId || '',
      outcomeClass: task.data.outcomeClass || '',
    });
    if (task.data.outcomeId) {
      await recordMissionRunEvent(db, FieldValue, newMissionId, 'planned-outcome', {
        outcomeId: task.data.outcomeId,
        objectiveId: task.data.objectiveId || '',
        taskId: task.ref.id,
        outcomeClass: task.data.outcomeClass || '',
      });
    }
  }

  console.log(JSON.stringify({
    oldMissionId,
    newMissionId,
    cleanupSummary,
    seededTaskIds: createdTasks.map((task) => task.ref.id),
  }, null, 2));
}

if (require.main === module) {
  main().catch((error) => {
    console.error('❌ Failed to restart the PulseCheck coach-led canary:', error?.message || error);
    process.exit(1);
  });
}

module.exports = {
  buildRestartTaskDefinitions,
  buildTargetSignal,
  computeObjectiveProgress,
  initAdminApp,
  main,
  parseArgs,
};
