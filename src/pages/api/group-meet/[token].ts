import type { NextApiRequest, NextApiResponse } from 'next';
import admin, { getFirebaseAdminApp } from '../../../lib/firebase-admin';
import {
  normalizeGroupMeetAvailabilitySlots,
  type GroupMeetAvailabilitySlot,
  type GroupMeetSharedAvailabilityParticipant,
} from '../../../lib/groupMeet';
import {
  buildGroupMeetGuestCalendarImportSummary,
  findGroupMeetInviteByToken,
  GROUP_MEET_INVITES_SUBCOLLECTION,
  shouldForceDevFirebase,
  toIso,
} from '../../../lib/groupMeetGuestGoogleCalendar';
import {
  getGroupMeetBaseUrl,
  mapGroupMeetInviteDetail,
  maybeNotifyGroupMeetHostAfterAvailabilitySave,
} from '../../../lib/groupMeetAdmin';

type GroupMeetInvitePayload = {
  invite: {
    token: string;
    name: string;
    email: string | null;
    imageUrl: string | null;
    participantType: 'host' | 'participant';
    shareUrl: string;
    responseSubmittedAt: string | null;
    availabilityEntries: GroupMeetAvailabilitySlot[];
    peerAvailability: GroupMeetSharedAvailabilityParticipant[];
    calendarImport?: ReturnType<typeof buildGroupMeetGuestCalendarImportSummary> | null;
    deadlinePassed: boolean;
    request: {
      id: string;
      title: string;
      targetMonth: string;
      deadlineAt: string | null;
      timezone: string;
      meetingDurationMinutes: number;
      status: 'collecting' | 'closed';
    };
  };
};

function getNormalizedInviteAvailability(
  inviteData: FirebaseFirestore.DocumentData,
  targetMonth: string
) {
  return normalizeGroupMeetAvailabilitySlots(inviteData.availabilityEntries, targetMonth || '');
}

function hasInviteResponse(
  inviteData: FirebaseFirestore.DocumentData,
  targetMonth: string
) {
  return (
    getNormalizedInviteAvailability(inviteData, targetMonth).length > 0 ||
    Boolean(toIso(inviteData.responseSubmittedAt))
  );
}

function buildPeerAvailability(args: {
  currentToken: string;
  inviteDocs: FirebaseFirestore.QueryDocumentSnapshot[];
  targetMonth: string;
}): GroupMeetSharedAvailabilityParticipant[] {
  return args.inviteDocs
    .map((docSnap) => {
      const inviteData = docSnap.data() || {};
      return {
        token: docSnap.id,
        name: inviteData.name || '',
        imageUrl: inviteData.imageUrl || null,
        participantType: inviteData.participantType === 'host' ? 'host' : 'participant',
        respondedAt: toIso(inviteData.responseSubmittedAt),
        availabilityEntries: getNormalizedInviteAvailability(inviteData, args.targetMonth),
      } satisfies GroupMeetSharedAvailabilityParticipant;
    })
    .filter(
      (participant) =>
        participant.token !== args.currentToken &&
        (participant.availabilityEntries.length > 0 || Boolean(participant.respondedAt))
    )
    .sort((left, right) => {
      if (left.participantType !== right.participantType) {
        return left.participantType === 'host' ? -1 : 1;
      }

      return left.name.localeCompare(right.name);
    });
}

