const Stripe = require('stripe');
const { db, headers } = require('./config/firebase');
const {
  resolveServerStripeMode,
  verifyFirebaseUser,
  verifyOrderIntegrity,
} = require('./lib/pulsecheck-coach-services');
const { normalizeCommercialConfig } = require('./utils/pulsecheck-revenue');
const {
  PAYOUT_REQUESTS_COLLECTION,
  PAYOUT_STATES_COLLECTION,
  buildPayoutSummary,
  calculateRevenueBreakdown,
  payoutStateId,
} = require('./utils/pulsecheck-coach-payouts');
const {
  revenueBreakdown: athleteAppRevenueBreakdown,
} = require('./lib/pulsecheck-athlete-app-offers');

const TEAM_MEMBERSHIPS_COLLECTION = 'pulsecheck-team-memberships';
const TEAMS_COLLECTION = 'pulsecheck-teams';
const ORGANIZATIONS_COLLECTION = 'pulsecheck-organizations';
const USERS_COLLECTION = 'users';
const SUBSCRIPTIONS_COLLECTION = 'subscriptions';
const COACH_SERVICE_ORDERS_COLLECTION = 'pulsecheck-coach-service-orders';
const ASSESSMENT_PURCHASES_COLLECTION = 'pulsecheck-assessment-purchases';
const ATHLETE_APP_OFFERS_COLLECTION = 'pulsecheck-athlete-app-offers';
const ATHLETE_APP_REVENUE_EVENTS_COLLECTION = 'pulsecheck-athlete-app-revenue-events';
// Flat approximation of Stripe's US card rate (2.9% + 30c), used only for the
// "estimated" fallback shown before a webhook-confirmed ledger entry exists —
// the confirmed path (recordPaidAthleteAppInvoice) still looks up the real fee
// via a balance-transaction call; doing that here would mean a live Stripe API
// round trip per invoice on every dashboard load.
const estimatedStripeFeeCents = (amountCents) =>
  Math.max(0, Math.round((Number(amountCents) || 0) * 0.029) + 30);
const configuredAppleCommissionPct = Number(process.env.PULSECHECK_APPLE_COMMISSION_PCT);
const APPLE_COMMISSION_PCT = Number.isFinite(configuredAppleCommissionPct)
  ? Math.min(100, Math.max(0, configuredAppleCommissionPct))
  : 15;

const jsonHeaders = {
  ...headers,
  'Content-Type': 'application/json',
  'Cache-Control': 'private, no-store',
};

const normalizeString = (value) => (typeof value === 'string' ? value.trim() : '');
const normalizeStatus = (value) => normalizeString(value).toLowerCase();
const isActiveStatus = (value) => ['active', 'trialing'].includes(normalizeStatus(value));
const isSafeDocumentId = (value) => (
  Boolean(value)
  && value.length <= 256
  && value !== '.'
  && value !== '..'
  && !value.includes('/')
);
const isActiveMembership = (membership) => {
  const status = normalizeStatus(membership?.status);
  return (!status || status === 'active') && membership?.revokedAt == null;
};
const isActiveContainer = (container) => (
  normalizeStatus(container?.status) === 'active'
  && container?.archivedAt == null
  && container?.deletedAt == null
);

