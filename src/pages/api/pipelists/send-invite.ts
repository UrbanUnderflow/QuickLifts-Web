import type { NextApiRequest, NextApiResponse } from 'next';
import { buildEmailDedupeKey, sendBrevoTransactionalEmail } from '../../../../netlify/functions/utils/emailSequenceHelpers';

type SendInviteRequest = {
  toEmail?: string;
  inviteUrl?: string;
  listNames?: string[];
  access?: 'read' | 'edit';
  ownerName?: string;
  ownerEmail?: string;
  inviteBatchId?: string;
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
const cleanText = (value: unknown, maxLength = 120) =>
  typeof value === 'string' ? value.trim().slice(0, maxLength) : '';

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

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
      console.error('[pipelists-send-invite] Auth verification failed:', {
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
    console.error('[pipelists-send-invite] Auth verification error:', error);
    return null;
  }
};

const buildInviteHtml = (args: {
  ownerName: string;
  ownerEmail: string;
  inviteUrl: string;
  listNames: string[];
  access: 'read' | 'edit';
}) => {
  const safeOwnerName = escapeHtml(args.ownerName || args.ownerEmail);
  const safeOwnerEmail = escapeHtml(args.ownerEmail);
  const safeInviteUrl = escapeHtml(args.inviteUrl);
  const safeAccess = args.access === 'edit' ? 'read and edit' : 'read-only';
  const listLabel = args.listNames.length === 1 ? args.listNames[0] : `${args.listNames.length} PipeLists`;
  const safeListLabel = escapeHtml(listLabel);
  const safeListNames = args.listNames.map((listName) => `<li>${escapeHtml(listName)}</li>`).join('');

  return `
    <div style="margin:0;padding:0;background:#f7f7f4;color:#1c1917;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
      <div style="max-width:620px;margin:0 auto;padding:32px 18px;">
        <div style="background:#ffffff;border:1px solid #e7e5e4;border-radius:14px;overflow:hidden;">
          <div style="padding:28px 28px 20px;border-bottom:1px solid #f1f0ee;">
            <div style="font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#78716c;font-weight:700;">Pulse PipeLists</div>
            <h1 style="margin:12px 0 0;font-size:28px;line-height:1.15;color:#111111;">You were invited to ${safeListLabel}</h1>
            <p style="margin:12px 0 0;color:#6f6761;font-size:15px;line-height:1.6;">
              ${safeOwnerName} invited you to ${safeAccess} access in PipeLists.
            </p>
          </div>
          <div style="padding:26px 28px;">
            <a href="${safeInviteUrl}" style="display:inline-block;background:#1c1917;color:#ffffff;text-decoration:none;border-radius:999px;padding:13px 20px;font-weight:700;font-size:15px;">
              Open PipeLists
            </a>
            <p style="margin:20px 0 8px;color:#44403c;font-size:14px;font-weight:700;">Shared lists</p>
            <ul style="margin:0 0 20px 18px;padding:0;color:#6f6761;font-size:14px;line-height:1.7;">
              ${safeListNames}
            </ul>
            <p style="margin:20px 0 0;color:#78716c;font-size:12px;line-height:1.6;">
              If the button does not work, paste this link into your browser:<br>
              <a href="${safeInviteUrl}" style="color:#2563eb;word-break:break-all;">${safeInviteUrl}</a>
            </p>
          </div>
          <div style="padding:18px 28px;border-top:1px solid #f1f0ee;color:#a8a29e;font-size:12px;line-height:1.6;">
            Sent by ${safeOwnerEmail}. This link is intended for your email address.
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
    return res.status(403).json({ success: false, error: 'Only the PipeLists owner can send collaborator invites.' });
  }

  const body = req.body as SendInviteRequest;
  const toEmail = cleanEmail(body.toEmail);
  const inviteUrl = cleanText(body.inviteUrl, 1200);
  const access = body.access === 'edit' ? 'edit' : 'read';
  const ownerEmail = cleanEmail(body.ownerEmail) || verifiedUser.email;
  const ownerName = cleanText(body.ownerName, 80) || 'Tremaine Grant';
  const inviteBatchId = cleanText(body.inviteBatchId, 80) || String(Date.now());
  const listNames = Array.isArray(body.listNames)
    ? body.listNames.map((listName) => cleanText(listName, 80)).filter(Boolean).slice(0, 12)
    : [];

  if (!toEmail || !/^\S+@\S+\.\S+$/.test(toEmail)) {
    return res.status(400).json({ success: false, error: 'A valid recipient email is required.' });
  }
  if (!inviteUrl || !/^https?:\/\//i.test(inviteUrl)) {
    return res.status(400).json({ success: false, error: 'A valid invite link is required.' });
  }
  if (listNames.length === 0) {
    return res.status(400).json({ success: false, error: 'At least one PipeList is required.' });
  }

  const result = await sendBrevoTransactionalEmail({
    toEmail,
    toName: toEmail,
    subject: `You're invited to Pulse PipeLists`,
    htmlContent: buildInviteHtml({ ownerName, ownerEmail, inviteUrl, listNames, access }),
    sender: {
      email: process.env.BREVO_SENDER_EMAIL || 'tre@fitwithpulse.ai',
      name: process.env.BREVO_SENDER_NAME || 'Pulse PipeLists',
    },
    replyTo: { email: ownerEmail, name: ownerName },
    tags: ['pipelists', 'collaborator-invite'],
    headers: {
      'X-PipeLists-Invite-Batch': inviteBatchId,
      'X-PipeLists-Recipient': toEmail,
    },
    idempotencyKey: buildEmailDedupeKey(['pipelists-collaborator-invite-v1', inviteBatchId, toEmail]),
    idempotencyMetadata: {
      feature: 'PipeLists collaborator invite',
      inviteBatchId,
      recipientEmail: toEmail,
      ownerEmail,
      access,
      listNames,
    },
    bypassDailyRecipientLimit: true,
  });

  if (!result.success) {
    return res.status(502).json({ success: false, error: result.error || 'Brevo was unable to send the invite.' });
  }

  return res.status(200).json({ success: true, messageId: result.messageId, skipped: result.skipped || false });
}
