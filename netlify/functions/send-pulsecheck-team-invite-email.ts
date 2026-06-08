import type { Handler } from '@netlify/functions';
import { sendBrevoTransactionalEmail } from './utils/emailSequenceHelpers';
import { renderTeamInviteEmail } from '../../src/lib/emails/pulsecheckTeamInviteEmail';

/**
 * send-pulsecheck-team-invite-email
 *
 * Sends a branded PulseCheck team-invite email containing a team-access link.
 * Used when a coach/admin invites a staff member onto a team. Redeeming the link
 * adds the recipient to the team with the role encoded on the invite. Mirrors the
 * admin-activation send, on the shared Brevo transactional sender.
 *
 * The email template itself lives in src/lib/emails/pulsecheckTeamInviteEmail.ts
 * so the live preview (src/pages/api/pulsecheck/preview/team-invite-email.ts)
 * renders the exact same HTML — one source of truth, no drift.
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
  // email a staff member receives is always viewable — the source of truth, not a
  // hand-rebuilt copy. Override any field via query string (recipientName,
  // organizationName, teamName, title, senderName, activationUrl).
  if (event.httpMethod === 'GET' && event.queryStringParameters?.preview) {
    const q = event.queryStringParameters || {};
    const { html } = renderTeamInviteEmail({
      recipientName: q.recipientName || 'Jordan',
      organizationName: q.organizationName || 'Riverside Athletics',
      teamName: q.teamName || "Men's Track & Field",
      title: q.title || 'Assistant Coach',
      senderName: q.senderName || 'Coach Taylor',
      activationUrl: q.activationUrl || 'https://fitwithpulse.ai/PulseCheck/team-invite/preview-token',
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
