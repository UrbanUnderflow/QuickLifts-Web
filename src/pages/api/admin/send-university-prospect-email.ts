import type { NextApiRequest, NextApiResponse } from 'next';
import { buildEmailDedupeKey, sendBrevoTransactionalEmail } from '../../../../netlify/functions/utils/emailSequenceHelpers';

type SendResponse = { success: boolean; messageId?: string; error?: string };

export default async function handler(req: NextApiRequest, res: NextApiResponse<SendResponse>) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }
  try {
    const senderEmail = 'tre@fitwithpulse.ai';
    const senderName = 'Tremaine Grant';

    const { to, subject, textContent, htmlContent, scheduledAt } = req.body || {};
    if (!to?.email || !subject || (!textContent && !htmlContent)) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    const sendResult = await sendBrevoTransactionalEmail({
      toEmail: to.email,
      toName: to.name || to.email,
      subject,
      htmlContent: htmlContent || `<pre style="white-space:pre-wrap;font:14px/1.5 -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif">${escapeHtml(textContent)}</pre>`,
      scheduledAt,
      sender: { name: senderName, email: senderEmail },
      replyTo: { email: senderEmail, name: senderName },
      idempotencyKey: buildEmailDedupeKey(['university-prospect-email-v1', to.email, subject]),
      idempotencyMetadata: {
        sequence: 'university-prospect-email',
        recipientEmail: to.email,
      },
      dailyRecipientMetadata: {
        sequence: 'university-prospect-email',
      },
    });

    if (!sendResult.success) {
      return res.status(502).json({ success: false, error: sendResult.error || 'Brevo API error' });
    }
    return res.status(200).json({ success: true, messageId: sendResult.messageId });
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

