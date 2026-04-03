import { getFirestore, initAdmin } from './getServiceAccount';
import {
  DEFAULT_EMAIL_LOCK_STALE_MS,
  buildEmailDedupeKey as buildSharedEmailDedupeKey,
  buildRecipientDailyQuotaKey,
  getUtcDateKey,
  normalizeEmailAddress,
  shouldBlockRecipientDailyQuota,
} from './emailSafety';

export type SequenceTemplate = {
  subject: string;
  html: string;
};

export type SequenceRecipient = {
  toEmail: string;
  toName: string;
  firstName: string;
  username: string;
  userData: Record<string, any> | null;
};

export type SequenceEmailSendResult = {
  success: boolean;
  messageId?: string;
  skipped?: boolean;
  error?: string;
};

type LockState = {
  runId?: string;
  claimedAt?: any;
  sentAt?: any;
  messageId?: string;
};

type RecipientDailyState = {
  sentCount?: number;
  lastSentAt?: any;
  lastSequence?: string;
  lastMessageId?: string;
  runId?: string;
  claimedAt?: any;
};

const EMAIL_SEND_LOCK_COLLECTION = 'email-send-idempotency';
const EMAIL_SEQUENCE_LOCK_COLLECTION = 'email-sequence-locks';
const EMAIL_RECIPIENT_DAILY_COLLECTION = 'email-recipient-daily-limits';

function toText(value: any): string {
  if (value === null || value === undefined) return '';
  return String(value);
}

export function escapeHtml(input: string): string {
  if (!input) return '';
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function toSnakeCase(key: string): string {
  return key.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);
}

function buildTemplateVarLookup(vars: Record<string, any>): Map<string, string> {
  const map = new Map<string, string>();
  for (const [key, value] of Object.entries(vars || {})) {
    const v = toText(value);
    map.set(key, v);
    map.set(key.toLowerCase(), v);
    map.set(toSnakeCase(key), v);
    map.set(toSnakeCase(key).toLowerCase(), v);
  }
  return map;
}

function getNestedValue(source: Record<string, any>, path: string): any {
  if (!source || !path) return undefined;
  return path.split('.').reduce<any>((acc, part) => (acc === null || acc === undefined ? undefined : acc[part]), source);
}

export function buildEmailDedupeKey(parts: any[]): string {
  return buildSharedEmailDedupeKey(parts);
}

async function claimRecipientDailyQuota(args: {
  toEmail: string;
  runId: string;
  nowMs: number;
  dailyLimit: number;
  scheduledAt?: string;
  metadata?: Record<string, any>;
}): Promise<{ status: 'claimed' | 'blocked' }> {
  const db = await getFirestore();
  const recipientKey = buildRecipientDailyQuotaKey({
    toEmail: args.toEmail,
    scheduledAt: args.scheduledAt,
  });
  const docRef = db.collection(EMAIL_RECIPIENT_DAILY_COLLECTION).doc(recipientKey);

  return db.runTransaction(async (tx) => {
    const snap = (await tx.get(docRef)) as any;
    const data = (snap.data() || {}) as RecipientDailyState;
    if (
      shouldBlockRecipientDailyQuota({
        state: data,
        runId: args.runId,
        nowMs: args.nowMs,
        dailyLimit: args.dailyLimit,
      })
    ) {
      return { status: 'blocked' as const };
    }

    tx.set(
      docRef,
      {
        ...(args.metadata || {}),
        recipient: normalizeEmailAddress(args.toEmail),
        dayKey: getUtcDateKey(args.scheduledAt),
        runId: args.runId,
        claimedAt: new Date(args.nowMs),
        updatedAt: new Date(args.nowMs),
      } as any,
      { merge: true } as any
    );

    return { status: 'claimed' as const };
  });
}

