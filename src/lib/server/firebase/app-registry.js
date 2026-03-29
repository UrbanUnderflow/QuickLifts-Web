const admin = require('firebase-admin');
const {
  buildFirebaseAdminServiceAccount,
  resolveCredentialSourceSeverity,
  resolveFirebaseAdminCredential,
  summarizeFirebaseAdminEnvPresence,
} = require('./credential-source');

const APP_NAMES = {
  prod: 'pulsecheck-prod-admin',
  dev: 'pulsecheck-dev-admin',
};

const DEFAULT_APP_LABEL = '[DEFAULT]';
const loggedCredentialWarnings = new Set();

function findAppByName(name) {
  return admin.apps.find((app) => app && app.name === name) || null;
}

function shouldAllowApplicationDefault(options) {
  if (typeof options.allowApplicationDefault === 'boolean') {
    return options.allowApplicationDefault;
  }

  return process.env.NODE_ENV !== 'production';
}

function shouldFailClosed(options) {
  if (typeof options.failClosed === 'boolean') {
    return options.failClosed;
  }

  return process.env.NODE_ENV === 'production';
}

function logCredentialResolution({ runtime, appName, resolvedCredential }) {
  const source = resolvedCredential?.source || 'unknown';
  const logKey = `${runtime || 'unknown'}:${appName || DEFAULT_APP_LABEL}:${source}`;
  if (loggedCredentialWarnings.has(logKey)) {
    return;
  }

  const severity = resolveCredentialSourceSeverity(source);
  const logFn =
    severity === 'error'
      ? console.error
      : severity === 'warning'
        ? console.warn
        : console.info;

  logFn('[Firebase Admin] Credential resolution', {
    runtime: runtime || 'unknown',
    appName: appName || DEFAULT_APP_LABEL,
    mode: resolvedCredential?.mode || 'prod',
    source,
    projectId: resolvedCredential?.projectId || null,
  });

  if (source.endsWith(':unresolved')) {
    logFn('[Firebase Admin] Credential env presence', {
      runtime: runtime || 'unknown',
      appName: appName || DEFAULT_APP_LABEL,
      ...summarizeFirebaseAdminEnvPresence({ mode: resolvedCredential?.mode || 'prod' }),
    });
  }

  loggedCredentialWarnings.add(logKey);
}

function initializeFirebaseAdminApp(options = {}) {
  const mode = options.mode === 'dev' ? 'dev' : 'prod';
  const useDefaultApp = options.useDefaultApp === true;
  const runtime = options.runtime || 'unknown';
  const appName = useDefaultApp ? undefined : options.appName || APP_NAMES[mode];

  let existing = null;
  if (useDefaultApp) {
    try {
      existing = admin.app();
    } catch (_error) {
      existing = null;
    }
  } else {
    existing = findAppByName(appName);
  }
  if (existing) {
    return existing;
  }

  const allowApplicationDefault = shouldAllowApplicationDefault(options);
  const failClosed = shouldFailClosed(options);
  const resolvedCredential = resolveFirebaseAdminCredential({ mode });
  logCredentialResolution({ runtime, appName, resolvedCredential });

  const serviceAccount = buildFirebaseAdminServiceAccount(resolvedCredential);
  if (serviceAccount?.clientEmail && serviceAccount.privateKey) {
    const initConfig = {
      credential: admin.credential.cert(serviceAccount),
      projectId: serviceAccount.projectId || resolvedCredential.projectId || undefined,
    };
    return useDefaultApp ? admin.initializeApp(initConfig) : admin.initializeApp(initConfig, appName);
  }

  if (allowApplicationDefault) {
    const initConfig = {
      projectId: resolvedCredential.projectId || undefined,
      credential: admin.credential.applicationDefault(),
    };
    return useDefaultApp ? admin.initializeApp(initConfig) : admin.initializeApp(initConfig, appName);
  }

  if (failClosed) {
    throw new Error(
      `Firebase Admin credentials unresolved for mode=${mode} runtime=${runtime}. Checked canonical service-account envs and legacy Netlify aliases. See server logs for presence diagnostics.`
    );
  }

  const initConfig = {
    projectId: resolvedCredential.projectId || undefined,
  };
  return useDefaultApp ? admin.initializeApp(initConfig) : admin.initializeApp(initConfig, appName);
}

function ensureDefaultFirebaseAdminApp(options = {}) {
  return initializeFirebaseAdminApp({
    ...options,
    useDefaultApp: true,
  });
}

module.exports = {
  APP_NAMES,
  admin,
  ensureDefaultFirebaseAdminApp,
  findAppByName,
  getNamedFirebaseAdminApp(options = {}) {
    return initializeFirebaseAdminApp({
      ...options,
      useDefaultApp: false,
    });
  },
  initializeFirebaseAdminApp,
};
