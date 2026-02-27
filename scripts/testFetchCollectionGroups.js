const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const SERVICE_ACCOUNT = {
    type: 'service_account',
    project_id: 'quicklifts-dd3f1',
    private_key_id: '***REMOVED***',
    private_key: process.env.FIREBASE_ADMIN_PRIVATE_KEY || "***REMOVED***",
    client_email: 'firebase-adminsdk-1qxb0@quicklifts-dd3f1.iam.gserviceaccount.com',
};

const app = initializeApp({ credential: cert(SERVICE_ACCOUNT) }, 'test-fetch-' + Date.now());
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
