#!/usr/bin/env node

/**
 * Backfill user.workoutCount from each user's workoutSummary subcollection count.
 * Run once so club stats and any other consumers see correct totals without subcollection fallback.
 *
 * Usage:
 *   node scripts/backfillWorkoutCount.js              # run backfill
 *   node scripts/backfillWorkoutCount.js --dry-run    # log only, no writes
 *   node scripts/backfillWorkoutCount.js --limit=100  # process first 100 users only
 *
 * Requires Firebase Admin credentials. Prefer serviceAccountKey.json at project root (gitignored);
 * see .agent/workflows/firebase-admin.md. Some environments use inline SERVICE_ACCOUNT below.
 */

const path = require('path');
const { initializeApp, cert } = require('firebase-admin/app');
const { resolveAdminCredential } = require('./lib/resolveAdminCredential');
const { getFirestore } = require('firebase-admin/firestore');

// Prefer key file; fallback to inline for environments that embed it
const credential = resolveAdminCredential();

const app = initializeApp({ credential }, 'backfill-workout-count');
const db = getFirestore(app);

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const limitArg = args.find((a) => a.startsWith('--limit='));
const limit = limitArg ? Math.max(0, parseInt(limitArg.split('=')[1], 10)) : 0;

async function main() {
  console.log('Backfill user.workoutCount from workoutSummary subcollection counts.');
  if (dryRun) console.log('DRY RUN – no writes.');
  if (limit) console.log(`Limit: ${limit} users.`);

  const usersSnap = await db.collection('users').get();
  const userIds = usersSnap.docs.map((d) => d.id);
  const toProcess = limit ? userIds.slice(0, limit) : userIds;
  console.log(`Total users: ${userIds.length}. Will process: ${toProcess.length}.`);

  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const userId of toProcess) {
    try {
      const subcolRef = db.collection('users').doc(userId).collection('workoutSummary');
      const countSnap = await subcolRef.count().get();
      const count = countSnap.data().count;

      const userRef = db.collection('users').doc(userId);
      const userSnap = await userRef.get();
      if (!userSnap.exists) {
        skipped++;
        continue;
      }
      const current = userSnap.get('workoutCount');
      const currentIsSame = current === count && typeof current === 'number';
      if (currentIsSame) {
        skipped++;
        continue;
      }

      if (!dryRun) {
        await userRef.update({ workoutCount: count });
      }
      updated++;
      const currentLabel = typeof current === 'number' ? current : '(missing)';
      if (dryRun) {
        console.log(`  [would update] ${userId}: current ${currentLabel} → workoutCount = ${count} (from workoutSummary count)`);
      } else if (count > 0 || current !== count) {
        console.log(`  ${userId}: workoutCount = ${count}`);
      }
    } catch (err) {
      errors++;
      console.error(`  ${userId}: ${err.message}`);
    }
  }

  console.log('\nDone.');
  console.log(dryRun
    ? `Would update: ${updated}, Skipped (already correct): ${skipped}, Errors: ${errors}`
    : `Updated: ${updated}, Skipped: ${skipped}, Errors: ${errors}`);
  if (dryRun) {
    console.log('\nDry-run verification:');
    console.log('  - No documents were written (safe to run).');
    if (updated > 0) console.log(`  - ${updated} user(s) would get workoutCount set from their workoutSummary subcollection count.`);
    if (skipped > 0) console.log(`  - ${skipped} user(s) already have matching workoutCount (no change).`);
    console.log('  - To apply for real, run without --dry-run.');
  } else if (updated) {
    console.log('Re-run with --dry-run to see what would change without writing.');
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
