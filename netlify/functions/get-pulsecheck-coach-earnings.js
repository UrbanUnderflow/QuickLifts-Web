const Stripe = require('stripe');
const { admin, db, headers } = require('./config/firebase');
const { normalizeCommercialConfig } = require('./utils/pulsecheck-revenue');

const TEAM_MEMBERSHIPS_COLLECTION = 'pulsecheck-team-memberships';
const TEAMS_COLLECTION = 'pulsecheck-teams';
const USERS_COLLECTION = 'users';
const SUBSCRIPTIONS_COLLECTION = 'subscriptions';

const jsonHeaders = {
  ...headers,
  'Content-Type': 'application/json',
  'Cache-Control': 'private, no-store',
};

const normalizeString = (value) => (typeof value === 'string' ? value.trim() : '');
const normalizeStatus = (value) => normalizeString(value).toLowerCase();
const isActiveStatus = (value) => ['active', 'trialing'].includes(normalizeStatus(value));

const timestampMillis = (value) => {
  if (!value) return 0;
  if (typeof value === 'number') return value > 10_000_000_000 ? value : value * 1000;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (typeof value.seconds === 'number') return value.seconds * 1000;
  if (value instanceof Date) return value.getTime();
  return 0;
};

const planSnapshot = (rawPlanType) => {
  const planType = normalizeStatus(rawPlanType);
  if (planType.includes('annual') || planType.includes('year') || planType.includes('pc_1y')) {
    return {
      label: 'PulseCheck Annual',
      billingInterval: 'year',
      subscriptionAmountCents: 11900,
      monthlyRevenueCents: Math.round(11900 / 12),
    };
  }
  if (planType.includes('monthly') || planType.includes('month') || planType.includes('pc_1m')) {
    return {
      label: 'PulseCheck Monthly',
      billingInterval: 'month',
      subscriptionAmountCents: 1299,
      monthlyRevenueCents: 1299,
    };
  }
  if (planType.includes('team plan')) {
    return {
      label: 'Team Plan Access',
      billingInterval: null,
      subscriptionAmountCents: 0,
      monthlyRevenueCents: 0,
    };
  }
  if (planType.includes('beta')) {
    return {
      label: 'Beta Access',
      billingInterval: null,
      subscriptionAmountCents: 0,
      monthlyRevenueCents: 0,
    };
  }
  return {
    label: normalizeString(rawPlanType) || 'Paid plan unavailable',
    billingInterval: null,
    subscriptionAmountCents: 0,
    monthlyRevenueCents: 0,
  };
};

const calculateShareCents = (amountCents, sharePct) =>
  Math.round((Number(amountCents) || 0) * ((Number(sharePct) || 0) / 100));

const verifyCoach = async (event) => {
  const authHeader = event.headers?.authorization || event.headers?.Authorization || '';
  const match = normalizeString(authHeader).match(/^Bearer\s+(.+)$/i);
  if (!match) {
    const error = new Error('Sign in is required to view coach earnings.');
    error.statusCode = 401;
    throw error;
  }

  try {
    const decoded = await admin.auth().verifyIdToken(match[1]);
    const userId = normalizeString(decoded?.uid);
    if (!userId) throw new Error('The sign-in token did not include a user id.');
    return userId;
  } catch (error) {
    if (!error.statusCode) error.statusCode = 401;
    throw error;
  }
};

const teamAllowsCoachEarnings = ({ team, membership, userId }) => {
  const config = normalizeCommercialConfig(team?.commercialConfig);
  if (!config.referralKickbackEnabled || config.referralRevenueSharePct <= 0) {
    return null;
  }

  const recipientUserId = normalizeString(config.revenueRecipientUserId);
  const isRecipient = recipientUserId === userId;
  const isLegacyRecipient = !recipientUserId && normalizeString(team?.legacyCoachId) === userId;
  const isDefaultTeamAdmin =
    !recipientUserId
    && config.revenueRecipientRole === 'team-admin'
    && membership?.role === 'team-admin';

  if (!isRecipient && !isLegacyRecipient && !isDefaultTeamAdmin) {
    return null;
  }

  return config;
};

