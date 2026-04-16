import type { Handler } from '@netlify/functions';
import {
  escapeHtml,
  getBaseSiteUrl,
  resolveRecipient,
  resolveSequenceTemplate,
  sendBrevoTransactionalEmail,
} from './utils/emailSequenceHelpers';
import { admin, initializeFirebaseAdmin } from './config/firebase';

type OutreachStatus = 'not-sent' | 'sent' | 'delivered' | 'opened' | 'failed';

type OutreachPreview = {
  channel: 'email';
  subject: string;
  body: string;
  html: string;
  ctaLabel: string;
  ctaUrl: string;
};

type OutreachRecord = {
  id: string;
  channel: 'email';
  status: OutreachStatus;
  messageId?: string | null;
  sentAt?: Date | null;
  deliveredAt?: Date | null;
  openedAt?: Date | null;
  updatedAt?: Date | null;
  lastError?: string | null;
  preview: OutreachPreview;
};

type SendResponse = {
  success: boolean;
  skipped?: boolean;
  messageId?: string;
  error?: string;
  message?: string;
  preview?: OutreachPreview;
  outreach?: OutreachRecord | null;
};

type RequestBody = {
  email?: string;
  name?: string;
  athleteName?: string;
  athleteId?: string;
  userId?: string;
  toEmail?: string;
  firstName?: string;
  isTest?: boolean;
  previewOnly?: boolean;
  subjectOverride?: string;
  htmlOverride?: string;
  scheduledAt?: string;
  organizationId?: string;
  organizationName?: string;
  teamId?: string;
  teamName?: string;
  pilotId?: string;
  pilotName?: string;
  openAppUrl?: string;
  iosAppUrl?: string;
};

const OUTREACH_COLLECTION = 'pulsecheck-pilot-athlete-communications';
const OUTREACH_CHANNEL = 'email';
const DEFAULT_OPEN_APP_URL = 'pulsecheck://open';
const DEFAULT_IOS_APP_STORE_URL = 'https://apps.apple.com/by/app/pulsecheck-mindset-coaching/id6747253393';
const EMAIL_SAFE_PULSECHECK_OPEN_PATH = '/PulseCheck/open';

function normalizeString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function buildOutreachDocId(pilotId: string, athleteId: string, channel: string) {
  return `${pilotId || 'unknown-pilot'}__${athleteId || 'unknown-athlete'}__${channel}`;
}

function buildEmailStatusRecord(docId: string, data: Record<string, any> | null | undefined): OutreachRecord | null {
  if (!data) return null;
  return {
    id: docId,
    channel: OUTREACH_CHANNEL,
    status: (normalizeString(data.status) as OutreachStatus) || 'not-sent',
    messageId: normalizeString(data.messageId) || null,
    sentAt: data.sentAt || null,
    deliveredAt: data.deliveredAt || null,
    openedAt: data.openedAt || null,
    updatedAt: data.updatedAt || null,
    lastError: normalizeString(data.lastError) || null,
    preview: {
      channel: OUTREACH_CHANNEL,
      subject: normalizeString(data.preview?.subject),
      body: normalizeString(data.preview?.body),
      html: normalizeString(data.preview?.html),
      ctaLabel: normalizeString(data.preview?.ctaLabel),
      ctaUrl: normalizeString(data.preview?.ctaUrl),
    },
  };
}

function isAbsoluteHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

function buildEmailSafeOpenAppUrl(args: { openAppUrl: string; iosAppUrl: string }): string {
  const normalizedOpenAppUrl = normalizeString(args.openAppUrl) || DEFAULT_OPEN_APP_URL;
  const normalizedIosAppUrl = normalizeString(args.iosAppUrl) || DEFAULT_IOS_APP_STORE_URL;

  if (isAbsoluteHttpUrl(normalizedOpenAppUrl)) {
    return normalizedOpenAppUrl;
  }

  if (normalizedOpenAppUrl.startsWith('/')) {
    return `${getBaseSiteUrl()}${normalizedOpenAppUrl}`;
  }

  const params = new URLSearchParams({
    dl: normalizedOpenAppUrl,
    ios: normalizedIosAppUrl,
  });

  return `${getBaseSiteUrl()}${EMAIL_SAFE_PULSECHECK_OPEN_PATH}?${params.toString()}`;
}

