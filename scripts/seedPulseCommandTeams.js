#!/usr/bin/env node
'use strict';

/**
 * Seed Pulse Command team structure.
 *
 * Dry run:
 *   node scripts/seedPulseCommandTeams.js
 *
 * Apply:
 *   node scripts/seedPulseCommandTeams.js --apply
 */

const { initializeApp, getApps } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { resolveAdminCredential } = require('./lib/resolveAdminCredential');

const APPLY = process.argv.includes('--apply') || process.argv.includes('--commit');

const MACRA_TEAM_ID = 'macra-growth';

const macraTeam = {
  name: 'Macra Growth',
  product: 'Macra',
  status: 'operating',
  defaultRoundtableId: 'macra-growth-ops-roundtable',
  missionId: 'macra-growth-ops',
  northStarTitle: 'Macra Trial-Start Operating System',
  northStarSummary:
    'Make trial starts repeatable without breaking trust by operating from Scoreboard, Experiments, purchase logs, cancel reasons, user state, retargeting state, and AppsFlyer imports.',
  primaryMetric: 'Qualified onboarding start to trial start',
  guardrails: [
    'Apple purchase cancels',
    'Checkout failure and cancel rate',
    'Under-18 or missing-birthdate blocks',
    'Trial activation after start',
    'Paid conversion after trial',
    'Cancel reasons: price, not ready, proof needed, broken flow',
  ],
  cadence: {
    daily: [
      'Validate AppsFlyer CSV coverage',
      'Refresh Scoreboard and experiment freshness',
      'Post one KPI snapshot',
      'Each agent posts one finding and one proposed action',
      'Nora chooses at most one operational change',
    ],
    weekly: [
      'Decide whether active experiment continues',
      'Review Apple Search Ads quality',
      'Review trials, paid conversion, and cancel feedback',
      'Promote, pause, or design next experiment',
    ],
  },
  sourceSurfaces: [
    { label: 'Macra Scoreboard', href: '/admin/emailSequences' },
    { label: 'Experiments', href: '/admin/experiments' },
    { label: 'User Management', href: '/admin/users' },
    { label: 'Cancel Reasons', href: '/admin/macraCancelReasons' },
    { label: 'Purchase Logs', href: '/admin/purchaseLogs' },
  ],
  agents: [
    {
      id: 'nora',
      displayName: 'Nora',
      role: 'Macra operator/CEO',
      focus: 'Daily operating rhythm, KPI snapshot, experiment ledger, prioritization, and decision log.',
      color: '#8b5cf6',
      launchService: 'com.quicklifts.agent.nora',
    },
    {
      id: 'scout',
      displayName: 'Scout',
      role: 'Growth/acquisition lead',
      focus: 'Apple Search Ads, source quality, campaign hypotheses, keywords, and install-to-trial movement.',
      color: '#06b6d4',
      launchService: 'com.quicklifts.agent.scout',
    },
    {
      id: 'solara',
      displayName: 'Solara',
      role: 'Lifecycle/conversion lead',
      focus: 'Onboarding copy, paywall copy, retargeting emails, cancel reasons, trust assets, and offer tests.',
      color: '#f43f5e',
      launchService: 'com.quicklifts.agent.solara',
    },
    {
      id: 'sage',
      displayName: 'Sage',
      role: 'Product quality/trust lead',
      focus: 'Nutrition safety, eligibility, activation quality, claims, compliance, and event semantics.',
      color: '#22c55e',
      launchService: 'com.quicklifts.agent.sage',
    },
  ],
};

function initAdminApp() {
  if (getApps().length > 0) return getApps()[0];
  return initializeApp({ credential: resolveAdminCredential() }, 'seed-pulse-command-teams');
}

async function main() {
  const db = getFirestore(initAdminApp());
  const teamRef = db.collection('pulse-command-teams').doc(MACRA_TEAM_ID);
  const configRef = db.doc('company-config/pulse-command');

  console.log(`${APPLY ? 'Applying' : 'Dry run'} Pulse Command team seed...`);
  console.log(`- team: pulse-command-teams/${MACRA_TEAM_ID}`);
  console.log(`- agents: ${macraTeam.agents.map((agent) => agent.id).join(', ')}`);

  if (!APPLY) {
    console.log('No writes performed. Use --apply to commit.');
    return;
  }

  await teamRef.set({
    ...macraTeam,
    seededBy: 'script:seedPulseCommandTeams',
    updatedAt: FieldValue.serverTimestamp(),
    createdAt: FieldValue.serverTimestamp(),
  }, { merge: true });

  await configRef.set({
    activeTeamId: MACRA_TEAM_ID,
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: 'script:seedPulseCommandTeams',
  }, { merge: true });

  console.log('Done.');
}

main().catch((error) => {
  console.error('Failed to seed Pulse Command teams:', error);
  process.exit(1);
});
