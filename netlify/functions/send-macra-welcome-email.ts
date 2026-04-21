import type { Handler } from '@netlify/functions';
import { getFirestore } from './utils/getServiceAccount';
import {
  applyTemplateVars,
  buildEmailDedupeKey,
  escapeHtml,
  loadTemplateFromFirestore,
  resolveRecipient,
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
  isTest?: boolean;
  subjectOverride?: string;
  htmlOverride?: string;
};

const FALLBACK_SUBJECT = 'Welcome to Macra — your plan is ready';

function renderFallbackHtml(firstName: string) {
  const greeting = firstName ? firstName : 'there';
  return `
  <!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>${escapeHtml(FALLBACK_SUBJECT)}</title>
    </head>
    <body style="margin:0;padding:0;background:#0a0a0b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Arial,sans-serif;">
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#0a0a0b;padding:24px 0;">
        <tr>
          <td align="center" style="padding: 0 16px;">
            <table role="presentation" cellpadding="0" cellspacing="0" width="640" style="max-width:640px;width:100%;">
              <tr>
                <td style="padding: 6px 8px 18px 8px;">
                  <div style="display:flex;align-items:center;justify-content:center;gap:12px;">
                    <div style="width:44px;height:44px;border-radius:12px;background:#E0FE10;display:inline-flex;align-items:center;justify-content:center;">
                      <span style="font-weight:900;color:#0a0a0b;font-size:20px;">M</span>
                    </div>
                    <div style="font-weight:800;color:#ffffff;font-size:18px;letter-spacing:0.2px;">Macra</div>
                  </div>
                </td>
              </tr>
              <tr>
                <td style="border:1px solid rgba(255,255,255,0.08);background:rgba(24,24,27,0.75);border-radius:20px;overflow:hidden;">
                  <div style="height:2px;background:linear-gradient(90deg, transparent, rgba(224,254,16,0.7), transparent);"></div>
                  <div style="padding:26px 22px 10px 22px;">
                    <h1 style="margin:0 0 10px 0;font-size:28px;line-height:1.2;color:#ffffff;font-weight:900;">
                      Welcome to Macra, ${escapeHtml(greeting)}.
                    </h1>
                    <p style="margin:0 0 16px 0;font-size:14px;line-height:1.7;color:#A1A1AA;">
                      Your plan is live. Nora, your AI nutrition coach, is ready to help you hit your macros every day.
                    </p>
                  </div>
                  <div style="padding: 0 22px 22px 22px;">
                    <div style="padding:16px 16px;border-radius:16px;background:rgba(0,0,0,0.35);border:1px solid rgba(255,255,255,0.06);">
                      <p style="margin:0 0 10px 0;font-size:13px;line-height:1.7;color:#E4E4E7;font-weight:700;">
                        Three ways to get the most out of Macra this week:
                      </p>
                      <ol style="margin:0;padding-left:18px;font-size:13px;line-height:1.8;color:#D4D4D8;">
                        <li style="margin: 0 0 6px 0;">
                          <strong style="color:#ffffff;">Log every meal</strong> — even rough estimates are better than nothing. Nora learns as you go.
                        </li>
                        <li style="margin: 0 0 6px 0;">
                          <strong style="color:#ffffff;">Ask Nora anything</strong> — "how's my protein today?" or "swap this for something lower-carb." She's in-app 24/7.
                        </li>
                        <li style="margin: 0 0 6px 0;">
                          <strong style="color:#ffffff;">Review at the end of the day</strong> — a 60-second check-in each night keeps you consistent.
                        </li>
                      </ol>
                    </div>
                  </div>
                </td>
              </tr>
              <tr>
                <td style="padding: 16px 8px 0 8px;text-align:center;font-size:12px;color:#71717A;">
                  Sent by Macra · A Pulse Intelligence Labs app
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
    const { userId, isTest, subjectOverride, htmlOverride } = body;

    const recipient = await resolveRecipient({
      userId,
      toEmail: body.toEmail,
      firstName: body.firstName,
    });

    if (!recipient) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: 'Missing toEmail / could not resolve recipient' } satisfies SendResponse),
      };
    }

    // Server-side idempotency: once sent, never resend outside of test mode.
    if (userId && !isTest) {
      try {
        const db = await getFirestore();
        const userRef = db.collection('users').doc(userId);
        const snap = await userRef.get();
        if (snap.exists) {
          const data = snap.data() || {};
          if (data.macraWelcomeEmailSentAt) {
            return {
              statusCode: 200,
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ success: true, skipped: true } satisfies SendResponse),
            };
          }
        }
      } catch (e) {
        console.warn('[send-macra-welcome-email] idempotency check failed:', e);
      }
    }

    let subject = (subjectOverride || '').trim();
    let html = (htmlOverride || '').trim();
    if (!subject || !html) {
      const saved = await loadTemplateFromFirestore('macra-welcome-v1');
      if (saved) {
        subject = saved.subject;
        html = saved.html;
      } else {
        subject = FALLBACK_SUBJECT;
        html = renderFallbackHtml(recipient.firstName);
      }
    }

    const vars = {
      firstName: recipient.firstName,
      first_name: recipient.firstName,
      username: recipient.username,
      user_name: recipient.username,
    };
    subject = applyTemplateVars(subject, vars) || subject;
    html = applyTemplateVars(html, vars) || html;

    const idempotencyKey = !isTest ? buildEmailDedupeKey(['macra-welcome-v1', userId || recipient.toEmail]) : '';
    const sendResult = await sendBrevoTransactionalEmail({
      toEmail: recipient.toEmail,
      toName: recipient.toName,
      subject,
      htmlContent: html,
      tags: ['macra', 'macra-welcome', isTest ? 'test' : null].filter(Boolean) as string[],
      idempotencyKey,
      bypassDailyRecipientLimit: true,
      idempotencyMetadata: idempotencyKey
        ? {
            sequence: 'macra-welcome-v1',
            userId: userId || null,
            toEmail: recipient.toEmail,
          }
        : undefined,
    });

    if (!sendResult.success) {
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: sendResult.error || 'Brevo API error' } satisfies SendResponse),
      };
    }

    if (userId && !isTest && !sendResult.skipped) {
      try {
        const db = await getFirestore();
        await db.collection('users').doc(userId).set(
          {
            macraWelcomeEmailSentAt: new Date(),
            macraWelcomeEmailProvider: 'brevo',
            macraWelcomeEmailMessageId: sendResult.messageId || null,
          },
          { merge: true } as any
        );
      } catch (e) {
        console.warn('[send-macra-welcome-email] failed to update user sent marker:', e);
      }
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, skipped: sendResult.skipped, messageId: sendResult.messageId } satisfies SendResponse),
    };
  } catch (e: any) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: false, error: e?.message || 'Internal error' } satisfies SendResponse),
    };
  }
};
