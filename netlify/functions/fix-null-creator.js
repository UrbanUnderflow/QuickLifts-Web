// fix-null-creator.js
// Function to fix any user with a null creator field

const { db, headers } = require('./config/firebase');

exports.handler = async (event) => {
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
    const { userId } = JSON.parse(event.body || '{}');
    
    if (!userId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          success: false, 
          error: 'Missing userId parameter' 
        })
      };
    }
    
    console.log(`[FixNullCreator] Fixing creator field for user: ${userId}`);
    
    // Check if user exists
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ success: false, error: 'User not found' })
      };
    }
    
    const userData = userDoc.data();
    
    // Only fix if creator is null
    if (userData.creator !== null) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          message: 'User already has a creator field',
          creator: userData.creator
        })
      };
    }
    
    // Initialize creator field with basic structure
    const creatorData = {
      onboardingStatus: 'notStarted',
      stripeAccountId: null,
      onboardingLink: null,
      onboardingExpirationDate: null,
      onboardingPayoutState: null,
      createdAt: new Date(),
      fixedBy: 'fix-null-creator-function'
    };
    
    // Use set with merge to initialize the creator object
    await db.collection('users').doc(userId).set({
      creator: creatorData
    }, { merge: true });
    
    console.log(`[FixNullCreator] Successfully initialized creator field for ${userId}`);
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Creator field has been initialized',
        userId,
        creatorData
      })
    };

  } catch (error) {
    console.error('[FixNullCreator] Error:', error);
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
