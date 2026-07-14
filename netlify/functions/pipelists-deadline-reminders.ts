import type { Handler } from '@netlify/functions';

import { sendBrevoTransactionalEmail } from './utils/emailSequenceHelpers';
import { getFirestore, initAdmin } from './utils/getServiceAccount';

const APP_URL = 'https://fitwithpulse.ai/PipeLists';
const SENDER = { email: 'info@fitwithpulse.ai', name: 'Pulse PipeLists' };
const REMINDER_DAYS = new Set([7, 2, 1]);
const DATE_FIELDS = ['expectedCloseDate', 'dueDate', 'pilotEnd'] as const;

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function dateKeyInEasternTime(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function normalizeDateKey(value: unknown): string | null {
  if (!value) return null;

  if (typeof value === 'string') {
    const trimmed = value.trim();
    const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) return `${match[1]}-${match[2]}-${match[3]}`;
    const parsed = new Date(trimmed);
    return Number.isNaN(parsed.getTime()) ? null : dateKeyInEasternTime(parsed);
  }

  if (value instanceof Date) return dateKeyInEasternTime(value);
  if (typeof (value as { toDate?: unknown }).toDate === 'function') {
    return dateKeyInEasternTime((value as { toDate: () => Date }).toDate());
  }

  return null;
}

function dayNumber(dateKey: string): number {
  const [year, month, day] = dateKey.split('-').map(Number);
  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
}

function formatDate(dateKey: string): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

