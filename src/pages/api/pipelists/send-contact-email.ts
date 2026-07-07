import type { NextApiRequest, NextApiResponse } from 'next';
import { buildEmailDedupeKey, sendBrevoTransactionalEmail } from '../../../../netlify/functions/utils/emailSequenceHelpers';

type SendContactEmailRequest = {
  provider?: 'pulse-brevo';
  emailType?: string;
  toEmails?: string[];
  subject?: string;
  message?: string;
  attachments?: Array<{
    name?: string;
    content?: string;
  }>;
  listId?: string;
  listName?: string;
  ownerUid?: string;
  batchId?: string;
  recipientItems?: Array<{
    email?: string;
    itemIds?: string[];
  }>;
};

type VerifiedSimpBudgetUser = {
  uid: string;
  email: string;
};

const OWNER_EMAIL = 'tremaine.grant@gmail.com';
const SIMPBUDGET_FIREBASE_API_KEY =
  process.env.SIMPBUDGET_FIREBASE_API_KEY?.trim() ||
  process.env.NEXT_PUBLIC_SIMPBUDGET_FIREBASE_API_KEY?.trim() ||
  'AIzaSyCBoCQ4J9xoIhZuaUjFMPq_zltkXDQ_0e8';

const cleanEmail = (value: unknown) => (typeof value === 'string' ? value.trim().toLowerCase() : '');
const cleanText = (value: unknown, maxLength = 5000) =>
  typeof value === 'string' ? value.trim().slice(0, maxLength) : '';

const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const cleanItemId = (value: unknown) => cleanText(value, 180).replace(/[^\w.-]/g, '').slice(0, 180);
const cleanAttachmentName = (value: unknown) => cleanText(value, 180).replace(/[\/\\]/g, '-').trim();
const cleanAttachmentContent = (value: unknown) =>
  typeof value === 'string' ? value.replace(/^data:[^,]+,/, '').replace(/\s/g, '').slice(0, 10_000_000) : '';
const cleanEmailType = (value: unknown) => {
  const emailType = cleanText(value, 80).replace(/[^\w-]/g, '');
  return emailType || 'metrics-update';
};

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const linkifyEscapedText = (value: string) =>
  escapeHtml(value).replace(/(https?:\/\/[^\s<>"']+|www\.[^\s<>"']+)/gi, (url) => {
    const href = url.toLowerCase().startsWith('http') ? url : `https://${url}`;
    return `<a href="${escapeHtml(href)}" style="color:#2563eb;text-decoration:underline;text-underline-offset:3px;">${url}</a>`;
  });

const verifySimpBudgetAuth = async (authHeader: string | undefined): Promise<VerifiedSimpBudgetUser | null> => {
  if (!authHeader?.startsWith('Bearer ') || !SIMPBUDGET_FIREBASE_API_KEY) return null;
  const idToken = authHeader.split('Bearer ')[1]?.trim();
  if (!idToken) return null;

  try {
    const response = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${SIMPBUDGET_FIREBASE_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      },
    );

    if (!response.ok) {
      const body = await response.text();
      console.error('[pipelists-send-contact-email] Auth verification failed:', {
        status: response.status,
        body: body.slice(0, 300),
      });
      return null;
    }

    const data = await response.json();
    const user = data?.users?.[0];
    const uid = typeof user?.localId === 'string' ? user.localId : '';
    const email = cleanEmail(user?.email);
    return uid && email ? { uid, email } : null;
  } catch (error) {
    console.error('[pipelists-send-contact-email] Auth verification error:', error);
    return null;
  }
};

