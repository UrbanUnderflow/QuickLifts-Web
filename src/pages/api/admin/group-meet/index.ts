import type { NextApiRequest, NextApiResponse } from 'next';
import { randomBytes } from 'crypto';
import admin, { getFirebaseAdminApp } from '../../../../lib/firebase-admin';
import {
  buildGroupMeetShareUrl,
  normalizeGroupMeetAvailabilitySlots,
  resolveGroupMeetStatus,
  type GroupMeetInviteSummary,
  type GroupMeetRequestSummary,
  isValidGroupMeetMonth,
} from '../../../../lib/groupMeet';
import {
  GROUP_MEET_CONTACTS_COLLECTION,
  GROUP_MEET_INVITES_SUBCOLLECTION,
  GROUP_MEET_REQUESTS_COLLECTION,
  getGroupMeetBaseUrl,
  mapGroupMeetContact,
  mapGroupMeetInviteSummary,
  sendGroupMeetInviteEmail,
  toIso,
} from '../../../../lib/groupMeetAdmin';
import { requireAdminRequest } from '../_auth';

type ParticipantInput = {
  contactId?: string;
};

type HostInput = ParticipantInput & {
  availabilityEntries?: unknown;
};

type CreateGroupMeetRequestBody = {
  title?: string;
  targetMonth?: string;
  deadlineAt?: string;
  timezone?: string;
  meetingDurationMinutes?: number;
  participants?: ParticipantInput[];
  host?: HostInput;
  sendEmails?: boolean;
};

function mapInvite(docSnap: FirebaseFirestore.QueryDocumentSnapshot): GroupMeetInviteSummary {
  return mapGroupMeetInviteSummary(docSnap);
}

