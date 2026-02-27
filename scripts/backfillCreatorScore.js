#!/usr/bin/env node

/**
 * Backfill Category Points for Creators.
 *
 * Scans all workout summaries, analyzes the `exercisesCompleted` array,
 * and awards 1 point per unique creator whose video was used in the session.
 * The creator of the video must be someone other than the user doing the workout.
 * 
 * Result is saved to `categoryPoints.creator` on the user doc.
 * 
 * Usage:
 *   node scripts/backfillCreatorScore.js              # run backfill
 *   node scripts/backfillCreatorScore.js --dry-run    # log only, no writes
 *   node scripts/backfillCreatorScore.js --limit=100  # process first 100 summaries only
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

const app = initializeApp({ credential }, 'backfill-creator-points');
const db = getFirestore(app);

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const limitArg = args.find((a) => a.startsWith('--limit='));
const limit = limitArg ? Math.max(0, parseInt(limitArg.split('=')[1], 10)) : 0;

async function run() {
    console.log(`\n🚀 Starting Creator Points Backfill ${dryRun ? '(DRY RUN)' : ''} ...`);

    // We'll tally all creator points first, then write them to user docs.
    // creatorScores = { [userId]: totalPointsAwarded }
    const creatorScores = {};

    // Use a collectionGroup query to get every single workout summary across the entire platform
    // This looks inside every user's 'workoutSummary' subcollection.
    let summariesQuery = db.collectionGroup('workoutSummary');
    if (limit > 0) {
        summariesQuery = summariesQuery.limit(limit);
    }

    // Using a stream because workout-summaries can be a very large collection
    console.log("Fetching workout summaries stream...");
    const stream = summariesQuery.stream();

    let processedCount = 0;

    for await (const doc of stream) {
        processedCount++;
        const summaryData = doc.data();

        // If it's old data and missing userId natively, fallback to grabbing it dynamically from the path users/{userId}/workoutSummary/{id}
        const workoutUserId = summaryData.userId || doc.ref.parent.parent.id;

        if (!workoutUserId) continue; // Skip if no user is assigned to this summary

        const exercisesCompleted = summaryData.exercisesCompleted || [];

        // Track unique creators used in THIS workout session
        // Map<creatorId, number_of_exercises_used>
        const creatorExerciseCounts = {};

        for (const log of exercisesCompleted) {
            const exercise = log.exercise;
            if (!exercise || !Array.isArray(exercise.videos) || exercise.videos.length === 0) continue;

            // Get currently active video's creator
            const pos = Math.max(0, Math.min(exercise.currentVideoPosition || 0, exercise.videos.length - 1));
            const video = exercise.videos[pos];
            if (!video) continue;

            const videoCreatorId = video.userId;

            // Criteria: skip empty IDs and do NOT reward if the user did their own workout/content
            if (videoCreatorId && videoCreatorId !== workoutUserId) {
                if (!creatorExerciseCounts[videoCreatorId]) {
                    creatorExerciseCounts[videoCreatorId] = 0;
                }
                creatorExerciseCounts[videoCreatorId]++;
            }
        }

        // Add to our global totals
        for (const [creatorId, count] of Object.entries(creatorExerciseCounts)) {
            if (!creatorScores[creatorId]) {
                creatorScores[creatorId] = 0;
            }
            creatorScores[creatorId] += count;
        }

        if (processedCount % 500 === 0) {
            console.log(`⏳ Scanned ${processedCount} workout summaries...`);
        }
    }

    console.log(`\n✅ Scan complete. Evaluated ${processedCount} total summaries.`);

    const uniqueCreatorsCount = Object.keys(creatorScores).length;
    if (uniqueCreatorsCount === 0) {
        console.log("No creator points found to award. Exiting.");
        process.exit(0);
    }

    console.log(`\n🏆 Ready to award points to ${uniqueCreatorsCount} creators.\n`);

    // Prepare to write to user docs
    let writeCount = 0;

    for (const [creatorId, totalPoints] of Object.entries(creatorScores)) {
        console.log(`[👤 ${creatorId}] Earned ${totalPoints} Creator Points`);

        if (!dryRun) {
            const userRef = db.collection('users').doc(creatorId);

            try {
                // Since this completely overrides previous backfills, we'll set the exact amount computed. 
                // We're calculating *total historical points*, so we set it explicitly rather than incrementing.
                await userRef.update({
                    "categoryPoints.creator": totalPoints
                });
                writeCount++;
            } catch (err) {
                // It's possible the user doc doesn't exist if they deleted their account
                if (err.code === 5) { // NOT_FOUND
                    console.error(`❌ User ${creatorId} not found. Skipping.`);
                } else {
                    console.error(`❌ Error updating user ${creatorId}:`, err);
                }
            }
        }
    }

    console.log(`\n=== Backfill Complete ===`);
    if (dryRun) {
        console.log(`(This was a DRY RUN. Evaluated ${processedCount} summaries. No data was written.)`);
    } else {
        console.log(`✅ successfully updated ${writeCount} user documents with their creator points.`);
    }

    process.exit(0);
}

run().catch(console.error);