function replacePulseCheckSchemeLinks(html: string, iosAppUrl: string): string {
  if (!html) return html;

  return html.replace(/pulsecheck:\/\/[^\s"'<>]+/gi, (matchedUrl) =>
    buildEmailSafeOpenAppUrl({
      openAppUrl: matchedUrl,
      iosAppUrl,
    })
  );
}

function stripHtmlToPreviewText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function renderFallbackHtml(args: {
  firstName: string;
  organizationName: string;
  teamName: string;
  pilotName: string;
  openAppUrl: string;
  iosAppUrl: string;
}): string {
  const firstName = escapeHtml(args.firstName);
  const organizationName = escapeHtml(args.organizationName);
  const teamName = escapeHtml(args.teamName);
  const pilotName = escapeHtml(args.pilotName);
  const openAppUrl = escapeHtml(args.openAppUrl);
  const iosAppUrl = escapeHtml(args.iosAppUrl);

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
  </head>
  <body style="margin:0;padding:0;background:#090c12;">
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#090c12;padding:24px 0;">
      <tr>
        <td align="center" style="padding:0 16px;">
          <table role="presentation" cellpadding="0" cellspacing="0" width="640" style="max-width:640px;width:100%;background:#121722;border:1px solid #263042;border-radius:20px;overflow:hidden;">
            <tr>
              <td style="padding:28px;font-family:Arial,sans-serif;color:#f4f4f5;">
                <div style="display:inline-block;border:1px solid rgba(34,211,238,0.22);background:rgba(34,211,238,0.12);color:#c6f7ff;border-radius:999px;padding:6px 10px;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;">
                  PulseCheck Access Ready
                </div>
                <h1 style="margin:18px 0 10px 0;font-size:28px;line-height:1.2;color:#ffffff;">Your PulseCheck app is ready, ${firstName}.</h1>
                <p style="margin:0 0 14px 0;font-size:15px;line-height:1.75;color:#d4d4d8;">
                  Your access to <strong>${pilotName}</strong> for <strong>${teamName}</strong> inside <strong>${organizationName}</strong> is now active.
                </p>
                <p style="margin:0 0 14px 0;font-size:15px;line-height:1.75;color:#d4d4d8;">
                  Open PulseCheck with the same email you used during activation. If you are prompted for consent, complete it and you should be good to go.
                </p>
                <p style="margin:24px 0 12px 0;">
                  <a href="${openAppUrl}" style="display:inline-block;background:#d7ff00;color:#0b0f16;text-decoration:none;padding:14px 18px;border-radius:12px;font-weight:800;">
                    Open Pulse Check App
                  </a>
                </p>
                <p style="margin:0 0 16px 0;font-size:13px;line-height:1.7;color:#a1a1aa;">
                  If the button does not open the app directly, open PulseCheck manually on your phone and sign in with the same email.
                </p>
                <div style="border-top:1px solid #263042;margin-top:20px;padding-top:16px;">
                  <p style="margin:0 0 10px 0;font-size:13px;line-height:1.7;color:#a1a1aa;">
                    Need the app on your phone first?
                  </p>
                  <a href="${iosAppUrl}" style="color:#9be7ff;text-decoration:underline;font-size:13px;">
                    Download PulseCheck on iPhone
                  </a>
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: false, error: 'Method not allowed' } satisfies SendResponse),
    };
  }

  try {
    initializeFirebaseAdmin({ headers: event.headers || {} });
    const db = admin.firestore();
    const body = (event.body ? JSON.parse(event.body) : {}) as RequestBody;
    const {
      email,
      name,
      athleteName,
      athleteId,
      userId,
      toEmail,
      firstName,
      isTest,
      previewOnly,
      subjectOverride,
      htmlOverride,
      scheduledAt,
    } = body;

    const resolvedAthleteId = normalizeString(athleteId) || normalizeString(userId);
    const resolvedPilotId = normalizeString(body.pilotId);
    const recipient = await resolveRecipient({
      userId: resolvedAthleteId,
      toEmail: normalizeString(toEmail) || normalizeString(email),
      firstName: normalizeString(firstName) || normalizeString(name) || normalizeString(athleteName),
    });

    if (!recipient) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: true, skipped: true } satisfies SendResponse),
      };
    }

    const organizationName = normalizeString(body.organizationName) || 'your organization';
    const teamName = normalizeString(body.teamName) || 'your team';
    const pilotName = normalizeString(body.pilotName) || 'your PulseCheck pilot';
    const nativeOpenAppUrl = normalizeString(body.openAppUrl) || DEFAULT_OPEN_APP_URL;
    const iosAppUrl = normalizeString(body.iosAppUrl) || DEFAULT_IOS_APP_STORE_URL;
    const openAppUrl = buildEmailSafeOpenAppUrl({
      openAppUrl: nativeOpenAppUrl,
      iosAppUrl,
    });
    const fallbackSubject = `${teamName} access is ready in PulseCheck`;
    const fallbackHtml = renderFallbackHtml({
      firstName: recipient.firstName,
      organizationName,
      teamName,
      pilotName,
      openAppUrl,
      iosAppUrl,
    });

    const template = await resolveSequenceTemplate({
      templateDocId: 'pulsecheck-pilot-activation-v1',
      fallbackSubject,
      fallbackHtml,
      subjectOverride,
      htmlOverride,
      vars: {
        firstName: recipient.firstName,
        first_name: recipient.firstName,
        organizationName,
        organization_name: organizationName,
        teamName,
        team_name: teamName,
        pilotName,
        pilot_name: pilotName,
        openAppUrl,
        open_app_url: openAppUrl,
        nativeOpenAppUrl,
        native_open_app_url: nativeOpenAppUrl,
        iosAppUrl,
        ios_app_url: iosAppUrl,
      },
    });
    const emailHtml = replacePulseCheckSchemeLinks(template.html, iosAppUrl);

    const preview: OutreachPreview = {
      channel: OUTREACH_CHANNEL,
      subject: template.subject,
      body: stripHtmlToPreviewText(emailHtml),
      html: emailHtml,
      ctaLabel: 'Open Pulse Check App',
      ctaUrl: openAppUrl,
    };

    const outreachDocId = buildOutreachDocId(resolvedPilotId, resolvedAthleteId || recipient.toEmail, OUTREACH_CHANNEL);
    const outreachDocRef = db.collection(OUTREACH_COLLECTION).doc(outreachDocId);
    const outreachSnap = await outreachDocRef.get();
    const existingOutreach = buildEmailStatusRecord(outreachDocRef.id, outreachSnap.exists ? (outreachSnap.data() as Record<string, any>) : null);

    if (previewOnly) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: true,
          preview,
          outreach: existingOutreach,
        } satisfies SendResponse),
      };
    }

    const customHeader = {
      pilotAthleteCommunicationId: outreachDocRef.id,
      pilotId: resolvedPilotId || null,
      athleteId: resolvedAthleteId || null,
      channel: OUTREACH_CHANNEL,
    };

    const sendResult = await sendBrevoTransactionalEmail({
      toEmail: recipient.toEmail,
      toName: recipient.toName,
      subject: template.subject,
      htmlContent: emailHtml,
      tags: ['pulsecheck', 'pilot-activation', isTest ? 'test' : 'manual-admin-send'],
      scheduledAt,
      sender: {
        email: process.env.BREVO_SENDER_EMAIL || 'tre@fitwithpulse.ai',
        name: 'PulseCheck',
      },
      headers: {
        'X-Mailin-custom': JSON.stringify(customHeader),
      },
      bypassDailyRecipientLimit: true,
    });

    if (!sendResult.success) {
      await outreachDocRef.set(
        {
          pilotId: resolvedPilotId || null,
          organizationId: normalizeString(body.organizationId) || null,
          teamId: normalizeString(body.teamId) || null,
          athleteId: resolvedAthleteId || null,
          athleteEmail: recipient.toEmail,
          athleteName: normalizeString(athleteName) || recipient.toName,
          channel: OUTREACH_CHANNEL,
          status: 'failed',
          lastError: sendResult.error || 'Failed to send',
          preview,
          updatedAt: new Date(),
          createdAt: outreachSnap.exists ? (outreachSnap.data() as Record<string, any>)?.createdAt || new Date() : new Date(),
        },
        { merge: true }
      );

      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: sendResult.error || 'Failed to send' } satisfies SendResponse),
      };
    }

    await outreachDocRef.set(
      {
        pilotId: resolvedPilotId || null,
        organizationId: normalizeString(body.organizationId) || null,
        teamId: normalizeString(body.teamId) || null,
        athleteId: resolvedAthleteId || null,
        athleteEmail: recipient.toEmail,
        athleteName: normalizeString(athleteName) || recipient.toName,
        channel: OUTREACH_CHANNEL,
        status: 'sent',
        messageId: sendResult.messageId || null,
        sentAt: new Date(),
        updatedAt: new Date(),
        lastError: null,
        preview,
        createdAt: outreachSnap.exists ? (outreachSnap.data() as Record<string, any>)?.createdAt || new Date() : new Date(),
      },
      { merge: true }
    );

    const nextOutreachSnap = await outreachDocRef.get();
    const nextOutreach = buildEmailStatusRecord(outreachDocRef.id, nextOutreachSnap.exists ? (nextOutreachSnap.data() as Record<string, any>) : null);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        messageId: sendResult.messageId,
        message: 'PulseCheck pilot activation email sent successfully.',
        preview,
        outreach: nextOutreach,
      } satisfies SendResponse),
    };
  } catch (error: any) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: false,
        error: error?.message || 'Internal server error while sending email.',
      } satisfies SendResponse),
    };
  }
};
