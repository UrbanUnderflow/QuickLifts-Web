import type { Handler } from '@netlify/functions';
import {
  buildEmailDedupeKey,
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
  isTest?: boolean;
  subjectOverride?: string;
  htmlOverride?: string;
  scheduledAt?: string;
};

function renderFallbackHtml(args: { firstName: string; daysInactive: number; macraUrl: string }): string {
  return `<!doctype html>
<html>
  <head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /></head>
  <body style="margin:0;padding:0;background:#0b0b0b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Arial,sans-serif;">
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#0b0b0b;padding:24px 0;">
      <tr>
        <td align="center" style="padding:0 16px;">
          <table role="presentation" cellpadding="0" cellspacing="0" width="640" style="max-width:640px;width:100%;background:#15171b;border:1px solid #2a2f36;border-radius:16px;overflow:hidden;">
            <tr>
              <td style="padding:24px;color:#f4f4f5;">
                <h1 style="margin:0 0 10px 0;font-size:24px;line-height:1.2;color:#E0FE10;">Nora's missing you, ${args.firstName}.</h1>
                <p style="margin:0 0 12px 0;font-size:14px;line-height:1.7;color:#d4d4d8;">
                  It's been <strong>${args.daysInactive} day${args.daysInactive === 1 ? '' : 's'}</strong> since you last logged food. Consistency is the whole game — and you already have the plan.
                </p>
                <p style="margin:0 0 12px 0;font-size:14px;line-height:1.7;color:#d4d4d8;">
                  Takes 30 seconds to log today's first meal. Nora will pick the day right back up with you.
                </p>
                <p style="margin:20px 0;">
                  <a href="${args.macraUrl}" style="display:inline-block;background:#E0FE10;color:#101113;text-decoration:none;padding:12px 16px;border-radius:10px;font-weight:700;">Log a meal</a>
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
    const { userId, toEmail, firstName, daysInactive = 3, isTest, subjectOverride, htmlOverride, scheduledAt } = body;

    const recipient = await resolveRecipient({ userId, toEmail, firstName });
    if (!recipient) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: true, skipped: true } satisfies SendResponse),
      };
    }

    const siteUrl = getBaseSiteUrl();
    const macraUrl = `${siteUrl}/macra`;

    const fallbackSubject = `You haven't logged in ${daysInactive} day${daysInactive === 1 ? '' : 's'} — Nora misses you`;
    const fallbackHtml = renderFallbackHtml({ firstName: recipient.firstName, daysInactive, macraUrl });

    const template = await resolveSequenceTemplate({
      templateDocId: 'macra-inactivity-winback-v1',
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
        macraUrl,
        macra_url: macraUrl,
      },
    });

    const idempotencyKey = !isTest
      ? buildEmailDedupeKey(['macra-inactivity-winback-v1', userId || recipient.toEmail, daysInactive])
      : '';

    const sendResult = await sendBrevoTransactionalEmail({
      toEmail: recipient.toEmail,
      toName: recipient.toName,
      subject: template.subject,
      htmlContent: template.html,
      tags: ['macra', 'macra-inactivity-winback', `days:${daysInactive}`, isTest ? 'test' : ''].filter(Boolean) as string[],
      scheduledAt,
      idempotencyKey,
      idempotencyMetadata: idempotencyKey
        ? { sequence: 'macra-inactivity-winback-v1', userId: userId || null, daysInactive }
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
