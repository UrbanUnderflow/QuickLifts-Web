// Function to reset a user's Stripe onboarding status for testing

const { admin } = require('./config/firebase');

const db = admin.firestore();

const handler = async (event) => {
  console.log(`Received ${event.httpMethod} request:`, {
    queryParams: event.queryStringParameters,
    body: event.body ? '(has body data)' : '(no body data)'
  });

  try {
    const userId = event.queryStringParameters?.userId;
    console.log('Requested userId for reset:', userId);
    
    if (!userId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ success: false, error: 'Missing userId parameter' })
      };
    }

    // Get user document from Firestore to verify it exists
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
    console.log('Current creator status:', userData.creator);
    
    // Reset the creator fields - use set with merge to handle null creator
    await db.collection('users').doc(userId).set({
      creator: {
        onboardingStatus: 'notStarted'
        // Omitting fields effectively removes them when using set with merge
      }
    }, { merge: true });
    
    console.log('Reset onboarding status to notStarted and removed Stripe fields');

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: 'Onboarding status has been reset'
      })
    };
  } catch (error) {
    console.error('Error resetting onboarding status:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error.message
      })
    };
  }
};

module.exports = { handler }; 
