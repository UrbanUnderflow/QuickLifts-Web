const { randomUUID } = require('node:crypto');

const COLLECTION = 'pulsecheck-team-payment-notifications';
const LEASE_MS = 5 * 60 * 1000;
const text = (value) => typeof value === 'string' ? value.trim() : '';
const safeId = (value) => Boolean(text(value)) && !value.includes('/') && value.length <= 240;
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[char]));

function teamBillingUrl(teamId, firebaseMode = 'prod') {
  const url = new URL('https://fitwithpulse.ai/PulseCheck/team-billing');
  url.searchParams.set('teamId', teamId);
  if (firebaseMode === 'dev') url.searchParams.set('devFirebase', '1');
  return url.toString();
}

async function deliverChannel({ database, invoiceId, channel, context, deliver, now = Date.now }) {
  const ref = database.collection(COLLECTION).doc(`${invoiceId}_${channel}`);
  const claimId = randomUUID();
  const claimedAt = now();
  const claim = await database.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const previous = snap.exists ? snap.data() : {};
    if (['sent', 'suppressed'].includes(previous.status)) return 'complete';
    if (previous.status === 'sending' && claimedAt - previous.claimedAtMs < LEASE_MS) return 'busy';
    tx.set(ref, {
      ...context, invoiceId, channel, status: 'sending', claimId,
      claimedAtMs: claimedAt, attempts: Number(previous.attempts || 0) + 1,
      updatedAt: new Date(claimedAt),
    }, { merge: true });
    return 'claimed';
  });
  if (claim === 'complete') return { status: 'already_complete' };
  // A concurrent request must not acknowledge delivery before its owner finishes.
  if (claim === 'busy') throw new Error(`${channel} payment notification is in progress`);
  const finish = (data) => database.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (snap.data()?.claimId === claimId) tx.set(ref, data, { merge: true });
  });
  try {
    const result = await deliver();
    if (!result?.success) throw new Error(result?.error || `${channel} delivery failed`);
    const status = result.suppressed ? 'suppressed' : result.unavailable ? 'unavailable' : 'sent';
    await finish({
      status, messageId: result.messageId || null, reason: result.reason || null,
      lastError: null, claimId: null, updatedAt: new Date(now()),
      ...(status === 'sent' ? { sentAt: new Date(now()) } : {}),
    });
    return { status };
  } catch (error) {
    await finish({ status: 'failed', claimId: null, lastError: text(error?.message).slice(0, 500), updatedAt: new Date(now()) });
    throw error;
  }
}

async function sendTeamPaymentFailureNotifications({
  database, messaging, invoice, subscription, firebaseMode = 'prod', sendEmail, now,
}) {
  const userId = text(subscription?.metadata?.userId);
  const teamId = text(subscription?.metadata?.pulsecheckTeamId);
  const invoiceId = text(invoice?.id);
  if (![userId, teamId, invoiceId].every(safeId)) throw new Error('Missing team payment notification identity');
  // A replay of an old failure must not ask an athlete to pay an invoice already settled.
  if (invoice.paid || ['paid', 'void'].includes(invoice.status) || Number(invoice.amount_remaining) === 0) return { skipped: 'invoice_resolved' };
  const paymentUrl = teamBillingUrl(teamId, firebaseMode);
  const context = { userId, teamId, subscriptionId: subscription.id, firebaseMode, paymentUrl };
  const suppressed = firebaseMode !== 'prod' || invoice.livemode !== true || subscription.livemode !== true;
  const [userSnap, teamSnap] = await Promise.all([
    database.collection('users').doc(userId).get(),
    database.collection('pulsecheck-teams').doc(teamId).get(),
  ]);
  const user = userSnap.exists ? userSnap.data() : {};
  const team = teamSnap.exists ? teamSnap.data() : {};
  const teamName = text(team.displayName || team.name || team.teamName) || 'Your team';
  const suppression = { success: true, suppressed: true, reason: 'non_production_delivery_disabled' };
  const senders = {
    email: async () => {
      if (suppressed) return suppression;
      const email = text(user.email) || text(invoice.customer_email);
      if (!email) return { success: true, unavailable: true, reason: 'missing_email' };
      const emailProvider = sendEmail || require('../utils/sendBrevoTransactionalEmail').sendBrevoTransactionalEmail;
      const result = await emailProvider({
        toEmail: email,
        toName: text(user.displayName || user.firstName) || undefined,
        subject: `Action needed: your ${teamName} payment`,
        htmlContent: `<p>Your payment for ${escapeHtml(teamName)} could not be completed.</p><p>Open your team's secure payment page to review the balance, update your payment method, and complete your payment.</p><p><a href="${escapeHtml(paymentUrl)}">Review team payment</a></p>`,
        sender: { name: teamName, email: process.env.BREVO_SENDER_EMAIL || 'no-reply@fitwithpulse.ai' },
        tags: ['pulsecheck-team-payment-failed'],
        idempotencyKey: `pulsecheck-team-payment-failed:${firebaseMode}:${invoiceId}`,
        idempotencyMetadata: { sequence: 'pulsecheck-team-payment-failed', product: 'pulsecheck', userId, teamId, invoiceId },
        // Billing service messages must not be dropped by the shared marketing daily quota.
        bypassDailyRecipientLimit: true,
        failClosedOnSuppressionError: true,
      });
      if (result?.suppressed) return { ...result, reason: result.suppressionReason || 'recipient_suppressed' };
      // The email helper also uses skipped for an in-progress lock. That is not delivery.
      if (result?.skipped && !result.messageId) return { success: false, error: 'Email delivery is pending' };
      return result;
    },
    push: async () => {
      if (suppressed) return suppression;
      const { resolvePulseCheckPushTarget, buildNoraPushMessage } = require('../pulsecheck-notification-utils');
      const target = resolvePulseCheckPushTarget(user);
      if (!target.eligible) return { success: true, unavailable: true, reason: target.reason };
      const message = buildNoraPushMessage({
        fcmToken: target.token,
        title: `${teamName}: payment update`,
        body: 'Your team payment needs attention. Tap to review and complete it securely.',
        data: { type: 'payment_failed', screen: 'team_billing', webUrl: paymentUrl, url: paymentUrl, teamId },
      });
      // Android must receive data in the background so its billing click handler runs.
      message.data.title = message.notification.title;
      message.data.body = message.notification.body;
      delete message.notification;
      message.apns.headers['apns-collapse-id'] = invoiceId;
      message.apns.payload.aps.category = 'TEAM_BILLING';
      message.apns.payload.aps['thread-id'] = 'team-billing';
      message.android = { priority: 'high', collapseKey: invoiceId };
      const messageId = await messaging.send(message);
      return { success: true, messageId };
    },
  };
  const results = await Promise.allSettled(Object.entries(senders).map(([channel, deliver]) =>
    deliverChannel({ database, invoiceId, channel, context, deliver, now })));
  const failures = results.filter((result) => result.status === 'rejected');
  // Return a non-2xx webhook response so Stripe retries only unfinished channels.
  if (failures.length) throw new Error(`Team payment notification delivery failed: ${failures.map((result) => result.reason?.message).join('; ')}`);
  return { email: results[0].value, push: results[1].value };
}

module.exports = { sendTeamPaymentFailureNotifications, teamBillingUrl, deliverChannel, LEASE_MS };
