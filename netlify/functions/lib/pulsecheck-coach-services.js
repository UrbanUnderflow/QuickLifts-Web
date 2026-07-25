const { admin, db } = require('../config/firebase');
const { getFirebaseAdminApp } = require('../config/firebase');

const ORDERS_COLLECTION = 'pulsecheck-coach-service-orders';
const CONVERSATIONS_COLLECTION = 'coach-athlete-conversations';
const PLATFORM_FEE_PERCENT = 3;

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

module.exports = {
  CONVERSATIONS_COLLECTION,
  ORDERS_COLLECTION,
  PLATFORM_FEE_PERCENT,
  SERVICE_CATALOG,
  getService,
  loadConversationForAthlete,
  markOrderPaid,
  normalizeString,
  orderRef,
  platformFeeCents,
  resolveCoachStripeAccount,
  serializeBooking,
  verifyFirebaseUser,
};
