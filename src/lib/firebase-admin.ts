import * as admin from 'firebase-admin';

const isE2EDevFirebase = process.env.NEXT_PUBLIC_E2E_FORCE_DEV_FIREBASE === 'true';
const defaultProjectId = isE2EDevFirebase ? 'quicklifts-dev-01' : 'quicklifts-dd3f1';
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

export default admin;
