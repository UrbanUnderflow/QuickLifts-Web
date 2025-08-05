// Debug function to check user profile data in Firestore
const { db, headers } = require('./config/firebase');

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

  // Only accept GET requests
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ success: false, error: 'Method not allowed' })
    };
  }

  try {
    const userId = event.queryStringParameters?.userId;
    console.log('Debugging user profile for userId:', userId);
    
    if (!userId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, error: 'Missing userId parameter' })
      };
    }

    // Get user document from Firestore
    const userDoc = await db.collection('users').doc(userId).get();
    
    if (!userDoc.exists) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'User not found'
        })
      };
    }

    const userData = userDoc.data();
    
    // Return detailed profile information for debugging
    const debugInfo = {
      success: true,
      userId: userId,
      profile: {
        // Basic user info
        username: userData.username || 'Not set',
        email: userData.email || 'Not set',
        
        // Creator account info
        hasCreator: !!userData.creator,
        creator: userData.creator || null,
        
        // Winner account info  
        hasWinner: !!userData.winner,
        winner: userData.winner || null,
        
        // Account status analysis
        hasCreatorStripeAccount: !!(userData.creator && userData.creator.stripeAccountId),
        hasWinnerStripeAccount: !!(userData.winner && userData.winner.stripeAccountId),
        
        creatorOnboardingStatus: userData.creator?.onboardingStatus || 'not_started',
        winnerOnboardingStatus: userData.winner?.onboardingStatus || 'not_started',
        
        // Stripe account IDs (masked for security)
        creatorStripeAccountId: userData.creator?.stripeAccountId ? 
          `acct_${userData.creator.stripeAccountId.slice(5, 10)}...` : 'Not set',
        winnerStripeAccountId: userData.winner?.stripeAccountId ? 
          `acct_${userData.winner.stripeAccountId.slice(5, 10)}...` : 'Not set'
      }
    };

    console.log('Debug info compiled:', debugInfo);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(debugInfo)
    };

  } catch (error) {
    console.error('Error debugging user profile:', error);
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