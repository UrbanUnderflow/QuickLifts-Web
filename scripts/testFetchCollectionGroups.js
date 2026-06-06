const { initializeApp, cert } = require('firebase-admin/app');
const { resolveAdminCredential } = require('./lib/resolveAdminCredential');
const { getFirestore } = require('firebase-admin/firestore');

const app = initializeApp({ credential: resolveAdminCredential() }, 'test-fetch-' + Date.now());
const db = getFirestore(app);

async function run() {
    try {
        let p1 = await db.collectionGroup('withdrawals').limit(1).get();
        console.log('withdrawals:', p1.size);
        let p2 = await db.collectionGroup('payouts').limit(1).get();
        console.log('payouts:', p2.size);
        let p3 = await db.collectionGroup('payout').limit(1).get();
        console.log('payout:', p3.size);
        let p4 = await db.collectionGroup('withdrawal').limit(1).get();
        console.log('withdrawal:', p4.size);
        let p5 = await db.collectionGroup('withdrawalRequests').limit(1).get();
        console.log('withdrawalRequests:', p5.size);
    } catch (e) {
        console.error('Error:', e.message);
    }
}
run().then(() => process.exit(0));
