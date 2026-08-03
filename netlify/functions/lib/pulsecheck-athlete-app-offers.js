const { normalizeString: normalizeCoachServiceString } = require('./pulsecheck-coach-services');

const OFFERS_COLLECTION = 'pulsecheck-athlete-app-offers';
const ENTITLEMENTS_COLLECTION = 'pulsecheck-athlete-app-entitlements';
const REVENUE_EVENTS_COLLECTION = 'pulsecheck-athlete-app-revenue-events';
const TEAMS_COLLECTION = 'pulsecheck-teams';
const ORGANIZATIONS_COLLECTION = 'pulsecheck-organizations';
const TEAM_MEMBERSHIPS_COLLECTION = 'pulsecheck-team-memberships';
const INVITES_COLLECTION = 'pulsecheck-invite-links';
const USERS_COLLECTION = 'users';
const SUBSCRIPTIONS_COLLECTION = 'subscriptions';
const ADMIN_COLLECTION = 'admin';

const ATHLETE_APP_PAYMENT_TYPE = 'pulsecheck_athlete_app_subscription';
const ATHLETE_APP_CHECKOUT_SOURCE = 'pulsecheck-coach-athlete-offer';
const ATHLETE_APP_PLAN_TYPE = 'pulsecheck-monthly';
const PLATFORM_SHARE_PERCENT = 50;

const normalizeString = (value) => normalizeCoachServiceString(value);
const normalizeStatus = (value) => normalizeString(value).toLowerCase();
const normalizeEmail = (value) => normalizeString(value).toLowerCase();

const requestError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const isSafeDocumentId = (value) => {
  const id = normalizeString(value);
  return Boolean(id) && id.length <= 240 && id !== '.' && id !== '..' && !id.includes('/');
};

const isActiveRecord = (value = {}) => {
  const status = normalizeStatus(value.status);
  return (!status || status === 'active')
    && value.revokedAt == null
    && value.archivedAt == null
    && value.deletedAt == null;
};

const isActiveContainer = (value = {}) => (
  normalizeStatus(value.status) === 'active'
  && value.revokedAt == null
  && value.archivedAt == null
  && value.deletedAt == null
);

const epochSeconds = (value) => {
  if (!value) return 0;
  if (typeof value === 'number') return value > 10_000_000_000 ? Math.floor(value / 1000) : Math.floor(value);
  if (typeof value.seconds === 'number') return Math.floor(value.seconds);
  if (typeof value.toMillis === 'function') return Math.floor(value.toMillis() / 1000);
  if (value instanceof Date) return Math.floor(value.getTime() / 1000);
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 0 : Math.floor(parsed.getTime() / 1000);
};

const stripeObjectId = (value) => (
  typeof value === 'string'
    ? normalizeString(value)
    : normalizeString(value?.id)
);

const entitlementId = (teamId, userId) => {
  const normalizedTeamId = normalizeString(teamId);
  const normalizedUserId = normalizeString(userId);
  if (!isSafeDocumentId(normalizedTeamId) || !isSafeDocumentId(normalizedUserId)) return '';
  return `${normalizedTeamId}_${normalizedUserId}`;
};

const isAthleteAppMetadata = (metadata = {}) => (
  normalizeString(metadata.payment_type) === ATHLETE_APP_PAYMENT_TYPE
  || normalizeString(metadata.pulsecheckAthleteAppOffer) === 'true'
);

const isAthleteAppSubscription = (subscription) => isAthleteAppMetadata(subscription?.metadata || {});

const publicOffer = (offer = {}) => ({
  id: normalizeString(offer.id || offer.offerId || offer.teamId),
  offerId: normalizeString(offer.offerId || offer.id || offer.teamId),
  organizationId: normalizeString(offer.organizationId),
  teamId: normalizeString(offer.teamId),
  enabled: offer.enabled === true && normalizeStatus(offer.status) === 'active',
  status: normalizeStatus(offer.status) || 'inactive',
  monthlyPriceCents: Math.max(0, Math.round(Number(offer.monthlyPriceCents) || 0)),
  currency: normalizeStatus(offer.currency) || 'usd',
  interval: 'month',
  version: Math.max(0, Math.round(Number(offer.version) || 0)),
  platformSharePercent: PLATFORM_SHARE_PERCENT,
  feePolicy: 'coach-pays-actual-stripe-processing-fee',
});

const resolveCapabilities = (membership = {}) => {
  const role = normalizeStatus(membership.role);
  const raw = membership.staffCapabilities;
  if (raw == null || (Array.isArray(raw) && raw.length === 0)) {
    if (role === 'team-admin') return new Set(['admin']);
    if (role === 'coach') return new Set(['coaching']);
    if (role === 'support-staff') return new Set(['administrative']);
    return new Set();
  }
  if (!Array.isArray(raw)) return role === 'team-admin' ? new Set(['admin']) : new Set();
  const allowed = new Set(['admin', 'administrative', 'coaching', 'athletic_trainer']);
  const capabilities = new Set();
  for (const value of raw) {
    const capability = normalizeStatus(value);
    if (!allowed.has(capability)) return role === 'team-admin' ? new Set(['admin']) : new Set();
    capabilities.add(capability);
  }
  if (role === 'team-admin') capabilities.add('admin');
  return capabilities;
};

const isPlatformAdmin = async ({ database, decoded }) => {
  if (decoded?.admin === true) return true;
  const email = normalizeEmail(decoded?.email);
  if (!email) return false;
  const snapshot = await database.collection(ADMIN_COLLECTION).doc(email).get();
  return snapshot.exists;
};