async function finalizeRecipientDailyQuota(args: {
  toEmail: string;
  runId: string;
  messageId?: string;
  scheduledAt?: string;
  metadata?: Record<string, any>;
}): Promise<void> {
  const db = await getFirestore();
  const FieldValue = initAdmin().firestore.FieldValue;
  const recipientKey = buildRecipientDailyQuotaKey({
    toEmail: args.toEmail,
    scheduledAt: args.scheduledAt,
  });
  const docRef = db.collection(EMAIL_RECIPIENT_DAILY_COLLECTION).doc(recipientKey);

  await db.runTransaction(async (tx) => {
    const snap = (await tx.get(docRef)) as any;
    const data = (snap.data() || {}) as RecipientDailyState;

    if (data.runId && data.runId !== args.runId) {
      return;
    }

    tx.set(
      docRef,
      {
        ...(args.metadata || {}),
        recipient: normalizeEmailAddress(args.toEmail),
        dayKey: getUtcDateKey(args.scheduledAt),
        sentCount: (Number(data.sentCount || 0) || 0) + 1,
        lastSentAt: new Date(),
        lastMessageId: args.messageId || null,
        runId: FieldValue.delete(),
        claimedAt: FieldValue.delete(),
        updatedAt: new Date(),
      } as any,
      { merge: true } as any
    );
  });
}

async function releaseRecipientDailyQuota(args: {
  toEmail: string;
  runId: string;
  scheduledAt?: string;
}): Promise<void> {
  const db = await getFirestore();
  const FieldValue = initAdmin().firestore.FieldValue;
  const recipientKey = buildRecipientDailyQuotaKey({
    toEmail: args.toEmail,
    scheduledAt: args.scheduledAt,
  });
  const docRef = db.collection(EMAIL_RECIPIENT_DAILY_COLLECTION).doc(recipientKey);

  await db.runTransaction(async (tx) => {
    const snap = (await tx.get(docRef)) as any;
    const data = (snap.data() || {}) as RecipientDailyState;

    if (!data.runId || data.runId !== args.runId) {
      return;
    }

    tx.set(
      docRef,
      {
        runId: FieldValue.delete(),
        claimedAt: FieldValue.delete(),
        updatedAt: new Date(),
      } as any,
      { merge: true } as any
    );
  });
}

async function claimGlobalLock(args: {
  collectionName: string;
  dedupeKey: string;
  runId: string;
  nowMs: number;
  staleMs?: number;
  metadata?: Record<string, any>;
}): Promise<{ status: 'claimed' | 'already_sent' | 'in_progress'; messageId?: string }> {
  const db = await getFirestore();
  const lockRef = db.collection(args.collectionName).doc(args.dedupeKey);

  return db.runTransaction(async (tx) => {
    const snap = (await tx.get(lockRef)) as any;
    const data = (snap.data() || {}) as LockState;

    if (data.sentAt) {
      return { status: 'already_sent' as const, messageId: data.messageId };
    }

    if (data.runId && data.runId !== args.runId) {
      const claimedAtMs = toMillis(data.claimedAt);
      const staleMs = args.staleMs ?? DEFAULT_EMAIL_LOCK_STALE_MS;
      if (claimedAtMs !== null && args.nowMs - claimedAtMs < staleMs) {
        return { status: 'in_progress' as const };
      }
    }

    tx.set(
      lockRef,
      {
        ...(args.metadata || {}),
        dedupeKey: args.dedupeKey,
        runId: args.runId,
        claimedAt: new Date(args.nowMs),
        updatedAt: new Date(args.nowMs),
      } as any,
      { merge: true } as any
    );

    return { status: 'claimed' as const };
  });
}

