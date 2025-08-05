// fix-stripe-account-id.js
// Manual function to update a user's stripeAccountId to the correct account

const { db, headers } = require('./config/firebase');

exports.handler = async function(event, context) {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: ''
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ success: false, error: 'Method not allowed' })
    };
  }

  try {
    const { userId, newStripeAccountId } = JSON.parse(event.body);

    if (!userId || !newStripeAccountId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          success: false, 
          error: 'Missing userId or newStripeAccountId' 
        })
      };
    }

    console.log(`[ManualFix] Updating user ${userId} with new stripeAccountId: ${newStripeAccountId}`);

    // Get current user data
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ success: false, error: 'User not found' })
      };
    }

    const userData = userDoc.data();
    const oldStripeAccountId = userData.creator?.stripeAccountId;

    // Update the stripeAccountId
    await db.collection("users").doc(userId).update({
      'creator.stripeAccountId': newStripeAccountId,
      'creator.onboardingStatus': 'complete',
      'creator.onboardingCompletedAt': new Date(),
      'creator.manuallyFixed': new Date(),
      'creator.lastLinked': new Date(),
      'creator.previousStripeAccountId': oldStripeAccountId // Keep track of the old one
    });

    console.log(`[ManualFix] SUCCESS: Updated user ${userId} from ${oldStripeAccountId} to ${newStripeAccountId}`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Stripe account ID updated successfully',
        userId,
        oldStripeAccountId,
        newStripeAccountId,
        timestamp: new Date().toISOString()
      })
    };

  } catch (error) {
    console.error('[ManualFix] Error updating stripe account ID:', error);
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