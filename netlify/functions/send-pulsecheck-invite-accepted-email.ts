import type { Handler } from '@netlify/functions';
import { sendBrevoTransactionalEmail } from './utils/emailSequenceHelpers';
import { escapeHtml } from '../../src/lib/emails/pulsecheckAthleteInviteEmail';

/**
 * send-pulsecheck-invite-accepted-email
 *
 * Fired when an athlete ACCEPTS (redeems) a PulseCheck team invite. Mirrors the
 * structure of send-pulsecheck-athlete-invite-email.ts (Brevo via the shared
 * helper, CORS/OPTIONS, email-logs handled inside the helper).
 *
 * hello@fitwithpulse.ai is ALWAYS notified. When the inviting coach opted in
 * (notifyCoach === true) and a valid coachEmail is present, the coach is CC'd.
 *
 * POST body:
 *   athleteName      (required) – who accepted
 *   teamName         (required) – team they joined
 *   athleteEmail     (optional) – the athlete's email
 *   organizationName (optional) – org context
 *   role             (optional) – membership role (athlete)
 *   coachName        (optional) – the inviting coach's display name
 *   coachEmail       (optional) – the inviting coach's email (CC target)
 *   notifyCoach      (optional, bool) – opt-in to CC the coach
 *
 * Never throws to the caller in a way that blocks redemption — the caller
 * fires-and-forgets and ignores the response.
 */