const permissionError = (message, statusCode = 403) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

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
      subscriptionAmountCents: 0,
      monthlyRevenueCents: 0,
    };
  }
  if (planType.includes('monthly') || planType.includes('month') || planType.includes('pc_1m')) {
    return {
      label: 'PulseCheck Monthly',
      billingInterval: 'month',
      subscriptionAmountCents: 0,
      monthlyRevenueCents: 0,
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
const calculatePayoutEligibleCents = ({
  referralShareCents,
  serviceNetCents,
  athleteAppSubscriptionNetCents = 0,
}) => (
  Math.max(0, Number(referralShareCents) || 0)
  + Math.max(0, Number(serviceNetCents) || 0)
  + Math.max(0, Number(athleteAppSubscriptionNetCents) || 0)
);

const verifyCoach = (event) =>
  verifyFirebaseUser(event, {
    authErrorMessage: 'Sign in is required to view coach earnings.',
  });

const teamAllowsCoachEarnings = ({ team, membership, userId, athleteAppOffer = null }) => {
  const config = normalizeCommercialConfig(team?.commercialConfig);
  const hasAthleteReferralEarnings = config.referralKickbackEnabled && config.referralRevenueSharePct > 0;
  const hasParentAssessmentEarnings =
    config.parentAssessmentReferralKickbackEnabled && config.parentAssessmentReferralRevenueSharePct > 0;
  const hasServiceEarnings = config.additionalServicesEnabled || config.referralKickbackEnabled;
  const hasAthleteAppSubscriptionEarnings = Boolean(
    athleteAppOffer
    && normalizeString(athleteAppOffer.teamId) === normalizeString(team?.id)
    && normalizeString(athleteAppOffer.revenueRecipientUserId) === userId
  );

  if (
    !hasAthleteReferralEarnings
    && !hasParentAssessmentEarnings
    && !hasServiceEarnings
    && !hasAthleteAppSubscriptionEarnings
  ) {
    return null;
  }

  const recipientUserId = normalizeString(config.revenueRecipientUserId);
  const isRecipient = recipientUserId === userId;
  const isLegacyRecipient = !recipientUserId && normalizeString(team?.legacyCoachId) === userId;
  const isDefaultTeamAdmin =
    !recipientUserId
    && config.revenueRecipientRole === 'team-admin'
    && membership?.role === 'team-admin';

  const isAthleteAppRecipient = hasAthleteAppSubscriptionEarnings;
  if (!isRecipient && !isLegacyRecipient && !isDefaultTeamAdmin && !isAthleteAppRecipient) {
    return null;
  }

  return config;
};

const stripeClients = () => {
  const stripeMode = resolveServerStripeMode();
  const key = normalizeString(
    stripeMode === 'test'
      ? process.env.STRIPE_TEST_SECRET_KEY
      : process.env.STRIPE_SECRET_KEY
  );
  return key ? [new Stripe(key)] : [];
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

const loadAssessmentCheckoutPayment = async (sessionId) =>
  runAgainstStripeAccounts(async (client) => {
    const session = await client.checkout.sessions.retrieve(sessionId, {
      expand: ['payment_intent.latest_charge'],
    });
    const paymentIntent = typeof session.payment_intent === 'string'
      ? await client.paymentIntents.retrieve(session.payment_intent, {
          expand: ['latest_charge'],
        })
      : session.payment_intent;
    return { session, paymentIntent };
  });

const assessmentStripePaymentTruth = ({
  entryId,
  purchase,
  session,
  paymentIntent,
  teamId,
  organizationId,
  expectedStripeMode,
}) => {
  const metadata = session?.metadata || {};
  const paymentIntentId = normalizeString(paymentIntent?.id);
  const storedPaymentIntentId = normalizeString(purchase?.stripePaymentIntentId);
  const latestCharge = paymentIntent?.latest_charge
    || paymentIntent?.charges?.data?.[0]
    || null;
  const amountCents = Number(session?.amount_total);
  const amountReceivedCents = Number(paymentIntent?.amount_received);
  const chargeAmountCents = Number(latestCharge?.amount);
  const chargeCapturedCents = Number(latestCharge?.amount_captured);
  const storedSessionId = normalizeString(purchase?.stripeSessionId);
  const sessionId = normalizeString(session?.id);
  const expectedLiveMode = expectedStripeMode === 'live';

  if (
    !sessionId
    || sessionId !== entryId
    || storedSessionId !== entryId
    || normalizeStatus(session?.mode) !== 'payment'
    || normalizeStatus(session?.status) !== 'complete'
    || normalizeStatus(session?.payment_status) !== 'paid'
    || normalizeStatus(metadata.payment_type) !== 'pulsecheck_assessment'
    || normalizeStatus(metadata.assessmentId) !== 'parent'
    || normalizeStatus(metadata.referralType) !== 'parent-assessment'
    || normalizeString(metadata.teamId) !== teamId
    || normalizeString(metadata.organizationId) !== organizationId
    || typeof session?.livemode !== 'boolean'
    || session.livemode !== expectedLiveMode
    || typeof paymentIntent?.livemode !== 'boolean'
    || paymentIntent.livemode !== expectedLiveMode
    || !paymentIntentId
    || (storedPaymentIntentId && storedPaymentIntentId !== paymentIntentId)
    || normalizeStatus(paymentIntent?.status) !== 'succeeded'
    || !Number.isSafeInteger(amountCents)
    || amountCents <= 0
    || amountReceivedCents !== amountCents
    || !latestCharge
    || latestCharge.paid !== true
    || latestCharge.refunded === true
    || latestCharge.disputed === true
    || Number(latestCharge.amount_refunded || 0) !== 0
    || (Number.isFinite(chargeAmountCents) && chargeAmountCents !== amountCents)
    || (Number.isFinite(chargeCapturedCents) && chargeCapturedCents !== amountCents)
  ) {
    return null;
  }

  return {
    amountCents,
    currency: normalizeStatus(session.currency || paymentIntent.currency) || 'usd',
    paymentIntentId,
    paidAt: Number(session.created) > 0
      ? new Date(Number(session.created) * 1000).toISOString()
      : null,
  };
};

const revenueCatConfigs = () => {
  const configs = [
    {
      apiKey: process.env.REVENUECAT_API_KEY_PULSECHECK,
      projectId: process.env.REVENUECAT_PROJECT_ID_PULSECHECK || process.env.REVENUECAT_PROJECT_ID,
    },
    {
      apiKey: process.env.REVENUECAT_API_KEY,
      projectId: process.env.REVENUECAT_PROJECT_ID,
    },
  ];

  return configs
    .map((config) => ({
      apiKey: normalizeString(config.apiKey),
      projectId: normalizeString(config.projectId),
    }))
    .filter(
      (config, index, all) =>
        config.apiKey
        && config.projectId
        && all.findIndex(
          (candidate) =>
            candidate.apiKey === config.apiKey && candidate.projectId === config.projectId
        ) === index
    );
};

const fetchRevenueCatJson = async ({ apiKey, url }) => {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: 'application/json',
    },
  });
  if (response.status === 404) return null;
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`RevenueCat request failed (${response.status}): ${body.slice(0, 300)}`);
  }
  return response.json();
};

const loadRevenueCatPages = async ({ apiKey, firstUrl }) => {
  const items = [];
  let nextUrl = firstUrl;
  while (nextUrl) {
    const page = await fetchRevenueCatJson({ apiKey, url: nextUrl });
    if (!page) return null;
    items.push(...(Array.isArray(page.items) ? page.items : []));
    nextUrl = page.next_page
      ? new URL(page.next_page, 'https://api.revenuecat.com').toString()
      : '';
  }
  return items;
};

const revenueCatProfileMatchesAthlete = (profile, athleteUserId) => {
  const subscriber = profile?.subscriber || {};
  const canonicalIds = [
    subscriber.original_app_user_id,
    ...(Array.isArray(subscriber.aliases) ? subscriber.aliases : []),
  ].map(normalizeString).filter(Boolean);
  return canonicalIds.includes(normalizeString(athleteUserId));
};

