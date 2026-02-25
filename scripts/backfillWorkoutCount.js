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
const { getFirestore } = require('firebase-admin/firestore');

// Prefer key file; fallback to inline for environments that embed it
let credential;
try {
  const keyPath = path.join(__dirname, '..', 'serviceAccountKey.json');
  credential = cert(require(keyPath));
} catch {
  const SERVICE_ACCOUNT = {
    type: 'service_account',
    project_id: 'quicklifts-dd3f1',
    private_key_id: 'abbd015806ef3b43d93101522f12d029e736f447',
    private_key: process.env.FIREBASE_ADMIN_PRIVATE_KEY || "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDEZkOP1Kz/jfQc\nLrN2SKLVdRNCZHGHN+wcfqQXknnD47Y6GBA35O1573Ipk5FaRNvxysB/YP/Z9dLP\nOO/xk8yRA+FFI32kzQlBIpVHDVN/upfXRWS/38+1kktPD3EjwEFRB8HvYVopCm1k\nCaFOZZfrrHM2IEdboKDt3ByLoNNPLZhivcurhBm4PENNEVlyMiqqWBwTu0sFGkZ8\nLHQ4JGtaPe5VomlpVlokKmdQzEwVTWexSeQkbdXnYkd1m/sfT3mjP6RLBlXlJ4f/\nOp36QofqPxNRV7TJ/YkrL2nOLo6gq6XWS3ciVINUS9cuPlEIg+5OrR4eQUYhay3N\n5dakXn+ZAgMBAAECggEAJv+de9KB1a8E4ZG+bgbnWpaIT/8s8eo/Vrso70tVJXoy\nhZ+gnNC2/Sb4VtwoGTIiMIWPqtuCgm/HQAGw15n/HW6VTUrKWK6kH0x0MuspAOx2\n2Ta81kLldksJ7DWHRE+ZSLNPJa8BnbOl3B7zamNPAuu35vAK611eh0zVWD6Dpy1v\n7933i/pOMpvDY0ieoT0pl0GJcCVOBTS2f8z1+huepW5++G0TrTCZdq9ixCF68xEc\nyGTr1Dz/Qdv4gIO2SNk3TfKmw/HaL3tQM1izdMsJVs+nPxzmHj3tLnppyQJJFwcF\nZ1njhg6eSHPOINU/wu2KL2B+pXiROBLQr1JnvJsCZwKBgQDsYNrmbDhShYeU+OSs\nSaQx0POBeZFtlsMIbJomTSDr73Gn4ZXJaXfNoqvIuJel5SCTytK36Y+84/S3xeuy\nmXGMpfqBmEilMU5D4VOmSH/HFH6+35m1LWFw3aWSVGuUSIEQoWTKjWB9zQVwFd5w\nEw6HsuNm1IJvsEfZpzXpcydBMwKBgQDUs9cLfY93MbkT5M/WL9jbPp846HZxvzeW\nGiBR7gMAPMre32DPDKQKqnRVAvXJPhd8mKjC3T4gRm+NBWKLQjIUO0RQoVG39HN/\n9yGBTyLMccJf5d9MZe5OIwkVhbN5ekPucNhqHJQEIVz0duZ7UhFgfgLSroy/04vA\ndjgGeGxUAwKBgD+9Pkm0FNvrtcut8bujf+sO9RqMtXJfnOfAoTCCy8XTI0qpwcI1\n9mA05S2S2RGa31X68yc0i9Xbgjmr3Qqj5cKPXyVi8vPYf8o+EFheZFZCaIr/sGry\nebv9iJAUw42Qn3zkiFE2HjbN+hFnVDvUZ66fxkIMO7/yQO2n8RmqO4ORAoGAFbqV\nglf+WvfaZ1zdmoziw2r/Swn8Z5xYKl5a5OPCrLiJJQF+20f4ThqhrbmSsE9GiPTz\ncIy3dwabCLX/HijSAt0XGoGQXpF7Zxww8QvLi0UnzTIngJ99G8BagjdZYVSLMgWX\nJifrOwzJeTPYUcrNeaUF1s38FPCgezXYfVi6AE8CgYEAv+9EP3q6zY51CMtXKb04\n1yLrnZze20aUMmAQ0KE1nH9ZRk7GgT+Bbmq1Nw6Ro3xItPffX42S5w8jDhiZJK/j\neVGloaXM9MHG2uTPWSVlUJ2ew2LcYpq42PbJUuS06teFFPohMCOs7urTc0Vdya5u\ngTynFJmBFslLO3UKNPAshn0=\n-----END PRIVATE KEY-----\n",
    client_email: 'firebase-adminsdk-1qxb0@quicklifts-dd3f1.iam.gserviceaccount.com',
    client_id: '111494077667496751062',
    auth_uri: 'https://accounts.google.com/o/oauth2/auth',
    token_uri: 'https://oauth2.googleapis.com/token',
    auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
    client_x509_cert_url: 'https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-1qxb0%40quicklifts-dd3f1.iam.gserviceaccount.com',
    universe_domain: 'googleapis.com'
  };
  credential = cert(SERVICE_ACCOUNT);
}

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
