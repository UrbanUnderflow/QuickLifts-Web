// scripts/verifyGymAffiliateFlow.js
// One-off script to verify that creating a user with a gymInviteCode
// causes gymAffiliates/TEST-GYM-2026.memberSignupCount to increment
// and writes gymAffiliateId back to the user document (if Cloud Functions
// have been deployed with onUserCreateGymAffiliate).

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const path = require('path');

async function main() {
  const saPath = path.join(__dirname, '..', 'serviceAccountKey.json');
  const serviceAccount = require(saPath);

  const app = initializeApp({ credential: cert(serviceAccount) });
  const db = getFirestore(app);

  const affiliateRef = db.collection('gymAffiliates').doc('TEST-GYM-2026');
  const beforeSnap = await affiliateRef.get();
  console.log('BEFORE memberSignupCount:', beforeSnap.data()?.memberSignupCount);

  const userId = `test-gym-user-${Date.now()}`;
  const userRef = db.collection('users').doc(userId);
  await userRef.set({
    email: `test-gym-user+${Date.now()}@example.com`,
    gymInviteCode: 'TEST-GYM-2026',
    createdAt: new Date().toISOString(),
  });
  console.log('Created test user:', userId);

  // Wait some time for Cloud Function to process the onCreate event.
  await new Promise((resolve) => setTimeout(resolve, 15000));

  const afterSnap = await affiliateRef.get();
  console.log('AFTER memberSignupCount:', afterSnap.data()?.memberSignupCount);

  const userSnap = await userRef.get();
  console.log('User doc snapshot:', userSnap.data());
}

main().catch((err) => {
  console.error('Error in verifyGymAffiliateFlow:', err);
  process.exit(1);
});
