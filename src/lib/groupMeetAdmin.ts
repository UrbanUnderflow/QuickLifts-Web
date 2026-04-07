import type { NextApiRequest } from 'next';
import admin from './firebase-admin';
import { buildEmailDedupeKey, sendBrevoTransactionalEmail } from '../../netlify/functions/utils/emailSequenceHelpers';
import {
  buildGroupMeetShareUrl,
  formatMinutesAsTime,
  resolveGroupMeetStatusFromInvites,
  normalizeGroupMeetAvailabilitySlots,
  type GroupMeetContact,
  type GroupMeetInviteDetail,
  type GroupMeetInviteSummary,
  type GroupMeetRequestSummary,
} from './groupMeet';
import { buildGroupMeetHostSelectionUrl, createGroupMeetHostActionToken } from './groupMeetHostActions';
import { buildGroupMeetGuestCalendarImportSummary } from './groupMeetGuestGoogleCalendar';
import { computeGroupMeetAiRecommendation } from './groupMeetWorkflow';

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

function formatGroupMeetDate(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return date;
  }

  const [year, month, day] = date.split('-').map(Number);
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, (month || 1) - 1, day || 1, 12, 0, 0)));
}

function formatGroupMeetCandidateLabel(args: {
  date: string;
  startMinutes: number;
  endMinutes: number;
  timezone: string;
}) {
  return `${formatGroupMeetDate(args.date)} • ${formatMinutesAsTime(args.startMinutes)} - ${formatMinutesAsTime(args.endMinutes)} (${args.timezone})`;
}

function getGroupMeetSenderIdentity() {
  const senderEmail = process.env.BREVO_SENDER_EMAIL || 'tre@fitwithpulse.ai';
  const senderName = process.env.BREVO_SENDER_NAME || 'Pulse';
  return { senderEmail, senderName };
}

async function sendGroupMeetHostProgressEmail(args: {
  requestId: string;
  requestTitle: string;
  targetMonth: string;
  timezone: string;
  hostName: string;
  hostEmail: string;
  responderName: string;
  responseAction: 'added' | 'updated';
  respondedAt: string | null;
  responseCount: number;
  participantCount: number;
  pendingParticipantNames: string[];
}) {
  const { senderEmail, senderName } = getGroupMeetSenderIdentity();
  const pendingLabel = args.pendingParticipantNames.length
    ? args.pendingParticipantNames.join(', ')
    : 'No one';
  const subject = `${args.requestTitle}: ${args.responderName} ${args.responseAction} availability`;
  const htmlContent = `
    <div style="font: 15px/1.6 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #18181b;">
      <p>Hi ${escapeHtml(args.hostName || 'there')},</p>
      <p><strong>${escapeHtml(args.responderName)}</strong> just ${escapeHtml(args.responseAction)} availability for <strong>${escapeHtml(args.requestTitle)}</strong>.</p>
      <p>
        Responses so far: <strong>${args.responseCount} of ${args.participantCount}</strong><br/>
        Target month: <strong>${escapeHtml(args.targetMonth)}</strong>
      </p>
      <p style="margin:0 0 10px;"><strong>Still waiting on:</strong></p>
      <p style="margin:0;color:#52525b;">${escapeHtml(pendingLabel)}</p>
      <p style="margin-top:16px;color:#52525b;">Once everyone has replied, Group Meet will send you a follow-up email with recommended meeting windows you can choose from directly.</p>
    </div>
  `;

  return sendBrevoTransactionalEmail({
    toEmail: args.hostEmail,
    toName: args.hostName || args.hostEmail,
    subject,
    htmlContent,
    sender: { email: senderEmail, name: senderName },
    replyTo: { email: senderEmail, name: senderName },
    tags: ['group-meet', 'group-meet-host-progress'],
    idempotencyKey: buildEmailDedupeKey([
      'group-meet-host-progress-v1',
      args.requestId,
      args.responderName,
      args.responseAction,
      args.respondedAt || `${args.responseCount}/${args.participantCount}`,
    ]),
    idempotencyMetadata: {
      requestId: args.requestId,
      responderName: args.responderName,
      responseAction: args.responseAction,
      responseCount: args.responseCount,
      participantCount: args.participantCount,
    },
    bypassDailyRecipientLimit: true,
  });
}