const buildContactEmailHtml = (args: {
  message: string;
  senderEmail: string;
  listName: string;
  emailTypeLabel: string;
}) => {
  const paragraphs = args.message
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => `<p style="margin:0 0 16px;color:#44403c;font-size:15px;line-height:1.7;">${linkifyEscapedText(paragraph).replace(/\n/g, '<br>')}</p>`)
    .join('');

  return `
    <div style="margin:0;padding:0;background:#f7f7f4;color:#1c1917;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
      <div style="max-width:640px;margin:0 auto;padding:32px 18px;">
        <div style="background:#ffffff;border:1px solid #e7e5e4;border-radius:14px;overflow:hidden;">
          <div style="padding:28px 28px 18px;border-bottom:1px solid #f1f0ee;">
            <div style="font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#78716c;font-weight:700;">Pulse PipeLists</div>
            <h1 style="margin:12px 0 0;font-size:24px;line-height:1.2;color:#111111;">${escapeHtml(args.emailTypeLabel)}</h1>
          </div>
          <div style="padding:26px 28px;">
            ${paragraphs}
          </div>
          <div style="padding:18px 28px;border-top:1px solid #f1f0ee;color:#a8a29e;font-size:12px;line-height:1.6;">
            Sent by ${escapeHtml(args.senderEmail)} from ${escapeHtml(args.listName || 'PipeLists')}.
          </div>
        </div>
      </div>
    </div>
  `;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  const verifiedUser = await verifySimpBudgetAuth(req.headers.authorization);
  if (!verifiedUser) {
    return res.status(401).json({ success: false, error: 'Please sign in again.' });
  }
  if (verifiedUser.email !== OWNER_EMAIL) {
    return res.status(403).json({ success: false, error: 'Pulse Brevo sending is only enabled for the PipeLists owner.' });
  }

  const body = req.body as SendContactEmailRequest;
  if (body.provider !== 'pulse-brevo') {
    return res.status(400).json({ success: false, error: 'Select a configured email provider.' });
  }

  const toEmails = Array.isArray(body.toEmails)
    ? Array.from(new Set(body.toEmails.map(cleanEmail).filter(Boolean))).slice(0, 100)
    : [];
  const invalidEmails = toEmails.filter((email) => !isValidEmail(email));
  const subject = cleanText(body.subject, 180);
  const message = cleanText(body.message, 12000);
  const emailType = cleanEmailType(body.emailType);
  const emailTypeLabel = emailType === 'general-update' ? 'General Update' : 'Metrics Update';
  const listId = cleanText(body.listId, 120);
  const listName = cleanText(body.listName, 120) || 'PipeLists';
  const ownerUid = verifiedUser.uid;
  const batchId = cleanText(body.batchId, 120) || String(Date.now());
  const attachments = Array.isArray(body.attachments)
    ? body.attachments
        .map((attachment) => ({
          name: cleanAttachmentName(attachment?.name),
          content: cleanAttachmentContent(attachment?.content),
        }))
        .filter((attachment) => attachment.name && attachment.content)
        .slice(0, 5)
    : [];
  const itemIdsByEmail = new Map<string, string[]>();

  if (Array.isArray(body.recipientItems)) {
    body.recipientItems.forEach((recipient) => {
      const email = cleanEmail(recipient.email);
      if (!email) return;
      const itemIds = Array.isArray(recipient.itemIds)
        ? Array.from(new Set(recipient.itemIds.map(cleanItemId).filter(Boolean))).slice(0, 25)
        : [];
      itemIdsByEmail.set(email, itemIds);
    });
  }

  if (toEmails.length === 0) {
    return res.status(400).json({ success: false, error: 'Add at least one recipient.' });
  }
  if (invalidEmails.length > 0) {
    return res.status(400).json({ success: false, error: `Invalid recipient: ${invalidEmails[0]}` });
  }
  if (!subject) {
    return res.status(400).json({ success: false, error: 'Add a subject.' });
  }
  if (!message) {
    return res.status(400).json({ success: false, error: 'Add a message.' });
  }

  const results = await Promise.all(
    toEmails.map(async (toEmail) => {
      const itemIds = itemIdsByEmail.get(toEmail) || [];
      const result = await sendBrevoTransactionalEmail({
        toEmail,
        toName: toEmail,
        subject,
        htmlContent: buildContactEmailHtml({ message, senderEmail: verifiedUser.email, listName, emailTypeLabel }),
        attachment: attachments.length > 0 ? attachments : undefined,
        sender: {
          email: process.env.BREVO_SENDER_EMAIL || 'tre@fitwithpulse.ai',
          name: process.env.BREVO_SENDER_NAME || 'Pulse PipeLists',
        },
        replyTo: { email: verifiedUser.email, name: 'Tremaine Grant' },
        tags: ['pipelists', 'investor-update-contact', emailType],
        headers: {
          'X-Mailin-custom': JSON.stringify({
            pipeListsOwnerUid: ownerUid,
            pipeListsListId: listId,
            pipeListsListName: listName,
            pipeListsItemIds: itemIds,
            pipeListsEmailType: emailType,
            pipeListsEmailBatchId: batchId,
            pipeListsEmailRecordId: `${batchId}-${toEmail}`,
          }),
          'X-PipeLists-Email-Batch': batchId,
          'X-PipeLists-Recipient': toEmail,
        },
        idempotencyKey: buildEmailDedupeKey(['pipelists-contact-email-v1', batchId, listId, toEmail]),
        idempotencyMetadata: {
          feature: 'PipeLists contact email',
          batchId,
          recipientEmail: toEmail,
          senderEmail: verifiedUser.email,
          listId,
          listName,
          emailType,
        },
        bypassDailyRecipientLimit: true,
      });

      return { toEmail, ...result };
    }),
  );

  const failed = results.filter((result) => !result.success);
  if (failed.length > 0) {
    return res.status(502).json({
      success: false,
      error: failed[0].error || 'Brevo was unable to send one or more emails.',
      results,
    });
  }

  return res.status(200).json({
    success: true,
    sentCount: results.filter((result) => !result.skipped).length,
    skippedCount: results.filter((result) => result.skipped).length,
    results,
  });
}
