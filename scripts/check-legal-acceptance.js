const admin = require('firebase-admin');

try {
  admin.initializeApp({ credential: admin.credential.applicationDefault() });
} catch (e) {
  admin.initializeApp();
}

const db = admin.firestore();

const USERNAME = process.argv[2] || 'thetrefecta';
const CURRENT_TERMS_VERSION = '2026-04-08';
const CURRENT_PRIVACY_VERSION = '2026-04-08';

(async () => {
  const snap = await db.collection('users').where('username', '==', USERNAME).get();
  if (snap.empty) {
    console.log(`No user found with username=${USERNAME}`);
    process.exit(0);
  }
  for (const doc of snap.docs) {
    const data = doc.data();
    console.log('---');
    console.log('docId:', doc.id);
    console.log('id field:', data.id);
    console.log('username:', data.username);
    console.log('email:', data.email);
    console.log('legalAcceptance (raw):', JSON.stringify(data.legalAcceptance, null, 2));

    const la = data.legalAcceptance || null;
    const acceptedAt = la?.acceptedAt;
    const termsVersion = la?.termsVersion;
    const privacyVersion = la?.privacyVersion;

    console.log('\n--- Gate check ---');
    console.log('expected termsVersion:', CURRENT_TERMS_VERSION, '| actual:', termsVersion, '| match:', termsVersion === CURRENT_TERMS_VERSION);
    console.log('expected privacyVersion:', CURRENT_PRIVACY_VERSION, '| actual:', privacyVersion, '| match:', privacyVersion === CURRENT_PRIVACY_VERSION);
    console.log('acceptedAt present:', !!acceptedAt, '| type:', typeof acceptedAt, '| value:', acceptedAt);

    const normalizedTs = typeof acceptedAt === 'number'
      ? new Date(acceptedAt < 1e10 ? acceptedAt * 1000 : acceptedAt)
      : acceptedAt?.toDate?.() || acceptedAt;
    console.log('normalized acceptedAt:', normalizedTs);
  }
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
