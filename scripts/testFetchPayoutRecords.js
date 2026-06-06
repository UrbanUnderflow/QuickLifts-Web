const { initializeApp, cert } = require('firebase-admin/app');
const { resolveAdminCredential } = require('./lib/resolveAdminCredential');
const { getFirestore } = require('firebase-admin/firestore');

const app = initializeApp({ credential: resolveAdminCredential() }, 'test-fetch-' + Date.now());
const db = getFirestore(app);

async function run() {
    let res = await db.collection('payoutRecords').limit(5).get();
    console.log('payoutRecords count:', res.size);
    res.docs.forEach(doc => {
        console.log(JSON.stringify(doc.data(), null, 2));
    });
    process.exit(0);
}
run();
