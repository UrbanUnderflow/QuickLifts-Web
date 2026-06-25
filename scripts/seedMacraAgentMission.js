#!/usr/bin/env node
'use strict';

/**
 * Seeds the Macra North Star and initial operating tasks for the OpenClaw agent team.
 *
 * Dry run by default:
 *   node scripts/seedMacraAgentMission.js
 *
 * Apply:
 *   node scripts/seedMacraAgentMission.js --commit
 */

const { initializeApp, getApps } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { resolveAdminCredential } = require('./lib/resolveAdminCredential');

const COMMIT = process.argv.includes('--commit') || process.argv.includes('--apply');
const TASKS_COLLECTION = 'agent-tasks';
const NORTH_STAR_DOC = 'company-config/north-star';
const MISSION_DOC = 'company-config/mission-status';
const SOURCE = 'macra-mission-seed-2026-06-25';
const MISSION_ID = 'macra-growth-os-2026-06-25';

const northStar = {
  title: 'Macra Trial-Start Operating System',
  description:
    'Make Macra trial starts repeatable without breaking trust by operating from the existing Scoreboard, Experiments, purchase logs, cancel reasons, user state, retargeting state, and AppsFlyer imports.',
  objectives: [
    'Refresh active variant_a experiment results before making funnel decisions.',
    'Publish a daily Macra KPI snapshot from Scoreboard, Experiments, purchase logs, cancel reasons, retargeting, and AppsFlyer coverage.',
    'Separate Apple Search Ads from organic source quality and decide whether to increase, hold, or refine paid acquisition.',
    'Use cancel reasons and paywall dismissal behavior to propose one lifecycle copy, proof, or offer change at a time.',
    'Audit event semantics and trust guardrails before scaling the growth signal.',
    'Maintain a Macra decision log tying every operational change to expected metrics and guardrails.',
  ],
  updatedBy: 'script:seedMacraAgentMission',
  updatedAt: FieldValue.serverTimestamp(),
};

