const { initializeApp, cert } = require('firebase-admin/app');
const { resolveAdminCredential } = require('./lib/resolveAdminCredential');
const { getFirestore } = require('firebase-admin/firestore');

const app = initializeApp({ credential: resolveAdminCredential() }, 'test-fetch-' + Date.now());
const db = getFirestore(app);

async function run() {
    try {
        const collections = await db.listCollections();
        console.log('Collections:');
        collections.forEach(collection => {
            if (collection.id.toLowerCase().includes('payout') || collection.id.toLowerCase().includes('withdraw') || collection.id.toLowerCase().includes('transfer') || collection.id.toLowerCase().includes('transaction')) {
                console.log('-', collection.id);
            }
        });
    } catch (e) {
        console.error(e);
    }
}
run().then(() => process.exit(0));
