import type { NextApiRequest, NextApiResponse } from 'next';
import admin, { getFirebaseAdminApp } from '../../../../lib/firebase-admin';
import { verifyGroupMeetHostActionToken } from '../../../../lib/groupMeetHostActions';
import { shouldForceDevFirebase } from '../../../../lib/groupMeetGuestGoogleCalendar';
import { GROUP_MEET_INVITES_SUBCOLLECTION, GROUP_MEET_REQUESTS_COLLECTION } from '../../../../lib/groupMeetAdmin';
import {
  buildGroupMeetFinalSelection,
  computeGroupMeetAiRecommendation,
  mapGroupMeetInviteDocs,
  scheduleGroupMeetCalendarInvite,
} from '../../../../lib/groupMeetWorkflow';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const token = typeof req.query.token === 'string' ? req.query.token.trim() : '';
  if (!token) {
    return res.status(400).json({ error: 'Host selection token is required.' });
  }

  try {
    const payload = verifyGroupMeetHostActionToken(token);
    const db = getFirebaseAdminApp(shouldForceDevFirebase(req)).firestore();
    const requestRef = db.collection(GROUP_MEET_REQUESTS_COLLECTION).doc(payload.requestId);
    const requestDoc = await requestRef.get();

    if (!requestDoc.exists) {
      return res.status(404).json({ error: 'Group Meet request not found.' });
    }

    const requestData = requestDoc.data() || {};
    const invitesSnapshot = await requestRef
      .collection(GROUP_MEET_INVITES_SUBCOLLECTION)
      .orderBy('createdAt', 'asc')
      .get();
    const invites = mapGroupMeetInviteDocs(invitesSnapshot, requestData.targetMonth || '');
    const hostInvite = invites.find((invite) => invite.participantType === 'host') || null;
    const { analysis, recommendation } = await computeGroupMeetAiRecommendation({
      requestTitle: requestData.title || 'Group Meet',
      targetMonth: requestData.targetMonth || '',
      meetingDurationMinutes: Number(requestData.meetingDurationMinutes) || 30,
      invites,
      allowFallback: true,
    });

    const finalSelection = buildGroupMeetFinalSelection({
      analysis,
      candidateKey: payload.candidateKey,
      selectedByEmail:
        hostInvite?.email ||
        requestData.createdByEmail ||
        requestData.finalSelection?.selectedByEmail ||
        'group-meet-host-link',
    });

    const calendarInvite = await scheduleGroupMeetCalendarInvite({
      requestId: requestDoc.id,
      title: requestData.title || 'Group Meet',
      timezone: requestData.timezone || 'America/New_York',
      finalSelection,
      aiSummary: recommendation.summary,
      invites,
      existingInvite: requestData.calendarInvite || null,
    });

    await requestRef.set(
      {
        status: 'closed',
        aiRecommendation: recommendation,
        finalSelection,
        calendarInvite,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        finalizedByEmail: finalSelection.selectedByEmail,
        calendarInviteUpdatedByEmail: finalSelection.selectedByEmail,
        hostSelectedFromEmailAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return res.status(200).json({
      requestTitle: requestData.title || 'Group Meet',
      timezone: requestData.timezone || 'America/New_York',
      finalSelection,
      calendarInvite,
    });
  } catch (error: any) {
    console.error('[group-meet-host-selection] Failed to finalize from email:', error);
    const message = error?.message || 'Failed to finalize the selected meeting time.';
    const normalized = String(message).toLowerCase();
    const statusCode =
      normalized.includes('not found')
        ? 404
        : normalized.includes('invalid') ||
            normalized.includes('verified') ||
            normalized.includes('incomplete') ||
            normalized.includes('expired')
          ? 400
          : 500;

    return res.status(statusCode).json({
      error: message,
    });
  }
}
