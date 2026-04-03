import type { NextApiRequest, NextApiResponse } from 'next';
import admin, { getFirebaseAdminApp } from '../../../../../../../lib/firebase-admin';
import {
  GROUP_MEET_INVITES_SUBCOLLECTION,
  GROUP_MEET_REQUESTS_COLLECTION,
  getGroupMeetBaseUrl,
  mapGroupMeetInviteSummary,
  sendGroupMeetInviteEmail,
  toIso,
} from '../../../../../../../lib/groupMeetAdmin';
import { requireAdminRequest } from '../../../../_auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const adminUser = await requireAdminRequest(req);
  if (!adminUser) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const requestId = typeof req.query.requestId === 'string' ? req.query.requestId.trim() : '';
  const token = typeof req.query.token === 'string' ? req.query.token.trim() : '';

  if (!requestId || !token) {
    return res.status(400).json({ error: 'Request id and invite token are required.' });
  }

  const forceDevFirebase =
    req.headers?.['x-force-dev-firebase'] === 'true' ||
    req.headers?.['x-force-dev-firebase'] === '1';

  try {
    const requestRef = getFirebaseAdminApp(forceDevFirebase)
      .firestore()
      .collection(GROUP_MEET_REQUESTS_COLLECTION)
      .doc(requestId);
    const requestDoc = await requestRef.get();

    if (!requestDoc.exists) {
      return res.status(404).json({ error: 'Group Meet request not found.' });
    }

    const inviteRef = requestRef.collection(GROUP_MEET_INVITES_SUBCOLLECTION).doc(token);
    const inviteDoc = await inviteRef.get();

    if (!inviteDoc.exists) {
      return res.status(404).json({ error: 'Group Meet invite not found.' });
    }

    const requestData = requestDoc.data() || {};
    const inviteData = inviteDoc.data() || {};
    const recipientEmail =
      typeof inviteData.email === 'string' ? inviteData.email.trim().toLowerCase() : '';

    if (!recipientEmail) {
      return res.status(400).json({ error: 'This participant does not have an email address on file.' });
    }

    const shareUrl =
      (typeof inviteData.shareUrl === 'string' && inviteData.shareUrl.trim()) ||
      `${getGroupMeetBaseUrl(req).replace(/\/+$/, '')}/group-meet/${encodeURIComponent(token)}`;

    const result = await sendGroupMeetInviteEmail({
      requestTitle: requestData.title || 'Group Meet',
      targetMonth: requestData.targetMonth || '',
      deadlineAt: toIso(requestData.deadlineAt) || new Date().toISOString(),
      timezone: requestData.timezone || 'America/New_York',
      recipientName: inviteData.name || 'there',
      recipientEmail,
      shareUrl,
    });

    const emailStatus = result.success ? 'sent' : 'failed';
    const emailError = result.success ? null : result.error || 'Failed to send';

    await inviteRef.set(
      {
        shareUrl,
        emailStatus,
        emailError,
        emailedAt: result.success ? admin.firestore.FieldValue.serverTimestamp() : null,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        lastResentByEmail: adminUser.email || null,
      },
      { merge: true }
    );

    const updatedInviteDoc = await inviteRef.get();
    const invite = mapGroupMeetInviteSummary(updatedInviteDoc);

    if (!result.success) {
      return res.status(500).json({ error: emailError, invite });
    }

    return res.status(200).json({ invite });
  } catch (error: any) {
    console.error('[group-meet-resend] Failed to resend invite:', error);
    return res.status(500).json({ error: error?.message || 'Failed to resend invite.' });
  }
}
