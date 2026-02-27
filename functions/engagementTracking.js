const functions = require("firebase-functions");
const admin = require("firebase-admin");

/**
 * processEngagementEvent
 * Event-sourced listener for any user interaction (views, likes, bookmarks, usage).
 * Handles video stat incrementing and creator scoring securely backend-side.
 */
exports.processEngagementEvent = functions.firestore
    .document("engagement-events/{eventId}")
    .onCreate(async (snap, context) => {
        const event = snap.data();
        const db = admin.firestore();
        const { videoId, creatorId, type, timestamp } = event;

        if (!videoId || !creatorId || !type) {
            console.warn(`Engagement event ${context.params.eventId} missing required fields.`);
            return null;
        }

        try {
            const batch = db.batch();

            // 1. Map event type to the exact video stat field
            let statField = null;
            switch (type) {
                case "used":
                    statField = "totalAccountUsage";
                    break;
                case "like":
                    statField = "totalAccountLikes";
                    break;
                case "bookmarked":
                    statField = "totalAccountBookmarked";
                    break;
                case "reached":
                    statField = "totalAccountsReached";
                    break;
            }

            // 2. Increment Video Stat
            if (statField) {
                const videoRef = db.collection("exerciseVideos").doc(videoId);
                batch.update(videoRef, {
                    [statField]: admin.firestore.FieldValue.increment(1),
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                });
            }

            // 3. Award Creator Score if it was specifically a "Usage" (someone completed a workout with their video)
            if (type === "used") {
                const userRef = db.collection("users").doc(creatorId);
                batch.update(userRef, {
                    "categoryPoints.creator": admin.firestore.FieldValue.increment(1),
                    "updatedAt": admin.firestore.FieldValue.serverTimestamp()
                });

                console.log(`[processEngagementEvent] Awarded +1 creator points to ${creatorId}`);
            }

            // 4. Update the Monthly Vanity Metrics for the Creator Dashboard
            // e.g. engagement-metrics/user_abc_02-2026
            const date = timestamp ? timestamp.toDate() : new Date();
            // Format as MM-YYYY (e.g. 02-2026) to match iOS Date().monthYearFormat
            const monthStr = String(date.getMonth() + 1).padStart(2, '0');
            const yearStr = date.getFullYear();
            const monthYearIdentifier = `${monthStr}-${yearStr}`;

            const metricsRef = db.collection("engagement-metrics").doc(`${creatorId}_${monthYearIdentifier}`);

            // Determine which pure count to increment for the month
            let vanityIncrementField = null;
            switch (type) {
                case "used":
                    vanityIncrementField = "totalUsages";
                    break;
                case "like":
                    vanityIncrementField = "totalLikes";
                    break;
                case "bookmarked":
                    vanityIncrementField = "totalBookmarks";
                    break;
                case "reached":
                    vanityIncrementField = "totalImpressions";
                    break;
            }

            if (vanityIncrementField) {
                batch.set(metricsRef, {
                    creatorId: creatorId,
                    monthYear: monthYearIdentifier,
                    [vanityIncrementField]: admin.firestore.FieldValue.increment(1),
                    lastUpdatedAt: admin.firestore.FieldValue.serverTimestamp()
                }, { merge: true });
            }

            // Commit the batch
            await batch.commit();
            console.log(`[processEngagementEvent] Successfully processed event ${context.params.eventId} of type: ${type}`);
            return null;

        } catch (error) {
            console.error(`[processEngagementEvent] Error processing event ${context.params.eventId}:`, error);
            return null;
        }
    });
