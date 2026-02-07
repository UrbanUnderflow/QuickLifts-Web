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
  coachEmail?: string;
  coachName?: string;
  athleteName?: string;
  toEmail?: string;
  firstName?: string;
  isTest?: boolean;
  subjectOverride?: string;
  htmlOverride?: string;
  scheduledAt?: string;
};

function renderFallbackHtml(args: {
  coachName: string;
  athleteName: string;
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
                <h1 style="margin:0 0 10px 0;font-size:24px;line-height:1.2;color:#e0fe10;">${args.athleteName} just connected via PulseCheck</h1>
                <p style="margin:0 0 12px 0;font-size:14px;line-height:1.7;color:#d4d4d8;">
                  ${args.coachName}, you can now message this athlete and support their training progress.
                </p>
                <p style="margin:0 0 12px 0;font-size:14px;line-height:1.7;color:#d4d4d8;">
                  Open your dashboard to review and connect.
                </p>
                <p style="margin:20px 0;">
                  <a href="${args.dashboardUrl}" style="display:inline-block;background:#e0fe10;color:#101113;text-decoration:none;padding:12px 16px;border-radius:10px;font-weight:700;">
                    View Coach Dashboard
                  </a>
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
      coachEmail,
      coachName,
      athleteName = 'An athlete',
      toEmail,
      firstName,
      isTest,
      subjectOverride,
      htmlOverride,
      scheduledAt,
    } = body;

    const recipient = await resolveRecipient({
      toEmail: (toEmail || coachEmail || '').trim(),
      firstName: firstName || coachName || 'Coach',
    });

    if (!recipient) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: true, skipped: true } satisfies SendResponse),
      };
    }

    const dashboardUrl = `${getBaseSiteUrl()}/coach/dashboard`;
    const fallbackSubject = `${athleteName} just connected with you on PulseCheck`;
    const fallbackHtml = renderFallbackHtml({
      coachName: recipient.firstName || coachName || 'Coach',
      athleteName,
      dashboardUrl,
    });

    const template = await resolveSequenceTemplate({
      templateDocId: 'coach-connection-v1',
      fallbackSubject,
      fallbackHtml,
      subjectOverride,
      htmlOverride,
      vars: {
        firstName: recipient.firstName,
        first_name: recipient.firstName,
        coachName: recipient.firstName || coachName || 'Coach',
        coach_name: recipient.firstName || coachName || 'Coach',
        athleteName,
        athlete_name: athleteName,
        dashboardUrl,
        dashboard_url: dashboardUrl,
      },
    });

    const sendResult = await sendBrevoTransactionalEmail({
      toEmail: recipient.toEmail,
      toName: recipient.toName,
      subject: template.subject,
      htmlContent: template.html,
      tags: ['coach-connection', isTest ? 'test' : ''],
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
      body: JSON.stringify({
        success: true,
        messageId: sendResult.messageId,
      } satisfies SendResponse),
    };
  } catch (error: any) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: false, error: error?.message || 'Unexpected error' } satisfies SendResponse),
    };
  }
};
