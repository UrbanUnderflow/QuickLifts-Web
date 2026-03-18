import * as admin from 'firebase-admin';

const isE2EDevFirebase = process.env.NEXT_PUBLIC_E2E_FORCE_DEV_FIREBASE === 'true';
const defaultProjectId = isE2EDevFirebase ? 'quicklifts-dev-01' : 'quicklifts-dd3f1';
const defaultDevProjectId = process.env.NEXT_PUBLIC_DEV_FIREBASE_PROJECT_ID || 'quicklifts-dev-01';
const selectedProjectId =
  (isE2EDevFirebase
    ? process.env.NEXT_PUBLIC_DEV_FIREBASE_PROJECT_ID
    : process.env.FIREBASE_PROJECT_ID) || defaultProjectId;
const defaultClientEmail = isE2EDevFirebase
  ? undefined
  : 'firebase-adminsdk-1qxb0@quicklifts-dd3f1.iam.gserviceaccount.com';

function normalizePrivateKey(value?: string): string | undefined {
  if (!value) return undefined;

  let normalized = value.trim();

  if (
    (normalized.startsWith('"') && normalized.endsWith('"')) ||
    (normalized.startsWith("'") && normalized.endsWith("'"))
  ) {
    normalized = normalized.slice(1, -1);
  }

  normalized = normalized.replace(/\\\\n/g, '\n').replace(/\\n/g, '\n');

  return normalized || undefined;
}

function getPrivateKey(): string | undefined {
  const inlinePrivateKey = process.env.FIREBASE_PRIVATE_KEY || process.env.FIREBASE_SECRET_KEY;
  if (inlinePrivateKey) {
    return normalizePrivateKey(inlinePrivateKey);
  }

  if (process.env.FIREBASE_PRIVATE_KEY_1) {
    return normalizePrivateKey(
      [
        process.env.FIREBASE_PRIVATE_KEY_1 || '',
        process.env.FIREBASE_PRIVATE_KEY_2 || '',
        process.env.FIREBASE_PRIVATE_KEY_3 || '',
        process.env.FIREBASE_PRIVATE_KEY_4 || '',
      ].join('')
    );
  }

  return undefined;
}

function getServiceAccount(): admin.ServiceAccount | null {
  const serializedServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (serializedServiceAccount) {
    try {
      const parsed = JSON.parse(serializedServiceAccount) as admin.ServiceAccount;

      return {
        ...parsed,
        projectId: parsed.projectId || selectedProjectId,
        clientEmail: parsed.clientEmail || defaultClientEmail,
        privateKey: normalizePrivateKey(parsed.privateKey),
      };
    } catch (error) {
      console.warn('[Firebase Admin] Failed to parse FIREBASE_SERVICE_ACCOUNT, falling back');
      if (process.env.NODE_ENV !== 'production') {
        console.warn(error);
      }
    }
  }

  const privateKey = getPrivateKey();
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL || defaultClientEmail;

  if (!privateKey || !clientEmail) {
    return null;
  }

  return {
    projectId: selectedProjectId,
    clientEmail,
    privateKey,
  };
}

function initializeAdmin(): void {
  const serviceAccount = getServiceAccount();

  if (serviceAccount?.privateKey && serviceAccount.clientEmail) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: serviceAccount.projectId || selectedProjectId,
    });
    return;
  }

  admin.initializeApp({
    projectId: selectedProjectId,
    credential: admin.credential.applicationDefault(),
  });
}

function initializeNamedAdmin(forceDevProject: boolean): admin.app.App {
  const appName = forceDevProject ? 'pulsecheck-dev-admin' : 'pulsecheck-prod-admin';
  for (const app of admin.apps) {
    if (app && app.name === appName) {
      return app;
    }
  }

  const projectId = forceDevProject ? defaultDevProjectId : selectedProjectId;
  const serviceAccount = forceDevProject ? null : getServiceAccount();

  if (serviceAccount?.privateKey && serviceAccount.clientEmail) {
    return admin.initializeApp(
      {
        credential: admin.credential.cert(serviceAccount),
        projectId: serviceAccount.projectId || projectId,
      },
      appName
    );
  }

  try {
    return admin.initializeApp(
      {
        projectId,
        credential: admin.credential.applicationDefault(),
      },
      appName
    );
  } catch (error) {
    console.error('[Firebase Admin] Named initialization failed:', error);
    return admin.initializeApp(
      {
        projectId,
      },
      appName
    );
  }
}

if (!admin.apps.length) {
  try {
    initializeAdmin();
  } catch (error) {
    console.error('[Firebase Admin] Initialization failed:', error);

    if (!admin.apps.length) {
      admin.initializeApp({
        projectId: selectedProjectId,
      });
    }
  }
}

export function getFirebaseAdminApp(forceDevProject = false): admin.app.App {
  if (!forceDevProject) {
    return admin.app();
  }

  return initializeNamedAdmin(true);
}

export default admin;
