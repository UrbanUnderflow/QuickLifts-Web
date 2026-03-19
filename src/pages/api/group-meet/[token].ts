import type { NextApiRequest, NextApiResponse } from 'next';
import admin from '../../../lib/firebase-admin';
import {
  normalizeGroupMeetAvailabilitySlots,
  type GroupMeetAvailabilitySlot,
} from '../../../lib/groupMeet';

const REQUESTS_COLLECTION = 'groupMeetRequests';
const INVITES_SUBCOLLECTION = 'groupMeetInvites';

type GroupMeetInvitePayload = {
  invite: {
    token: string;
    name: string;
    email: string | null;
    shareUrl: string;
    responseSubmittedAt: string | null;
    availabilityEntries: GroupMeetAvailabilitySlot[];
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

const toIso = (value: FirebaseFirestore.Timestamp | null | undefined) =>
  value?.toDate?.().toISOString?.() || null;

async function findInviteByToken(token: string) {
  const snapshot = await admin
    .firestore()
    .collectionGroup(INVITES_SUBCOLLECTION)
    .where(admin.firestore.FieldPath.documentId(), '==', token)
    .limit(1)
    .get();

  if (snapshot.empty) return null;

  const inviteDoc = snapshot.docs[0];
  const requestRef = inviteDoc.ref.parent.parent;
  if (!requestRef) return null;

  const requestDoc = await requestRef.get();
  if (!requestDoc.exists) return null;

  return { inviteDoc, requestDoc };
}

function buildInvitePayload(args: {
  token: string;
  inviteData: FirebaseFirestore.DocumentData;
  requestId: string;
  requestData: FirebaseFirestore.DocumentData;
}): GroupMeetInvitePayload {
  const deadlineAt = toIso(args.requestData.deadlineAt);
  const deadlinePassed = deadlineAt ? new Date(deadlineAt).getTime() <= Date.now() : false;

  return {
    invite: {
      token: args.token,
      name: args.inviteData.name || '',
      email: args.inviteData.email || null,
      shareUrl: args.inviteData.shareUrl || '',
      responseSubmittedAt: toIso(args.inviteData.responseSubmittedAt),
      availabilityEntries: Array.isArray(args.inviteData.availabilityEntries)
        ? args.inviteData.availabilityEntries
        : [],
      deadlinePassed,
      request: {
        id: args.requestId,
        title: args.requestData.title || 'Group Meet',
        targetMonth: args.requestData.targetMonth || '',
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

  const found = await findInviteByToken(token);
  if (!found) {
    return res.status(404).json({ error: 'Invite not found.' });
  }

  const { inviteDoc, requestDoc } = found;
  const requestData = requestDoc.data() || {};
  const inviteData = inviteDoc.data() || {};
  const deadlineAt = toIso(requestData.deadlineAt);
  const deadlinePassed = deadlineAt ? new Date(deadlineAt).getTime() <= Date.now() : false;

  if (req.method === 'GET') {
    return res.status(200).json(
      buildInvitePayload({
        token,
        inviteData,
        requestId: requestDoc.id,
        requestData,
      })
    );
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  if (deadlinePassed) {
    return res.status(403).json({ error: 'This availability window is closed.' });
  }

  try {
    const availabilityEntries = normalizeGroupMeetAvailabilitySlots(
      req.body?.availabilityEntries,
      requestData.targetMonth || ''
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

    const respondedSnapshot = await requestDoc.ref
      .collection(INVITES_SUBCOLLECTION)
      .where('hasResponse', '==', true)
      .get();

    await requestDoc.ref.set(
      {
        responseCount: respondedSnapshot.size,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    const refreshedInviteDoc = await inviteDoc.ref.get();

    return res.status(200).json(
      buildInvitePayload({
        token,
        inviteData: refreshedInviteDoc.data() || {},
        requestId: requestDoc.id,
        requestData: {
          ...requestData,
          responseCount: respondedSnapshot.size,
        },
      })
    );
  } catch (error: any) {
    console.error('[group-meet-public] Failed to save availability:', error);
    return res.status(500).json({ error: error?.message || 'Failed to save availability.' });
  }
}
