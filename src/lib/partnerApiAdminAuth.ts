import type { NextApiRequest } from 'next';
import admin from './firebase-admin';

/** Key issuance never accepts development headers, cross-project identity, or unverified email ownership. */
export async function requirePartnerApiAdmin(req: NextApiRequest): Promise<{ email: string } | null> {
  const header = req.headers.authorization;
  if (typeof header !== 'string' || !header.startsWith('Bearer ')) return null;
  try {
    const decoded = await admin.auth().verifyIdToken(header.slice(7), true);
    if (decoded.email_verified !== true || typeof decoded.email !== 'string' || !decoded.uid) return null;
    const saved = await admin.firestore().doc(`admin/${decoded.email}`).get();
    const record = saved.data();
    if (!saved.exists || record?.disabled === true || record?.status === 'disabled' || record?.status === 'revoked' || (record?.uid && record.uid !== decoded.uid)) return null;
    return { email: decoded.email };
  } catch { return null; }
}
