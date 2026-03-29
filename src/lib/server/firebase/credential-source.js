const PROD_PROJECT_ID = 'quicklifts-dd3f1';
const DEV_PROJECT_ID = 'quicklifts-dev-01';
const PROD_CLIENT_EMAIL = 'firebase-adminsdk-1qxb0@quicklifts-dd3f1.iam.gserviceaccount.com';

function normalizePrivateKey(value) {
  if (!value || typeof value !== 'string') {
    return null;
  }

  let normalized = value.trim();
  if (
    (normalized.startsWith('"') && normalized.endsWith('"')) ||
    (normalized.startsWith("'") && normalized.endsWith("'"))
  ) {
    normalized = normalized.slice(1, -1);
  }

  normalized = normalized.replace(/\\\\n/g, '\n').replace(/\\n/g, '\n');
  return normalized || null;
}

function looksLikePrivateKey(value) {
  if (!value || typeof value !== 'string') {
    return false;
  }

  return (
    value.includes('-----BEGIN') ||
    value.includes('-----END') ||
    value.includes('\\n') ||
    value.includes('\n')
  );
}

function parseSerializedServiceAccount(rawValue) {
  if (!rawValue || typeof rawValue !== 'string') {
    return null;
  }

  const decodeCandidates = [rawValue];
  try {
    decodeCandidates.push(Buffer.from(rawValue, 'base64').toString('utf8'));
  } catch (_error) {
    // Ignore invalid base64 payloads and continue with the raw value.
  }

  for (const candidate of decodeCandidates) {
    let parsed;
    try {
      parsed = JSON.parse(candidate);
    } catch (_error) {
      continue;
    }

    const projectId = parsed.project_id || parsed.projectId || null;
    const clientEmail = parsed.client_email || parsed.clientEmail || null;
    const privateKey = normalizePrivateKey(parsed.private_key || parsed.privateKey);
    const privateKeyId = parsed.private_key_id || parsed.privateKeyId || null;

    if (!clientEmail || !privateKey) {
      return null;
    }

    return {
      projectId,
      clientEmail,
      privateKey,
      privateKeyId,
    };
  }

  return null;
}

function resolveSplitPrivateKey(prefix) {
  const parts = [
    process.env[`${prefix}_PRIVATE_KEY_1`] || '',
    process.env[`${prefix}_PRIVATE_KEY_2`] || '',
    process.env[`${prefix}_PRIVATE_KEY_3`] || '',
    process.env[`${prefix}_PRIVATE_KEY_4`] || '',
  ];
  const combined = parts.join('');
  return normalizePrivateKey(combined);
}

function resolveLegacyInlineCredential({
  mode,
  projectId,
  clientEmail,
  secretKeyEnv,
  privateKeyEnv,
  sourcePrefix,
}) {
  const rawSecretKey = process.env[secretKeyEnv];
  const rawPrivateKey = process.env[privateKeyEnv];

  let privateKey = normalizePrivateKey(rawSecretKey);
  let privateKeyId = null;
  let usedSplitKey = false;

  if (!privateKey && rawPrivateKey && looksLikePrivateKey(rawPrivateKey)) {
    privateKey = normalizePrivateKey(rawPrivateKey);
  } else if (rawPrivateKey && !looksLikePrivateKey(rawPrivateKey)) {
    privateKeyId = rawPrivateKey.trim() || null;
  }

  if (!privateKey) {
    privateKey = resolveSplitPrivateKey(sourcePrefix);
    usedSplitKey = Boolean(privateKey);
  }

  if (!clientEmail || !privateKey) {
    return null;
  }

  return {
    mode,
    source: usedSplitKey ? `${mode}:legacy-split-key` : `${mode}:legacy-inline-key`,
    projectId,
    clientEmail,
    privateKey,
    privateKeyId,
  };
}

function resolveModeDefaults(mode) {
  if (mode === 'dev') {
    return {
      projectId:
        process.env.DEV_FIREBASE_PROJECT_ID ||
        process.env.NEXT_PUBLIC_DEV_FIREBASE_PROJECT_ID ||
        DEV_PROJECT_ID,
      clientEmail: process.env.DEV_FIREBASE_CLIENT_EMAIL || null,
    };
  }

  const e2eDevOverride = process.env.NEXT_PUBLIC_E2E_FORCE_DEV_FIREBASE === 'true';
  const projectId = e2eDevOverride
    ? process.env.NEXT_PUBLIC_DEV_FIREBASE_PROJECT_ID || DEV_PROJECT_ID
    : process.env.FIREBASE_PROJECT_ID || PROD_PROJECT_ID;

  return {
    projectId,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL || PROD_CLIENT_EMAIL,
  };
}

function resolveFirebaseAdminCredential(options = {}) {
  const mode = options.mode === 'dev' ? 'dev' : 'prod';
  const defaults = resolveModeDefaults(mode);

  const serializedCandidates =
    mode === 'dev'
      ? [process.env.DEV_FIREBASE_SERVICE_ACCOUNT]
      : [process.env.FIREBASE_SERVICE_ACCOUNT, process.env.FIREBASE_SERVICE_ACCOUNT_KEY];

  for (const serializedCandidate of serializedCandidates) {
    const parsed = parseSerializedServiceAccount(serializedCandidate);
    if (!parsed) {
      continue;
    }

    return {
      mode,
      source: mode === 'dev' ? 'dev:service-account-json' : 'prod:service-account-json',
      projectId: parsed.projectId || defaults.projectId,
      clientEmail: parsed.clientEmail || defaults.clientEmail,
      privateKey: parsed.privateKey,
      privateKeyId: parsed.privateKeyId,
    };
  }

  const legacyCredential = resolveLegacyInlineCredential({
    mode,
    projectId: defaults.projectId,
    clientEmail: defaults.clientEmail,
    secretKeyEnv: mode === 'dev' ? 'DEV_FIREBASE_SECRET_KEY' : 'FIREBASE_SECRET_KEY',
    privateKeyEnv: mode === 'dev' ? 'DEV_FIREBASE_PRIVATE_KEY' : 'FIREBASE_PRIVATE_KEY',
    sourcePrefix: mode === 'dev' ? 'DEV_FIREBASE' : 'FIREBASE',
  });

  if (legacyCredential) {
    return legacyCredential;
  }

  return {
    mode,
    source: `${mode}:unresolved`,
    projectId: defaults.projectId,
    clientEmail: defaults.clientEmail,
    privateKey: null,
    privateKeyId: null,
  };
}

function buildFirebaseAdminServiceAccount(resolvedCredential) {
  if (!resolvedCredential?.clientEmail || !resolvedCredential?.privateKey) {
    return null;
  }

  const serviceAccount = {
    projectId: resolvedCredential.projectId || null,
    clientEmail: resolvedCredential.clientEmail,
    privateKey: resolvedCredential.privateKey,
  };

  if (resolvedCredential.privateKeyId) {
    serviceAccount.privateKeyId = resolvedCredential.privateKeyId;
  }

  return serviceAccount;
}

function resolveCredentialSourceSeverity(source) {
  if (!source || source.endsWith(':unresolved')) {
    return 'error';
  }
  if (source.includes('legacy')) {
    return 'warning';
  }
  return 'info';
}

module.exports = {
  DEV_PROJECT_ID,
  PROD_CLIENT_EMAIL,
  PROD_PROJECT_ID,
  buildFirebaseAdminServiceAccount,
  normalizePrivateKey,
  parseSerializedServiceAccount,
  resolveCredentialSourceSeverity,
  resolveFirebaseAdminCredential,
};
