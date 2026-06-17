#!/usr/bin/env node

/**
 * Set the LIVE Macra paywall+onboarding experiment to the
 * "monthly + annual, both with trial" flow and retire the hard paywall.
 *
 * Writes macra-experiments/macra_paywall_onboarding in production
 * (quicklifts-dd3f1). Mirrors DEFAULT_EXPERIMENT in
 * src/pages/admin/experiments.tsx so the admin page renders it identically.
 *
 * SAFETY:
 *   - Dry-run by default. Pass --commit to actually write.
 *   - Hard-asserts the resolved project is quicklifts-dd3f1, aborts otherwise.
 *
 * Usage (prod creds via Secret Manager — DO NOT use the dev ADC key):
 *   env -u GOOGLE_APPLICATION_CREDENTIALS node scripts/setMacraExperimentFlow.js            # dry run
 *   env -u GOOGLE_APPLICATION_CREDENTIALS node scripts/setMacraExperimentFlow.js --commit   # write
 */

const { initializeApp } = require('firebase-admin/app');
const { resolveAdminCredential } = require('./lib/resolveAdminCredential');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

const PROD_PROJECT_ID = 'quicklifts-dd3f1';
const COLLECTION = 'macra-experiments';
const DOC_ID = 'macra_paywall_onboarding';

const commit = process.argv.slice(2).includes('--commit');

// Single source of truth — keep in lockstep with DEFAULT_EXPERIMENT.variants
// in src/pages/admin/experiments.tsx.
const VARIANTS = [
  {
    id: 'baseline',
    name: 'Baseline (long paywall)',
    description: 'Retired control 2026-06-16. Long paywall with standard onboarding.',
    isEnabled: false,
    weight: 0,
    parameters: {
      macra_paywall_default_plan: 'annual',
      macra_paywall_layout_variant: 'trial_confidence_control',
      onboarding_experience_variant: 'standard',
    },
  },
  {
    id: 'variant_a',
    name: 'Monthly + annual, both with trial',
    description: 'Active flow 2026-06-16. Compact trial-prep + plan selection showing BOTH monthly and annual, each with the 3-day free trial.',
    isEnabled: true,
    weight: 100,
    parameters: {
      macra_paywall_default_plan: 'annual',
      macra_paywall_layout_variant: 'trial_confidence',
      onboarding_experience_variant: 'standard',
    },
  },
  {
    id: 'variant_b',
    name: 'Nora guided onboarding',
    description: 'Disabled 2026-06-16. Nora-guided onboarding + compact paywall.',
    isEnabled: false,
    weight: 0,
    parameters: {
      macra_paywall_default_plan: 'annual',
      macra_paywall_layout_variant: 'trial_confidence',
      onboarding_experience_variant: 'nora_guided',
    },
  },
  {
    id: 'variant_c',
    name: 'Hard paywall monthly',
    description: 'Retired 2026-06-16 — monthly-only, no trial. Converted ~1% with ~95% Apple-sheet cancels.',
    isEnabled: false,
    weight: 0,
    parameters: {
      macra_paywall_default_plan: 'monthly',
      macra_paywall_layout_variant: 'hard_paywall_value',
      onboarding_experience_variant: 'nora_guided',
    },
  },
];

async function run() {
  const credential = resolveAdminCredential();
  const app = initializeApp({ credential, projectId: PROD_PROJECT_ID }, 'set-macra-experiment-flow');

  // Writes are pinned to prod via initializeApp({ projectId }). A dev/wrong
  // credential just fails the Firestore call with a permission error rather
  // than touching the wrong project.
  const resolvedProject = app.options.projectId;
  console.log(`🎯 Target project: ${resolvedProject}`);

  const db = getFirestore(app);
  const ref = db.collection(COLLECTION).doc(DOC_ID);

  const snap = await ref.get();
  const before = snap.exists ? snap.data() : null;

  console.log(`\n📄 ${COLLECTION}/${DOC_ID} on ${resolvedProject}`);
  console.log('--- BEFORE ---');
  console.log(before ? summarize(before.variants) : '(doc does not exist)');
  console.log('--- AFTER ---');
  console.log(summarize(VARIANTS));

  if (!commit) {
    console.log('\n🟡 DRY RUN — no write. Re-run with --commit to apply.');
    process.exit(0);
  }

  await ref.set(
    {
      id: DOC_ID,
      name: 'Macra Paywall + Onboarding',
      description: 'Controls Macra onboarding and paywall treatments from Firestore-backed experiment config.',
      isEnabled: true,
      assignmentSalt: 'macra-paywall-onboarding-2026-05',
      primaryMetric: 'paid_conversion',
      owner: 'Macra',
      variants: VARIANTS,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: 'script:setMacraExperimentFlow',
    },
    { merge: true },
  );

  console.log('\n✅ Wrote new experiment config. Refresh /admin/experiments → Results to confirm.');
  process.exit(0);
}

function summarize(variants) {
  if (!Array.isArray(variants)) return '(no variants)';
  return variants
    .map((v) => `  • ${v.id} "${v.name}" — ${v.isEnabled ? 'ON' : 'off'} w=${v.weight} [${v.parameters?.macra_paywall_layout_variant}/${v.parameters?.macra_paywall_default_plan}]`)
    .join('\n');
}

run().catch((err) => {
  console.error('❌ Failed:', err.message || err);
  process.exit(1);
});
