import type { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseAdminApp } from '../../../../../lib/firebase-admin';
import {
  GROUP_MEET_INVITES_SUBCOLLECTION,
  GROUP_MEET_REQUESTS_COLLECTION,
  sendGroupMeetInviteEmail,
  toIso,
} from '../../../../../lib/groupMeetAdmin';
import { requireAdminRequest } from '../../_auth';

type PreviewEmailBody = {
  recipientName?: string;
  recipientEmail?: string;
  inviteToken?: string;
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

  const body = (req.body || {}) as PreviewEmailBody;
  const inviteToken = (body.inviteToken || '').trim();
  const recipientName = (body.recipientName || adminUser.email || 'Preview Recipient').trim();
  const recipientEmail = (body.recipientEmail || adminUser.email || '').trim().toLowerCase();

  if (!inviteToken) {
    return res.status(400).json({ error: 'Choose which participant link to preview.' });
  }

  if (!recipientEmail) {
    return res.status(400).json({ error: 'Recipient email is required.' });
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

    const inviteDoc = await requestRef.collection(GROUP_MEET_INVITES_SUBCOLLECTION).doc(inviteToken).get();
    if (!inviteDoc.exists) {
      return res.status(404).json({ error: 'Selected participant invite not found.' });
    }

    const inviteData = inviteDoc.data() || {};
    if (inviteData.participantType === 'host') {
      return res.status(400).json({ error: 'Choose a guest link for the preview email.' });
    }

    const requestData = requestDoc.data() || {};
    const shareUrl = (typeof inviteData.shareUrl === 'string' && inviteData.shareUrl.trim()) || '';

    if (!shareUrl) {
      return res.status(400).json({ error: 'This invite is missing a share link.' });
    }

    const result = await sendGroupMeetInviteEmail({
      requestTitle: requestData.title || 'Group Meet',
      targetMonth: requestData.targetMonth || '',
      deadlineAt: toIso(requestData.deadlineAt) || new Date().toISOString(),
      timezone: requestData.timezone || 'America/New_York',
      recipientName,
      recipientEmail,
      shareUrl,
      mode: 'preview',
    });

    if (!result.success) {
      return res.status(500).json({ error: result.error || 'Failed to send preview email.' });
    }

    return res.status(200).json({
      success: true,
      skipped: Boolean(result.skipped),
      messageId: result.messageId || null,
    });
  } catch (error: any) {
    console.error('[group-meet-preview-email] Failed to send preview email:', error);
    return res.status(500).json({ error: error?.message || 'Failed to send preview email.' });
  }
}
