import type { NextApiRequest } from "next";
import admin from "./firebase-admin";
import {
  buildEmailDedupeKey,
  sendBrevoTransactionalEmail,
} from "../../netlify/functions/utils/emailSequenceHelpers";
import {
  buildGroupMeetShareUrl,
  buildGroupMeetFinalSelectionSignature,
  formatMinutesAsTime,
  resolveGroupMeetStatusFromInvites,
  normalizeGroupMeetAvailabilitySlots,
  type GroupMeetCalendarInvite,
  type GroupMeetContact,
  type GroupMeetFinalConfirmationEmail,
  type GroupMeetFinalReminderEmail,
  type GroupMeetFinalSelection,
  type GroupMeetInviteDetail,
  type GroupMeetInviteSummary,
  type GroupMeetRequestSummary,
} from "./groupMeet";
import {
  buildGroupMeetFlexSelectionUrl,
  createGroupMeetFlexActionToken,
  type GroupMeetFlexPromptOption,
} from "./groupMeetFlex";
import {
  buildGroupMeetHostSelectionUrl,
  createGroupMeetHostActionToken,
} from "./groupMeetHostActions";
import { buildGroupMeetGuestCalendarImportSummary } from "./groupMeetGuestGoogleCalendar";
import { computeGroupMeetAiRecommendation } from "./groupMeetWorkflow";

export const GROUP_MEET_REQUESTS_COLLECTION = "groupMeetRequests";
export const GROUP_MEET_INVITES_SUBCOLLECTION = "groupMeetInvites";
export const GROUP_MEET_CONTACTS_COLLECTION = "groupMeetContacts";

export const toIso = (value: FirebaseFirestore.Timestamp | null | undefined) =>
  value?.toDate?.().toISOString?.() || null;

export function getGroupMeetBaseUrl(req: NextApiRequest) {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    `${req.headers["x-forwarded-proto"] || "http"}://${req.headers.host}`
  );
}

export function getGroupMeetConfiguredBaseUrl(explicitBaseUrl?: string | null) {
  return (
    explicitBaseUrl ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.URL ||
    process.env.DEPLOY_PRIME_URL ||
    "https://fitwithpulse.ai"
  ).replace(/\/+$/, "");
}

