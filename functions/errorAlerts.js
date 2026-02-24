const {onDocumentCreated} = require("firebase-functions/v2/firestore");
const {logger} = require("firebase-functions");
const admin = require("firebase-admin");
const crypto = require("crypto");
const {FieldValue} = require("firebase-admin/firestore");

if (admin.apps.length === 0) {
  admin.initializeApp();
}
const db = admin.firestore();

const DEFAULT_ALERT_RECIPIENTS = ["tre@fitwithpulse.ai", "info@fitwithpulse.ai"];
const DEFAULT_SENDER_EMAIL = "no-reply@fitwithpulse.ai";
const DEFAULT_SENDER_NAME = "Pulse Error Monitor";
const DEFAULT_ALERT_COOLDOWN_SECONDS = 15 * 60;
const BREVO_SEND_EMAIL_URL = "https://api.brevo.com/v3/smtp/email";

function escapeHtml(value) {
  if (value == null) return "";
  return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
}

function parseRecipientsFromEnv() {
  const raw = (process.env.ERROR_ALERT_RECIPIENTS || "").trim();
  if (!raw) return DEFAULT_ALERT_RECIPIENTS;

  const recipients = raw
      .split(",")
      .map((email) => email.trim())
      .filter(Boolean);

  if (!recipients.length) return DEFAULT_ALERT_RECIPIENTS;
  return [...new Set(recipients)];
}

function parseAlertCooldownSeconds() {
  const parsed = Number(process.env.ERROR_ALERT_COOLDOWN_SECONDS || "");
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_ALERT_COOLDOWN_SECONDS;
  }
  return Math.floor(parsed);
}

function parseDateFromLogValue(value) {
  if (!value) return null;

  if (value && typeof value.toDate === "function") {
    return value.toDate();
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }

  if (typeof value === "number") {
    if (value > 10000000000) return new Date(value);
    return new Date(value * 1000);
  }

  if (typeof value === "string") {
    const asNumber = Number(value);
    if (!Number.isNaN(asNumber)) {
      if (asNumber > 10000000000) return new Date(asNumber);
      return new Date(asNumber * 1000);
    }

    const parsedMs = Date.parse(value);
    if (!Number.isNaN(parsedMs)) {
      return new Date(parsedMs);
    }
  }

  return null;
}

function getEventDate(logData) {
  return (
    parseDateFromLogValue(logData?.timestamp) ||
    parseDateFromLogValue(logData?.createdAt) ||
    parseDateFromLogValue(logData?.timestampEpoch) ||
    new Date()
  );
}

function buildErrorFingerprint(logData) {
  const source = logData?.context?.source || logData?.source || "unknown-source";
  const username = logData?.username || "unknown-user";
  const userId = logData?.userId || "unknown-user-id";
  const message = logData?.errorMessage || "unknown-error";

  const key = `${source}::${username}::${userId}::${message}`;
  return crypto.createHash("sha256").update(key).digest("hex").slice(0, 32);
}

async function shouldSuppressAlert(fingerprint, cooldownSeconds, logId) {
  const nowEpoch = Math.floor(Date.now() / 1000);
  const stateRef = db.collection("errorAlertState").doc(fingerprint);

  return db.runTransaction(async (tx) => {
    const stateSnap = await tx.get(stateRef);
    const stateData = stateSnap.exists ? stateSnap.data() : {};
    const lastSentEpoch = Number(stateData?.lastSentEpoch || 0);
    const delta = nowEpoch - lastSentEpoch;
    const suppressed = lastSentEpoch > 0 && delta < cooldownSeconds;

    tx.set(stateRef, {
      lastSeenAt: FieldValue.serverTimestamp(),
      lastSeenEpoch: nowEpoch,
      lastErrorLogId: logId,
      ...(suppressed ? {} : {
        lastSentAt: FieldValue.serverTimestamp(),
        lastSentEpoch: nowEpoch,
      }),
    }, {merge: true});

    return {
      suppressed,
      nowEpoch,
      lastSentEpoch,
      cooldownRemainingSeconds: suppressed ? cooldownSeconds - delta : 0,
    };
  });
}

async function sendBrevoEmail({
  recipients,
  subject,
  htmlContent,
  textContent,
}) {
  const apiKey = process.env.BREVO_MARKETING_KEY || process.env.BREVO_API_KEY;
  if (!apiKey) {
    throw new Error("Missing Brevo API key (BREVO_MARKETING_KEY or BREVO_API_KEY)");
  }

  const senderEmail = process.env.BREVO_SENDER_EMAIL || DEFAULT_SENDER_EMAIL;
  const senderName = process.env.BREVO_SENDER_NAME || DEFAULT_SENDER_NAME;

  const payload = {
    sender: {name: senderName, email: senderEmail},
    to: recipients.map((email) => ({email})),
    subject,
    htmlContent,
    textContent,
  };

  const response = await fetch(BREVO_SEND_EMAIL_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": apiKey,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Brevo request failed (${response.status}): ${errorText}`);
  }

  return await response.json().catch(() => ({}));
}

