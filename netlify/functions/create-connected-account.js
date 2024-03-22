// Docs on event and context https://docs.netlify.com/functions/build/#code-your-function-2

const Stripe = require('stripe');
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

const handler = async (event) => {
  try {
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

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, accountId: accountLink }),
    };
  } catch (error) {
    console.error(error); // Important for debugging!
    return { statusCode: 500, body: error.message }; // Use error.message for security
  }
};

module.exports = { handler };