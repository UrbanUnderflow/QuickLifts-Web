const Stripe = require('stripe');
const { db, headers } = require('./config/firebase');

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

const handler = async (event) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
      },
      body: ''
    };
  }

  try {
    const { userId } = event.queryStringParameters || {};
    
    if (!userId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, error: 'Missing userId parameter' })
      };
    }

    // Get user data
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ success: false, error: 'User not found' })
      };
    }

    const userData = userDoc.data();
    const connectedAccountId = userData.creator?.stripeAccountId;

    if (!connectedAccountId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, error: 'No connected Stripe account found' })
      };
    }

    console.log(`[SyncPendingPayouts] Syncing payouts for account: ${connectedAccountId}`);

    // Get recent payouts from Stripe (last 7 days)
    const recentPayouts = await stripe.payouts.list({
      stripeAccount: connectedAccountId,
      limit: 20,
      created: {
        gte: Math.floor(Date.now() / 1000) - (7 * 24 * 60 * 60) // Last 7 days
      }
    });

    console.log(`[SyncPendingPayouts] Found ${recentPayouts.data.length} recent payouts`);

    // Calculate pending payout amounts
    let totalPendingAmount = 0;
    const pendingPayouts = [];

    for (const payout of recentPayouts.data) {
      if (payout.status === 'pending' || payout.status === 'in_transit') {
        const amount = payout.amount / 100; // Convert from cents
        totalPendingAmount += amount;
        pendingPayouts.push({
          id: payout.id,
          amount,
          status: payout.status,
          arrival_date: payout.arrival_date,
          created: payout.created,
          method: payout.method,
          description: payout.description
        });
      }
    }

    console.log(`[SyncPendingPayouts] Total pending amount: $${totalPendingAmount}`);

    // Store/update pending payout info in user record for dashboard display
    if (totalPendingAmount > 0) {
      // Use set with merge to handle null creator objects
      await db.collection('users').doc(userId).set({
        creator: {
          pendingPayouts: {
            totalAmount: totalPendingAmount,
            payouts: pendingPayouts,
            lastUpdated: new Date()
          }
        }
      }, { merge: true });
    } else {
      // Clear pending payouts if none found - use set with merge
      await db.collection('users').doc(userId).set({
        creator: {
          pendingPayouts: null
        }
      }, { merge: true });
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        pendingAmount: totalPendingAmount,
        pendingPayouts,
        message: totalPendingAmount > 0 
          ? `Found $${totalPendingAmount.toFixed(2)} in pending payouts`
          : 'No pending payouts found'
      })
    };

  } catch (error) {
    console.error('[SyncPendingPayouts] Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error.message
      })
    };
  }
};

module.exports = { handler };
