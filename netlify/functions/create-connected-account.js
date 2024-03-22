// Docs on event and context https://docs.netlify.com/functions/build/#code-your-function-2

const Stripe = require('stripe');
const admin = require('firebase-admin'); // Install this 

var serviceAccount = require("./serviceAccountKey.json");

// Initialize Firebase (replace with your project's config)
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore(); 

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

async function updateOnboardingLink(userId, link, expiration) {
  const userRef = db.collection("users").document(userId);
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
      refresh_url: "https://your-website.com/reauth",
      return_url: "https://your-website.com/dashboard",
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