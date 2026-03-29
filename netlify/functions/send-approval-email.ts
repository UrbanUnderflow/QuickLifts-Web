import type { Handler } from '@netlify/functions';
import {
  buildEmailDedupeKey,
  resolveRecipient,
  resolveSequenceTemplate,
  sendBrevoTransactionalEmail,
} from './utils/emailSequenceHelpers';

type SendResponse = {
  success: boolean;
  skipped?: boolean;
  messageId?: string;
  error?: string;
  message?: string;
};

type RequestBody = {
  email?: string;
  name?: string;
  userId?: string;
  toEmail?: string;
  firstName?: string;
  isTest?: boolean;
  subjectOverride?: string;
  htmlOverride?: string;
  scheduledAt?: string;
};

function renderFallbackHtml(args: {
  firstName: string;
  appStoreUrl: string;
  gettingStartedUrl: string;
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
                <h1 style="margin:0 0 10px 0;font-size:24px;line-height:1.2;color:#e0fe10;">You're approved, ${args.firstName}.</h1>
                <p style="margin:0 0 12px 0;font-size:14px;line-height:1.7;color:#d4d4d8;">
                  Welcome to Pulse Programming. You now have access to the Founding Coach experience.
                </p>
                <p style="margin:0 0 12px 0;font-size:14px;line-height:1.7;color:#d4d4d8;">
                  Start here:
                </p>
                <ul style="margin:0 0 12px 18px;padding:0;color:#d4d4d8;font-size:14px;line-height:1.8;">
                  <li>Download the app and complete your profile</li>
                  <li>Create your first Move, Stack, and Round</li>
                  <li>Run your own challenge with your audience</li>
                </ul>
                <p style="margin:20px 0 10px 0;">
                  <a href="${args.gettingStartedUrl}" style="display:inline-block;background:#e0fe10;color:#101113;text-decoration:none;padding:12px 16px;border-radius:10px;font-weight:700;">
                    Open Getting Started Guide
                  </a>
                </p>
                <p style="margin:0;font-size:13px;line-height:1.7;color:#b9b9bf;">
                  App download:
                  <a href="${args.appStoreUrl}" style="color:#e0fe10;text-decoration:underline;">iOS App Store</a>
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
      email,
      name,
      userId,
      toEmail,
      firstName,
      isTest,
      subjectOverride,
      htmlOverride,
      scheduledAt,
    } = body;

    const recipient = await resolveRecipient({
      userId,
      toEmail: (toEmail || email || '').trim(),
      firstName: firstName || name || '',
    });

    if (!recipient) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: true, skipped: true } satisfies SendResponse),
      };
    }

    const appStoreUrl = 'https://apps.apple.com/ca/app/pulse-community-workouts/id6451497729';
    const gettingStartedUrl = 'https://fitwithpulse.ai/starter-pack';
    const fallbackSubject = `Congratulations, ${recipient.firstName}! You're approved for Pulse Programming`;
    const fallbackHtml = renderFallbackHtml({
      firstName: recipient.firstName,
      appStoreUrl,
      gettingStartedUrl,
    });

    const template = await resolveSequenceTemplate({
      templateDocId: 'approval-v1',
      fallbackSubject,
      fallbackHtml,
      subjectOverride,
      htmlOverride,
      vars: {
        firstName: recipient.firstName,
        first_name: recipient.firstName,
        username: recipient.username,
        appStoreUrl,
        app_store_url: appStoreUrl,
        gettingStartedUrl,
        getting_started_url: gettingStartedUrl,
      },
    });

    const idempotencyKey = !isTest
      ? buildEmailDedupeKey(['approval-v1', userId || recipient.toEmail])
      : '';

    const sendResult = await sendBrevoTransactionalEmail({
      toEmail: recipient.toEmail,
      toName: recipient.toName,
      subject: template.subject,
      htmlContent: template.html,
      tags: ['approval', isTest ? 'test' : ''],
      scheduledAt,
      idempotencyKey,
      bypassDailyRecipientLimit: true,
      idempotencyMetadata: idempotencyKey
        ? {
            sequence: 'approval-v1',
            userId: userId || null,
            toEmail: recipient.toEmail,
          }
        : undefined,
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
        message: 'Approval email sent successfully.',
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
