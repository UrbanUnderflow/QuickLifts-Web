const { headers } = require('./config/firebase');
const { verifyFirebaseUser } = require('./lib/pulsecheck-coach-services');
const {
  PAYOUT_METHODS,
  PAYOUT_REQUESTS_COLLECTION,
  PAYOUT_STATES_COLLECTION,
  adminRecipientEmails,
  buildPayoutSummary,
  escapeHtml,
  normalizeString,
  payoutStateId,
  payoutMethodLabel,
  resolveSiteUrl,
  serializePayoutRequest,
} = require('./utils/pulsecheck-coach-payouts');
const { loadCoachEarnings } = require('./get-pulsecheck-coach-earnings');
const {
  buildEmailDedupeKey,
  sendBrevoTransactionalEmail,
} = require('./utils/sendBrevoTransactionalEmail');

const jsonHeaders = {
  ...headers,
  'Content-Type': 'application/json',
  'Cache-Control': 'private, no-store',
};

const json = (statusCode, body) => ({
  statusCode,
  headers: jsonHeaders,
  body: JSON.stringify(body),
});

const verifyCoach = (event) =>
  verifyFirebaseUser(event, {
    authErrorMessage: 'Sign in is required to request a payout.',
  });

const renderPayoutRequestEmail = ({
  amountCents,
  coachName,
  coachEmail,
  paymentMethod,
  paymentDestination,
  adminUrl,
}) => {
  const amount = `$${(amountCents / 100).toFixed(2)}`;
  const method = payoutMethodLabel(paymentMethod);
  const safeName = escapeHtml(coachName);
  const safeEmail = escapeHtml(coachEmail);
  const safeMethod = escapeHtml(method);
  const safeDestination = escapeHtml(paymentDestination);
  const safeAdminUrl = escapeHtml(adminUrl);

  return {
    subject: `${safeName} requested a ${amount} PulseCheck payout`,
    html: `
      <div style="background:#101214;padding:32px 16px;font-family:Arial,sans-serif;color:#f7f7f7">
        <div style="max-width:620px;margin:0 auto;background:#181b20;border:1px solid #30343b;border-radius:16px;padding:28px">
          <div style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#d7ff00">PulseCheck payout request</div>
          <h1 style="margin:12px 0 8px;font-size:26px">${amount} requested</h1>
          <p style="margin:0 0 20px;color:#b7bcc5;line-height:1.6">
            ${safeName}${safeEmail ? ` (${safeEmail})` : ''} requested the selected team’s available coach earnings.
          </p>
          <div style="background:#111317;border-radius:12px;padding:16px;margin-bottom:22px">
            <div style="margin-bottom:8px"><strong>Payment method:</strong> ${safeMethod}</div>
            <div><strong>Send payment to:</strong> ${safeDestination}</div>
          </div>
          <a href="${safeAdminUrl}" style="display:inline-block;background:#d7ff00;color:#111317;text-decoration:none;font-weight:700;padding:13px 18px;border-radius:10px">
            Review and complete payout
          </a>
          <p style="margin:20px 0 0;color:#777f8b;font-size:12px;line-height:1.5">
            The balance stays in Requested status until an admin confirms the manual payment.
          </p>
        </div>
      </div>
    `,
  };
};

