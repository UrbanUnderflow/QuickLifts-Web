// Function to get recent payment intents from Stripe
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Content-Type': 'application/json'
};

const handler = async (event) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, OPTIONS'
      },
      body: ''
    };
  }

  // Only accept GET requests
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ success: false, error: 'Method not allowed' })
    };
  }

  try {
    // Get recent payment intents
    const paymentIntents = await stripe.paymentIntents.list({
      limit: 10,
      expand: ['data.latest_charge']
    });

    const recentPayments = paymentIntents.data.map(pi => ({
      id: pi.id,
      amount: pi.amount,
      currency: pi.currency,
      status: pi.status,
      created: new Date(pi.created * 1000).toISOString(),
      metadata: pi.metadata,
      description: pi.description,
      payment_method_types: pi.payment_method_types
    }));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        paymentIntents: recentPayments
      })
    };

  } catch (error) {
    console.error('[GetRecentPaymentIntents] Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error.message || 'Internal server error'
      })
    };
  }
};

module.exports = { handler };
