import type { NextApiRequest } from 'next';
import admin from './firebase-admin';
import {
  buildGroupMeetShareUrl,
  normalizeGroupMeetAvailabilitySlots,
  resolveGroupMeetStatus,
  type GroupMeetInviteDetail,
  type GroupMeetInviteSummary,
  type GroupMeetRequestSummary,
} from './groupMeet';

export const GROUP_MEET_REQUESTS_COLLECTION = 'groupMeetRequests';
export const GROUP_MEET_INVITES_SUBCOLLECTION = 'groupMeetInvites';

export const toIso = (value: FirebaseFirestore.Timestamp | null | undefined) =>
  value?.toDate?.().toISOString?.() || null;

export function getGroupMeetBaseUrl(req: NextApiRequest) {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    `${req.headers['x-forwarded-proto'] || 'http'}://${req.headers.host}`
  );
}

function escapeHtml(input: string) {
  return (input || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function mapGroupMeetInviteSummary(
  docSnap: FirebaseFirestore.QueryDocumentSnapshot | FirebaseFirestore.DocumentSnapshot
): GroupMeetInviteSummary {
  const data = docSnap.data() || {};
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

export function mapGroupMeetInviteDetail(
  docSnap: FirebaseFirestore.QueryDocumentSnapshot | FirebaseFirestore.DocumentSnapshot,
  targetMonth: string
): GroupMeetInviteDetail {
  const data = docSnap.data() || {};
  const availabilityEntries = normalizeGroupMeetAvailabilitySlots(data.availabilityEntries, targetMonth);
  return {
    token: docSnap.id,
    name: data.name || '',
    email: data.email || null,
    shareUrl: data.shareUrl || '',
    emailStatus: data.emailStatus || 'not_sent',
    emailError: data.emailError || null,
    respondedAt: toIso(data.responseSubmittedAt),
    availabilityCount: availabilityEntries.length,
    availabilityEntries,
  };
}

export async function mapGroupMeetRequestSummary(
  docSnap: FirebaseFirestore.QueryDocumentSnapshot
): Promise<GroupMeetRequestSummary> {
  const data = docSnap.data();
  const invitesSnapshot = await docSnap.ref
    .collection(GROUP_MEET_INVITES_SUBCOLLECTION)
    .orderBy('createdAt', 'asc')
    .get();
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
    invites: invitesSnapshot.docs.map(mapGroupMeetInviteSummary),
  };
}

export async function sendGroupMeetInviteEmail(args: {
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
      <p>Open your link and tap the days that work for you:</p>
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

export async function createGroupMeetInviteRecord(args: {
  requestRef: FirebaseFirestore.DocumentReference;
  name: string;
  email: string | null;
  sendEmails: boolean;
  baseUrl: string;
  createdAt?: FirebaseFirestore.FieldValue;
}) {
  const token = admin.firestore().collection('_').doc().id + admin.firestore().collection('_').doc().id.slice(0, 16);
  const shareUrl = buildGroupMeetShareUrl(args.baseUrl, token);
  const inviteRef = args.requestRef.collection(GROUP_MEET_INVITES_SUBCOLLECTION).doc(token);
  const emailStatus: GroupMeetInviteSummary['emailStatus'] = args.email
    ? args.sendEmails
      ? 'not_sent'
      : 'manual_only'
    : 'no_email';

  return {
    token,
    shareUrl,
    inviteRef,
    emailStatus,
  };
}