const authorizeOfferManager = async ({ database, userId, decoded, teamId }) => {
  const normalizedUserId = normalizeString(userId);
  const normalizedTeamId = normalizeString(teamId);
  if (!isSafeDocumentId(normalizedUserId) || !isSafeDocumentId(normalizedTeamId)) {
    throw requestError('Choose a valid team.', 400);
  }

  const teamSnapshot = await database.collection(TEAMS_COLLECTION).doc(normalizedTeamId).get();
  if (!teamSnapshot.exists) throw requestError('The selected team could not be found.', 404);
  const team = { id: teamSnapshot.id, ...(teamSnapshot.data() || {}) };
  const organizationId = normalizeString(team.organizationId);
  if (!isSafeDocumentId(organizationId) || !isActiveContainer(team)) {
    throw requestError('The selected team is inactive.', 403);
  }
  const organizationSnapshot = await database.collection(ORGANIZATIONS_COLLECTION).doc(organizationId).get();
  const organization = organizationSnapshot.exists ? organizationSnapshot.data() || {} : {};
  if (!organizationSnapshot.exists || !isActiveContainer(organization)) {
    throw requestError('The selected organization is inactive.', 403);
  }

  if (await isPlatformAdmin({ database, decoded })) {
    return { team, organization, organizationId, membership: null, platformAdmin: true };
  }

  const membershipId = `${normalizedTeamId}_${normalizedUserId}`;
  const membershipSnapshot = await database
    .collection(TEAM_MEMBERSHIPS_COLLECTION)
    .doc(membershipId)
    .get();
  const membership = membershipSnapshot.exists ? membershipSnapshot.data() || {} : {};
  const capabilities = resolveCapabilities(membership);
  if (
    !membershipSnapshot.exists
    || membershipSnapshot.id !== membershipId
    || normalizeString(membership.userId) !== normalizedUserId
    || normalizeString(membership.teamId) !== normalizedTeamId
    || normalizeString(membership.organizationId) !== organizationId
    || normalizeStatus(membership.role) === 'athlete'
    || !isActiveRecord(membership)
    || (!capabilities.has('admin') && !capabilities.has('coaching'))
  ) {
    throw requestError('Coach or team admin access is required to set the subscription price.', 403);
  }
  return { team, organization, organizationId, membership, platformAdmin: false };
};

const normalizeOfferPriceCents = (value) => {
  const cents = Number(value);
  if (!Number.isSafeInteger(cents) || cents < 100 || cents > 100_000) {
    throw requestError('Set a monthly price between $1.00 and $1,000.00.');
  }
  return cents;
};

const stripeModeRecord = (offer, stripeMode) => {
  const record = offer?.stripeByMode?.[stripeMode];
  return record && typeof record === 'object' ? record : {};
};

