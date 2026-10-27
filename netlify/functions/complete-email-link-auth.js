const { getFirebaseAdminApp, headers, isDevMode } = require('./config/firebase');
const { verifyEmailLinkSession } = require('../../src/lib/server/auth/email-link-session');
const { createCustomTokenForApp } = require('../../src/lib/server/firebase/custom-token');

exports.handler = async event => {
  const reply = (statusCode, body) => ({ statusCode, headers: { ...headers, 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' }, body: JSON.stringify(body) });
  if (event.httpMethod === 'OPTIONS') return reply(200, {});
  if (event.httpMethod !== 'POST') return reply(405, { error: 'POST only' });
  try {
    const bearer = String(event.headers?.authorization || event.headers?.Authorization || '').match(/^Bearer (.+)$/i)?.[1];
    if (!bearer) return reply(401, { error: 'Open an email sign-in link to continue.' });
    // Account selection is entirely token-owned. Request body fields are ignored.
    const app = getFirebaseAdminApp(event);
    const { uid } = await verifyEmailLinkSession({ auth: app.auth(), db: app.firestore(), bearer });
    const customToken = await createCustomTokenForApp(app, uid, isDevMode(event) ? 'dev' : 'prod');
    return reply(200, { uid, customToken });
  } catch (error) {
    // Email addresses, email action codes, ID tokens and custom tokens stay out of logs.
    return reply(error.status || 401, { error: error.status ? error.message : 'Email ownership could not be verified.', code: error.reason || 'email-link-auth/verification-failed' });
  }
};
