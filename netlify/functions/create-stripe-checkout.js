const Stripe = require('stripe');
const admin = require('firebase-admin');

if (admin.apps.length === 0) {
  admin.initializeApp({
    credential: admin.credential.cert({
      "type": "service_account",
      "project_id": "quicklifts-dd3f1",
      "private_key_id": process.env.FIREBASE_PRIVATE_KEY,
      "private_key": process.env.FIREBASE_SECRET_KEY.replace(/\\n/g, '\n'),
      "client_email": "firebase-adminsdk-1qxb0@quicklifts-dd3f1.iam.gserviceaccount.com",
      "client_id": "111494077667496751062",
      "auth_uri": "https://accounts.google.com/o/oauth2/auth",
      "token_uri": "https://oauth2.googleapis.com/token",
      "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
      "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-1qxb0%40quicklifts-dd3f1.iam.gserviceaccount.com",
      "universe_domain": "googleapis.com"
    }),
  });
}

const db = admin.firestore();
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

async function updateSubscriptionDocument(type, userId) {
  const userRef = db.collection('subscriptions').doc(userId);
  await userRef.set({
    subscriptionType: type,
    platform: 'web',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });
}

const handler = async (event) => {
  try {
    const { priceId } = JSON.parse(event.body);

    if (!priceId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing priceId' }),
      };
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'subscription',
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: 'https://fitwithpulse.ai/success',
      cancel_url: 'https://fitwithpulse.ai/cancel',
    });

    // Assign the subscription type based on the priceId
    let type = 'Annual Subscriber';
    switch (priceId) {
      case 'price_499': // Update this to your specific price ID
        type = 'Monthly Subscriber';
        break;
      case 'price_3999': // Example of another price ID
        type = 'Annual Subscriber';
        break;
      default:
        type = 'Unsubscribed';
    }

    // Save subscription details in Firestore
    await updateSubscriptionDocument(type, session.id);

    return {
      statusCode: 200,
      body: JSON.stringify({ id: session.id }),
    };
  } catch (error) {
    console.error(error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};

module.exports = { handler };
