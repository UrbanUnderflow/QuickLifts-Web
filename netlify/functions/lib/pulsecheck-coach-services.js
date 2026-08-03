const crypto = require('node:crypto');
const { admin, db, getFirebaseAdminApp } = require('../config/firebase');

const ORDERS_COLLECTION = 'pulsecheck-coach-service-orders';
const CONVERSATIONS_COLLECTION = 'coach-athlete-conversations';
const SERVICES_COLLECTION = 'pulsecheck-coach-services';
const TEAM_MEMBERSHIPS_COLLECTION = 'pulsecheck-team-memberships';
const TEAMS_COLLECTION = 'pulsecheck-teams';
const ORGANIZATIONS_COLLECTION = 'pulsecheck-organizations';
const ORDER_INTEGRITY_VERSION = 1;
const PLATFORM_FEE_PERCENT = 3;
const STRIPE_PROCESSING_PERCENT = 2.9;
const STRIPE_PROCESSING_FIXED_CENTS = 30;

const SERVICE_CATALOG = Object.freeze({
  'one-on-one-video': Object.freeze({
    id: 'one-on-one-video',
    title: 'One-on-one video',
    amountCents: 5000,
    currency: 'usd',
  }),
  'video-posing-session': Object.freeze({
    id: 'video-posing-session',
    title: 'Video posing session',
    amountCents: 5000,
    currency: 'usd',
  }),
});

const normalizeString = (value) => (typeof value === 'string' ? value.trim() : '');
const normalizeStatus = (value) => normalizeString(value).toLowerCase();
const normalizedParticipantIds = (value) => (
  Array.isArray(value)
    ? [...new Set(value.map(normalizeString).filter(Boolean))].sort()
    : []
);

const inactiveMembershipStatuses = new Set([
  'inactive',
  'removed',
  'revoked',
  'declined',
  'expired',
  'pending',
  'invited',
  'suspended',
  'disabled',
]);

const isActiveMembership = (membership) => (
  !membership?.revokedAt
  && !inactiveMembershipStatuses.has(normalizeStatus(membership?.status))
);

const isActiveHierarchyDocument = (document) => (
  normalizeStatus(document?.status) === 'active'
  && !document?.archivedAt
  && !document?.revokedAt
);

const legacyCapabilitiesForRole = (role) => {
  switch (normalizeStatus(role)) {
    case 'team-admin':
      return new Set(['admin']);
    case 'coach':
      return new Set(['coaching']);
    case 'performance-staff':
    case 'clinician':
      return new Set(['athletic_trainer']);
    case 'support-staff':
      return new Set(['administrative']);
    default:
      return new Set();
  }
};

const resolveStaffCapabilities = (membership) => {
  const role = normalizeStatus(membership?.role);
  const rawCapabilities = membership?.staffCapabilities;
  if (rawCapabilities == null || (
    Array.isArray(rawCapabilities) && rawCapabilities.length === 0
  )) {
    return legacyCapabilitiesForRole(role);
  }
  if (!Array.isArray(rawCapabilities)) {
    return role === 'team-admin' ? new Set(['admin']) : new Set();
  }

  const validCapabilities = new Set([
    'admin',
    'administrative',
    'coaching',
    'athletic_trainer',
  ]);
  const capabilities = new Set();
  for (const value of rawCapabilities) {
    const capability = normalizeString(value);
    if (!validCapabilities.has(capability)) {
      return role === 'team-admin' ? new Set(['admin']) : new Set();
    }
    capabilities.add(capability);
  }
  if (role === 'team-admin') capabilities.add('admin');
  return capabilities;
};

const canSellCoachServices = (membership) => {
  const capabilities = resolveStaffCapabilities(membership);
  return capabilities.has('admin') || capabilities.has('coaching');
};

const serviceOrdersEnabled = (team) => (
  team?.commercialConfig?.additionalServicesEnabled === true
  || team?.commercialConfig?.referralKickbackEnabled === true
);

