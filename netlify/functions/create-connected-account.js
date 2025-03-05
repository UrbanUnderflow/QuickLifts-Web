// Docs on event and context https://docs.netlify.com/functions/build/#code-your-function-2

const Stripe = require('stripe');
const admin = require('firebase-admin'); // Install this 

if (admin.apps.length === 0) { // Prevents reinitializing the app
admin.initializeApp({
  credential: admin.credential.cert({
    "type": "service_account",
    "project_id": "quicklifts-dd3f1",
    "private_key_id": process.env.FIREBASE_PRIVATE_KEY_ALT,
    "private_key": process.env.FIREBASE_SECRET_KEY_ALT.replace(/\\n/g, '\n'),
    "client_email": "firebase-adminsdk-1qxb0@quicklifts-dd3f1.iam.gserviceaccount.com",
    "client_id": "111494077667496751062",
    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
    "token_uri": "https://oauth2.googleapis.com/token",
    "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
    "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-1qxb0%40quicklifts-dd3f1.iam.gserviceaccount.com",
    "universe_domain": "googleapis.com"
  })
});
}

const db = admin.firestore(); 

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

async function updateOnboardingLink(userId, link, expiration) {
  const userRef = db.collection("users").doc(userId);
  await userRef.update({
    'creator.onboardingLink': link, 
    'creator.onboardingExpirationDate': expiration
  });
}

const handler = async (event) => {
  try {
    const userId = event.queryStringParameters.userId; // Get userId from query string
    if (!userId) {
      return { statusCode: 400, body: 'Missing userId' };
    }
    
    const account = await stripe.accounts.create({
      type: 'express',
      country: 'US', // Replace with appropriate country
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
    });

    const accountLink = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: "https://fitwithpulse.ai",
      return_url: `https://fitwithpulse.ai/completeOnboarding?userId=${userId}`, // Include userId as query parameter
      type: "account_onboarding",
    });

    await updateOnboardingLink(userId, accountLink.url, accountLink.expires_at); // Assuming you have the userId

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true }),
    };
  } catch (error) {
    console.error(error); // Important for debugging!
    return { statusCode: 500, body: error.message }; // Use error.message for security
  }
};

module.exports = { handler };