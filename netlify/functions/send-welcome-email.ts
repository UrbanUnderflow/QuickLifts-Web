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
  toEmail: string;
  firstName?: string;
  username?: string;
  role?: string;
  isTest?: boolean;
  subjectOverride?: string;
  htmlOverride?: string;
  scheduledAt?: string;
};

const PRO_FEATURES = [
  'Join unlimited Rounds',
  'Access all creator content',
  'Track workouts & progress',
  'AI-powered recommendations',
  'Community challenges',
  'Priority support',
];

function escapeHtml(input: string) {
  if (!input) return '';
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function renderWelcomeEmail(opts: { firstName?: string; username?: string; role?: string }) {
  const name = (opts.firstName || '').trim();
  const greetingName = name ? name : 'there';
  const username = (opts.username || '').trim();

  const ctaPrimary = 'https://fitwithpulse.ai/rounds';
  const ctaCreators = 'https://fitwithpulse.ai/creators';
  const ctaPricing = 'https://fitwithpulse.ai/pricing';
  const ctaMoves = 'https://fitwithpulse.ai/moves';

  const subject = 'Welcome to Pulse — you’re in';

  const proFeaturesHtml = PRO_FEATURES.map(
    (f) =>
      `<li style="margin: 0 0 10px 0; padding: 0;">
        <span style="display:inline-block;width:10px;height:10px;border-radius:999px;background:#E0FE10;margin-right:10px;"></span>
        <span style="color:#E4E4E7;font-size:14px;line-height:1.6;">${escapeHtml(f)}</span>
      </li>`
  ).join('');

  const html = `
  <!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>${escapeHtml(subject)}</title>
    </head>
    <body style="margin:0;padding:0;background:#0a0a0b;">
      <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
        Welcome to the Pulse family. Here’s how to get the most out of Pulse — and how to go Pro.
      </div>

      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#0a0a0b;padding:24px 0;">
        <tr>
          <td align="center" style="padding: 0 16px;">
            <table role="presentation" cellpadding="0" cellspacing="0" width="640" style="max-width:640px;width:100%;">
              <tr>
                <td style="padding: 6px 8px 18px 8px;">
                  <div style="display:flex;align-items:center;justify-content:center;gap:12px;">
                    <div style="width:44px;height:44px;border-radius:12px;background:#E0FE10;display:inline-flex;align-items:center;justify-content:center;">
                      <span style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Arial,sans-serif;font-weight:900;color:#0a0a0b;font-size:20px;">P</span>
                    </div>
                    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Arial,sans-serif;font-weight:800;color:#ffffff;font-size:18px;letter-spacing:0.2px;">
                      Pulse
                    </div>
                  </div>
                </td>
              </tr>

              <tr>
                <td style="border:1px solid rgba(255,255,255,0.08);background:rgba(24,24,27,0.75);backdrop-filter: blur(12px);border-radius:20px;overflow:hidden;">
                  <div style="height:2px;background:linear-gradient(90deg, transparent, rgba(224,254,16,0.7), transparent);"></div>
                  <div style="padding:26px 22px 10px 22px;">
                    <h1 style="margin:0 0 10px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Arial,sans-serif;font-size:28px;line-height:1.2;color:#ffffff;font-weight:900;">
                      Welcome to the family, ${escapeHtml(greetingName)}.
                    </h1>
                    <p style="margin:0 0 16px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Arial,sans-serif;font-size:14px;line-height:1.7;color:#A1A1AA;">
                      You’re officially part of Pulse. If you ever feel stuck, overwhelmed, or unsure what to do next — you’re in the right place.
                      ${username ? `Your username is <span style="color:#E0FE10;font-weight:700;">@${escapeHtml(username)}</span>.` : ''}
                    </p>
                  </div>

                  <div style="padding: 0 22px 22px 22px;">
                    <div style="padding:16px 16px;border-radius:16px;background:rgba(0,0,0,0.35);border:1px solid rgba(255,255,255,0.06);">
                      <p style="margin:0 0 10px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Arial,sans-serif;font-size:13px;line-height:1.7;color:#E4E4E7;font-weight:700;">
                        Here are 3 quick ways to use Pulse right now:
                      </p>
                      <ol style="margin:0;padding-left:18px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Arial,sans-serif;font-size:13px;line-height:1.8;color:#D4D4D8;">
                        <li style="margin: 0 0 6px 0;">
                          <strong style="color:#ffffff;">Join a Round</strong> to stay consistent with a clear plan and community energy.
                          <a href="${ctaPrimary}" style="color:#E0FE10;text-decoration:underline;font-weight:600;">Browse Rounds</a>
                        </li>
                        <li style="margin: 0 0 6px 0;">
                          <strong style="color:#ffffff;">Find a Creator</strong> whose style matches your goals.
                          <a href="${ctaCreators}" style="color:#E0FE10;text-decoration:underline;font-weight:600;">Explore Creators</a>
                        </li>
                        <li style="margin: 0;">
                          <strong style="color:#ffffff;">Learn the Moves</strong> so you feel confident every session.
                          <a href="${ctaMoves}" style="color:#E0FE10;text-decoration:underline;font-weight:600;">Open Moves</a>
                        </li>
                      </ol>
                    </div>
                  </div>

                  <div style="padding: 0 22px 22px 22px;">
                    <div style="border-radius:16px;background:linear-gradient(135deg, rgba(224,254,16,0.14), rgba(16,185,129,0.10));border:1px solid rgba(224,254,16,0.18);padding:18px 16px;">
                      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Arial,sans-serif;font-size:13px;color:#E4E4E7;font-weight:800;margin-bottom:8px;">
                        Want to go Pro?
                      </div>
                      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Arial,sans-serif;font-size:13px;line-height:1.7;color:#D4D4D8;margin-bottom:14px;">
                        Pulse Pro unlocks the full experience:
                      </div>
                      <ul style="margin:0;padding:0;list-style:none;">
                        ${proFeaturesHtml}
                      </ul>

                      <div style="margin-top:16px;">
                        <a href="${ctaPricing}" style="display:inline-block;background:#E0FE10;color:#0a0a0b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Arial,sans-serif;font-weight:900;font-size:14px;text-decoration:none;padding:12px 16px;border-radius:12px;">
                          See Pro pricing
                        </a>
                        <span style="display:inline-block;margin-left:10px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Arial,sans-serif;font-size:12px;color:#A1A1AA;">
                          Cancel anytime.
                        </span>
                      </div>
                    </div>
                  </div>

                  <div style="padding: 0 22px 24px 22px;">
                    <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Arial,sans-serif;font-size:12px;line-height:1.7;color:#71717A;">
                      If you ever need help, just reply to this email. We read every message.
                      <br/>
                      — Tremaine & the Pulse team
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
  </html>
  `;

  return { subject, html };
}

async function getWelcomeTemplateFromFirestore(): Promise<{ subject: string; html: string } | null> {
  try {
    const db = await getFirestore();
    const snap = await db.collection('email-templates').doc('welcome-v1').get();
    if (!snap.exists) return null;
    const data = snap.data() || {};
    const subject = typeof data.subject === 'string' ? data.subject : '';
    const html = typeof data.html === 'string' ? data.html : '';
    if (!subject || !html) return null;
    return { subject, html };
  } catch (e) {
    console.warn('[send-welcome-email] Failed to load template from Firestore:', e);
    return null;
  }
}

function applyTemplateVars(input: string, vars: { firstName?: string; username?: string }) {
  const firstName = (vars.firstName || '').trim() || 'there';
  const username = (vars.username || '').trim();
  return input
    .replaceAll('{{first_name}}', escapeHtml(firstName))
    .replaceAll('{{firstName}}', escapeHtml(firstName))
    .replaceAll('{{username}}', escapeHtml(username))
    .replaceAll('{{user_name}}', escapeHtml(username));
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
    const { userId, toEmail, firstName, username, role, isTest, subjectOverride, htmlOverride, scheduledAt } = body;

    if (!toEmail) {
      return { statusCode: 400, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ success: false, error: 'Missing toEmail' } satisfies SendResponse) };
    }

    // If we have a userId, enforce idempotency by checking the users doc.
    if (userId && !isTest) {
      try {
        const db = await getFirestore();
        const userRef = db.collection('users').doc(userId);
        const snap = await userRef.get();
        if (snap.exists) {
          const data = snap.data() || {};
          if (data.welcomeEmailSentAt) {
            return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ success: true, skipped: true } satisfies SendResponse) };
          }
        }
      } catch (e) {
        // Non-fatal: still attempt to send
        console.warn('[send-welcome-email] Failed to check idempotency:', e);
      }
    }

    // Template selection priority:
    // 1) Explicit overrides (admin preview/test)
    // 2) Firestore template (admin-editable)
    // 3) Built-in fallback (safe default)
    let subject = (subjectOverride || '').trim();
    let html = (htmlOverride || '').trim();
    if (!subject || !html) {
      const saved = await getWelcomeTemplateFromFirestore();
      if (saved) {
        subject = saved.subject;
        html = saved.html;
      } else {
        const fallback = renderWelcomeEmail({ firstName, username, role });
        subject = fallback.subject;
        html = fallback.html;
      }
    }

    // Apply simple variable replacement for admin-saved templates
    subject = applyTemplateVars(subject, { firstName, username });
    html = applyTemplateVars(html, { firstName, username });

    const payload: any = {
      sender: { name: senderName, email: senderEmail },
      to: [{ email: toEmail, name: firstName || toEmail }],
      subject,
      htmlContent: html,
      replyTo: { email: senderEmail, name: 'Pulse Team' },
      // tracking on by default
      tags: ['user-welcome', isTest ? 'test' : null].filter(Boolean),
    };

    // Optional scheduling per Brevo API (ISO8601)
    if (scheduledAt) {
      const date = new Date(scheduledAt);
      if (!isNaN(date.getTime())) {
        payload.scheduledAt = date.toISOString();
      }
    }

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

    // Mark sent on the user doc (best-effort)
    if (userId && !isTest) {
      try {
        const db = await getFirestore();
        await db.collection('users').doc(userId).set(
          {
            welcomeEmailSentAt: new Date(),
            welcomeEmailProvider: 'brevo',
            welcomeEmailMessageId: data?.messageId || null,
          },
          { merge: true } as any
        );
      } catch (e) {
        console.warn('[send-welcome-email] Failed to update user welcomeEmailSentAt:', e);
      }
    }

    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ success: true, messageId: data?.messageId } satisfies SendResponse) };
  } catch (e: any) {
    return { statusCode: 500, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ success: false, error: e?.message || 'Internal error' } satisfies SendResponse) };
  }
};