async function mapRequest(docSnap: FirebaseFirestore.QueryDocumentSnapshot): Promise<GroupMeetRequestSummary> {
  const data = docSnap.data();
  const invitesSnapshot = await docSnap.ref.collection(GROUP_MEET_INVITES_SUBCOLLECTION).orderBy('createdAt', 'asc').get();
  const deadlineAt = toIso(data.deadlineAt);

  return {
    id: docSnap.id,
    title: data.title || 'Group Meet',
    targetMonth: data.targetMonth || '',
    deadlineAt,
    timezone: data.timezone || 'America/New_York',
    meetingDurationMinutes: Number(data.meetingDurationMinutes) || 30,
    createdByEmail: data.createdByEmail || null,
    createdAt: toIso(data.createdAt),
    participantCount: Number(data.participantCount) || invitesSnapshot.size,
    responseCount: Number(data.responseCount) || 0,
    status: resolveGroupMeetStatus(deadlineAt),
    invites: invitesSnapshot.docs.map(mapInvite),
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const adminUser = await requireAdminRequest(req);
  if (!adminUser) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const forceDevFirebase =
    req.headers?.['x-force-dev-firebase'] === 'true' ||
    req.headers?.['x-force-dev-firebase'] === '1';
  const db = getFirebaseAdminApp(forceDevFirebase).firestore();

  if (req.method === 'GET') {
    try {
      const snapshot = await db
        .collection(GROUP_MEET_REQUESTS_COLLECTION)
        .orderBy('createdAt', 'desc')
        .limit(15)
        .get();
      const requests = await Promise.all(snapshot.docs.map(mapRequest));
      return res.status(200).json({ requests });
    } catch (error) {
      console.error('[group-meet-admin] Failed to list requests:', error);
      return res.status(500).json({ error: 'Failed to load Group Meet requests.' });
    }
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = (req.body || {}) as CreateGroupMeetRequestBody;
    const title = (body.title || 'Group Meet').trim();
    const targetMonth = (body.targetMonth || '').trim();
    const timezone = (body.timezone || 'America/New_York').trim() || 'America/New_York';
    const meetingDurationMinutes = Math.max(15, Math.min(240, Number(body.meetingDurationMinutes) || 30));
    const sendEmails = body.sendEmails !== false;
    const deadline = new Date(body.deadlineAt || '');

    if (!isValidGroupMeetMonth(targetMonth)) {
      return res.status(400).json({ error: 'A valid target month is required.' });
    }

    if (Number.isNaN(deadline.getTime())) {
      return res.status(400).json({ error: 'A valid deadline is required.' });
    }

    const hostContactId = (body.host?.contactId || '').trim();
    if (!hostContactId) {
      return res.status(400).json({ error: 'Choose the host from your contact list.' });
    }

    const contactsRef = db.collection(GROUP_MEET_CONTACTS_COLLECTION);
    const hostContactSnap = await contactsRef.doc(hostContactId).get();
    if (!hostContactSnap.exists) {
      return res.status(400).json({ error: 'The selected host contact could not be found.' });
    }

    const hostContact = mapGroupMeetContact(hostContactSnap);
    const normalizedHost = {
      contactId: hostContact.id,
      name: hostContact.name,
      email: hostContact.email,
      imageUrl: hostContact.imageUrl,
      availabilityEntries: normalizeGroupMeetAvailabilitySlots(body.host?.availabilityEntries, targetMonth),
    };

    if (!normalizedHost.availabilityEntries.length) {
      return res.status(400).json({ error: 'Add the host availability before sending the request.' });
    }

    const requestedParticipantIds = Array.from(
      new Set(
        (Array.isArray(body.participants) ? body.participants : [])
          .map((participant) => (participant?.contactId || '').trim())
          .filter(Boolean)
      )
    ).filter((contactId) => contactId !== normalizedHost.contactId);

    const participantContactSnapshots = await Promise.all(
      requestedParticipantIds.map((contactId) => contactsRef.doc(contactId).get())
    );

    const missingParticipantContact = participantContactSnapshots.find((snapshot) => !snapshot.exists);
    if (missingParticipantContact) {
      return res.status(400).json({ error: 'One or more selected guest contacts could not be found.' });
    }

    const dedupedParticipants = participantContactSnapshots
      .map((snapshot) => mapGroupMeetContact(snapshot))
      .filter((participant) => participant.id !== normalizedHost.contactId)
      .map((participant) => ({
        contactId: participant.id,
        name: participant.name,
        email: participant.email,
        imageUrl: participant.imageUrl,
      }));

    if (!dedupedParticipants.length) {
      return res.status(400).json({ error: 'Choose at least one guest from your contact list.' });
    }

    const requestRef = db.collection(GROUP_MEET_REQUESTS_COLLECTION).doc();
    const baseUrl = getGroupMeetBaseUrl(req);
    const createdInvites: Array<{
      ref: FirebaseFirestore.DocumentReference;
      summary: GroupMeetInviteSummary;
      email: string | null;
      participantType: 'host' | 'participant';
      availabilityEntries: ReturnType<typeof normalizeGroupMeetAvailabilitySlots>;
    }> = [];

    const batch = db.batch();
    const totalParticipants = dedupedParticipants.length + 1;
    batch.set(requestRef, {
      title,
      targetMonth,
      deadlineAt: admin.firestore.Timestamp.fromDate(deadline),
      timezone,
      meetingDurationMinutes,
      createdByEmail: adminUser.email,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      participantCount: totalParticipants,
      responseCount: 1,
      status: deadline.getTime() <= Date.now() ? 'closed' : 'collecting',
    });

    const allInviteInputs = [
      {
        ...normalizedHost,
        participantType: 'host' as const,
        sendEmail: false,
      },
      ...dedupedParticipants.map((participant) => ({
        ...participant,
        availabilityEntries: [],
        participantType: 'participant' as const,
        sendEmail: sendEmails,
      })),
    ];

    for (const participant of allInviteInputs) {
      const token = randomBytes(24).toString('hex');
      const shareUrl = buildGroupMeetShareUrl(baseUrl, token);
      const inviteRef = requestRef.collection(GROUP_MEET_INVITES_SUBCOLLECTION).doc(token);
      const emailStatus: GroupMeetInviteSummary['emailStatus'] = participant.email
        ? participant.sendEmail
          ? 'not_sent'
          : 'manual_only'
        : 'no_email';
      const hasResponse = participant.availabilityEntries.length > 0;

      batch.set(inviteRef, {
        token,
        name: participant.name,
        email: participant.email,
        imageUrl: participant.imageUrl,
        participantType: participant.participantType,
        contactId: participant.contactId,
        shareUrl,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        availabilityEntries: participant.availabilityEntries,
        responseSubmittedAt: hasResponse ? admin.firestore.FieldValue.serverTimestamp() : null,
        hasResponse,
        emailStatus,
        emailError: null,
      });

      createdInvites.push({
        ref: inviteRef,
        summary: {
          token,
          name: participant.name,
          email: participant.email,
          imageUrl: participant.imageUrl,
          participantType: participant.participantType,
          contactId: participant.contactId,
          shareUrl,
          emailStatus,
          emailError: null,
          respondedAt: hasResponse ? new Date().toISOString() : null,
          availabilityCount: participant.availabilityEntries.length,
        },
        email: participant.email,
        participantType: participant.participantType,
        availabilityEntries: participant.availabilityEntries,
      });
    }

    await batch.commit();

    if (sendEmails) {
      await Promise.all(
        createdInvites.map(async (invite) => {
          if (!invite.email || invite.participantType === 'host') return;

          const result = await sendGroupMeetInviteEmail({
            requestTitle: title,
            targetMonth,
            deadlineAt: deadline.toISOString(),
            timezone,
            recipientName: invite.summary.name,
            recipientEmail: invite.email,
            shareUrl: invite.summary.shareUrl,
          });

          invite.summary.emailStatus = result.success ? 'sent' : 'failed';
          invite.summary.emailError = result.success ? null : result.error || 'Failed to send';

          await invite.ref.set(
            {
              emailStatus: invite.summary.emailStatus,
              emailError: invite.summary.emailError,
              emailedAt: result.success ? admin.firestore.FieldValue.serverTimestamp() : null,
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            },
            { merge: true }
          );
        })
      );
    }

    const request: GroupMeetRequestSummary = {
      id: requestRef.id,
      title,
      targetMonth,
      deadlineAt: deadline.toISOString(),
      timezone,
      meetingDurationMinutes,
      createdByEmail: adminUser.email,
      createdAt: new Date().toISOString(),
      participantCount: createdInvites.length,
      responseCount: createdInvites.filter((invite) => invite.summary.respondedAt).length,
      status: resolveGroupMeetStatus(deadline.toISOString()),
      invites: createdInvites.map((invite) => invite.summary),
    };

    return res.status(200).json({ request });
  } catch (error: any) {
    console.error('[group-meet-admin] Failed to create request:', error);
    return res.status(500).json({ error: error?.message || 'Failed to create Group Meet request.' });
  }
}
