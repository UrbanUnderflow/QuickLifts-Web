import type { NextApiRequest, NextApiResponse } from 'next';
import admin, { getFirebaseAdminApp } from '../../../../../lib/firebase-admin';
import {
  GROUP_MEET_INVITES_SUBCOLLECTION,
  GROUP_MEET_REQUESTS_COLLECTION,
  mapGroupMeetInviteSummary,
  sendGroupMeetInviteEmail,
  toIso,
} from '../../../../../lib/groupMeetAdmin';
import { resolveGroupMeetStatus, type GroupMeetInviteSummary } from '../../../../../lib/groupMeet';
import { requireAdminRequest } from '../../_auth';

type SendInvitesResponse = {
  sentCount: number;
  failedCount: number;
  skippedCount: number;
  invites: GroupMeetInviteSummary[];
  status: 'draft' | 'collecting' | 'closed';
};

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
    const db = getFirebaseAdminApp(forceDevFirebase).firestore();
    const requestRef = db.collection(GROUP_MEET_REQUESTS_COLLECTION).doc(requestId);
    const requestDoc = await requestRef.get();

    if (!requestDoc.exists) {
      return res.status(404).json({ error: 'Group Meet request not found.' });
    }

    const requestData = requestDoc.data() || {};
    const deadlineAt = toIso(requestData.deadlineAt) || new Date().toISOString();
    const nextStatus = resolveGroupMeetStatus(deadlineAt, 'collecting');
    const invitesSnapshot = await requestRef
      .collection(GROUP_MEET_INVITES_SUBCOLLECTION)
      .orderBy('createdAt', 'asc')
      .get();

    let sentCount = 0;
    let failedCount = 0;
    let skippedCount = 0;

    await Promise.all(
      invitesSnapshot.docs.map(async (inviteDoc) => {
        const inviteData = inviteDoc.data() || {};
        const participantType = inviteData.participantType === 'host' ? 'host' : 'participant';
        const recipientEmail =
          typeof inviteData.email === 'string' ? inviteData.email.trim().toLowerCase() : '';
        const currentEmailStatus = inviteData.emailStatus || 'not_sent';

        if (participantType === 'host' || !recipientEmail || currentEmailStatus === 'sent') {
          skippedCount += 1;
          return;
        }

        const result = await sendGroupMeetInviteEmail({
          requestTitle: requestData.title || 'Group Meet',
          targetMonth: requestData.targetMonth || '',
          deadlineAt,
          timezone: requestData.timezone || 'America/New_York',
          recipientName: inviteData.name || 'there',
          recipientEmail,
          shareUrl: inviteData.shareUrl || '',
        });

        const emailStatus = result.success ? 'sent' : 'failed';
        const emailError = result.success ? null : result.error || 'Failed to send';

        if (result.success) {
          sentCount += 1;
        } else {
          failedCount += 1;
        }

        await inviteDoc.ref.set(
          {
            emailStatus,
            emailError,
            emailedAt: result.success ? admin.firestore.FieldValue.serverTimestamp() : null,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
      })
    );

    await requestRef.set(
      {
        status: nextStatus,
        inviteBatchSentAt: admin.firestore.FieldValue.serverTimestamp(),
        inviteBatchSentByEmail: adminUser.email || null,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    const updatedInvitesSnapshot = await requestRef
      .collection(GROUP_MEET_INVITES_SUBCOLLECTION)
      .orderBy('createdAt', 'asc')
      .get();

    const payload: SendInvitesResponse = {
      sentCount,
      failedCount,
      skippedCount,
      invites: updatedInvitesSnapshot.docs.map(mapGroupMeetInviteSummary),
      status: nextStatus,
    };

    return res.status(200).json(payload);
  } catch (error: any) {
    console.error('[group-meet-send] Failed to send draft invites:', error);
    return res.status(500).json({ error: error?.message || 'Failed to send Group Meet invites.' });
  }
}
