const Stripe = require('stripe');
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

exports.handler = async function (event, context) {
  // You might want to retrieve the user's information from an authenticated request
  const email = event.body.email; 

  try {
    const account = await stripe.accounts.create({
      type: 'express',
      country: 'US', // Replace with appropriate country
      email: email,
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, accountId: account.id }),
    };
  } catch (error) {
    console.error(error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};