import type { NextApiRequest, NextApiResponse } from 'next';
import admin, { getFirebaseAdminApp } from '../../../../lib/firebase-admin';
import { normalizeGroupMeetAvailabilitySlots } from '../../../../lib/groupMeet';
import { verifyGroupMeetFlexActionToken } from '../../../../lib/groupMeetFlex';
import { shouldForceDevFirebase, toIso } from '../../../../lib/groupMeetGuestGoogleCalendar';
import {
  getGroupMeetBaseUrl,
  GROUP_MEET_INVITES_SUBCOLLECTION,
  GROUP_MEET_REQUESTS_COLLECTION,
  mapGroupMeetInviteDetail,
  maybeNotifyGroupMeetHostAfterAvailabilitySave,
} from '../../../../lib/groupMeetAdmin';

type GroupMeetFlexSelectionResponse = {
  requestTitle: string;
  timezone: string;
  shareUrl: string;
  selectedSlot: {
    date: string;
    startMinutes: number;
    endMinutes: number;
  };
};

function hasInviteResponse(inviteData: FirebaseFirestore.DocumentData, targetMonth: string) {
  const availabilityEntries = normalizeGroupMeetAvailabilitySlots(
    inviteData.availabilityEntries,
    targetMonth || ''
  );
  return availabilityEntries.length > 0 || Boolean(toIso(inviteData.responseSubmittedAt));
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<GroupMeetFlexSelectionResponse | { error: string }>) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const token = typeof req.query.token === 'string' ? req.query.token.trim() : '';
  if (!token) {
    return res.status(400).json({ error: 'Flex token is required.' });
  }

  try {
    const payload = verifyGroupMeetFlexActionToken(token);
    const db = getFirebaseAdminApp(shouldForceDevFirebase(req)).firestore();
    const requestRef = db.collection(GROUP_MEET_REQUESTS_COLLECTION).doc(payload.requestId);
    const requestDoc = await requestRef.get();

    if (!requestDoc.exists) {
      return res.status(404).json({ error: 'Group Meet request not found.' });
    }

    const requestData = requestDoc.data() || {};
    const deadlineAt = toIso(requestData.deadlineAt);
    const deadlinePassed = deadlineAt ? new Date(deadlineAt).getTime() <= Date.now() : false;
    if (requestData.status === 'draft') {
      return res.status(403).json({ error: 'This Group Meet request is not live yet.' });
    }

    if (requestData.status === 'closed' || deadlinePassed) {
      return res.status(403).json({ error: 'This availability window is closed.' });
    }

    const targetMonth = requestData.targetMonth || '';
    if (!payload.date.startsWith(`${targetMonth}-`)) {
      return res.status(400).json({ error: 'The selected flex time no longer matches this request.' });
    }

    if (!Number.isInteger(payload.startMinutes) || !Number.isInteger(payload.endMinutes) || payload.startMinutes >= payload.endMinutes) {
      return res.status(400).json({ error: 'The selected flex time is invalid.' });
    }

    const inviteRef = requestRef.collection(GROUP_MEET_INVITES_SUBCOLLECTION).doc(payload.inviteToken);
    const inviteDoc = await inviteRef.get();

    if (!inviteDoc.exists) {
      return res.status(404).json({ error: 'This participant invite was not found.' });
    }

    const inviteData = inviteDoc.data() || {};
    const respondedBeforeSave = hasInviteResponse(inviteData, targetMonth);
    const mergedAvailability = normalizeGroupMeetAvailabilitySlots(
      [
        ...normalizeGroupMeetAvailabilitySlots(inviteData.availabilityEntries, targetMonth),
        {
          date: payload.date,
          startMinutes: payload.startMinutes,
          endMinutes: payload.endMinutes,
        },
      ],
      targetMonth
    );

    await inviteRef.set(
      {
        availabilityEntries: mergedAvailability,
        hasResponse: mergedAvailability.length > 0,
        responseSubmittedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        lastFlexSelectionAt: admin.firestore.FieldValue.serverTimestamp(),
        lastFlexSelectionCandidateKey: payload.candidateKey,
      },
      { merge: true }
    );

    const refreshedInvitesSnapshot = await requestRef
      .collection(GROUP_MEET_INVITES_SUBCOLLECTION)
      .orderBy('createdAt', 'asc')
      .get();

    const responseCount = refreshedInvitesSnapshot.docs.filter((docSnap) =>
      hasInviteResponse(docSnap.data() || {}, targetMonth)
    ).length;

    await requestRef.set(
      {
        responseCount,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    const refreshedInvites = refreshedInvitesSnapshot.docs.map((docSnap) =>
      mapGroupMeetInviteDetail(docSnap, targetMonth)
    );

    try {
      await maybeNotifyGroupMeetHostAfterAvailabilitySave({
        requestRef,
        requestId: requestDoc.id,
        requestData: {
          ...requestData,
          responseCount,
        },
        invites: refreshedInvites,
        responderToken: payload.inviteToken,
        responseAction: respondedBeforeSave ? 'updated' : 'added',
        baseUrl: getGroupMeetBaseUrl(req),
      });
    } catch (notificationError) {
      console.error('[group-meet-flex] Host notification email failed:', notificationError);
    }

    return res.status(200).json({
      requestTitle: requestData.title || 'Group Meet',
      timezone: requestData.timezone || 'America/New_York',
      shareUrl: inviteData.shareUrl || '',
      selectedSlot: {
        date: payload.date,
        startMinutes: payload.startMinutes,
        endMinutes: payload.endMinutes,
      },
    });
  } catch (error: any) {
    console.error('[group-meet-flex] Failed to add flex slot from email:', error);
    const message = error?.message || 'Failed to save this flex selection.';
    const normalized = String(message).toLowerCase();
    const statusCode =
      normalized.includes('not found')
        ? 404
        : normalized.includes('invalid') ||
            normalized.includes('verified') ||
            normalized.includes('incomplete') ||
            normalized.includes('expired')
          ? 400
          : normalized.includes('closed') || normalized.includes('not live')
            ? 403
            : 500;

    return res.status(statusCode).json({
      error: message,
    });
  }
}
