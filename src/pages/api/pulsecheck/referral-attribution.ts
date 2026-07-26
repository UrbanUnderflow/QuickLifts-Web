import type { NextApiRequest, NextApiResponse } from 'next';
import admin from '../../../lib/firebase-admin';

const COLLECTION = 'pulsecheck-referral-attributions';
const DEFAULT_REFERRAL_TYPE = 'parent-assessment';

const normalizeString = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

const sanitizeMetadataValue = (value: unknown): string => normalizeString(value).slice(0, 450);

const docIdFor = (userId: string, referralType: string): string => `${userId}_${referralType}`;

const verifyUser = async (req: NextApiRequest) => {
  const authHeader = normalizeString(req.headers.authorization);
  if (!authHeader.startsWith('Bearer ')) {
    throw new Error('Sign in before saving this referral.');
  }

  const decoded = await admin.auth().verifyIdToken(authHeader.slice('Bearer '.length));
  return {
    userId: decoded.uid,
    email: normalizeString(decoded.email),
  };
};

const shapeAttribution = async (data: FirebaseFirestore.DocumentData | undefined) => {
  if (!data) return null;

  let teamName = normalizeString(data.teamName);
  if (!teamName && data.teamId) {
    try {
      const teamSnap = await admin.firestore().collection('pulsecheck-teams').doc(data.teamId).get();
      teamName = normalizeString(teamSnap.data()?.displayName || teamSnap.data()?.name);
    } catch (error) {
      console.warn('[referral-attribution] Could not resolve team display name', error);
    }
  }

  return {
    referralType: normalizeString(data.referralType),
    coachId: normalizeString(data.coachId),
    coachEmail: normalizeString(data.coachEmail),
    teamId: normalizeString(data.teamId),
    organizationId: normalizeString(data.organizationId),
    teamName,
    createdAt: data.createdAt || null,
  };
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    res.status(405).json({ success: false, message: 'Method not allowed.' });
    return;
  }

  try {
    const user = await verifyUser(req);
    const referralType = sanitizeMetadataValue(req.method === 'GET' ? req.query.referralType : req.body?.referralType) || DEFAULT_REFERRAL_TYPE;
    if (referralType !== DEFAULT_REFERRAL_TYPE) {
      res.status(400).json({ success: false, message: 'Unsupported referral type.' });
      return;
    }

    const db = admin.firestore();
    const ref = db.collection(COLLECTION).doc(docIdFor(user.userId, referralType));

    if (req.method === 'GET') {
      const snapshot = await ref.get();
      res.status(200).json({ success: true, attribution: await shapeAttribution(snapshot.data()) });
      return;
    }

    const incoming = {
      referralType,
      coachId: sanitizeMetadataValue(req.body?.coachId),
      coachEmail: sanitizeMetadataValue(req.body?.coachEmail),
      teamId: sanitizeMetadataValue(req.body?.teamId),
      organizationId: sanitizeMetadataValue(req.body?.organizationId),
      sourceUrl: sanitizeMetadataValue(req.body?.sourceUrl),
    };

    if (!incoming.coachId || !incoming.teamId || !incoming.organizationId) {
      res.status(400).json({ success: false, message: 'Referral link is missing coach or team attribution.' });
      return;
    }

    let saved: FirebaseFirestore.DocumentData | undefined;
    let created = false;
    await db.runTransaction(async (transaction) => {
      const existing = await transaction.get(ref);
      if (existing.exists) {
        saved = existing.data();
        transaction.set(ref, {
          lastSeenAt: admin.firestore.FieldValue.serverTimestamp(),
          lastSeenSourceUrl: incoming.sourceUrl,
        }, { merge: true });
        return;
      }

      created = true;
      const record = {
        ...incoming,
        purchaserUserId: user.userId,
        purchaserEmail: user.email,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        lastSeenAt: admin.firestore.FieldValue.serverTimestamp(),
      };
      saved = record;
      transaction.set(ref, record);
    });

    res.status(200).json({
      success: true,
      created,
      attribution: await shapeAttribution(saved),
    });
  } catch (error) {
    console.error('[referral-attribution] Failed:', error);
    const message = error instanceof Error ? error.message : 'Referral attribution failed.';
    const status = message.includes('Sign in before saving') || message.includes('Firebase ID token') ? 401 : 500;
    res.status(status).json({
      success: false,
      message: status === 401 ? message : 'Referral attribution could not be saved.',
    });
  }
}
