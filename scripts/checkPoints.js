const path = require('path');
const admin = require('firebase-admin/app');
const { resolveAdminCredential } = require('./lib/resolveAdminCredential');
const { getFirestore } = require('firebase-admin/firestore');

const credential = resolveAdminCredential();

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
