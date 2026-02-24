import type { Handler } from '@netlify/functions';
import { initAdmin } from './utils/getServiceAccount';

/**
 * send-onboarding-email
 *
 * Sends a branded Pulse onboarding email with the set-password link.
 * Uses Mailgun (consistent with send-password-reset-email).
 *
 * POST body:
 *   toEmail        (required) – recipient email
 *   firstName      (optional) – greeting name
 *   username       (optional) – their claimed username
 *   onboardingLink (required) – the full URL to set their password
 *   adminName      (optional) – the admin who onboarded them (for personal touch)
 */

function escapeHtml(input: string) {
  if (!input) return '';
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function renderOnboardingEmail(opts: {
  firstName?: string;
  username?: string;
  onboardingLink: string;
  adminName?: string;
}) {
  const name = (opts.firstName || '').trim() || 'there';
  const username = (opts.username || '').trim();
  const onboardingLink = opts.onboardingLink;
  const adminName = (opts.adminName || 'the Pulse team').trim();

  const subject = 'Welcome to Pulse — Set Your Password';

  const html = `
  <!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>${escapeHtml(subject)}</title>
    </head>
    <body style="margin:0;padding:0;background:#ffffff;">
      <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
        Your Pulse account is ready. Set your password to get started.
      </div>

      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#ffffff;padding:24px 0;">
        <tr>
          <td align="center" style="padding: 0 16px;">
            <table role="presentation" cellpadding="0" cellspacing="0" width="640" style="max-width:640px;width:100%;">
              <tr>
                <td align="center" style="padding: 6px 8px 18px 8px;">
                  <table role="presentation" cellpadding="0" cellspacing="0">
                    <tr>
                      <td align="center" valign="middle">
                        <img src="https://fitwithpulse.ai/pulse-logo.svg" alt="Pulse" width="140" height="auto" style="display:block;width:140px;height:auto;" />
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <tr>
                <td style="border:1px solid #e4e4e7;background:#ffffff;border-radius:20px;overflow:hidden;">
                  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="padding:32px 22px;">
                    <tr>
                      <td align="center">
                        <!-- Welcome Icon -->
                        <table role="presentation" cellpadding="0" cellspacing="0" width="64" height="64" style="width:64px;height:64px;border-radius:50%;background:#f4f4f5;margin-bottom:20px;">
                          <tr>
                            <td align="center" valign="middle" style="font-size:28px;">
                              🎉
                            </td>
                          </tr>
                        </table>
                        
                        <!-- Greeting -->
                        <h1 style="margin:0 0 8px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Arial,sans-serif;font-size:24px;line-height:1.2;color:#000000;font-weight:900;">
                          Welcome to Pulse!
                        </h1>
                        
                        <p style="margin:0 0 8px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Arial,sans-serif;font-size:16px;line-height:1.6;color:#000000;">
                          Hey ${escapeHtml(name)}, your account has been created by ${escapeHtml(adminName)}.
                        </p>
                        
                        ${username ? `
                        <p style="margin:0 0 16px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Arial,sans-serif;font-size:14px;line-height:1.6;color:#000000;">
                          Your username is <span style="font-weight:700;">@${escapeHtml(username)}</span>
                        </p>
                        ` : ''}
                        
                        <!-- Message -->
                        <p style="margin:0 0 8px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Arial,sans-serif;font-size:15px;line-height:1.6;color:#000000;">
                          To complete your setup, just set a password below. Then you can sign in from the Pulse app on your phone.
                        </p>
                        <p style="margin:0 0 28px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Arial,sans-serif;font-size:13px;line-height:1.6;color:#52525B;">
                          This link expires in 7 days for your security.
                        </p>
                        
                        <!-- CTA Button -->
                        <a href="${onboardingLink}" style="display:inline-block;background:#000000;color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Arial,sans-serif;font-weight:900;font-size:14px;text-decoration:none;padding:14px 32px;border-radius:12px;">
                          SET YOUR PASSWORD
                        </a>
                        
                        <p style="margin:24px 0 0 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Arial,sans-serif;font-size:12px;line-height:1.6;color:#52525B;">
                          After setting your password, open the Pulse app and sign in with your email and password. You can also link Apple or Google sign-in later from your settings.
                        </p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <tr>
                <td align="center" style="padding:24px 22px 0 22px;">
                  <p style="margin:0 0 12px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Arial,sans-serif;font-size:13px;color:#000000;">
                    Follow Pulse
                  </p>
                  <table role="presentation" cellpadding="0" cellspacing="0">
                    <tr>
                      <td align="center" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Arial,sans-serif;font-size:12px;">
                        <a href="https://instagram.com/fitwithpulse" style="color:#52525B;text-decoration:none;padding:0 8px;">Instagram</a>
                        <span style="color:#e4e4e7;">•</span>
                        <a href="https://youtube.com/@fitwithpulse" style="color:#52525B;text-decoration:none;padding:0 8px;">YouTube</a>
                        <span style="color:#e4e4e7;">•</span>
                        <a href="https://tiktok.com/@fitwithpulse" style="color:#52525B;text-decoration:none;padding:0 8px;">TikTok</a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <tr>
                <td align="center" style="padding:24px 8px 0 8px;">
                  <p style="margin:0 0 8px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Arial,sans-serif;font-size:11px;line-height:1.6;color:#52525B;">
                    © ${new Date().getFullYear()} Pulse Intelligence Labs, Inc.
                  </p>
                  <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Arial,sans-serif;font-size:11px;line-height:1.6;color:#52525B;">
                    You received this email because an account was created for you on <a href="https://fitwithpulse.ai" style="color:#000000;text-decoration:underline;">Pulse</a>.
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

async function sendMailgunEmail(
  to: string,
  subject: string,
  html: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const apiKey = process.env.MAILGUN_API_KEY || '';
  const domain = process.env.MAILGUN_DOMAIN || '';
  const fromEmail = process.env.MAILGUN_FROM_EMAIL || 'Pulse <noreply@fitwithpulse.ai>';

  if (!apiKey || !domain) {
    console.error('[sendMailgunEmail] Missing Mailgun credentials');
    return { success: false, error: 'Missing Mailgun credentials' };
  }

  const formData = new URLSearchParams();
  formData.append('from', fromEmail);
  formData.append('to', to);
  formData.append('subject', subject);
  formData.append('html', html);

  const response = await fetch(`https://api.mailgun.net/v3/${domain}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`api:${apiKey}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: formData.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[sendMailgunEmail] Mailgun error:', errorText);
    return { success: false, error: errorText };
  }

  const json = await response.json();
  return { success: true, messageId: json.id };
}

export const handler: Handler = async (event) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ success: false, error: 'Method not allowed' }),
    };
  }

  let body: any;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ success: false, error: 'Invalid JSON body' }),
    };
  }

  const { toEmail, firstName, username, onboardingLink, adminName } = body;

  if (!toEmail || !onboardingLink) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ success: false, error: 'Missing required fields: toEmail, onboardingLink' }),
    };
  }

  try {
    const { subject, html } = renderOnboardingEmail({
      firstName,
      username,
      onboardingLink,
      adminName,
    });

    const result = await sendMailgunEmail(toEmail, subject, html);

    if (!result.success) {
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({ success: false, error: result.error }),
      };
    }

    console.log('[send-onboarding-email] Sent to:', toEmail, 'messageId:', result.messageId);

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ success: true, messageId: result.messageId }),
    };
  } catch (error: any) {
    console.error('[send-onboarding-email] Error:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ success: false, error: error.message || 'Internal error' }),
    };
  }
};
