const crypto = require('crypto');
const admin = require('firebase-admin');

const BREVO_SEND_EMAIL_URL = 'https://api.brevo.com/v3/smtp/email';
const EMAIL_SEND_LOCK_COLLECTION = 'email-send-idempotency';
const EMAIL_LOG_COLLECTION = 'email-logs';
const TEAM_JOIN_EMAIL_RECIPIENT = 'info@fitwithpulse.ai';
const DEFAULT_PRODUCTION_PROJECT_ID = 'quicklifts-dd3f1';
const DEFAULT_LOCK_STALE_MS = 15 * 60 * 1000;
const REJOIN_MEMBERSHIP_STATUSES = new Set([
  'inactive',
  'removed',
  'revoked',
  'suspended',
  'disabled',
]);

const cleanString = (value) => (
  typeof value === 'string' && value.trim() ? value.trim() : ''
);

const normalizeTeamJoinLifecycle = (value) => (
  cleanString(value).toLowerCase() === 'rejoin' ? 'rejoin' : 'join'
);

function resolveTeamJoinLifecycle(previousMembership = {}) {
  const previousRole = cleanString(previousMembership.role).toLowerCase();
  const previousStatus = cleanString(previousMembership.status).toLowerCase();
  const hasRemovalMarker = previousMembership.revoked === true
    || previousMembership.revokedAt != null
    || previousMembership.removedAt != null
    || previousMembership.archivedAt != null
    || previousMembership.deletedAt != null
    || Boolean(cleanString(previousMembership.removalOperationId));

  return previousRole === 'athlete'
    && (hasRemovalMarker || REJOIN_MEMBERSHIP_STATUSES.has(previousStatus))
    ? 'rejoin'
    : 'join';
}

function buildPulseCheckTeamJoinNotificationKey({
  membershipId,
  lifecycle = 'join',
  lifecycleEventId,
}) {
  const normalizedMembershipId = cleanString(membershipId);
  if (!normalizedMembershipId) {
    throw new Error('PulseCheck team join notification requires a membership ID.');
  }

  if (normalizeTeamJoinLifecycle(lifecycle) === 'join') {
    // Preserve the original first-join document ID for backward compatibility.
    return `pulsecheck_team_join_${normalizedMembershipId}`;
  }

  const normalizedEventId = cleanString(lifecycleEventId);
  if (!normalizedEventId) {
    throw new Error('PulseCheck team rejoin notification requires a lifecycle event ID.');
  }
  const lifecycleFingerprint = crypto
    .createHash('sha256')
    .update(normalizedEventId)
    .digest('hex')
    .slice(0, 24);
  return `pulsecheck_team_rejoin_${normalizedMembershipId}_${lifecycleFingerprint}`;
}

const escapeHtml = (value) => String(value || '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');

const toMillis = (value) => {
  if (!value) return null;
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (typeof value.toDate === 'function') return value.toDate().getTime();
  return null;
};

function resolveRuntimeProjectId() {
  return cleanString(
    process.env.GCLOUD_PROJECT ||
    process.env.GCP_PROJECT ||
    admin.apps[0]?.options?.projectId
  );
}

function shouldSendPulseCheckTeamJoinEmail(projectId = resolveRuntimeProjectId()) {
  if (process.env.PULSECHECK_TEAM_JOIN_EMAILS_ENABLED === 'true') return true;
  const productionProjectId = cleanString(process.env.PULSECHECK_PRODUCTION_FIREBASE_PROJECT_ID) ||
    DEFAULT_PRODUCTION_PROJECT_ID;
  return cleanString(projectId) === productionProjectId;
}

function buildPulseCheckTeamJoinDeliveryKey({eventId, recipient = TEAM_JOIN_EMAIL_RECIPIENT}) {
  const source = [
    'pulsecheck-team-join-v1',
    cleanString(eventId),
    cleanString(recipient).toLowerCase(),
  ].join('|');
  return crypto.createHash('sha256').update(source).digest('hex');
}

