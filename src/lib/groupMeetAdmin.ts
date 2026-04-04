import type { NextApiRequest } from 'next';
import admin from './firebase-admin';
import { buildEmailDedupeKey, sendBrevoTransactionalEmail } from '../../netlify/functions/utils/emailSequenceHelpers';
import {
  buildGroupMeetShareUrl,
  normalizeGroupMeetAvailabilitySlots,
  resolveGroupMeetStatus,
  type GroupMeetContact,
  type GroupMeetInviteDetail,
  type GroupMeetInviteSummary,
  type GroupMeetRequestSummary,
} from './groupMeet';

export const GROUP_MEET_REQUESTS_COLLECTION = 'groupMeetRequests';
export const GROUP_MEET_INVITES_SUBCOLLECTION = 'groupMeetInvites';
export const GROUP_MEET_CONTACTS_COLLECTION = 'groupMeetContacts';

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
    imageUrl: data.imageUrl || null,
    participantType: data.participantType === 'host' ? 'host' : 'participant',
    contactId: data.contactId || null,
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
    imageUrl: data.imageUrl || null,
    participantType: data.participantType === 'host' ? 'host' : 'participant',
    contactId: data.contactId || null,
    shareUrl: data.shareUrl || '',
    emailStatus: data.emailStatus || 'not_sent',
    emailError: data.emailError || null,
    respondedAt: toIso(data.responseSubmittedAt),
    availabilityCount: availabilityEntries.length,
    availabilityEntries,
  };
}

export function mapGroupMeetContact(
  docSnap: FirebaseFirestore.QueryDocumentSnapshot | FirebaseFirestore.DocumentSnapshot
): GroupMeetContact {
  const data = docSnap.data() || {};
  return {
    id: docSnap.id,
    name: data.name || '',
    email: data.email || null,
    imageUrl: data.imageUrl || null,
    createdAt: toIso(data.createdAt),
    updatedAt: toIso(data.updatedAt),
    createdByEmail: data.createdByEmail || null,
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
    status: resolveGroupMeetStatus(deadlineAt, data.status),
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
  mode?: 'live' | 'test' | 'preview';
  bypassDeliveryGuards?: boolean;
}) {
  const apiKey = process.env.BREVO_MARKETING_KEY || process.env.BREVO_API_KEY;
  if (!apiKey) {
    return {
      success: false,
      error: 'Brevo not configured in runtime env.',
    };
  }

  const mode = args.mode || 'live';
  const bypassDeliveryGuards = Boolean(
    args.bypassDeliveryGuards || mode === 'preview' || mode === 'test'
  );
  const senderEmail = process.env.BREVO_SENDER_EMAIL || 'tre@fitwithpulse.ai';
  const senderName = process.env.BREVO_SENDER_NAME || 'Pulse';
  const internalBcc =
    mode === 'live'
      ? [{ email: 'info@fitwithpulse.ai', name: 'Pulse Info' }]
      : undefined;
  const subject =
    mode === 'test'
      ? `[Test] ${args.requestTitle} availability request`
      : mode === 'preview'
        ? `[Preview] ${args.requestTitle} availability request`
        : `${args.requestTitle} availability request`;
  const deadlineLabel = new Date(args.deadlineAt).toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: args.timezone,
  });
  const introHtml =
    mode === 'test'
      ? `<p style="margin:0 0 14px;padding:12px 14px;border-radius:12px;background:#f4f4f5;color:#18181b;"><strong>Test email:</strong> this is a standalone Group Meet delivery preview. The button below is only for previewing the email experience.</p>`
      : mode === 'preview'
        ? `<p style="margin:0 0 14px;padding:12px 14px;border-radius:12px;background:#f4f4f5;color:#18181b;"><strong>Preview email:</strong> this message uses a real Group Meet guest link so you can walk through the recipient experience before sending the full batch.</p>`
      : '';
  const promptCopy =
    mode === 'test'
      ? 'This is how a Group Meet invite email will look when you send a real request.'
      : mode === 'preview'
        ? 'This preview opens the real guest scheduling flow for the selected participant.'
      : `Please send your availability for <strong>${escapeHtml(args.requestTitle)}</strong>.`;
  const buttonLabel =
    mode === 'test'
      ? 'Open Group Meet admin'
      : mode === 'preview'
        ? 'Open guest link'
        : 'Enter availability';
  const footerCopy =
    mode === 'test'
      ? 'Because this is only a test email, the button routes back to the internal Group Meet tool.'
      : mode === 'preview'
        ? 'Because this is a preview email, the button opens the selected participant link directly.'
      : 'If the button does not work, use this link:';

  const htmlContent = `
    <div style="font: 15px/1.6 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #18181b;">
      ${introHtml}
      <p>Hi ${escapeHtml(args.recipientName || 'there')},</p>
      <p>${promptCopy}</p>
      <p>
        Month: <strong>${escapeHtml(args.targetMonth)}</strong><br/>
        Deadline: <strong>${escapeHtml(deadlineLabel)}</strong>
      </p>
      <p>${mode === 'test' ? 'Open the internal tool preview here:' : 'Open your link and tap the days that work for you:'}</p>
      <p>
        <a href="${args.shareUrl}" style="display:inline-block;padding:12px 18px;border-radius:10px;background:#18181b;color:#fff;text-decoration:none;font-weight:600;">
          ${buttonLabel}
        </a>
      </p>
      <p style="color:#52525b;font-size:13px;">${footerCopy}<br/>${escapeHtml(args.shareUrl)}</p>
    </div>
  `;

  const sendResult = await sendBrevoTransactionalEmail({
    toEmail: args.recipientEmail,
    toName: args.recipientName || args.recipientEmail,
    subject,
    htmlContent,
    sender: { email: senderEmail, name: senderName },
    replyTo: { email: senderEmail, name: senderName },
    bcc: internalBcc,
    idempotencyKey: bypassDeliveryGuards
      ? undefined
      : buildEmailDedupeKey([
          'group-meet-invite-v1',
          args.shareUrl,
          args.recipientEmail,
          mode,
        ]),
    idempotencyMetadata: bypassDeliveryGuards
      ? undefined
      : {
          sequence: 'group-meet-invite',
          shareUrl: args.shareUrl,
          recipientEmail: args.recipientEmail,
          mode,
        },
    bypassDailyRecipientLimit: bypassDeliveryGuards,
    dailyRecipientLimit: mode === 'test' ? 2 : 1,
    dailyRecipientMetadata: bypassDeliveryGuards
      ? undefined
      : {
          sequence: 'group-meet-invite',
          shareUrl: args.shareUrl,
          mode,
        },
  });

  if (!sendResult.success) {
    return {
      success: false,
      error: sendResult.error || 'Brevo error',
    };
  }

  return {
    success: true,
    skipped: Boolean(sendResult.skipped),
    messageId: sendResult.messageId || null,
  };
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
