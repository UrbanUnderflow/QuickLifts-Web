import type { Handler } from '@netlify/functions';
import {
  buildEmailDedupeKey,
  sendBrevoTransactionalEmail,
} from './utils/emailSequenceHelpers';
import { escapeHtml } from '../../src/lib/emails/pulsecheckAthleteInviteEmail';

const { verifyFirebaseUser } = require('./lib/pulsecheck-coach-services');
const { COLLECTION, processInviteAcceptedOutbox } = require('./lib/invite-accepted-outbox');

export function renderInviteAcceptedEmail(opts: {
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

  try {
    const identity = await verifyFirebaseUser(event, { authErrorMessage: 'Sign in to retry an enrollment notification.' });
    const token = (event.headers.authorization || event.headers.Authorization || '').replace(/^Bearer\s+/i, '');
    await identity.app.auth().verifyIdToken(token, true);
    if ((await identity.app.firestore().collection('account-closure-jobs').doc(identity.userId).get()).exists) return { statusCode: 403, body: JSON.stringify({ error: 'Account closure is pending.' }) };
    const body = JSON.parse(event.body || '{}');
    const membershipId = typeof body.membershipId === 'string' ? body.membershipId : '';
    if (!membershipId || membershipId.includes('/')) return { statusCode: 400, body: JSON.stringify({ error: 'Membership required.' }) };
    const database = identity.app.firestore();
    const job = await database.collection(COLLECTION).doc(membershipId).get();
    if (!job.exists || job.data()?.athleteUserId !== identity.userId) return { statusCode: 403, body: JSON.stringify({ error: 'Enrollment notification unavailable.' }) };
    const result = await processInviteAcceptedOutbox(database, membershipId, sendCommittedInviteNotification, Date.now(), (uid: string) => identity.app.auth().getUser(uid));
    return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ success: true, ...result }) };
  } catch (error: any) {
    return { statusCode: error.statusCode === 401 || String(error.code || '').startsWith('auth/') ? 401 : 503, headers: corsHeaders, body: JSON.stringify({ error: 'Enrollment notification unavailable.' }) };
  }
};

export async function sendCommittedInviteNotification(input: any) {
  const { subject, html } = renderInviteAcceptedEmail(input);
  const result = await sendBrevoTransactionalEmail({
    toEmail: input.coachEmail, toName: input.coachName || input.coachEmail,
    subject, htmlContent: html, tags: ['pulsecheck', 'invite-accepted'],
    sender: { email: process.env.BREVO_SENDER_EMAIL || 'hello@fitwithpulse.ai', name: 'PulseCheck' },
    idempotencyKey: buildEmailDedupeKey(['pulsecheck-committed-invite-v2', input.id]),
    failClosedOnSuppressionError: true,
  });
  return { ...result, retrySafe: result.error === 'Brevo not configured' || result.error === 'Unable to verify email suppression. Sending stopped for review.' };
}
