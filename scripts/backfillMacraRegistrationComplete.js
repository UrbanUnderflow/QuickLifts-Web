#!/usr/bin/env node

/**
 * Backfill `registrationComplete: true` for existing Macra users who finished
 * onboarding before iOS started writing the flag.
 *
 * Target: users where registrationEntryPoint == 'macra'
 *         AND hasCompletedMacraOnboarding == true
 *         AND registrationComplete !== true
 *
 * Writes production (quicklifts-dd3f1).
 *
 * SAFETY:
 *   - Dry-run by default. Pass --commit to actually write.
 *   - Writes pinned to prod project; a dev/wrong credential fails safely.
 *   - --limit=N to cap the number processed.
 *
 * Usage (prod creds via Secret Manager — NOT the dev ADC key):
 *   env -u GOOGLE_APPLICATION_CREDENTIALS node scripts/backfillMacraRegistrationComplete.js            # dry run
 *   env -u GOOGLE_APPLICATION_CREDENTIALS node scripts/backfillMacraRegistrationComplete.js --commit   # write
 */

const { initializeApp } = require('firebase-admin/app');
const { resolveAdminCredential } = require('./lib/resolveAdminCredential');
const { getFirestore } = require('firebase-admin/firestore');

const PROD_PROJECT_ID = 'quicklifts-dd3f1';
const args = process.argv.slice(2);
const commit = args.includes('--commit');
const limitArg = args.find((a) => a.startsWith('--limit='));
const limit = limitArg ? Math.max(0, parseInt(limitArg.split('=')[1], 10)) : 0;

async function run() {
  const credential = resolveAdminCredential();
  const app = initializeApp({ credential, projectId: PROD_PROJECT_ID }, 'backfill-macra-registration');
  console.log(`🎯 Target project: ${app.options.projectId}`);

  const db = getFirestore(app);

  const snap = await db.collection('users').where('registrationEntryPoint', '==', 'macra').get();
  console.log(`\nScanned ${snap.size} Macra-origin users.`);

  const toFix = [];
  snap.forEach((doc) => {
    const d = doc.data();
    if (d.hasCompletedMacraOnboarding === true && d.registrationComplete !== true) {
      toFix.push(doc.id);
    }
  });

  const targets = limit > 0 ? toFix.slice(0, limit) : toFix;
  console.log(`Eligible (onboarded, registrationComplete!=true): ${toFix.length}${limit ? ` — processing ${targets.length} (--limit)` : ''}`);
  if (targets.length) console.log('Sample:', targets.slice(0, 5).join(', '));

  if (!commit) {
    console.log('\n🟡 DRY RUN — no writes. Re-run with --commit to apply.');
    process.exit(0);
  }

  let written = 0;
  for (let i = 0; i < targets.length; i += 400) {
    const batch = db.batch();
    for (const id of targets.slice(i, i + 400)) {
      batch.update(db.collection('users').doc(id), { registrationComplete: true });
    }
    await batch.commit();
    written += Math.min(400, targets.length - i);
    console.log(`  committed ${written}/${targets.length}`);
  }

  console.log(`\n✅ Set registrationComplete=true on ${written} users.`);
  process.exit(0);
}

run().catch((err) => {
  console.error('❌ Failed:', err.message || err);
  process.exit(1);
});
