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
const { resolveAdminCredential } = require('./lib/resolveAdminCredential');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

// Firebase Admin setup
const credential = resolveAdminCredential();

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
