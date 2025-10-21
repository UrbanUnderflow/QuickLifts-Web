// force-account-update.js
// Emergency function to force update a user's stripeAccountId

const { db, headers } = require('./config/firebase');

exports.handler = async function(event, context) {
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

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ success: false, error: 'Method not allowed' })
    };
  }

  try {
    const userId = event.queryStringParameters?.userId;
    const newAccountId = event.queryStringParameters?.accountId;

    if (!userId || !newAccountId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          success: false, 
          error: 'Missing userId or accountId parameters' 
        })
      };
    }

    console.log(`[ForceUpdate] Updating user ${userId} to account ${newAccountId}`);

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
    const oldAccountId = userData.creator?.stripeAccountId;

    // Force update the stripeAccountId - use set with merge to handle null creator
    await db.collection("users").doc(userId).set({
      creator: {
        stripeAccountId: newAccountId,
        onboardingStatus: 'complete',
        onboardingCompletedAt: new Date(),
        forceUpdated: new Date(),
        lastLinked: new Date(),
        previousAccountId: oldAccountId
      }
    }, { merge: true });

    console.log(`[ForceUpdate] SUCCESS: Updated ${userId} from ${oldAccountId} to ${newAccountId}`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Account forcefully updated',
        userId,
        oldAccountId,
        newAccountId,
        timestamp: new Date().toISOString()
      })
    };

  } catch (error) {
    console.error('[ForceUpdate] Error:', error);
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