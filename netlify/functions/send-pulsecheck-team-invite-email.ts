import type { Handler } from '@netlify/functions';
import { sendBrevoTransactionalEmail } from './utils/emailSequenceHelpers';

/**
 * send-pulsecheck-team-invite-email
 *
 * Sends a branded PulseCheck team-invite email containing a team-access link.
 * Used when a coach/admin invites a staff member onto a team. Redeeming the link
 * adds the recipient to the team with the role encoded on the invite. Mirrors the
 * admin-activation send, on the shared Brevo transactional sender.
 *
 * POST body:
 *   toEmail          (required) – recipient email
 *   activationUrl    (required) – the full team-invite URL
 *   recipientName    (optional) – greeting name
 *   organizationName (optional) – org context
 *   teamName         (optional) – team context
 *   title            (optional) – the invitee's user-facing title (e.g., "Assistant
 *                                 Coach"). Permission/role is admin-facing only and
 *                                 is intentionally NOT shown to the invitee.
 *   senderName       (optional) – the coach/admin issuing the invite
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

function renderTeamInviteEmail(opts: {
  recipientName?: string;
  organizationName?: string;
  teamName?: string;
  title?: string;
  activationUrl: string;
  senderName?: string;
}) {
  const name = (opts.recipientName || '').trim() || 'there';
  const organizationName = (opts.organizationName || 'your organization').trim();
  const teamName = (opts.teamName || '').trim();
  const title = (opts.title || '').trim();
  const activationUrl = opts.activationUrl;
  const senderName = (opts.senderName || 'the PulseCheck team').trim();

  const subject = teamName
    ? `You're invited to join ${teamName} on PulseCheck`
    : `You're invited to join ${organizationName} on PulseCheck`;

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
        You've been invited to join a team on PulseCheck. Accept to get started.
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
                            <td align="center" valign="middle" style="font-size:28px;">🤝</td>
                          </tr>
                        </table>
                        <h1 style="margin:0 0 8px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Arial,sans-serif;font-size:24px;line-height:1.2;color:#000000;font-weight:900;">
                          You're invited to PulseCheck
                        </h1>
                        <p style="margin:0 0 8px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Arial,sans-serif;font-size:16px;line-height:1.6;color:#000000;">
                          Hey ${escapeHtml(name)}, ${escapeHtml(senderName)} invited you to join the team.
                        </p>
                        <p style="margin:0 0 16px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Arial,sans-serif;font-size:14px;line-height:1.6;color:#000000;">
                          ${teamName ? `Team: <span style="font-weight:700;">${escapeHtml(teamName)}</span><br/>` : ''}Organization: <span style="font-weight:700;">${escapeHtml(organizationName)}</span>${title ? `<br/>Title: <span style="font-weight:700;">${escapeHtml(title)}</span>` : ''}
                        </p>
                        <p style="margin:0 0 28px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Arial,sans-serif;font-size:13px;line-height:1.6;color:#52525B;">
                          Accept the invite and sign in with this email to get set up.
                        </p>
                        <a href="${activationUrl}" style="display:inline-block;background:#000000;color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Arial,sans-serif;font-weight:900;font-size:14px;text-decoration:none;padding:14px 32px;border-radius:12px;">
                          ACCEPT INVITE
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
                  <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Arial,sans-serif;font-size:11px;line-height:1.6;color:#52525B;">
                    You received this email because you were invited to a team on <a href="https://fitwithpulse.ai" style="color:#000000;text-decoration:underline;">PulseCheck</a>.
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
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: corsHeaders, body: JSON.stringify({ success: false, error: 'Method not allowed' }) };
  }

  let body: any;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ success: false, error: 'Invalid JSON body' }) };
  }

  // `title` is the invitee's user-facing title; `roleLabel`/`invitedTitle` accepted
  // for backward-compat but the admin-facing permission/role is never shown.
  const { toEmail, activationUrl, recipientName, organizationName, teamName, senderName } = body;
  const title = body.title || body.invitedTitle || '';

  if (!toEmail || !activationUrl) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ success: false, error: 'Missing required fields: toEmail, activationUrl' }),
    };
  }

  try {
    const { subject, html } = renderTeamInviteEmail({
      recipientName,
      organizationName,
      teamName,
      title,
      activationUrl,
      senderName,
    });

    const result = await sendBrevoTransactionalEmail({
      toEmail,
      toName: recipientName || toEmail,
      subject,
      htmlContent: html,
      tags: ['pulsecheck', 'team-invite', 'staff-invite'],
      sender: {
        email: process.env.BREVO_SENDER_EMAIL || 'tre@fitwithpulse.ai',
        name: 'PulseCheck',
      },
      headers: {
        'X-Mailin-custom': JSON.stringify({
          emailType: 'pulsecheck-team-invite',
          organizationName: organizationName || null,
          teamName: teamName || null,
          title: title || null,
        }),
      },
      bypassDailyRecipientLimit: true,
    });

    if (!result.success) {
      return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ success: false, error: result.error }) };
    }

    console.log('[send-pulsecheck-team-invite-email] Sent to:', toEmail, 'messageId:', result.messageId);
    return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ success: true, messageId: result.messageId }) };
  } catch (error: any) {
    console.error('[send-pulsecheck-team-invite-email] Error:', error);
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ success: false, error: error.message || 'Internal error' }) };
  }
};