const stripeClients = () => {
  const keys = [
    process.env.STRIPE_SECRET_KEY,
    process.env.STRIPE_TEST_SECRET_KEY,
  ].map(normalizeString).filter((key, index, all) => key && all.indexOf(key) === index);

  return keys.map((key) => new Stripe(key));
};

const runAgainstStripeAccounts = async (operation) => {
  const clients = stripeClients();
  if (clients.length === 0) {
    throw new Error('Stripe invoice history is not configured.');
  }

  let lastError;
  for (const client of clients) {
    try {
      return await operation(client);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error('Stripe invoice history could not be loaded.');
};

const loadStripeSubscription = async (subscriptionId) => {
  if (!subscriptionId) return null;
  return runAgainstStripeAccounts((client) => client.subscriptions.retrieve(subscriptionId));
};

const loadAllPaidInvoices = async (subscriptionId) => {
  if (!subscriptionId) return [];

  return runAgainstStripeAccounts(async (client) => {
    const invoices = [];
    let startingAfter;

    do {
      const page = await client.invoices.list({
        subscription: subscriptionId,
        status: 'paid',
        limit: 100,
        ...(startingAfter ? { starting_after: startingAfter } : {}),
      });
      invoices.push(...(page.data || []));
      startingAfter = page.has_more && page.data?.length
        ? page.data[page.data.length - 1].id
        : undefined;
    } while (startingAfter);

    return invoices;
  });
};

const invoiceRows = ({ invoices, sharePct }) =>
  invoices
    .filter((invoice) => normalizeStatus(invoice.status) === 'paid' && Number(invoice.amount_paid) > 0)
    .map((invoice) => {
      const line = invoice.lines?.data?.find((entry) => Number(entry.amount) > 0) || invoice.lines?.data?.[0] || {};
      const amountPaidCents = Number(invoice.amount_paid) || 0;
      const paidAtSeconds = Number(invoice.status_transitions?.paid_at || invoice.created || 0);

      return {
        id: normalizeString(invoice.id),
        paidAt: paidAtSeconds ? new Date(paidAtSeconds * 1000).toISOString() : null,
        amountPaidCents,
        coachShareCents: calculateShareCents(amountPaidCents, sharePct),
        currency: normalizeStatus(invoice.currency) || 'usd',
        billingReason: normalizeString(invoice.billing_reason) || null,
        billingInterval: normalizeString(line.price?.recurring?.interval) || null,
        planLabel: planSnapshot(line.price?.recurring?.interval || line.description).label,
      };
    })
    .sort((left, right) => String(right.paidAt || '').localeCompare(String(left.paidAt || '')));

const loadMemberEarnings = async ({ athleteMembership, sharePct, teamId }) => {
  const athleteUserId = normalizeString(athleteMembership.userId);
  const [userSnap, subscriptionSnap] = await Promise.all([
    db.collection(USERS_COLLECTION).doc(athleteUserId).get(),
    db.collection(SUBSCRIPTIONS_COLLECTION).doc(athleteUserId).get(),
  ]);
  const user = userSnap.exists ? userSnap.data() || {} : {};
  const subscriptionRecord = subscriptionSnap.exists ? subscriptionSnap.data() || {} : {};
  const plans = Array.isArray(subscriptionRecord.plans)
    ? [...subscriptionRecord.plans].sort(
        (left, right) => timestampMillis(right?.expiration) - timestampMillis(left?.expiration)
      )
    : [];
  const latestPlan = plans[0] || {};
  const rawPlanType =
    latestPlan.type
    || subscriptionRecord.planType
    || subscriptionRecord.subscriptionType
    || user.subscriptionType
    || '';
  const fallbackPlan = planSnapshot(rawPlanType);
  const stripeSubscriptionId = normalizeString(
    subscriptionRecord.stripeSubscriptionId || user.stripeSubscriptionId
  );

  let stripeSubscription = null;
  let paidInvoices = [];
  let invoiceHistoryAvailable = Boolean(stripeSubscriptionId);
  let invoiceHistoryMessage = '';

  if (stripeSubscriptionId) {
    const [subscriptionResult, invoiceResult] = await Promise.allSettled([
      loadStripeSubscription(stripeSubscriptionId),
      loadAllPaidInvoices(stripeSubscriptionId),
    ]);
    if (subscriptionResult.status === 'fulfilled') {
      stripeSubscription = subscriptionResult.value;
    }
    if (invoiceResult.status === 'fulfilled') {
      paidInvoices = invoiceResult.value;
    } else {
      invoiceHistoryAvailable = false;
      invoiceHistoryMessage = 'Paid invoice history is temporarily unavailable.';
    }
  } else {
    invoiceHistoryAvailable = false;
    invoiceHistoryMessage =
      normalizeStatus(subscriptionRecord.platform || user.subscriptionPlatform) === 'ios'
        ? 'Apple payment history is not available in this dashboard yet.'
        : 'Stripe payment history has not been linked to this member.';
  }

  const stripePrice = stripeSubscription?.items?.data?.[0]?.price || {};
  const stripePlan = stripePrice.id || stripePrice.recurring?.interval
    ? planSnapshot(stripePrice.recurring?.interval)
    : null;
  const resolvedPlan = stripePlan || fallbackPlan;
  if (stripePrice.recurring?.interval === 'year') {
    resolvedPlan.label = 'PulseCheck Annual';
    resolvedPlan.billingInterval = 'year';
    resolvedPlan.subscriptionAmountCents = Number(stripePrice.unit_amount) || 11900;
    resolvedPlan.monthlyRevenueCents = Math.round(resolvedPlan.subscriptionAmountCents / 12);
  } else if (stripePrice.recurring?.interval === 'month') {
    resolvedPlan.label = 'PulseCheck Monthly';
    resolvedPlan.billingInterval = 'month';
    resolvedPlan.subscriptionAmountCents = Number(stripePrice.unit_amount) || 1299;
    resolvedPlan.monthlyRevenueCents = resolvedPlan.subscriptionAmountCents;
  }

  const expirationMs = timestampMillis(
    stripeSubscription?.current_period_end
    || latestPlan.expiration
    || subscriptionRecord.currentPeriodEnd
    || subscriptionRecord.expiration
  );
  const fallbackActiveType = /(subscriber|monthly|annual)/i.test(String(rawPlanType));
  const isActive = stripeSubscription
    ? isActiveStatus(stripeSubscription.status)
    : expirationMs
      ? expirationMs > Date.now()
      : fallbackActiveType;
  const payments = invoiceRows({ invoices: paidInvoices, sharePct });

  return {
    userId: athleteUserId,
    teamId,
    name:
      normalizeString(user.displayName)
      || normalizeString(user.username)
      || normalizeString(athleteMembership.email)
      || 'Team member',
    email: normalizeString(user.email || athleteMembership.email) || null,
    plan: resolvedPlan.label,
    isActive,
    billingInterval: resolvedPlan.billingInterval,
    subscriptionAmountCents: isActive ? resolvedPlan.subscriptionAmountCents : 0,
    monthlyRevenueCents: isActive ? resolvedPlan.monthlyRevenueCents : 0,
    estimatedMonthlyShareCents: isActive
      ? calculateShareCents(resolvedPlan.monthlyRevenueCents, sharePct)
      : 0,
    currentPeriodEnd: expirationMs ? new Date(expirationMs).toISOString() : null,
    sharePct,
    invoiceHistoryAvailable,
    invoiceHistoryMessage,
    payments,
    paidInvoiceCount: payments.length,
    lifetimePaidCents: payments.reduce((sum, payment) => sum + payment.amountPaidCents, 0),
    lifetimeShareCents: payments.reduce((sum, payment) => sum + payment.coachShareCents, 0),
  };
};

const loadCoachEarnings = async (coachUserId) => {
  const staffSnapshot = await db
    .collection(TEAM_MEMBERSHIPS_COLLECTION)
    .where('userId', '==', coachUserId)
    .get();
  const staffMemberships = staffSnapshot.docs
    .map((entry) => ({ id: entry.id, ...(entry.data() || {}) }))
    .filter((membership) => membership.role !== 'athlete');

  const eligibleTeams = [];
  for (const membership of staffMemberships) {
    const teamSnap = await db.collection(TEAMS_COLLECTION).doc(membership.teamId).get();
    if (!teamSnap.exists) continue;
    const team = { id: teamSnap.id, ...(teamSnap.data() || {}) };
    const commercialConfig = teamAllowsCoachEarnings({ team, membership, userId: coachUserId });
    if (!commercialConfig) continue;
    eligibleTeams.push({ team, membership, commercialConfig });
  }

  const athleteScopes = new Map();
  for (const { team, commercialConfig } of eligibleTeams) {
    const membersSnapshot = await db
      .collection(TEAM_MEMBERSHIPS_COLLECTION)
      .where('teamId', '==', team.id)
      .get();
    membersSnapshot.docs.forEach((entry) => {
      const membership = { id: entry.id, ...(entry.data() || {}) };
      if (membership.role !== 'athlete' || !normalizeString(membership.userId)) return;
      const existing = athleteScopes.get(membership.userId);
      if (!existing || commercialConfig.referralRevenueSharePct > existing.sharePct) {
        athleteScopes.set(membership.userId, {
          athleteMembership: membership,
          sharePct: commercialConfig.referralRevenueSharePct,
          teamId: team.id,
        });
      }
    });
  }

  const members = await Promise.all(
    [...athleteScopes.values()].map((scope) => loadMemberEarnings(scope))
  );
  members.sort(
    (left, right) =>
      Number(right.isActive) - Number(left.isActive)
      || right.lifetimeShareCents - left.lifetimeShareCents
      || left.name.localeCompare(right.name)
  );

  const shareRates = eligibleTeams.map(
    ({ commercialConfig }) => commercialConfig.referralRevenueSharePct
  );
  const currentMonthKey = new Date().toISOString().slice(0, 7);
  const currentMonthShareCents = members.reduce(
    (sum, member) =>
      sum
      + member.payments
        .filter((payment) => String(payment.paidAt || '').startsWith(currentMonthKey))
        .reduce((paymentSum, payment) => paymentSum + payment.coachShareCents, 0),
    0
  );

  return {
    coachUserId,
    teamIds: eligibleTeams.map(({ team }) => team.id),
    sharePct: shareRates[0] || 0,
    shareRates: [...new Set(shareRates)],
    teamMemberCount: members.length,
    subscribedMemberCount: members.filter((member) => member.isActive).length,
    estimatedMonthlyShareCents: members.reduce(
      (sum, member) => sum + member.estimatedMonthlyShareCents,
      0
    ),
    currentMonthShareCents,
    lifetimeShareCents: members.reduce((sum, member) => sum + member.lifetimeShareCents, 0),
    members,
  };
};

const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: jsonHeaders, body: '' };
  }
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: jsonHeaders,
      body: JSON.stringify({ message: 'Method Not Allowed' }),
    };
  }

  try {
    const coachUserId = await verifyCoach(event);
    const earnings = await loadCoachEarnings(coachUserId);
    return {
      statusCode: 200,
      headers: jsonHeaders,
      body: JSON.stringify({ success: true, earnings }),
    };
  } catch (error) {
    const statusCode = Number(error.statusCode) || 500;
    if (statusCode >= 500) {
      console.error('[PulseCheckCoachEarnings] Failed to load earnings:', error);
    }
    return {
      statusCode,
      headers: jsonHeaders,
      body: JSON.stringify({
        message: error.message || 'Coach earnings could not be loaded.',
      }),
    };
  }
};

module.exports = {
  handler,
  calculateShareCents,
  invoiceRows,
  loadCoachEarnings,
  teamAllowsCoachEarnings,
};
