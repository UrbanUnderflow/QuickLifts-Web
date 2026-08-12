import type * as FirebaseAdmin from 'firebase-admin';

const firebaseAdminRegistry = require('../../../src/lib/server/firebase/app-registry') as {
  admin: typeof FirebaseAdmin;
};
const credentialSource = require('../../../src/lib/server/firebase/credential-source') as {
  buildFirebaseAdminServiceAccount: (credential: Record<string, any>) => {
    projectId?: string | null;
    clientEmail: string;
    privateKey: string;
    privateKeyId?: string | null;
  } | null;
  normalizePrivateKey: (value: unknown) => string | null;
  parseSerializedServiceAccount: (value: unknown) => {
    projectId?: string | null;
    clientEmail: string;
    privateKey: string;
    privateKeyId?: string | null;
  } | null;
  resolveFirebaseAdminCredential: (options?: { mode?: 'prod' | 'dev' }) => Record<string, any>;
};

const SIMPBUDGET_ADMIN_APP_NAME = 'simpbudget-admin';
const SIMPBUDGET_PROJECT_ID =
  process.env.SIMPBUDGET_FIREBASE_PROJECT_ID?.trim() ||
  process.env.NEXT_PUBLIC_SIMPBUDGET_FIREBASE_PROJECT_ID?.trim() ||
  'simpbudget-e213e';

function resolveSimpBudgetServiceAccount() {
  const serializedCandidates = [
    process.env.SIMPBUDGET_FIREBASE_SERVICE_ACCOUNT,
    process.env.SIMPBUDGET_FIREBASE_SERVICE_ACCOUNT_KEY,
  ];

  for (const candidate of serializedCandidates) {
    const parsed = credentialSource.parseSerializedServiceAccount(candidate);
    if (parsed) {
      return {
        ...parsed,
        projectId: parsed.projectId || SIMPBUDGET_PROJECT_ID,
      };
    }
  }

  const clientEmail = process.env.SIMPBUDGET_FIREBASE_CLIENT_EMAIL?.trim();
  const privateKey =
    credentialSource.normalizePrivateKey(process.env.SIMPBUDGET_FIREBASE_PRIVATE_KEY) ||
    credentialSource.normalizePrivateKey(process.env.SIMPBUDGET_FIREBASE_SECRET_KEY);

  if (clientEmail && privateKey) {
    return {
      projectId: SIMPBUDGET_PROJECT_ID,
      clientEmail,
      privateKey,
      privateKeyId: process.env.SIMPBUDGET_FIREBASE_PRIVATE_KEY_ID?.trim() || null,
    };
  }

  const productionCredential = credentialSource.resolveFirebaseAdminCredential({ mode: 'prod' });
  const fallbackServiceAccount = credentialSource.buildFirebaseAdminServiceAccount(productionCredential);
  if (fallbackServiceAccount) {
    return {
      ...fallbackServiceAccount,
      projectId: SIMPBUDGET_PROJECT_ID,
    };
  }

  return null;
}

export function getSimpBudgetFirebaseAdminApp(): FirebaseAdmin.app.App {
  const admin = firebaseAdminRegistry.admin;
  const existingApp = admin.apps.find((app) => app?.name === SIMPBUDGET_ADMIN_APP_NAME);
  if (existingApp) return existingApp;

  const serviceAccount = resolveSimpBudgetServiceAccount();
  if (serviceAccount?.clientEmail && serviceAccount.privateKey) {
    return admin.initializeApp(
      {
        credential: admin.credential.cert({
          projectId: serviceAccount.projectId || SIMPBUDGET_PROJECT_ID,
          clientEmail: serviceAccount.clientEmail,
          privateKey: serviceAccount.privateKey,
        }),
        projectId: serviceAccount.projectId || SIMPBUDGET_PROJECT_ID,
      },
      SIMPBUDGET_ADMIN_APP_NAME,
    );
  }

  if (process.env.NODE_ENV !== 'production') {
    return admin.initializeApp(
      {
        credential: admin.credential.applicationDefault(),
        projectId: SIMPBUDGET_PROJECT_ID,
      },
      SIMPBUDGET_ADMIN_APP_NAME,
    );
  }

  throw new Error('SimpBudget Firebase Admin credentials are not configured.');
}

export async function getSimpBudgetFirestore(): Promise<FirebaseAdmin.firestore.Firestore> {
  return getSimpBudgetFirebaseAdminApp().firestore();
}

export async function getSimpBudgetAuth(): Promise<FirebaseAdmin.auth.Auth> {
  return firebaseAdminRegistry.admin.auth(getSimpBudgetFirebaseAdminApp());
}