const permissionError = (message, statusCode = 403) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const resolveServerStripeMode = (environment = process.env) => {
  const configuredMode = normalizeStatus(environment.PULSECHECK_STRIPE_MODE);
  if (configuredMode === 'test' || configuredMode === 'live') {
    return configuredMode;
  }
  const deploymentContext = normalizeStatus(
    environment.CONTEXT || environment.NETLIFY_CONTEXT
  );
  const localDevelopment = normalizeStatus(environment.NETLIFY_DEV) === 'true';
  return localDevelopment || deploymentContext === 'dev'
    ? 'test'
    : 'live';
};

const orderSigningSecret = () => {
  const secret = normalizeString(
    process.env.PULSECHECK_SERVICE_ORDER_SIGNING_SECRET
    || process.env.STRIPE_SECRET_KEY
  );
  if (!secret) {
    const error = new Error('Coach service order signing is not configured.');
    error.statusCode = 503;
    throw error;
  }
  return secret;
};

const orderIntegrityPayload = (order) => JSON.stringify({
  version: ORDER_INTEGRITY_VERSION,
  orderId: normalizeString(order?.orderId),
  conversationId: normalizeString(order?.conversationId),
  organizationId: normalizeString(order?.organizationId),
  teamId: normalizeString(order?.teamId),
  participantIds: normalizedParticipantIds(order?.participantIds),
  athleteUserId: normalizeString(order?.athleteUserId),
  coachUserId: normalizeString(order?.coachUserId),
  connectedAccountId: normalizeString(order?.connectedAccountId),
  settlementMode: normalizeString(order?.settlementMode),
  serviceId: normalizeString(order?.serviceId),
  serviceTitle: normalizeString(order?.serviceTitle),
  serviceType: normalizeServiceType(order?.serviceType),
  amountCents: Number(order?.amountCents) || 0,
  coachPriceCents: Number(order?.coachPriceCents) || 0,
  processingFeeCents: Number(order?.processingFeeCents) || 0,
  platformFeeCents: Number(order?.platformFeeCents) || 0,
  estimatedStripeFeeCents: Number(order?.estimatedStripeFeeCents) || 0,
  coachNetCents: Number(order?.coachNetCents) || 0,
  currency: normalizeStatus(order?.currency),
  stripeMode: normalizeStatus(order?.stripeMode),
  paymentIntentId: normalizeString(order?.paymentIntentId),
  stripeSessionId: normalizeString(order?.stripeSessionId),
  stripeSubscriptionId: normalizeString(order?.stripeSubscriptionId),
  stripeCustomerId: normalizeString(order?.stripeCustomerId),
  paymentAuthorized: order?.paymentAuthorized === true,
  bookingScheduleISO: normalizeString(order?.bookingScheduleISO),
  bookingRecordedAtISO: normalizeString(order?.bookingRecordedAtISO),
});

const createOrderIntegritySeal = (order) => crypto
  .createHmac('sha256', orderSigningSecret())
  .update(orderIntegrityPayload(order))
  .digest('base64url');

const verifyOrderIntegrity = (order) => {
  if (
    Number(order?.serverOrderVersion) !== ORDER_INTEGRITY_VERSION
    || !normalizeString(order?.orderIntegritySeal)
  ) {
    return false;
  }
  try {
    const expected = Buffer.from(createOrderIntegritySeal(order));
    const actual = Buffer.from(normalizeString(order.orderIntegritySeal));
    return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
  } catch (_error) {
    return false;
  }
};

const sealOrder = (order) => ({
  ...order,
  serverOrderVersion: ORDER_INTEGRITY_VERSION,
  orderIntegritySeal: createOrderIntegritySeal(order),
});

const platformFeeCents = (amountCents) =>
  Math.round((Number(amountCents) || 0) * (PLATFORM_FEE_PERCENT / 100));

const getService = (serviceId) => SERVICE_CATALOG[normalizeString(serviceId)] || null;

function normalizeServiceType(value) {
  return normalizeString(value) === 'subscription' ? 'subscription' : 'one_time';
}

