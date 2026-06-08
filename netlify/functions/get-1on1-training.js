// Read-only fetch of the public-safe fields of a 1-on-1 coaching room,
// used by the buyer-facing /coaching/[id] checkout page to render the
// coach + price before redirecting to Stripe Checkout.

const { admin } = require('./config/firebase');
const { priceLabel } = require('./lib/coaching');
const db = admin.firestore();

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'GET, OPTIONS' } };
  }
  const trainingId = event.queryStringParameters?.id;
  if (!trainingId) {
    return { statusCode: 400, headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ error: 'Missing id' }) };
  }
  try {
    const snap = await db.collection('one-on-one-trainings').doc(trainingId).get();
    if (!snap.exists) {
      return { statusCode: 404, headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ error: 'Training not found' }) };
    }
    const t = snap.data() || {};
    const pricing = t.pricing || null;
    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        trainingId,
        clubName: t.clubName || '',
        status: t.status || 'pending',
        paymentStatus: t.paymentStatus || 'notRequired',
        coachUsername: t.hostInfo?.username || '',
        coachProfileImage: t.hostInfo?.profileImage?.profileImageURL || '',
        inviteMessage: t.inviteMessage || '',
        mode: pricing?.mode || null, // null ⇒ free
        interval: pricing?.interval || null,
        priceLabel: priceLabel(pricing)
      })
    };
  } catch (error) {
    console.error('[get-1on1-training] Error:', error);
    return { statusCode: 500, headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ error: error.message }) };
  }
};
