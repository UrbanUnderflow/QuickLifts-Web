const { getFirebaseAdminApp, headers } = require('./config/firebase');
const { completePhoneProfile } = require('../../src/lib/server/auth/phone-profile');

exports.handler = async (event) => {
  const reply = (statusCode, body) => ({ statusCode, headers: { ...headers, 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' }, body: JSON.stringify(body) });
  if (event.httpMethod === 'OPTIONS') return reply(200, {});
  if (event.httpMethod !== 'POST') return reply(405, { error: 'POST only' });
  try {
    const bearer = String(event.headers?.authorization || event.headers?.Authorization || '').match(/^Bearer (.+)$/i)?.[1];
    if (!bearer) return reply(401, { error: 'Verify your phone to continue.' });
    let body;
    try { body = JSON.parse(event.body || '{}'); } catch { return reply(400, { error: 'Invalid request.' }); }
    const app = getFirebaseAdminApp(event);
    return reply(200, await completePhoneProfile({ auth: app.auth(), db: app.firestore(), bearer, body }));
  } catch (error) {
    // Never log phone numbers, institutional email addresses, codes, or tokens.
    return reply(error.status || 401, { error: error.status ? error.message : 'Phone ownership could not be verified.', code: error.reason || 'phone-auth/verification-failed' });
  }
};
