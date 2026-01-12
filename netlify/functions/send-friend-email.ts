import type { Handler } from '@netlify/functions';

type SendResponse = { success: boolean; messageId?: string; error?: string };

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: false, error: 'Method not allowed' } satisfies SendResponse),
    };
  }

  try {
    const apiKey = process.env.BREVO_MARKETING_KEY || process.env.BREVO_API_KEY;
    const senderEmail = 'tre@fitwithpulse.ai';
    const senderName = 'Tremaine Grant';

    if (!apiKey) {
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: 'Brevo not configured' } satisfies SendResponse),
      };
    }

    const body = event.body ? JSON.parse(event.body) : {};
    const { to, subject, textContent, htmlContent, scheduledAt } = body || {};

    if (!to?.email || !subject || (!textContent && !htmlContent)) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: 'Missing required fields' } satisfies SendResponse),
      };
    }

    const payload: any = {
      sender: { name: senderName, email: senderEmail },
      to: [{ email: to.email, name: to.name || to.email }],
      subject,
      htmlContent:
        htmlContent ||
        `<pre style="white-space:pre-wrap;font:14px/1.5 -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif">${escapeHtml(
          textContent
        )}</pre>`,
      replyTo: { email: senderEmail, name: senderName },
    };

    // Optional scheduling per Brevo API (ISO8601 with timezone)
    if (scheduledAt) {
      const date = new Date(scheduledAt);
      if (!isNaN(date.getTime())) {
        payload.scheduledAt = date.toISOString();
      }
    }

    const resp = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      return {
        statusCode: resp.status,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: err?.message || 'Brevo API error' } satisfies SendResponse),
      };
    }

    const data = await resp.json().catch(() => ({}));
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, messageId: data?.messageId } satisfies SendResponse),
    };
  } catch (e: any) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: false, error: e?.message || 'Internal error' } satisfies SendResponse),
    };
  }
};

function escapeHtml(input: string) {
  if (!input) return '';
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

