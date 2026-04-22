// Receives a PulseCheck department-pilot request from the marketing page and
// fires a transactional email via Brevo to tre@fitwithpulse.ai with
// bobby@fitwithpulse.ai cc'd.
//
// POST body:
//   {
//     name: string,
//     email: string,
//     organization?: string,
//     role?: string,
//     athletes?: string,
//     message?: string,
//   }

import type { NextApiRequest, NextApiResponse } from 'next';
import * as Brevo from '@getbrevo/brevo';

const EMAIL_RE = /^\S+@\S+\.\S+$/;

function escapeHtml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const {
    name = '',
    email = '',
    organization = '',
    role = '',
    athletes = '',
    message = '',
  } = (req.body || {}) as {
    name?: string;
    email?: string;
    organization?: string;
    role?: string;
    athletes?: string;
    message?: string;
  };

  if (!name.trim()) return res.status(400).json({ error: 'Name is required' });
  if (!email.trim() || !EMAIL_RE.test(email)) {
    return res.status(400).json({ error: 'Valid email is required' });
  }

  if (!process.env.BREVO_MARKETING_KEY) {
    return res.status(500).json({ error: 'BREVO_MARKETING_KEY is not configured' });
  }

  const client = new Brevo.TransactionalEmailsApi();
  client.setApiKey(Brevo.TransactionalEmailsApiApiKeys.apiKey, process.env.BREVO_MARKETING_KEY);

  const submittedAt = new Date().toUTCString();
  const safe = {
    name: escapeHtml(name),
    email: escapeHtml(email),
    organization: escapeHtml(organization),
    role: escapeHtml(role),
    athletes: escapeHtml(athletes),
    message: escapeHtml(message || '—').replace(/\n/g, '<br>'),
  };

  const htmlContent = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 620px; margin: 0 auto; padding: 0; background:#0b0712; color:#ececf4;">
      <div style="padding:28px 28px 18px; border-bottom:1px solid rgba(160,94,248,0.25); background:linear-gradient(135deg, rgba(160,94,248,0.18), rgba(106,154,250,0.14));">
        <div style="font-family:ui-monospace, 'SF Mono', Menlo, monospace; font-size:11px; letter-spacing:0.18em; color:#c6b1ff; text-transform:uppercase;">PulseCheck · Department Pilot Request</div>
        <h1 style="font-size:22px; margin:6px 0 0; color:#ffffff; letter-spacing:-0.02em;">New pilot request from ${safe.name}</h1>
      </div>

      <div style="padding:22px 28px; background:#0b0712;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
          <tr><td style="padding:8px 0; color:#9791b8; font-size:12px; letter-spacing:0.08em; text-transform:uppercase;">Name</td><td style="padding:8px 0; color:#ffffff; font-size:15px; font-weight:600; text-align:right;">${safe.name}</td></tr>
          <tr><td style="padding:8px 0; color:#9791b8; font-size:12px; letter-spacing:0.08em; text-transform:uppercase;">Email</td><td style="padding:8px 0; color:#ffffff; font-size:15px; font-weight:600; text-align:right;"><a href="mailto:${safe.email}" style="color:#c6b1ff; text-decoration:none;">${safe.email}</a></td></tr>
          ${organization ? `<tr><td style="padding:8px 0; color:#9791b8; font-size:12px; letter-spacing:0.08em; text-transform:uppercase;">Organization</td><td style="padding:8px 0; color:#ffffff; font-size:15px; font-weight:600; text-align:right;">${safe.organization}</td></tr>` : ''}
          ${role ? `<tr><td style="padding:8px 0; color:#9791b8; font-size:12px; letter-spacing:0.08em; text-transform:uppercase;">Role</td><td style="padding:8px 0; color:#ffffff; font-size:15px; font-weight:600; text-align:right;">${safe.role}</td></tr>` : ''}
          ${athletes ? `<tr><td style="padding:8px 0; color:#9791b8; font-size:12px; letter-spacing:0.08em; text-transform:uppercase;">Athletes</td><td style="padding:8px 0; color:#ffffff; font-size:15px; font-weight:600; text-align:right;">${safe.athletes}</td></tr>` : ''}
        </table>

        ${message ? `
        <div style="margin-top:18px; padding:16px 18px; background:rgba(160,94,248,0.08); border:1px solid rgba(160,94,248,0.28); border-radius:12px;">
          <div style="font-family:ui-monospace, 'SF Mono', Menlo, monospace; font-size:10px; letter-spacing:0.16em; color:#c6b1ff; text-transform:uppercase; margin-bottom:8px;">Message</div>
          <div style="color:#eaeaf2; font-size:14px; line-height:1.6;">${safe.message}</div>
        </div>` : ''}

        <div style="margin-top:22px; padding-top:18px; border-top:1px solid rgba(255,255,255,0.08); color:#6e6a85; font-size:11.5px; line-height:1.6;">
          Submitted ${submittedAt}<br>
          Source: https://fitwithpulse.ai/PulseCheck · Reply-to set to requester.
        </div>
      </div>
    </div>
  `;

  const textContent = [
    'PulseCheck · Department Pilot Request',
    '',
    `Name: ${name}`,
    `Email: ${email}`,
    organization ? `Organization: ${organization}` : null,
    role ? `Role: ${role}` : null,
    athletes ? `Athletes: ${athletes}` : null,
    '',
    message ? `Message:\n${message}` : null,
    '',
    `Submitted ${submittedAt}`,
    'Source: https://fitwithpulse.ai/PulseCheck',
  ]
    .filter(Boolean)
    .join('\n');

  try {
    await client.sendTransacEmail({
      to: [{ email: 'tre@fitwithpulse.ai', name: 'Tremaine Grant' }],
      cc: [{ email: 'bobby@fitwithpulse.ai', name: 'Bobby' }],
      replyTo: { email, name },
      sender: { email: 'hello@pulsecommunity.app', name: 'PulseCheck' },
      subject: `PulseCheck Pilot Request — ${name}${organization ? ` (${organization})` : ''}`,
      htmlContent,
      textContent,
    });

    return res.status(200).json({ success: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[pulse-check-pilot-request] Brevo send failed:', msg);
    return res.status(502).json({ error: 'Failed to send pilot request', detail: msg });
  }
}
