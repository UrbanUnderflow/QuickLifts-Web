import type { Handler } from '@netlify/functions';

import { buildEmailDedupeKey, sendBrevoTransactionalEmail } from './utils/emailSequenceHelpers';
import { getFirestore, initAdmin } from './utils/getServiceAccount';

const APP_URL = 'https://fitwithpulse.ai/PipeLists';
const SENDER = { email: 'info@fitwithpulse.ai', name: 'Pulse PipeLists' };
const REMINDER_DAYS = new Set([7, 2, 1]);
const DATE_FIELDS = ['expectedCloseDate', 'dueDate', 'pilotEnd'] as const;
const PIPELEAD_SHARES_COLLECTION = 'pipeLeadShares';

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

function logTimestampMs(log: Record<string, any>): number {
  const candidates = [log.createdAt, log.weekOf];
  for (const candidate of candidates) {
    if (!candidate) continue;
    if (candidate instanceof Date) {
      const time = candidate.getTime();
      if (!Number.isNaN(time)) return time;
    }
    if (typeof candidate === 'string') {
      const raw = /^\d{4}-\d{2}-\d{2}$/.test(candidate) ? `${candidate}T12:00:00` : candidate;
      const parsed = new Date(raw).getTime();
      if (!Number.isNaN(parsed)) return parsed;
    }
    if (typeof candidate?.toDate === 'function') {
      const parsed = candidate.toDate();
      if (parsed instanceof Date && !Number.isNaN(parsed.getTime())) return parsed.getTime();
    }
  }
  return 0;
}

function logDisplayLabel(log: Record<string, any>): string {
  const labels: Record<string, string> = {
    update: 'General Update',
    'cold-outreach': 'Cold Outreach',
    'follow-up-first': 'Follow Up 1st Attempt',
    'follow-up-second': 'Follow Up 2nd Attempt',
    'follow-up-third': 'Follow Up 3rd Attempt',
    'closed-no-response': 'Closed No Response',
    'closed-response-no-interest': 'Closed Response No Interest',
    application: 'Application',
    meeting: 'Meeting',
    'follow-up': 'Follow-Up',
    decision: 'Decision',
    risk: 'Risk',
    document: 'Document Sent',
    metrics: 'Metrics Update',
  };
  return labels[String(log.type || '')] || 'Log';
}

