import type { NextApiRequest, NextApiResponse } from 'next';
import admin, { getFirebaseAdminApp } from '../../../../../lib/firebase-admin';
import { requireAdminRequest } from '../../_auth';
import { computeGroupMeetAiRecommendation, mapGroupMeetInviteDocs } from '../../../../../lib/groupMeetWorkflow';

const REQUESTS_COLLECTION = 'groupMeetRequests';
const INVITES_SUBCOLLECTION = 'groupMeetInvites';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const adminUser = await requireAdminRequest(req);
  if (!adminUser) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const requestId = typeof req.query.requestId === 'string' ? req.query.requestId.trim() : '';
  if (!requestId) {
    return res.status(400).json({ error: 'Request id is required.' });
  }

  const forceDevFirebase =
    req.headers?.['x-force-dev-firebase'] === 'true' ||
    req.headers?.['x-force-dev-firebase'] === '1';

  try {
    const requestRef = getFirebaseAdminApp(forceDevFirebase).firestore().collection(REQUESTS_COLLECTION).doc(requestId);
    const requestDoc = await requestRef.get();
    if (!requestDoc.exists) {
      return res.status(404).json({ error: 'Group Meet request not found.' });
    }

    const requestData = requestDoc.data() || {};
    const targetMonth = typeof requestData.targetMonth === 'string' ? requestData.targetMonth : '';
    const invitesSnapshot = await requestRef.collection(INVITES_SUBCOLLECTION).orderBy('createdAt', 'asc').get();
    const invites = mapGroupMeetInviteDocs(invitesSnapshot, targetMonth);
    const { recommendation } = await computeGroupMeetAiRecommendation({
      requestTitle: requestData.title || 'Group Meet',
      targetMonth,
      meetingDurationMinutes: Number(requestData.meetingDurationMinutes) || 30,
      invites,
      allowFallback: true,
    });

    await requestRef.set(
      {
        aiRecommendation: recommendation,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        aiRecommendationGeneratedByEmail: adminUser.email,
      },
      { merge: true }
    );

    return res.status(200).json({ recommendation });
  } catch (error: any) {
    console.error('[group-meet-ai-recommend] Failed to generate recommendation:', error);
    return res.status(500).json({ error: error?.message || 'Failed to generate AI recommendation.' });
  }
}
