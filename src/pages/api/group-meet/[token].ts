import type { NextApiRequest, NextApiResponse } from 'next';
import admin, { getFirebaseAdminApp } from '../../../lib/firebase-admin';
import {
  normalizeGroupMeetAvailabilitySlots,
  type GroupMeetAvailabilitySlot,
  type GroupMeetSharedAvailabilityParticipant,
} from '../../../lib/groupMeet';

const REQUESTS_COLLECTION = 'groupMeetRequests';
const INVITES_SUBCOLLECTION = 'groupMeetInvites';

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

function hasTruthyHeader(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value.some((entry) => entry === 'true' || entry === '1');
  }

  return value === 'true' || value === '1';
}

function shouldForceDevFirebase(req: NextApiRequest) {
  if (hasTruthyHeader(req.headers?.['x-force-dev-firebase'])) {
    return true;
  }

  const hostHeader = req.headers?.['x-forwarded-host'] || req.headers?.host || '';
  const host = Array.isArray(hostHeader) ? hostHeader[0] || '' : hostHeader;
  const normalizedHost = host.trim().toLowerCase();

  return (
    normalizedHost.startsWith('localhost:') ||
    normalizedHost.startsWith('127.0.0.1:') ||
    normalizedHost.startsWith('[::1]:')
  );
}

async function findInviteByToken(db: FirebaseFirestore.Firestore, token: string) {
  let snapshot: FirebaseFirestore.QuerySnapshot | null = null;

  try {
    snapshot = await db
      .collectionGroup(INVITES_SUBCOLLECTION)
      .where('token', '==', token)
      .limit(1)
      .get();
  } catch (error) {
    console.warn('[group-meet-public] Token lookup fell back to scan:', error);
  }

  let inviteDoc = snapshot?.empty ? null : snapshot?.docs?.[0] || null;

  if (!inviteDoc) {
    const fallbackSnapshot = await db.collectionGroup(INVITES_SUBCOLLECTION).get();
    inviteDoc =
      fallbackSnapshot.docs.find((docSnap) => docSnap.id === token || docSnap.data()?.token === token) || null;
  }

  if (!inviteDoc) return null;
  const requestRef = inviteDoc.ref.parent.parent;
  if (!requestRef) return null;

  const requestDoc = await requestRef.get();
  if (!requestDoc.exists) return null;

  return { inviteDoc, requestDoc };
}

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
  const found = await findInviteByToken(db, token);
  if (!found) {
    return res.status(404).json({ error: 'Invite not found.' });
  }

  const { inviteDoc, requestDoc } = found;
  const requestData = requestDoc.data() || {};
  const inviteData = inviteDoc.data() || {};
  const invitesSnapshot = await requestDoc.ref.collection(INVITES_SUBCOLLECTION).get();
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

    const refreshedInvitesSnapshot = await requestDoc.ref.collection(INVITES_SUBCOLLECTION).get();
    const responseCount = refreshedInvitesSnapshot.docs.filter((docSnap) =>
      hasInviteResponse(docSnap.data() || {}, requestData.targetMonth || '')
    ).length;

    await requestDoc.ref.set(
      {
        responseCount,
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
          responseCount,
        },
        peerAvailability: buildPeerAvailability({
          currentToken: token,
          inviteDocs: refreshedInvitesSnapshot.docs,
          targetMonth: requestData.targetMonth || '',
        }),
      })
    );
  } catch (error: any) {
    console.error('[group-meet-public] Failed to save availability:', error);
    return res.status(500).json({ error: error?.message || 'Failed to save availability.' });
  }
}
