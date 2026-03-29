import * as admin from 'firebase-admin';
import firebaseAdminRegistry from './server/firebase/app-registry';

const {
  APP_NAMES,
  ensureDefaultFirebaseAdminApp,
  getNamedFirebaseAdminApp,
} = firebaseAdminRegistry as {
  APP_NAMES: { prod: string; dev: string };
  ensureDefaultFirebaseAdminApp: (options?: Record<string, unknown>) => admin.app.App;
  getNamedFirebaseAdminApp: (options?: Record<string, unknown>) => admin.app.App;
};

const isE2EDevFirebase = process.env.NEXT_PUBLIC_E2E_FORCE_DEV_FIREBASE === 'true';

function ensurePrimaryAdminApp(): admin.app.App {
  return ensureDefaultFirebaseAdminApp({
    mode: isE2EDevFirebase ? 'dev' : 'prod',
    runtime: 'next-api',
    allowApplicationDefault: process.env.NODE_ENV !== 'production',
    failClosed: process.env.NODE_ENV === 'production',
  });
}

ensurePrimaryAdminApp();

export function getFirebaseAdminApp(forceDevProject = false): admin.app.App {
  if (!forceDevProject) {
    return ensurePrimaryAdminApp();
  }

  return getNamedFirebaseAdminApp({
    mode: 'dev',
    appName: APP_NAMES.dev,
    runtime: 'next-api',
    allowApplicationDefault: process.env.NODE_ENV !== 'production',
    failClosed: process.env.NODE_ENV === 'production',
  });
}

export default admin;
