import type * as FirebaseAdmin from 'firebase-admin';

const firebaseConfig = require('../config/firebase') as {
  admin: typeof FirebaseAdmin;
  getFirebaseAdminApp: (request?: unknown) => FirebaseAdmin.app.App;
};

let adminApp: FirebaseAdmin.app.App | null = null;

export function initAdmin(): typeof FirebaseAdmin {
  adminApp = firebaseConfig.getFirebaseAdminApp();
  return firebaseConfig.admin;
}

export async function getFirebaseAdmin(): Promise<FirebaseAdmin.app.App> {
  adminApp = firebaseConfig.getFirebaseAdminApp();
  return adminApp;
}

export async function getFirestore(): Promise<FirebaseAdmin.firestore.Firestore> {
  const app = await getFirebaseAdmin();
  return app.firestore();
}
