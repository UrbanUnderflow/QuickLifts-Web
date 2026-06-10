import type { Handler } from '@netlify/functions';
import { sendBrevoTransactionalEmail } from './utils/emailSequenceHelpers';
import { renderAthleteInviteEmail } from '../../src/lib/emails/pulsecheckAthleteInviteEmail';

/**
 * send-pulsecheck-athlete-invite-email
 *
 * Sends the branded PulseCheck ATHLETE invite email (app-first copy) containing a
 * team-access link. Used when a coach invites an athlete from the dashboard. The
 * template lives in src/lib/emails/pulsecheckAthleteInviteEmail.ts so the live
 * preview (src/pages/api/pulsecheck/preview/athlete-invite-email.ts) renders the
 * exact same HTML — one source of truth.
 *
 * POST body:
 *   toEmail          (required) – recipient email
 *   activationUrl    (required) – the full team-invite URL (routes athletes to app)
 *   recipientName    (optional) – greeting name
 *   organizationName (optional) – org context
 *   teamName         (optional) – team context
 *   senderName       (optional) – the coach issuing the invite
 *
 * GET ?preview=1 renders the real template (no send) for viewing.
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
  // email an athlete receives is viewable. Override sample copy via query string.
  if (event.httpMethod === 'GET' && event.queryStringParameters?.preview) {
    const q = event.queryStringParameters || {};
    const { html } = renderAthleteInviteEmail({
      recipientName: q.recipientName || 'Jordan',
      organizationName: q.organizationName || 'Riverside Athletics',
      teamName: q.teamName || "Men's Track & Field",
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

  const { toEmail, activationUrl, recipientName, organizationName, teamName, senderName } = body;

  if (!toEmail || !activationUrl) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ success: false, error: 'Missing required fields: toEmail, activationUrl' }),
    };
  }

  try {
    const { subject, html } = renderAthleteInviteEmail({
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
      tags: ['pulsecheck', 'team-invite', 'athlete-invite'],
      sender: {
        email: process.env.BREVO_SENDER_EMAIL || 'tre@fitwithpulse.ai',
        name: 'PulseCheck',
      },
      // Route replies to the shared inbox, not the inviting coach's personal address.
      replyTo: { email: 'hello@fitwithpulse.ai', name: 'PulseCheck' },
      headers: {
        'X-Mailin-custom': JSON.stringify({
          emailType: 'pulsecheck-athlete-invite',
          organizationName: organizationName || null,
          teamName: teamName || null,
        }),
      },
      bypassDailyRecipientLimit: true,
    });

    if (!result.success) {
      return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ success: false, error: result.error }) };
    }

    console.log('[send-pulsecheck-athlete-invite-email] Sent to:', toEmail, 'messageId:', result.messageId);
    return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ success: true, messageId: result.messageId }) };
  } catch (error: any) {
    console.error('[send-pulsecheck-athlete-invite-email] Error:', error);
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ success: false, error: error.message || 'Internal error' }) };
  }
};
