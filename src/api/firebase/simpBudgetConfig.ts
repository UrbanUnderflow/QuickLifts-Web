import { FirebaseApp, getApp, getApps, initializeApp } from 'firebase/app';
import { browserLocalPersistence, getAuth, setPersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const SIMPBUDGET_FIREBASE_APP_NAME = 'simpbudget-web';

const fallbackSimpBudgetConfig = {
  apiKey: 'AIzaSyCBoCQ4J9xoIhZuaUjFMPq_zltkXDQ_0e8',
  authDomain: 'simpbudget-e213e.firebaseapp.com',
  projectId: 'simpbudget-e213e',
  storageBucket: 'simpbudget-e213e.firebasestorage.app',
  messagingSenderId: '354650749412',
  appId: '1:354650749412:ios:7265fa6ad14cdb4b8d6ff1',
};

const simpBudgetFirebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_SIMPBUDGET_FIREBASE_API_KEY || fallbackSimpBudgetConfig.apiKey,
  authDomain: process.env.NEXT_PUBLIC_SIMPBUDGET_FIREBASE_AUTH_DOMAIN || fallbackSimpBudgetConfig.authDomain,
  projectId: process.env.NEXT_PUBLIC_SIMPBUDGET_FIREBASE_PROJECT_ID || fallbackSimpBudgetConfig.projectId,
  storageBucket:
    process.env.NEXT_PUBLIC_SIMPBUDGET_FIREBASE_STORAGE_BUCKET || fallbackSimpBudgetConfig.storageBucket,
  messagingSenderId:
    process.env.NEXT_PUBLIC_SIMPBUDGET_FIREBASE_MESSAGING_SENDER_ID ||
    fallbackSimpBudgetConfig.messagingSenderId,
  appId: process.env.NEXT_PUBLIC_SIMPBUDGET_FIREBASE_APP_ID || fallbackSimpBudgetConfig.appId,
};

const getSimpBudgetFirebaseApp = (): FirebaseApp => {
  const existingApp = getApps().find((candidate) => candidate.name === SIMPBUDGET_FIREBASE_APP_NAME);
  if (existingApp) return existingApp;

  try {
    return initializeApp(simpBudgetFirebaseConfig, SIMPBUDGET_FIREBASE_APP_NAME);
  } catch (error) {
    return getApp(SIMPBUDGET_FIREBASE_APP_NAME);
  }
};

export const simpBudgetApp = getSimpBudgetFirebaseApp();
export const simpBudgetAuth = getAuth(simpBudgetApp);
export const simpBudgetDb = getFirestore(simpBudgetApp);
export const simpBudgetStorage = getStorage(simpBudgetApp);

if (typeof window !== 'undefined') {
  setPersistence(simpBudgetAuth, browserLocalPersistence).catch((error) => {
    console.error('[SimpBudget Firebase] Unable to set auth persistence:', error);
  });
}