function nextActionSubject(itemName: string): string {
  return `Next action due today: ${itemName}`;
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

function buildNextActionEmail(args: {
  recipientName?: string;
  itemName: string;
  listName: string;
  actionDate: string;
  nextStep?: string;
  logType?: string;
  summary?: string;
  notes?: string;
  leadUrl: string;
}): string {
  const greeting = args.recipientName ? `Hi ${escapeHtml(args.recipientName)},` : 'Hi,';
  const nextStep = args.nextStep
    ? `<p style="margin:0 0 12px;"><strong>Next action:</strong> ${escapeHtml(args.nextStep)}</p>`
    : '';
  const summary = args.summary
    ? `<p style="margin:0 0 12px;"><strong>Latest log summary:</strong> ${escapeHtml(args.summary)}</p>`
    : '';
  const notes = args.notes
    ? `<div style="margin:18px 0 22px;padding:14px 16px;background:#fafaf7;border:1px solid #e7e5e4;border-radius:10px;">
        <div style="font-weight:700;margin-bottom:6px;color:#44403c;">Log notes</div>
        <div style="white-space:pre-wrap;color:#57534e;">${escapeHtml(args.notes)}</div>
      </div>`
    : '';

  return `
    <div style="font-family:Arial,Helvetica,sans-serif;color:#1c1917;line-height:1.55;max-width:640px;margin:0 auto;padding:28px;">
      <p style="margin:0 0 18px;">${greeting}</p>
      <h1 style="font-size:24px;line-height:1.25;margin:0 0 14px;">This lead has an action date today</h1>
      <p style="margin:0 0 18px;">
        <strong>${escapeHtml(args.itemName)}</strong> in <strong>${escapeHtml(args.listName)}</strong> has a next action required date of
        <strong>${escapeHtml(formatDate(args.actionDate))}</strong>, and no newer manual log has been posted yet.
      </p>
      <p style="margin:0 0 12px;"><strong>Log type:</strong> ${escapeHtml(args.logType || 'Log')}</p>
      ${nextStep}
      ${summary}
      ${notes}
      <a href="${escapeHtml(args.leadUrl)}" style="display:inline-block;background:#1c1917;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:999px;font-weight:700;">Open lead</a>
      <p style="color:#78716c;font-size:13px;margin:24px 0 0;">
        If the button does not work, paste this link into your browser:<br>
        <a href="${escapeHtml(args.leadUrl)}" style="color:#2563eb;word-break:break-all;">${escapeHtml(args.leadUrl)}</a>
      </p>
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

async function createOrUpdateLeadShare(args: {
  ownerUid: string;
  ownerEmail?: string;
  list: Record<string, any>;
  item: Record<string, any>;
}): Promise<string> {
  const db = await getFirestore();
  const itemId = String(args.item.id || '').trim();
  if (!itemId) return APP_URL;

  const shareId = `${args.ownerUid}-${args.list.id}-${itemId}`;
  const origin = (process.env.NEXT_PUBLIC_SITE_URL || process.env.URL || 'https://fitwithpulse.ai').replace(/\/+$/, '');
  const leadUrl = `${origin}/PipeLists?leadShare=${encodeURIComponent(shareId)}`;
  const admin = initAdmin();
  const leadList = {
    ...args.list,
    name: args.item.title || args.list.name,
    description: `${args.list.name || 'PipeLists'} read-only lead share`,
    items: [args.item],
  };

  await db.collection(PIPELEAD_SHARES_COLLECTION).doc(shareId).set(
    {
      id: shareId,
      ownerUid: args.ownerUid,
      ownerEmail: args.ownerEmail || '',
      listId: args.list.id,
      itemId,
      list: leadList,
      publicRead: true,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  return leadUrl;
}

function latestOpenActionLogForToday(item: Record<string, any>, today: string): Record<string, any> | null {
  const logs = Array.isArray(item.weeklyLogs) ? item.weeklyLogs.filter((log) => log && typeof log === 'object') : [];
  const dueLogs = logs
    .filter((log) => !log.systemAction && normalizeDateKey(log.followUpDate) === today)
    .sort((left, right) => logTimestampMs(right) - logTimestampMs(left));
  const dueLog = dueLogs[0];
  if (!dueLog) return null;

  const dueLogTime = logTimestampMs(dueLog);
  const hasNewerManualLog = logs.some((log) => {
    if (!log || log === dueLog || log.systemAction) return false;
    return logTimestampMs(log) > dueLogTime;
  });

  return hasNewerManualLog ? null : dueLog;
}

export const handler: Handler = async () => {
  const db = await getFirestore();
  const today = dateKeyInEasternTime(new Date());
  const stats = { states: 0, reminders: 0, actionReminders: 0, sent: 0, skipped: 0, failed: 0 };

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
          const itemName = item.title || item.name || item.organization || 'Untitled item';
          const actionLog = latestOpenActionLogForToday(item, today);

          if (actionLog && owner.email) {
            stats.actionReminders += 1;
            try {
              const leadUrl = await createOrUpdateLeadShare({
                ownerUid,
                ownerEmail: owner.email,
                list,
                item,
              });
              const result = await sendBrevoTransactionalEmail({
                toEmail: owner.email,
                toName: owner.name,
                subject: nextActionSubject(itemName),
                htmlContent: buildNextActionEmail({
                  recipientName: owner.name,
                  itemName,
                  listName: list.name,
                  actionDate: today,
                  nextStep: actionLog.nextStep,
                  logType: logDisplayLabel(actionLog),
                  summary: actionLog.summary,
                  notes: actionLog.notes,
                  leadUrl,
                }),
                sender: SENDER,
                preserveSenderEmail: true,
                replyTo: SENDER,
                tags: ['pipelists', 'next-action-reminder'],
                idempotencyKey: buildEmailDedupeKey([
                  'pipelists-next-action',
                  ownerUid,
                  list.id,
                  item.id || itemName,
                  actionLog.id || actionLog.summary || actionLog.nextStep || '',
                  today,
                  owner.email,
                ]),
                idempotencyMetadata: {
                  feature: 'PipeLists next action reminder',
                  ownerUid,
                  listId: list.id,
                  itemId: item.id || null,
                  actionLogId: actionLog.id || null,
                  actionDate: today,
                },
                bypassDailyRecipientLimit: true,
              });

              if (result.skipped) stats.skipped += 1;
              else stats.sent += 1;
            } catch (error) {
              stats.failed += 1;
              console.error('[PipeLists next action reminders] Send failed', {
                ownerUid,
                listId: list.id,
                itemId: item.id,
                actionLogId: actionLog.id,
                recipient: owner.email,
                error,
              });
            }
          }

          const deadline = DATE_FIELDS.map((field) => normalizeDateKey(item[field])).find(Boolean) || null;
          if (!deadline) continue;

          const daysUntil = dayNumber(deadline) - dayNumber(today);
          if (!REMINDER_DAYS.has(daysUntil)) continue;

          stats.reminders += 1;

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