const loadRevenueCatPaymentHistory = async ({ customerIds, sharePct }) => {
  const configs = revenueCatConfigs();
  if (configs.length === 0) {
    throw new Error('RevenueCat transaction history is not configured.');
  }

  let lastError;
  for (const config of configs) {
    for (const customerId of customerIds.map(normalizeString).filter(Boolean)) {
      try {
        const encodedProjectId = encodeURIComponent(config.projectId);
        const encodedCustomerId = encodeURIComponent(customerId);
        const customerProfile = await fetchRevenueCatJson({
          apiKey: config.apiKey,
          url: `https://api.revenuecat.com/v1/subscribers/${encodedCustomerId}`,
        });
        if (!revenueCatProfileMatchesAthlete(customerProfile, customerId)) {
          continue;
        }
        const subscriptions = await loadRevenueCatPages({
          apiKey: config.apiKey,
          firstUrl:
            `https://api.revenuecat.com/v2/projects/${encodedProjectId}`
            + `/customers/${encodedCustomerId}/subscriptions?environment=production&limit=100`,
        });
        if (!subscriptions?.length) continue;

        const transactionGroups = await Promise.all(
          subscriptions.map(async (subscription) => {
            const subscriptionId = normalizeString(subscription.id);
            if (!subscriptionId) return { subscription, transactions: [] };
            const transactions = await loadRevenueCatPages({
              apiKey: config.apiKey,
              firstUrl:
                `https://api.revenuecat.com/v2/projects/${encodedProjectId}`
                + `/subscriptions/${encodeURIComponent(subscriptionId)}/transactions`,
            });
            return { subscription, transactions: transactions || [] };
          })
        );

        const payments = [];
        for (const { subscription, transactions } of transactionGroups) {
          const productIdentifier =
            normalizeString(subscription.product?.store_identifier)
            || normalizeString(subscription.product_store_identifier)
            || normalizeString(transactions[0]?.product_store_identifier);
          const grossRevenueUsd = Number(subscription.total_revenue_in_usd?.gross);
          const averagePaidCents =
            Number.isFinite(grossRevenueUsd)
            && grossRevenueUsd > 0
            && transactions.length > 0
              ? Math.round((grossRevenueUsd * 100) / transactions.length)
              : 0;

          transactions.forEach((transaction, index) => {
            const transactionProductId =
              normalizeString(transaction.product_store_identifier) || productIdentifier;
            const transactionPlan = planSnapshot(transactionProductId);
            const amountPaidCents =
              averagePaidCents > 0
                ? averagePaidCents
                : 0;
            const revenue = calculateRevenueBreakdown({
              amountCents: amountPaidCents,
              platformFeePct: APPLE_COMMISSION_PCT,
              sharePct,
            });

            const purchasedAtMs = Number(transaction.purchased_at) || 0;
            payments.push({
              id:
                normalizeString(transaction.id)
                || `${normalizeString(subscription.id)}_${purchasedAtMs || index}`,
              paidAt: purchasedAtMs ? new Date(purchasedAtMs).toISOString() : null,
              amountPaidCents,
              grossRevenueCents: revenue.grossRevenueCents,
              platformFeePct: APPLE_COMMISSION_PCT,
              platformFeeCents: revenue.platformFeeCents,
              netRevenueCents: revenue.netRevenueCents,
              coachShareCents: revenue.coachShareCents,
              amountAvailable: amountPaidCents > 0,
              currency: normalizeStatus(subscription.total_revenue_in_usd?.currency) || 'usd',
              billingReason: index === 0 ? 'subscription_create' : 'subscription_cycle',
              billingInterval: transactionPlan.billingInterval,
              planLabel: transactionPlan.label,
              source: 'apple_app_store',
              sourceLabel: 'Apple App Store',
            });
          });
        }

        const activeSubscription =
          subscriptions.find(
            (subscription) =>
              subscription.gives_access === true
              || isActiveStatus(subscription.status)
          )
          || subscriptions
            .slice()
            .sort(
              (left, right) =>
                Number(right.current_period_ends_at || right.ends_at || 0)
                - Number(left.current_period_ends_at || left.ends_at || 0)
            )[0];
        const sortedPayments = payments
          .sort((left, right) => String(right.paidAt || '').localeCompare(String(left.paidAt || '')));
        const latestPayment = sortedPayments[0] || null;
        const activeProductIdentifier =
          normalizeString(activeSubscription?.product?.store_identifier)
          || normalizeString(activeSubscription?.product_store_identifier)
          || normalizeString(latestPayment?.planLabel);
        const activePlan = planSnapshot(activeProductIdentifier);
        const currentAmountCents =
          Number(latestPayment?.amountPaidCents)
          || activePlan.subscriptionAmountCents;

        return {
          activeSubscription,
          plan: {
            ...activePlan,
            subscriptionAmountCents: currentAmountCents,
            monthlyRevenueCents:
              activePlan.billingInterval === 'year'
                ? Math.round(currentAmountCents / 12)
                : currentAmountCents,
          },
          payments: sortedPayments,
        };
      } catch (error) {
        lastError = error;
      }
    }
  }

  throw lastError || new Error('RevenueCat transaction history could not be loaded.');
};

const stripeSubscriptionMatchesAthlete = ({
  subscription,
  subscriptionId,
  athleteUserId,
  expectedStripeMode,
}) => {
  const metadataUserId = normalizeString(
    subscription?.metadata?.userId
    || subscription?.metadata?.pulsecheck_user_id
  );
  return normalizeString(subscription?.id) === subscriptionId
    && typeof subscription?.livemode === 'boolean'
    && subscription.livemode === (expectedStripeMode === 'live')
    && (!metadataUserId || metadataUserId === athleteUserId);
};

const revenueCatCustomerIdsForAthlete = (athleteUserId) => (
  normalizeString(athleteUserId) ? [normalizeString(athleteUserId)] : []
);

const invoiceRows = ({
  invoices,
  sharePct,
  stripeSubscriptionId = '',
  expectedStripeMode = resolveServerStripeMode(),
}) =>
  invoices
    .filter((invoice) => {
      const invoiceSubscriptionId = normalizeString(
        typeof invoice.subscription === 'string'
          ? invoice.subscription
          : invoice.subscription?.id
      );
      return normalizeStatus(invoice.status) === 'paid'
        && Number(invoice.amount_paid) > 0
        && typeof invoice.livemode === 'boolean'
        && invoice.livemode === (expectedStripeMode === 'live')
        && (
          !stripeSubscriptionId
          || invoiceSubscriptionId === stripeSubscriptionId
        );
    })
    .map((invoice) => {
      const line = invoice.lines?.data?.find((entry) => Number(entry.amount) > 0) || invoice.lines?.data?.[0] || {};
      const amountPaidCents = Number(invoice.amount_paid) || 0;
      const paidAtSeconds = Number(invoice.status_transitions?.paid_at || invoice.created || 0);
      const revenue = calculateRevenueBreakdown({
        amountCents: amountPaidCents,
        platformFeePct: 0,
        sharePct,
      });

      return {
        id: normalizeString(invoice.id),
        paidAt: paidAtSeconds ? new Date(paidAtSeconds * 1000).toISOString() : null,
        amountPaidCents,
        grossRevenueCents: revenue.grossRevenueCents,
        platformFeePct: 0,
        platformFeeCents: 0,
        netRevenueCents: revenue.netRevenueCents,
        coachShareCents: revenue.coachShareCents,
        amountAvailable: true,
        currency: normalizeStatus(invoice.currency) || 'usd',
        billingReason: normalizeString(invoice.billing_reason) || null,
        billingInterval: normalizeString(line.price?.recurring?.interval) || null,
        planLabel: planSnapshot(line.price?.recurring?.interval || line.description).label,
        source: 'stripe_web',
        sourceLabel: 'Stripe Web',
      };
    })
    .sort((left, right) => String(right.paidAt || '').localeCompare(String(left.paidAt || '')));