async function finalizeGlobalLock(args: {
  collectionName: string;
  dedupeKey: string;
  runId: string;
  messageId?: string;
  metadata?: Record<string, any>;
}): Promise<void> {
  const db = await getFirestore();
  const FieldValue = initAdmin().firestore.FieldValue;
  const lockRef = db.collection(args.collectionName).doc(args.dedupeKey);

  await db.runTransaction(async (tx) => {
    const snap = (await tx.get(lockRef)) as any;
    const data = (snap.data() || {}) as LockState;

    if (data.runId && data.runId !== args.runId) {
      return;
    }

    tx.set(
      lockRef,
      {
        ...(args.metadata || {}),
        sentAt: new Date(),
        messageId: args.messageId || data.messageId || null,
        runId: FieldValue.delete(),
        claimedAt: FieldValue.delete(),
        updatedAt: new Date(),
      } as any,
      { merge: true } as any
    );
  });
}

async function releaseGlobalLock(args: {
  collectionName: string;
  dedupeKey: string;
  runId: string;
}): Promise<void> {
  const db = await getFirestore();
  const FieldValue = initAdmin().firestore.FieldValue;
  const lockRef = db.collection(args.collectionName).doc(args.dedupeKey);

  await db.runTransaction(async (tx) => {
    const snap = (await tx.get(lockRef)) as any;
    const data = (snap.data() || {}) as LockState;

    if (!data.runId || data.runId !== args.runId || data.sentAt) {
      return;
    }

    tx.set(
      lockRef,
      {
        runId: FieldValue.delete(),
        claimedAt: FieldValue.delete(),
        updatedAt: new Date(),
      } as any,
      { merge: true } as any
    );
  });
}

export async function claimScheduledSequenceSend(args: {
  docRef: any;
  pendingField: string;
  completionFields?: string[];
  dedupeKey: string;
  runId: string;
  nowMs: number;
  staleMs?: number;
  metadata?: Record<string, any>;
}): Promise<boolean> {
  const db = await getFirestore();
  const lockRef = db.collection(EMAIL_SEQUENCE_LOCK_COLLECTION).doc(args.dedupeKey);

  return db.runTransaction(async (tx) => {
    const docSnap = (await tx.get(args.docRef)) as any;
    const lockSnap = (await tx.get(lockRef)) as any;

    if (!docSnap.exists) return false;

    const data = (docSnap.data() || {}) as Record<string, any>;
    if ((args.completionFields || []).some((field) => getNestedValue(data, field))) {
      return false;
    }

    const pendingClaim = getNestedValue(data, args.pendingField) as LockState | undefined;
    const staleMs = args.staleMs ?? DEFAULT_EMAIL_LOCK_STALE_MS;
    if (pendingClaim?.runId && pendingClaim.runId !== args.runId) {
      const claimedAtMs = toMillis(pendingClaim.claimedAt);
      if (claimedAtMs !== null && args.nowMs - claimedAtMs < staleMs) {
        return false;
      }
    }

    const lockData = (lockSnap.data() || {}) as LockState;
    if (lockData.sentAt) {
      return false;
    }
    if (lockData.runId && lockData.runId !== args.runId) {
      const claimedAtMs = toMillis(lockData.claimedAt);
      if (claimedAtMs !== null && args.nowMs - claimedAtMs < staleMs) {
        return false;
      }
    }

    tx.set(
      args.docRef,
      {
        [args.pendingField]: {
          runId: args.runId,
          claimedAt: new Date(args.nowMs),
          dedupeKey: args.dedupeKey,
        },
      } as any,
      { merge: true } as any
    );
    tx.set(
      lockRef,
      {
        ...(args.metadata || {}),
        dedupeKey: args.dedupeKey,
        runId: args.runId,
        claimedAt: new Date(args.nowMs),
        updatedAt: new Date(args.nowMs),
      } as any,
      { merge: true } as any
    );

    return true;
  });
}

