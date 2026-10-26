const { getFirebaseAdminApp, headers } = require('./config/firebase');
const { assertMemberSignIn, resolvePublicSignInPolicy } = require('../../src/lib/server/auth/program-sign-in');
const attempts = new Map();
exports.handler = async event => {
  const reply = (statusCode, body) => ({ statusCode, headers: { ...headers, 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' }, body: JSON.stringify(body) });
  if (event.httpMethod === 'OPTIONS') return reply(200, {});
  if (event.httpMethod !== 'POST') return reply(405, { error: 'POST required.' });
  try {
    const now = Date.now();
    for (const [key, bucket] of attempts) if (bucket.until <= now) attempts.delete(key);
    const ip = event.headers?.['x-nf-client-connection-ip'] || 'unknown';
    const bucket = attempts.get(ip) || { count: 0, until: now + 60000 };
    if (++bucket.count > 180 || (attempts.size >= 10000 && !attempts.has(ip))) return reply(429, { error: 'Please wait a moment and try again.' });
    attempts.set(ip, bucket);
    if ((event.body || '').length > 2048) return reply(400, { error: 'Invalid request.' });
    let body;
    try { body = JSON.parse(event.body || '{}'); } catch { return reply(400, { error: 'Invalid request.' }); }
    const app = getFirebaseAdminApp(event);
    const bearer = String(event.headers?.authorization || event.headers?.Authorization || '').match(/^Bearer (.+)$/i)?.[1];
    if (bearer) {
      let identity;
      try { identity = await app.auth().verifyIdToken(bearer, true); } catch { return reply(401, { error: 'Sign in again to continue.', code: 'program/sign-in-required' }); }
      await assertMemberSignIn(app.firestore(), identity);
      return reply(200, { allowed: true });
    }
    return reply(200, await resolvePublicSignInPolicy(app.firestore(), body));
  } catch (error) {
    return reply(error.status || 503, { error: error.status ? error.message : 'Unable to check program sign-in. Try again.', code: error.code || 'program/sign-in-unavailable' });
  }
};