const tasks = [
  {
    name: 'Refresh Macra experiment results for active variant_a',
    assignee: 'Nora',
    priority: 'high',
    complexity: 3,
    taskClass: 'execute-unit',
    objectiveCode: 'MACRA-EXPERIMENT-FRESHNESS',
    northStarObjective: northStar.objectives[0],
    description:
      'Use /admin/experiments and the existing backfill flow to refresh macra-experiment-results/macra_paywall_onboarding so the saved snapshot reflects active variant_a, not the retired hard-paywall state. Record generatedAt, loadedUsers, assignment quality, and any data gaps in docs/ops/macra-experiment-refresh-2026-06-25.md.',
    artifactSpec: {
      kind: 'firestore_change',
      targets: ['macra-experiment-results/macra_paywall_onboarding', 'docs/ops/macra-experiment-refresh-2026-06-25.md'],
      successDefinition: 'Experiment result snapshot is fresh enough for daily decisions and the repo has a short refresh note.',
      mustTouchRepo: true,
      impactScope: 'internal',
    },
    acceptanceChecks: [
      {
        kind: 'firestore',
        label: 'Experiment result generatedAt updated',
        commandOrPath: 'macra-experiment-results/macra_paywall_onboarding',
        expectedSignal: 'generatedAt is newer than the stale June 16 snapshot and configSnapshot active variant is variant_a.',
      },
      {
        kind: 'file',
        label: 'Refresh note exists',
        commandOrPath: 'docs/ops/macra-experiment-refresh-2026-06-25.md',
        expectedSignal: 'File records snapshot freshness, inputs, and gaps.',
      },
    ],
  },
  {
    name: 'Create first daily Macra operating snapshot',
    assignee: 'Nora',
    priority: 'high',
    complexity: 3,
    taskClass: 'delivery',
    objectiveCode: 'MACRA-DAILY-SNAPSHOT',
    northStarObjective: northStar.objectives[1],
    description:
      'Create docs/ops/macra-operating-snapshot-2026-06-25.md from the Macra Scoreboard, Experiments, purchase logs, cancel reasons, retargeting state, and AppsFlyer coverage. Include funnel counts, source split, experiment freshness, guardrails, one finding per agent, and Nora decision.',
    artifactSpec: {
      kind: 'repo_file',
      targets: ['docs/ops/macra-operating-snapshot-2026-06-25.md'],
      successDefinition: 'Daily snapshot exists and can be used as the team source of truth for the next operating cycle.',
      mustTouchRepo: true,
      impactScope: 'internal',
    },
    acceptanceChecks: [
      {
        kind: 'file',
        label: 'Daily snapshot exists',
        commandOrPath: 'docs/ops/macra-operating-snapshot-2026-06-25.md',
        expectedSignal: 'File includes funnel, source split, guardrails, experiment freshness, and decision.',
      },
    ],
  },
  {
    name: 'Analyze Apple Search Ads versus organic quality',
    assignee: 'Scout',
    priority: 'high',
    complexity: 3,
    taskClass: 'delivery',
    objectiveCode: 'MACRA-ASA-QUALITY',
    northStarObjective: northStar.objectives[2],
    description:
      'Use the AppsFlyer aggregate CSV and Scoreboard source split to create docs/research/macra-asa-quality-2026-06-25.md. Separate organic and Apple Search Ads by starts, paywall, CTA, af_initiated_checkout, trial starts, cancels, and checkout-to-trial. Recommend increase, hold, or refine ASA focus.',
    artifactSpec: {
      kind: 'repo_file',
      targets: ['docs/research/macra-asa-quality-2026-06-25.md'],
      successDefinition: 'Scout recommendation is grounded in source-level rates and does not overclaim PMF.',
      mustTouchRepo: true,
      impactScope: 'internal',
    },
    acceptanceChecks: [
      {
        kind: 'file',
        label: 'ASA quality brief exists',
        commandOrPath: 'docs/research/macra-asa-quality-2026-06-25.md',
        expectedSignal: 'Brief includes organic vs ASA rates and one clear paid acquisition recommendation.',
      },
    ],
  },
  {
    name: 'Synthesize Macra cancel reasons into one lifecycle recommendation',
    assignee: 'Solara',
    priority: 'high',
    complexity: 3,
    taskClass: 'delivery',
    objectiveCode: 'MACRA-LIFECYCLE-CONVERSION',
    northStarObjective: northStar.objectives[3],
    description:
      'Use /admin/macraCancelReasons, paywall dismissal behavior, and retargeting state to create docs/deliverables/macra-lifecycle-recommendation-2026-06-25.md. Propose exactly one copy, proof, or offer change and name the primary metric and guardrail.',
    artifactSpec: {
      kind: 'repo_file',
      targets: ['docs/deliverables/macra-lifecycle-recommendation-2026-06-25.md'],
      successDefinition: 'Solara produces one recommendation, not a list of simultaneous tests.',
      mustTouchRepo: true,
      impactScope: 'internal',
    },
    acceptanceChecks: [
      {
        kind: 'file',
        label: 'Lifecycle recommendation exists',
        commandOrPath: 'docs/deliverables/macra-lifecycle-recommendation-2026-06-25.md',
        expectedSignal: 'Recommendation names one change, expected metric, and guardrail.',
      },
    ],
  },
  {
    name: 'Audit Macra event semantics and trust guardrails',
    assignee: 'Sage',
    priority: 'high',
    complexity: 3,
    taskClass: 'delivery',
    objectiveCode: 'MACRA-TRUST-SEMANTICS',
    northStarObjective: northStar.objectives[4],
    description:
      'Create docs/research/macra-event-semantics-trust-2026-06-25.md auditing af_start_trial, af_purchase, af_subscribe, purchase_cancelled, web_checkout_started, StoreKit cancel, age eligibility, missing birthdate blocks, and trial activation. Flag ambiguity that could make the team scale a misleading signal.',
    artifactSpec: {
      kind: 'repo_file',
      targets: ['docs/research/macra-event-semantics-trust-2026-06-25.md'],
      successDefinition: 'Sage identifies clean event boundaries and trust guardrails before spend or funnel changes scale.',
      mustTouchRepo: true,
      impactScope: 'internal',
    },
    acceptanceChecks: [
      {
        kind: 'file',
        label: 'Trust audit exists',
        commandOrPath: 'docs/research/macra-event-semantics-trust-2026-06-25.md',
        expectedSignal: 'Audit separates trial, purchase, subscribe, cancel, checkout, age, and activation signals.',
      },
    ],
  },
  {
    name: 'Maintain Macra decision log for first operating cycle',
    assignee: 'Nora',
    priority: 'medium',
    complexity: 2,
    taskClass: 'delivery',
    objectiveCode: 'MACRA-DECISION-LOG',
    northStarObjective: northStar.objectives[5],
    description:
      'Update docs/agents/macra-decision-log.md after the first snapshot with the selected action, why now, expected metric movement, guardrails, owner, and follow-up date. If no action is selected because data is stale, log that explicitly.',
    artifactSpec: {
      kind: 'repo_file',
      targets: ['docs/agents/macra-decision-log.md'],
      successDefinition: 'Decision log records the operating choice and prevents untracked funnel changes.',
      mustTouchRepo: true,
      impactScope: 'internal',
    },
    acceptanceChecks: [
      {
        kind: 'file',
        label: 'Decision log updated',
        commandOrPath: 'docs/agents/macra-decision-log.md',
        expectedSignal: 'Log includes selected action or explicit no-change decision with guardrails.',
      },
    ],
  },
];