export async function finalizeScheduledSequenceSend(args: {
  docRef: any;
  pendingField: string;
  resultField: string;
  dedupeKey: string;
  runId: string;
  markSent: boolean;
  updateFields?: Record<string, any>;
}): Promise<void> {
  const db = await getFirestore();
  const FieldValue = initAdmin().firestore.FieldValue;
  const lockRef = db.collection(EMAIL_SEQUENCE_LOCK_COLLECTION).doc(args.dedupeKey);

  await db.runTransaction(async (tx) => {
    const docSnap = (await tx.get(args.docRef)) as any;
    const lockSnap = (await tx.get(lockRef)) as any;
    if (!docSnap.exists) return;

    const data = (docSnap.data() || {}) as Record<string, any>;
    const pendingClaim = getNestedValue(data, args.pendingField) as LockState | undefined;
    if (pendingClaim?.runId && pendingClaim.runId !== args.runId) {
      return;
    }

    const lockData = (lockSnap.data() || {}) as LockState;
    if (lockData.runId && lockData.runId !== args.runId) {
      return;
    }

    tx.set(
      args.docRef,
      {
        [args.resultField]: new Date(),
        [args.pendingField]: FieldValue.delete(),
        ...(args.updateFields || {}),
      } as any,
      { merge: true } as any
    );

    tx.set(
      lockRef,
      args.markSent
        ? {
            sentAt: new Date(),
            runId: FieldValue.delete(),
            claimedAt: FieldValue.delete(),
            updatedAt: new Date(),
          }
        : {
            runId: FieldValue.delete(),
            claimedAt: FieldValue.delete(),
            updatedAt: new Date(),
          },
      { merge: true } as any
    );
  });
}

export async function releaseScheduledSequenceSend(args: {
  docRef: any;
  pendingField: string;
  dedupeKey: string;
  runId: string;
}): Promise<void> {
  const db = await getFirestore();
  const FieldValue = initAdmin().firestore.FieldValue;
  const lockRef = db.collection(EMAIL_SEQUENCE_LOCK_COLLECTION).doc(args.dedupeKey);

  await db.runTransaction(async (tx) => {
    const docSnap = (await tx.get(args.docRef)) as any;
    const lockSnap = (await tx.get(lockRef)) as any;
    if (!docSnap.exists) return;

    const data = (docSnap.data() || {}) as Record<string, any>;
    const pendingClaim = getNestedValue(data, args.pendingField) as LockState | undefined;
    if (!pendingClaim?.runId || pendingClaim.runId !== args.runId) {
      return;
    }

    tx.set(
      args.docRef,
      {
        [args.pendingField]: FieldValue.delete(),
      } as any,
      { merge: true } as any
    );

    const lockData = (lockSnap.data() || {}) as LockState;
    if (lockData.runId && lockData.runId === args.runId && !lockData.sentAt) {
      tx.set(
        lockRef,
        {
          runId: FieldValue.delete(),
          claimedAt: FieldValue.delete(),
          updatedAt: new Date(),
        } as any,
        { merge: true } as any
      );
    }
  });
}

export function applyTemplateVars(input: string, vars: Record<string, any>): string {
  if (!input) return '';
  const lookup = buildTemplateVarLookup(vars);
  return input.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_full, token) => {
    if (lookup.has(token)) return escapeHtml(lookup.get(token) || '');
    const lower = String(token).toLowerCase();
    if (lookup.has(lower)) return escapeHtml(lookup.get(lower) || '');
    return '';
  });
}

export async function loadTemplateFromFirestore(templateDocId: string): Promise<SequenceTemplate | null> {
  if (!templateDocId) return null;
  try {
    const db = await getFirestore();
    const snap = await db.collection('email-templates').doc(templateDocId).get();
    if (!snap.exists) return null;
    const data = snap.data() || {};
    const subject = typeof data.subject === 'string' ? data.subject.trim() : '';
    const html = typeof data.html === 'string' ? data.html : '';
    if (!subject || !html) return null;
    return { subject, html };
  } catch (error) {
    console.warn('[emailSequenceHelpers] Failed to load template:', templateDocId, error);
    return null;
  }
}