const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: jsonHeaders, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return json(405, { success: false, message: 'Method Not Allowed' });
  }

  try {
    const {
      userId: coachUserId,
      decoded,
      app,
    } = await verifyCoach(event);
    const database = app.firestore();
    const body = JSON.parse(event.body || '{}');
    const teamId = normalizeString(body.teamId);
    const paymentMethod = normalizeString(body.paymentMethod).toLowerCase();
    const paymentDestination = normalizeString(body.paymentDestination);

    if (!teamId) {
      return json(400, {
        success: false,
        message: 'Choose a team before requesting a payout.',
      });
    }
    if (!PAYOUT_METHODS.has(paymentMethod)) {
      return json(400, {
        success: false,
        message: 'Choose Zelle, Apple Pay, or Cash App.',
      });
    }
    if (paymentDestination.length < 3 || paymentDestination.length > 200) {
      return json(400, {
        success: false,
        message: 'Enter the email, phone number, or handle that should receive the payout.',
      });
    }

    const [earnings, coachSnapshot] = await Promise.all([
      loadCoachEarnings(coachUserId, teamId, database),
      database.collection('users').doc(coachUserId).get(),
    ]);
    const totalEarnedCents = Math.max(
      0,
      Number(earnings.payoutEligibleCents) || 0
    );
    const coach = coachSnapshot.exists ? coachSnapshot.data() || {} : {};
    const coachName = normalizeString(coach.displayName || coach.username) || 'PulseCheck coach';
    const coachEmail = normalizeString(coach.email || decoded.email);
    const requestRef = database.collection(PAYOUT_REQUESTS_COLLECTION).doc();
    const stateDocumentId = payoutStateId(coachUserId, teamId);
    if (!stateDocumentId) {
      return json(400, {
        success: false,
        message: 'The selected payout team is invalid.',
      });
    }
    const stateRef = database.collection(PAYOUT_STATES_COLLECTION).doc(stateDocumentId);
    const legacyStateRef = database.collection(PAYOUT_STATES_COLLECTION).doc(coachUserId);
    const requestedAt = new Date();
    let requestData;
    let stateAfter;

    await database.runTransaction(async (transaction) => {
      const [stateSnapshot, legacyStateSnapshot] = await Promise.all([
        transaction.get(stateRef),
        transaction.get(legacyStateRef),
      ]);
      let state = stateSnapshot.exists ? stateSnapshot.data() || {} : {};
      if (!stateSnapshot.exists && legacyStateSnapshot.exists) {
        const legacyState = legacyStateSnapshot.data() || {};
        const legacyTeamId = normalizeString(legacyState.teamId);
        const legacyTeamIds = Array.isArray(legacyState.teamIds)
          ? legacyState.teamIds.map(normalizeString).filter(Boolean)
          : [];
        const legacyHasBalance = Math.max(0, Number(legacyState.paidCents) || 0) > 0
          || Math.max(0, Number(legacyState.requestedCents) || 0) > 0
          || Boolean(normalizeString(legacyState.activeRequestId));
        const legacyMatchesTeam = legacyTeamId === teamId
          || (legacyTeamIds.length === 1 && legacyTeamIds[0] === teamId);
        if (legacyHasBalance && !legacyMatchesTeam) {
          const error = new Error(
            'Your earlier payout balance needs a one-time team assignment before another payout can be requested.'
          );
          error.statusCode = 409;
          throw error;
        }
        if (legacyMatchesTeam) state = legacyState;
      }
      const activeRequestId = normalizeString(state.activeRequestId);
      let activeRequest = null;

      if (activeRequestId) {
        const activeSnapshot = await transaction.get(
          database.collection(PAYOUT_REQUESTS_COLLECTION).doc(activeRequestId)
        );
        if (activeSnapshot.exists) {
          activeRequest = { id: activeSnapshot.id, ...(activeSnapshot.data() || {}) };
        }
      }

      if (activeRequest && normalizeString(activeRequest.status).toLowerCase() === 'requested') {
        const error = new Error('A payout request is already waiting for review.');
        error.statusCode = 409;
        throw error;
      }

      const paidCents = Math.max(0, Number(state.paidCents) || 0);
      const amountCents = Math.max(0, totalEarnedCents - paidCents);
      if (amountCents <= 0) {
        const error = new Error('There is no unpaid balance available to request.');
        error.statusCode = 409;
        throw error;
      }

      const transactionSnapshot = (Array.isArray(earnings.members) ? earnings.members : [])
        .flatMap((member) => (Array.isArray(member.payments) ? member.payments : []).map((payment) => ({
          athleteUserId: normalizeString(member.userId) || null,
          athleteName: normalizeString(member.name) || 'Team member',
          paymentId: normalizeString(payment.id) || null,
          paidAt: payment.paidAt || null,
          amountPaidCents: Math.max(0, Number(payment.amountPaidCents) || 0),
          source: normalizeString(payment.source) || 'unknown',
          sourceLabel: normalizeString(payment.sourceLabel) || 'Payment source unavailable',
          platformFeePct: Math.max(0, Number(payment.platformFeePct) || 0),
          platformFeeCents: Math.max(0, Number(payment.platformFeeCents) || 0),
          netRevenueCents: Math.max(0, Number(payment.netRevenueCents) || 0),
          coachShareCents: Math.max(0, Number(payment.coachShareCents) || 0),
          currency: normalizeString(payment.currency).toLowerCase() || 'usd',
        })));
      const serviceTransactionSnapshot = (
        Array.isArray(earnings.serviceEarnings?.transactions)
          ? earnings.serviceEarnings.transactions
          : []
      ).map((transactionEntry) => ({
        athleteUserId: normalizeString(transactionEntry.athleteUserId) || null,
        athleteName: normalizeString(transactionEntry.athleteName) || 'Athlete',
        paymentId:
          normalizeString(transactionEntry.paymentIntentId)
          || normalizeString(transactionEntry.id)
          || null,
        paidAt: transactionEntry.paidAt || transactionEntry.bookedAt || null,
        amountPaidCents: Math.max(0, Number(transactionEntry.amountCents) || 0),
        source: 'coach_service',
        sourceLabel: normalizeString(transactionEntry.serviceTitle) || 'Coach service',
        platformFeePct: 0,
        platformFeeCents: Math.max(
          0,
          Number(transactionEntry.platformFeeCents) || 0
        ),
        netRevenueCents: Math.max(
          0,
          Number(transactionEntry.coachNetCents) || 0
        ),
        coachShareCents: Math.max(
          0,
          Number(transactionEntry.coachNetCents) || 0
        ),
        currency: normalizeString(transactionEntry.currency).toLowerCase() || 'usd',
      }));
      transactionSnapshot.push(...serviceTransactionSnapshot);
      const athleteAppTransactionSnapshot = (
        Array.isArray(earnings.athleteAppSubscriptionEarnings?.transactions)
          ? earnings.athleteAppSubscriptionEarnings.transactions
          : []
      ).map((transactionEntry) => ({
        athleteUserId: normalizeString(transactionEntry.athleteUserId) || null,
        athleteName: 'Team athlete',
        paymentId:
          normalizeString(transactionEntry.invoiceId)
          || normalizeString(transactionEntry.id)
          || null,
        paidAt: transactionEntry.paidAt || null,
        amountPaidCents: Math.max(0, Number(transactionEntry.amountPaidCents) || 0),
        source: 'pulsecheck_coach_athlete_offer',
        sourceLabel: 'Coach-priced PulseCheck subscription',
        platformFeePct: 50,
        platformFeeCents: Math.max(
          0,
          Number(transactionEntry.platformShareCents) || 0
        ),
        stripeProcessingFeeCents: Math.max(
          0,
          Number(transactionEntry.stripeProcessingFeeCents) || 0
        ),
        netRevenueCents: Math.max(0, Number(transactionEntry.coachNetCents) || 0),
        coachShareCents: Math.max(0, Number(transactionEntry.coachNetCents) || 0),
        currency: normalizeString(transactionEntry.currency).toLowerCase() || 'usd',
      }));
      transactionSnapshot.push(...athleteAppTransactionSnapshot);

      requestData = {
        coachUserId,
        coachName,
        coachEmail: coachEmail || null,
        amountCents,
        currency: 'usd',
        status: 'requested',
        paymentMethod,
        paymentDestination,
        teamIds: Array.isArray(earnings.teamIds) ? earnings.teamIds : [],
        teamId,
        organizationId: earnings.organizationId || null,
        shareRates: Array.isArray(earnings.shareRates) ? earnings.shareRates : [],
        earnedThroughCents: totalEarnedCents,
        transactionCount: transactionSnapshot.length,
        transactionSnapshot,
        requestedAt,
        updatedAt: requestedAt,
        emailSent: false,
        source: 'pulsecheck-coach-dashboard',
      };
      stateAfter = {
        coachUserId,
        teamId,
        organizationId: earnings.organizationId || null,
        paidCents,
        requestedCents: amountCents,
        activeRequestId: requestRef.id,
        totalEarnedCentsAtLastRequest: totalEarnedCents,
        updatedAt: requestedAt,
      };

      transaction.create(requestRef, requestData);
      transaction.set(stateRef, stateAfter, { merge: true });
    });

    const adminUrl = `${resolveSiteUrl(event)}/admin/pulsecheckPayouts?request=${encodeURIComponent(requestRef.id)}`;
    const email = renderPayoutRequestEmail({
      amountCents: requestData.amountCents,
      coachName,
      coachEmail,
      paymentMethod,
      paymentDestination,
      adminUrl,
    });
    const recipients = adminRecipientEmails();
    const emailResults = await Promise.all(recipients.map((recipientEmail) =>
      sendBrevoTransactionalEmail({
        toEmail: recipientEmail,
        toName: 'Pulse Admin',
        subject: email.subject,
        htmlContent: email.html,
        tags: ['pulsecheck', 'coach-payout', 'payout-requested'],
        sender: {
          email: process.env.BREVO_SENDER_EMAIL || 'tre@fitwithpulse.ai',
          name: 'PulseCheck',
        },
        replyTo: coachEmail ? { email: coachEmail, name: coachName } : undefined,
        idempotencyKey: buildEmailDedupeKey([
          'pulsecheck-coach-payout-request-v1',
          requestRef.id,
          recipientEmail,
        ]),
        idempotencyMetadata: {
          kind: 'pulsecheck-coach-payout-request',
          payoutRequestId: requestRef.id,
          userId: coachUserId,
          product: 'pulsecheck',
        },
        bypassDailyRecipientLimit: true,
      })
    ));
    const emailSent = emailResults.some((result) => result?.success === true);

    await requestRef.set({
      emailSent,
      emailSentAt: emailSent ? new Date() : null,
      emailRecipientCount: recipients.length,
      emailError: emailSent
        ? null
        : emailResults.map((result) => result?.error).filter(Boolean).join('; ') || 'Email was not sent.',
      adminUrl,
      updatedAt: new Date(),
    }, { merge: true });

    return json(201, {
      success: true,
      request: serializePayoutRequest(requestRef.id, {
        ...requestData,
        emailSent,
      }),
      payout: buildPayoutSummary({
        earnedCents: totalEarnedCents,
        state: stateAfter,
        activeRequest: {
          id: requestRef.id,
          ...requestData,
          emailSent,
        },
      }),
      emailSent,
    });
  } catch (error) {
    const statusCode = Number(error.statusCode) || 500;
    if (statusCode >= 500) {
      console.error('[PulseCheckCoachPayout] Failed to request payout:', error);
    }
    return json(statusCode, {
      success: false,
      message: error.message || 'The payout request could not be submitted.',
    });
  }
};

module.exports = {
  handler,
  renderPayoutRequestEmail,
  verifyCoach,
};