function taskPayload(task) {
  const nowFields = {
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };

  return {
    ...task,
    ...nowFields,
    status: 'todo',
    source: SOURCE,
    project: 'Macra',
    missionId: MISSION_ID,
    plannerSource: 'operator-seed',
    mode: 'execute',
    specVersion: 2,
    priorityScore: task.priority === 'high' ? 90 : 60,
    northStarDirectImpact: task.northStarObjective,
    seededAt: FieldValue.serverTimestamp(),
  };
}

async function findExistingTask(db, task) {
  const snap = await db.collection(TASKS_COLLECTION)
    .where('source', '==', SOURCE)
    .where('name', '==', task.name)
    .limit(1)
    .get();
  return snap.empty ? null : snap.docs[0];
}

async function main() {
  const app = getApps().length
    ? getApps()[0]
    : initializeApp({ credential: resolveAdminCredential() }, 'seed-macra-agent-mission');
  const db = getFirestore(app);

  console.log(`${COMMIT ? 'Applying' : 'Dry run'} Macra agent mission seed...`);

  if (COMMIT) {
    await db.doc(NORTH_STAR_DOC).set(northStar, { merge: true });
    await db.doc(MISSION_DOC).set({
      status: 'idle',
      missionId: MISSION_ID,
      northStarTitle: northStar.title,
      missionSummary: 'Macra operating mission seeded. Start Mission in /admin/missionControl when ready.',
      agentObjectives: {
        nora: northStar.objectives[1],
        scout: northStar.objectives[2],
        solara: northStar.objectives[3],
        sage: northStar.objectives[4],
      },
      updatedAt: FieldValue.serverTimestamp(),
      seededBy: 'script:seedMacraAgentMission',
    }, { merge: true });
  } else {
    console.log(`Would set ${NORTH_STAR_DOC}: ${northStar.title}`);
    console.log(`Would set ${MISSION_DOC} to idle mission ${MISSION_ID}`);
  }

  let created = 0;
  let skipped = 0;
  for (const task of tasks) {
    const existing = await findExistingTask(db, task);
    if (existing) {
      skipped += 1;
      console.log(`- skip existing: ${task.name} (${existing.id})`);
      continue;
    }

    if (COMMIT) {
      const ref = await db.collection(TASKS_COLLECTION).add(taskPayload(task));
      created += 1;
      console.log(`- created: ${task.name} (${ref.id})`);
    } else {
      created += 1;
      console.log(`- would create: ${task.name} -> ${task.assignee}`);
    }
  }

  console.log(`Done. ${COMMIT ? 'Created' : 'Would create'} ${created}; skipped ${skipped}.`);
}

main().catch((error) => {
  console.error('Failed to seed Macra agent mission:', error);
  process.exit(1);
});
