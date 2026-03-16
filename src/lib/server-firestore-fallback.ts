import { getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { doc, getDoc, getFirestore } from 'firebase/firestore';

const envForcesDevProject = process.env.NEXT_PUBLIC_E2E_FORCE_DEV_FIREBASE === 'true';

const getFirebaseConfig = (forceDevProject = false) => {
  if (forceDevProject || envForcesDevProject) {
    return {
      apiKey: process.env.NEXT_PUBLIC_DEV_FIREBASE_API_KEY,
      authDomain: process.env.NEXT_PUBLIC_DEV_FIREBASE_AUTH_DOMAIN,
      projectId: process.env.NEXT_PUBLIC_DEV_FIREBASE_PROJECT_ID,
      storageBucket: process.env.NEXT_PUBLIC_DEV_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.NEXT_PUBLIC_DEV_FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.NEXT_PUBLIC_DEV_FIREBASE_APP_ID,
    };
  }

  return {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };
};

const getFallbackApp = (forceDevProject = false): FirebaseApp => {
  const shouldUseDevProject = forceDevProject || envForcesDevProject;
  const appName = shouldUseDevProject ? 'server-fallback-dev' : 'server-fallback-prod';
  const existing = getApps().find((app) => app.name === appName);
  if (existing) {
    return existing;
  }

  return initializeApp(getFirebaseConfig(forceDevProject), appName);
};

export async function getFirestoreDocFallback(collectionName: string, documentId: string, forceDevProject = false) {
  if (!documentId) {
    return null;
  }

  const app = getFallbackApp(forceDevProject);
  const firestore = getFirestore(app);
  const snapshot = await getDoc(doc(firestore, collectionName, documentId));
  if (!snapshot.exists()) {
    return null;
  }

  return snapshot.data() as Record<string, unknown>;
}