const loadCoachPricedInviteCheckout = async ({
  database,
  userId,
  authenticatedEmail,
  authenticatedEmailVerified,
  inviteToken,
  requestedTeamId,
  stripeMode,
}) => {
  const normalizedUserId = normalizeString(userId);
  const normalizedInviteToken = normalizeString(inviteToken);
  const normalizedRequestedTeamId = normalizeString(requestedTeamId);
  if (!isSafeDocumentId(normalizedUserId) || !isSafeDocumentId(normalizedInviteToken)) {
    throw requestError('A valid athlete invite and signed-in account are required.');
  }

  const [inviteSnapshot, userSnapshot] = await Promise.all([
    database.collection(INVITES_COLLECTION).doc(normalizedInviteToken).get(),
    database.collection(USERS_COLLECTION).doc(normalizedUserId).get(),
  ]);
  if (!inviteSnapshot.exists) throw requestError('This athlete invite is no longer available.', 404);
  if (!userSnapshot.exists) throw requestError('Create your PulseCheck account before checkout.', 404);

  const invite = inviteSnapshot.data() || {};
  const teamId = normalizeString(invite.teamId);
  const organizationId = normalizeString(invite.organizationId);
  const inviteStatus = normalizeStatus(invite.status);
  const redemptionMode = normalizeStatus(invite.redemptionMode) === 'general' ? 'general' : 'single-use';
  const sameUserSingleUseReplay = redemptionMode === 'single-use'
    && inviteStatus === 'redeemed'
    && normalizeString(invite.redeemedByUserId) === normalizedUserId;
  const usableStatus = redemptionMode === 'general'
    ? inviteStatus === 'active' || inviteStatus === 'redeemed'
    : inviteStatus === 'active' || sameUserSingleUseReplay;
  const targetEmail = normalizeEmail(invite.targetEmail);
  const userData = userSnapshot.data() || {};
  const verifiedAuthEmail = normalizeEmail(authenticatedEmail);
  const resolvedEmail = verifiedAuthEmail || normalizeEmail(userData.email);
  if (
    normalizeString(invite.inviteType) !== 'team-access'
    || normalizeStatus(invite.teamMembershipRole) !== 'athlete'
    || !usableStatus
    || invite.revokedAt != null
    || !isSafeDocumentId(teamId)
    || !isSafeDocumentId(organizationId)
    || (normalizedRequestedTeamId && normalizedRequestedTeamId !== teamId)
    || (
      targetEmail
      && (
        targetEmail !== verifiedAuthEmail
        || authenticatedEmailVerified !== true
      )
    )
  ) {
    throw requestError('This athlete invite could not be verified.', 403);
  }
  const expiresAt = epochSeconds(invite.expiresAt || invite.expirationDate);
  if (expiresAt && expiresAt <= Math.floor(Date.now() / 1000)) {
    throw requestError('This athlete invite has expired.', 410);
  }

  const [teamSnapshot, organizationSnapshot, offerSnapshot, entitlementSnapshot] = await Promise.all([
    database.collection(TEAMS_COLLECTION).doc(teamId).get(),
    database.collection(ORGANIZATIONS_COLLECTION).doc(organizationId).get(),
    database.collection(OFFERS_COLLECTION).doc(teamId).get(),
    database.collection(ENTITLEMENTS_COLLECTION).doc(entitlementId(teamId, normalizedUserId)).get(),
  ]);
  const team = teamSnapshot.exists ? teamSnapshot.data() || {} : {};
  const organization = organizationSnapshot.exists ? organizationSnapshot.data() || {} : {};
  const offer = offerSnapshot.exists ? { id: offerSnapshot.id, ...(offerSnapshot.data() || {}) } : null;
  const commercialConfig = team.commercialConfig || {};
  if (
    !teamSnapshot.exists
    || !organizationSnapshot.exists
    || normalizeString(team.organizationId) !== organizationId
    || !isActiveContainer(team)
    || !isActiveContainer(organization)
  ) {
    throw requestError('This athlete invite team is inactive.', 403);
  }
  if (
    normalizeStatus(commercialConfig.commercialModel) === 'team-plan'
    && normalizeStatus(commercialConfig.teamPlanStatus) === 'active'
  ) {
    throw requestError('This athlete is already covered by the team plan.', 409);
  }
  if (commercialConfig.athleteAppSubscriptionEnabled !== true) {
    throw requestError('Athlete subscriptions are not active for this team.', 409);
  }
  const modeRecord = stripeModeRecord(offer, stripeMode);
  const configuredVersion = Math.max(0, Math.round(Number(commercialConfig.athleteAppSubscriptionOfferVersion) || 0));
  if (
    !offer
    || offer.enabled !== true
    || normalizeStatus(offer.status) !== 'active'
    || normalizeString(offer.teamId) !== teamId
    || normalizeString(offer.organizationId) !== organizationId
    || normalizeStatus(offer.currency) !== 'usd'
    || normalizeStatus(offer.interval) !== 'month'
    || !normalizeString(modeRecord.priceId)
    || modeRecord.active !== true
    || (configuredVersion && Number(offer.version) !== configuredVersion)
  ) {
    throw requestError('This team subscription price is not ready yet.', 409);
  }

  const entitlement = entitlementSnapshot.exists ? entitlementSnapshot.data() || {} : {};
  const entitlementActive = entitlement.active === true
    && normalizeStatus(entitlement.status) === 'active'
    && normalizeString(entitlement.userId) === normalizedUserId
    && normalizeString(entitlement.teamId) === teamId
    && epochSeconds(entitlement.currentPeriodEndEpochSeconds || entitlement.currentPeriodEnd) > Math.floor(Date.now() / 1000);
  if (entitlementActive) {
    const error = requestError('This account already has an active subscription for this team.', 409);
    error.alreadyActive = true;
    throw error;
  }
  if (sameUserSingleUseReplay) {
    throw requestError('This single-use athlete invite has already been redeemed.', 409);
  }

  return {
    userId: normalizedUserId,
    userData,
    email: resolvedEmail,
    inviteToken: normalizedInviteToken,
    invite,
    teamId,
    team,
    organizationId,
    organization,
    offer,
    priceId: normalizeString(modeRecord.priceId),
    productId: normalizeString(modeRecord.productId),
    revenueRecipientUserId: normalizeString(offer.revenueRecipientUserId),
  };
};

const revenueBreakdown = ({ grossCents, actualStripeFeeCents }) => {
  const grossRevenueCents = Math.max(0, Math.round(Number(grossCents) || 0));
  const stripeProcessingFeeCents = Math.max(0, Math.round(Number(actualStripeFeeCents) || 0));
  const platformShareCents = Math.round(grossRevenueCents * (PLATFORM_SHARE_PERCENT / 100));
  const coachNetCents = Math.max(
    0,
    grossRevenueCents - platformShareCents - stripeProcessingFeeCents
  );
  const platformNetCents = Math.max(
    0,
    grossRevenueCents - stripeProcessingFeeCents - coachNetCents
  );
  return {
    grossRevenueCents,
    platformSharePercent: PLATFORM_SHARE_PERCENT,
    platformShareCents,
    stripeProcessingFeeCents,
    coachNetCents,
    platformNetCents,
  };
};

const athleteAppInvoiceCoversCurrentPeriod = ({ invoice, subscription, ledger } = {}) => {
  const invoiceId = stripeObjectId(invoice);
  const latestInvoiceId = stripeObjectId(subscription?.latest_invoice);
  if (invoiceId && latestInvoiceId) return invoiceId === latestInvoiceId;

  const currentPeriodEnd = Math.max(0, Math.floor(Number(subscription?.current_period_end) || 0));
  const ledgerPeriodEnd = Math.max(
    0,
    Math.floor(Number(ledger?.currentPeriodEndEpochSeconds) || 0)
  );
  if (currentPeriodEnd && ledgerPeriodEnd) return ledgerPeriodEnd >= currentPeriodEnd;

  const invoicePeriodEnd = Math.max(
    0,
    Math.floor(Number(invoice?.period_end) || 0),
    ...(Array.isArray(invoice?.lines?.data)
      ? invoice.lines.data.map((line) => Math.floor(Number(line?.period?.end) || 0))
      : [0])
  );
  return Boolean(currentPeriodEnd && invoicePeriodEnd && invoicePeriodEnd >= currentPeriodEnd);
};

