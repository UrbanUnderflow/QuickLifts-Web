const admin = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

const path = require('path');
let credential;
try {
    const keyPath = path.join(__dirname, '..', 'serviceAccountKey.json');
    credential = admin.cert(require(keyPath));
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
    credential = admin.cert(SERVICE_ACCOUNT);
}

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

    // 2. Top Architects 
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
    process.exit(0);
}

run().catch(console.error);
