import type { NextApiRequest, NextApiResponse } from 'next';
import { randomBytes } from 'crypto';
import admin from '../../../../lib/firebase-admin';
import { requireAdminRequest } from '../_auth';
import {
  buildGroupMeetShareUrl,
  resolveGroupMeetStatus,
  type GroupMeetInviteSummary,
  type GroupMeetRequestSummary,
  isValidGroupMeetMonth,
} from '../../../../lib/groupMeet';

const REQUESTS_COLLECTION = 'groupMeetRequests';
const INVITES_SUBCOLLECTION = 'groupMeetInvites';

type ParticipantInput = {
  name?: string;
  email?: string;
};

type CreateGroupMeetRequestBody = {
  title?: string;
  targetMonth?: string;
  deadlineAt?: string;
  timezone?: string;
  meetingDurationMinutes?: number;
  participants?: ParticipantInput[];
  sendEmails?: boolean;
};

const toIso = (value: FirebaseFirestore.Timestamp | null | undefined) =>
  value?.toDate?.().toISOString?.() || null;

const escapeHtml = (input: string) =>
  (input || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

function getBaseUrl(req: NextApiRequest) {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    `${req.headers['x-forwarded-proto'] || 'http'}://${req.headers.host}`
  );
}

function mapInvite(docSnap: FirebaseFirestore.QueryDocumentSnapshot): GroupMeetInviteSummary {
  const data = docSnap.data();
  return {
    token: docSnap.id,
    name: data.name || '',
    email: data.email || null,
    shareUrl: data.shareUrl || '',
    emailStatus: data.emailStatus || 'not_sent',
    emailError: data.emailError || null,
    respondedAt: toIso(data.responseSubmittedAt),
    availabilityCount: Array.isArray(data.availabilityEntries) ? data.availabilityEntries.length : 0,
  };
}

async function mapRequest(docSnap: FirebaseFirestore.QueryDocumentSnapshot): Promise<GroupMeetRequestSummary> {
  const data = docSnap.data();
  const invitesSnapshot = await docSnap.ref.collection(INVITES_SUBCOLLECTION).orderBy('createdAt', 'asc').get();
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

async function listRecentRequests(): Promise<GroupMeetRequestSummary[]> {
  const snapshot = await admin
    .firestore()
    .collection(REQUESTS_COLLECTION)
    .orderBy('createdAt', 'desc')
    .limit(15)
    .get();

  return Promise.all(snapshot.docs.map(mapRequest));
}

async function sendGroupMeetInviteEmail(args: {
  requestTitle: string;
  targetMonth: string;
  deadlineAt: string;
  timezone: string;
  recipientName: string;
  recipientEmail: string;
  shareUrl: string;
}) {
  const apiKey = process.env.BREVO_MARKETING_KEY || process.env.BREVO_API_KEY;
  if (!apiKey) {
    return { success: false, error: 'Brevo not configured' };
  }

  const senderEmail = process.env.BREVO_SENDER_EMAIL || 'tre@fitwithpulse.ai';
  const senderName = process.env.BREVO_SENDER_NAME || 'Pulse';
  const subject = `${args.requestTitle} availability request`;
  const deadlineLabel = new Date(args.deadlineAt).toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: args.timezone,
  });

  const htmlContent = `
    <div style="font: 15px/1.6 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #18181b;">
      <p>Hi ${escapeHtml(args.recipientName || 'there')},</p>
      <p>Please send your availability for <strong>${escapeHtml(args.requestTitle)}</strong>.</p>
      <p>
        Month: <strong>${escapeHtml(args.targetMonth)}</strong><br/>
        Deadline: <strong>${escapeHtml(deadlineLabel)}</strong>
      </p>
      <p>
        Open your link and tap the days that work for you:
      </p>
      <p>
        <a href="${args.shareUrl}" style="display:inline-block;padding:12px 18px;border-radius:10px;background:#18181b;color:#fff;text-decoration:none;font-weight:600;">
          Enter availability
        </a>
      </p>
      <p style="color:#52525b;font-size:13px;">If the button does not work, use this link:<br/>${escapeHtml(args.shareUrl)}</p>
    </div>
  `;

  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'api-key': apiKey,
    },
    body: JSON.stringify({
      sender: { email: senderEmail, name: senderName },
      to: [{ email: args.recipientEmail, name: args.recipientName || args.recipientEmail }],
      subject,
      htmlContent,
      replyTo: { email: senderEmail, name: senderName },
    }),
  });

  if (!response.ok) {
    const errorPayload = await response.json().catch(() => ({}));
    return {
      success: false,
      error: errorPayload?.message || `Brevo error (${response.status})`,
    };
  }

  return { success: true };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const adminUser = await requireAdminRequest(req);
  if (!adminUser) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method === 'GET') {
    try {
      const requests = await listRecentRequests();
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

    const normalizedParticipants = (Array.isArray(body.participants) ? body.participants : [])
      .map((participant) => ({
        name: (participant?.name || '').trim(),
        email: (participant?.email || '').trim().toLowerCase() || null,
      }))
      .filter((participant) => participant.name);

    if (!normalizedParticipants.length) {
      return res.status(400).json({ error: 'Add at least one participant name.' });
    }

    const db = admin.firestore();
    const requestRef = db.collection(REQUESTS_COLLECTION).doc();
    const baseUrl = getBaseUrl(req);
    const createdInvites: Array<{
      ref: FirebaseFirestore.DocumentReference;
      summary: GroupMeetInviteSummary;
      email: string | null;
    }> = [];

    const batch = db.batch();
    batch.set(requestRef, {
      title,
      targetMonth,
      deadlineAt: admin.firestore.Timestamp.fromDate(deadline),
      timezone,
      meetingDurationMinutes,
      createdByEmail: adminUser.email,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      participantCount: normalizedParticipants.length,
      responseCount: 0,
      status: deadline.getTime() <= Date.now() ? 'closed' : 'collecting',
    });

    for (const participant of normalizedParticipants) {
      const token = randomBytes(24).toString('hex');
      const shareUrl = buildGroupMeetShareUrl(baseUrl, token);
      const inviteRef = requestRef.collection(INVITES_SUBCOLLECTION).doc(token);
      const emailStatus: GroupMeetInviteSummary['emailStatus'] = participant.email
        ? sendEmails
          ? 'not_sent'
          : 'manual_only'
        : 'no_email';

      batch.set(inviteRef, {
        token,
        name: participant.name,
        email: participant.email,
        shareUrl,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        availabilityEntries: [],
        responseSubmittedAt: null,
        hasResponse: false,
        emailStatus,
        emailError: null,
      });

      createdInvites.push({
        ref: inviteRef,
        summary: {
          token,
          name: participant.name,
          email: participant.email,
          shareUrl,
          emailStatus,
          emailError: null,
          respondedAt: null,
          availabilityCount: 0,
        },
        email: participant.email,
      });
    }

    await batch.commit();

    if (sendEmails) {
      await Promise.all(
        createdInvites.map(async (invite) => {
          if (!invite.email) return;

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
      responseCount: 0,
      status: resolveGroupMeetStatus(deadline.toISOString()),
      invites: createdInvites.map((invite) => invite.summary),
    };

    return res.status(200).json({ request });
  } catch (error: any) {
    console.error('[group-meet-admin] Failed to create request:', error);
    return res.status(500).json({ error: error?.message || 'Failed to create Group Meet request.' });
  }
}