const athleteAppInvoicePeriodEnd = ({ invoice, subscription, ledger } = {}) => {
  const invoiceSpecificPeriodEnd = Math.max(
    0,
    Math.floor(Number(ledger?.currentPeriodEndEpochSeconds) || 0),
    Math.floor(Number(invoice?.period_end) || 0),
    ...(Array.isArray(invoice?.lines?.data)
      ? invoice.lines.data.map((line) => Math.floor(Number(line?.period?.end) || 0))
      : [0])
  );
  return invoiceSpecificPeriodEnd
    || Math.max(0, Math.floor(Number(subscription?.current_period_end) || 0));
};

const balanceTransactionFromCharge = async ({ stripeClient, chargeValue }) => {
  if (!chargeValue) return null;
  let charge = chargeValue;
  if (typeof charge === 'string') {
    charge = await stripeClient.charges.retrieve(charge, { expand: ['balance_transaction'] });
  }
  let balanceTransaction = charge?.balance_transaction;
  if (typeof balanceTransaction === 'string') {
    balanceTransaction = await stripeClient.balanceTransactions.retrieve(balanceTransaction);
  }
  return balanceTransaction && typeof balanceTransaction.fee === 'number'
    ? balanceTransaction
    : null;
};

const resolveActualStripeFeeCents = async ({ stripeClient, invoice }) => {
  let balanceTransaction = await balanceTransactionFromCharge({
    stripeClient,
    chargeValue: invoice?.charge,
  });
  if (!balanceTransaction && invoice?.payment_intent) {
    const paymentIntent = typeof invoice.payment_intent === 'string'
      ? await stripeClient.paymentIntents.retrieve(invoice.payment_intent, {
          expand: ['latest_charge.balance_transaction'],
        })
      : invoice.payment_intent;
    balanceTransaction = await balanceTransactionFromCharge({
      stripeClient,
      chargeValue: paymentIntent?.latest_charge || paymentIntent?.charges?.data?.[0],
    });
  }
  if (!balanceTransaction || !Number.isFinite(Number(balanceTransaction.fee))) {
    throw requestError('Stripe processing fee details are not available yet.', 503);
  }
  return Math.max(0, Math.round(Number(balanceTransaction.fee)));
};

const replaceAthleteAppPlan = ({ plans, subscriptionId, teamId, offerId, active, expiration, nowSec, priceId }) => {
  const retained = (Array.isArray(plans) ? plans : []).filter((plan) => {
    if (!plan || typeof plan !== 'object') return true;
    return !(
      normalizeString(plan.provider) === 'stripe'
      && normalizeString(plan.source) === ATHLETE_APP_CHECKOUT_SOURCE
      && (
        normalizeString(plan.stripeSubscriptionId) === subscriptionId
        || (
          normalizeString(plan.teamId) === teamId
          && normalizeString(plan.offerId) === offerId
        )
      )
    );
  });
  retained.push({
    type: ATHLETE_APP_PLAN_TYPE,
    expiration: active ? expiration : nowSec,
    createdAt: nowSec,
    updatedAt: nowSec,
    platform: 'web',
    provider: 'stripe',
    source: ATHLETE_APP_CHECKOUT_SOURCE,
    status: active ? 'active' : 'inactive',
    productId: priceId || null,
    stripeSubscriptionId: subscriptionId,
    teamId,
    offerId,
  });
  return retained;
};

