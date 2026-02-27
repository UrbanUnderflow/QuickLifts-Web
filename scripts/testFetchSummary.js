const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const SERVICE_ACCOUNT = {
    type: 'service_account',
    project_id: 'quicklifts-dd3f1',
    private_key_id: '***REMOVED***',
    private_key: process.env.FIREBASE_ADMIN_PRIVATE_KEY || "***REMOVED***",
    client_email: 'firebase-adminsdk-1qxb0@quicklifts-dd3f1.iam.gserviceaccount.com',
};

const app = initializeApp({ credential: cert(SERVICE_ACCOUNT) }, 'test-fetch');
const db = getFirestore(app);

async function run() {
    const res = await db.collection('workout-summaries').limit(1).get();
    res.docs.forEach(doc => {
        console.log(JSON.stringify(doc.data(), null, 2));
    });
    process.exit(0);
}
run();