const stripeProcessingFeeCents = (totalCents) =>
  Math.max(0, Math.round((Number(totalCents) || 0) * (STRIPE_PROCESSING_PERCENT / 100)) + STRIPE_PROCESSING_FIXED_CENTS);

const buyerProcessingFeeCents = (coachPriceCents) => {
  const base = Math.max(0, Number(coachPriceCents) || 0);
  if (!base) return 0;
  const platformFee = platformFeeCents(base);
  // Stripe's percentage is charged on the full amount the buyer pays, so solve
  // for the total that covers coach price + Pulse platform fee + Stripe estimate.
  const percentageRate = STRIPE_PROCESSING_PERCENT / 100;
  const grossedUpTotal = Math.ceil((base + platformFee + STRIPE_PROCESSING_FIXED_CENTS) / (1 - percentageRate));
  return Math.max(0, grossedUpTotal - base);
};

const servicePricingBreakdown = (coachPriceCents) => {
  const amountCents = Math.max(0, Number(coachPriceCents) || 0);
  const processingFeeCents = buyerProcessingFeeCents(amountCents);
  const totalAmountCents = amountCents + processingFeeCents;
  return {
    amountCents,
    coachPriceCents: amountCents,
    processingFeeCents,
    totalAmountCents,
    platformFeeCents: platformFeeCents(amountCents),
    estimatedStripeFeeCents: stripeProcessingFeeCents(totalAmountCents),
    coachNetCents: amountCents,
    platformFeePercent: PLATFORM_FEE_PERCENT,
    stripeProcessingPercent: STRIPE_PROCESSING_PERCENT,
    stripeProcessingFixedCents: STRIPE_PROCESSING_FIXED_CENTS,
  };
};

const normalizeDynamicService = (snap) => {
  if (!snap?.exists) return null;
  const data = snap.data() || {};
  const priceCents = Math.round(
    Math.max(0, Number(data.priceCents ?? data.amountCents) || 0)
  );
  const currency = normalizeStatus(data.currency) || 'usd';
  if (priceCents < 50 || !/^[a-z]{3}$/.test(currency)) return null;
  return {
    id: snap.id,
    title: normalizeString(data.title) || 'Coach service',
    description: normalizeString(data.description),
    amountCents: priceCents,
    currency,
    serviceType: normalizeServiceType(data.serviceType),
    status: normalizeStatus(data.status) || 'active',
    coachUserId: normalizeString(data.coachUserId),
    teamId: normalizeString(data.teamId),
    organizationId: normalizeString(data.organizationId),
  };
};

const loadService = async ({ serviceId, conversation, database = db }) => {
  const coachUserId = normalizeString(conversation?.coachUserId);
  const teamId = normalizeString(conversation?.scope?.teamId);
  const organizationId = normalizeString(conversation?.scope?.organizationId);
  if (!coachUserId || !teamId || !organizationId) return null;

  const catalogService = getService(serviceId);
  if (catalogService) {
    return {
      ...catalogService,
      serviceType: 'one_time',
      status: 'active',
      coachUserId,
      teamId,
      organizationId,
    };
  }

  const normalizedServiceId = normalizeString(serviceId);
  if (!normalizedServiceId) return null;
  const snap = await database.collection(SERVICES_COLLECTION).doc(normalizedServiceId).get();
  const service = normalizeDynamicService(snap);
  if (!service || service.status !== 'active') return null;
  if (
    service.coachUserId !== coachUserId
    || service.teamId !== teamId
    || service.organizationId !== organizationId
  ) return null;
  return service;
};

const publicServicePayload = (service) => {
  const pricing = servicePricingBreakdown(service.amountCents);
  return {
    id: service.id,
    title: service.title,
    description: service.description || '',
    serviceType: service.serviceType || 'one_time',
    currency: service.currency || 'usd',
    coachPriceCents: pricing.coachPriceCents,
    processingFeeCents: pricing.processingFeeCents,
    totalAmountCents: pricing.totalAmountCents,
  };
};