// Coach-priced-app-offer invoices don't earn the coach a referral cut (that's
// what invoiceRows computes) — they earn the coach's 50/50 split of the
// subscription itself, the same split recordPaidAthleteAppInvoice uses to
// write the confirmed pulsecheck-athlete-app-revenue-events ledger. This
// builds an "estimated" version of that same row shape from data already
// fetched for the member (live Stripe subscription + paid invoices), for
// display before the webhook-confirmed ledger entry exists.
const estimatedAppSubscriptionInvoiceRows = ({
  invoices,
  stripeSubscriptionId = '',
  expectedStripeMode = resolveServerStripeMode(),
}) =>
  invoices
    .filter((invoice) => {
      const invoiceSubscriptionId = normalizeString(
        typeof invoice.subscription === 'string'
          ? invoice.subscription
          : invoice.subscription?.id
      );
      return normalizeStatus(invoice.status) === 'paid'
        && Number(invoice.amount_paid) > 0
        && typeof invoice.livemode === 'boolean'
        && invoice.livemode === (expectedStripeMode === 'live')
        && (
          !stripeSubscriptionId
          || invoiceSubscriptionId === stripeSubscriptionId
        );
    })
    .map((invoice) => {
      const amountPaidCents = Number(invoice.amount_paid) || 0;
      const paidAtSeconds = Number(invoice.status_transitions?.paid_at || invoice.created || 0);
      const revenue = athleteAppRevenueBreakdown({
        grossCents: amountPaidCents,
        actualStripeFeeCents: estimatedStripeFeeCents(amountPaidCents),
      });

      return {
        id: normalizeString(invoice.id),
        stripeInvoiceId: normalizeString(invoice.id),
        paidAt: paidAtSeconds ? new Date(paidAtSeconds * 1000).toISOString() : null,
        amountPaidCents,
        grossRevenueCents: revenue.grossRevenueCents,
        platformShareCents: revenue.platformShareCents,
        stripeProcessingFeeCents: revenue.stripeProcessingFeeCents,
        coachNetCents: revenue.coachNetCents,
        currency: normalizeStatus(invoice.currency) || 'usd',
        billingReason: normalizeString(invoice.billing_reason) || null,
        source: 'pulsecheck-coach-athlete-offer',
        sourceLabel: 'Coach-priced PulseCheck subscription',
        estimated: true,
      };
    })
    .sort((left, right) => String(right.paidAt || '').localeCompare(String(left.paidAt || '')));

const loadMemberEarnings = async ({
  athleteMembership,
  sharePct,
  teamId,
  stripeMode = resolveServerStripeMode(),
  database = db,
}) => {
  const athleteUserId = normalizeString(athleteMembership.userId);
  const [userSnap, subscriptionSnap] = await Promise.all([
    database.collection(USERS_COLLECTION).doc(athleteUserId).get(),
    database.collection(SUBSCRIPTIONS_COLLECTION).doc(athleteUserId).get(),
  ]);
  const user = userSnap.exists ? userSnap.data() || {} : {};
  const subscriptionRecord = subscriptionSnap.exists ? subscriptionSnap.data() || {} : {};
  const plans = Array.isArray(subscriptionRecord.plans)
    ? [...subscriptionRecord.plans].sort(
        (left, right) => timestampMillis(right?.expiration) - timestampMillis(left?.expiration)
      )
    : [];
  const latestPlan = plans[0] || {};
  const isCoachPricedAthleteAppPlan =
    normalizeStatus(latestPlan.source) === 'pulsecheck-coach-athlete-offer';
  const rawPlanType =
    latestPlan.type
    || subscriptionRecord.planType
    || subscriptionRecord.subscriptionType
    || '';
  const fallbackPlan = planSnapshot(rawPlanType);
  const stripeSubscriptionId = normalizeString(
    subscriptionRecord.stripeSubscriptionId
  );
  const platform = normalizeStatus(subscriptionRecord.platform);
  const hasRevenueCatIdentity = Boolean(
    normalizeString(subscriptionRecord.rcAppUserId) === athleteUserId
  );
  const isAppleSubscription =
    platform === 'ios'
    || platform === 'apple'
    || (!stripeSubscriptionId && hasRevenueCatIdentity);

  let stripeSubscription = null;
  let paidInvoices = [];
  let revenueCatHistory = null;
  let invoiceHistoryAvailable = Boolean(stripeSubscriptionId || isAppleSubscription);
  let invoiceHistoryMessage = '';

  if (isAppleSubscription) {
    try {
      revenueCatHistory = await loadRevenueCatPaymentHistory({
        customerIds: revenueCatCustomerIdsForAthlete(athleteUserId),
        sharePct,
      });
    } catch (error) {
      invoiceHistoryAvailable = false;
      invoiceHistoryMessage = 'Apple transaction history is temporarily unavailable.';
    }
  } else if (stripeSubscriptionId) {
    const [subscriptionResult, invoiceResult] = await Promise.allSettled([
      loadStripeSubscription(stripeSubscriptionId),
      loadAllPaidInvoices(stripeSubscriptionId),
    ]);
    if (subscriptionResult.status === 'fulfilled') {
      const candidateSubscription = subscriptionResult.value;
      if (stripeSubscriptionMatchesAthlete({
        subscription: candidateSubscription,
        subscriptionId: stripeSubscriptionId,
        athleteUserId,
        expectedStripeMode: stripeMode,
      })) {
        stripeSubscription = candidateSubscription;
      } else {
        invoiceHistoryAvailable = false;
        invoiceHistoryMessage = 'Stripe payment history is not linked to this member.';
      }
    }
    if (invoiceResult.status === 'fulfilled' && stripeSubscription) {
      paidInvoices = invoiceResult.value;
    } else {
      invoiceHistoryAvailable = false;
      invoiceHistoryMessage = 'Paid invoice history is temporarily unavailable.';
    }
  } else {
    invoiceHistoryAvailable = false;
    invoiceHistoryMessage = 'Stripe payment history has not been linked to this member.';
  }

  const stripePrice = stripeSubscription?.items?.data?.[0]?.price || {};
  const stripePlan = stripePrice.id || stripePrice.recurring?.interval
    ? planSnapshot(stripePrice.recurring?.interval)
    : null;
  const resolvedPlan = revenueCatHistory?.plan || stripePlan || fallbackPlan;
  if (stripePrice.recurring?.interval === 'year') {
    resolvedPlan.label = 'PulseCheck Annual';
    resolvedPlan.billingInterval = 'year';
    resolvedPlan.subscriptionAmountCents = Number(stripePrice.unit_amount) || 0;
    resolvedPlan.monthlyRevenueCents = Math.round(resolvedPlan.subscriptionAmountCents / 12);
  } else if (stripePrice.recurring?.interval === 'month') {
    resolvedPlan.label = 'PulseCheck Monthly';
    resolvedPlan.billingInterval = 'month';
    resolvedPlan.subscriptionAmountCents = Number(stripePrice.unit_amount) || 0;
    resolvedPlan.monthlyRevenueCents = resolvedPlan.subscriptionAmountCents;
  }

  const expirationMs = timestampMillis(
    revenueCatHistory?.activeSubscription?.current_period_ends_at
    || revenueCatHistory?.activeSubscription?.ends_at
    || stripeSubscription?.current_period_end
    || latestPlan.expiration
    || subscriptionRecord.currentPeriodEnd
    || subscriptionRecord.expiration
  );
  const fallbackActiveType = /(subscriber|monthly|annual)/i.test(String(rawPlanType));
  const isActive = revenueCatHistory?.activeSubscription
    ? revenueCatHistory.activeSubscription.gives_access === true
      || isActiveStatus(revenueCatHistory.activeSubscription.status)
    : stripeSubscription
      ? isActiveStatus(stripeSubscription.status)
      : expirationMs
        ? expirationMs > Date.now()
        : fallbackActiveType;
  const payments = isCoachPricedAthleteAppPlan
    ? []
    : revenueCatHistory?.payments || invoiceRows({
        invoices: paidInvoices,
        sharePct,
        stripeSubscriptionId,
        expectedStripeMode: stripeMode,
      });
  // Coach-priced-app-offer subscribers earn no referral cut (payments stays
  // empty above, correctly) — but the live Stripe data already fetched for
  // them is real money the coach IS owed under the app-subscription split.
  // Surface it as an estimate rather than discarding it.
  const estimatedAppSubscriptionPayments =
    isCoachPricedAthleteAppPlan && !isAppleSubscription && stripeSubscriptionId
      ? estimatedAppSubscriptionInvoiceRows({
          invoices: paidInvoices,
          stripeSubscriptionId,
          expectedStripeMode: stripeMode,
        })
      : [];
  const subscriptionSource = isAppleSubscription
    ? 'apple_app_store'
    : stripeSubscriptionId
      ? 'stripe_web'
      : 'unknown';
  const subscriptionSourceLabel = subscriptionSource === 'apple_app_store'
    ? 'Apple App Store'
    : subscriptionSource === 'stripe_web'
      ? 'Stripe Web'
      : 'Payment source unavailable';
  const monthlyRevenue = calculateRevenueBreakdown({
    amountCents: resolvedPlan.monthlyRevenueCents,
    platformFeePct: isAppleSubscription ? APPLE_COMMISSION_PCT : 0,
    sharePct: isCoachPricedAthleteAppPlan ? 0 : sharePct,
  });

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
    subscriptionSource,
    subscriptionSourceLabel,
    platformFeePct: isAppleSubscription ? APPLE_COMMISSION_PCT : 0,
    estimatedMonthlyPlatformFeeCents: isActive ? monthlyRevenue.platformFeeCents : 0,
    estimatedMonthlyNetRevenueCents: isActive ? monthlyRevenue.netRevenueCents : 0,
    estimatedMonthlyShareCents: isActive
      ? monthlyRevenue.coachShareCents
      : 0,
    currentPeriodEnd: expirationMs ? new Date(expirationMs).toISOString() : null,
    sharePct: isCoachPricedAthleteAppPlan ? 0 : sharePct,
    invoiceHistoryAvailable,
    invoiceHistoryMessage,
    payments,
    paidInvoiceCount: payments.length,
    lifetimePaidCents: payments.reduce((sum, payment) => sum + payment.amountPaidCents, 0),
    lifetimeShareCents: payments.reduce((sum, payment) => sum + payment.coachShareCents, 0),
    isCoachPricedAthleteAppPlan,
    estimatedAppSubscriptionPayments,
    estimatedAppSubscriptionLifetimeNetCents: estimatedAppSubscriptionPayments.reduce(
      (sum, payment) => sum + payment.coachNetCents,
      0
    ),
  };
};

