#!/usr/bin/env node

/**
 * Reset blocked kanban tasks for a specific agent.
 * Usage: node scripts/resetBlockedTasks.js <agentName>
 * Example: node scripts/resetBlockedTasks.js Scout
 */

const { initializeApp, cert } = require('firebase-admin/app');
const { resolveAdminCredential } = require('./lib/resolveAdminCredential');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

const app = initializeApp({
    credential: resolveAdminCredential(),
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