function escapeHtml(input: string) {
  return (input || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatGroupMeetDate(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return date;
  }

  const [year, month, day] = date.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
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
  const senderEmail = process.env.BREVO_SENDER_EMAIL || "tre@fitwithpulse.ai";
  const senderName = process.env.BREVO_SENDER_NAME || "Pulse";
  return { senderEmail, senderName };
}

export function mapGroupMeetFinalConfirmationEmail(
  data: any,
): GroupMeetFinalConfirmationEmail | null {
  if (!data || typeof data !== "object") {
    return null;
  }

  return {
    sentAt: toIso(data.sentAt),
    sentByEmail: typeof data.sentByEmail === "string" ? data.sentByEmail : null,
    sendMode:
      data.sendMode === "automatic" || data.sendMode === "manual"
        ? data.sendMode
        : null,
    recipientCount: Math.max(0, Number(data.recipientCount) || 0),
    previewSentAt: toIso(data.previewSentAt),
    previewRecipientEmail:
      typeof data.previewRecipientEmail === "string"
        ? data.previewRecipientEmail
        : null,
  };
}

export function mapGroupMeetFinalReminderEmail(
  data: any,
): GroupMeetFinalReminderEmail | null {
  if (!data || typeof data !== "object") {
    return null;
  }

  return {
    sentAt: toIso(data.sentAt),
    sentByEmail: typeof data.sentByEmail === "string" ? data.sentByEmail : null,
    sendMode:
      data.sendMode === "automatic" || data.sendMode === "manual"
        ? data.sendMode
        : null,
    recipientCount: Math.max(0, Number(data.recipientCount) || 0),
    selectionSignature:
      typeof data.selectionSignature === "string"
        ? data.selectionSignature
        : null,
  };
}

function buildGroupMeetRecommendationSignature(
  recommendation: Awaited<
    ReturnType<typeof computeGroupMeetAiRecommendation>
  >["recommendation"],
) {
  const recommendationSignature = recommendation.recommendations
    .slice(0, 3)
    .map(
      (candidate) =>
        `${candidate.candidateKey}:${candidate.participantCount}/${candidate.totalParticipants}`,
    )
    .join("|");

  const caveatSignature = recommendation.caveats.slice(0, 5).join("|");
  return (
    recommendationSignature ||
    `${recommendation.summary}|${caveatSignature}` ||
    "no-recommendations"
  );
}

function buildGroupMeetFinalBlockLabel(args: {
  finalSelection: GroupMeetFinalSelection;
  timezone: string;
}) {
  return formatGroupMeetCandidateLabel({
    date: args.finalSelection.date,
    startMinutes: args.finalSelection.startMinutes,
    endMinutes: args.finalSelection.endMinutes,
    timezone: args.timezone,
  });
}

function buildGroupMeetFinalConfirmationRecipientInvites(
  invites: GroupMeetInviteDetail[],
) {
  return invites.filter(
    (invite) =>
      invite.participantType !== "host" &&
      typeof invite.email === "string" &&
      invite.email.trim().length > 0,
  );
}

function buildGroupMeetParticipantRoster(invites: GroupMeetInviteDetail[]) {
  const hostInvites = invites.filter(
    (invite) => invite.participantType === "host",
  );
  const participantInvites = invites.filter(
    (invite) => invite.participantType !== "host",
  );

  return [...hostInvites, ...participantInvites]
    .map((invite) =>
      invite.participantType === "host" ? `${invite.name} (Host)` : invite.name,
    )
    .filter(Boolean);
}

async function sendSingleGroupMeetFinalConfirmationEmail(args: {
  requestId: string;
  requestTitle: string;
  timezone: string;
  recipientName: string;
  recipientEmail: string;
  finalSelection: GroupMeetFinalSelection;
  calendarInvite: GroupMeetCalendarInvite;
  mode: "automatic" | "manual" | "preview";
  previewIntroText?: string | null;
}) {
  const apiKey = process.env.BREVO_MARKETING_KEY || process.env.BREVO_API_KEY;
  if (!apiKey) {
    return {
      success: false,
      error: "Brevo not configured in runtime env.",
    };
  }

  const { senderEmail, senderName } = getGroupMeetSenderIdentity();
  const internalBcc =
    args.mode === "preview"
      ? undefined
      : [{ email: "info@fitwithpulse.ai", name: "Pulse Info" }];
  const subjectPrefix = args.mode === "preview" ? "[Preview] " : "";
  const subject = `${subjectPrefix}${args.requestTitle}: final meeting time selected`;
  const finalBlockLabel = buildGroupMeetFinalBlockLabel({
    finalSelection: args.finalSelection,
    timezone: args.timezone,
  });
  const previewBanner =
    args.mode === "preview"
      ? `<p style="margin:0 0 14px;padding:12px 14px;border-radius:12px;background:#f4f4f5;color:#18181b;"><strong>Preview email:</strong> this is how the final Group Meet confirmation email will look when it goes out to guests.</p>`
      : "";
  const previewIntroText = (args.previewIntroText || "").trim();
  const introParagraph =
    args.mode === "preview" && previewIntroText
      ? `<p>${escapeHtml(previewIntroText)}</p>`
      : "";
  const hostNoteHtml = args.finalSelection.hostNote
    ? `<p style="margin-top:14px;padding:12px 14px;border-radius:12px;background:#f4f4f5;color:#18181b;"><strong>Host note:</strong> ${escapeHtml(args.finalSelection.hostNote)}</p>`
    : "";
  const meetLinkHtml = args.calendarInvite.meetLink
    ? `
        <p style="margin-top:16px;">
          <a href="${args.calendarInvite.meetLink}" style="display:inline-block;padding:12px 18px;border-radius:10px;background:#18181b;color:#fff;text-decoration:none;font-weight:600;">
            Open Google Meet link
          </a>
        </p>
        <p style="color:#52525b;font-size:13px;">If the button does not work, use this link:<br/>${escapeHtml(args.calendarInvite.meetLink)}</p>
      `
    : "";

  const htmlContent = `
    <div style="font: 15px/1.6 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #18181b;">
      ${previewBanner}
      <p>Hi ${escapeHtml(args.recipientName || "there")},</p>
      ${introParagraph}
      <p>
        Group Meet has successfully selected the final meeting block for
        <strong>${escapeHtml(args.requestTitle)}</strong>.
        Looking forward to hosting you.
      </p>
      <p>
        Final time: <strong>${escapeHtml(finalBlockLabel)}</strong><br/>
        Timezone: <strong>${escapeHtml(args.timezone)}</strong>
      </p>
      <p>
        A Google Calendar invite has been created and sent to
        <strong>${escapeHtml(args.recipientEmail)}</strong>.
        This is a gentle reminder to check your calendar and confirm the meeting details there.
      </p>
      ${hostNoteHtml}
      ${meetLinkHtml}
      <p style="margin-top:14px;color:#52525b;">
        This meeting time was finalized through Group Meet after reviewing the submitted availability.
      </p>
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
    tags: ["group-meet", "group-meet-final-confirmation"],
    idempotencyKey:
      args.mode === "automatic"
        ? buildEmailDedupeKey([
            "group-meet-final-confirmation-v1",
            args.requestId,
            args.recipientEmail.toLowerCase(),
            args.calendarInvite.eventId,
          ])
        : undefined,
    idempotencyMetadata:
      args.mode === "automatic"
        ? {
            requestId: args.requestId,
            recipientEmail: args.recipientEmail.toLowerCase(),
            eventId: args.calendarInvite.eventId,
            mode: args.mode,
          }
        : undefined,
    bypassDailyRecipientLimit: true,
  });

  if (!sendResult.success) {
    return {
      success: false,
      skipped: Boolean(sendResult.skipped),
      error: sendResult.error || "Brevo error",
      messageId: null,
    };
  }

  return {
    success: true,
    skipped: Boolean(sendResult.skipped),
    error: null,
    messageId: sendResult.messageId || null,
  };
}

export async function sendGroupMeetFinalConfirmationEmailBatch(args: {
  requestId: string;
  requestTitle: string;
  timezone: string;
  finalSelection: GroupMeetFinalSelection;
  calendarInvite: GroupMeetCalendarInvite;
  invites: GroupMeetInviteDetail[];
  mode: "automatic" | "manual";
}) {
  const recipients = buildGroupMeetFinalConfirmationRecipientInvites(
    args.invites,
  );
  const results = await Promise.all(
    recipients.map((invite) =>
      sendSingleGroupMeetFinalConfirmationEmail({
        requestId: args.requestId,
        requestTitle: args.requestTitle,
        timezone: args.timezone,
        recipientName: invite.name || "there",
        recipientEmail: invite.email || "",
        finalSelection: args.finalSelection,
        calendarInvite: args.calendarInvite,
        mode: args.mode,
      }),
    ),
  );

  return {
    recipientCount: recipients.length,
    sentCount: results.filter((result) => result.success && !result.skipped)
      .length,
    skippedCount: results.filter((result) => result.success && result.skipped)
      .length,
    failedCount: results.filter((result) => !result.success).length,
    messageIds: results
      .map((result) => result.messageId)
      .filter((value): value is string => Boolean(value)),
    errors: results
      .map((result, index) =>
        result.success || !result.error
          ? null
          : `${recipients[index]?.email || recipients[index]?.name || "Recipient"}: ${result.error}`,
      )
      .filter((value): value is string => Boolean(value)),
  };
}

export async function sendGroupMeetFinalConfirmationPreviewEmail(args: {
  requestId: string;
  requestTitle: string;
  timezone: string;
  finalSelection: GroupMeetFinalSelection;
  calendarInvite: GroupMeetCalendarInvite;
  recipientName: string;
  recipientEmail: string;
}) {
  return sendSingleGroupMeetFinalConfirmationEmail({
    requestId: args.requestId,
    requestTitle: args.requestTitle,
    timezone: args.timezone,
    recipientName: args.recipientName,
    recipientEmail: args.recipientEmail,
    finalSelection: args.finalSelection,
    calendarInvite: args.calendarInvite,
    mode: "preview",
    previewIntroText:
      "The real Google Calendar invite has already been created separately. This preview shows the companion Group Meet confirmation email guests receive right after that happens.",
  });
}

async function sendSingleGroupMeetFinalReminderEmail(args: {
  requestId: string;
  requestTitle: string;
  timezone: string;
  recipientName: string;
  recipientEmail: string;
  finalSelection: GroupMeetFinalSelection;
  calendarInvite: GroupMeetCalendarInvite;
  participantRoster: string[];
  mode: "automatic" | "manual";
}) {
  const apiKey = process.env.BREVO_MARKETING_KEY || process.env.BREVO_API_KEY;
  if (!apiKey) {
    return {
      success: false,
      error: "Brevo not configured in runtime env.",
    };
  }

  const { senderEmail, senderName } = getGroupMeetSenderIdentity();
  const finalBlockLabel = buildGroupMeetFinalBlockLabel({
    finalSelection: args.finalSelection,
    timezone: args.timezone,
  });
  const lineupHtml = args.participantRoster.length
    ? `
        <div style="margin-top:16px;padding:14px 16px;border-radius:14px;background:#f4f4f5;color:#18181b;">
          <div style="font-weight:700;margin-bottom:8px;">Guest lineup</div>
          ${args.participantRoster
            .map(
              (participant) =>
                `<div style="margin:0 0 6px;">• ${escapeHtml(participant)}</div>`,
            )
            .join("")}
        </div>
      `
    : "";
  const meetLinkHtml = args.calendarInvite.meetLink
    ? `
        <p style="margin-top:16px;">
          <a href="${args.calendarInvite.meetLink}" style="display:inline-block;padding:12px 18px;border-radius:10px;background:#18181b;color:#fff;text-decoration:none;font-weight:600;">
            Join Google Meet
          </a>
        </p>
        <p style="color:#52525b;font-size:13px;">If the button does not work, use this link:<br/>${escapeHtml(args.calendarInvite.meetLink)}</p>
      `
    : "";
  const subject = `${args.requestTitle}: starting in 1 hour`;
  const selectionSignature =
    buildGroupMeetFinalSelectionSignature(args.finalSelection) ||
    args.calendarInvite.eventId;
  const htmlContent = `
    <div style="font: 15px/1.6 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #18181b;">
      <p>Hi ${escapeHtml(args.recipientName || "there")},</p>
      <p>
        We are excited to host you in about one hour for
        <strong>${escapeHtml(args.requestTitle)}</strong>.
      </p>
      <p>
        Final meeting time: <strong>${escapeHtml(finalBlockLabel)}</strong><br/>
        Timezone: <strong>${escapeHtml(args.timezone)}</strong>
      </p>
      <p>
        Your Google Calendar invite should already be on your calendar. This is a gentle Group Meet reminder to check the event details and be ready to join.
      </p>
      ${lineupHtml}
      ${meetLinkHtml}
      <p style="margin-top:14px;color:#52525b;">
        This reminder was sent through Group Meet to help the whole group stay on track for the final selected time.
      </p>
    </div>
  `;

  const sendResult = await sendBrevoTransactionalEmail({
    toEmail: args.recipientEmail,
    toName: args.recipientName || args.recipientEmail,
    subject,
    htmlContent,
    sender: { email: senderEmail, name: senderName },
    replyTo: { email: senderEmail, name: senderName },
    bcc: [{ email: "info@fitwithpulse.ai", name: "Pulse Info" }],
    tags: ["group-meet", "group-meet-final-reminder"],
    idempotencyKey:
      args.mode === "automatic"
        ? buildEmailDedupeKey([
            "group-meet-final-reminder-v1",
            args.requestId,
            args.recipientEmail.toLowerCase(),
            selectionSignature,
          ])
        : undefined,
    idempotencyMetadata:
      args.mode === "automatic"
        ? {
            requestId: args.requestId,
            recipientEmail: args.recipientEmail.toLowerCase(),
            selectionSignature,
          }
        : undefined,
    bypassDailyRecipientLimit: true,
  });

  if (!sendResult.success) {
    return {
      success: false,
      skipped: Boolean(sendResult.skipped),
      error: sendResult.error || "Brevo error",
      messageId: null,
    };
  }

  return {
    success: true,
    skipped: Boolean(sendResult.skipped),
    error: null,
    messageId: sendResult.messageId || null,
  };
}

export async function sendGroupMeetFinalReminderEmailBatch(args: {
  requestId: string;
  requestTitle: string;
  timezone: string;
  finalSelection: GroupMeetFinalSelection;
  calendarInvite: GroupMeetCalendarInvite;
  invites: GroupMeetInviteDetail[];
  mode: "automatic" | "manual";
}) {
  const recipients = buildGroupMeetFinalConfirmationRecipientInvites(
    args.invites,
  );
  const participantRoster = buildGroupMeetParticipantRoster(args.invites);
  const results = await Promise.all(
    recipients.map((invite) =>
      sendSingleGroupMeetFinalReminderEmail({
        requestId: args.requestId,
        requestTitle: args.requestTitle,
        timezone: args.timezone,
        recipientName: invite.name || "there",
        recipientEmail: invite.email || "",
        finalSelection: args.finalSelection,
        calendarInvite: args.calendarInvite,
        participantRoster,
        mode: args.mode,
      }),
    ),
  );

  return {
    recipientCount: recipients.length,
    sentCount: results.filter((result) => result.success && !result.skipped)
      .length,
    skippedCount: results.filter((result) => result.success && result.skipped)
      .length,
    failedCount: results.filter((result) => !result.success).length,
    messageIds: results
      .map((result) => result.messageId)
      .filter((value): value is string => Boolean(value)),
    errors: results
      .map((result, index) =>
        result.success || !result.error
          ? null
          : `${recipients[index]?.email || recipients[index]?.name || "Recipient"}: ${result.error}`,
      )
      .filter((value): value is string => Boolean(value)),
  };
}

async function sendGroupMeetHostProgressEmail(args: {
  requestId: string;
  requestTitle: string;
  targetMonth: string;
  timezone: string;
  hostName: string;
  hostEmail: string;
  responderName: string;
  responseAction: "added" | "updated";
  respondedAt: string | null;
  responseCount: number;
  participantCount: number;
  pendingParticipantNames: string[];
}) {
  const { senderEmail, senderName } = getGroupMeetSenderIdentity();
  const pendingLabel = args.pendingParticipantNames.length
    ? args.pendingParticipantNames.join(", ")
    : "No one";
  const subject = `${args.requestTitle}: ${args.responderName} ${args.responseAction} availability`;
  const htmlContent = `
    <div style="font: 15px/1.6 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #18181b;">
      <p>Hi ${escapeHtml(args.hostName || "there")},</p>
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
    tags: ["group-meet", "group-meet-host-progress"],
    idempotencyKey: buildEmailDedupeKey([
      "group-meet-host-progress-v1",
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
  recommendation: Awaited<
    ReturnType<typeof computeGroupMeetAiRecommendation>
  >["recommendation"];
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
        ? `<div style="margin-top:6px;color:#a1a1aa;font-size:13px;">Missing: ${escapeHtml(candidate.missingParticipantNames.join(", "))}</div>`
        : "";
      return `
        <div style="margin:0 0 14px;padding:16px;border-radius:16px;border:1px solid rgba(24,24,27,0.1);background:#fafafa;">
          <div style="font-weight:700;font-size:16px;">${escapeHtml(
            formatGroupMeetCandidateLabel({
              date: candidate.date,
              startMinutes: candidate.startMinutes,
              endMinutes: candidate.endMinutes,
              timezone: args.timezone,
            }),
          )}</div>
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
    .join("");

  const caveatsHtml = args.recommendation.caveats.length
    ? `
        <div style="margin:16px 0 0;padding:14px 16px;border-radius:14px;background:#f4f4f5;color:#3f3f46;">
          ${args.recommendation.caveats.map((caveat) => `<div style="margin:0 0 6px;">• ${escapeHtml(caveat)}</div>`).join("")}
        </div>
      `
    : "";

  const subject = `${args.requestTitle}: everyone added availability`;
  const htmlContent = `
    <div style="font: 15px/1.6 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #18181b;">
      <p>Hi ${escapeHtml(args.hostName || "there")},</p>
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
    tags: ["group-meet", "group-meet-host-complete"],
    idempotencyKey: buildEmailDedupeKey([
      "group-meet-host-complete-v1",
      args.requestId,
      buildGroupMeetRecommendationSignature(args.recommendation),
    ]),
    idempotencyMetadata: {
      requestId: args.requestId,
      generatedAt: args.recommendation.generatedAt,
    },
    bypassDailyRecipientLimit: true,
  });
}

export async function sendGroupMeetFlexPromptEmail(args: {
  requestId: string;
  requestTitle: string;
  targetMonth: string;
  deadlineAt: string | null;
  timezone: string;
  inviteToken: string;
  recipientName: string;
  recipientEmail: string;
  shareUrl: string;
  baseUrl: string;
  options: GroupMeetFlexPromptOption[];
}) {
  const apiKey = process.env.BREVO_MARKETING_KEY || process.env.BREVO_API_KEY;
  if (!apiKey) {
    return {
      success: false,
      error: "Brevo not configured in runtime env.",
    };
  }

  const { senderEmail, senderName } = getGroupMeetSenderIdentity();
  const internalBcc = [{ email: "info@fitwithpulse.ai", name: "Pulse Info" }];
  const deadlineLabel = args.deadlineAt
    ? new Date(args.deadlineAt).toLocaleString("en-US", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: args.timezone,
      })
    : null;
  const optionCards = args.options.slice(0, 3).map((option) => {
    const token = createGroupMeetFlexActionToken({
      requestId: args.requestId,
      inviteToken: args.inviteToken,
      candidateKey: option.candidateKey,
      date: option.date,
      startMinutes: option.startMinutes,
      endMinutes: option.endMinutes,
    });
    return { option, token };
  });

  const htmlOptions = optionCards
    .map(({ option, token }) => {
      const actionUrl = buildGroupMeetFlexSelectionUrl(args.baseUrl, token);
      const label = formatGroupMeetCandidateLabel({
        date: option.date,
        startMinutes: option.startMinutes,
        endMinutes: option.endMinutes,
        timezone: args.timezone,
      });

      return `
        <div style="margin:0 0 14px;padding:16px;border-radius:16px;border:1px solid rgba(24,24,27,0.1);background:#fafafa;">
          <div style="font-weight:700;font-size:16px;">${escapeHtml(label)}</div>
          <div style="margin-top:8px;color:#18181b;font-size:14px;">
            This is one of the strongest remaining options based on the availability already submitted by the group.
          </div>
          <div style="margin-top:12px;color:#52525b;font-size:13px;">
            Works for <strong>${option.participantCount} of ${option.totalParticipants}</strong> participants right now.
          </div>
          <div style="margin-top:14px;">
            <a href="${actionUrl}" style="display:inline-block;padding:12px 16px;border-radius:10px;background:#18181b;color:#fff;text-decoration:none;font-weight:600;">
              I can flex for this time
            </a>
          </div>
          <div style="margin-top:8px;color:#71717a;font-size:12px;line-height:1.5;">
            If the button does not work, open this link: ${escapeHtml(actionUrl)}
          </div>
        </div>
      `;
    })
    .join("");

  const subject = `${args.requestTitle}: can any of these times work for you?`;
  const htmlContent = `
    <div style="font: 15px/1.6 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #18181b;">
      <p>Hi ${escapeHtml(args.recipientName || "there")},</p>
      <p>
        Group Meet found a few strong remaining times for
        <strong>${escapeHtml(args.requestTitle)}</strong>.
        If any of these work for you, tap one and Group Meet will add it to your availability right away.
      </p>
      <p>
        Month: <strong>${escapeHtml(args.targetMonth)}</strong><br/>
        ${deadlineLabel ? `Deadline: <strong>${escapeHtml(deadlineLabel)}</strong><br/>` : ""}
        Timezone: <strong>${escapeHtml(args.timezone)}</strong>
      </p>
      <div style="margin-top:18px;">
        ${htmlOptions}
      </div>
      <p style="margin-top:14px;color:#52525b;">
        Prefer to edit manually instead? Open your Group Meet link here:<br/>
        ${escapeHtml(args.shareUrl)}
      </p>
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
    tags: ["group-meet", "group-meet-flex-round"],
    idempotencyKey: buildEmailDedupeKey([
      "group-meet-flex-prompt-v1",
      args.requestId,
      args.recipientEmail,
      args.options
        .slice(0, 3)
        .map((option) => option.candidateKey)
        .join("|"),
    ]),
    idempotencyMetadata: {
      requestId: args.requestId,
      recipientEmail: args.recipientEmail,
      optionKeys: args.options.slice(0, 3).map((option) => option.candidateKey),
    },
    bypassDailyRecipientLimit: true,
  });

  if (!sendResult.success) {
    return {
      success: false,
      skipped: Boolean(sendResult.skipped),
      error: sendResult.error || "Brevo error",
    };
  }

  return {
    success: true,
    skipped: Boolean(sendResult.skipped),
    messageId: sendResult.messageId || null,
  };
}

export async function sendGroupMeetNoResponseReminderEmail(args: {
  requestId: string;
  requestTitle: string;
  targetMonth: string;
  deadlineAt: string | null;
  timezone: string;
  inviteToken: string;
  recipientName: string;
  recipientEmail: string;
  shareUrl: string;
  baseUrl: string;
  options: GroupMeetFlexPromptOption[];
}) {
  const apiKey = process.env.BREVO_MARKETING_KEY || process.env.BREVO_API_KEY;
  if (!apiKey) {
    return {
      success: false,
      error: "Brevo not configured in runtime env.",
    };
  }

  const { senderEmail, senderName } = getGroupMeetSenderIdentity();
  const internalBcc = [{ email: "info@fitwithpulse.ai", name: "Pulse Info" }];
  const deadlineLabel = args.deadlineAt
    ? new Date(args.deadlineAt).toLocaleString("en-US", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: args.timezone,
      })
    : null;
  const optionCards = args.options.slice(0, 3).map((option) => {
    const token = createGroupMeetFlexActionToken({
      requestId: args.requestId,
      inviteToken: args.inviteToken,
      candidateKey: option.candidateKey,
      date: option.date,
      startMinutes: option.startMinutes,
      endMinutes: option.endMinutes,
    });
    return { option, token };
  });

  const htmlOptions = optionCards
    .map(({ option, token }) => {
      const actionUrl = buildGroupMeetFlexSelectionUrl(args.baseUrl, token);
      const label = formatGroupMeetCandidateLabel({
        date: option.date,
        startMinutes: option.startMinutes,
        endMinutes: option.endMinutes,
        timezone: args.timezone,
      });

      return `
        <div style="margin:0 0 14px;padding:16px;border-radius:16px;border:1px solid rgba(24,24,27,0.1);background:#fafafa;">
          <div style="font-weight:700;font-size:16px;">${escapeHtml(label)}</div>
          <div style="margin-top:8px;color:#18181b;font-size:14px;">
            This is one of the strongest remaining options based on the availability we already have from the group.
          </div>
          <div style="margin-top:12px;color:#52525b;font-size:13px;">
            Works for <strong>${option.participantCount} of ${option.totalParticipants}</strong> participants right now.
          </div>
          <div style="margin-top:14px;">
            <a href="${actionUrl}" style="display:inline-block;padding:12px 16px;border-radius:10px;background:#18181b;color:#fff;text-decoration:none;font-weight:600;">
              This time works for me
            </a>
          </div>
          <div style="margin-top:8px;color:#71717a;font-size:12px;line-height:1.5;">
            If the button does not work, open this link: ${escapeHtml(actionUrl)}
          </div>
        </div>
      `;
    })
    .join("");

  const subject = `${args.requestTitle}: we still need your availability`;
  const htmlContent = `
    <div style="font: 15px/1.6 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #18181b;">
      <p>Hi ${escapeHtml(args.recipientName || "there")},</p>
      <p>
        Group Meet still needs your availability for <strong>${escapeHtml(args.requestTitle)}</strong>.
        To make this easier, here are a few of the strongest times still in play based on what the rest of the group has already submitted.
        If any of these work for you, tap one and Group Meet will add it to your availability right away.
      </p>
      <p>
        Month: <strong>${escapeHtml(args.targetMonth)}</strong><br/>
        ${deadlineLabel ? `Deadline: <strong>${escapeHtml(deadlineLabel)}</strong><br/>` : ""}
        Timezone: <strong>${escapeHtml(args.timezone)}</strong>
      </p>
      <div style="margin-top:18px;">
        ${htmlOptions}
      </div>
      <p style="margin-top:14px;color:#52525b;">
        Prefer to edit manually instead? Open your Group Meet link here:<br/>
        ${escapeHtml(args.shareUrl)}
      </p>
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
    tags: ["group-meet", "group-meet-no-response-reminder"],
    idempotencyKey: buildEmailDedupeKey([
      "group-meet-no-response-reminder-v1",
      args.requestId,
      args.recipientEmail,
      args.options
        .slice(0, 3)
        .map((option) => option.candidateKey)
        .join("|"),
    ]),
    idempotencyMetadata: {
      requestId: args.requestId,
      recipientEmail: args.recipientEmail,
      optionKeys: args.options.slice(0, 3).map((option) => option.candidateKey),
    },
    bypassDailyRecipientLimit: true,
  });

  if (!sendResult.success) {
    return {
      success: false,
      skipped: Boolean(sendResult.skipped),
      error: sendResult.error || "Brevo error",
    };
  }

  return {
    success: true,
    skipped: Boolean(sendResult.skipped),
    messageId: sendResult.messageId || null,
  };
}

