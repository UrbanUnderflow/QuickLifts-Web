const firebaseAdminRegistry = require('../../../src/lib/server/firebase/app-registry');

const {
  APP_NAMES,
  admin,
  ensureDefaultFirebaseAdminApp,
  getNamedFirebaseAdminApp,
} = firebaseAdminRegistry;

function isDevMode(request) {
  if (!request) return false;
  const forcedHeader =
    request.headers?.['x-force-dev-firebase']
    || request.headers?.['X-Force-Dev-Firebase']
    || request.headers?.['x-pulsecheck-dev-firebase']
    || request.headers?.['X-PulseCheck-Dev-Firebase'];
  if (String(forcedHeader || '').toLowerCase() === 'true' || String(forcedHeader || '') === '1') {
    return true;
  }

  const referer = request.headers?.referer || request.headers?.origin || '';
  return referer.includes('localhost') || referer.includes('127.0.0.1');
}

function getFirebaseAdminApp(request) {
  const useDevProject = isDevMode(request);
  return getNamedFirebaseAdminApp({
    mode: useDevProject ? 'dev' : 'prod',
    appName: useDevProject ? APP_NAMES.dev : APP_NAMES.prod,
    runtime: 'netlify-function',
    allowApplicationDefault: process.env.NODE_ENV !== 'production',
    failClosed: process.env.NODE_ENV === 'production',
  });
}

function initializeFirebaseAdmin(request) {
  const useDevProject = isDevMode(request);

  if (!useDevProject) {
    ensureDefaultFirebaseAdminApp({
      mode: 'prod',
      runtime: 'netlify-function',
      allowApplicationDefault: process.env.NODE_ENV !== 'production',
      failClosed: process.env.NODE_ENV === 'production',
    });
  }

  const app = getFirebaseAdminApp(request);
  console.log(`[Firebase Admin] Active app ready: ${app.name}`);
  return admin;
}

try {
  ensureDefaultFirebaseAdminApp({
    mode: 'prod',
    runtime: 'netlify-function',
    allowApplicationDefault: process.env.NODE_ENV !== 'production',
    failClosed: process.env.NODE_ENV === 'production',
  });
} catch (error) {
  console.error('[Firebase Admin] Initial setup error:', error);
}

const db = new Proxy({}, {
  get(_target, property) {
    const firestore = admin.firestore();
    const value = firestore[property];
    return typeof value === 'function' ? value.bind(firestore) : value;
  }
});

const convertTimestamp = (timestamp) => {
  if (!timestamp) return null;

  if (typeof timestamp === 'number') {
    return new Date(timestamp * 1000).toISOString();
  }

  if (timestamp instanceof Date) {
    return timestamp.toISOString();
  }

  return null;
};

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
};

module.exports = {
  admin,
  db,
  convertTimestamp,
  headers,
  isDevMode,
  initializeFirebaseAdmin,
  getFirebaseAdminApp,
};
