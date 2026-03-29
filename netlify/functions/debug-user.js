// Function to debug a user document directly from Firestore

const { admin } = require('./config/firebase');

const db = admin.firestore();

const handler = async (event) => {
  console.log(`Received ${event.httpMethod} request:`, {
    queryParams: event.queryStringParameters,
    body: event.body ? '(has body data)' : '(no body data)'
  });

  try {
    // Safely access userId to avoid null reference errors
    const userId = event.queryStringParameters?.userId;
    console.log('Requested userId:', userId);
    
    if (!userId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ success: false, error: 'Missing userId parameter' })
      };
    }

    // Get user document directly from Firestore
    console.log('Fetching user document from Firestore...');
    const userDoc = await db.collection('users').doc(userId).get();
    
    if (!userDoc.exists) {
      console.warn(`User document not found for userId: ${userId}`);
      return {
        statusCode: 404,
        body: JSON.stringify({
          success: false,
          error: 'User not found'
        })
      };
    }

    const userData = userDoc.data();
    console.log('User data retrieved from Firestore.');
    
    // Deep clone and carefully examine the creator property
    let creatorData = null;
    let stripeAccountId = null;
    
    if (userData.creator) {
      creatorData = userData.creator;
      console.log('Creator data found with keys:', Object.keys(creatorData));
      
      if ('stripeAccountId' in creatorData) {
        stripeAccountId = creatorData.stripeAccountId;
        console.log('stripeAccountId found:', stripeAccountId);
        console.log('stripeAccountId type:', typeof stripeAccountId);
      } else {
        console.log('No stripeAccountId key in creator data');
      }
      
      // Check each property of the creator object
      console.log('Creator object properties:');
      for (const [key, value] of Object.entries(creatorData)) {
        console.log(`- ${key}: ${value} (${typeof value})`);
      }
    } else {
      console.log('No creator data found in user document');
    }
    
    // Return a cleaned version of the data
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        userData: {
          id: userId,
          hasCreator: !!userData.creator,
          creatorData: userData.creator ? {
            onboardingStatus: userData.creator.onboardingStatus || null,
            stripeAccountId: stripeAccountId,
            stripeAccountIdExists: 'stripeAccountId' in (userData.creator || {})
          } : null
        },
        rawCreator: userData.creator || null
      })
    };
  } catch (error) {
    console.error('Error debugging user:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error.message || 'Internal server error'
      })
    };
  }
};

module.exports = { handler }; 