const listServicesForConversation = async ({ conversation, database = db }) => {
  const coachUserId = normalizeString(conversation?.coachUserId);
  const teamId = normalizeString(conversation?.scope?.teamId);
  const organizationId = normalizeString(conversation?.scope?.organizationId);
  if (!coachUserId || !teamId || !organizationId) return [];

  const snapshot = await database.collection(SERVICES_COLLECTION)
    .where('coachUserId', '==', coachUserId)
    .get();

  const services = [];
  for (const doc of snapshot.docs) {
    const service = normalizeDynamicService(doc);
    if (!service || service.status !== 'active') continue;
    if (
      service.serviceType === 'subscription'
      && process.env.PULSECHECK_RECURRING_COACH_SERVICES_ENABLED !== 'true'
    ) continue;
    if (
      service.coachUserId !== coachUserId
      || service.teamId !== teamId
      || service.organizationId !== organizationId
    ) continue;
    services.push(publicServicePayload(service));
  }

  return services.sort((left, right) => left.title.localeCompare(right.title));
};

const verifyFirebaseUser = async (
  event,
  {
    authErrorMessage = 'Sign in is required to purchase a coach service.',
  } = {}
) => {
  const safeAuthErrorMessage =
    normalizeString(authErrorMessage)
    || 'Sign in is required to continue.';
  const authHeader = event.headers?.authorization || event.headers?.Authorization || '';
  const match = normalizeString(authHeader).match(/^Bearer\s+(.+)$/i);
  if (!match) {
    const error = new Error(safeAuthErrorMessage);
    error.statusCode = 401;
    throw error;
  }

  try {
    const app = getFirebaseAdminApp(event);
    const decoded = await app.auth().verifyIdToken(match[1]);
    const userId = normalizeString(decoded?.uid);
    if (!userId) throw new Error('The sign-in token did not include a user id.');
    return { userId, decoded, app };
  } catch (cause) {
    const error = new Error(safeAuthErrorMessage);
    error.statusCode = 401;
    error.cause = cause;
    throw error;
  }
};

const loadConversationForAthlete = async ({ conversationId, athleteUserId, database = db }) => {
  const normalizedConversationId = normalizeString(conversationId);
  const normalizedAthleteUserId = normalizeString(athleteUserId);
  if (!normalizedConversationId) {
    throw permissionError('A conversation is required.', 400);
  }

  const conversationRef = database.collection(CONVERSATIONS_COLLECTION).doc(normalizedConversationId);
  const conversationSnap = await conversationRef.get();
  if (!conversationSnap.exists) {
    throw permissionError('This coach conversation could not be found.', 404);
  }

  const conversation = conversationSnap.data() || {};
  const conversationAthleteId = normalizeString(conversation.athleteId);
  const coachUserId = normalizeString(conversation.coachId);
  const teamId = normalizeString(conversation.teamId);
  const organizationId = normalizeString(conversation.organizationId);
  const participantIds = normalizedParticipantIds(conversation.participantIds);
  const expectedParticipantIds = [normalizedAthleteUserId, coachUserId].sort();

  if (conversationAthleteId !== normalizedAthleteUserId) {
    throw permissionError(
      'This service can only be purchased by the athlete in the conversation.'
    );
  }
  if (
    !coachUserId
    || coachUserId === normalizedAthleteUserId
    || !teamId
    || !organizationId
    || participantIds.length !== 2
    || participantIds.some((participantId, index) => (
      participantId !== expectedParticipantIds[index]
    ))
  ) {
    throw permissionError(
      'This coach conversation is missing its verified team participants.',
      409
    );
  }

  const [teamSnap, organizationSnap, membershipsSnap] = await Promise.all([
    database.collection(TEAMS_COLLECTION).doc(teamId).get(),
    database.collection(ORGANIZATIONS_COLLECTION).doc(organizationId).get(),
    database
      .collection(TEAM_MEMBERSHIPS_COLLECTION)
      .where('teamId', '==', teamId)
      .get(),
  ]);
  const team = teamSnap.exists ? teamSnap.data() || {} : {};
  const organization = organizationSnap.exists
    ? organizationSnap.data() || {}
    : {};
  if (
    !teamSnap.exists
    || !organizationSnap.exists
    || normalizeString(team.organizationId) !== organizationId
    || !isActiveHierarchyDocument(team)
    || !isActiveHierarchyDocument(organization)
  ) {
    throw permissionError(
      'This coach conversation is outside an active team.',
      409
    );
  }
  if (!serviceOrdersEnabled(team)) {
    throw permissionError(
      'Coach services are unavailable for this team.',
      409
    );
  }

  let athleteMembership = null;
  let coachMembership = null;
  for (const document of membershipsSnap.docs || []) {
    const membership = document.data() || {};
    if (
      normalizeString(membership.teamId) !== teamId
      || normalizeString(membership.organizationId) !== organizationId
      || !isActiveMembership(membership)
    ) {
      continue;
    }
    const membershipUserId = normalizeString(membership.userId);
    const role = normalizeStatus(membership.role);
    if (
      membershipUserId === normalizedAthleteUserId
      && role === 'athlete'
    ) {
      athleteMembership = { ref: document.ref, id: document.id, data: membership };
    } else if (
      membershipUserId === coachUserId
      && role !== 'athlete'
      && canSellCoachServices(membership)
    ) {
      coachMembership = { ref: document.ref, id: document.id, data: membership };
    }
  }
  if (!athleteMembership || !coachMembership) {
    throw permissionError(
      'The athlete and coach must both have active access to this team.'
    );
  }

  return {
    ref: conversationRef,
    id: conversationSnap.id,
    data: conversation,
    coachUserId,
    scope: {
      organizationId,
      teamId,
      participantIds,
      team: { ref: teamSnap.ref, id: teamSnap.id, data: team },
      organization: {
        ref: organizationSnap.ref,
        id: organizationSnap.id,
        data: organization,
      },
      athleteMembership,
      coachMembership,
    },
  };
};

