import type { NextApiRequest, NextApiResponse } from 'next';
import admin, { getFirebaseAdminApp } from '../../../../../../../lib/firebase-admin';
import { computeGroupMeetAnalysis } from '../../../../../../../lib/groupMeet';
import {
  buildGroupMeetManualFlexPreview,
  getGroupMeetEasternDateKey,
} from '../../../../../../../lib/groupMeetFlex';
import {
  GROUP_MEET_INVITES_SUBCOLLECTION,
  GROUP_MEET_REQUESTS_COLLECTION,
  getGroupMeetBaseUrl,
  mapGroupMeetInviteDetail,
  sendGroupMeetManualFlexPromptEmail,
  toIso,
} from '../../../../../../../lib/groupMeetAdmin';
import { requireAdminRequest } from '../../../../_auth';

type ManualFlexPreviewResponse = {
  strategy: 'blocker' | 'group_options' | 'none';
  options: Array<{
    candidateKey: string;
    date: string;
    startMinutes: number;
    endMinutes: number;
    participantCount: number;
    totalParticipants: number;
    participantNames: string[];
    missingParticipantNames: string[];
  }>;
  detailText: string;
  invite: {
    token: string;
    name: string;
    email: string | null;
    participantType: 'host' | 'participant';
  };
  lastManualFlexSentAt: string | null;
  lastManualFlexStrategy: string | null;
};

function buildDetailText(strategy: ManualFlexPreviewResponse['strategy']) {
  if (strategy === 'blocker') {
    return 'These are the strongest remaining times where this person is one of the people still needed to make the meeting work.';
  }

  if (strategy === 'group_options') {
    return 'These are the strongest remaining group options we can send to this participant right now.';
  }

  return 'There are no strong flex options to send for this participant right now.';
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const adminUser = await requireAdminRequest(req);
  if (!adminUser) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const requestId = typeof req.query.requestId === 'string' ? req.query.requestId.trim() : '';
  const token = typeof req.query.token === 'string' ? req.query.token.trim() : '';

  if (!requestId || !token) {
    return res.status(400).json({ error: 'Request id and invite token are required.' });
  }

  if (!['GET', 'POST'].includes(req.method || '')) {
    return res.status(405).json({ error: 'Method not allowed' });
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

    const requestData = requestDoc.data() || {};
    const targetMonth = typeof requestData.targetMonth === 'string' ? requestData.targetMonth : '';
    const meetingDurationMinutes = Math.max(15, Number(requestData.meetingDurationMinutes) || 30);
    const invitesSnapshot = await requestRef
      .collection(GROUP_MEET_INVITES_SUBCOLLECTION)
      .orderBy('createdAt', 'asc')
      .get();
    const invites = invitesSnapshot.docs.map((docSnap) => mapGroupMeetInviteDetail(docSnap, targetMonth));
    const invite = invites.find((entry) => entry.token === token) || null;
    const inviteDoc = invitesSnapshot.docs.find((docSnap) => docSnap.id === token) || null;
    const rawInviteData = inviteDoc?.data() || {};

    if (!invite || !inviteDoc) {
      return res.status(404).json({ error: 'Group Meet invite not found.' });
    }

    if (invite.participantType === 'host') {
      return res.status(400).json({ error: 'Hosts cannot receive manual flex requests.' });
    }

    if (!invite.email) {
      return res.status(400).json({ error: 'This participant does not have an email address on file.' });
    }

    const analysis = computeGroupMeetAnalysis(invites, meetingDurationMinutes);
    const preview = buildGroupMeetManualFlexPreview({
      analysis,
      invites,
      inviteToken: token,
      referenceDate: new Date(),
    });

    const payload: ManualFlexPreviewResponse = {
      strategy: preview.strategy,
      options: preview.options,
      detailText: buildDetailText(preview.strategy),
      invite: {
        token: invite.token,
        name: invite.name,
        email: invite.email,
        participantType: invite.participantType || 'participant',
      },
      lastManualFlexSentAt: toIso(rawInviteData.manualFlexPromptSentAt),
      lastManualFlexStrategy:
        typeof rawInviteData.manualFlexPromptStrategy === 'string'
          ? rawInviteData.manualFlexPromptStrategy
          : null,
    };

    if (req.method === 'GET') {
      return res.status(200).json(payload);
    }

    if (!preview.options.length || preview.strategy === 'none') {
      return res.status(400).json({ error: 'There are no strong flex options available for this participant right now.' });
    }

    const result = await sendGroupMeetManualFlexPromptEmail({
      requestId,
      requestTitle: requestData.title || 'Group Meet',
      targetMonth,
      deadlineAt: toIso(requestData.deadlineAt),
      timezone: requestData.timezone || 'America/New_York',
      inviteToken: invite.token,
      recipientName: invite.name || 'Guest',
      recipientEmail: invite.email,
      shareUrl:
        invite.shareUrl ||
        `${getGroupMeetBaseUrl(req).replace(/\/+$/, '')}/group-meet/${encodeURIComponent(invite.token)}`,
      baseUrl: getGroupMeetBaseUrl(req),
      options: preview.options,
      strategy: preview.strategy,
      dispatchKey: `${Date.now()}`,
    });

    if (!result.success) {
      return res.status(500).json({ error: result.error || 'Failed to send flex request email.' });
    }

    const localDateKey = getGroupMeetEasternDateKey(new Date());
    const inviteUpdatePayload: Record<string, unknown> = {
      manualFlexPromptSentAt: admin.firestore.FieldValue.serverTimestamp(),
      manualFlexPromptStrategy: preview.strategy,
      manualFlexPromptCandidateKeys: preview.options.map((option) => option.candidateKey),
      manualFlexPromptLastSentByEmail: adminUser.email || null,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    if (preview.strategy === 'blocker') {
      inviteUpdatePayload.flexPromptSentAt = admin.firestore.FieldValue.serverTimestamp();
      inviteUpdatePayload.flexPromptSentLocalDate = localDateKey;
      inviteUpdatePayload.flexPromptCandidateKeys = preview.options.map((option) => option.candidateKey);
    } else if (!invite.respondedAt && invite.availabilityEntries.length === 0) {
      inviteUpdatePayload.deadlineReminderSentAt = admin.firestore.FieldValue.serverTimestamp();
      inviteUpdatePayload.deadlineReminderSentLocalDate = localDateKey;
    }

    await inviteDoc.ref.set(inviteUpdatePayload, { merge: true });

    return res.status(200).json({
      success: true,
      skipped: Boolean(result.skipped),
      messageId: result.messageId || null,
      ...payload,
    });
  } catch (error: any) {
    console.error('[group-meet-manual-flex] Failed to preview or send manual flex request:', error);
    return res.status(500).json({ error: error?.message || 'Failed to process manual flex request.' });
  }
}
