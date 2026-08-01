const Stripe = require('stripe');
const { admin, headers, getFirebaseAdminApp } = require('./config/firebase');
const { getSecretWithEnvFallback } = require('./google-secret-manager-utils');
const {
  assertOrderMatchesConversation,
  assertPaymentIntentCanFulfillOrder,
  assertPaymentIntentMatchesOrder,
  canSellCoachServices,
  isActiveHierarchyDocument,
  isActiveMembership,
  loadValidatedOrderForAthlete,
  markOrderPaid,
  normalizedParticipantIds,
  ORDERS_COLLECTION,
  normalizeString,
  sealOrder,
  serviceOrdersEnabled,
  serializeBooking,
  verifyOrderIntegrity,
  verifyFirebaseUser,
} = require('./lib/pulsecheck-coach-services');

const jsonHeaders = {
  ...headers,
  'Content-Type': 'application/json',
  'Cache-Control': 'private, no-store',
};

const parseScheduledAt = (value) => {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) return null;
  return date;
};

const stripeClientForOrder = async (order) => {
  const stripeMode = normalizeString(order?.stripeMode).toLowerCase();
  if (stripeMode !== 'test' && stripeMode !== 'live') {
    const error = new Error('This service order has an invalid Stripe mode.');
    error.statusCode = 409;
    throw error;
  }
  const secretName = stripeMode === 'test'
    ? 'STRIPE_TEST_SECRET_KEY'
    : 'STRIPE_SECRET_KEY';
  const key = await getSecretWithEnvFallback(secretName).catch((cause) => {
    const error = new Error('Stripe payment verification is unavailable.');
    error.statusCode = 503;
    error.cause = cause;
    throw error;
  });
  if (!key) {
    const error = new Error('Stripe payment verification is unavailable.');
    error.statusCode = 503;
    throw error;
  }
  return new Stripe(key, { apiVersion: '2023-10-16' });
};

