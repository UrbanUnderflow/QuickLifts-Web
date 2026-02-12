const { initializeApp } = require('firebase/app');
const { getFirestore, doc, setDoc, serverTimestamp, collection, addDoc } = require('firebase/firestore');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

(async () => {
  try {
    if (!config.apiKey || !config.projectId) {
      throw new Error('Missing Firebase environment variables.');
    }

    const app = initializeApp(config);
    const db = getFirestore(app);

    // Ensure Sage presence doc exists
    await setDoc(doc(db, 'agent-presence', 'sage'), {
      displayName: 'Sage',
      emoji: '🧬',
      status: 'idle',
      currentTask: '',
      executionSteps: [],
      currentStepIndex: -1,
      taskProgress: 0,
      lastUpdate: serverTimestamp(),
    }, { merge: true });
    console.log('[Sage Verify] Presence doc updated.');

    // Publish a sample intel entry
    const intelRef = await addDoc(collection(db, 'intel-feed'), {
      agentId: 'sage',
      agentName: 'Sage',
      emoji: '🧬',
      headline: 'Verification drop: Recovery trend pulse check',
      summary: 'Test entry to confirm Sage can publish intel feed updates via API.',
      impact: 'Ensures the intel pipeline is wired before production use.',
      urgency: 'routine',
      sources: [{ label: 'Integration Test' }],
      nextAction: 'None – sample entry only.',
      tags: ['verification'],
      createdAt: serverTimestamp(),
    });
    console.log('[Sage Verify] Intel feed entry created with ID:', intelRef.id);
  } catch (err) {
    console.error('[Sage Verify] Failed:', err);
    process.exitCode = 1;
  }
})();