const reconcileAthleteAppSubscription = async ({
  database,
  admin,
  subscription,
  source,
  forcedStatus,
  accessBlock,
  accessClear,
}) => {
  if (!isAthleteAppSubscription(subscription)) return false;
  const metadata = subscription.metadata || {};
  const firebaseMode = normalizeStatus(metadata.pulsecheckFirebaseMode) || 'prod';
  const userId = normalizeString(metadata.userId);
  const teamId = normalizeString(metadata.pulsecheckTeamId);
  const organizationId = normalizeString(metadata.pulsecheckOrganizationId);
  const inviteToken = normalizeString(metadata.pulsecheckInviteToken);
  const offerId = normalizeString(metadata.pulsecheckOfferId) || teamId;
  const revenueRecipientUserId = normalizeString(metadata.pulsecheckRevenueRecipientUserId);
  const subscriptionId = normalizeString(subscription.id);
  const customerId = typeof subscription.customer === 'string'
    ? normalizeString(subscription.customer)
    : normalizeString(subscription.customer?.id);
  const priceId = normalizeString(subscription.items?.data?.[0]?.price?.id);
  if (
    !isSafeDocumentId(userId)
    || !isSafeDocumentId(teamId)
    || !isSafeDocumentId(organizationId)
    || !isSafeDocumentId(offerId)
    || !subscriptionId
    || !priceId
    || !['dev', 'prod'].includes(firebaseMode)
  ) {
    throw requestError('The athlete app subscription metadata is incomplete.', 500);
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const currentPeriodEnd = Math.max(0, Math.floor(Number(subscription.current_period_end) || 0));
  const status = normalizeStatus(forcedStatus || subscription.status) || 'incomplete';
  const providerActive = ['active', 'trialing'].includes(status) && currentPeriodEnd > nowSec;
  const entId = entitlementId(teamId, userId);
  const entitlementRef = database.collection(ENTITLEMENTS_COLLECTION).doc(entId);
  const subscriptionRef = database.collection(SUBSCRIPTIONS_COLLECTION).doc(userId);
  const userRef = database.collection(USERS_COLLECTION).doc(userId);
  const now = admin.firestore.FieldValue.serverTimestamp();

  await database.runTransaction(async (transaction) => {
    const [entitlementSnapshot, subscriptionSnapshot, userSnapshot] = await Promise.all([
      transaction.get(entitlementRef),
      transaction.get(subscriptionRef),
      transaction.get(userRef),
    ]);
    const entitlementData = entitlementSnapshot.exists ? entitlementSnapshot.data() || {} : {};
    const subscriptionData = subscriptionSnapshot.exists ? subscriptionSnapshot.data() || {} : {};
    const userData = userSnapshot.exists ? userSnapshot.data() || {} : {};
    const existingAccessBlock = (
      entitlementData.financialAccessBlock
      && typeof entitlementData.financialAccessBlock === 'object'
        ? entitlementData.financialAccessBlock
        : subscriptionData.financialAccessBlock
          && typeof subscriptionData.financialAccessBlock === 'object'
          ? subscriptionData.financialAccessBlock
          : {}
    );
    let nextAccessBlock = { ...existingAccessBlock };
    if (accessBlock && typeof accessBlock === 'object') {
      nextAccessBlock = {
        active: true,
        reason: normalizeStatus(accessBlock.reason) || 'payment_reversed',
        stripeInvoiceId: stripeObjectId(accessBlock.stripeInvoiceId) || null,
        disputeId: stripeObjectId(accessBlock.disputeId) || null,
        currentPeriodEndEpochSeconds: Math.max(
          0,
          Math.floor(Number(accessBlock.currentPeriodEndEpochSeconds) || currentPeriodEnd || 0)
        ),
        blockedAt: now,
        clearedAt: null,
      };
    }
    if (accessClear && typeof accessClear === 'object' && nextAccessBlock.active === true) {
      const blockedPeriodEnd = Math.max(
        0,
        Math.floor(Number(nextAccessBlock.currentPeriodEndEpochSeconds) || 0)
      );
      const clearingPeriodEnd = Math.max(
        0,
        Math.floor(Number(accessClear.currentPeriodEndEpochSeconds) || currentPeriodEnd || 0)
      );
      const blockedInvoiceId = stripeObjectId(nextAccessBlock.stripeInvoiceId);
      const clearingInvoiceId = stripeObjectId(accessClear.stripeInvoiceId);
      const sameInvoiceAllowed = accessClear.allowSameInvoice === true
        && blockedInvoiceId
        && clearingInvoiceId === blockedInvoiceId;
      const newerPaidPeriod = clearingPeriodEnd > blockedPeriodEnd;
      if (sameInvoiceAllowed || newerPaidPeriod) {
        nextAccessBlock = {
          ...nextAccessBlock,
          active: false,
          clearedBy: normalizeStatus(accessClear.reason) || 'newer_paid_invoice',
          clearedByStripeInvoiceId: clearingInvoiceId || null,
          clearedAt: now,
        };
      }
    }
    const financialAccessBlocked = nextAccessBlock.active === true;
    const active = providerActive && !financialAccessBlocked;
    const effectiveStatus = financialAccessBlocked
      ? normalizeStatus(nextAccessBlock.reason) || 'payment_reversed'
      : status;
    const plans = replaceAthleteAppPlan({
      plans: subscriptionData.plans,
      subscriptionId,
      teamId,
      offerId,
      active,
      expiration: currentPeriodEnd || nowSec,
      nowSec,
      priceId,
    });
    const hasAnotherActivePulseCheckPlan = plans.some((plan) => (
      normalizeString(plan.type).startsWith('pulsecheck-')
      && Number(plan.expiration) > nowSec
    ));
    const currentUserType = normalizeString(userData.subscriptionType);
    const nextUserType = active
      ? 'Monthly Subscriber'
      : currentUserType === 'Team Plan Access' || hasAnotherActivePulseCheckPlan
        ? currentUserType
        : 'Unsubscribed';

    transaction.set(entitlementRef, {
      id: entId,
      userId,
      organizationId,
      teamId,
      inviteToken: inviteToken || null,
      offerId,
      offerVersion: Math.max(0, Math.round(Number(metadata.pulsecheckOfferVersion) || 0)),
      revenueRecipientUserId: revenueRecipientUserId || null,
      provider: 'stripe',
      source: ATHLETE_APP_CHECKOUT_SOURCE,
      firebaseMode,
      status: active ? 'active' : effectiveStatus,
      active,
      stripeSubscriptionId: subscriptionId,
      stripeCustomerId: customerId || null,
      stripePriceId: priceId,
      currentPeriodEndEpochSeconds: active ? currentPeriodEnd : nowSec,
      financialAccessBlock: nextAccessBlock,
      lastWebhookSource: normalizeString(source) || null,
      updatedAt: now,
      createdAt: now,
    }, { merge: true });

    transaction.set(subscriptionRef, {
      userId,
      platform: 'web',
      provider: 'stripe',
      stripeSubscriptionId: subscriptionId,
      stripeCustomerId: customerId || null,
      status: active ? 'active' : effectiveStatus,
      currentPeriodEnd: active ? currentPeriodEnd : nowSec,
      pulseCheckOrganizationId: organizationId,
      pulseCheckTeamId: teamId,
      pulseCheckInviteToken: inviteToken || null,
      pulseCheckAthleteAppOfferId: offerId,
      pulseCheckFirebaseMode: firebaseMode,
      financialAccessBlock: nextAccessBlock,
      plans,
      updatedAt: now,
      createdAt: subscriptionData.createdAt || now,
    }, { merge: true });

    transaction.set(userRef, {
      subscriptionType: nextUserType,
      subscriptionPlatform: 'Web',
      stripeCustomerId: customerId || userData.stripeCustomerId || null,
      stripeSubscriptionId: subscriptionId,
      pulseCheckLatestPaidSubscriptionAttribution: {
        organizationId,
        teamId,
        inviteToken: inviteToken || null,
        offerId,
        source: ATHLETE_APP_CHECKOUT_SOURCE,
        firebaseMode,
        status: active ? 'active' : effectiveStatus,
        currentPeriodEndEpochSeconds: active ? currentPeriodEnd : nowSec,
        updatedAt: now,
      },
      updatedAt: now,
    }, { merge: true });
  });
  return true;
};

const invoiceGrossCents = (invoice) => {
  const candidates = [
    invoice?.total_excluding_tax,
    invoice?.subtotal_excluding_tax,
    invoice?.subtotal,
    invoice?.amount_paid,
  ];
  const resolved = candidates.find((value) => (
    value != null
    && value !== ''
    && Number.isFinite(Number(value))
    && Number(value) >= 0
  ));
  return Math.max(0, Math.round(Number(resolved) || 0));
};

const recordPaidAthleteAppInvoice = async ({ database, admin, stripeClient, invoice, subscription }) => {
  if (!isAthleteAppSubscription(subscription)) return false;
  const metadata = subscription.metadata || {};
  const firebaseMode = normalizeStatus(metadata.pulsecheckFirebaseMode) || 'prod';
  const invoiceId = normalizeString(invoice?.id);
  const userId = normalizeString(metadata.userId);
  const teamId = normalizeString(metadata.pulsecheckTeamId);
  const organizationId = normalizeString(metadata.pulsecheckOrganizationId);
  const offerId = normalizeString(metadata.pulsecheckOfferId) || teamId;
  if (
    !invoiceId
    || !userId
    || !teamId
    || !organizationId
    || !offerId
    || !['dev', 'prod'].includes(firebaseMode)
  ) {
    throw requestError('The paid athlete app invoice metadata is incomplete.', 500);
  }
  const actualStripeFeeCents = await resolveActualStripeFeeCents({ stripeClient, invoice });
  const breakdown = revenueBreakdown({
    grossCents: invoiceGrossCents(invoice),
    actualStripeFeeCents,
  });
  const paidAtSec = Math.floor(Number(invoice.status_transitions?.paid_at || invoice.created) || Date.now() / 1000);
  const revenueRecipientUserId = normalizeString(metadata.pulsecheckRevenueRecipientUserId);
  const eventRef = database.collection(REVENUE_EVENTS_COLLECTION).doc(invoiceId);
  const paidEvent = {
    id: invoiceId,
    type: 'athlete_app_subscription_invoice',
    status: 'paid',
    provider: 'stripe',
    source: ATHLETE_APP_CHECKOUT_SOURCE,
    firebaseMode,
    userId,
    organizationId,
    teamId,
    inviteToken: normalizeString(metadata.pulsecheckInviteToken) || null,
    offerId,
    offerVersion: Math.max(0, Math.round(Number(metadata.pulsecheckOfferVersion) || 0)),
    revenueRecipientUserId: revenueRecipientUserId || null,
    stripeInvoiceId: invoiceId,
    stripeSubscriptionId: normalizeString(subscription.id),
    stripeCustomerId: typeof subscription.customer === 'string'
      ? subscription.customer
      : normalizeString(subscription.customer?.id) || null,
    stripePriceId: normalizeString(subscription.items?.data?.[0]?.price?.id) || null,
    currency: normalizeStatus(invoice.currency) || 'usd',
    amountPaidCents: Math.max(0, Math.round(Number(invoice.amount_paid) || 0)),
    taxCents: Math.max(0, Math.round(Number(invoice.tax || invoice.total_tax_amounts?.[0]?.amount) || 0)),
    ...breakdown,
    refundedCents: 0,
    paidAtEpochSeconds: paidAtSec,
    currentPeriodEndEpochSeconds: Math.max(0, Math.floor(Number(subscription.current_period_end) || 0)),
    billingReason: normalizeString(invoice.billing_reason) || null,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  };
  await database.runTransaction(async (transaction) => {
    const existingSnapshot = await transaction.get(eventRef);
    const existing = existingSnapshot.exists ? existingSnapshot.data() || {} : {};
    const lifecycleStatus = normalizeStatus(existing.status);
    if (
      existingSnapshot.exists
      && ['partially_refunded', 'refunded', 'disputed', 'dispute_lost'].includes(lifecycleStatus)
    ) {
      transaction.set(eventRef, {
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
      return;
    }
    transaction.set(eventRef, {
      ...paidEvent,
      currentPeriodEndEpochSeconds: Math.max(
        0,
        Math.floor(
          Number(existing.currentPeriodEndEpochSeconds)
          || Number(paidEvent.currentPeriodEndEpochSeconds)
          || 0
        )
      ),
      createdAt: existing.createdAt || paidEvent.createdAt,
    }, { merge: true });
  });
  return true;
};

const recordAthleteAppRefund = async ({ database, admin, charge, invoice, subscription }) => {
  if (!isAthleteAppSubscription(subscription)) return false;
  const invoiceId = normalizeString(invoice?.id || charge?.invoice?.id || charge?.invoice);
  if (!invoiceId) throw requestError('The refunded invoice could not be resolved.', 500);
  const eventRef = database.collection(REVENUE_EVENTS_COLLECTION).doc(invoiceId);
  let result;
  await database.runTransaction(async (transaction) => {
    const eventSnapshot = await transaction.get(eventRef);
    if (!eventSnapshot.exists) {
      throw requestError('The paid invoice ledger is not ready for this refund.', 503);
    }
    const existing = eventSnapshot.data() || {};
    const incomingRefundedCents = Math.max(
      0,
      Math.round(Number(charge?.amount_refunded) || 0)
    );
    const refundedCents = Math.max(
      incomingRefundedCents,
      Math.max(0, Math.round(Number(existing.refundedCents) || 0))
    );
    const originalGrossRevenueCents = Math.max(
      0,
      Math.round(Number(existing.originalGrossRevenueCents ?? existing.grossRevenueCents) || 0)
    );
    const originalChargeAmountCents = Math.max(
      0,
      Math.round(Number(charge?.amount) || Number(existing.amountPaidCents) || 0)
    );
    const refundedGrossRevenueCents = originalChargeAmountCents > 0
      ? Math.min(
          originalGrossRevenueCents,
          Math.round(
            originalGrossRevenueCents
            * (Math.min(refundedCents, originalChargeAmountCents) / originalChargeAmountCents)
          )
        )
      : Math.min(originalGrossRevenueCents, refundedCents);
    const remainingGrossCents = Math.max(0, originalGrossRevenueCents - refundedGrossRevenueCents);
    const updatedBreakdown = revenueBreakdown({
      grossCents: remainingGrossCents,
      actualStripeFeeCents: Number(existing.stripeProcessingFeeCents) || 0,
    });
    const fullyRefunded = normalizeStatus(existing.status) === 'refunded'
      || charge?.refunded === true
      || (
        originalChargeAmountCents > 0
        && refundedCents >= originalChargeAmountCents
      );
    const refundStatus = fullyRefunded ? 'refunded' : 'partially_refunded';
    const disputeOpen = normalizeStatus(existing.disputeState) === 'open';
    const patch = {
      status: disputeOpen ? 'disputed' : refundStatus,
      originalGrossRevenueCents,
      refundedCents,
      refundedGrossRevenueCents,
      remainingGrossRevenueCents: remainingGrossCents,
      platformShareCentsAfterRefund: disputeOpen ? 0 : updatedBreakdown.platformShareCents,
      coachNetCents: disputeOpen ? 0 : updatedBreakdown.coachNetCents,
      platformNetCents: disputeOpen ? 0 : updatedBreakdown.platformNetCents,
      ...(disputeOpen ? { preDisputeLedgerStatus: refundStatus } : {}),
      refundedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    transaction.set(eventRef, patch, { merge: true });
    result = {
      handled: true,
      fullyRefunded,
      invoiceId,
      ledger: { ...existing, ...patch },
    };
  });
  return result;
};

const recordAthleteAppDisputeCreated = async ({ database, admin, dispute, invoice, subscription }) => {
  if (!isAthleteAppSubscription(subscription)) return false;
  const invoiceId = stripeObjectId(invoice);
  const disputeId = stripeObjectId(dispute);
  if (!invoiceId || !disputeId) throw requestError('The disputed invoice could not be resolved.', 500);
  const eventRef = database.collection(REVENUE_EVENTS_COLLECTION).doc(invoiceId);
  let result;
  await database.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(eventRef);
    if (!snapshot.exists) throw requestError('The paid invoice ledger is not ready for this dispute.', 503);
    const existing = snapshot.data() || {};
    const sameOpenDispute = normalizeStatus(existing.disputeState) === 'open'
      && normalizeString(existing.disputeId) === disputeId;
    if (
      normalizeStatus(existing.disputeState) === 'closed'
      && normalizeString(existing.disputeId) === disputeId
    ) {
      result = {
        handled: true,
        alreadyClosed: true,
        won: normalizeStatus(existing.disputeOutcome) === 'won',
        lost: normalizeStatus(existing.disputeOutcome) === 'lost',
        invoiceId,
        ledger: existing,
      };
      return;
    }
    if (
      normalizeStatus(existing.disputeState) === 'open'
      && normalizeString(existing.disputeId)
      && normalizeString(existing.disputeId) !== disputeId
    ) {
      throw requestError('Another dispute is already open for this invoice.', 409);
    }
    const preDisputeLedgerStatus = sameOpenDispute
      ? normalizeStatus(existing.preDisputeLedgerStatus) || 'paid'
      : normalizeStatus(existing.status) || 'paid';
    const preDisputeCoachNetCents = sameOpenDispute
      ? Math.max(0, Number(existing.preDisputeCoachNetCents) || 0)
      : Math.max(0, Number(existing.coachNetCents) || 0);
    const preDisputePlatformNetCents = sameOpenDispute
      ? Math.max(0, Number(existing.preDisputePlatformNetCents) || 0)
      : Math.max(0, Number(existing.platformNetCents) || 0);
    const preDisputePlatformShareCents = sameOpenDispute
      ? Math.max(0, Number(existing.preDisputePlatformShareCents) || 0)
      : Math.max(
          0,
          Number(existing.platformShareCentsAfterRefund ?? existing.platformShareCents) || 0
        );
    const patch = {
      status: 'disputed',
      disputeState: 'open',
      disputeOutcome: null,
      disputeId,
      disputeAmountCents: Math.max(0, Math.round(Number(dispute?.amount) || 0)),
      disputeReason: normalizeStatus(dispute?.reason) || null,
      preDisputeLedgerStatus,
      preDisputeCoachNetCents,
      preDisputePlatformNetCents,
      preDisputePlatformShareCents,
      coachNetCents: 0,
      platformNetCents: 0,
      platformShareCentsAfterRefund: 0,
      disputedAt: sameOpenDispute
        ? existing.disputedAt || admin.firestore.FieldValue.serverTimestamp()
        : admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    transaction.set(eventRef, patch, { merge: true });
    result = { handled: true, invoiceId, ledger: { ...existing, ...patch } };
  });
  return result;
};

const recordAthleteAppDisputeClosed = async ({ database, admin, dispute, invoice, subscription }) => {
  if (!isAthleteAppSubscription(subscription)) return false;
  const invoiceId = stripeObjectId(invoice);
  const disputeId = stripeObjectId(dispute);
  const outcome = normalizeStatus(dispute?.status);
  if (!invoiceId || !disputeId || !['won', 'lost'].includes(outcome)) {
    throw requestError('The closed dispute outcome could not be resolved.', 500);
  }
  const eventRef = database.collection(REVENUE_EVENTS_COLLECTION).doc(invoiceId);
  let result;
  await database.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(eventRef);
    if (!snapshot.exists) throw requestError('The paid invoice ledger is not ready for this dispute.', 503);
    const existing = snapshot.data() || {};
    const existingDisputeId = normalizeString(existing.disputeId);
    if (existingDisputeId && existingDisputeId !== disputeId) {
      throw requestError('The closed dispute does not match this invoice ledger.', 409);
    }
    const originalGrossRevenueCents = Math.max(
      0,
      Math.round(Number(existing.originalGrossRevenueCents ?? existing.grossRevenueCents) || 0)
    );
    const remainingGrossRevenueCents = Math.max(
      0,
      Math.round(Number(existing.remainingGrossRevenueCents ?? originalGrossRevenueCents) || 0)
    );
    const restoredBreakdown = revenueBreakdown({
      grossCents: remainingGrossRevenueCents,
      actualStripeFeeCents: Number(existing.stripeProcessingFeeCents) || 0,
    });
    const refundedGrossRevenueCents = Math.max(
      0,
      Math.round(Number(existing.refundedGrossRevenueCents) || 0)
    );
    const preDisputeLedgerStatus = normalizeStatus(existing.preDisputeLedgerStatus);
    const restoredStatus = refundedGrossRevenueCents >= originalGrossRevenueCents
      && originalGrossRevenueCents > 0
      ? 'refunded'
      : refundedGrossRevenueCents > 0
        ? 'partially_refunded'
        : ['paid', 'partially_refunded', 'refunded'].includes(preDisputeLedgerStatus)
          ? preDisputeLedgerStatus
          : 'paid';
    const won = outcome === 'won';
    const patch = {
      status: won ? restoredStatus : 'dispute_lost',
      disputeState: 'closed',
      disputeOutcome: outcome,
      disputeId,
      coachNetCents: won ? restoredBreakdown.coachNetCents : 0,
      platformNetCents: won ? restoredBreakdown.platformNetCents : 0,
      platformShareCentsAfterRefund: won ? restoredBreakdown.platformShareCents : 0,
      disputeClosedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    transaction.set(eventRef, patch, { merge: true });
    result = {
      handled: true,
      won,
      lost: !won,
      invoiceId,
      ledger: { ...existing, ...patch },
    };
  });
  return result;
};

const isActiveEntitlement = (entitlement, { userId, teamId, offerId } = {}) => {
  if (!entitlement || entitlement.active !== true || normalizeStatus(entitlement.status) !== 'active') return false;
  if (userId && normalizeString(entitlement.userId) !== normalizeString(userId)) return false;
  if (teamId && normalizeString(entitlement.teamId) !== normalizeString(teamId)) return false;
  if (offerId && normalizeString(entitlement.offerId) !== normalizeString(offerId)) return false;
  return epochSeconds(entitlement.currentPeriodEndEpochSeconds || entitlement.currentPeriodEnd) > Math.floor(Date.now() / 1000);
};

module.exports = {
  ADMIN_COLLECTION,
  ATHLETE_APP_CHECKOUT_SOURCE,
  ATHLETE_APP_PAYMENT_TYPE,
  ATHLETE_APP_PLAN_TYPE,
  ENTITLEMENTS_COLLECTION,
  INVITES_COLLECTION,
  OFFERS_COLLECTION,
  ORGANIZATIONS_COLLECTION,
  PLATFORM_SHARE_PERCENT,
  REVENUE_EVENTS_COLLECTION,
  SUBSCRIPTIONS_COLLECTION,
  TEAMS_COLLECTION,
  TEAM_MEMBERSHIPS_COLLECTION,
  USERS_COLLECTION,
  authorizeOfferManager,
  athleteAppInvoiceCoversCurrentPeriod,
  athleteAppInvoicePeriodEnd,
  entitlementId,
  epochSeconds,
  isActiveEntitlement,
  isActiveRecord,
  isAthleteAppMetadata,
  isAthleteAppSubscription,
  isSafeDocumentId,
  loadCoachPricedInviteCheckout,
  normalizeEmail,
  normalizeOfferPriceCents,
  normalizeStatus,
  normalizeString,
  publicOffer,
  reconcileAthleteAppSubscription,
  recordAthleteAppRefund,
  recordAthleteAppDisputeClosed,
  recordAthleteAppDisputeCreated,
  recordPaidAthleteAppInvoice,
  requestError,
  resolveActualStripeFeeCents,
  revenueBreakdown,
  stripeModeRecord,
};