export async function resolveRecipient(args: {
  userId?: string;
  toEmail?: string;
  firstName?: string;
}): Promise<SequenceRecipient | null> {
  const emailFromPayload = (args.toEmail || '').trim();
  const firstNameFromPayload = (args.firstName || '').trim();

  let userData: Record<string, any> | null = null;
  if (args.userId) {
    try {
      const db = await getFirestore();
      const snap = await db.collection('users').doc(args.userId).get();
      if (snap.exists) {
        userData = snap.data() || {};
      }
    } catch (error) {
      console.warn('[emailSequenceHelpers] Failed to resolve user:', args.userId, error);
    }
  }

  const userEmail = typeof userData?.email === 'string' ? userData.email.trim() : '';
  const toEmail = (emailFromPayload || userEmail).trim();
  if (!toEmail) return null;

  const userDisplayName = typeof userData?.displayName === 'string' ? userData.displayName.trim() : '';
  const userUsername = typeof userData?.username === 'string' ? userData.username.trim() : '';
  const fallbackName = userDisplayName || userUsername || toEmail;

  const firstName = (firstNameFromPayload || userDisplayName.split(' ')[0] || userUsername || 'there').trim();
  const toName = fallbackName;

  return {
    toEmail,
    toName,
    firstName: firstName || 'there',
    username: userUsername || '',
    userData,
  };
}