function buildPulseCheckTeamJoinEmailContent({
  athleteName,
  athleteEmail,
  teamName,
  organizationName,
  lifecycle = 'join',
}) {
  const safeAthleteName = cleanString(athleteName) || 'An athlete';
  const safeTeamName = cleanString(teamName) || 'a PulseCheck team';
  const safeAthleteEmail = cleanString(athleteEmail);
  const safeOrganizationName = cleanString(organizationName);
  const normalizedLifecycle = normalizeTeamJoinLifecycle(lifecycle);
  const activityPhrase = normalizedLifecycle === 'rejoin' ? 'rejoined' : 'just joined';
  const subject = `${safeAthleteName} ${activityPhrase} ${safeTeamName}`;
  const detailLines = [
    safeAthleteEmail ? `Athlete email: ${safeAthleteEmail}` : '',
    safeOrganizationName ? `Organization: ${safeOrganizationName}` : '',
  ].filter(Boolean);
  const textContent = [
    `${safeAthleteName} ${activityPhrase} ${safeTeamName}.`,
    ...detailLines,
    '',
    'Open the PulseCheck Pilot Dashboard:',
    'https://fitwithpulse.ai/admin/pulsecheckPilotDashboard',
  ].join('\n');
  const htmlContent = `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>${escapeHtml(subject)}</title>
      </head>
      <body style="margin:0;padding:0;background:#f4f7f6;">
        <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
          ${escapeHtml(safeAthleteName)} ${escapeHtml(activityPhrase)} ${escapeHtml(safeTeamName)}.
        </div>
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#f4f7f6;padding:32px 16px;">
          <tr>
            <td align="center">
              <table role="presentation" cellpadding="0" cellspacing="0" width="600" style="max-width:600px;width:100%;">
                <tr>
                  <td style="border:1px solid #dce5e1;background:#ffffff;border-radius:20px;padding:32px;">
                    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Arial,sans-serif;color:#101828;">
                      <div style="margin-bottom:16px;font-size:12px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#087f70;">PulseCheck team update</div>
                      <h1 style="margin:0 0 12px;font-size:26px;line-height:1.25;">${escapeHtml(safeAthleteName)} ${escapeHtml(activityPhrase)} ${escapeHtml(safeTeamName)}</h1>
                      ${safeAthleteEmail ? `<p style="margin:0 0 6px;font-size:14px;line-height:1.6;color:#475467;">Athlete: ${escapeHtml(safeAthleteEmail)}</p>` : ''}
                      ${safeOrganizationName ? `<p style="margin:0 0 6px;font-size:14px;line-height:1.6;color:#475467;">Organization: ${escapeHtml(safeOrganizationName)}</p>` : ''}
                      <a href="https://fitwithpulse.ai/admin/pulsecheckPilotDashboard" style="display:inline-block;margin-top:22px;border-radius:12px;background:#0f766e;padding:12px 18px;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;">Open Pilot Dashboard</a>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;

  return {subject, textContent, htmlContent};
}

async function claimDelivery({db, deliveryKey, runId, nowMs, metadata}) {
  const lockRef = db.collection(EMAIL_SEND_LOCK_COLLECTION).doc(deliveryKey);
  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(lockRef);
    const data = snapshot.exists ? snapshot.data() || {} : {};
    if (data.sentAt) {
      return {status: 'already_sent', messageId: cleanString(data.messageId)};
    }

    if (data.runId && data.runId !== runId) {
      const claimedAtMs = toMillis(data.claimedAt);
      if (claimedAtMs !== null && nowMs - claimedAtMs < DEFAULT_LOCK_STALE_MS) {
        return {status: 'in_progress'};
      }
    }

    transaction.set(lockRef, {
      ...metadata,
      dedupeKey: deliveryKey,
      runId,
      claimedAt: new Date(nowMs),
      updatedAt: new Date(nowMs),
    }, {merge: true});
    return {status: 'claimed'};
  });
}

async function finalizeDelivery({db, deliveryKey, runId, messageId, metadata}) {
  const lockRef = db.collection(EMAIL_SEND_LOCK_COLLECTION).doc(deliveryKey);
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(lockRef);
    const data = snapshot.exists ? snapshot.data() || {} : {};
    if (data.runId && data.runId !== runId) return;
    transaction.set(lockRef, {
      ...metadata,
      sentAt: new Date(),
      messageId: messageId || data.messageId || null,
      runId: null,
      claimedAt: null,
      updatedAt: new Date(),
    }, {merge: true});
  });
}

async function releaseDelivery({db, deliveryKey, runId, errorMessage}) {
  const lockRef = db.collection(EMAIL_SEND_LOCK_COLLECTION).doc(deliveryKey);
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(lockRef);
    const data = snapshot.exists ? snapshot.data() || {} : {};
    if (data.runId !== runId || data.sentAt) return;
    transaction.set(lockRef, {
      runId: null,
      claimedAt: null,
      lastError: cleanString(errorMessage).slice(0, 1000),
      lastFailedAt: new Date(),
      updatedAt: new Date(),
    }, {merge: true});
  });
}

async function writeDeliveryLog({db, deliveryKey, status, payload, messageId, errorMessage}) {
  await db.collection(EMAIL_LOG_COLLECTION).doc(`pulsecheck_team_join_${deliveryKey}`).set({
    provider: 'brevo',
    product: 'pulsecheck',
    emailType: 'pulsecheck-team-join',
    status,
    success: status === 'sent',
    toEmail: TEAM_JOIN_EMAIL_RECIPIENT,
    subject: payload.subject,
    messageId: messageId || null,
    error: errorMessage || null,
    idempotencyKey: deliveryKey,
    idempotencyMetadata: payload.metadata,
    sentAt: status === 'sent' ? new Date() : null,
    failedAt: status === 'failed' ? new Date() : null,
    updatedAt: new Date(),
    createdAt: new Date(),
  }, {merge: true});
}

async function sendPulseCheckTeamJoinEmail({
  db,
  eventId,
  athleteName,
  athleteEmail,
  teamName,
  organizationName,
  teamId,
  organizationId,
  athleteId,
  lifecycle = 'join',
  runtimeProjectId,
  fetchImpl = global.fetch,
  apiKey = process.env.BREVO_MARKETING_KEY || process.env.BREVO_API_KEY,
}) {
  const projectId = cleanString(runtimeProjectId) || resolveRuntimeProjectId();
  if (!shouldSendPulseCheckTeamJoinEmail(projectId)) {
    console.log('[pulsecheckTeamJoinEmail] External email skipped outside production.', {projectId});
    return {success: true, skipped: true, reason: 'non-production-project'};
  }
  if (!cleanString(eventId)) throw new Error('PulseCheck team join email requires an event ID.');
  if (!db) throw new Error('PulseCheck team join email requires Firestore.');
  if (typeof fetchImpl !== 'function') throw new Error('PulseCheck team join email requires fetch.');
  if (!apiKey) throw new Error('Missing Brevo API key (BREVO_MARKETING_KEY or BREVO_API_KEY).');

  const normalizedLifecycle = normalizeTeamJoinLifecycle(lifecycle);
  const deliveryKey = buildPulseCheckTeamJoinDeliveryKey({eventId});
  const runId = `pulsecheck-team-join-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  const metadata = {
    eventId: cleanString(eventId),
    product: 'pulsecheck',
    emailType: 'pulsecheck-team-join',
    teamId: cleanString(teamId),
    organizationId: cleanString(organizationId),
    athleteId: cleanString(athleteId),
    membershipLifecycle: normalizedLifecycle,
    recipient: TEAM_JOIN_EMAIL_RECIPIENT,
  };
  const claim = await claimDelivery({
    db,
    deliveryKey,
    runId,
    nowMs: Date.now(),
    metadata,
  });
  if (claim.status !== 'claimed') {
    return {
      success: true,
      skipped: true,
      reason: claim.status,
      messageId: claim.messageId,
    };
  }

  const content = buildPulseCheckTeamJoinEmailContent({
    athleteName,
    athleteEmail,
    teamName,
    organizationName,
    lifecycle: normalizedLifecycle,
  });
  const logPayload = {...content, metadata};

  try {
    const response = await fetchImpl(BREVO_SEND_EMAIL_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': apiKey,
      },
      body: JSON.stringify({
        sender: {
          email: process.env.BREVO_SENDER_EMAIL || 'hello@fitwithpulse.ai',
          name: 'PulseCheck',
        },
        to: [{email: TEAM_JOIN_EMAIL_RECIPIENT, name: 'PulseCheck'}],
        replyTo: {email: 'hello@fitwithpulse.ai', name: 'PulseCheck'},
        subject: content.subject,
        htmlContent: content.htmlContent,
        textContent: content.textContent,
        tags: [
          'pulsecheck',
          normalizedLifecycle === 'rejoin' ? 'team-rejoin' : 'team-join',
          'internal-notification',
        ],
      }),
    });
    if (!response.ok) {
      const responseText = await response.text();
      throw new Error(`Brevo request failed (${response.status}): ${responseText}`);
    }
    const result = await response.json().catch(() => ({}));
    const messageId = cleanString(result.messageId);
    await finalizeDelivery({db, deliveryKey, runId, messageId, metadata});
    await writeDeliveryLog({
      db,
      deliveryKey,
      status: 'sent',
      payload: logPayload,
      messageId,
    });
    return {success: true, messageId, deliveryKey};
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await Promise.all([
      releaseDelivery({db, deliveryKey, runId, errorMessage}),
      writeDeliveryLog({
        db,
        deliveryKey,
        status: 'failed',
        payload: logPayload,
        errorMessage,
      }),
    ]);
    throw error;
  }
}

module.exports = {
  TEAM_JOIN_EMAIL_RECIPIENT,
  buildPulseCheckTeamJoinDeliveryKey,
  buildPulseCheckTeamJoinEmailContent,
  buildPulseCheckTeamJoinNotificationKey,
  normalizeTeamJoinLifecycle,
  resolveTeamJoinLifecycle,
  sendPulseCheckTeamJoinEmail,
  shouldSendPulseCheckTeamJoinEmail,
};
