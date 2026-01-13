import type { Handler } from '@netlify/functions';

type SendResponse = { 
  success: boolean; 
  messageId?: string; 
  emailRecordId?: string;
  error?: string;
};

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
    const { to, subject, textContent, htmlContent, scheduledAt, friendId, updatePeriodId } = body || {};

    if (!to?.email || !subject || (!textContent && !htmlContent)) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: 'Missing required fields' } satisfies SendResponse),
      };
    }

    // Generate a unique email record ID for tracking
    const emailRecordId = `email_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Build HTML content with proper styling
    const finalHtmlContent = htmlContent ||
      `<pre style="white-space:pre-wrap;font:14px/1.5 -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif">${escapeHtml(
        textContent
      )}</pre>`;

    const payload: any = {
      sender: { name: senderName, email: senderEmail },
      to: [{ email: to.email, name: to.name || to.email }],
      subject,
      htmlContent: finalHtmlContent,
      replyTo: { email: senderEmail, name: senderName },
      // Enable Brevo tracking - this is safe for domain reputation
      // Brevo handles tracking via their own infrastructure
      headers: {
        'X-Mailin-custom': JSON.stringify({
          friendId: friendId || null,
          emailRecordId: emailRecordId,
          updatePeriodId: updatePeriodId || null
        })
      },
      // Tags help organize emails and enable filtering in Brevo dashboard
      tags: [
        'friends-of-business', 
        friendId ? `friend:${friendId}` : null,
        updatePeriodId ? `update:${updatePeriodId}` : null
      ].filter(Boolean),
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
      body: JSON.stringify({ 
        success: true, 
        messageId: data?.messageId,
        emailRecordId: emailRecordId
      } satisfies SendResponse),
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