export async function sendBrevoTransactionalEmail(args: {
  toEmail: string;
  toName?: string;
  subject: string;
  htmlContent: string;
  tags?: string[];
  headers?: Record<string, string>;
  cc?: Array<{ email: string; name?: string }>;
  bcc?: Array<{ email: string; name?: string }>;
  scheduledAt?: string;
  sender?: { email: string; name?: string };
  replyTo?: { email: string; name?: string };
  idempotencyKey?: string;
  idempotencyMetadata?: Record<string, any>;
  bypassDailyRecipientLimit?: boolean;
  dailyRecipientLimit?: number;
  dailyRecipientMetadata?: Record<string, any>;
}): Promise<SequenceEmailSendResult> {
  const apiKey = process.env.BREVO_MARKETING_KEY || process.env.BREVO_API_KEY;
  if (!apiKey) {
    return { success: false, error: 'Brevo not configured' };
  }

  if (!args.toEmail) {
    return { success: false, error: 'Missing recipient email' };
  }

  const senderEmail = args.sender?.email || process.env.BREVO_SENDER_EMAIL || 'tre@fitwithpulse.ai';
  const senderName = args.sender?.name || process.env.BREVO_SENDER_NAME || 'Pulse';
  const nowMs = Date.now();
  const runId = `brevo-${nowMs}-${Math.random().toString(36).slice(2, 10)}`;
  const dailyRecipientLimit = Math.max(1, Number(args.dailyRecipientLimit || 1) || 1);
  const dailyRecipientMetadata = args.dailyRecipientMetadata || args.idempotencyMetadata;

  if (args.idempotencyKey) {
    const claimResult = await claimGlobalLock({
      collectionName: EMAIL_SEND_LOCK_COLLECTION,
      dedupeKey: args.idempotencyKey,
      runId,
      nowMs,
      metadata: args.idempotencyMetadata,
    });

    if (claimResult.status === 'already_sent' || claimResult.status === 'in_progress') {
      return { success: true, skipped: true, messageId: claimResult.messageId };
    }
  }

  if (!args.bypassDailyRecipientLimit) {
    const dailyQuotaResult = await claimRecipientDailyQuota({
      toEmail: args.toEmail,
      runId,
      nowMs,
      dailyLimit: dailyRecipientLimit,
      scheduledAt: args.scheduledAt,
      metadata: dailyRecipientMetadata,
    });

    if (dailyQuotaResult.status === 'blocked') {
      if (args.idempotencyKey) {
        await releaseGlobalLock({
          collectionName: EMAIL_SEND_LOCK_COLLECTION,
          dedupeKey: args.idempotencyKey,
          runId,
        }).catch(() => undefined);
      }
      return { success: true, skipped: true };
    }
  }

  const payload: Record<string, any> = {
    sender: { name: senderName, email: senderEmail },
    to: [{ email: args.toEmail, name: args.toName || args.toEmail }],
    subject: args.subject,
    htmlContent: args.htmlContent,
    replyTo: args.replyTo || { email: senderEmail, name: senderName || 'Pulse Team' },
  };

  const tags = (args.tags || []).filter(Boolean);
  if (tags.length > 0) {
    payload.tags = tags;
  }

  if (args.headers && Object.keys(args.headers).length > 0) {
    payload.headers = args.headers;
  }
  if (args.cc && args.cc.length > 0) {
    payload.cc = args.cc;
  }
  if (args.bcc && args.bcc.length > 0) {
    payload.bcc = args.bcc;
  }

  if (args.scheduledAt) {
    const d = new Date(args.scheduledAt);
    if (!Number.isNaN(d.getTime())) {
      payload.scheduledAt = d.toISOString();
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
    const errJson = await resp.json().catch(() => ({}));
    if (args.idempotencyKey) {
      await releaseGlobalLock({
        collectionName: EMAIL_SEND_LOCK_COLLECTION,
        dedupeKey: args.idempotencyKey,
        runId,
      }).catch(() => undefined);
    }
    if (!args.bypassDailyRecipientLimit) {
      await releaseRecipientDailyQuota({
        toEmail: args.toEmail,
        runId,
        scheduledAt: args.scheduledAt,
      }).catch(() => undefined);
    }
    return {
      success: false,
      error: errJson?.message || `Brevo API error (${resp.status})`,
    };
  }

  const data = await resp.json().catch(() => ({}));
  if (args.idempotencyKey) {
    await finalizeGlobalLock({
      collectionName: EMAIL_SEND_LOCK_COLLECTION,
      dedupeKey: args.idempotencyKey,
      runId,
      messageId: data?.messageId,
      metadata: args.idempotencyMetadata,
    }).catch(() => undefined);
  }
  if (!args.bypassDailyRecipientLimit) {
    await finalizeRecipientDailyQuota({
      toEmail: args.toEmail,
      runId,
      messageId: data?.messageId,
      scheduledAt: args.scheduledAt,
      metadata: dailyRecipientMetadata,
    }).catch(() => undefined);
  }
  return { success: true, messageId: data?.messageId };
}

export async function resolveSequenceTemplate(args: {
  templateDocId: string;
  fallbackSubject: string;
  fallbackHtml: string;
  subjectOverride?: string;
  htmlOverride?: string;
  vars?: Record<string, any>;
}): Promise<SequenceTemplate> {
  const overrideSubject = (args.subjectOverride || '').trim();
  const overrideHtml = (args.htmlOverride || '').trim();

  let subject = overrideSubject;
  let html = overrideHtml;

  if (!subject || !html) {
    const saved = await loadTemplateFromFirestore(args.templateDocId);
    if (saved) {
      subject = subject || saved.subject;
      html = html || saved.html;
    }
  }

  subject = subject || args.fallbackSubject;
  html = html || args.fallbackHtml;

  const vars = args.vars || {};
  return {
    subject: applyTemplateVars(subject, vars),
    html: applyTemplateVars(html, vars),
  };
}

export function toMillis(value: any): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') {
    if (value > 1_000_000_000_000) return value; // likely ms
    if (value > 1_000_000_000) return value * 1000; // likely seconds
    return null;
  }
  if (value instanceof Date) return value.getTime();
  if (typeof value?.toDate === 'function') {
    const d = value.toDate();
    return d instanceof Date ? d.getTime() : null;
  }
  if (typeof value === 'string') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d.getTime();
  }
  return null;
}

export function getBaseSiteUrl(): string {
  return (process.env.SITE_URL || process.env.URL || 'https://fitwithpulse.ai').replace(/\/$/, '');
}