const isoTimestamp = (value) => {
  const millis = timestampMillis(value);
  return millis ? new Date(millis).toISOString() : null;
};

const loadCoachServiceEarnings = async ({
  coachUserId,
  teamId,
  organizationId,
  commercialConfig,
  stripeMode = resolveServerStripeMode(),
  database = db,
}) => {
  const [snapshot, assessmentSnapshot] = await Promise.all([
    database
      .collection(COACH_SERVICE_ORDERS_COLLECTION)
      .where('coachUserId', '==', coachUserId)
      .get(),
    database
      .collection(ASSESSMENT_PURCHASES_COLLECTION)
      .where('revenueRecipientUserId', '==', coachUserId)
      .get(),
  ]);

  const serviceTransactions = snapshot.docs
    .map((entry) => {
      const order = entry.data() || {};
      const status = normalizeStatus(order.status);
      const isEarned = status === 'paid' || status === 'booked' || status === 'active';
      if (
        !isEarned
        || order.paymentAuthorized !== true
        || !verifyOrderIntegrity(order)
        || normalizeString(order.orderId) !== entry.id
        || normalizeString(order.coachUserId) !== coachUserId
        || normalizeString(order.organizationId) !== organizationId
        || normalizeString(order.teamId) !== teamId
      ) return null;
      const amountCents = Math.max(0, Number(order.amountCents) || 0);
      const platformFeeCents = Math.max(0, Number(order.platformFeeCents) || 0);
      const coachNetCents = Math.max(
        0,
        Number.isFinite(Number(order.coachNetCents))
          ? Number(order.coachNetCents)
          : amountCents - platformFeeCents
      );
      return {
        id: entry.id,
        orderId: entry.id,
        paymentIntentId: normalizeString(order.paymentIntentId) || null,
        conversationId: normalizeString(order.conversationId) || null,
        athleteUserId: normalizeString(order.athleteUserId) || null,
        athleteName: normalizeString(order.athleteName) || 'Athlete',
        serviceId: normalizeString(order.serviceId),
        serviceTitle: normalizeString(order.serviceTitle) || 'Coach service',
        teamId,
        organizationId,
        status,
        amountCents,
        platformFeeCents,
        coachNetCents,
        currency: normalizeStatus(order.currency) || 'usd',
        paidAt: isoTimestamp(order.paidAt || order.subscriptionActivatedAt || order.paymentVerifiedAt),
        scheduledAt: isoTimestamp(order.scheduledAt),
        bookedAt: isoTimestamp(order.bookedAt),
      };
    })
    .filter(Boolean);

  const assessmentTransactions = (await Promise.all(
    assessmentSnapshot.docs.map(async (entry) => {
      const purchase = entry.data() || {};
      const status = normalizeStatus(purchase.status);
      if (
        (status !== 'paid' && status !== 'completed')
        || normalizeString(purchase.revenueRecipientUserId) !== coachUserId
        || normalizeString(purchase.teamId) !== teamId
        || normalizeString(purchase.organizationId) !== organizationId
        || commercialConfig?.parentAssessmentReferralKickbackEnabled !== true
      ) return null;
      let stripeTruth;
      try {
        const stripePayment = await loadAssessmentCheckoutPayment(entry.id);
        stripeTruth = assessmentStripePaymentTruth({
          entryId: entry.id,
          purchase,
          ...stripePayment,
          teamId,
          organizationId,
          expectedStripeMode: stripeMode,
        });
      } catch (error) {
        console.warn(
          '[PulseCheckCoachEarnings] Excluding an assessment purchase that Stripe could not verify:',
          entry.id
        );
        return null;
      }
      if (!stripeTruth) return null;
      const amountCents = stripeTruth.amountCents;
      const coachNetCents = Math.round(
        amountCents
        * (
          Math.max(
            0,
            Math.min(
              100,
              Number(commercialConfig.parentAssessmentReferralRevenueSharePct) || 0
            )
          ) / 100
        )
      );
      return {
        id: entry.id,
        orderId: entry.id,
        paymentIntentId: stripeTruth.paymentIntentId,
        conversationId: null,
        athleteUserId: null,
        athleteName: 'Parent assessment buyer',
        serviceId: normalizeString(purchase.assessmentId) || 'parent',
        serviceTitle: normalizeString(purchase.assessmentProductName) || 'Parent Readiness Assessment',
        teamId,
        organizationId,
        status,
        amountCents,
        platformFeeCents: Math.max(0, amountCents - coachNetCents),
        coachNetCents,
        currency: stripeTruth.currency,
        paidAt: stripeTruth.paidAt,
        scheduledAt: null,
        bookedAt: null,
      };
    })
  )).filter(Boolean);

  const transactions = [...serviceTransactions, ...assessmentTransactions]
    .sort((left, right) =>
      String(right.paidAt || right.bookedAt || '').localeCompare(
        String(left.paidAt || left.bookedAt || '')
      )
    );

  const currentMonthKey = new Date().toISOString().slice(0, 7);
  const currentMonthTransactions = transactions.filter((transaction) =>
    String(transaction.paidAt || '').startsWith(currentMonthKey)
  );

  return {
    transactionCount: transactions.length,
    currentMonthGrossCents: currentMonthTransactions.reduce(
      (sum, transaction) => sum + transaction.amountCents,
      0
    ),
    currentMonthNetCents: currentMonthTransactions.reduce(
      (sum, transaction) => sum + transaction.coachNetCents,
      0
    ),
    lifetimeGrossCents: transactions.reduce(
      (sum, transaction) => sum + transaction.amountCents,
      0
    ),
    lifetimePlatformFeeCents: transactions.reduce(
      (sum, transaction) => sum + transaction.platformFeeCents,
      0
    ),
    lifetimeNetCents: transactions.reduce(
      (sum, transaction) => sum + transaction.coachNetCents,
      0
    ),
    transactions,
  };
};

