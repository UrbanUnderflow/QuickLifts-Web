const admin = require("firebase-admin/app");
const { resolveAdminCredential } = require("./lib/resolveAdminCredential");
const { getFirestore } = require("firebase-admin/firestore");

const path = require('path');
const credential = resolveAdminCredential();

const app = admin.initializeApp({ credential });
const db = getFirestore(app);

async function run() {
    console.log("Starting leaderboard cache script...");

    // 1. Global 100 
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

    // 2. Top Creators 
    const creatorsSnap = await db.collection("users")
        .orderBy("categoryPoints.creator", "desc")
        .limit(100)
        .get();

    const creatorUsers = creatorsSnap.docs.map(doc => {
        const data = doc.data();
        return {
            id: doc.id,
            username: data.username || "",
            displayName: data.displayName || "",
            email: data.email || "",
            profileImage: data.profileImage || { profileImageURL: "" },
            lifetimePulsePoints: data.lifetimePulsePoints || 0,
            creatorScore: (data.categoryPoints && data.categoryPoints.creator) ? data.categoryPoints.creator : 0
        };
    });

    await db.collection("leaderboards").doc("topCreators").set({
        users: creatorUsers,
        updatedAt: new Date()
    });
    console.log(`Cached Top Creators logic updated. Count: ${creatorUsers.length}`);

    console.log("Leaderboards successfully cached.");
    process.exit(0);
}

run().catch(console.error);
