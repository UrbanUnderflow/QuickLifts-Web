const { admin, getFirebaseAdminApp, headers, initializeFirebaseAdmin } = require('./config/firebase');
const { buildEmailDedupeKey, sendBrevoTransactionalEmail } = require('./utils/sendBrevoTransactionalEmail');

/**
 * send-pulsecheck-athlete-onboarded-email
 *
 * Notifies a team's coaches/admins when an athlete completes onboarding, so the
 * inviting coach knows their athlete is set up (previously there was no signal).
 * Recipients = active team-admin / coach / performance-staff on the team — the
 * same convention as the Sports Intelligence report send. Idempotent per
 * (athlete, recipient) via the email-logs dedupe key.
 *
 * POST body: { organizationId, teamId, athleteUserId, athleteName, athleteEmail }
 */
const TEAM_MEMBERSHIPS_COLLECTION = 'pulsecheck-team-memberships';
const ALLOWED_RECIPIENT_ROLES = ['team-admin', 'coach', 'performance-staff'];

const RESPONSE_HEADERS = {
  ...headers,
  'Content-Type': 'application/json',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(statusCode, body) {
  return { statusCode, headers: RESPONSE_HEADERS, body: JSON.stringify(body) };
}
function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}
function normalizeEmail(value) {
  return normalizeString(value).toLowerCase();
}
function escapeHtml(value) {
  return normalizeString(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

async function resolveUserEmail(db, userId) {
  const normalizedUserId = normalizeString(userId);
  if (!normalizedUserId) return '';
  const userSnap = await db.collection('users').doc(normalizedUserId).get();
  if (!userSnap.exists) return '';
  return normalizeEmail(userSnap.data()?.email);
}

async function listRecipients(db, teamId, excludeEmail) {
  const snapshot = await db
    .collection(TEAM_MEMBERSHIPS_COLLECTION)
    .where('teamId', '==', teamId)
    .where('status', '==', 'active')
    .where('role', 'in', ALLOWED_RECIPIENT_ROLES)
    .get();

  const byEmail = new Map();
  for (const docSnap of snapshot.docs || []) {
    const data = docSnap.data() || {};
    const email = normalizeEmail(data.email) || (await resolveUserEmail(db, data.userId));
    if (!email || email === excludeEmail || byEmail.has(email)) continue;
    byEmail.set(email, {
      email,
      role: normalizeString(data.role),
      name: normalizeString(data.displayName || data.name || data.title) || email,
    });
  }
  return Array.from(byEmail.values());
}

function renderAthleteOnboardedEmail({ athleteName, athleteEmail, teamName, organizationName }) {
  const name = escapeHtml(athleteName) || 'An athlete';
  const subject = `${athleteName || 'An athlete'} finished onboarding — ${teamName || 'your team'}`;
  const dashboardUrl = 'https://fitwithpulse.ai/coach/dashboard';
  const html = `
  <!doctype html>
  <html>
    <head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>${escapeHtml(subject)}</title></head>
    <body style="margin:0;padding:0;background:#ffffff;">
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#ffffff;padding:24px 0;">
        <tr><td align="center" style="padding:0 16px;">
          <table role="presentation" cellpadding="0" cellspacing="0" width="640" style="max-width:640px;width:100%;">
            <tr><td align="center" style="padding:6px 8px 18px 8px;">
              <img src="https://fitwithpulse.ai/pulseCheckIcon.png" alt="PulseCheck" width="64" height="64" style="display:block;width:64px;height:64px;border-radius:14px;" />
            </td></tr>
            <tr><td style="border:1px solid #e4e4e7;background:#ffffff;border-radius:20px;overflow:hidden;">
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="padding:32px 22px;">
                <tr><td align="center">
                  <table role="presentation" cellpadding="0" cellspacing="0" width="64" height="64" style="width:64px;height:64px;border-radius:50%;background:#f4f4f5;margin-bottom:20px;"><tr><td align="center" valign="middle" style="font-size:28px;">✅</td></tr></table>
                  <h1 style="margin:0 0 8px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Arial,sans-serif;font-size:24px;line-height:1.2;color:#000000;font-weight:900;">An athlete is set up</h1>
                  <p style="margin:0 0 8px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Arial,sans-serif;font-size:16px;line-height:1.6;color:#000000;">
                    <span style="font-weight:700;">${name}</span> just finished onboarding for <span style="font-weight:700;">${escapeHtml(teamName) || 'your team'}</span>.
                  </p>
                  <p style="margin:0 0 24px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Arial,sans-serif;font-size:14px;line-height:1.6;color:#52525B;">
                    ${escapeHtml(athleteEmail) ? `${escapeHtml(athleteEmail)} · ` : ''}${escapeHtml(organizationName) || ''}<br/>They're on your roster and ready to start checking in.
                  </p>
                  <a href="${dashboardUrl}" style="display:inline-block;background:#000000;color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Arial,sans-serif;font-weight:900;font-size:14px;text-decoration:none;padding:14px 32px;border-radius:12px;">OPEN YOUR DASHBOARD</a>
                </td></tr>
              </table>
            </td></tr>
            <tr><td align="center" style="padding:24px 8px 0 8px;">
              <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Arial,sans-serif;font-size:11px;line-height:1.6;color:#52525B;">
                You received this because you coach or manage a team on <a href="https://fitwithpulse.ai" style="color:#000000;text-decoration:underline;">PulseCheck</a>.
              </p>
            </td></tr>
          </table>
        </td></tr>
      </table>
    </body>
  </html>`;
  return { subject, html };
}

exports.handler = async function handler(event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: RESPONSE_HEADERS, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return json(405, { success: false, error: 'Method not allowed' });
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return json(400, { success: false, error: 'Invalid JSON body' });
  }

  const teamId = normalizeString(body.teamId);
  const athleteUserId = normalizeString(body.athleteUserId);
  const athleteName = normalizeString(body.athleteName);
  const athleteEmail = normalizeEmail(body.athleteEmail);
  if (!teamId) return json(400, { success: false, error: 'Missing teamId' });

  try {
    initializeFirebaseAdmin({ headers: event.headers || {} });
    const adminApp = getFirebaseAdminApp({ headers: event.headers || {} });
    const db = admin.firestore(adminApp);

    // Resolve team + org names for the email body.
    let teamName = 'your team';
    let organizationName = '';
    try {
      const teamSnap = await db.collection('pulsecheck-teams').doc(teamId).get();
      teamName = normalizeString(teamSnap.data()?.displayName) || teamName;
      const organizationId = normalizeString(body.organizationId) || normalizeString(teamSnap.data()?.organizationId);
      if (organizationId) {
        const orgSnap = await db.collection('pulsecheck-organizations').doc(organizationId).get();
        organizationName = normalizeString(orgSnap.data()?.displayName);
      }
    } catch (error) {
      console.warn('[send-pulsecheck-athlete-onboarded-email] name lookup failed:', error?.message || error);
    }

    // Notify coaches/admins — never the athlete themselves.
    const recipients = await listRecipients(db, teamId, athleteEmail);
    if (recipients.length === 0) {
      return json(200, { success: true, sent: 0, note: 'No coach/admin recipients on team' });
    }

    const { subject, html } = renderAthleteOnboardedEmail({ athleteName, athleteEmail, teamName, organizationName });

    let sent = 0;
    for (const recipient of recipients) {
      const dedupeKey = buildEmailDedupeKey(['athlete-onboarded-v1', teamId, athleteUserId || athleteEmail, recipient.email]);
      try {
        const result = await sendBrevoTransactionalEmail({
          toEmail: recipient.email,
          toName: recipient.name,
          subject,
          htmlContent: html,
          tags: ['pulsecheck', 'athlete-onboarded', 'coach-notification'],
          sender: { email: process.env.BREVO_SENDER_EMAIL || 'tre@fitwithpulse.ai', name: 'PulseCheck' },
          replyTo: { email: 'hello@fitwithpulse.ai', name: 'PulseCheck' },
          idempotencyKey: dedupeKey,
          idempotencyMetadata: { kind: 'athlete-onboarded', teamId, athleteUserId },
        });
        if (result?.success) sent += 1;
      } catch (error) {
        console.error('[send-pulsecheck-athlete-onboarded-email] send failed for', recipient.email, error?.message || error);
      }
    }

    return json(200, { success: true, sent, recipients: recipients.length });
  } catch (error) {
    console.error('[send-pulsecheck-athlete-onboarded-email] Error:', error);
    return json(500, { success: false, error: error?.message || 'Internal error' });
  }
};
