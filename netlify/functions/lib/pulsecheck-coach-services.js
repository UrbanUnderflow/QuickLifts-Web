const { admin, db } = require('../config/firebase');
const { getFirebaseAdminApp } = require('../config/firebase');

const ORDERS_COLLECTION = 'pulsecheck-coach-service-orders';
const CONVERSATIONS_COLLECTION = 'coach-athlete-conversations';
const SERVICES_COLLECTION = 'pulsecheck-coach-services';
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
const platformFeeCents = (amountCents) =>
  Math.round((Number(amountCents) || 0) * (PLATFORM_FEE_PERCENT / 100));

const getService = (serviceId) => SERVICE_CATALOG[normalizeString(serviceId)] || null;

const normalizeServiceType = (value) =>
  normalizeString(value) === 'subscription' ? 'subscription' : 'one_time';

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
  const priceCents = Math.max(0, Number(data.priceCents ?? data.amountCents) || 0);
  if (priceCents < 50) return null;
  return {
    id: snap.id,
    title: normalizeString(data.title) || 'Coach service',
    description: normalizeString(data.description),
    amountCents: priceCents,
    currency: normalizeString(data.currency).toLowerCase() || 'usd',
    serviceType: normalizeServiceType(data.serviceType),
    status: normalizeString(data.status) || 'active',
    coachUserId: normalizeString(data.coachUserId),
    teamId: normalizeString(data.teamId),
    organizationId: normalizeString(data.organizationId),
  };
};

const loadService = async ({ serviceId, conversation, database = db }) => {
  const catalogService = getService(serviceId);
  if (catalogService) {
    return {
      ...catalogService,
      serviceType: 'one_time',
      status: 'active',
      coachUserId: conversation?.coachUserId || '',
    };
  }

  const normalizedServiceId = normalizeString(serviceId);
  if (!normalizedServiceId) return null;
  const snap = await database.collection(SERVICES_COLLECTION).doc(normalizedServiceId).get();
  const service = normalizeDynamicService(snap);
  if (!service || service.status !== 'active') return null;
  if (conversation?.coachUserId && service.coachUserId !== conversation.coachUserId) return null;
  const conversationTeamId = normalizeString(conversation?.data?.teamId || conversation?.data?.pulseCheckTeamId);
  if (service.teamId && conversationTeamId && service.teamId !== conversationTeamId) return null;
  if (service.teamId) {
    const teamSnap = await database.collection('pulsecheck-teams').doc(service.teamId).get();
    const team = teamSnap.exists ? teamSnap.data() || {} : {};
    if (team?.commercialConfig?.additionalServicesEnabled !== true) return null;
  }
  return service;
};

const verifyFirebaseUser = async (event) => {
  const authHeader = event.headers?.authorization || event.headers?.Authorization || '';
  const match = normalizeString(authHeader).match(/^Bearer\s+(.+)$/i);
  if (!match) {
    const error = new Error('Sign in is required to purchase a coach service.');
    error.statusCode = 401;
    throw error;
  }

  try {
    const decoded = await getFirebaseAdminApp(event).auth().verifyIdToken(match[1]);
    const userId = normalizeString(decoded?.uid);
    if (!userId) throw new Error('The sign-in token did not include a user id.');
    return { userId, decoded };
  } catch (error) {
    if (!error.statusCode) error.statusCode = 401;
    throw error;
  }
};

const loadConversationForAthlete = async ({ conversationId, athleteUserId, database = db }) => {
  const normalizedConversationId = normalizeString(conversationId);
  if (!normalizedConversationId) {
    const error = new Error('A conversation is required.');
    error.statusCode = 400;
    throw error;
  }

  const conversationRef = database.collection(CONVERSATIONS_COLLECTION).doc(normalizedConversationId);
  const conversationSnap = await conversationRef.get();
  if (!conversationSnap.exists) {
    const error = new Error('This coach conversation could not be found.');
    error.statusCode = 404;
    throw error;
  }

  const conversation = conversationSnap.data() || {};
  if (normalizeString(conversation.athleteId) !== normalizeString(athleteUserId)) {
    const error = new Error('This service can only be purchased by the athlete in the conversation.');
    error.statusCode = 403;
    throw error;
  }

  const coachUserId = normalizeString(conversation.coachId);
  if (!coachUserId) {
    const error = new Error('This conversation is not linked to a coach.');
    error.statusCode = 409;
    throw error;
  }

  return {
    ref: conversationRef,
    id: conversationSnap.id,
    data: conversation,
    coachUserId,
  };
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
  serviceId: normalizeString(order.serviceId),
  serviceTitle: normalizeString(order.serviceTitle),
  price: Math.round((Number(order.amountCents) || 0) / 100),
  priceCents: Number(order.amountCents) || 0,
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
    if (normalizeString(order.paymentIntentId) !== normalizeString(paymentIntent.id)) {
      throw new Error(`Coach service order ${orderId} has a different PaymentIntent.`);
    }
    transaction.set(ref, {
      status: 'paid',
      paymentStatus: normalizeString(paymentIntent.status),
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
  await ref.set({
    status: 'active',
    paymentStatus: normalizeString(session.payment_status) || 'paid',
    stripeSessionId: normalizeString(session.id),
    stripeSubscriptionId:
      typeof session.subscription === 'string'
        ? normalizeString(session.subscription)
        : normalizeString(session.subscription?.id),
    stripeCustomerId:
      typeof session.customer === 'string'
        ? normalizeString(session.customer)
        : normalizeString(session.customer?.id),
    subscriptionActivatedAt: admin.firestore.FieldValue.serverTimestamp(),
    paymentVerificationSource: source,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });

  return ref;
};

module.exports = {
  CONVERSATIONS_COLLECTION,
  ORDERS_COLLECTION,
  SERVICES_COLLECTION,
  PLATFORM_FEE_PERCENT,
  STRIPE_PROCESSING_FIXED_CENTS,
  STRIPE_PROCESSING_PERCENT,
  SERVICE_CATALOG,
  buyerProcessingFeeCents,
  getService,
  loadService,
  loadConversationForAthlete,
  markSubscriptionOrderActive,
  markOrderPaid,
  normalizeString,
  orderRef,
  platformFeeCents,
  resolveCoachStripeAccount,
  serializeBooking,
  servicePricingBreakdown,
  stripeProcessingFeeCents,
  verifyFirebaseUser,
};
