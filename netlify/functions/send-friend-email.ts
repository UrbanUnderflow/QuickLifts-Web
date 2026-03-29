import type { Handler } from '@netlify/functions';
import { buildEmailDedupeKey, sendBrevoTransactionalEmail } from './utils/emailSequenceHelpers';

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
    const senderEmail = 'tre@fitwithpulse.ai';
    const senderName = 'Tremaine Grant';

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
    // Check if content contains HTML tags (like <a href=) - if so, preserve them
    const containsHtml = textContent && /<[a-z][\s\S]*>/i.test(textContent);
    
    let finalHtmlContent: string;
    if (htmlContent) {
      finalHtmlContent = htmlContent;
    } else if (containsHtml) {
      // Content has HTML - convert newlines to <br> but preserve HTML tags
      finalHtmlContent = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; line-height: 1.6; color: #333;">
          ${textContent
            .replace(/\n\n/g, '</p><p style="margin: 16px 0;">')
            .replace(/\n/g, '<br>')
            .replace(/^/, '<p style="margin: 16px 0;">')
            .replace(/$/, '</p>')}
        </div>
      `;
      // Style any links in the content
      finalHtmlContent = finalHtmlContent.replace(
        /<a href="([^"]*)">/g, 
        '<a href="$1" style="color: #2563eb; text-decoration: underline;">'
      );
    } else {
      // Plain text - escape and wrap in pre
      finalHtmlContent = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; line-height: 1.6; color: #333; white-space: pre-wrap;">
          ${escapeHtml(textContent)}
        </div>
      `;
    }

    const sendResult = await sendBrevoTransactionalEmail({
      toEmail: to.email,
      toName: to.name || to.email,
      subject,
      htmlContent: finalHtmlContent,
      scheduledAt,
      sender: { email: senderEmail, name: senderName },
      replyTo: { email: senderEmail, name: senderName },
      headers: {
        'X-Mailin-custom': JSON.stringify({
          friendId: friendId || null,
          emailRecordId,
          updatePeriodId: updatePeriodId || null,
        }),
      },
      tags: [
        'friends-of-business',
        friendId ? `friend:${friendId}` : null,
        updatePeriodId ? `update:${updatePeriodId}` : null,
      ].filter(Boolean) as string[],
      idempotencyKey: buildEmailDedupeKey([
        'friend-email-v1',
        friendId || to.email,
        updatePeriodId || subject,
      ]),
      idempotencyMetadata: {
        sequence: 'friend-email',
        friendId: friendId || null,
        updatePeriodId: updatePeriodId || null,
      },
      dailyRecipientMetadata: {
        sequence: 'friend-email',
        friendId: friendId || null,
      },
    });

    if (!sendResult.success) {
      return {
        statusCode: 502,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: sendResult.error || 'Brevo API error' } satisfies SendResponse),
      };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        success: true, 
        messageId: sendResult.messageId,
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