const orderScopeFields = (conversation) => ({
  conversationId: normalizeString(conversation?.id),
  organizationId: normalizeString(conversation?.scope?.organizationId),
  teamId: normalizeString(conversation?.scope?.teamId),
  participantIds: normalizedParticipantIds(conversation?.scope?.participantIds),
  athleteUserId: normalizeString(conversation?.data?.athleteId),
  coachUserId: normalizeString(conversation?.coachUserId),
});

const assertOrderMatchesConversation = (order, conversation) => {
  const expected = orderScopeFields(conversation);
  const actualParticipants = normalizedParticipantIds(order?.participantIds);
  if (
    normalizeString(order?.conversationId) !== expected.conversationId
    || normalizeString(order?.organizationId) !== expected.organizationId
    || normalizeString(order?.teamId) !== expected.teamId
    || normalizeString(order?.athleteUserId) !== expected.athleteUserId
    || normalizeString(order?.coachUserId) !== expected.coachUserId
    || actualParticipants.length !== expected.participantIds.length
    || actualParticipants.some((participantId, index) => (
      participantId !== expected.participantIds[index]
    ))
  ) {
    throw permissionError(
      'This service order no longer matches its team conversation.',
      409
    );
  }
  return expected;
};

const validCheckoutId = (value) => (
  /^[A-Za-z0-9_-]{16,80}$/.test(normalizeString(value))
);

const loadValidatedOrderForAthlete = async ({
  orderId,
  athleteUserId,
  database = db,
}) => {
  if (!validCheckoutId(orderId)) {
    throw permissionError('A valid service order id is required.', 400);
  }
  const ref = orderRef(orderId, database);
  const orderSnap = await ref.get();
  if (!orderSnap.exists) {
    throw permissionError('This service order could not be found.', 404);
  }
  const order = orderSnap.data() || {};
  if (normalizeString(order.athleteUserId) !== normalizeString(athleteUserId)) {
    throw permissionError('This service order belongs to another account.');
  }
  if (!verifyOrderIntegrity(order)) {
    throw permissionError(
      'This service order could not be verified.',
      409
    );
  }
  const conversation = await loadConversationForAthlete({
    conversationId: order.conversationId,
    athleteUserId,
    database,
  });
  assertOrderMatchesConversation(order, conversation);
  return { ref, orderSnap, order, conversation };
};

