const functions = require("firebase-functions");
const admin = require("firebase-admin");

/**
 * calculateMonthlyPayouts
 * Runs on the 1st of every month at Midnight.
 * Distributes the $2.50 premium subscription pool for each subscriber proportionally
 * to the creators whose content they used in the previous month.
 */
exports.calculateMonthlyPayouts = functions.pubsub.schedule("0 0 1 * *").onRun(async (context) => {
    console.log("[calculateMonthlyPayouts] Starting monthly payout batch job...");
    const db = admin.firestore();

    // 1. Determine the previous month's target date range
    const now = new Date();
    // E.g., if today is Feb 1st, we want Jan 1 to Jan 31
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

    console.log(`[calculateMonthlyPayouts] Aggregating usage payouts from ${startOfLastMonth.toISOString()} to ${endOfLastMonth.toISOString()}`);

    try {
        // 2. Map to accumulate earnings for each creator globally
        // creatorId -> payout in USD
        const creatorEarningsMap = new Map();

        // 3. Fetch all users who had a premium subscription last month
        // We assume anyone who is currently subscribed contributed to the pool
        const usersSnapshot = await db.collection("users")
            .where("subscriptionType", "==", "PREMIUM") // Update "PREMIUM" or "premium" based on schema
            .get();

        console.log(`[calculateMonthlyPayouts] Found ${usersSnapshot.size} premium users to extract pools from.`);

        // 4. Process each premium user's $2.50 pool
        // To avoid memory limits if the user base scales, we process them individually
        for (const userDoc of usersSnapshot.docs) {
            const userId = userDoc.id;
            const CREATOR_POOL = 2.50; // $2.50 is the 50% rev-share pool allocated by this subscriber

            // 5. Query this specific user's 'used' events for the previous month
            // Note: This query requires an index on [engagerId, type, timestamp]
            const eventsSnapshot = await db.collection("engagement-events")
                .where("engagerId", "==", userId)
                .where("type", "==", "used")
                .where("timestamp", ">=", startOfLastMonth)
                .where("timestamp", "<=", endOfLastMonth)
                .get();

            if (eventsSnapshot.empty) {
                // User didn't engage with any creator content, the $2.50 pool is retained by Pulse
                continue;
            }

            // 6. Tally the usage distribution for this specific user
            // e.g., Creator A was used 10 times, Creator B was used 5 times
            const creatorUsageCountForUser = new Map();
            let totalUsagesByUser = 0;

            eventsSnapshot.docs.forEach(doc => {
                const event = doc.data();
                const creatorId = event.creatorId;

                // Do not pay the user for consuming their own content just in case the client trigger failed
                if (creatorId && creatorId !== userId) {
                    creatorUsageCountForUser.set(creatorId, (creatorUsageCountForUser.get(creatorId) || 0) + 1);
                    totalUsagesByUser++;
                }
            });

            // If the user's usages were entirely their own videos, continue
            if (totalUsagesByUser === 0) continue;

            // 7. Distribute the $2.50 pool proportionally among the creators they used
            creatorUsageCountForUser.forEach((usages, creatorId) => {
                const percentageOfPool = usages / totalUsagesByUser;
                const earnedAmount = percentageOfPool * CREATOR_POOL;

                // Add to the global map for this batch
                const currentCreatorTotal = creatorEarningsMap.get(creatorId) || 0;
                creatorEarningsMap.set(creatorId, currentCreatorTotal + earnedAmount);
            });
        }

        // 8. We have mapped out exactly how much every creator on the platform earned this month.
        // It's time to process the payouts into their virtual walletBalances!
        console.log(`[calculateMonthlyPayouts] Successfully mapped pools. ${creatorEarningsMap.size} creators earned a payout this month.`);

        let processedCreators = 0;
        const BATCH_LIMIT = 500;
        let batch = db.batch();

        for (const [creatorId, amount] of creatorEarningsMap.entries()) {
            if (amount <= 0) continue;

            const creatorRef = db.collection("users").doc(creatorId);

            // Using pure map nesting to safely update the `creator` object map
            batch.update(creatorRef, {
                "creator.walletBalance": admin.firestore.FieldValue.increment(amount),
                "creator.historicEarnings": admin.firestore.FieldValue.increment(amount),
                "updatedAt": admin.firestore.FieldValue.serverTimestamp()
            });

            processedCreators++;

            // Commit batches of 500 to stay within Firestore limits
            if (processedCreators % BATCH_LIMIT === 0) {
                await batch.commit();
                batch = db.batch();
            }
        }

        // Commit remaining batch
        if (processedCreators % BATCH_LIMIT !== 0) {
            await batch.commit();
        }

        console.log(`[calculateMonthlyPayouts] Job Completed Successfully. Deposited funds into ${processedCreators} wallets.`);
        return null;

    } catch (error) {
        console.error("[calculateMonthlyPayouts] FAILED:", error);
        return null; // Return null so pubsub unhooks cleanly
    }
});