export async function sendGroupMeetManualFlexPromptEmail(args: {
  requestId: string;
  requestTitle: string;
  targetMonth: string;
  deadlineAt: string | null;
  timezone: string;
  inviteToken: string;
  recipientName: string;
  recipientEmail: string;
  shareUrl: string;
  baseUrl: string;
  options: GroupMeetFlexPromptOption[];
  strategy: "blocker" | "group_options";
  dispatchKey?: string;
}) {
  const apiKey = process.env.BREVO_MARKETING_KEY || process.env.BREVO_API_KEY;
  if (!apiKey) {
    return {
      success: false,
      error: "Brevo not configured in runtime env.",
    };
  }

  const { senderEmail, senderName } = getGroupMeetSenderIdentity();
  const internalBcc = [{ email: "info@fitwithpulse.ai", name: "Pulse Info" }];
  const deadlineLabel = args.deadlineAt
    ? new Date(args.deadlineAt).toLocaleString("en-US", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: args.timezone,
      })
    : null;
  const optionCards = args.options.slice(0, 3).map((option) => {
    const token = createGroupMeetFlexActionToken({
      requestId: args.requestId,
      inviteToken: args.inviteToken,
      candidateKey: option.candidateKey,
      date: option.date,
      startMinutes: option.startMinutes,
      endMinutes: option.endMinutes,
    });
    return { option, token };
  });

  const introText =
    args.strategy === "blocker"
      ? "These are some of the strongest remaining options, and you are currently one of the people still needed to make them work."
      : "These are the strongest remaining options based on the availability the rest of the group has already submitted.";
  const buttonLabel =
    args.strategy === "blocker"
      ? "I can flex for this time"
      : "This time works for me";

  const htmlOptions = optionCards
    .map(({ option, token }) => {
      const actionUrl = buildGroupMeetFlexSelectionUrl(args.baseUrl, token);
      const label = formatGroupMeetCandidateLabel({
        date: option.date,
        startMinutes: option.startMinutes,
        endMinutes: option.endMinutes,
        timezone: args.timezone,
      });

      return `
        <div style="margin:0 0 14px;padding:16px;border-radius:16px;border:1px solid rgba(24,24,27,0.1);background:#fafafa;">
          <div style="font-weight:700;font-size:16px;">${escapeHtml(label)}</div>
          <div style="margin-top:8px;color:#18181b;font-size:14px;">
            ${escapeHtml(introText)}
          </div>
          <div style="margin-top:12px;color:#52525b;font-size:13px;">
            Works for <strong>${option.participantCount} of ${option.totalParticipants}</strong> participants right now.
          </div>
          <div style="margin-top:14px;">
            <a href="${actionUrl}" style="display:inline-block;padding:12px 16px;border-radius:10px;background:#18181b;color:#fff;text-decoration:none;font-weight:600;">
              ${escapeHtml(buttonLabel)}
            </a>
          </div>
          <div style="margin-top:8px;color:#71717a;font-size:12px;line-height:1.5;">
            If the button does not work, open this link: ${escapeHtml(actionUrl)}
          </div>
        </div>
      `;
    })
    .join("");

  const subject = `${args.requestTitle}: can any of these times work for you?`;
  const htmlContent = `
    <div style="font: 15px/1.6 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #18181b;">
      <p>Hi ${escapeHtml(args.recipientName || "there")},</p>
      <p>
        We’re trying to lock in <strong>${escapeHtml(args.requestTitle)}</strong>.
        To make this easier, here are a few strong remaining times based on what the group has already submitted.
        If any of these work for you, tap one and Group Meet will add it to your availability right away.
      </p>
      <p>
        Month: <strong>${escapeHtml(args.targetMonth)}</strong><br/>
        ${deadlineLabel ? `Deadline: <strong>${escapeHtml(deadlineLabel)}</strong><br/>` : ""}
        Timezone: <strong>${escapeHtml(args.timezone)}</strong>
      </p>
      <div style="margin-top:18px;">
        ${htmlOptions}
      </div>
      <p style="margin-top:14px;color:#52525b;">
        Prefer to edit manually instead? Open your Group Meet link here:<br/>
        ${escapeHtml(args.shareUrl)}
      </p>
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
    tags: ["group-meet", "group-meet-manual-flex"],
    idempotencyKey: buildEmailDedupeKey([
      "group-meet-manual-flex-v1",
      args.requestId,
      args.recipientEmail,
      args.options
        .slice(0, 3)
        .map((option) => option.candidateKey)
        .join("|"),
      args.dispatchKey || "default",
    ]),
    idempotencyMetadata: {
      requestId: args.requestId,
      recipientEmail: args.recipientEmail,
      strategy: args.strategy,
      optionKeys: args.options.slice(0, 3).map((option) => option.candidateKey),
    },
    bypassDailyRecipientLimit: true,
  });

  if (!sendResult.success) {
    return {
      success: false,
      skipped: Boolean(sendResult.skipped),
      error: sendResult.error || "Brevo error",
    };
  }

  return {
    success: true,
    skipped: Boolean(sendResult.skipped),
    messageId: sendResult.messageId || null,
  };
}

export function mapGroupMeetInviteSummary(
  docSnap:
    | FirebaseFirestore.QueryDocumentSnapshot
    | FirebaseFirestore.DocumentSnapshot,
): GroupMeetInviteSummary {
  const data = docSnap.data() || {};
  return {
    token: docSnap.id,
    name: data.name || "",
    email: data.email || null,
    imageUrl: data.imageUrl || null,
    participantType: data.participantType === "host" ? "host" : "participant",
    contactId: data.contactId || null,
    shareUrl: data.shareUrl || "",
    emailStatus: data.emailStatus || "not_sent",
    emailedAt: toIso(data.emailedAt),
    calendarImport: buildGroupMeetGuestCalendarImportSummary(
      data.calendarImport,
    ),
    emailError: data.emailError || null,
    respondedAt: toIso(data.responseSubmittedAt),
    availabilityCount: Array.isArray(data.availabilityEntries)
      ? data.availabilityEntries.length
      : 0,
  };
}

export function mapGroupMeetInviteDetail(
  docSnap:
    | FirebaseFirestore.QueryDocumentSnapshot
    | FirebaseFirestore.DocumentSnapshot,
  targetMonth: string,
): GroupMeetInviteDetail {
  const data = docSnap.data() || {};
  const availabilityEntries = normalizeGroupMeetAvailabilitySlots(
    data.availabilityEntries,
    targetMonth,
  );
  return {
    token: docSnap.id,
    name: data.name || "",
    email: data.email || null,
    imageUrl: data.imageUrl || null,
    participantType: data.participantType === "host" ? "host" : "participant",
    contactId: data.contactId || null,
    shareUrl: data.shareUrl || "",
    emailStatus: data.emailStatus || "not_sent",
    emailedAt: toIso(data.emailedAt),
    calendarImport: buildGroupMeetGuestCalendarImportSummary(
      data.calendarImport,
    ),
    emailError: data.emailError || null,
    respondedAt: toIso(data.responseSubmittedAt),
    availabilityCount: availabilityEntries.length,
    availabilityEntries,
  };
}

export function mapGroupMeetContact(
  docSnap:
    | FirebaseFirestore.QueryDocumentSnapshot
    | FirebaseFirestore.DocumentSnapshot,
): GroupMeetContact {
  const data = docSnap.data() || {};
  return {
    id: docSnap.id,
    name: data.name || "",
    email: data.email || null,
    imageUrl: data.imageUrl || null,
    createdAt: toIso(data.createdAt),
    updatedAt: toIso(data.updatedAt),
    createdByEmail: data.createdByEmail || null,
  };
}

export async function mapGroupMeetRequestSummary(
  docSnap: FirebaseFirestore.QueryDocumentSnapshot,
): Promise<GroupMeetRequestSummary> {
  const data = docSnap.data();
  const invitesSnapshot = await docSnap.ref
    .collection(GROUP_MEET_INVITES_SUBCOLLECTION)
    .orderBy("createdAt", "asc")
    .get();
  const deadlineAt = toIso(data.deadlineAt);
  const invites = invitesSnapshot.docs.map(mapGroupMeetInviteSummary);

  return {
    id: docSnap.id,
    title: data.title || "Group Meet",
    targetMonth: data.targetMonth || "",
    deadlineAt,
    timezone: data.timezone || "America/New_York",
    meetingDurationMinutes: Number(data.meetingDurationMinutes) || 30,
    createdByEmail: data.createdByEmail || null,
    createdAt: toIso(data.createdAt),
    participantCount: Number(data.participantCount) || invitesSnapshot.size,
    responseCount: Number(data.responseCount) || 0,
    status: resolveGroupMeetStatusFromInvites(
      deadlineAt,
      data.status,
      invites,
      {
        finalSelection: data.finalSelection || null,
        calendarInvite: data.calendarInvite || null,
      },
    ),
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
  mode?: "live" | "test" | "preview";
  bypassDeliveryGuards?: boolean;
}) {
  const apiKey = process.env.BREVO_MARKETING_KEY || process.env.BREVO_API_KEY;
  if (!apiKey) {
    return {
      success: false,
      error: "Brevo not configured in runtime env.",
    };
  }

  const mode = args.mode || "live";
  const bypassDeliveryGuards = Boolean(
    args.bypassDeliveryGuards || mode === "preview" || mode === "test",
  );
  const senderEmail = process.env.BREVO_SENDER_EMAIL || "tre@fitwithpulse.ai";
  const senderName = process.env.BREVO_SENDER_NAME || "Pulse";
  const internalBcc =
    mode === "live"
      ? [{ email: "info@fitwithpulse.ai", name: "Pulse Info" }]
      : undefined;
  const subject =
    mode === "test"
      ? `[Test] ${args.requestTitle} availability request`
      : mode === "preview"
        ? `[Preview] ${args.requestTitle} availability request`
        : `${args.requestTitle} availability request`;
  const deadlineLabel = new Date(args.deadlineAt).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: args.timezone,
  });
  const introHtml =
    mode === "test"
      ? `<p style="margin:0 0 14px;padding:12px 14px;border-radius:12px;background:#f4f4f5;color:#18181b;"><strong>Test email:</strong> this is a standalone Group Meet delivery preview. The button below is only for previewing the email experience.</p>`
      : mode === "preview"
        ? `<p style="margin:0 0 14px;padding:12px 14px;border-radius:12px;background:#f4f4f5;color:#18181b;"><strong>Preview email:</strong> this message uses a real Group Meet guest link so you can walk through the recipient experience before sending the full batch.</p>`
        : "";
  const promptCopy =
    mode === "test"
      ? "This is how a Group Meet invite email will look when you send a real request."
      : mode === "preview"
        ? "This preview opens the real guest scheduling flow for the selected participant."
        : `Please send your availability for <strong>${escapeHtml(args.requestTitle)}</strong>.`;
  const buttonLabel =
    mode === "test"
      ? "Open Group Meet admin"
      : mode === "preview"
        ? "Open guest link"
        : "Enter availability";
  const footerCopy =
    mode === "test"
      ? "Because this is only a test email, the button routes back to the internal Group Meet tool."
      : mode === "preview"
        ? "Because this is a preview email, the button opens the selected participant link directly."
        : "If the button does not work, use this link:";

  const htmlContent = `
    <div style="font: 15px/1.6 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #18181b;">
      ${introHtml}
      <p>Hi ${escapeHtml(args.recipientName || "there")},</p>
      <p>${promptCopy}</p>
      <p>
        Month: <strong>${escapeHtml(args.targetMonth)}</strong><br/>
        Deadline: <strong>${escapeHtml(deadlineLabel)}</strong>
      </p>
      <p>${mode === "test" ? "Open the internal tool preview here:" : "Open your link and tap the days that work for you:"}</p>
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
          "group-meet-invite-v1",
          args.shareUrl,
          args.recipientEmail,
          mode,
        ]),
    idempotencyMetadata: bypassDeliveryGuards
      ? undefined
      : {
          sequence: "group-meet-invite",
          shareUrl: args.shareUrl,
          recipientEmail: args.recipientEmail,
          mode,
        },
    bypassDailyRecipientLimit: bypassDeliveryGuards,
    dailyRecipientLimit: mode === "test" ? 2 : 1,
    dailyRecipientMetadata: bypassDeliveryGuards
      ? undefined
      : {
          sequence: "group-meet-invite",
          shareUrl: args.shareUrl,
          mode,
        },
  });

  if (!sendResult.success) {
    return {
      success: false,
      error: sendResult.error || "Brevo error",
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
  const token =
    admin.firestore().collection("_").doc().id +
    admin.firestore().collection("_").doc().id.slice(0, 16);
  const shareUrl = buildGroupMeetShareUrl(args.baseUrl, token);
  const inviteRef = args.requestRef
    .collection(GROUP_MEET_INVITES_SUBCOLLECTION)
    .doc(token);
  const emailStatus: GroupMeetInviteSummary["emailStatus"] = args.email
    ? args.sendEmails
      ? "not_sent"
      : "manual_only"
    : "no_email";

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
  responseAction: "added" | "updated";
  baseUrl: string;
}) {
  const responder =
    args.invites.find((invite) => invite.token === args.responderToken) || null;
  const hostInvite =
    args.invites.find(
      (invite) => invite.participantType === "host" && invite.email,
    ) || null;

  if (!responder || !hostInvite || responder.participantType === "host") {
    return { notified: false, mode: null };
  }

  if (!responder.respondedAt && !responder.availabilityEntries.length) {
    return { notified: false, mode: null };
  }

  const participantCount = Math.max(
    1,
    Number(args.requestData.participantCount) || args.invites.length,
  );
  const responseCount = args.invites.filter(
    (invite) => invite.respondedAt || invite.availabilityEntries.length > 0,
  ).length;
  const pendingParticipantNames = args.invites
    .filter(
      (invite) =>
        invite.token !== hostInvite.token && invite.token !== responder.token,
    )
    .filter(
      (invite) => !invite.respondedAt && !invite.availabilityEntries.length,
    )
    .map((invite) => invite.name || "Unknown");

  if (responseCount >= participantCount) {
    const { recommendation } = await computeGroupMeetAiRecommendation({
      requestTitle: args.requestData.title || "Group Meet",
      targetMonth: args.requestData.targetMonth || "",
      meetingDurationMinutes:
        Number(args.requestData.meetingDurationMinutes) || 30,
      invites: args.invites,
      allowFallback: true,
    });

    await args.requestRef.set(
      {
        aiRecommendation: recommendation,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        aiRecommendationGeneratedByEmail: "group-meet-host-notifier",
      },
      { merge: true },
    );

    const sendResult = await sendGroupMeetHostCompletionEmail({
      requestId: args.requestId,
      requestTitle: args.requestData.title || "Group Meet",
      targetMonth: args.requestData.targetMonth || "",
      timezone: args.requestData.timezone || "America/New_York",
      hostName: hostInvite.name || "Host",
      hostEmail: hostInvite.email || "",
      baseUrl: args.baseUrl,
      recommendation,
    });

    if (sendResult.success && !sendResult.skipped) {
      await args.requestRef.set(
        {
          hostAllRespondedEmailSentAt:
            admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    }

    return {
      notified: Boolean(sendResult.success),
      mode: "completion" as const,
      skipped: Boolean(sendResult.skipped),
      recommendation,
    };
  }

  const sendResult = await sendGroupMeetHostProgressEmail({
    requestId: args.requestId,
    requestTitle: args.requestData.title || "Group Meet",
    targetMonth: args.requestData.targetMonth || "",
    timezone: args.requestData.timezone || "America/New_York",
    hostName: hostInvite.name || "Host",
    hostEmail: hostInvite.email || "",
    responderName: responder.name || "A guest",
    responseAction: args.responseAction,
    respondedAt: responder.respondedAt,
    responseCount,
    participantCount,
    pendingParticipantNames,
  });

  if (sendResult.success && !sendResult.skipped) {
    await args.requestRef.set(
      {
        hostLastAvailabilityEmailSentAt:
          admin.firestore.FieldValue.serverTimestamp(),
        hostLastAvailabilityResponderToken: responder.token,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  }

  return {
    notified: Boolean(sendResult.success),
    mode: "progress" as const,
    skipped: Boolean(sendResult.skipped),
  };
}
