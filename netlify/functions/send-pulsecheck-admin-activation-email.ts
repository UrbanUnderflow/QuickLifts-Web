import type { Handler } from '@netlify/functions';
import { sendBrevoTransactionalEmail } from './utils/emailSequenceHelpers';

/**
 * send-pulsecheck-admin-activation-email
 *
 * Sends a branded PulseCheck admin-activation email containing the activation
 * link for a team admin. This is a deliberate, manually-triggered send from the
 * provisioning console — admins control exactly when the recipient is invited in.
 * Uses the shared Brevo transactional sender.
 *
 * POST body:
 *   toEmail          (required) – recipient admin email
 *   activationUrl    (required) – the full admin-activation URL
 *   recipientName    (optional) – greeting name for the recipient
 *   organizationName (optional) – org being activated
 *   teamName         (optional) – team being activated
 *   senderName       (optional) – the admin issuing the invite (for a personal touch)
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

function renderActivationEmail(opts: {
  recipientName?: string;
  organizationName?: string;
  teamName?: string;
  activationUrl: string;
  senderName?: string;
}) {
  const name = (opts.recipientName || '').trim() || 'there';
  const organizationName = (opts.organizationName || 'your organization').trim();
  const teamName = (opts.teamName || '').trim();
  const activationUrl = opts.activationUrl;
  const senderName = (opts.senderName || 'the PulseCheck team').trim();

  const subject = `Activate your PulseCheck admin access for ${organizationName}`;

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
        Your PulseCheck admin workspace is ready. Activate your access to get started.
      </div>

      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#ffffff;padding:24px 0;">
        <tr>
          <td align="center" style="padding: 0 16px;">
            <table role="presentation" cellpadding="0" cellspacing="0" width="640" style="max-width:640px;width:100%;">
              <tr>
                <td align="center" style="padding: 6px 8px 18px 8px;">
                  <img src="https://fitwithpulse.ai/pulse-logo.svg" alt="PulseCheck" width="140" height="auto" style="display:block;width:140px;height:auto;" />
                </td>
              </tr>

              <tr>
                <td style="border:1px solid #e4e4e7;background:#ffffff;border-radius:20px;overflow:hidden;">
                  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="padding:32px 22px;">
                    <tr>
                      <td align="center">
                        <table role="presentation" cellpadding="0" cellspacing="0" width="64" height="64" style="width:64px;height:64px;border-radius:50%;background:#f4f4f5;margin-bottom:20px;">
                          <tr>
                            <td align="center" valign="middle" style="font-size:28px;">
                              🧠
                            </td>
                          </tr>
                        </table>

                        <h1 style="margin:0 0 8px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Arial,sans-serif;font-size:24px;line-height:1.2;color:#000000;font-weight:900;">
                          You're invited to PulseCheck
                        </h1>

                        <p style="margin:0 0 8px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Arial,sans-serif;font-size:16px;line-height:1.6;color:#000000;">
                          Hey ${escapeHtml(name)}, the PulseCheck team has set up an admin workspace for you.
                        </p>

                        <p style="margin:0 0 16px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Arial,sans-serif;font-size:14px;line-height:1.6;color:#000000;">
                          Organization: <span style="font-weight:700;">${escapeHtml(organizationName)}</span>${
                            teamName
                              ? `<br/>Team: <span style="font-weight:700;">${escapeHtml(teamName)}</span>`
                              : ''
                          }
                        </p>

                        <p style="margin:0 0 8px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Arial,sans-serif;font-size:15px;line-height:1.6;color:#000000;">
                          Activate your access to manage your team, athletes, and PulseCheck reporting.
                        </p>
                        <p style="margin:0 0 28px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Arial,sans-serif;font-size:13px;line-height:1.6;color:#52525B;">
                          Sign in with this email when you activate.
                        </p>

                        <a href="${activationUrl}" style="display:inline-block;background:#000000;color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Arial,sans-serif;font-weight:900;font-size:14px;text-decoration:none;padding:14px 32px;border-radius:12px;">
                          ACTIVATE ADMIN ACCESS
                        </a>

                        <p style="margin:24px 0 0 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Arial,sans-serif;font-size:12px;line-height:1.6;color:#52525B;">
                          If the button doesn't work, copy and paste this link into your browser:<br/>
                          <span style="word-break:break-all;color:#000000;">${escapeHtml(activationUrl)}</span>
                        </p>
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
                  <p style="margin:0 0 8px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Arial,sans-serif;font-size:11px;line-height:1.6;color:#52525B;">
                    Need to reach us? Reply to this email or contact <a href="mailto:hello@fitwithpulse.ai" style="color:#000000;text-decoration:underline;">hello@fitwithpulse.ai</a>.
                  </p>
                  <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Arial,sans-serif;font-size:11px;line-height:1.6;color:#52525B;">
                    You received this email because an admin workspace was created for you on <a href="https://fitwithpulse.ai" style="color:#000000;text-decoration:underline;">PulseCheck</a>.
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

export const handler: Handler = async (event) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders, body: '' };
  }

  // Preview mode: GET ?preview=1 renders the REAL template (no send) so the exact
  // admin-activation email is viewable in a browser — no Brevo key required.
  // Override sample copy via query string (recipientName, organizationName, etc.).
  if (event.httpMethod === 'GET' && event.queryStringParameters?.preview) {
    const q = event.queryStringParameters || {};
    const { html } = renderActivationEmail({
      recipientName: q.recipientName || 'Tremaine Grant',
      organizationName: q.organizationName || 'The Athletic Mind Council',
      teamName: q.teamName || 'Track And Field',
      senderName: q.senderName || 'the PulseCheck team',
      activationUrl: q.activationUrl || 'https://fitwithpulse.ai/PulseCheck/admin-activation/preview-token',
    });
    return {
      statusCode: 200,
      headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' },
      body: html,
    };
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

  const { toEmail, activationUrl, recipientName, organizationName, teamName, senderName } = body;

  if (!toEmail || !activationUrl) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ success: false, error: 'Missing required fields: toEmail, activationUrl' }),
    };
  }

  try {
    const { subject, html } = renderActivationEmail({
      recipientName,
      organizationName,
      teamName,
      activationUrl,
      senderName,
    });

    const result = await sendBrevoTransactionalEmail({
      toEmail,
      toName: recipientName || toEmail,
      subject,
      htmlContent: html,
      tags: ['pulsecheck', 'admin-activation', 'manual-admin-send'],
      sender: {
        email: process.env.BREVO_SENDER_EMAIL || 'tre@fitwithpulse.ai',
        name: 'PulseCheck',
      },
      // Route replies to the shared inbox, not the inviter's personal address.
      replyTo: { email: 'hello@fitwithpulse.ai', name: 'PulseCheck' },
      headers: {
        'X-Mailin-custom': JSON.stringify({
          emailType: 'pulsecheck-admin-activation',
          organizationName: organizationName || null,
          teamName: teamName || null,
        }),
      },
      bypassDailyRecipientLimit: true,
    });

    if (!result.success) {
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({ success: false, error: result.error }),
      };
    }

    console.log('[send-pulsecheck-admin-activation-email] Sent to:', toEmail, 'messageId:', result.messageId);

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ success: true, messageId: result.messageId }),
    };
  } catch (error: any) {
    console.error('[send-pulsecheck-admin-activation-email] Error:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ success: false, error: error.message || 'Internal error' }),
    };
  }
};
