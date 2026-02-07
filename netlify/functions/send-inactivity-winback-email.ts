import type { Handler } from '@netlify/functions';
import {
  getBaseSiteUrl,
  resolveRecipient,
  resolveSequenceTemplate,
  sendBrevoTransactionalEmail,
} from './utils/emailSequenceHelpers';

type SendResponse = {
  success: boolean;
  skipped?: boolean;
  messageId?: string;
  error?: string;
};

type RequestBody = {
  userId?: string;
  toEmail?: string;
  firstName?: string;
  daysInactive?: number;
  challengeTitle?: string;
  challengeId?: string;
  isTest?: boolean;
  subjectOverride?: string;
  htmlOverride?: string;
  scheduledAt?: string;
};

function renderFallbackHtml(args: {
  firstName: string;
  daysInactive: number;
  challengeTitle: string;
  roundUrl: string;
  dashboardUrl: string;
}): string {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
  </head>
  <body style="margin:0;padding:0;background:#0b0b0b;">
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#0b0b0b;padding:24px 0;">
      <tr>
        <td align="center" style="padding:0 16px;">
          <table role="presentation" cellpadding="0" cellspacing="0" width="640" style="max-width:640px;width:100%;background:#15171b;border:1px solid #2a2f36;border-radius:16px;overflow:hidden;">
            <tr>
              <td style="padding:24px;font-family:Arial,sans-serif;color:#f4f4f5;">
                <h1 style="margin:0 0 10px 0;font-size:24px;line-height:1.2;color:#e0fe10;">Quick reset, ${args.firstName}</h1>
                <p style="margin:0 0 12px 0;font-size:14px;line-height:1.7;color:#d4d4d8;">
                  It's been about <strong>${args.daysInactive} day${args.daysInactive === 1 ? '' : 's'}</strong> since your last Pulse action.
                </p>
                <p style="margin:0 0 12px 0;font-size:14px;line-height:1.7;color:#d4d4d8;">
                  Start with a 10-minute restart plan:
                </p>
                <ol style="margin:0 0 14px 18px;padding:0;color:#d4d4d8;font-size:14px;line-height:1.8;">
                  <li>Open your current round: ${args.challengeTitle}</li>
                  <li>Complete one short workout</li>
                  <li>Schedule tomorrow's session before you close the app</li>
                </ol>
                <p style="margin:20px 0;">
                  <a href="${args.roundUrl}" style="display:inline-block;background:#e0fe10;color:#101113;text-decoration:none;padding:12px 16px;border-radius:10px;font-weight:700;">
                    Restart in 10 Minutes
                  </a>
                </p>
                <p style="margin:0;font-size:12px;line-height:1.7;color:#8e8e95;">
                  Need options first?
                  <a href="${args.dashboardUrl}" style="color:#e0fe10;text-decoration:underline;">Open dashboard</a>
                </p>
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
    const body = (event.body ? JSON.parse(event.body) : {}) as RequestBody;
    const {
      userId,
      toEmail,
      firstName,
      daysInactive = 3,
      challengeTitle = 'your Round',
      challengeId,
      isTest,
      subjectOverride,
      htmlOverride,
      scheduledAt,
    } = body;

    const recipient = await resolveRecipient({ userId, toEmail, firstName });
    if (!recipient) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: true, skipped: true } satisfies SendResponse),
      };
    }

    const siteUrl = getBaseSiteUrl();
    const roundUrl = challengeId ? `${siteUrl}/round/${encodeURIComponent(challengeId)}` : `${siteUrl}/rounds`;
    const dashboardUrl = `${siteUrl}/dashboard`;

    const fallbackSubject = `Let's get you back in motion on Pulse`;
    const fallbackHtml = renderFallbackHtml({
      firstName: recipient.firstName,
      daysInactive,
      challengeTitle,
      roundUrl,
      dashboardUrl,
    });

    const template = await resolveSequenceTemplate({
      templateDocId: 'inactivity-winback-v1',
      fallbackSubject,
      fallbackHtml,
      subjectOverride,
      htmlOverride,
      vars: {
        firstName: recipient.firstName,
        first_name: recipient.firstName,
        username: recipient.username,
        daysInactive,
        days_inactive: daysInactive,
        challengeTitle,
        challenge_title: challengeTitle,
        challengeId: challengeId || '',
        challenge_id: challengeId || '',
        roundUrl,
        round_url: roundUrl,
        dashboardUrl,
        dashboard_url: dashboardUrl,
      },
    });

    const sendResult = await sendBrevoTransactionalEmail({
      toEmail: recipient.toEmail,
      toName: recipient.toName,
      subject: template.subject,
      htmlContent: template.html,
      tags: ['inactivity-winback', `days:${daysInactive}`, isTest ? 'test' : ''],
      scheduledAt,
    });

    if (!sendResult.success) {
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: sendResult.error || 'Failed to send' } satisfies SendResponse),
      };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, messageId: sendResult.messageId } satisfies SendResponse),
    };
  } catch (error: any) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: false, error: error?.message || 'Internal error' } satisfies SendResponse),
    };
  }
};

