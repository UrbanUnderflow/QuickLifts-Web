const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const app = initializeApp({
    credential: cert({
        type: 'service_account',
        project_id: 'quicklifts-dd3f1',
        private_key_id: '***REMOVED***',
        private_key: "***REMOVED***",
        client_email: 'firebase-adminsdk-1qxb0@quicklifts-dd3f1.iam.gserviceaccount.com',
        client_id: '111494077667496751062',
        auth_uri: 'https://accounts.google.com/o/oauth2/auth',
        token_uri: 'https://oauth2.googleapis.com/token',
        auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
        client_x509_cert_url: 'https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-1qxb0%40quicklifts-dd3f1.iam.gserviceaccount.com',
        universe_domain: 'googleapis.com'
    })
});
const db = getFirestore(app);

(async () => {
    // Get ALL Sage tasks
    const snap = await db.collection('kanbanTasks')
        .where('assignee', '==', 'Sage')
        .limit(10)
        .get();

    console.log(`Found ${snap.size} tasks for Sage:\n`);
    snap.docs.forEach(d => {
        const data = d.data();
        console.log('═══════════════════════════════');
        console.log('ID:', d.id);
        console.log('Task:', data.name);
        console.log('Status:', data.status);
        console.log('Source:', data.source);
        console.log('RunnerBlocked:', data.runnerBlocked || 'no');
        console.log('RunnerFailure:', data.runnerFailureMessage || 'none');
        if (data.executionSteps) {
            console.log('Steps:');
            data.executionSteps.forEach((s, i) => {
                console.log(`  ${i + 1}. [${s.status}] ${s.description}`);
                if (s.output) console.log(`     Output: ${s.output.substring(0, 400)}`);
            });
        }
        console.log('');
    });

    // Also check task-history for completed/failed tasks
    const histSnap = await db.collection('task-history')
        .where('agentId', '==', 'sage')
        .limit(5)
        .get();

    if (!histSnap.empty) {
        console.log('\n\n=== TASK HISTORY ===\n');
        histSnap.docs.forEach(d => {
            const data = d.data();
            console.log('═══════════════════════════════');
            console.log('Task:', data.taskName);
            console.log('Status:', data.finalStatus);
            console.log('Duration:', data.durationMs ? `${(data.durationMs / 1000).toFixed(0)}s` : 'unknown');
            if (data.steps) {
                data.steps.forEach((s, i) => {
                    console.log(`  ${i + 1}. [${s.status}] ${s.description}`);
                    if (s.output) console.log(`     Output: ${s.output.substring(0, 400)}`);
                });
            }
        });
    }

    process.exit(0);
})();
