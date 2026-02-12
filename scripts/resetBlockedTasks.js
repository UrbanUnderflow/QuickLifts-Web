#!/usr/bin/env node

/**
 * Reset blocked kanban tasks for a specific agent.
 * Usage: node scripts/resetBlockedTasks.js <agentName>
 * Example: node scripts/resetBlockedTasks.js Scout
 */

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

const SERVICE_ACCOUNT = {
    type: "service_account",
    project_id: "quicklifts-dd3f1",
    private_key_id: "***REMOVED***",
    private_key: "***REMOVED***",
    client_email: "firebase-adminsdk-1qxb0@quicklifts-dd3f1.iam.gserviceaccount.com",
    client_id: "111494077667496751062",
    auth_uri: "https://accounts.google.com/o/oauth2/auth",
    token_uri: "https://oauth2.googleapis.com/token",
    auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
    client_x509_cert_url: "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-1qxb0%40quicklifts-dd3f1.iam.gserviceaccount.com",
    universe_domain: "googleapis.com"
};

const app = initializeApp({
    credential: cert(SERVICE_ACCOUNT),
}, 'reset-tasks');
const db = getFirestore(app);

async function main() {
    const agentName = process.argv[2] || 'Scout';
    console.log(`\n🔍 Finding blocked tasks for "${agentName}"...\n`);

    const snap = await db.collection('kanban-tasks')
        .where('assignee', '==', agentName)
        .where('runnerBlocked', '==', true)
        .get();

    if (snap.empty) {
        console.log('✅ No blocked tasks found.');

        // Also check for in-progress tasks that might be stuck
        const inProgressSnap = await db.collection('kanban-tasks')
            .where('assignee', '==', agentName)
            .where('status', '==', 'in-progress')
            .get();

        if (!inProgressSnap.empty) {
            console.log(`\n⚠️  Found ${inProgressSnap.size} in-progress task(s):`);
            inProgressSnap.docs.forEach(doc => {
                const d = doc.data();
                console.log(`   - [${doc.id}] "${d.name}" (status: ${d.status})`);
            });
            console.log('\nThese tasks are in-progress but not blocked. The runner should pick them up.');
        }

        process.exit(0);
    }

    console.log(`Found ${snap.size} blocked task(s):\n`);

    for (const doc of snap.docs) {
        const data = doc.data();
        console.log(`📋 [${doc.id}] "${data.name}"`);
        console.log(`   Status: ${data.status}`);
        console.log(`   Failure: ${data.runnerFailureMessage || 'no message'}`);
        console.log(`   Resetting → todo, removing block...\n`);

        await db.collection('kanban-tasks').doc(doc.id).update({
            runnerBlocked: FieldValue.delete(),
            runnerFailureAt: FieldValue.delete(),
            runnerFailureMessage: FieldValue.delete(),
            status: 'todo',
            updatedAt: FieldValue.serverTimestamp(),
        });
    }

    console.log(`✅ Reset ${snap.size} blocked task(s). Scout's runner will pick them up on next cycle.`);
    process.exit(0);
}

main().catch(err => {
    console.error('❌ Error:', err.message);
    process.exit(1);
});
