/**
 * Send a coach-facing escalation notification email via Brevo.
 *
 * IMPORTANT:
 * - Do NOT include athlete message content or sensitive details.
 * - Keep copy coach-friendly and action-oriented.
 *
 * Env:
 * - BREVO_MARKETING_KEY (preferred) or BREVO_API_KEY
 * - BREVO_SENDER_EMAIL (optional)
 * - BREVO_SENDER_NAME (optional)
 * - SITE_URL (optional) e.g. https://fitwithpulse.ai
 */
const BREVO_API_KEY = process.env.BREVO_MARKETING_KEY || process.env.BREVO_API_KEY;
const SENDER_EMAIL = process.env.BREVO_SENDER_EMAIL || 'no-reply@fitwithpulse.ai';
const SENDER_NAME = process.env.BREVO_SENDER_NAME || 'Pulse';

function escapeHtml(input) {
  if (!input) return '';
  return String(input)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function tierLabel(tier) {
  if (tier === 1) return 'Tier 1 (Coach Review)';
  if (tier === 2) return 'Tier 2 (Clinical Handoff — Consent-Based)';
  if (tier === 3) return 'Tier 3 (Clinical Handoff — Immediate)';
  return 'Tier 0 (None)';
}

function tierPrimaryMessage(tier) {
  if (tier === 1) {
    return `An athlete you coach had a conversation today with Nora that we felt should be escalated to you for review.`;
  }
  if (tier === 2 || tier === 3) {
    return `An athlete you coach had a Tier ${tier} escalation event today. We initiated a handoff to a clinical professional.`;
  }
  return `An athlete you coach had a conversation today with Nora.`;
}

function renderHtml({ coachName, athleteName, tier, dashboardUrl }) {
  const safeCoachName = escapeHtml(coachName || 'Coach');
  const safeAthleteName = escapeHtml(athleteName || 'An athlete');
  const label = tierLabel(tier);
  const primary = tierPrimaryMessage(tier);

  const tierGuide = `
    <div style="margin-top:16px;padding:14px 14px;border-radius:14px;background:rgba(0,0,0,0.05);border:1px solid rgba(0,0,0,0.08);">
      <div style="font-weight:800;margin-bottom:8px;">What the tiers mean</div>
      <ul style="margin:0;padding-left:18px;line-height:1.6;">
        <li><strong>Tier 1 (Coach Review):</strong> Monitor-only concern. Please review and consider reaching out to the athlete.</li>
        <li><strong>Tier 2 (Clinical Handoff — Consent-Based):</strong> Elevated concern. After consent, we hand off to a clinical professional. You’re notified for awareness and support.</li>
        <li><strong>Tier 3 (Clinical Handoff — Immediate):</strong> Critical concern. Immediate clinical handoff is initiated. You’re notified for awareness and support.</li>
      </ul>
      <div style="margin-top:10px;color:#444;font-size:12px;">
        Note: This email intentionally excludes conversation details to protect athlete privacy.
      </div>
    </div>
  `;

  const cta = dashboardUrl
    ? `
      <div style="margin:20px 0 0 0;">
        <a href="${dashboardUrl}"
           style="display:inline-block;background:#E0FE10;color:#000;text-decoration:none;padding:12px 18px;border-radius:12px;font-weight:800">
          Open Coach Dashboard
        </a>
      </div>
    `
    : '';

  return `<!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>${escapeHtml(label)}</title>
    </head>
    <body style="margin:0;padding:0;background:#ffffff;">
      <div style="font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #111; padding: 20px;">
        <div style="font-weight:900;font-size:18px;margin:0 0 8px 0;">Pulse Coach Alert</div>
        <div style="display:inline-block;padding:6px 10px;border-radius:999px;background:rgba(0,0,0,0.06);font-weight:800;font-size:12px;">
          ${escapeHtml(label)}
        </div>
        <h2 style="margin:14px 0 8px 0;font-size:18px;">
          Hi ${safeCoachName},
        </h2>
        <p style="margin:0 0 10px 0;">
          ${escapeHtml(primary)}
        </p>
        <p style="margin:0 0 10px 0;color:#333;">
          Athlete: <strong>${safeAthleteName}</strong>
        </p>
        ${cta}
        ${tierGuide}
        <p style="margin-top:18px; color:#666; font-size:12px">
          This is an automated notification from Pulse.
        </p>
      </div>
    </body>
  </html>`;
}

async function sendCoachEscalationEmail({ coachEmail, coachName, athleteName, tier, siteUrl }) {
  if (!BREVO_API_KEY) {
    console.warn('[sendCoachEscalationEmail] Brevo not configured (missing BREVO_MARKETING_KEY/BREVO_API_KEY)');
    return { success: false, skipped: true, reason: 'brevo_not_configured' };
  }
  if (!coachEmail) {
    return { success: false, skipped: true, reason: 'missing_coach_email' };
  }

  const baseUrl = (siteUrl || process.env.SITE_URL || '').trim().replace(/\/+$/, '');
  const dashboardUrl = baseUrl ? `${baseUrl}/coach/dashboard` : '';

  const subject =
    tier === 1
      ? `Coach Alert: Athlete check-in flagged (Tier 1)`
      : tier === 2
        ? `Coach Alert: Tier 2 escalation event (clinical handoff)`
        : tier === 3
          ? `Coach Alert: Tier 3 escalation event (clinical handoff)`
          : `Coach Alert: Athlete check-in update`;

  const htmlContent = renderHtml({ coachName, athleteName, tier, dashboardUrl });

  const payload = {
    sender: { name: SENDER_NAME, email: SENDER_EMAIL },
    to: [{ email: coachEmail, name: coachName || 'Coach' }],
    subject,
    htmlContent,
    replyTo: { name: 'Pulse Team', email: SENDER_EMAIL },
    tags: ['coach-escalation', `tier-${tier}`].filter(Boolean),
  };

  const resp = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'api-key': BREVO_API_KEY,
    },
    body: JSON.stringify(payload),
  });

  if (!resp.ok) {
    const errTxt = await resp.text().catch(() => '');
    console.error('[sendCoachEscalationEmail] Brevo send failed:', resp.status, errTxt);
    return { success: false, status: resp.status, error: errTxt || 'brevo_send_failed' };
  }

  const data = await resp.json().catch(() => ({}));
  return { success: true, messageId: data?.messageId };
}

module.exports = { sendCoachEscalationEmail };

