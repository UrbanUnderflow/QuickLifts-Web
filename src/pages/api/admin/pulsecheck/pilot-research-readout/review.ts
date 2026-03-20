import type { NextApiRequest, NextApiResponse } from 'next';
import admin from '../../../../../lib/firebase-admin';
import { requireAdminRequest } from '../../_auth';

const COLLECTION = 'pulsecheck-pilot-research-readouts';

const normalizeString = (value?: unknown) => (typeof value === 'string' ? value.trim() : '');

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const adminUser = await requireAdminRequest(req);
  if (!adminUser) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = (req.body || {}) as {
    readoutId?: string;
    reviewState?: 'draft' | 'reviewed' | 'approved' | 'superseded';
    sections?: Array<{
      sectionKey?: string;
      reviewerResolution?: 'accepted' | 'revised' | 'rejected' | 'carry-forward';
      reviewerNotes?: string;
    }>;
  };

  const readoutId = normalizeString(body.readoutId);
  const reviewState = normalizeString(body.reviewState) as 'draft' | 'reviewed' | 'approved' | 'superseded';
  const sections = Array.isArray(body.sections) ? body.sections : [];

  if (!readoutId) {
    return res.status(400).json({ error: 'readoutId is required.' });
  }

  const db = admin.firestore();
  const readoutRef = db.collection(COLLECTION).doc(readoutId);

  try {
    const snapshot = await readoutRef.get();
    if (!snapshot.exists) {
      return res.status(404).json({ error: 'Research readout not found.' });
    }

    const current = snapshot.data() || {};
    const currentSections = Array.isArray(current.sections) ? current.sections : [];
    const sectionMap = new Map(
      sections.map((section) => [
        normalizeString(section.sectionKey),
        {
          reviewerResolution: normalizeString(section.reviewerResolution),
          reviewerNotes: normalizeString(section.reviewerNotes),
        },
      ])
    );

    const nextSections = currentSections.map((section: any) => {
      const sectionKey = normalizeString(section.sectionKey);
      const incoming = sectionMap.get(sectionKey);
      if (!incoming) return section;
      return {
        ...section,
        reviewerResolution: incoming.reviewerResolution || null,
        reviewerNotes: incoming.reviewerNotes || '',
      };
    });

    const batch = db.batch();
    batch.set(
      readoutRef,
      {
        sections: nextSections,
        reviewState: reviewState || current.reviewState || 'draft',
        reviewedAt: admin.firestore.FieldValue.serverTimestamp(),
        reviewedByEmail: adminUser.email,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    if (reviewState === 'approved') {
      const pilotId = normalizeString(current.pilotId);
      const cohortId = normalizeString(current.cohortId);
      const siblings = await db.collection(COLLECTION).where('pilotId', '==', pilotId).get();
      siblings.docs.forEach((docSnap) => {
        if (docSnap.id === readoutId) return;
        const sibling = docSnap.data() || {};
        if (normalizeString(sibling.cohortId) !== cohortId) return;
        if (normalizeString(sibling.reviewState) === 'approved') {
          batch.set(
            docSnap.ref,
            {
              reviewState: 'superseded',
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            },
            { merge: true }
          );
        }
      });
    }

    await batch.commit();
    return res.status(200).json({ ok: true });
  } catch (error: any) {
    console.error('[pilot-research-readout-review] Failed to update review:', error);
    return res.status(500).json({ error: error?.message || 'Failed to update pilot research readout review.' });
  }
}
