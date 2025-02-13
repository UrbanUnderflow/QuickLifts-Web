// src/api/firebase/config.ts
import { initializeApp, getApps, deleteApp, FirebaseApp } from 'firebase/app';
import { getAuth, setPersistence, browserLocalPersistence, Auth } from "firebase/auth";
import { getFirestore, Firestore } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';
import { firebaseConfigs } from './firebase-config';

let firebaseApp: FirebaseApp | undefined;
let firebaseAuth: Auth | undefined;
let firebaseDb: Firestore | undefined;
let firebaseStorage: FirebaseStorage | undefined;

export const initializeFirebase = (isDev = false) => {
  // Only delete app if it exists
  if (firebaseApp) {
    try {
      deleteApp(firebaseApp);
    } catch (error) {
      console.error('Error deleting Firebase app:', error);
    }
  }

  try {
    const config = isDev ? firebaseConfigs.development : firebaseConfigs.production;

    firebaseApp = initializeApp(config);
    firebaseAuth = getAuth(firebaseApp);
    firebaseDb = getFirestore(firebaseApp);
    firebaseStorage = getStorage(firebaseApp);

    if (typeof window !== 'undefined') {
      setPersistence(firebaseAuth, browserLocalPersistence)
        .then(() => console.log('Firebase persistence set to LOCAL'))
        .catch((error) => console.error('Error setting persistence:', error));
    }

    return {
      app: firebaseApp,
      auth: firebaseAuth,
      db: firebaseDb,
      storage: firebaseStorage
    };
  } catch (error) {
    console.error('Error initializing Firebase:', error);
    throw error;
  }
};

// Get initial mode from localStorage if available
const getInitialMode = () => {
  if (typeof window !== 'undefined') {
    return window.localStorage.getItem('devMode') === 'true';
  }
  return false;
};

// Initialize with appropriate config
const { app, auth, db, storage } = initializeFirebase(getInitialMode());

export { app, auth, db, storage };