async function sendGroupMeetHostCompletionEmail(args: {
  requestId: string;
  requestTitle: string;
  targetMonth: string;
  timezone: string;
  hostName: string;
  hostEmail: string;
  baseUrl: string;
  recommendation: Awaited<ReturnType<typeof computeGroupMeetAiRecommendation>>['recommendation'];
}) {
  const { senderEmail, senderName } = getGroupMeetSenderIdentity();
  const recommendationCards = args.recommendation.recommendations
    .slice(0, 3)
    .map((candidate) => {
      const token = createGroupMeetHostActionToken({
        requestId: args.requestId,
        candidateKey: candidate.candidateKey,
      });
      const actionUrl = buildGroupMeetHostSelectionUrl(args.baseUrl, token);
      const missingLabel = candidate.missingParticipantNames.length
        ? `<div style="margin-top:6px;color:#a1a1aa;font-size:13px;">Missing: ${escapeHtml(candidate.missingParticipantNames.join(', '))}</div>`
        : '';
      return `
        <div style="margin:0 0 14px;padding:16px;border-radius:16px;border:1px solid rgba(24,24,27,0.1);background:#fafafa;">
          <div style="font-weight:700;font-size:16px;">${escapeHtml(formatGroupMeetCandidateLabel({
            date: candidate.date,
            startMinutes: candidate.startMinutes,
            endMinutes: candidate.endMinutes,
            timezone: args.timezone,
          }))}</div>
          <div style="margin-top:6px;color:#52525b;font-size:14px;">${escapeHtml(candidate.reason)}</div>
          <div style="margin-top:8px;color:#18181b;font-size:14px;">
            Works for <strong>${candidate.participantCount} of ${candidate.totalParticipants}</strong> participants
          </div>
          ${missingLabel}
          <div style="margin-top:14px;">
            <a href="${actionUrl}" style="display:inline-block;padding:12px 16px;border-radius:10px;background:#18181b;color:#fff;text-decoration:none;font-weight:600;">
              Select this meeting time
            </a>
          </div>
          <div style="margin-top:8px;color:#71717a;font-size:12px;line-height:1.5;">
            If the button does not work, open this link: ${escapeHtml(actionUrl)}
          </div>
        </div>
      `;
    })
    .join('');

  const caveatsHtml = args.recommendation.caveats.length
    ? `
        <div style="margin:16px 0 0;padding:14px 16px;border-radius:14px;background:#f4f4f5;color:#3f3f46;">
          ${args.recommendation.caveats.map((caveat) => `<div style="margin:0 0 6px;">• ${escapeHtml(caveat)}</div>`).join('')}
        </div>
      `
    : '';

  const subject = `${args.requestTitle}: everyone added availability`;
  const htmlContent = `
    <div style="font: 15px/1.6 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #18181b;">
      <p>Hi ${escapeHtml(args.hostName || 'there')},</p>
      <p>Everyone has now added availability for <strong>${escapeHtml(args.requestTitle)}</strong>.</p>
      <p>
        Target month: <strong>${escapeHtml(args.targetMonth)}</strong><br/>
        Timezone: <strong>${escapeHtml(args.timezone)}</strong>
      </p>
      <p style="margin:16px 0 0;"><strong>Recommended windows</strong></p>
      <p style="margin:6px 0 0;color:#52525b;">${escapeHtml(args.recommendation.summary)}</p>
      ${caveatsHtml}
      <div style="margin-top:18px;">
        ${recommendationCards}
      </div>
      <p style="margin-top:14px;color:#52525b;">Click one option above and Group Meet will finalize the time, create the calendar invite, and send it out to the attendees.</p>
    </div>
  `;

  return sendBrevoTransactionalEmail({
    toEmail: args.hostEmail,
    toName: args.hostName || args.hostEmail,
    subject,
    htmlContent,
    sender: { email: senderEmail, name: senderName },
    replyTo: { email: senderEmail, name: senderName },
    tags: ['group-meet', 'group-meet-host-complete'],
    idempotencyKey: buildEmailDedupeKey([
      'group-meet-host-complete-v1',
      args.requestId,
      'all-responded',
    ]),
    idempotencyMetadata: {
      requestId: args.requestId,
      generatedAt: args.recommendation.generatedAt,
    },
    bypassDailyRecipientLimit: true,
  });
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
    emailedAt: toIso(data.emailedAt),
    calendarImport: buildGroupMeetGuestCalendarImportSummary(data.calendarImport),
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
    emailedAt: toIso(data.emailedAt),
    calendarImport: buildGroupMeetGuestCalendarImportSummary(data.calendarImport),
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
  const invites = invitesSnapshot.docs.map(mapGroupMeetInviteSummary);

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
    status: resolveGroupMeetStatusFromInvites(deadlineAt, data.status, invites),
    invites,
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

export async function maybeNotifyGroupMeetHostAfterAvailabilitySave(args: {
  requestRef: FirebaseFirestore.DocumentReference;
  requestId: string;
  requestData: FirebaseFirestore.DocumentData;
  invites: GroupMeetInviteDetail[];
  responderToken: string;
  responseAction: 'added' | 'updated';
  baseUrl: string;
}) {
  const responder = args.invites.find((invite) => invite.token === args.responderToken) || null;
  const hostInvite =
    args.invites.find((invite) => invite.participantType === 'host' && invite.email) || null;

  if (!responder || !hostInvite || responder.participantType === 'host') {
    return { notified: false, mode: null };
  }

  if (!responder.respondedAt && !responder.availabilityEntries.length) {
    return { notified: false, mode: null };
  }

  const participantCount = Math.max(1, Number(args.requestData.participantCount) || args.invites.length);
  const responseCount = args.invites.filter((invite) => invite.respondedAt || invite.availabilityEntries.length > 0).length;
  const pendingParticipantNames = args.invites
    .filter((invite) => invite.token !== hostInvite.token && invite.token !== responder.token)
    .filter((invite) => !invite.respondedAt && !invite.availabilityEntries.length)
    .map((invite) => invite.name || 'Unknown');

  if (responseCount >= participantCount) {
    const { recommendation } = await computeGroupMeetAiRecommendation({
      requestTitle: args.requestData.title || 'Group Meet',
      targetMonth: args.requestData.targetMonth || '',
      meetingDurationMinutes: Number(args.requestData.meetingDurationMinutes) || 30,
      invites: args.invites,
      allowFallback: true,
    });

    await args.requestRef.set(
      {
        aiRecommendation: recommendation,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        aiRecommendationGeneratedByEmail: 'group-meet-host-notifier',
      },
      { merge: true }
    );

    const sendResult = await sendGroupMeetHostCompletionEmail({
      requestId: args.requestId,
      requestTitle: args.requestData.title || 'Group Meet',
      targetMonth: args.requestData.targetMonth || '',
      timezone: args.requestData.timezone || 'America/New_York',
      hostName: hostInvite.name || 'Host',
      hostEmail: hostInvite.email || '',
      baseUrl: args.baseUrl,
      recommendation,
    });

    if (sendResult.success && !sendResult.skipped) {
      await args.requestRef.set(
        {
          hostAllRespondedEmailSentAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    }

    return {
      notified: Boolean(sendResult.success),
      mode: 'completion' as const,
      skipped: Boolean(sendResult.skipped),
      recommendation,
    };
  }

  const sendResult = await sendGroupMeetHostProgressEmail({
    requestId: args.requestId,
    requestTitle: args.requestData.title || 'Group Meet',
    targetMonth: args.requestData.targetMonth || '',
    timezone: args.requestData.timezone || 'America/New_York',
    hostName: hostInvite.name || 'Host',
    hostEmail: hostInvite.email || '',
    responderName: responder.name || 'A guest',
    responseAction: args.responseAction,
    respondedAt: responder.respondedAt,
    responseCount,
    participantCount,
    pendingParticipantNames,
  });

  if (sendResult.success && !sendResult.skipped) {
    await args.requestRef.set(
      {
        hostLastAvailabilityEmailSentAt: admin.firestore.FieldValue.serverTimestamp(),
        hostLastAvailabilityResponderToken: responder.token,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  }

  return {
    notified: Boolean(sendResult.success),
    mode: 'progress' as const,
    skipped: Boolean(sendResult.skipped),
  };
}