const paymentMetadataMatchesOrder = (metadata, order, paymentType) => {
  const expected = {
    payment_type: paymentType,
    order_id: normalizeString(order.orderId),
    conversation_id: normalizeString(order.conversationId),
    organization_id: normalizeString(order.organizationId),
    team_id: normalizeString(order.teamId),
    service_id: normalizeString(order.serviceId),
    athlete_user_id: normalizeString(order.athleteUserId),
    coach_user_id: normalizeString(order.coachUserId),
    stripe_mode: normalizeStatus(order.stripeMode),
    amount_cents: String(Number(order.amountCents) || 0),
    coach_price_cents: String(Number(order.coachPriceCents) || 0),
    processing_fee_cents: String(Number(order.processingFeeCents) || 0),
    platform_fee_cents: String(Number(order.platformFeeCents) || 0),
  };
  return Object.entries(expected).every(
    ([key, value]) => normalizeString(metadata?.[key]) === value
  );
};

const assertPaymentIntentMatchesOrder = (
  paymentIntent,
  order,
  { requireSucceeded = false } = {}
) => {
  const expectedMode = normalizeStatus(order?.stripeMode);
  const liveModeMatches = typeof paymentIntent?.livemode !== 'boolean'
    || paymentIntent.livemode === (expectedMode === 'live');
  if (
    normalizeString(paymentIntent?.id) !== normalizeString(order?.paymentIntentId)
    || !paymentMetadataMatchesOrder(
      paymentIntent?.metadata,
      order,
      'pulsecheck_coach_service'
    )
    || (Number.isFinite(Number(paymentIntent?.amount))
      && Number(paymentIntent.amount) !== Number(order.amountCents))
    || (normalizeString(paymentIntent?.currency)
      && normalizeStatus(paymentIntent.currency) !== normalizeStatus(order.currency))
    || !liveModeMatches
    || (requireSucceeded && normalizeStatus(paymentIntent?.status) !== 'succeeded')
  ) {
    throw permissionError(
      'Stripe payment details do not match this service order.',
      409
    );
  }
};

const assertPaymentIntentCanFulfillOrder = (paymentIntent) => {
  const charge = paymentIntent?.latest_charge;
  if (
    !charge
    || typeof charge !== 'object'
    || normalizeStatus(charge.status) !== 'succeeded'
    || charge.paid !== true
    || charge.refunded === true
    || Number(charge.amount_refunded) > 0
    || charge.disputed === true
  ) {
    throw permissionError(
      'Stripe has not confirmed an available payment for this service order.',
      409
    );
  }
};

const assertSubscriptionSessionMatchesOrder = (session, order) => {
  const expectedMode = normalizeStatus(order?.stripeMode);
  const liveModeMatches = typeof session?.livemode !== 'boolean'
    || session.livemode === (expectedMode === 'live');
  if (
    normalizeString(session?.id) !== normalizeString(order?.stripeSessionId)
    || normalizeString(session?.client_reference_id)
      !== normalizeString(order?.athleteUserId)
    || !paymentMetadataMatchesOrder(
      session?.metadata,
      order,
      'pulsecheck_coach_service_subscription'
    )
    || (Number.isFinite(Number(session?.amount_total))
      && Number(session.amount_total) !== Number(order.amountCents))
    || (normalizeString(session?.currency)
      && normalizeStatus(session.currency) !== normalizeStatus(order.currency))
    || !liveModeMatches
  ) {
    throw permissionError(
      'Stripe subscription details do not match this service order.',
      409
    );
  }
};

