const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const fs = require('fs');
const path = require('path');

// Read env file manually (no dotenv dependency needed)
function loadEnv(filePath) {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        content.split('\n').forEach(line => {
            const match = line.match(/^([^#=]+)=(.*)$/);
            if (match) {
                const key = match[1].trim();
                const val = match[2].trim().replace(/^["']|["']$/g, '');
                if (!process.env[key]) process.env[key] = val;
            }
        });
    } catch (e) { /* ignore */ }
}

loadEnv(path.resolve(__dirname, '../.env.local'));
loadEnv(path.resolve(__dirname, '../.env'));

// Try to initialize with service account credential if available
let app;
const secretKey = process.env.FIREBASE_SECRET_KEY || process.env.FIREBASE_ADMIN_PRIVATE_KEY;
if (secretKey) {
    app = initializeApp({
        credential: cert({
            projectId: 'quicklifts-dd3f1',
            privateKey: secretKey.replace(/\\n/g, '\n'),
            clientEmail: 'firebase-adminsdk-1qxb0@quicklifts-dd3f1.iam.gserviceaccount.com',
        })
    });
} else {
    // Use ADC (Application Default Credentials) or emulator
    console.log('No explicit key found, trying Application Default Credentials...');
    app = initializeApp({ projectId: 'quicklifts-dd3f1' });
}

const db = getFirestore(app);
const clubId = 'pulse_fit_club';

async function run() {
    const doc = await db.collection('clubs').doc(clubId).get();
    if (!doc.exists) {
        console.log('Club "' + clubId + '" not found. Listing all clubs:');
        const all = await db.collection('clubs').get();
        all.forEach(d => {
            const data = d.data();
            console.log('  -', d.id, ':', data.name || '(no name)');
        });
        return;
    }
    console.log('Current:', JSON.stringify(doc.data(), null, 2));

    await db.collection('clubs').doc(clubId).update({
        name: 'The Pulse Pact',
        description: 'A training club for people who show up. Lifts. Runs. Challenges. One crew.',
        updatedAt: Date.now() / 1000,
    });

    const updated = await db.collection('clubs').doc(clubId).get();
    console.log('\nUpdated:', JSON.stringify(updated.data(), null, 2));
    console.log('\n🎉 The Pulse Pact is live!');
}

run().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