const loadAthleteAppSubscriptionEarnings = async ({
  coachUserId,
  teamId,
  organizationId,
  database = db,
}) => {
  const snapshot = await database
    .collection(ATHLETE_APP_REVENUE_EVENTS_COLLECTION)
    .where('revenueRecipientUserId', '==', coachUserId)
    .get();
  const transactions = snapshot.docs
    .map((entry) => {
      const event = entry.data() || {};
      if (
        normalizeString(event.revenueRecipientUserId) !== coachUserId
        || normalizeString(event.teamId) !== teamId
        || normalizeString(event.organizationId) !== organizationId
        || normalizeStatus(event.provider) !== 'stripe'
        || normalizeStatus(event.source) !== 'pulsecheck-coach-athlete-offer'
        || normalizeStatus(event.type) !== 'athlete_app_subscription_invoice'
      ) return null;
      const status = normalizeStatus(event.status);
      if (!['paid', 'partially_refunded', 'refunded', 'disputed', 'dispute_lost'].includes(status)) return null;
      const paidAt = isoTimestamp(event.paidAtEpochSeconds || event.paidAt);
      return {
        id: entry.id,
        invoiceId: normalizeString(event.stripeInvoiceId) || entry.id,
        subscriptionId: normalizeString(event.stripeSubscriptionId) || null,
        athleteUserId: normalizeString(event.userId) || null,
        teamId,
        organizationId,
        offerId: normalizeString(event.offerId) || teamId,
        status,
        paidAt,
        amountPaidCents: Math.max(0, Number(event.amountPaidCents) || 0),
        grossRevenueCents: Math.max(
          0,
          Number(event.remainingGrossRevenueCents ?? event.grossRevenueCents) || 0
        ),
        refundedCents: Math.max(0, Number(event.refundedCents) || 0),
        platformShareCents: Math.max(
          0,
          Number(event.platformShareCentsAfterRefund ?? event.platformShareCents) || 0
        ),
        stripeProcessingFeeCents: Math.max(0, Number(event.stripeProcessingFeeCents) || 0),
        coachNetCents: Math.max(0, Number(event.coachNetCents) || 0),
        platformNetCents: Math.max(0, Number(event.platformNetCents) || 0),
        currency: normalizeStatus(event.currency) || 'usd',
        billingReason: normalizeString(event.billingReason) || null,
        source: 'pulsecheck-coach-athlete-offer',
        sourceLabel: 'Coach-priced PulseCheck subscription',
      };
    })
    .filter(Boolean)
    .sort((left, right) => String(right.paidAt || '').localeCompare(String(left.paidAt || '')));
  const currentMonthKey = new Date().toISOString().slice(0, 7);
  const currentMonthTransactions = transactions.filter((transaction) =>
    String(transaction.paidAt || '').startsWith(currentMonthKey)
  );
  const subscriberIds = new Set(
    transactions.map((transaction) => transaction.athleteUserId).filter(Boolean)
  );
  return {
    transactionCount: transactions.length,
    subscriberCount: subscriberIds.size,
    currentMonthGrossCents: currentMonthTransactions.reduce(
      (sum, transaction) => sum + transaction.grossRevenueCents,
      0
    ),
    currentMonthNetCents: currentMonthTransactions.reduce(
      (sum, transaction) => sum + transaction.coachNetCents,
      0
    ),
    lifetimeGrossCents: transactions.reduce(
      (sum, transaction) => sum + transaction.grossRevenueCents,
      0
    ),
    lifetimePlatformShareCents: transactions.reduce(
      (sum, transaction) => sum + transaction.platformShareCents,
      0
    ),
    lifetimeStripeProcessingFeeCents: transactions.reduce(
      (sum, transaction) => sum + transaction.stripeProcessingFeeCents,
      0
    ),
    lifetimeNetCents: transactions.reduce(
      (sum, transaction) => sum + transaction.coachNetCents,
      0
    ),
    estimatedMonthlyNetCents: transactions[0]?.coachNetCents || 0,
    transactions,
  };
};