function buildEmailContent({
  logId,
  logData,
  createdAt,
  fingerprint,
}) {
  const source = logData?.context?.source || logData?.source || "unknown-source";
  const username = logData?.username || "unknown-user";
  const userId = logData?.userId || "unknown-user-id";
  const errorMessage = logData?.errorMessage || "No error message";
  const createdAtIso = createdAt.toISOString();
  const challengeTitle = logData?.context?.challengeTitle || null;

  const contextJson = JSON.stringify(logData?.context || {}, null, 2);
  const compactMessage = String(errorMessage).replace(/\s+/g, " ").trim();
  const subject = `[Pulse Error Alert] ${source} (${username})`;

  const textContent = [
    `Pulse captured a new error log.`,
    ``,
    `Log ID: ${logId}`,
    `Source: ${source}`,
    `Username: ${username}`,
    `User ID: ${userId}`,
    `Created At (UTC): ${createdAtIso}`,
    `Fingerprint: ${fingerprint}`,
    challengeTitle ? `Challenge: ${challengeTitle}` : null,
    ``,
    `Error Message:`,
    compactMessage,
    ``,
    `Context JSON:`,
    contextJson,
    ``,
    `Open in admin: https://fitwithpulse.ai/admin/ErrorLogs`,
  ].filter(Boolean).join("\n");

  const htmlContent = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, Arial, sans-serif; color: #111; line-height: 1.45;">
      <h2 style="margin: 0 0 12px;">Pulse Error Alert</h2>
      <p style="margin: 0 0 16px;">A new error log was created and matched your alert rules.</p>

      <table cellpadding="6" cellspacing="0" border="0" style="border-collapse: collapse; margin-bottom: 16px;">
        <tr><td><strong>Log ID</strong></td><td>${escapeHtml(logId)}</td></tr>
        <tr><td><strong>Source</strong></td><td>${escapeHtml(source)}</td></tr>
        <tr><td><strong>Username</strong></td><td>${escapeHtml(username)}</td></tr>
        <tr><td><strong>User ID</strong></td><td>${escapeHtml(userId)}</td></tr>
        <tr><td><strong>Created At (UTC)</strong></td><td>${escapeHtml(createdAtIso)}</td></tr>
        <tr><td><strong>Fingerprint</strong></td><td>${escapeHtml(fingerprint)}</td></tr>
      </table>

      <h3 style="margin: 0 0 8px;">Error Message</h3>
      <pre style="background: #f8f8f8; border: 1px solid #eee; padding: 12px; border-radius: 8px; white-space: pre-wrap;">${escapeHtml(errorMessage)}</pre>

      <h3 style="margin: 16px 0 8px;">Context</h3>
      <pre style="background: #f8f8f8; border: 1px solid #eee; padding: 12px; border-radius: 8px; white-space: pre-wrap;">${escapeHtml(contextJson)}</pre>

      <p style="margin-top: 16px;">
        <a href="https://fitwithpulse.ai/admin/ErrorLogs">Open Error Logs in Admin</a>
      </p>
    </div>
  `;

  return {subject, textContent, htmlContent};
}

exports.sendErrorAlertEmailOnErrorLogCreate = onDocumentCreated("errorLogs/{logId}", async (event) => {
  const snapshot = event.data;
  if (!snapshot) {
    logger.warn("[errorAlerts] No snapshot data found in trigger event.");
    return null;
  }

  const logData = snapshot.data() || {};
  const logId = event.params.logId;
  const recipients = parseRecipientsFromEnv();
  const createdAt = getEventDate(logData);
  const fingerprint = buildErrorFingerprint(logData);

  try {
    const cooldownSeconds = parseAlertCooldownSeconds();
    const suppression = await shouldSuppressAlert(fingerprint, cooldownSeconds, logId);

    if (suppression.suppressed) {
      await snapshot.ref.set({
        alertFingerprint: fingerprint,
        alertSuppressed: true,
        alertSuppressedAt: FieldValue.serverTimestamp(),
        alertSuppressedReason: `cooldown_${cooldownSeconds}s`,
        alertCooldownRemainingSeconds: suppression.cooldownRemainingSeconds,
        alertEmailSent: false,
      }, {merge: true});

      logger.info(`[errorAlerts] Suppressed alert for ${logId} (fingerprint: ${fingerprint}) due to cooldown.`);
      return null;
    }

    if (!recipients.length) {
      await snapshot.ref.set({
        alertFingerprint: fingerprint,
        alertEmailSent: false,
        alertEmailError: "No alert recipients configured",
        alertEmailAttemptedAt: FieldValue.serverTimestamp(),
      }, {merge: true});
      logger.warn("[errorAlerts] No recipients configured. Skipping alert email.");
      return null;
    }

    const {subject, textContent, htmlContent} = buildEmailContent({
      logId,
      logData,
      createdAt,
      fingerprint,
    });

    const brevoResponse = await sendBrevoEmail({
      recipients,
      subject,
      htmlContent,
      textContent,
    });

    await snapshot.ref.set({
      alertFingerprint: fingerprint,
      alertEmailSent: true,
      alertEmailAttemptedAt: FieldValue.serverTimestamp(),
      alertEmailSentAt: FieldValue.serverTimestamp(),
      alertEmailRecipients: recipients,
      alertEmailProvider: "brevo",
      alertEmailResponse: brevoResponse || null,
      timestampEpoch: Number(logData?.timestampEpoch) || Math.floor(createdAt.getTime() / 1000),
      timestamp: logData?.timestamp || createdAt,
      createdAt: logData?.createdAt || createdAt,
    }, {merge: true});

    logger.info(`[errorAlerts] Sent Brevo error alert for log ${logId} to ${recipients.join(", ")}`);
    return null;
  } catch (error) {
    logger.error(`[errorAlerts] Failed to send alert for ${logId}:`, error);

    await snapshot.ref.set({
      alertFingerprint: fingerprint,
      alertEmailSent: false,
      alertEmailAttemptedAt: FieldValue.serverTimestamp(),
      alertEmailError: error?.message || String(error),
      timestampEpoch: Number(logData?.timestampEpoch) || Math.floor(createdAt.getTime() / 1000),
      timestamp: logData?.timestamp || createdAt,
      createdAt: logData?.createdAt || createdAt,
    }, {merge: true});

    return null;
  }
});
