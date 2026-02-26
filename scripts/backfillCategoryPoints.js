#!/usr/bin/env node

/**
 * Backfill categoryPoints for all users to establish Specialty Classes.
 *
 * Aggregates Pulse Points from THREE sources per user:
 *   1. workout-summaries   → strength
 *   2. runSummaries        → endurance
 *   3. fatBurnSummaries    → burn
 *
 * The final categoryPoints object = { strength: X, endurance: Y, burn: Z }
 *
 * Usage:
 *   node scripts/backfillCategoryPoints.js              # run backfill
 *   node scripts/backfillCategoryPoints.js --dry-run    # log only, no writes
 *   node scripts/backfillCategoryPoints.js --limit=10   # process first 10 users only
 *
 * Requires Firebase Admin credentials. Uses serviceAccountKey.json at project root.
 */

const path = require('path');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

// Firebase Admin setup
let credential;
try {
    const keyPath = path.join(__dirname, '..', 'serviceAccountKey.json');
    credential = cert(require(keyPath));
} catch {
    const SERVICE_ACCOUNT = {
        type: 'service_account',
        project_id: 'quicklifts-dd3f1',
        private_key_id: '***REMOVED***',
        private_key: process.env.FIREBASE_ADMIN_PRIVATE_KEY || "***REMOVED***",
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

const app = initializeApp({ credential }, 'backfill-category-points');
const db = getFirestore(app);

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const limitArg = args.find((a) => a.startsWith('--limit='));
const limit = limitArg ? Math.max(0, parseInt(limitArg.split('=')[1], 10)) : 0;

// Helper to determine specialty class title
function getSpecialtyClass(categories) {
    if (!categories || Object.keys(categories).length === 0) return 'Iron Fist';
    let topDiscipline = 'strength';
    let maxPts = -1;
    for (const [disc, pts] of Object.entries(categories)) {
        if (pts > maxPts) {
            maxPts = pts;
            topDiscipline = disc;
        }
    }

    switch (topDiscipline) {
        case 'strength': return 'Iron Fist';
        case 'endurance': return 'Shadow Runner';
        case 'burn': return 'Inferno';
        case 'flexibility': return 'Phantom';
        case 'aqua': return 'Tidebreaker';
        default: return 'Iron Fist';
    }
}

async function run() {
    console.log(`\n🚀 Starting Category Points Backfill ${dryRun ? '(DRY RUN)' : ''} ...`);

    const usersSnap = await db.collection('users').get();
    let totalUsersCount = usersSnap.docs.length;
    let usersToProcess = usersSnap.docs;

    if (limit > 0) {
        console.log(`⚠️ Limit parameter detected. Processing only ${limit} out of ${totalUsersCount} users.`);
        usersToProcess = usersToProcess.slice(0, limit);
        totalUsersCount = usersToProcess.length;
    }

    console.log(`Found ${totalUsersCount} users to process.\n`);

    let processed = 0;
    let updatedCount = 0;

    // Process in batches
    const BATCH_SIZE = 100;
    for (let i = 0; i < usersToProcess.length; i += BATCH_SIZE) {
        const batchDocs = usersToProcess.slice(i, i + BATCH_SIZE);

        await Promise.all(batchDocs.map(async (userDoc) => {
            const uid = userDoc.id;

            let strengthPts = 0;
            let endurancePts = 0;
            let burnPts = 0;

            try {
                // 1. Workouts (Strength)
                const workoutsSnap = await db.collection('workout-summaries')
                    .where('userId', '==', uid)
                    .get();

                workoutsSnap.docs.forEach(doc => {
                    const data = doc.data();
                    if (data.pulsePoints && data.pulsePoints.totalPoints) {
                        strengthPts += (data.pulsePoints.totalPoints || 0);
                    } else if (data.pulsePointsEarned) {
                        strengthPts += (data.pulsePointsEarned || 0);
                    }
                });

                // 2. Runs (Endurance)
                const runsSnap = await db.collection(`users/${uid}/runSummaries`).get();

                runsSnap.docs.forEach(doc => {
                    const data = doc.data();
                    if (data.pulsePoints && data.pulsePoints.totalPoints) {
                        endurancePts += (data.pulsePoints.totalPoints || 0);
                    }
                });

                // 3. Fat Burns (Burn)
                const burnsSnap = await db.collection(`users/${uid}/fatBurnSummaries`).get();

                burnsSnap.docs.forEach(doc => {
                    const data = doc.data();
                    if (data.pulsePoints && data.pulsePoints.totalPoints) {
                        burnPts += (data.pulsePoints.totalPoints || 0);
                    }
                });

                const categoryPoints = {};
                if (strengthPts > 0) categoryPoints.strength = strengthPts;
                if (endurancePts > 0) categoryPoints.endurance = endurancePts;
                if (burnPts > 0) categoryPoints.burn = burnPts;

                const currentData = userDoc.data();
                const existingCategoryPoints = currentData.categoryPoints || {};

                // Only update if there are points and they differ from what's there
                const hasChanges =
                    (existingCategoryPoints.strength || 0) !== strengthPts ||
                    (existingCategoryPoints.endurance || 0) !== endurancePts ||
                    (existingCategoryPoints.burn || 0) !== burnPts;

                if (hasChanges && Object.keys(categoryPoints).length > 0) {
                    const sClass = getSpecialtyClass(categoryPoints);
                    console.log(`[👤 ${uid}] Updating... | Strength: ${strengthPts} | Endurance: ${endurancePts} | Burn: ${burnPts} => [${sClass}]`);

                    if (!dryRun) {
                        await userDoc.ref.update({
                            categoryPoints: categoryPoints
                        });
                    }
                    updatedCount++;
                } else {
                    console.log(`[👤 ${uid}] Up to date. Skipping.`);
                }

                processed++;
                if (processed % 50 === 0) {
                    console.log(`\n⏳ Progress: ${processed}/${totalUsersCount}`);
                }

            } catch (err) {
                console.error(`❌ Error processing user ${uid}:`, err);
            }
        }));
    }

    console.log(`\n=== Backfill Complete ===`);
    console.log(`Total processed: ${processed}`);
    console.log(`Users updated:   ${updatedCount}`);
    if (dryRun) {
        console.log(`(This was a DRY RUN. No data was actually written.)`);
    } else {
        console.log(`✅ Firestore update successful.`);
    }

    process.exit(0);
}

run().catch(console.error);
