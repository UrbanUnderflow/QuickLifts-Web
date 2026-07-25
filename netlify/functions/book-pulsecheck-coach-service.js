const { admin, headers, getFirebaseAdminApp } = require('./config/firebase');
const {
  CONVERSATIONS_COLLECTION,
  normalizeString,
  orderRef,
  serializeBooking,
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

    const ref = orderRef(body.orderId, database);
    const bookedAt = admin.firestore.Timestamp.now();
    let booking;
    await database.runTransaction(async (transaction) => {
      const orderSnap = await transaction.get(ref);
      if (!orderSnap.exists) {
        const error = new Error('This service order could not be found.');
        error.statusCode = 404;
        throw error;
      }
      const order = orderSnap.data() || {};
      if (normalizeString(order.athleteUserId) !== userId) {
        const error = new Error('This service order belongs to another account.');
        error.statusCode = 403;
        throw error;
      }
      if (!['paid', 'booked'].includes(normalizeString(order.status))) {
        const error = new Error('Payment must be confirmed before scheduling.');
        error.statusCode = 409;
        throw error;
      }

      const conversationId = normalizeString(order.conversationId);
      const conversationRef = database.collection(CONVERSATIONS_COLLECTION).doc(conversationId);
      const conversationSnap = await transaction.get(conversationRef);
      if (!conversationSnap.exists) {
        const error = new Error('This coach conversation could not be found.');
        error.statusCode = 404;
        throw error;
      }
      const conversation = conversationSnap.data() || {};
      if (
        normalizeString(conversation.athleteId) !== userId
        || normalizeString(conversation.coachId) !== normalizeString(order.coachUserId)
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
      transaction.set(ref, {
        status: 'booked',
        scheduledAt: scheduledTimestamp,
        bookedAt,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
      transaction.set(conversationRef, {
        activeBooking: booking,
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

module.exports = { handler, parseScheduledAt };
