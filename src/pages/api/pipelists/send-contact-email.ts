import type { NextApiRequest, NextApiResponse } from 'next';
import { getSimpBudgetFirestore } from '../../../../netlify/functions/utils/getSimpBudgetServiceAccount';
import { guardPipeListsApiRequest } from '../../../utils/pipelistsRuntime';
import { blocksUniversityBrevoTransport, hasKnownPipeListTemplate, UNIVERSITY_BREVO_BLOCK_REASON } from '../../../utils/pipelistsTransportPolicy';

type SendContactEmailRequest = {
  provider?: 'pulse-brevo';
  fromEmail?: string;
  emailType?: string;
  toEmails?: string[];
  subject?: string;
  message?: string;
  messageHtml?: string;
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
const INVESTOR_UPDATE_SENDER_EMAIL = process.env.INVESTOR_UPDATE_SENDER_EMAIL || 'tre@fitwithpulse.ai';
const INVESTOR_UPDATE_SENDER_NAME = process.env.INVESTOR_UPDATE_SENDER_NAME || 'Tremaine Grant';
const ALLOWED_SENDER_EMAILS = ['hello@fitwithpulse.ai', 'info@fitwithpulse.ai', 'tre@fitwithpulse.ai'] as const;
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
    return `<a href="${escapeHtml(href)}">${url}</a>`;
  });

const cleanHref = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return '';
  const href = /^(https?:\/\/|mailto:)/i.test(trimmed)
    ? trimmed
    : /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)
      ? `mailto:${trimmed}`
      : `https://${trimmed}`;
  try {
    const parsed = new URL(href);
    if (!['http:', 'https:', 'mailto:'].includes(parsed.protocol)) return '';
    return parsed.toString();
  } catch {
    return '';
  }
};

const stripHtmlTags = (value: string) => value.replace(/<[^>]*>/g, '');

