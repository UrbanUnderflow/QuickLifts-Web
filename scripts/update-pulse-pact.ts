/**
 * One-time script to update the Pulse Pact club document in Firestore.
 * 
 * Usage: npx ts-node --esm scripts/update-pulse-pact.ts
 */
import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env from project root
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

if (!admin.apps.length) {
    if (process.env.FIREBASE_SECRET_KEY) {
        admin.initializeApp({
            credential: admin.credential.cert({
                projectId: "quicklifts-dd3f1",
                privateKey: process.env.FIREBASE_SECRET_KEY.replace(/\\n/g, '\n'),
                clientEmail: "firebase-adminsdk-1qxb0@quicklifts-dd3f1.iam.gserviceaccount.com",
            })
        });
    } else {
        // Fallback for local dev with GOOGLE_APPLICATION_CREDENTIALS set
        admin.initializeApp({ projectId: "quicklifts-dd3f1" });
    }
}

const db = admin.firestore();

async function updatePulsePact() {
    const clubId = "pulse_fit_club";
    const clubRef = db.collection("clubs").doc(clubId);

    // First check if it exists
    const doc = await clubRef.get();

    if (!doc.exists) {
        console.error(`❌ Club document "${clubId}" not found in Firestore!`);
        console.log("Available clubs:");
        const allClubs = await db.collection("clubs").get();
        allClubs.forEach(d => {
            const data = d.data();
            console.log(`  - ${d.id}: "${data.name}" (creator: ${data.creatorId})`);
        });
        return;
    }

    const currentData = doc.data();
    console.log("📋 Current club data:", JSON.stringify(currentData, null, 2));

    // Update the club with the new Pulse Pact branding
    await clubRef.update({
        name: "The Pulse Pact",
        description: "A training club for people who show up. Lifts. Runs. Challenges. One crew.",
        updatedAt: Date.now() / 1000,
    });

    // Verify the update  
    const updated = await clubRef.get();
    console.log("\n✅ Updated club data:", JSON.stringify(updated.data(), null, 2));
    console.log("\n🎉 The Pulse Pact is live!");
}

updatePulsePact()
    .then(() => process.exit(0))
    .catch(err => {
        console.error("Error:", err);
        process.exit(1);
    });
