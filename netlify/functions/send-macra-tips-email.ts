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

type TipId = 'day2' | 'day4' | 'day7';

type RequestBody = {
  userId?: string;
  toEmail?: string;
  firstName?: string;
  tipId?: TipId;
  isTest?: boolean;
  subjectOverride?: string;
  htmlOverride?: string;
  scheduledAt?: string;
};

const TIPS: Record<TipId, { title: string; body: string }> = {
  day2: {
    title: 'Log every meal — even the messy ones',
    body: "Rough numbers beat no numbers. Nora learns from whatever you give her; don't skip a meal just because you can't measure it perfectly.",
  },
  day4: {
    title: "Talk to Nora like you'd talk to a coach",
    body: "Ask questions in plain English — \"am I on track for protein?\", \"what's a good dinner for 600 cal?\" — she'll answer in context of your plan and today's log.",
  },
  day7: {
    title: 'End-of-day reflection is the secret weapon',
    body: "A 60-second nightly check-in closes the loop. Even if the day went sideways, naming it is how you adjust tomorrow. Consistency beats perfection.",
  },
};

function renderFallbackHtml(args: { firstName: string; tip: { title: string; body: string }; macraUrl: string }): string {
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
                <p style="margin:0 0 6px 0;font-size:11px;letter-spacing:1.4px;color:#E0FE10;font-weight:700;">NORA TIP</p>
                <h1 style="margin:0 0 10px 0;font-size:24px;line-height:1.2;color:#ffffff;">${args.tip.title}</h1>
                <p style="margin:0 0 16px 0;font-size:14px;line-height:1.7;color:#d4d4d8;">${args.tip.body}</p>
                <p style="margin:20px 0;">
                  <a href="${args.macraUrl}" style="display:inline-block;background:#E0FE10;color:#101113;text-decoration:none;padding:12px 16px;border-radius:10px;font-weight:700;">Open Macra</a>
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
    const { userId, toEmail, firstName, tipId = 'day2', isTest, subjectOverride, htmlOverride, scheduledAt } = body;

    const tip = TIPS[tipId];
    if (!tip) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: `Unknown tipId: ${tipId}` } satisfies SendResponse),
      };
    }

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

    const fallbackSubject = `Nora tip: ${tip.title}`;
    const fallbackHtml = renderFallbackHtml({ firstName: recipient.firstName, tip, macraUrl });

    const template = await resolveSequenceTemplate({
      templateDocId: 'macra-tips-v1',
      fallbackSubject,
      fallbackHtml,
      subjectOverride,
      htmlOverride,
      vars: {
        firstName: recipient.firstName,
        first_name: recipient.firstName,
        username: recipient.username,
        tipTitle: tip.title,
        tip_title: tip.title,
        tipBody: tip.body,
        tip_body: tip.body,
        tipId,
        tip_id: tipId,
        macraUrl,
        macra_url: macraUrl,
      },
    });

    const idempotencyKey = !isTest
      ? buildEmailDedupeKey(['macra-tips-v1', userId || recipient.toEmail, tipId])
      : '';

    const sendResult = await sendBrevoTransactionalEmail({
      toEmail: recipient.toEmail,
      toName: recipient.toName,
      subject: template.subject,
      htmlContent: template.html,
      tags: ['macra', 'macra-tips', `tip:${tipId}`, isTest ? 'test' : ''].filter(Boolean) as string[],
      scheduledAt,
      idempotencyKey,
      idempotencyMetadata: idempotencyKey
        ? { sequence: 'macra-tips-v1', userId: userId || null, tipId }
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
