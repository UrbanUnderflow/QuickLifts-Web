import type { Handler } from '@netlify/functions';
import { saveAtomicConsent, ConsentSaveError } from '../../src/lib/server/pulsecheck/atomicConsent';
const { admin, getFirebaseAdminApp, headers } = require('./config/firebase');

export const handler: Handler = async event => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: { code: 'METHOD_NOT_ALLOWED', message: 'POST only' } }) };
  const token = (event.headers.authorization || event.headers.Authorization || '').match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return { statusCode: 401, headers, body: JSON.stringify({ error: { code: 'AUTH_REQUIRED', message: 'Sign in to continue.' } }) };
  let uid: string, app: any;
  try { app = getFirebaseAdminApp(event); uid = (await admin.auth(app).verifyIdToken(token, true)).uid; }
  catch { return { statusCode: 401, headers, body: JSON.stringify({ error: { code: 'AUTH_REQUIRED', message: 'Sign in again to continue.' } }) }; }
  try {
    if (!event.body || Buffer.byteLength(event.body) > 750000) throw new ConsentSaveError('INVALID_REQUEST', 'The request exceeds the supported size.');
    let request: any;
    try { request = JSON.parse(event.body); } catch { throw new ConsentSaveError('INVALID_REQUEST', 'Invalid request.'); }
    const result = await saveAtomicConsent(admin.firestore(app), uid, request, () => admin.firestore.FieldValue.serverTimestamp());
    return { statusCode: 200, headers, body: JSON.stringify(result) };
  } catch (error) {
    const known = error instanceof ConsentSaveError;
    if (!known) console.error('[pulsecheck-consent-save] Atomic save failed', (error as any)?.code || 'internal');
    return { statusCode: known ? error.status : 503, headers, body: JSON.stringify({ error: { code: known ? error.code : 'SAVE_UNAVAILABLE', message: known ? error.message : 'Your choices were not saved. Please retry.' } }) };
  }
};
