import type { NextApiRequest, NextApiResponse } from 'next';

type SendResponse = { success: boolean; messageId?: string; error?: string };

export default async function handler(req: NextApiRequest, res: NextApiResponse<SendResponse>) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }
  try {
    const apiKey = process.env.BREVO_MARKETING_KEY || process.env.BREVO_API_KEY;
    const senderEmail = 'tre@fitwithpulse.ai';
    const senderName = 'Tremaine Grant';

    if (!apiKey) {
      return res.status(500).json({ success: false, error: 'Brevo not configured' });
    }

    const { to, subject, textContent, htmlContent, scheduledAt } = req.body || {};
    if (!to?.email || !subject || (!textContent && !htmlContent)) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    const payload = {
      sender: { name: senderName, email: senderEmail },
      to: [{ email: to.email, name: to.name || to.email }],
      subject,
      htmlContent: htmlContent || `<pre style="white-space:pre-wrap;font:14px/1.5 -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif">${escapeHtml(textContent)}</pre>`,
      replyTo: { email: senderEmail, name: senderName }
    } as any;

    // Optional scheduling per Brevo API (ISO8601 with timezone)
    if (scheduledAt) {
      const date = new Date(scheduledAt);
      if (!isNaN(date.getTime())) {
        payload.scheduledAt = date.toISOString();
      }
    }

    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'api-key': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      return res.status(response.status).json({ success: false, error: err?.message || 'Brevo API error' });
    }
    const data = await response.json();
    return res.status(200).json({ success: true, messageId: data?.messageId });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e?.message || 'Internal error' });
  }
}

function escapeHtml(input: string) {
  if (!input) return '';
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}


