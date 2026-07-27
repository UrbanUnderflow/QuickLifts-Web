const { OAuth2Client } = require('google-auth-library');
const { getFirebaseAdminApp, headers } = require('./config/firebase');

const json = (statusCode, body) => ({
  statusCode,
  headers: {
    ...headers,
    'Content-Type': 'application/json',
    'Cache-Control': 'private, no-store',
  },
  body: JSON.stringify(body),
});

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return json(200, {});
  if (event.httpMethod !== 'POST') return json(405, { error: 'POST only' });

  try {
    const body = JSON.parse(event.body || '{}');
    const googleIdToken = String(body.googleIdToken || '').trim();
    if (!googleIdToken) return json(400, { error: 'Google verification is required.' });

    const ticket = await new OAuth2Client().verifyIdToken({ idToken: googleIdToken });
    const googleIdentity = ticket.getPayload() || {};
    const email = String(googleIdentity.email || '').trim().toLowerCase();
    if (!email || googleIdentity.email_verified !== true) {
      return json(403, { error: 'Google did not verify this email address.' });
    }

    const app = getFirebaseAdminApp(event);
    const auth = app.auth();
    const db = app.firestore();
    const matches = await db.collection('users')
      .where('signInEmails', 'array-contains', email)
      .limit(2)
      .get();

    if (matches.size === 0) {
      return json(404, { error: 'This Google email is not connected to an existing account.' });
    }
    if (matches.size > 1) {
      return json(409, { error: 'This email is connected to more than one account.' });
    }

    const canonicalUid = matches.docs[0].id;
    await auth.getUser(canonicalUid);
    const customToken = await auth.createCustomToken(canonicalUid, {
      verifiedGoogleEmail: email,
    });

    return json(200, {
      canonicalUid,
      email,
      customToken,
    });
  } catch (error) {
    console.error('[resolve-verified-google-signin]', error);
    return json(401, {
      error: 'Google ownership could not be verified.',
    });
  }
};