const sanitizeComposerMessageHtml = (value: unknown) => {
  if (typeof value !== 'string') return '';
  let html = value.trim().slice(0, 50_000);
  if (!html) return '';

  html = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/\son\w+=(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/\sstyle=(?:"[^"]*"|'[^']*')/gi, '');

  const anchors: string[] = [];
  html = html.replace(/<a\b[^>]*href=(["'])(.*?)\1[^>]*>([\s\S]*?)<\/a>/gi, (_match, _quote, href, text) => {
    const safeHref = cleanHref(String(href || ''));
    const safeText = stripHtmlTags(String(text || '')).trim();
    if (!safeHref || !safeText) return escapeHtml(safeText);
    const token = `@@PIPELISTS_LINK_${anchors.length}@@`;
    anchors.push(
      `<a href="${escapeHtml(safeHref)}" target="_blank" rel="noreferrer" style="color:#2563eb;text-decoration:underline;text-underline-offset:3px;">${escapeHtml(
        safeText,
      )}</a>`,
    );
    return token;
  });

  const plainWithBreaks = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(div|p)>/gi, '\n')
    .replace(/<(div|p)\b[^>]*>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  if (!plainWithBreaks) return '';

  const linked = linkifyEscapedText(plainWithBreaks).replace(/@@PIPELISTS_LINK_(\d+)@@/g, (_match, index) => anchors[Number(index)] || '');
  return linked
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => `<p>${paragraph.replace(/\n/g, '<br>')}</p>`)
    .join('');
};

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

class ContactEmailListError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

async function readOwnedEmailList(uid: string, listId: string, emailType: string) {
  const db = await getSimpBudgetFirestore();
  return db.runTransaction(async tx => {
    const stateRef = db.collection('simpbudget-users').doc(uid).collection('pipeLists').doc('state');
    const protectedRef = db.collection('pipeListProtectedShares').doc(`${uid}-${listId}`);
    const [state, protectedDoc] = await Promise.all([tx.get(stateRef), tx.get(protectedRef)]);
    const lists = state.data()?.lists;
    const matches = Array.isArray(lists) ? lists.filter((list: any) => list?.id === listId) : [];
    if (matches.length !== 1 || matches[0].deletedAt) throw new ContactEmailListError(404, 'This owned list could not be verified.');
    const personalList = matches[0];
    const protectedData = protectedDoc.data();
    const protectedList = protectedData?.list;
    if (protectedDoc.exists && (protectedData?.ownerUid !== uid || protectedList?.id !== listId || protectedList?.deletedAt || protectedData?.listId !== listId)) {
      throw new ContactEmailListError(403, 'This owned list could not be verified.');
    }
    if (blocksUniversityBrevoTransport(personalList, protectedList, emailType)) {
      throw new ContactEmailListError(403, UNIVERSITY_BREVO_BLOCK_REASON);
    }
    if (!hasKnownPipeListTemplate(personalList) || (protectedDoc.exists && !hasKnownPipeListTemplate(protectedList))) {
      throw new ContactEmailListError(403, 'The list template could not be verified. Sending is disabled.');
    }
    return protectedDoc.exists ? protectedList : personalList;
  });
}

const buildContactEmailHtml = (args: {
  message: string;
  messageHtml?: string;
  senderEmail: string;
  listName: string;
  emailTypeLabel: string;
}) => {
  const paragraphs =
    sanitizeComposerMessageHtml(args.messageHtml) ||
    args.message
      .split(/\n{2,}/)
      .map((paragraph) => paragraph.trim())
      .filter(Boolean)
      .map((paragraph) => `<p>${linkifyEscapedText(paragraph).replace(/\n/g, '<br>')}</p>`)
      .join('');

  return `
    <div>
      ${paragraphs}
      <p>
        <strong>Tremaine Grant</strong><br>
        Founder &amp; CEO · <a href="https://pulseintelligencelabs.com">Pulse Intelligence Labs</a><br>
        <a href="mailto:${escapeHtml(args.senderEmail)}">${escapeHtml(args.senderEmail)}</a>
      </p>
    </div>
  `;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!guardPipeListsApiRequest(req, res)) return;
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

  const body = (req.body || {}) as SendContactEmailRequest;
  if (body.provider !== 'pulse-brevo') {
    return res.status(400).json({ success: false, error: 'Select a configured email provider.' });
  }

  const requestedSenderEmail = cleanEmail(body.fromEmail) || cleanEmail(INVESTOR_UPDATE_SENDER_EMAIL);
  if (!ALLOWED_SENDER_EMAILS.some((email) => email === requestedSenderEmail)) {
    return res.status(400).json({ success: false, error: 'Select an approved From address.' });
  }
  const senderName = requestedSenderEmail === 'tre@fitwithpulse.ai' ? INVESTOR_UPDATE_SENDER_NAME : 'Pulse';

  const toEmails = Array.isArray(body.toEmails)
    ? Array.from(new Set(body.toEmails.map(cleanEmail).filter(Boolean))).slice(0, 100)
    : [];
  const invalidEmails = toEmails.filter((email) => !isValidEmail(email));
  const subject = cleanText(body.subject, 180);
  const message = cleanText(body.message, 12000);
  const messageHtml = typeof body.messageHtml === 'string' ? body.messageHtml : '';
  const emailType = cleanEmailType(body.emailType);
  const emailTypeLabel = emailType === 'general-update' ? 'General Update' : 'Investor Update';
  const listId = typeof body.listId === 'string' ? body.listId.trim() : '';
  if (!listId || listId.length > 120 || listId.includes('/')) {
    return res.status(400).json({ success: false, error: 'Select a valid owned list.' });
  }
  let ownedList;
  try {
    ownedList = await readOwnedEmailList(verifiedUser.uid, listId, emailType);
  } catch (error) {
    if (!(error instanceof ContactEmailListError)) console.error('[pipelists-send-contact-email] List verification failed:', error);
    return res.status(error instanceof ContactEmailListError ? error.status : 503).json({ success: false, error: error instanceof ContactEmailListError ? error.message : 'Unable to verify the owned list. No email was sent.' });
  }
  const listName = cleanText(ownedList.name, 120) || 'PipeLists';
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

  const { buildEmailDedupeKey, sendBrevoTransactionalEmail } = require('../../../../netlify/functions/utils/emailSequenceHelpers') as typeof import('../../../../netlify/functions/utils/emailSequenceHelpers');
  const results = await Promise.all(
    toEmails.map(async (toEmail) => {
      const itemIds = itemIdsByEmail.get(toEmail) || [];
      const result = await sendBrevoTransactionalEmail({
        toEmail,
        toName: toEmail,
        subject,
        htmlContent: buildContactEmailHtml({ message, messageHtml, senderEmail: requestedSenderEmail, listName, emailTypeLabel }),
        attachment: attachments.length > 0 ? attachments : undefined,
        sender: {
          email: requestedSenderEmail,
          name: senderName,
        },
        preserveSenderEmail: true,
        replyTo: { email: requestedSenderEmail, name: senderName },
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
          senderEmail: requestedSenderEmail,
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
