import type { Handler } from '@netlify/functions';
import { getFirestore } from './utils/getServiceAccount';

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

function escapeHtml(input: string) {
  if (!input) return '';
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function applyTemplateVars(input: string, vars: { firstName?: string }) {
  const firstName = (vars.firstName || '').trim() || 'there';
  return input.replaceAll('{{first_name}}', escapeHtml(firstName)).replaceAll('{{firstName}}', escapeHtml(firstName));
}

function renderFallback(opts: { firstName?: string }) {
  const firstName = (opts.firstName || '').trim() || 'there';
  const subject = 'Finish setting up your Pulse account';

  const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(subject)}</title>
  </head>
  <body style="margin:0;padding:0;background:#0a0a0b;">
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#0a0a0b;padding:24px 0;">
      <tr>
        <td align="center" style="padding:0 16px;">
          <table role="presentation" cellpadding="0" cellspacing="0" width="640" style="max-width:640px;width:100%;">
            <tr>
              <td style="border:1px solid rgba(255,255,255,0.08);background:rgba(24,24,27,0.75);border-radius:20px;overflow:hidden;">
                <div style="height:2px;background:linear-gradient(90deg, transparent, rgba(224,254,16,0.7), transparent);"></div>
                <div style="padding:22px;">
                  <h1 style="margin:0 0 8px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Arial,sans-serif;font-size:22px;line-height:1.25;color:#ffffff;font-weight:900;">
                    Quick check-in, ${escapeHtml(firstName)} 👋
                  </h1>
                  <p style="margin:0 0 12px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Arial,sans-serif;font-size:14px;line-height:1.7;color:#A1A1AA;">
                    It looks like you started creating your Pulse account, but didn’t finish choosing a username.
                  </p>
                  <div style="padding:14px 14px;border-radius:14px;background:rgba(0,0,0,0.35);border:1px solid rgba(255,255,255,0.06);">
                    <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Arial,sans-serif;font-size:13px;line-height:1.7;color:#D4D4D8;">
                      Open the app and pick a username to finish setup — then you can start workouts and track progress.
                    </p>
                  </div>
                  <p style="margin:14px 0 0 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Arial,sans-serif;font-size:12px;line-height:1.7;color:#71717A;">
                    If you need help, just reply to this email.
                    <br/>— Tremaine &amp; the Pulse team
                  </p>
                </div>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:16px 8px 0 8px;">
                <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Arial,sans-serif;font-size:11px;line-height:1.6;color:#52525B;">
                  © ${new Date().getFullYear()} Pulse Intelligence Labs, Inc.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return { subject, html };
}

async function getTemplateFromFirestore(): Promise<{ subject: string; html: string } | null> {
  try {
    const db = await getFirestore();
    const snap = await db.collection('email-templates').doc('username-reminder-v1').get();
    if (!snap.exists) return null;
    const data = snap.data() || {};
    const subject = typeof data.subject === 'string' ? data.subject : '';
    const html = typeof data.html === 'string' ? data.html : '';
    if (!subject || !html) return null;
    return { subject, html };
  } catch (e) {
    console.warn('[send-username-reminder-email] Failed to load template:', e);
    return null;
  }
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ success: false, error: 'Method not allowed' } satisfies SendResponse) };
  }

  try {
    const apiKey = process.env.BREVO_MARKETING_KEY || process.env.BREVO_API_KEY;
    const senderEmail = 'tre@fitwithpulse.ai';
    const senderName = 'Pulse';

    if (!apiKey) {
      return { statusCode: 500, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ success: false, error: 'Brevo not configured' } satisfies SendResponse) };
    }

    const body = (event.body ? JSON.parse(event.body) : {}) as RequestBody;
    const { userId, toEmail, firstName, isTest, subjectOverride, htmlOverride } = body;

    // If userId is provided, load email from Firestore user doc (source of truth)
    let email = (toEmail || '').trim();
    let currentFirstName = (firstName || '').trim();
    if (userId) {
      try {
        const db = await getFirestore();
        const userSnap = await db.collection('users').doc(userId).get();
        if (!userSnap.exists) {
          return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ success: true, skipped: true } satisfies SendResponse) };
        }
        const u = userSnap.data() || {};

        // If they already finished registration, do not send
        if (u.registrationComplete === true || (typeof u.username === 'string' && u.username.trim())) {
          return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ success: true, skipped: true } satisfies SendResponse) };
        }

        // Idempotency
        if (!isTest && u.usernameReminderEmailSentAt) {
          return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ success: true, skipped: true } satisfies SendResponse) };
        }

        if (!email && typeof u.email === 'string') email = (u.email as string).trim();
        if (!currentFirstName && typeof u.displayName === 'string') currentFirstName = (u.displayName as string).trim();
      } catch (e) {
        // If we can't load user, don't risk spamming
        console.warn('[send-username-reminder-email] Failed to load user doc:', e);
        return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ success: true, skipped: true } satisfies SendResponse) };
      }
    }

    if (!email) {
      return { statusCode: 400, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ success: false, error: 'Missing toEmail/userId' } satisfies SendResponse) };
    }

    let subject = (subjectOverride || '').trim();
    let html = (htmlOverride || '').trim();
    if (!subject || !html) {
      const saved = await getTemplateFromFirestore();
      if (saved) {
        subject = saved.subject;
        html = saved.html;
      } else {
        const fallback = renderFallback({ firstName: currentFirstName });
        subject = fallback.subject;
        html = fallback.html;
      }
    }

    subject = applyTemplateVars(subject, { firstName: currentFirstName });
    html = applyTemplateVars(html, { firstName: currentFirstName });

    const payload: any = {
      sender: { name: senderName, email: senderEmail },
      to: [{ email, name: currentFirstName || email }],
      subject,
      htmlContent: html,
      replyTo: { email: senderEmail, name: 'Pulse Team' },
      tags: ['username-reminder', isTest ? 'test' : null].filter(Boolean),
    };

    const resp = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      return { statusCode: resp.status, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ success: false, error: err?.message || 'Brevo API error' } satisfies SendResponse) };
    }

    const data = await resp.json().catch(() => ({}));

    if (userId && !isTest) {
      try {
        const db = await getFirestore();
        await db.collection('users').doc(userId).set(
          {
            usernameReminderEmailSentAt: new Date(),
            usernameReminderEmailProvider: 'brevo',
            usernameReminderEmailMessageId: data?.messageId || null,
          },
          { merge: true } as any
        );
      } catch (e) {
        console.warn('[send-username-reminder-email] Failed to mark sent:', e);
      }
    }

    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ success: true, messageId: data?.messageId } satisfies SendResponse) };
  } catch (e: any) {
    return { statusCode: 500, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ success: false, error: e?.message || 'Internal error' } satisfies SendResponse) };
  }
};

