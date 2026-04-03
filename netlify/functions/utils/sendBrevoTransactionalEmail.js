const { admin, getFirebaseAdminApp } = require('../config/firebase');
const {
  DEFAULT_EMAIL_LOCK_STALE_MS,
  buildEmailDedupeKey,
  buildRecipientDailyQuotaKey,
  getUtcDateKey,
  normalizeEmailAddress,
  shouldBlockRecipientDailyQuota,
} = require('./emailSafety');

const EMAIL_SEND_LOCK_COLLECTION = 'email-send-idempotency';
const EMAIL_RECIPIENT_DAILY_COLLECTION = 'email-recipient-daily-limits';

function getDb() {
  return getFirebaseAdminApp().firestore();
}

function toMillis(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') {
    if (value > 1_000_000_000_000) return value;
    if (value > 1_000_000_000) return value * 1000;
    return null;
  }
  if (value instanceof Date) return value.getTime();
  if (typeof value?.toDate === 'function') {
    const date = value.toDate();
    return date instanceof Date ? date.getTime() : null;
  }
  if (typeof value === 'string') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.getTime();
  }
  return null;
}

async function claimGlobalLock(args) {
  const db = getDb();
  const lockRef = db.collection(EMAIL_SEND_LOCK_COLLECTION).doc(args.dedupeKey);

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(lockRef);
    const data = snap.data() || {};

    if (data.sentAt) {
      return { status: 'already_sent', messageId: data.messageId };
    }

    if (data.runId && data.runId !== args.runId) {
      const claimedAtMs = toMillis(data.claimedAt);
      const staleMs = args.staleMs ?? DEFAULT_EMAIL_LOCK_STALE_MS;
      if (claimedAtMs !== null && args.nowMs - claimedAtMs < staleMs) {
        return { status: 'in_progress' };
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
      },
      { merge: true }
    );

    return { status: 'claimed' };
  });
}

async function finalizeGlobalLock(args) {
  const db = getDb();
  const FieldValue = admin.firestore.FieldValue;
  const lockRef = db.collection(EMAIL_SEND_LOCK_COLLECTION).doc(args.dedupeKey);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(lockRef);
    const data = snap.data() || {};
    if (data.runId && data.runId !== args.runId) return;

    tx.set(
      lockRef,
      {
        ...(args.metadata || {}),
        sentAt: new Date(),
        messageId: args.messageId || data.messageId || null,
        runId: FieldValue.delete(),
        claimedAt: FieldValue.delete(),
        updatedAt: new Date(),
      },
      { merge: true }
    );
  });
}

async function releaseGlobalLock(args) {
  const db = getDb();
  const FieldValue = admin.firestore.FieldValue;
  const lockRef = db.collection(EMAIL_SEND_LOCK_COLLECTION).doc(args.dedupeKey);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(lockRef);
    const data = snap.data() || {};
    if (!data.runId || data.runId !== args.runId || data.sentAt) return;

    tx.set(
      lockRef,
      {
        runId: FieldValue.delete(),
        claimedAt: FieldValue.delete(),
        updatedAt: new Date(),
      },
      { merge: true }
    );
  });
}

async function claimRecipientDailyQuota(args) {
  const db = getDb();
  const recipientKey = buildRecipientDailyQuotaKey({
    toEmail: args.toEmail,
    scheduledAt: args.scheduledAt,
  });
  const docRef = db.collection(EMAIL_RECIPIENT_DAILY_COLLECTION).doc(recipientKey);

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(docRef);
    const data = snap.data() || {};

    if (
      shouldBlockRecipientDailyQuota({
        state: data,
        runId: args.runId,
        nowMs: args.nowMs,
        dailyLimit: args.dailyLimit,
      })
    ) {
      return { status: 'blocked' };
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
      },
      { merge: true }
    );

    return { status: 'claimed' };
  });
}

async function finalizeRecipientDailyQuota(args) {
  const db = getDb();
  const FieldValue = admin.firestore.FieldValue;
  const recipientKey = buildRecipientDailyQuotaKey({
    toEmail: args.toEmail,
    scheduledAt: args.scheduledAt,
  });
  const docRef = db.collection(EMAIL_RECIPIENT_DAILY_COLLECTION).doc(recipientKey);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(docRef);
    const data = snap.data() || {};
    if (data.runId && data.runId !== args.runId) return;

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
      },
      { merge: true }
    );
  });
}

async function releaseRecipientDailyQuota(args) {
  const db = getDb();
  const FieldValue = admin.firestore.FieldValue;
  const recipientKey = buildRecipientDailyQuotaKey({
    toEmail: args.toEmail,
    scheduledAt: args.scheduledAt,
  });
  const docRef = db.collection(EMAIL_RECIPIENT_DAILY_COLLECTION).doc(recipientKey);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(docRef);
    const data = snap.data() || {};
    if (!data.runId || data.runId !== args.runId) return;

    tx.set(
      docRef,
      {
        runId: FieldValue.delete(),
        claimedAt: FieldValue.delete(),
        updatedAt: new Date(),
      },
      { merge: true }
    );
  });
}

async function sendBrevoTransactionalEmail(args) {
  const apiKey = process.env.BREVO_MARKETING_KEY || process.env.BREVO_API_KEY;
  if (!apiKey) {
    return { success: false, error: 'Brevo not configured' };
  }

  if (!args?.toEmail) {
    return { success: false, error: 'Missing recipient email' };
  }

  const senderEmail = args.sender?.email || process.env.BREVO_SENDER_EMAIL || 'tre@fitwithpulse.ai';
  const senderName = args.sender?.name || process.env.BREVO_SENDER_NAME || 'Pulse';
  const replyTo = args.replyTo || { email: senderEmail, name: senderName || 'Pulse Team' };
  const nowMs = Date.now();
  const runId = `brevo-${nowMs}-${Math.random().toString(36).slice(2, 10)}`;
  const dailyRecipientLimit = Math.max(1, Number(args.dailyRecipientLimit || 1) || 1);
  const dailyRecipientMetadata = args.dailyRecipientMetadata || args.idempotencyMetadata;

  if (args.idempotencyKey) {
    const claimResult = await claimGlobalLock({
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
          dedupeKey: args.idempotencyKey,
          runId,
        }).catch(() => undefined);
      }
      return { success: true, skipped: true };
    }
  }

  const payload = {
    sender: { email: senderEmail, name: senderName },
    to: [{ email: args.toEmail, name: args.toName || args.toEmail }],
    subject: args.subject,
    htmlContent: args.htmlContent,
    replyTo,
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
    const date = new Date(args.scheduledAt);
    if (!Number.isNaN(date.getTime())) {
      payload.scheduledAt = date.toISOString();
    }
  }

  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    if (args.idempotencyKey) {
      await releaseGlobalLock({
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
      error: errorBody?.message || `Brevo API error (${response.status})`,
    };
  }

  const data = await response.json().catch(() => ({}));
  if (args.idempotencyKey) {
    await finalizeGlobalLock({
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

module.exports = {
  buildEmailDedupeKey,
  sendBrevoTransactionalEmail,
};
