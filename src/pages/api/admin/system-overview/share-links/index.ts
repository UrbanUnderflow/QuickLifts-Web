import type { NextApiRequest, NextApiResponse } from 'next';
import { randomBytes } from 'crypto';
import admin from '../../../../../lib/firebase-admin';
import { requireAdminRequest } from './_auth';

const COLLECTION = 'systemOverviewShareLinks';

const toIso = (value: FirebaseFirestore.Timestamp | null | undefined) => value?.toDate?.().toISOString?.() || null;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const adminUser = await requireAdminRequest(req);
  if (!adminUser) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const db = admin.firestore();

  if (req.method === 'GET') {
    try {
      const sectionId = typeof req.query.sectionId === 'string' ? req.query.sectionId : '';
      const snapshot = await db.collection(COLLECTION).orderBy('createdAt', 'desc').limit(100).get();

      const links = snapshot.docs
        .map((docSnap) => {
          const data = docSnap.data();
          return {
            token: docSnap.id,
            sectionId: data.sectionId || '',
            systemId: data.systemId || '',
            sectionLabel: data.sectionLabel || '',
            sectionDescription: data.sectionDescription || '',
            snapshotText: data.snapshotText || '',
            createdByEmail: data.createdByEmail || '',
            createdAt: toIso(data.createdAt),
            revokedAt: toIso(data.revokedAt),
            shareUrl: data.shareUrl || '',
          };
        })
        .filter((link) => !sectionId || link.sectionId === sectionId);

      return res.status(200).json({ links });
    } catch (error) {
      console.error('[system-overview-share] Failed to list links:', error);
      return res.status(500).json({ error: 'Failed to list share links.' });
    }
  }

  if (req.method === 'POST') {
    const { sectionId, systemId, sectionLabel, sectionDescription, snapshotText } = req.body || {};

    if (!sectionId || !systemId || !sectionLabel || !snapshotText) {
      return res.status(400).json({ error: 'sectionId, systemId, sectionLabel, and snapshotText are required.' });
    }

    try {
      const token = randomBytes(24).toString('hex');
      const baseUrl =
        process.env.NEXT_PUBLIC_SITE_URL ||
        `${req.headers['x-forwarded-proto'] || 'http'}://${req.headers.host}`;
      const shareUrl = `${baseUrl}/shared/system-overview/${token}`;

      await db.collection(COLLECTION).doc(token).set({
        sectionId,
        systemId,
        sectionLabel,
        sectionDescription: sectionDescription || '',
        snapshotText,
        createdByEmail: adminUser.email,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        revokedAt: null,
        revokedByEmail: null,
        shareUrl,
      });

      return res.status(200).json({
        link: {
          token,
          sectionId,
          systemId,
          sectionLabel,
          sectionDescription: sectionDescription || '',
          snapshotText,
          createdByEmail: adminUser.email,
          createdAt: new Date().toISOString(),
          revokedAt: null,
          shareUrl,
        },
      });
    } catch (error) {
      console.error('[system-overview-share] Failed to create link:', error);
      return res.status(500).json({ error: 'Failed to create share link.' });
    }
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}
