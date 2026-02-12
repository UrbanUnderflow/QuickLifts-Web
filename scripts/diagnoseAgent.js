#!/usr/bin/env node

/**
 * Diagnose Scout's state: check pending commands and task statuses.
 */

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

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

const app = initializeApp({ credential: cert(SERVICE_ACCOUNT) }, 'diagnose');
const db = getFirestore(app);

async function main() {
    const agentId = 'scout';
    const agentName = 'Scout';

    console.log(`\n══════════════════════════════════════`);
    console.log(`  Scout Agent Diagnostic Report`);
    console.log(`══════════════════════════════════════\n`);

    // 1. Check presence
    const presSnap = await db.collection('agent-presence').doc(agentId).get();
    const pres = presSnap.data();
    if (pres) {
        console.log(`📡 PRESENCE:`);
        console.log(`   Status: ${pres.status}`);
        console.log(`   Current Task: ${pres.currentTask || '(none)'}`);
        console.log(`   Task Progress: ${pres.taskProgress || 0}%`);
        console.log(`   Notes: ${pres.notes || '(none)'}`);
        console.log(`   Last Heartbeat: ${pres.lastHeartbeat?.toDate?.() || 'unknown'}`);
        console.log('');
    }

    // 2. Check pending/in-progress commands
    console.log(`📨 PENDING COMMANDS (to scout):`);
    const pendingSnap = await db.collection('agent-commands')
        .where('to', '==', agentId)
        .where('status', 'in', ['pending', 'in-progress'])
        .get();

    if (pendingSnap.empty) {
        console.log(`   (none)\n`);
    } else {
        pendingSnap.docs.forEach(d => {
            const data = d.data();
            console.log(`   [${d.id}] type=${data.type} status=${data.status} from=${data.from}`);
            console.log(`   Content: "${(data.content || '').substring(0, 100)}..."`);
            console.log('');
        });
    }

    // 3. Check recent commands (last 5)
    console.log(`📋 RECENT COMMANDS (to scout, last 5):`);
    const recentSnap = await db.collection('agent-commands')
        .where('to', '==', agentId)
        .orderBy('createdAt', 'desc')
        .limit(5)
        .get();

    recentSnap.docs.forEach(d => {
        const data = d.data();
        console.log(`   [${d.id}] type=${data.type} status=${data.status} from=${data.from}`);
        console.log(`   Content: "${(data.content || '').substring(0, 80)}${(data.content || '').length > 80 ? '...' : ''}"`);
        console.log(`   Response: "${(data.response || '(none)').substring(0, 100)}${(data.response || '').length > 100 ? '...' : ''}"`);
        console.log(`   Created: ${data.createdAt?.toDate?.() || 'unknown'}`);
        console.log('');
    });

    // 4. Check kanban tasks
    console.log(`🗂️  KANBAN TASKS (assigned to ${agentName}):`);
    const kanbanSnap = await db.collection('kanban-tasks')
        .where('assignee', '==', agentName)
        .orderBy('createdAt', 'desc')
        .limit(10)
        .get();

    if (kanbanSnap.empty) {
        console.log(`   (none)\n`);
    } else {
        kanbanSnap.docs.forEach(d => {
            const data = d.data();
            console.log(`   [${d.id}] "${data.name}"`);
            console.log(`   Status: ${data.status} | Blocked: ${data.runnerBlocked || false}`);
            if (data.runnerFailureMessage) {
                console.log(`   Failure: ${data.runnerFailureMessage.substring(0, 120)}`);
            }
            console.log('');
        });
    }

    process.exit(0);
}

main().catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
});
