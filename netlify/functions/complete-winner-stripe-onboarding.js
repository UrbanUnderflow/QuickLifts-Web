// FILE: netlify/functions/complete-winner-stripe-onboarding.js
// Function to complete winner Stripe onboarding

const { db, admin } = require('./config/firebase');

async function updateWinnerOnboardingStatus(userId) {
  try {
    console.log(`[CompleteWinnerOnboarding] Updating onboarding status for user: ${userId}`);
    
    // Update the user's winner onboarding status
    await db.collection('users').doc(userId).update({
      'winner.onboardingStatus': 'complete',
      'winner.updatedAt': admin.firestore.FieldValue.serverTimestamp()
    });
    
    console.log(`[CompleteWinnerOnboarding] Successfully updated winner onboarding status for user: ${userId}`);
    return true;
  } catch (error) {
    console.error(`[CompleteWinnerOnboarding] Error updating winner onboarding status for user ${userId}:`, error);
    return false;
  }
}

exports.handler = async function(event, context) {
  // Handle both GET and POST requests for flexibility
  if (event.httpMethod !== 'GET' && event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST'
      },
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    // Extract userId from query params (GET) or body (POST)
    let userId;
    if (event.httpMethod === 'GET') {
      userId = event.queryStringParameters?.userId;
    } else {
      const body = JSON.parse(event.body || '{}');
      userId = body.userId;
    }

    if (!userId) {
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type'
        },
        body: JSON.stringify({
          success: false,
          error: 'userId is required'
        })
      };
    }

    console.log(`[CompleteWinnerOnboarding] Processing completion for user: ${userId}`);

    const success = await updateWinnerOnboardingStatus(userId);

    if (success) {
      return {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type'
        },
        body: JSON.stringify({
          success: true,
          message: 'Winner onboarding status updated successfully',
          userId: userId,
          timestamp: new Date().toISOString()
        })
      };
    } else {
      return {
        statusCode: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type'
        },
        body: JSON.stringify({
          success: false,
          error: 'Failed to update onboarding status',
          userId: userId,
          timestamp: new Date().toISOString()
        })
      };
    }

  } catch (error) {
    console.error('[CompleteWinnerOnboarding] Function error:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type'
      },
      body: JSON.stringify({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      })
    };
  }
}; 