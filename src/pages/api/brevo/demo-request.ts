import type { NextApiRequest, NextApiResponse } from 'next';
import * as Brevo from '@getbrevo/brevo';

const EMAIL_RE = /^\S+@\S+\.\S+$/;
const DEMO_RECIPIENT_EMAIL = 'hello@fitwithpulse.ai';
const DEMO_RECIPIENT_NAME = 'Pulse Intelligence Labs';

function clean(value: unknown) {
  return typeof value === 'string' ? value.trim().slice(0, 300) : '';
}

function escapeHtml(value: string) {
  return value
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

  const name = clean(req.body?.name);
  const email = clean(req.body?.email).toLowerCase();
  const role = clean(req.body?.role);
  const product = clean(req.body?.product);
  const source = clean(req.headers.referer || req.headers.origin || 'fitwithpulse.ai');

  if (!name) return res.status(400).json({ error: 'Name is required' });
  if (!email || !EMAIL_RE.test(email)) return res.status(400).json({ error: 'Valid email is required' });
  if (!role) return res.status(400).json({ error: 'Role is required' });
  if (!product) return res.status(400).json({ error: 'Product is required' });

  const apiKey = process.env.BREVO_MARKETING_KEY || process.env.BREVO_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Brevo is not configured' });
  }

  const submittedAt = new Date().toUTCString();
  const safe = {
    name: escapeHtml(name),
    email: escapeHtml(email),
    role: escapeHtml(role),
    product: escapeHtml(product),
    source: escapeHtml(source),
  };

  const htmlContent = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:620px;margin:0 auto;background:#09090d;color:#f7f7fb;border:1px solid #242433;border-radius:18px;overflow:hidden;">
      <div style="padding:28px;background:linear-gradient(135deg,rgba(192,132,252,0.28),rgba(106,154,250,0.18));border-bottom:1px solid rgba(255,255,255,0.10);">
        <div style="font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#d8c1ff;font-weight:700;">Pulse Intelligence Labs</div>
        <h1 style="margin:8px 0 0;font-size:26px;line-height:1.15;color:#ffffff;">New demo request</h1>
      </div>
      <div style="padding:26px 28px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
          <tr><td style="padding:10px 0;color:#9b9ba8;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;">Name</td><td style="padding:10px 0;color:#ffffff;font-size:15px;font-weight:700;text-align:right;">${safe.name}</td></tr>
          <tr><td style="padding:10px 0;color:#9b9ba8;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;">Email</td><td style="padding:10px 0;color:#ffffff;font-size:15px;font-weight:700;text-align:right;"><a href="mailto:${safe.email}" style="color:#c084fc;text-decoration:none;">${safe.email}</a></td></tr>
          <tr><td style="padding:10px 0;color:#9b9ba8;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;">Role</td><td style="padding:10px 0;color:#ffffff;font-size:15px;font-weight:700;text-align:right;">${safe.role}</td></tr>
          <tr><td style="padding:10px 0;color:#9b9ba8;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;">Product</td><td style="padding:10px 0;color:#ffffff;font-size:15px;font-weight:700;text-align:right;">${safe.product}</td></tr>
        </table>
        <div style="margin-top:22px;padding-top:18px;border-top:1px solid rgba(255,255,255,0.10);color:#8f8f9f;font-size:12px;line-height:1.6;">
          Submitted ${submittedAt}<br>
          Source: ${safe.source}<br>
          Reply-to is set to the requester.
        </div>
      </div>
    </div>
  `;

  const textContent = [
    'Demo Request',
    '',
    `Name: ${name}`,
    `Email: ${email}`,
    `Role: ${role}`,
    `Product: ${product}`,
    '',
    `Submitted: ${submittedAt}`,
    `Source: ${source}`,
  ].join('\n');

  try {
    const client = new Brevo.TransactionalEmailsApi();
    client.setApiKey(Brevo.TransactionalEmailsApiApiKeys.apiKey, apiKey);

    await client.sendTransacEmail({
      to: [{ email: DEMO_RECIPIENT_EMAIL, name: DEMO_RECIPIENT_NAME }],
      replyTo: { email, name },
      sender: {
        email: process.env.BREVO_SENDER_EMAIL || DEMO_RECIPIENT_EMAIL,
        name: process.env.BREVO_SENDER_NAME || 'Pulse Intelligence Labs',
      },
      subject: 'Demo Request',
      htmlContent,
      textContent,
    });

    return res.status(200).json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[demo-request] Brevo send failed:', message);
    return res.status(502).json({ error: 'Failed to send demo request' });
  }
}
