const { normalizeEmailAddress, toEpochMs } = require('./emailSafety');

const DELETED_ACCOUNT_EMAIL_SUPPRESSIONS_COLLECTION = 'deleted-account-email-suppressions';
const BREVO_CONTACTS_API_URL = 'https://api.brevo.com/v3/contacts';
const BREVO_SMTP_EMAIL_API_URL = 'https://api.brevo.com/v3/smtp/email';
const EMAIL_LOG_COLLECTION = 'email-logs';

function buildEmailSuppressionDocId(email) {
  return encodeURIComponent(normalizeEmailAddress(email)).slice(0, 900);
}

function parseCustomHeader(headers = {}) {
  const raw = headers['X-Mailin-custom'] || headers['x-mailin-custom'] || '';
  if (!raw) return {};

  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function resolveUserIdFromEmailArgs(args = {}) {
  const custom = parseCustomHeader(args.headers || {});
  return String(
    args.userId ||
      args.idempotencyMetadata?.userId ||
      args.dailyRecipientMetadata?.userId ||
      custom.userId ||
      ''
  ).trim();
}

function suppressionRef(db, email) {
  return db
    .collection(DELETED_ACCOUNT_EMAIL_SUPPRESSIONS_COLLECTION)
    .doc(buildEmailSuppressionDocId(email));
}

async function writeDeletedAccountEmailSuppression({
  db,
  admin,
  email,
  userId,
  userData = {},
  adminContext = {},
}) {
  const normalizedEmail = normalizeEmailAddress(email || userData.email);
  if (!normalizedEmail) {
    return { created: false, reason: 'missing_email' };
  }

  const FieldValue = admin.firestore.FieldValue;
  const ref = suppressionRef(db, normalizedEmail);
  await ref.set(
    {
      active: true,
      reason: 'account_deleted',
      email: normalizedEmail,
      deletedUserId: userId || null,
      deletedUsername: userData?.username || null,
      deletedDisplayName: userData?.displayName || null,
      requestedByUid: adminContext.uid || null,
      requestedByEmail: adminContext.email || null,
      requestedBySource: adminContext.source || null,
      suppressedAt: FieldValue.serverTimestamp(),
      releasedAt: null,
      releasedByUserId: null,
      releaseReason: null,
      updatedAt: FieldValue.serverTimestamp(),
      createdAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  return { created: true, email: normalizedEmail, suppressionId: ref.id };
}

async function setBrevoContactEmailBlacklisted({ email, emailBlacklisted }) {
  const normalizedEmail = normalizeEmailAddress(email);
  const apiKey = process.env.BREVO_MARKETING_KEY || process.env.BREVO_API_KEY;
  if (!normalizedEmail) {
    return { success: false, skipped: true, reason: 'missing_email' };
  }
  if (!apiKey) {
    return { success: false, skipped: true, reason: 'brevo_not_configured' };
  }

  const encodedEmail = encodeURIComponent(normalizedEmail);
  const updateResponse = await fetch(`${BREVO_CONTACTS_API_URL}/${encodedEmail}`, {
    method: 'PUT',
    headers: {
      Accept: 'application/json',
      'api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ emailBlacklisted }),
  });

  if (updateResponse.ok) {
    return { success: true, email: normalizedEmail, emailBlacklisted };
  }

  if (updateResponse.status === 404) {
    if (!emailBlacklisted) {
      return { success: true, skipped: true, reason: 'contact_not_found', email: normalizedEmail };
    }

    const createResponse = await fetch(BREVO_CONTACTS_API_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: normalizedEmail,
        emailBlacklisted: true,
        updateEnabled: true,
      }),
    });

    if (createResponse.ok) {
      return { success: true, created: true, email: normalizedEmail, emailBlacklisted: true };
    }

    const createBody = await createResponse.json().catch(() => ({}));
    return {
      success: false,
      email: normalizedEmail,
      status: createResponse.status,
      error: createBody?.message || `Brevo create contact failed (${createResponse.status})`,
    };
  }

  const updateBody = await updateResponse.json().catch(() => ({}));
  return {
    success: false,
    email: normalizedEmail,
    status: updateResponse.status,
    error: updateBody?.message || `Brevo update contact failed (${updateResponse.status})`,
  };
}

async function cancelPendingBrevoTransactionalEmails({ db, email, nowMs = Date.now(), limit = 200 }) {
  const normalizedEmail = normalizeEmailAddress(email);
  const apiKey = process.env.BREVO_MARKETING_KEY || process.env.BREVO_API_KEY;
  if (!normalizedEmail) {
    return { success: false, skipped: true, reason: 'missing_email' };
  }
  if (!apiKey) {
    return { success: false, skipped: true, reason: 'brevo_not_configured' };
  }

  const snap = await db
    .collection(EMAIL_LOG_COLLECTION)
    .where('toEmail', '==', normalizedEmail)
    .limit(limit)
    .get();

  let scanned = 0;
  let attempted = 0;
  let cancelled = 0;
  let failed = 0;

  for (const doc of snap.docs) {
    scanned += 1;
    const data = doc.data() || {};
    const scheduledAtMs = toEpochMs(data.scheduledAt);
    const messageId = String(data.messageId || '').trim();
    if (!messageId || !scheduledAtMs || scheduledAtMs <= nowMs) continue;

    attempted += 1;
    const response = await fetch(`${BREVO_SMTP_EMAIL_API_URL}/${encodeURIComponent(messageId)}`, {
      method: 'DELETE',
      headers: {
        Accept: 'application/json',
        'api-key': apiKey,
      },
    });

    if (response.ok || response.status === 404) {
      cancelled += response.ok ? 1 : 0;
      await doc.ref.set(
        {
          status: response.ok ? 'cancelled' : 'cancel_skipped',
          cancelledAt: response.ok ? new Date() : null,
          cancelSkippedAt: response.status === 404 ? new Date() : null,
          cancelReason: response.ok ? 'account_deleted' : 'not_found_or_already_sent',
          updatedAt: new Date(),
        },
        { merge: true }
      );
    } else {
      failed += 1;
      const errorBody = await response.text().catch(() => '');
      await doc.ref.set(
        {
          cancelFailedAt: new Date(),
          cancelError: errorBody || `Brevo cancel failed (${response.status})`,
          updatedAt: new Date(),
        },
        { merge: true }
      );
    }
  }

  return { success: failed === 0, scanned, attempted, cancelled, failed };
}

async function releaseDeletedAccountEmailSuppression({
  db,
  admin,
  email,
  userId,
  releaseReason = 'account_recreated',
  metadata = {},
}) {
  const normalizedEmail = normalizeEmailAddress(email);
  if (!normalizedEmail) {
    return { released: false, reason: 'missing_email' };
  }

  const ref = suppressionRef(db, normalizedEmail);
  const snap = await ref.get();
  if (!snap.exists) {
    return { released: false, reason: 'not_suppressed', email: normalizedEmail };
  }

  const FieldValue = admin.firestore.FieldValue;
  await ref.set(
    {
      active: false,
      releasedAt: FieldValue.serverTimestamp(),
      releasedByUserId: userId || null,
      releaseReason,
      releaseMetadata: metadata,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  const brevo = await setBrevoContactEmailBlacklisted({
    email: normalizedEmail,
    emailBlacklisted: false,
  }).catch((error) => ({
    success: false,
    error: error?.message || String(error),
  }));

  return { released: true, email: normalizedEmail, suppressionId: ref.id, brevo };
}

async function isRecreatedAccountForSuppressedEmail({ db, suppressionData, email, userId }) {
  const normalizedEmail = normalizeEmailAddress(email);
  const normalizedUserId = String(userId || '').trim();
  if (!normalizedEmail || !normalizedUserId) return false;
  if (normalizedUserId === String(suppressionData?.deletedUserId || '').trim()) return false;

  const userSnap = await db.collection('users').doc(normalizedUserId).get();
  if (!userSnap.exists) return false;

  const userData = userSnap.data() || {};
  const userEmail = normalizeEmailAddress(userData.email || userData.emailAddress);
  if (userEmail !== normalizedEmail) return false;

  const suppressedAtMs =
    toEpochMs(suppressionData.suppressedAt) ||
    toEpochMs(suppressionData.createdAt) ||
    0;
  const userCreatedAtMs =
    toEpochMs(userData.createdAt) ||
    toEpochMs(userSnap.createTime) ||
    toEpochMs(userSnap.updateTime) ||
    0;

  if (suppressedAtMs && userCreatedAtMs && userCreatedAtMs < suppressedAtMs - 60_000) {
    return false;
  }

  return true;
}

async function shouldSuppressTransactionalEmail({
  db,
  admin,
  toEmail,
  userId,
  headers,
  idempotencyMetadata,
  dailyRecipientMetadata,
}) {
  const normalizedEmail = normalizeEmailAddress(toEmail);
  if (!normalizedEmail) {
    return { suppressed: false, reason: 'missing_email' };
  }

  const ref = suppressionRef(db, normalizedEmail);
  const snap = await ref.get();
  if (!snap.exists) {
    return { suppressed: false };
  }

  const suppressionData = snap.data() || {};
  if (suppressionData.active === false) {
    return { suppressed: false };
  }

  const resolvedUserId = resolveUserIdFromEmailArgs({
    userId,
    headers,
    idempotencyMetadata,
    dailyRecipientMetadata,
  });

  if (
    resolvedUserId &&
    await isRecreatedAccountForSuppressedEmail({
      db,
      suppressionData,
      email: normalizedEmail,
      userId: resolvedUserId,
    })
  ) {
    const release = await releaseDeletedAccountEmailSuppression({
      db,
      admin,
      email: normalizedEmail,
      userId: resolvedUserId,
      releaseReason: 'account_recreated_before_email_send',
      metadata: {
        previousDeletedUserId: suppressionData.deletedUserId || null,
      },
    });
    return { suppressed: false, released: true, release };
  }

  return {
    suppressed: true,
    reason: suppressionData.reason || 'account_deleted',
    email: normalizedEmail,
    suppressionId: snap.id,
    deletedUserId: suppressionData.deletedUserId || null,
  };
}

module.exports = {
  DELETED_ACCOUNT_EMAIL_SUPPRESSIONS_COLLECTION,
  buildEmailSuppressionDocId,
  cancelPendingBrevoTransactionalEmails,
  releaseDeletedAccountEmailSuppression,
  setBrevoContactEmailBlacklisted,
  shouldSuppressTransactionalEmail,
  writeDeletedAccountEmailSuppression,
};
