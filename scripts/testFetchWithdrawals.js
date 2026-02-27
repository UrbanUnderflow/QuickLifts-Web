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
