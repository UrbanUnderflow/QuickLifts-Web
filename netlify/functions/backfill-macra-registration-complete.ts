import type { Handler } from '@netlify/functions';

const firebaseConfig = require('./config/firebase') as any;
const { admin, headers, getFirebaseAdminApp, initializeFirebaseAdmin } = firebaseConfig;

const json = (statusCode: number, payload: Record<string, any>) => ({
  statusCode,
  headers,
  body: JSON.stringify(payload),
});

const getHeader = (event: any, name: string): string => {
  const wanted = name.toLowerCase();
  const found = Object.entries(event.headers || {}).find(([key]) => key.toLowerCase() === wanted);
  return found ? String(found[1] || '') : '';
};

const normalizeString = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

/**
 * Verify the caller is an admin (custom claim or an `admin/{email}` doc).
 * Mirrors verifyAdminRequest in sync-macra-appsflyer-raw-data.ts.
 */
async function verifyAdminRequest(event: any) {
  const authHeader = getHeader(event, 'authorization');
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;

  initializeFirebaseAdmin(event);
  const app = getFirebaseAdminApp(event);
  const db = app.firestore();
  const decoded = await admin.auth(app).verifyIdToken(match[1]);
  const email = normalizeString(decoded.email).toLowerCase();
  const hasAdminClaim = decoded.admin === true || decoded.isAdmin === true || decoded.role === 'admin';
  if (hasAdminClaim) return { uid: decoded.uid, email, db };

  if (!email) return null;
  const adminSnap = await db.collection('admin').doc(email).get();
  if (!adminSnap.exists) return null;

  return { uid: decoded.uid, email, db };
}

/**
 * Backfill `registrationComplete: true` for Macra-origin users who completed
 * onboarding before iOS started writing the flag. Admin-only; uses the Admin
 * SDK (bypasses the owner-only users/{uid} security rule). New users self-heal
 * via UserService.markMacraOnboardingComplete, so this is for one-off cleanups.
 *
 * POST body: { commit?: boolean, limit?: number }
 */
const handler: Handler = async (event: any) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  let admin_;
  try {
    admin_ = await verifyAdminRequest(event);
  } catch (error: any) {
    return json(401, { error: `Auth failed: ${error?.message || 'invalid token'}` });
  }
  if (!admin_) return json(403, { error: 'Admin access required' });

  let body: Record<string, any> = {};
  try {
    body = event.body ? JSON.parse(event.body) : {};
  } catch {
    return json(400, { error: 'Invalid JSON body' });
  }

  const commit = body.commit === true;
  const limit = Number.isFinite(Number(body.limit)) && Number(body.limit) > 0 ? Math.floor(Number(body.limit)) : 0;
  const { db } = admin_;

  try {
    const snap = await db.collection('users').where('registrationEntryPoint', '==', 'macra').get();
    const eligible: string[] = [];
    snap.forEach((doc: any) => {
      const d = doc.data();
      if (d.hasCompletedMacraOnboarding === true && d.registrationComplete !== true) {
        eligible.push(doc.id);
      }
    });

    const targets = limit > 0 ? eligible.slice(0, limit) : eligible;

    if (!commit) {
      return json(200, {
        dryRun: true,
        scanned: snap.size,
        eligible: eligible.length,
        wouldUpdate: targets.length,
        sample: targets.slice(0, 5),
      });
    }

    let updated = 0;
    for (let i = 0; i < targets.length; i += 400) {
      const batch = db.batch();
      for (const id of targets.slice(i, i + 400)) {
        batch.update(db.collection('users').doc(id), { registrationComplete: true });
      }
      await batch.commit();
      updated += Math.min(400, targets.length - i);
    }

    return json(200, {
      dryRun: false,
      scanned: snap.size,
      eligible: eligible.length,
      updated,
      by: admin_.email,
    });
  } catch (error: any) {
    return json(500, { error: error?.message || 'Backfill failed' });
  }
};

export { handler };
