const path = require('path');
const admin = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

let credential;
try {
    const keyPath = path.join(__dirname, '..', 'serviceAccountKey.json');
    credential = admin.cert(require(keyPath));
} catch {
    const SERVICE_ACCOUNT = {
        type: 'service_account',
        project_id: 'quicklifts-dd3f1',
        private_key_id: '***REMOVED***',
        private_key: process.env.FIREBASE_ADMIN_PRIVATE_KEY || "***REMOVED***",
        client_email: 'firebase-adminsdk-1qxb0@quicklifts-dd3f1.iam.gserviceaccount.com',
        client_id: '111494077667496751062',
        auth_uri: 'https://accounts.google.com/o/oauth2/auth',
        token_uri: 'https://oauth2.googleapis.com/token',
        auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
        client_x509_cert_url: 'https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-1qxb0%40quicklifts-dd3f1.iam.gserviceaccount.com',
        universe_domain: 'googleapis.com'
    };
    credential = admin.cert(SERVICE_ACCOUNT);
}

const app = admin.initializeApp({ credential });
const db = getFirestore(app);

db.collection('users').where('username', '==', 'thetrefecta').get().then(snap => {
    snap.docs.forEach(doc => {
        const data = doc.data();
        console.log('ID:', doc.id);
        console.log('lifetimePulsePoints:', data.lifetimePulsePoints, 'Type:', typeof data.lifetimePulsePoints);
        console.log('categoryPoints:', data.categoryPoints);
    });
    process.exit();
}).catch(console.error);
