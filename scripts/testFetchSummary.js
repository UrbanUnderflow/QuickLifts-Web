const { initializeApp, cert } = require('firebase-admin/app');
const { resolveAdminCredential } = require('./lib/resolveAdminCredential');
const { getFirestore } = require('firebase-admin/firestore');

const app = initializeApp({ credential: resolveAdminCredential() }, 'test-fetch');
const db = getFirestore(app);

async function run() {
    const res = await db.collection('workout-summaries').limit(1).get();
    res.docs.forEach(doc => {
        console.log(JSON.stringify(doc.data(), null, 2));
    });
    process.exit(0);
}
run();
