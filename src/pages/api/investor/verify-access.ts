import type { NextApiRequest, NextApiResponse } from 'next';
import admin from '../../../lib/firebase-admin';

const COLLECTION = 'investorAccess';
const LOGS_COLLECTION = 'investorAccessLogs';

const DEFAULT_SECTION_ACCESS = {
  overview: true,
  entity: true,
  product: true,
  traction: true,
  ip: true,
  vision: true,
  market: true,
  techstack: true,
  team: true,
  financials: true,
  captable: true,
  deck: true,
  legal: true,
  documents: true,
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const rawCode = typeof req.body?.code === 'string' ? req.body.code : '';
  const isAutoLogin = Boolean(req.body?.isAutoLogin);

  if (!rawCode.trim()) {
    return res.status(400).json({ error: 'Access code is required.' });
  }

  const normalizedCode = rawCode.toUpperCase().replace(/[^A-Z0-9]/g, '').trim();

  try {
    const db = admin.firestore();
    const accessRef = db.collection(COLLECTION);

    let snapshot = await accessRef.where('accessCode', '==', normalizedCode).limit(1).get();

    if (snapshot.empty) {
      snapshot = await accessRef.where('email', '==', rawCode.toLowerCase().trim()).limit(1).get();
    }

    if (snapshot.empty) {
      return res.status(404).json({ error: 'invalid' });
    }

    const accessDoc = snapshot.docs[0];
    const accessData = accessDoc.data();

    if (!accessData.isApproved) {
      return res.status(403).json({ error: 'revoked' });
    }

    const sectionAccess = accessData.sectionAccess || DEFAULT_SECTION_ACCESS;
    const accessCodeToStore = accessData.accessCode || accessData.email || rawCode.toUpperCase().trim();

    try {
      await db.collection(LOGS_COLLECTION).add({
        accessCode: accessCodeToStore,
        email: accessData.email || null,
        investorAccessId: accessDoc.id,
        name: accessData.name || null,
        company: accessData.company || null,
        accessedAt: admin.firestore.FieldValue.serverTimestamp(),
        userAgent: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : null,
        isAutoLogin,
      });
    } catch (logError) {
      console.error('[investor/verify-access] Error logging access:', logError);
    }

    return res.status(200).json({
      success: true,
      sectionAccess,
      accessCode: accessCodeToStore,
    });
  } catch (error) {
    console.error('[investor/verify-access] Error verifying access:', error);
    return res.status(500).json({ error: 'server_error' });
  }
}