const assertCheckoutSessionMatchesOrder = (session, order) => {
  const expectedMode = normalizeStatus(order?.stripeMode);
  const liveModeMatches = typeof session?.livemode !== 'boolean'
    || session.livemode === (expectedMode === 'live');
  if (
    normalizeString(session?.id) !== normalizeString(order?.stripeSessionId)
    || normalizeString(session?.client_reference_id)
      !== normalizeString(order?.athleteUserId)
    || !paymentMetadataMatchesOrder(
      session?.metadata,
      order,
      'pulsecheck_coach_service'
    )
    || (Number.isFinite(Number(session?.amount_total))
      && Number(session.amount_total) !== Number(order.amountCents))
    || (normalizeString(session?.currency)
      && normalizeStatus(session.currency) !== normalizeStatus(order.currency))
    || !liveModeMatches
  ) {
    throw permissionError(
      'Stripe checkout details do not match this service order.',
      409
    );
  }
};

const resolveCoachStripeAccount = async (coachUserId, database = db) => {
  const [userSnap, connectSnap] = await Promise.all([
    database.collection('users').doc(coachUserId).get(),
    database.collection('stripeConnect').doc(coachUserId).get(),
  ]);
  const user = userSnap.exists ? userSnap.data() || {} : {};
  const connect = connectSnap.exists ? connectSnap.data() || {} : {};
  return normalizeString(user?.creator?.stripeAccountId || connect.stripeAccountId);
};

const orderRef = (orderId, database = db) =>
  database.collection(ORDERS_COLLECTION).doc(normalizeString(orderId));

const serializeBooking = ({ orderId, order, scheduledAt, bookedAt }) => ({
  id: orderId,
  orderId,
  paymentIntentId: normalizeString(order.paymentIntentId),
  organizationId: normalizeString(order.organizationId),
  teamId: normalizeString(order.teamId),
  conversationId: normalizeString(order.conversationId),
  coachUserId: normalizeString(order.coachUserId),
  athleteUserId: normalizeString(order.athleteUserId),
  serviceId: normalizeString(order.serviceId),
  serviceTitle: normalizeString(order.serviceTitle),
  price: Math.round(
    (Number(order.coachPriceCents ?? order.amountCents) || 0) / 100
  ),
  priceCents: Number(order.coachPriceCents ?? order.amountCents) || 0,
  totalAmountCents: Number(order.amountCents) || 0,
  currency: normalizeString(order.currency) || 'usd',
  scheduledAt,
  bookedAt,
  bookedByUserId: normalizeString(order.athleteUserId),
});