function buildInvitePayload(args: {
  token: string;
  inviteData: FirebaseFirestore.DocumentData;
  requestId: string;
  requestData: FirebaseFirestore.DocumentData;
  peerAvailability: GroupMeetSharedAvailabilityParticipant[];
}): GroupMeetInvitePayload {
  const deadlineAt = toIso(args.requestData.deadlineAt);
  const deadlinePassed = deadlineAt ? new Date(deadlineAt).getTime() <= Date.now() : false;
  const targetMonth = args.requestData.targetMonth || '';

  return {
    invite: {
      token: args.token,
      name: args.inviteData.name || '',
      email: args.inviteData.email || null,
      imageUrl: args.inviteData.imageUrl || null,
      participantType: args.inviteData.participantType === 'host' ? 'host' : 'participant',
      shareUrl: args.inviteData.shareUrl || '',
      responseSubmittedAt: toIso(args.inviteData.responseSubmittedAt),
      availabilityEntries: getNormalizedInviteAvailability(args.inviteData, targetMonth),
      peerAvailability: args.peerAvailability,
      calendarImport: buildGroupMeetGuestCalendarImportSummary(args.inviteData.calendarImport),
      deadlinePassed,
      request: {
        id: args.requestId,
        title: args.requestData.title || 'Group Meet',
        targetMonth,
        deadlineAt,
        timezone: args.requestData.timezone || 'America/New_York',
        meetingDurationMinutes: Number(args.requestData.meetingDurationMinutes) || 30,
        status: args.requestData.status === 'closed' || deadlinePassed ? 'closed' : 'collecting',
      },
    },
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const token = typeof req.query.token === 'string' ? req.query.token.trim() : '';
  if (!token) {
    return res.status(400).json({ error: 'Token is required.' });
  }

  const db = getFirebaseAdminApp(shouldForceDevFirebase(req)).firestore();
  const found = await findGroupMeetInviteByToken(db, token);
  if (!found) {
    return res.status(404).json({ error: 'Invite not found.' });
  }

  const { inviteDoc, requestDoc } = found;
  const requestData = requestDoc.data() || {};
  const inviteData = inviteDoc.data() || {};
  const invitesSnapshot = await requestDoc.ref.collection(GROUP_MEET_INVITES_SUBCOLLECTION).get();
  const peerAvailability = buildPeerAvailability({
    currentToken: token,
    inviteDocs: invitesSnapshot.docs,
    targetMonth: requestData.targetMonth || '',
  });
  const deadlineAt = toIso(requestData.deadlineAt);
  const deadlinePassed = deadlineAt ? new Date(deadlineAt).getTime() <= Date.now() : false;

  if (req.method === 'GET') {
    return res.status(200).json(
      buildInvitePayload({
        token,
        inviteData,
        requestId: requestDoc.id,
        requestData,
        peerAvailability,
      })
    );
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  if (requestData.status === 'closed') {
    return res.status(403).json({ error: 'This availability window is closed.' });
  }

  if (deadlinePassed) {
    return res.status(403).json({ error: 'This availability window is closed.' });
  }

  try {
    const targetMonth = requestData.targetMonth || '';
    const respondedBeforeSave = hasInviteResponse(inviteData, targetMonth);
    const availabilityEntries = normalizeGroupMeetAvailabilitySlots(
      req.body?.availabilityEntries,
      targetMonth
    );

    const hasResponse = availabilityEntries.length > 0;

    await inviteDoc.ref.set(
      {
        availabilityEntries,
        hasResponse,
        responseSubmittedAt: hasResponse ? admin.firestore.FieldValue.serverTimestamp() : null,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    const refreshedInvitesSnapshot = await requestDoc.ref.collection(GROUP_MEET_INVITES_SUBCOLLECTION).get();
    const responseCount = refreshedInvitesSnapshot.docs.filter((docSnap) =>
      hasInviteResponse(docSnap.data() || {}, targetMonth)
    ).length;

    await requestDoc.ref.set(
      {
        responseCount,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    const refreshedInviteDoc = await inviteDoc.ref.get();
    const refreshedInvites = refreshedInvitesSnapshot.docs.map((docSnap) =>
      mapGroupMeetInviteDetail(docSnap, targetMonth)
    );
    const nextRequestData = {
      ...requestData,
      responseCount,
    };

    if (hasResponse) {
      try {
        await maybeNotifyGroupMeetHostAfterAvailabilitySave({
          requestRef: requestDoc.ref,
          requestId: requestDoc.id,
          requestData: nextRequestData,
          invites: refreshedInvites,
          responderToken: token,
          responseAction: respondedBeforeSave ? 'updated' : 'added',
          baseUrl: getGroupMeetBaseUrl(req),
        });
      } catch (notificationError) {
        console.error('[group-meet-public] Host notification email failed:', notificationError);
      }
    }

    return res.status(200).json(
      buildInvitePayload({
        token,
        inviteData: refreshedInviteDoc.data() || {},
        requestId: requestDoc.id,
        requestData: nextRequestData,
        peerAvailability: buildPeerAvailability({
          currentToken: token,
          inviteDocs: refreshedInvitesSnapshot.docs,
          targetMonth,
        }),
      })
    );
  } catch (error: any) {
    console.error('[group-meet-public] Failed to save availability:', error);
    return res.status(500).json({ error: error?.message || 'Failed to save availability.' });
  }
}
