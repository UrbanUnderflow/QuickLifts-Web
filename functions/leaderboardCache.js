const { getFirestore } = require("firebase-admin/firestore");
const { onSchedule } = require("firebase-functions/v2/scheduler");

/**
 * Periodically caches the top 100 users for Global and Architects leaderboards.
 * Runs every 6 hours. Resulting documents are saved to:
 * - leaderboards/global100 (Array of 100 ShortUser objects)
 * - leaderboards/topArchitects (Array of 100 ShortUser objects)
 */
exports.scheduledLeaderboardCache = onSchedule("every 6 hours", async (event) => {
    try {
        const db = getFirestore();
        console.log("Starting leaderboard cache update...");

        // 1. Global 100 (sorted by lifetimePulsePoints)
        const global100Snap = await db.collection("users")
            .orderBy("lifetimePulsePoints", "desc")
            .limit(100)
            .get();

        const global100Users = global100Snap.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                username: data.username || "",
                displayName: data.displayName || "",
                email: data.email || "",
                profileImage: data.profileImage || { profileImageURL: "" },
                lifetimePulsePoints: data.lifetimePulsePoints || 0
            };
        });

        await db.collection("leaderboards").doc("global100").set({
            users: global100Users,
            updatedAt: new Date()
        });
        console.log(`Cached Global 100 logic updated. Count: ${global100Users.length}`);

        // 2. Top Architects (sorted by categoryPoints.creator)
        const architectsSnap = await db.collection("users")
            .orderBy("categoryPoints.creator", "desc")
            .limit(100)
            .get();

        const architectUsers = architectsSnap.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                username: data.username || "",
                displayName: data.displayName || "",
                email: data.email || "",
                profileImage: data.profileImage || { profileImageURL: "" },
                lifetimePulsePoints: data.lifetimePulsePoints || 0
            };
        });

        await db.collection("leaderboards").doc("topArchitects").set({
            users: architectUsers,
            updatedAt: new Date()
        });
        console.log(`Cached Top Architects logic updated. Count: ${architectUsers.length}`);

        console.log("Leaderboards successfully cached.");
    } catch (error) {
        console.error("Error caching leaderboards: ", error);
        throw new Error("scheduledLeaderboardCache failed");
    }
});