const markOrderPaid = async ({ paymentIntent, source = 'api', database = db }) => {
  const metadata = paymentIntent?.metadata || {};
  if (normalizeString(metadata.payment_type) !== 'pulsecheck_coach_service') {
    return null;
  }

  const orderId = normalizeString(metadata.order_id);
  if (!orderId) return null;

  const ref = orderRef(orderId, database);
  await database.runTransaction(async (transaction) => {
    const snap = await transaction.get(ref);
    if (!snap.exists) {
      throw new Error(`Coach service order ${orderId} was not found.`);
    }
    const order = snap.data() || {};
    if (!verifyOrderIntegrity(order)) {
      throw new Error(`Coach service order ${orderId} could not be verified.`);
    }
    const paymentIntentId = normalizeString(paymentIntent.id);
    const stripeCustomerId =
      typeof paymentIntent.customer === 'string'
        ? normalizeString(paymentIntent.customer)
        : normalizeString(paymentIntent.customer?.id);
    const orderWithPaymentIntent = normalizeString(order.paymentIntentId)
      ? order
      : sealOrder({
          ...order,
          paymentIntentId,
          stripeCustomerId: stripeCustomerId || normalizeString(order.stripeCustomerId),
        });
    assertPaymentIntentMatchesOrder(
      paymentIntent,
      orderWithPaymentIntent,
      { requireSucceeded: true }
    );
    const authorizedOrder = sealOrder({
      ...orderWithPaymentIntent,
      paymentAuthorized: true,
    });
    transaction.set(ref, {
      status: normalizeStatus(order.status) === 'booked' ? 'booked' : 'paid',
      paymentStatus: normalizeString(paymentIntent.status),
      paymentIntentId,
      stripeCustomerId: stripeCustomerId || normalizeString(order.stripeCustomerId) || null,
      paymentAuthorized: true,
      orderIntegritySeal: authorizedOrder.orderIntegritySeal,
      paymentMethodType:
        normalizeString(paymentIntent.payment_method_types?.[0])
        || normalizeString(paymentIntent.payment_method),
      paidAt: order.paidAt || admin.firestore.FieldValue.serverTimestamp(),
      paymentVerifiedAt: admin.firestore.FieldValue.serverTimestamp(),
      paymentVerificationSource: source,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
  });

  return ref;
};

const markSubscriptionOrderActive = async ({ session, source = 'stripe-webhook', database = db }) => {
  const metadata = session?.metadata || {};
  if (normalizeString(metadata.payment_type) !== 'pulsecheck_coach_service_subscription') {
    return null;
  }

  const orderId = normalizeString(metadata.order_id);
  if (!orderId) return null;

  const ref = orderRef(orderId, database);
  await database.runTransaction(async (transaction) => {
    const orderSnap = await transaction.get(ref);
    if (!orderSnap.exists) {
      throw new Error(`Coach service order ${orderId} was not found.`);
    }
    const order = orderSnap.data() || {};
    if (!verifyOrderIntegrity(order)) {
      throw new Error(`Coach service order ${orderId} could not be verified.`);
    }
    assertSubscriptionSessionMatchesOrder(session, order);
    if (normalizeStatus(session.payment_status) !== 'paid') {
      throw new Error(`Coach service order ${orderId} has not been paid.`);
    }

    const stripeSubscriptionId =
      typeof session.subscription === 'string'
        ? normalizeString(session.subscription)
        : normalizeString(session.subscription?.id);
    const stripeCustomerId =
      typeof session.customer === 'string'
        ? normalizeString(session.customer)
        : normalizeString(session.customer?.id);
    if (!stripeSubscriptionId || !stripeCustomerId) {
      throw new Error(`Coach service order ${orderId} is missing Stripe subscription details.`);
    }
    const resealedOrder = sealOrder({
      ...order,
      stripeSubscriptionId,
      stripeCustomerId,
      paymentAuthorized: true,
    });
    transaction.set(ref, {
      status: 'active',
      paymentStatus: 'paid',
      stripeSubscriptionId,
      stripeCustomerId,
      paymentAuthorized: true,
      orderIntegritySeal: resealedOrder.orderIntegritySeal,
      paidAt: order.paidAt || admin.firestore.FieldValue.serverTimestamp(),
      subscriptionActivatedAt: admin.firestore.FieldValue.serverTimestamp(),
      paymentVerificationSource: source,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
  });

  return ref;
};

module.exports = {
  CONVERSATIONS_COLLECTION,
  ORDER_INTEGRITY_VERSION,
  ORGANIZATIONS_COLLECTION,
  ORDERS_COLLECTION,
  SERVICES_COLLECTION,
  TEAM_MEMBERSHIPS_COLLECTION,
  TEAMS_COLLECTION,
  PLATFORM_FEE_PERCENT,
  STRIPE_PROCESSING_FIXED_CENTS,
  STRIPE_PROCESSING_PERCENT,
  SERVICE_CATALOG,
  assertOrderMatchesConversation,
  assertCheckoutSessionMatchesOrder,
  assertPaymentIntentCanFulfillOrder,
  assertPaymentIntentMatchesOrder,
  assertSubscriptionSessionMatchesOrder,
  buyerProcessingFeeCents,
  canSellCoachServices,
  createOrderIntegritySeal,
  getService,
  isActiveMembership,
  isActiveHierarchyDocument,
  listServicesForConversation,
  loadService,
  loadConversationForAthlete,
  loadValidatedOrderForAthlete,
  markSubscriptionOrderActive,
  markOrderPaid,
  normalizeString,
  normalizedParticipantIds,
  orderRef,
  orderScopeFields,
  platformFeeCents,
  resolveCoachStripeAccount,
  resolveServerStripeMode,
  sealOrder,
  serviceOrdersEnabled,
  serializeBooking,
  servicePricingBreakdown,
  stripeProcessingFeeCents,
  validCheckoutId,
  verifyOrderIntegrity,
  verifyFirebaseUser,
};