function validEmail(value: unknown): value is string {
  return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function reminderLabel(daysUntil: number): string {
  if (daysUntil === 7) return 'in 1 week';
  if (daysUntil === 2) return 'in 2 days';
  return 'tomorrow';
}

function reminderSubject(daysUntil: number, itemName: string): string {
  if (daysUntil === 7) return `Due in 1 week: ${itemName}`;
  if (daysUntil === 2) return `Due in 2 days: ${itemName}`;
  return `Due tomorrow: ${itemName}`;
}

function buildEmail(args: {
  recipientName?: string;
  itemName: string;
  listName: string;
  deadline: string;
  daysUntil: number;
  nextStep?: string;
}): string {
  const greeting = args.recipientName ? `Hi ${escapeHtml(args.recipientName)},` : 'Hi,';
  const nextStep = args.nextStep
    ? `<p style="margin:0 0 22px;"><strong>Next step:</strong> ${escapeHtml(args.nextStep)}</p>`
    : '';

  return `
    <div style="font-family:Arial,Helvetica,sans-serif;color:#1c1917;line-height:1.55;max-width:640px;margin:0 auto;padding:28px;">
      <p style="margin:0 0 18px;">${greeting}</p>
      <h1 style="font-size:24px;line-height:1.25;margin:0 0 14px;">A PipeLists deadline is approaching</h1>
      <p style="margin:0 0 22px;"><strong>${escapeHtml(args.itemName)}</strong> in <strong>${escapeHtml(args.listName)}</strong> is due ${reminderLabel(args.daysUntil)}.</p>
      <p style="margin:0 0 12px;"><strong>Deadline:</strong> ${escapeHtml(formatDate(args.deadline))}</p>
      ${nextStep}
      <a href="${APP_URL}" style="display:inline-block;background:#1c1917;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:6px;font-weight:700;">Open PipeLists</a>
      <p style="color:#78716c;font-size:13px;margin:28px 0 0;">You received this because you own or collaborate on this PipeList.</p>
    </div>
  `;
}

async function getOwnerIdentity(ownerUid: string, stateData: Record<string, any>): Promise<{ email?: string; name?: string }> {
  const db = await getFirestore();
  const ownerSnapshot = await db.collection('simpbudget-users').doc(ownerUid).get();
  const ownerData = ownerSnapshot.data() || {};
  const emailCandidates = [
    ownerData.email,
    ownerData.profile?.email,
    ownerData.user?.email,
    stateData.ownerEmail,
  ];
  const email = emailCandidates.find(validEmail)?.trim().toLowerCase();
  const name = ownerData.displayName || ownerData.name || ownerData.profile?.name;
  if (email) return { email, name };

  try {
    const user = await initAdmin().auth().getUser(ownerUid);
    return { email: user.email?.trim().toLowerCase(), name: user.displayName || name };
  } catch {
    return { name };
  }
}

export const handler: Handler = async () => {
  const db = await getFirestore();
  const today = dateKeyInEasternTime(new Date());
  const stats = { states: 0, reminders: 0, sent: 0, skipped: 0, failed: 0 };

  try {
    const stateSnapshot = await db.collectionGroup('pipeLists').get();
    const stateDocuments = stateSnapshot.docs.filter((document) => document.id === 'state');

    for (const stateDocument of stateDocuments) {
      const ownerUid = stateDocument.ref.parent.parent?.id;
      if (!ownerUid) continue;

      stats.states += 1;
      const stateData = stateDocument.data() || {};
      const owner = await getOwnerIdentity(ownerUid, stateData);
      const lists = Array.isArray(stateData.lists) ? stateData.lists : [];

      for (const list of lists) {
        const items = Array.isArray(list?.items) ? list.items : [];
        if (!list?.id || !list?.name) continue;

        const shareSnapshot = await db.collection('pipeListShares').doc(`${ownerUid}-${list.id}`).get();
        const shareData = shareSnapshot.data() || {};
        const recipientMap = new Map<string, { email: string; name?: string }>();

        const addRecipient = (emailValue: unknown, name?: string) => {
          if (!validEmail(emailValue)) return;
          const email = emailValue.trim().toLowerCase();
          recipientMap.set(email, { email, name });
        };

        addRecipient(owner.email || shareData.ownerEmail, owner.name);
        for (const email of [...(shareData.viewerEmails || []), ...(shareData.editorEmails || [])]) {
          addRecipient(email);
        }

        for (const item of items) {
          if (!item || item.deletedAt) continue;
          const deadline = DATE_FIELDS.map((field) => normalizeDateKey(item[field])).find(Boolean) || null;
          if (!deadline) continue;

          const daysUntil = dayNumber(deadline) - dayNumber(today);
          if (!REMINDER_DAYS.has(daysUntil)) continue;

          stats.reminders += 1;
          const itemName = item.title || item.name || item.organization || 'Untitled item';

          for (const recipient of recipientMap.values()) {
            try {
              const result = await sendBrevoTransactionalEmail({
                toEmail: recipient.email,
                toName: recipient.name,
                subject: reminderSubject(daysUntil, itemName),
                htmlContent: buildEmail({
                  recipientName: recipient.name,
                  itemName,
                  listName: list.name,
                  deadline,
                  daysUntil,
                  nextStep: item.nextStep,
                }),
                sender: SENDER,
                preserveSenderEmail: true,
                replyTo: SENDER,
                tags: ['pipelists', 'deadline-reminder'],
                idempotencyKey: [
                  'pipelists-deadline',
                  ownerUid,
                  list.id,
                  item.id || itemName,
                  deadline,
                  String(daysUntil),
                  recipient.email,
                ].join(':'),
                idempotencyMetadata: {
                  feature: 'PipeLists deadline reminder',
                  ownerUid,
                  listId: list.id,
                  itemId: item.id || null,
                  deadline,
                  daysUntil,
                },
                bypassDailyRecipientLimit: true,
              });

              if (result.skipped) stats.skipped += 1;
              else stats.sent += 1;
            } catch (error) {
              stats.failed += 1;
              console.error('[PipeLists deadline reminders] Send failed', {
                ownerUid,
                listId: list.id,
                itemId: item.id,
                recipient: recipient.email,
                error,
              });
            }
          }
        }
      }
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true, today, ...stats }),
    };
  } catch (error) {
    console.error('[PipeLists deadline reminders] Run failed', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: false, error: 'Deadline reminder run failed.' }),
    };
  }
};