const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: jsonHeaders, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: jsonHeaders,
      body: JSON.stringify({ message: 'Method Not Allowed' }),
    };
  }

  try {
    const database = getFirebaseAdminApp(event).firestore();
    const { userId } = await verifyFirebaseUser(event);
    const body = JSON.parse(event.body || '{}');
    const scheduledAt = parseScheduledAt(body.scheduledAt);
    if (!scheduledAt || scheduledAt.getTime() < Date.now() + 5 * 60 * 1000) {
      const error = new Error('Choose a time at least five minutes from now.');
      error.statusCode = 400;
      throw error;
    }

    const validated = await loadValidatedOrderForAthlete({
      orderId: body.orderId,
      athleteUserId: userId,
      database,
    });
    if (normalizeString(validated.order.serviceType) !== 'one_time') {
      const error = new Error('This service order cannot be scheduled.');
      error.statusCode = 409;
      throw error;
    }
    if (
      ['refunded', 'partially_refunded', 'canceled', 'cancelled']
        .includes(normalizeString(validated.order.status).toLowerCase())
    ) {
      const error = new Error('This payment is no longer available for scheduling.');
      error.statusCode = 409;
      throw error;
    }
    const paymentIntentId = normalizeString(validated.order.paymentIntentId);
    if (!paymentIntentId) {
      const error = new Error('This service order has no Stripe payment.');
      error.statusCode = 409;
      throw error;
    }
    const stripe = await stripeClientForOrder(validated.order);
    const paymentIntent = await stripe.paymentIntents.retrieve(
      paymentIntentId,
      { expand: ['latest_charge'] }
    );
    assertPaymentIntentMatchesOrder(
      paymentIntent,
      validated.order,
      { requireSucceeded: true }
    );
    assertPaymentIntentCanFulfillOrder(paymentIntent);
    await markOrderPaid({
      paymentIntent,
      source: 'booking-verification',
      database,
    });

    const ref = validated.ref;
    const scope = validated.conversation.scope;
    const bookedAt = admin.firestore.Timestamp.now();
    const bookingRecordedAtISO = bookedAt.toDate().toISOString();
    let booking;
    await database.runTransaction(async (transaction) => {
      const [
        orderSnap,
        conversationSnap,
        teamSnap,
        organizationSnap,
        athleteMembershipSnap,
        coachMembershipSnap,
      ] = await Promise.all([
        transaction.get(ref),
        transaction.get(validated.conversation.ref),
        transaction.get(scope.team.ref),
        transaction.get(scope.organization.ref),
        transaction.get(scope.athleteMembership.ref),
        transaction.get(scope.coachMembership.ref),
      ]);
      if (!orderSnap.exists || !conversationSnap.exists) {
        const error = new Error('This service order is no longer available.');
        error.statusCode = 409;
        throw error;
      }
      const order = orderSnap.data() || {};
      if (!verifyOrderIntegrity(order) || order.paymentAuthorized !== true) {
        const error = new Error('Payment must be confirmed before scheduling.');
        error.statusCode = 409;
        throw error;
      }
      assertOrderMatchesConversation(order, validated.conversation);
      if (
        normalizeString(order.athleteUserId) !== userId
        || normalizeString(order.paymentIntentId) !== paymentIntentId
        || normalizeString(order.serviceType) !== 'one_time'
      ) {
        const error = new Error('This service order changed before scheduling.');
        error.statusCode = 409;
        throw error;
      }
      if (!['paid', 'booked'].includes(normalizeString(order.status))) {
        const error = new Error('Payment must be confirmed before scheduling.');
        error.statusCode = 409;
        throw error;
      }

      const conversationId = normalizeString(order.conversationId);
      const conversationRef = validated.conversation.ref;
      const conversation = conversationSnap.data() || {};
      const participantIds = normalizedParticipantIds(conversation.participantIds);
      const expectedParticipantIds = [
        normalizeString(order.athleteUserId),
        normalizeString(order.coachUserId),
      ].sort();
      const team = teamSnap.exists ? teamSnap.data() || {} : {};
      const organization = organizationSnap.exists
        ? organizationSnap.data() || {}
        : {};
      const athleteMembership = athleteMembershipSnap.exists
        ? athleteMembershipSnap.data() || {}
        : {};
      const coachMembership = coachMembershipSnap.exists
        ? coachMembershipSnap.data() || {}
        : {};
      if (
        normalizeString(conversation.athleteId) !== userId
        || normalizeString(conversation.coachId) !== normalizeString(order.coachUserId)
        || normalizeString(conversation.teamId) !== normalizeString(order.teamId)
        || normalizeString(conversation.organizationId)
          !== normalizeString(order.organizationId)
        || participantIds.length !== 2
        || participantIds.some((participantId, index) => (
          participantId !== expectedParticipantIds[index]
        ))
        || !teamSnap.exists
        || !organizationSnap.exists
        || normalizeString(team.organizationId) !== normalizeString(order.organizationId)
        || !isActiveHierarchyDocument(team)
        || !isActiveHierarchyDocument(organization)
        || !serviceOrdersEnabled(team)
        || normalizeString(athleteMembership.userId) !== userId
        || normalizeString(athleteMembership.teamId) !== normalizeString(order.teamId)
        || normalizeString(athleteMembership.organizationId)
          !== normalizeString(order.organizationId)
        || normalizeString(athleteMembership.role).toLowerCase() !== 'athlete'
        || !isActiveMembership(athleteMembership)
        || normalizeString(coachMembership.userId)
          !== normalizeString(order.coachUserId)
        || normalizeString(coachMembership.teamId) !== normalizeString(order.teamId)
        || normalizeString(coachMembership.organizationId)
          !== normalizeString(order.organizationId)
        || normalizeString(coachMembership.role).toLowerCase() === 'athlete'
        || !isActiveMembership(coachMembership)
        || !canSellCoachServices(coachMembership)
      ) {
        const error = new Error('The service order no longer matches this conversation.');
        error.statusCode = 409;
        throw error;
      }

      const scheduledTimestamp = admin.firestore.Timestamp.fromDate(scheduledAt);
      booking = serializeBooking({
        orderId: orderSnap.id,
        order,
        scheduledAt: scheduledTimestamp,
        bookedAt,
      });
      const bookedOrdersSnap = await transaction.get(
        database.collection(ORDERS_COLLECTION)
          .where('conversationId', '==', conversationId)
          .where('status', '==', 'booked')
      );
      const ledgerBookings = bookedOrdersSnap.docs
        .filter((doc) => doc.id !== orderSnap.id)
        .map((doc) => {
          const bookedOrder = doc.data() || {};
          const ledgerSchedule = new Date(
            normalizeString(bookedOrder.bookingScheduleISO)
          );
          const ledgerBookedAt = new Date(
            normalizeString(bookedOrder.bookingRecordedAtISO)
          );
          if (
            !verifyOrderIntegrity(bookedOrder)
            || bookedOrder.paymentAuthorized !== true
            || normalizeString(bookedOrder.conversationId) !== conversationId
            || normalizeString(bookedOrder.organizationId)
              !== normalizeString(order.organizationId)
            || normalizeString(bookedOrder.teamId) !== normalizeString(order.teamId)
            || normalizeString(bookedOrder.athleteUserId) !== userId
            || normalizeString(bookedOrder.coachUserId)
              !== normalizeString(order.coachUserId)
            || normalizeString(bookedOrder.serviceType) !== 'one_time'
            || Number.isNaN(ledgerSchedule.getTime())
            || Number.isNaN(ledgerBookedAt.getTime())
          ) return null;
          return serializeBooking({
            orderId: doc.id,
            order: bookedOrder,
            scheduledAt: admin.firestore.Timestamp.fromDate(ledgerSchedule),
            bookedAt: admin.firestore.Timestamp.fromDate(ledgerBookedAt),
          });
        })
        .filter(Boolean);
      const mergedBookings = [
        ...ledgerBookings,
        booking,
      ]
        .filter((item) => item && typeof item === 'object')
        .filter((item, index, list) => {
          const itemOrderId = normalizeString(item.orderId || item.id);
          if (!itemOrderId) return index === list.findIndex((candidate) => candidate === item);
          return index === list.findIndex((candidate) => normalizeString(candidate.orderId || candidate.id) === itemOrderId);
        })
        .sort((left, right) => {
          const leftDate = left.scheduledAt?.toDate?.() || new Date(left.scheduledAt);
          const rightDate = right.scheduledAt?.toDate?.() || new Date(right.scheduledAt);
          const leftTime = Number.isNaN(leftDate.getTime()) ? 0 : leftDate.getTime();
          const rightTime = Number.isNaN(rightDate.getTime()) ? 0 : rightDate.getTime();
          return leftTime - rightTime;
        });
      const now = Date.now();
      const nextBooking = mergedBookings.find((item) => {
        const date = item.scheduledAt?.toDate?.() || new Date(item.scheduledAt);
        return !Number.isNaN(date.getTime()) && date.getTime() >= now;
      }) || mergedBookings[0] || booking;
      const bookedOrder = sealOrder({
        ...order,
        bookingScheduleISO: scheduledAt.toISOString(),
        bookingRecordedAtISO,
      });
      transaction.set(ref, {
        status: 'booked',
        scheduledAt: scheduledTimestamp,
        bookedAt,
        bookingScheduleISO: scheduledAt.toISOString(),
        bookingRecordedAtISO,
        orderIntegritySeal: bookedOrder.orderIntegritySeal,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
      transaction.set(conversationRef, {
        activeBooking: nextBooking,
        activeBookings: mergedBookings,
        lastMessage: `${order.serviceTitle} booked for ${scheduledAt.toISOString()}`,
        lastMessageTimestamp: admin.firestore.FieldValue.serverTimestamp(),
        lastMessageSenderId: userId,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
    });

    return {
      statusCode: 200,
      headers: jsonHeaders,
      body: JSON.stringify({
        success: true,
        booking: {
          ...booking,
          scheduledAt: scheduledAt.toISOString(),
          bookedAt: bookedAt.toDate().toISOString(),
        },
      }),
    };
  } catch (error) {
    const statusCode = Number(error.statusCode) || 500;
    if (statusCode >= 500) {
      console.error('[BookPulseCheckCoachService] Failed:', error);
    }
    return {
      statusCode,
      headers: jsonHeaders,
      body: JSON.stringify({ message: error.message || 'The booking could not be saved.' }),
    };
  }
};

module.exports = { handler, parseScheduledAt, stripeClientForOrder };