const ALWAYS_NOTIFY_EMAIL = 'hello@fitwithpulse.ai';
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function renderInviteAcceptedEmail(opts: {
  athleteName: string;
  athleteEmail?: string;
  teamName: string;
  organizationName?: string;
  role?: string;
  coachName?: string;
}) {
  const athleteName = (opts.athleteName || '').trim() || 'An athlete';
  const athleteEmail = (opts.athleteEmail || '').trim();
  const teamName = (opts.teamName || '').trim() || 'your team';
  const organizationName = (opts.organizationName || '').trim();
  const role = (opts.role || 'athlete').trim() || 'athlete';
  const coachName = (opts.coachName || '').trim();

  const subject = `${athleteName} accepted the ${teamName} invite on PulseCheck`;

  const orgLine = organizationName
    ? ` in <span style="font-weight:700;">${escapeHtml(organizationName)}</span>`
    : '';
  const emailLine = athleteEmail
    ? `<p style="margin:0 0 8px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Arial,sans-serif;font-size:13px;line-height:1.6;color:#52525B;">${escapeHtml(athleteEmail)}</p>`
    : '';
  const invitedByLine = coachName
    ? `<p style="margin:0 0 0 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Arial,sans-serif;font-size:12px;line-height:1.6;color:#52525B;">Invited by ${escapeHtml(coachName)}.</p>`
    : '';

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
        ${escapeHtml(athleteName)} joined ${escapeHtml(teamName)} on PulseCheck.
      </div>
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#ffffff;padding:24px 0;">
        <tr>
          <td align="center" style="padding: 0 16px;">
            <table role="presentation" cellpadding="0" cellspacing="0" width="640" style="max-width:640px;width:100%;">
              <tr>
                <td align="center" style="padding: 6px 8px 18px 8px;">
                  <img src="https://fitwithpulse.ai/pulseCheckIcon.png" alt="PulseCheck" width="64" height="64" style="display:block;width:64px;height:64px;border-radius:14px;" />
                </td>
              </tr>
              <tr>
                <td style="border:1px solid #e4e4e7;background:#ffffff;border-radius:20px;overflow:hidden;">
                  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="padding:32px 22px;">
                    <tr>
                      <td align="center">
                        <table role="presentation" cellpadding="0" cellspacing="0" width="64" height="64" style="width:64px;height:64px;border-radius:50%;background:#f4f4f5;margin-bottom:20px;">
                          <tr>
                            <td align="center" valign="middle" style="font-size:28px;">✅</td>
                          </tr>
                        </table>
                        <h1 style="margin:0 0 8px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Arial,sans-serif;font-size:24px;line-height:1.2;color:#000000;font-weight:900;">
                          ${escapeHtml(athleteName)} joined your team
                        </h1>
                        <p style="margin:0 0 8px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Arial,sans-serif;font-size:16px;line-height:1.6;color:#000000;">
                          <span style="font-weight:700;">${escapeHtml(athleteName)}</span> accepted the invite and joined <span style="font-weight:700;">${escapeHtml(teamName)}</span>${orgLine} as ${escapeHtml(role)} on PulseCheck.
                        </p>
                        ${emailLine}
                        ${invitedByLine}
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
                    Need help? Reply to this email or contact <a href="mailto:hello@fitwithpulse.ai" style="color:#000000;text-decoration:underline;">hello@fitwithpulse.ai</a>.
                  </p>
                  <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Arial,sans-serif;font-size:11px;line-height:1.6;color:#52525B;">
                    You received this because an athlete accepted a team invite on <a href="https://fitwithpulse.ai" style="color:#000000;text-decoration:underline;">PulseCheck</a>.
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
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders, body: '' };
  }

  // Preview mode: GET ?preview=1 renders the REAL template (no send).
  if (event.httpMethod === 'GET' && event.queryStringParameters?.preview) {
    const q = event.queryStringParameters || {};
    const { html } = renderInviteAcceptedEmail({
      athleteName: q.athleteName || 'Jordan Lee',
      athleteEmail: q.athleteEmail || 'jordan@school.edu',
      teamName: q.teamName || "Men's Track & Field",
      organizationName: q.organizationName || 'Riverside Athletics',
      role: q.role || 'athlete',
      coachName: q.coachName || 'Coach Taylor',
    });
    return {
      statusCode: 200,
      headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' },
      body: html,
    };
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

  const athleteName = (body.athleteName || '').trim();
  const teamName = (body.teamName || '').trim();
  const athleteEmail = (body.athleteEmail || '').trim();
  const organizationName = (body.organizationName || '').trim();
  const role = (body.role || '').trim();
  const coachName = (body.coachName || '').trim();
  const coachEmail = (body.coachEmail || '').trim();
  const notifyCoach = body.notifyCoach === true;

  if (!athleteName || !teamName) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ success: false, error: 'Missing required fields: athleteName, teamName' }),
    };
  }

  // CC the inviting coach only when they opted in AND we have a valid address
  // that isn't the always-notify inbox (avoid a duplicate recipient).
  const ccCoach =
    notifyCoach &&
    !!coachEmail &&
    EMAIL_REGEX.test(coachEmail) &&
    coachEmail.toLowerCase() !== ALWAYS_NOTIFY_EMAIL;

  try {
    const { subject, html } = renderInviteAcceptedEmail({
      athleteName,
      athleteEmail,
      teamName,
      organizationName,
      role,
      coachName,
    });

    const result = await sendBrevoTransactionalEmail({
      toEmail: ALWAYS_NOTIFY_EMAIL,
      toName: 'PulseCheck',
      subject,
      htmlContent: html,
      ...(ccCoach ? { cc: [{ email: coachEmail, name: coachName || coachEmail }] } : {}),
      tags: ['pulsecheck', 'team-invite', 'invite-accepted'],
      sender: {
        email: process.env.BREVO_SENDER_EMAIL || 'hello@fitwithpulse.ai',
        name: 'PulseCheck',
      },
      replyTo: { email: 'hello@fitwithpulse.ai', name: 'PulseCheck' },
      headers: {
        'X-Mailin-custom': JSON.stringify({
          emailType: 'pulsecheck-invite-accepted',
          organizationName: organizationName || null,
          teamName: teamName || null,
          notifiedCoach: ccCoach || false,
        }),
      },
      bypassDailyRecipientLimit: true,
    });

    if (!result.success) {
      return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ success: false, error: result.error }) };
    }

    console.log('[send-pulsecheck-invite-accepted-email] Sent for:', athleteName, 'team:', teamName, 'ccCoach:', ccCoach, 'messageId:', result.messageId);
    return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ success: true, messageId: result.messageId }) };
  } catch (error: any) {
    console.error('[send-pulsecheck-invite-accepted-email] Error:', error);
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ success: false, error: error.message || 'Internal error' }) };
  }
};