// Folds each coach-priced-app member's live-Stripe-derived estimate into the
// confirmed ledger response, so the "Coach-priced app subscriptions" section
// and the member list it's built next to never disagree. `lifetimeNetCents`/
// `currentMonthNetCents` are left untouched (confirmed-ledger-only) — that's
// what payoutEligibleCents is computed from, and a coach should never be able
// to request a payout against money Stripe hasn't confirmed settled yet. The
// new `display*` fields are what the section's stat tiles should render.
const mergeEstimatedAppSubscriptionEarnings = ({ athleteAppSubscriptionEarnings, members }) => {
  const confirmedInvoiceIds = new Set(
    athleteAppSubscriptionEarnings.transactions.map((transaction) => transaction.invoiceId).filter(Boolean)
  );
  const confirmedSubscriberIds = new Set(
    athleteAppSubscriptionEarnings.transactions.map((transaction) => transaction.athleteUserId).filter(Boolean)
  );

  const estimatedTransactions = [];
  for (const member of members) {
    if (!member.isCoachPricedAthleteAppPlan) continue;
    for (const payment of member.estimatedAppSubscriptionPayments) {
      if (confirmedInvoiceIds.has(payment.stripeInvoiceId)) continue;
      estimatedTransactions.push({
        id: payment.id,
        invoiceId: payment.stripeInvoiceId,
        subscriptionId: null,
        athleteUserId: member.userId,
        teamId: member.teamId,
        offerId: member.teamId,
        status: 'paid',
        paidAt: payment.paidAt,
        amountPaidCents: payment.amountPaidCents,
        grossRevenueCents: payment.grossRevenueCents,
        refundedCents: 0,
        platformShareCents: payment.platformShareCents,
        stripeProcessingFeeCents: payment.stripeProcessingFeeCents,
        coachNetCents: payment.coachNetCents,
        platformNetCents: 0,
        currency: payment.currency,
        billingReason: payment.billingReason,
        source: 'pulsecheck-coach-athlete-offer',
        sourceLabel: payment.sourceLabel,
        estimated: true,
      });
    }
  }

  const currentMonthKey = new Date().toISOString().slice(0, 7);
  const currentMonthEstimated = estimatedTransactions.filter((transaction) =>
    String(transaction.paidAt || '').startsWith(currentMonthKey)
  );
  const estimatedSubscriberIds = new Set(
    estimatedTransactions.map((transaction) => transaction.athleteUserId).filter(Boolean)
  );
  // Any active coach-priced member counts as a subscriber even if this month
  // happened not to produce an invoice we could estimate from (e.g. mid-cycle).
  members.forEach((member) => {
    if (member.isCoachPricedAthleteAppPlan && member.isActive) {
      estimatedSubscriberIds.add(member.userId);
    }
  });
  const estimatedLifetimeNetCents = estimatedTransactions.reduce(
    (sum, transaction) => sum + transaction.coachNetCents,
    0
  );
  const estimatedCurrentMonthNetCents = currentMonthEstimated.reduce(
    (sum, transaction) => sum + transaction.coachNetCents,
    0
  );

  return {
    ...athleteAppSubscriptionEarnings,
    confirmedSubscriberCount: confirmedSubscriberIds.size,
    estimatedSubscriberCount: estimatedSubscriberIds.size,
    subscriberCount: new Set([...confirmedSubscriberIds, ...estimatedSubscriberIds]).size,
    hasUnconfirmedEstimates: estimatedTransactions.length > 0,
    estimatedLifetimeNetCents,
    estimatedCurrentMonthNetCents,
    displayLifetimeNetCents: athleteAppSubscriptionEarnings.lifetimeNetCents + estimatedLifetimeNetCents,
    displayCurrentMonthNetCents: athleteAppSubscriptionEarnings.currentMonthNetCents + estimatedCurrentMonthNetCents,
    transactionCount: athleteAppSubscriptionEarnings.transactionCount + estimatedTransactions.length,
    transactions: [...athleteAppSubscriptionEarnings.transactions, ...estimatedTransactions].sort(
      (left, right) => String(right.paidAt || '').localeCompare(String(left.paidAt || ''))
    ),
  };
};

const loadCoachPayoutSummary = async ({
  coachUserId,
  teamId,
  earnedCents,
  database = db,
}) => {
  const stateDocumentId = payoutStateId(coachUserId, teamId);
  const [stateSnapshot, legacyStateSnapshot] = await Promise.all([
    database.collection(PAYOUT_STATES_COLLECTION).doc(stateDocumentId).get(),
    database.collection(PAYOUT_STATES_COLLECTION).doc(coachUserId).get(),
  ]);
  let state = stateSnapshot.exists ? stateSnapshot.data() || {} : {};
  if (!stateSnapshot.exists && legacyStateSnapshot.exists) {
    const legacyState = legacyStateSnapshot.data() || {};
    const legacyTeamId = normalizeString(legacyState.teamId);
    const legacyTeamIds = Array.isArray(legacyState.teamIds)
      ? legacyState.teamIds.map(normalizeString).filter(Boolean)
      : [];
    const legacyMatchesTeam = legacyTeamId === teamId
      || (legacyTeamIds.length === 1 && legacyTeamIds[0] === teamId);
    if (legacyMatchesTeam) state = legacyState;
  }
  const activeRequestId = normalizeString(state.activeRequestId);
  let activeRequest = null;

  if (activeRequestId) {
    const requestSnapshot = await database
      .collection(PAYOUT_REQUESTS_COLLECTION)
      .doc(activeRequestId)
      .get();
    if (requestSnapshot.exists) {
      activeRequest = {
        id: requestSnapshot.id,
        ...(requestSnapshot.data() || {}),
      };
    }
  }

  return buildPayoutSummary({
    earnedCents,
    state,
    activeRequest,
  });
};

const loadCoachEarnings = async (coachUserId, teamId, database = db) => {
  const normalizedCoachUserId = normalizeString(coachUserId);
  const normalizedTeamId = normalizeString(teamId);
  if (!normalizedCoachUserId || !isSafeDocumentId(normalizedTeamId)) {
    throw permissionError('A valid team is required to view coach earnings.', 400);
  }

  const membershipId = `${normalizedTeamId}_${normalizedCoachUserId}`;
  const [membershipSnapshot, teamSnapshot, athleteAppOfferSnapshot] = await Promise.all([
    database.collection(TEAM_MEMBERSHIPS_COLLECTION).doc(membershipId).get(),
    database.collection(TEAMS_COLLECTION).doc(normalizedTeamId).get(),
    database.collection(ATHLETE_APP_OFFERS_COLLECTION).doc(normalizedTeamId).get(),
  ]);
  if (!membershipSnapshot.exists || !teamSnapshot.exists) {
    throw permissionError('You do not have earnings access for this team.');
  }
  const membership = {
    id: membershipSnapshot.id,
    ...(membershipSnapshot.data() || {}),
  };
  const team = { id: teamSnapshot.id, ...(teamSnapshot.data() || {}) };
  const athleteAppOffer = athleteAppOfferSnapshot.exists
    ? { id: athleteAppOfferSnapshot.id, ...(athleteAppOfferSnapshot.data() || {}) }
    : null;
  const organizationId = normalizeString(team.organizationId);
  if (!organizationId) {
    throw permissionError('You do not have earnings access for this team.');
  }
  const organizationSnapshot = await database
    .collection(ORGANIZATIONS_COLLECTION)
    .doc(organizationId)
    .get();
  const organization = organizationSnapshot.exists
    ? organizationSnapshot.data() || {}
    : {};
  if (
    membership.id !== membershipId
    || normalizeString(membership.userId) !== normalizedCoachUserId
    || normalizeString(membership.teamId) !== normalizedTeamId
    || normalizeString(membership.organizationId) !== organizationId
    || normalizeStatus(membership.role) === 'athlete'
    || !isActiveMembership(membership)
    || team.id !== normalizedTeamId
    || !isActiveContainer(team)
    || !organizationSnapshot.exists
    || !isActiveContainer(organization)
  ) {
    throw permissionError('You do not have earnings access for this team.');
  }
  const commercialConfig = teamAllowsCoachEarnings({
    team,
    membership,
    userId: normalizedCoachUserId,
    athleteAppOffer,
  });
  if (!commercialConfig) {
    throw permissionError('You do not have earnings access for this team.');
  }
  const eligibleTeams = [{ team, membership, commercialConfig }];

  const athleteScopes = new Map();
  for (const { team, commercialConfig } of eligibleTeams) {
    const hasReferralProgram =
      commercialConfig.referralKickbackEnabled && commercialConfig.referralRevenueSharePct > 0;
    // Even without a referral program, a team can still have coach-priced app
    // subscribers whose earnings loadMemberEarnings needs to compute — skip
    // this loop only when NEITHER program is active for the team. sharePct
    // stays whatever the referral config says (0 when referral is off); that's
    // correct either way since isCoachPricedAthleteAppPlan forces it to 0 per
    // member regardless, and a team without a referral program shouldn't pay
    // referral shares to anyone.
    if (!hasReferralProgram && !commercialConfig.athleteAppSubscriptionEnabled) {
      continue;
    }
    const membersSnapshot = await database
      .collection(TEAM_MEMBERSHIPS_COLLECTION)
      .where('teamId', '==', team.id)
      .get();
    membersSnapshot.docs.forEach((entry) => {
      const membership = { id: entry.id, ...(entry.data() || {}) };
      const athleteUserId = normalizeString(membership.userId);
      if (
        membership.id !== `${team.id}_${athleteUserId}`
        || membership.role !== 'athlete'
        || !athleteUserId
        || normalizeString(membership.teamId) !== team.id
        || normalizeString(membership.organizationId) !== organizationId
        || !isActiveMembership(membership)
      ) return;
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

  const [members, serviceEarnings, confirmedAthleteAppSubscriptionEarnings] = await Promise.all([
    Promise.all(
      [...athleteScopes.values()].map((scope) =>
        loadMemberEarnings({ ...scope, database })
      )
    ),
    loadCoachServiceEarnings({
      coachUserId: normalizedCoachUserId,
      teamId: normalizedTeamId,
      organizationId,
      commercialConfig: eligibleTeams[0].commercialConfig,
      stripeMode: resolveServerStripeMode(),
      database,
    }),
    loadAthleteAppSubscriptionEarnings({
      coachUserId: normalizedCoachUserId,
      teamId: normalizedTeamId,
      organizationId,
      database,
    }),
  ]);
  const athleteAppSubscriptionEarnings = mergeEstimatedAppSubscriptionEarnings({
    athleteAppSubscriptionEarnings: confirmedAthleteAppSubscriptionEarnings,
    members,
  });
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
  const referralCurrentMonthShareCents = members.reduce(
    (sum, member) =>
      sum
      + member.payments
        .filter((payment) => String(payment.paidAt || '').startsWith(currentMonthKey))
        .reduce((paymentSum, payment) => paymentSum + payment.coachShareCents, 0),
    0
  );
  const referralLifetimeShareCents = members.reduce(
    (sum, member) => sum + member.lifetimeShareCents,
    0
  );
  const currentMonthShareCents = referralCurrentMonthShareCents
    + athleteAppSubscriptionEarnings.currentMonthNetCents;
  const lifetimeShareCents = referralLifetimeShareCents
    + athleteAppSubscriptionEarnings.lifetimeNetCents;
  const payoutEligibleCents = calculatePayoutEligibleCents({
    referralShareCents: referralLifetimeShareCents,
    serviceNetCents: serviceEarnings.lifetimeNetCents,
    athleteAppSubscriptionNetCents: athleteAppSubscriptionEarnings.lifetimeNetCents,
  });
  const payout = await loadCoachPayoutSummary({
    coachUserId: normalizedCoachUserId,
    teamId: normalizedTeamId,
    organizationId,
    earnedCents: payoutEligibleCents,
    database,
  });

  return {
    coachUserId: normalizedCoachUserId,
    teamId: normalizedTeamId,
    organizationId,
    teamIds: [normalizedTeamId],
    sharePct: shareRates[0] || 0,
    shareRates: [...new Set(shareRates)],
    teamMemberCount: members.length,
    subscribedMemberCount: members.filter((member) => member.isActive).length,
    estimatedMonthlyShareCents: members.reduce(
      (sum, member) => sum + member.estimatedMonthlyShareCents,
      0
    ) + athleteAppSubscriptionEarnings.estimatedMonthlyNetCents,
    currentMonthShareCents,
    lifetimeShareCents,
    payoutEligibleCents,
    payout,
    members,
    serviceEarnings,
    athleteAppSubscriptionEarnings,
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
    const teamId = normalizeString(event.queryStringParameters?.teamId);
    if (!isSafeDocumentId(teamId)) {
      return {
        statusCode: 400,
        headers: jsonHeaders,
        body: JSON.stringify({ message: 'A valid team is required to view coach earnings.' }),
      };
    }
    const { userId: coachUserId, app } = await verifyCoach(event);
    const earnings = await loadCoachEarnings(
      coachUserId,
      teamId,
      app.firestore()
    );
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
  calculatePayoutEligibleCents,
  calculateShareCents,
  assessmentStripePaymentTruth,
  invoiceRows,
  loadAthleteAppSubscriptionEarnings,
  loadCoachServiceEarnings,
  loadCoachEarnings,
  loadCoachPayoutSummary,
  isActiveContainer,
  isActiveMembership,
  isSafeDocumentId,
  revenueCatCustomerIdsForAthlete,
  revenueCatProfileMatchesAthlete,
  stripeSubscriptionMatchesAthlete,
  teamAllowsCoachEarnings,
  verifyCoach,
};
