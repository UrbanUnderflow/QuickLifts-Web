// Import necessary modules
const { db, admin } = require('./config/firebase');

async function updateOnboardingStatus(userId) {
  // Skip DB update in development without Firebase credentials
  if (!process.env.FIREBASE_SECRET_KEY) {
    console.warn('Running in development mode without Firebase credentials - skipping DB update');
    return;
  }
  
  try {
    const userRef = db.collection("users").doc(userId);
    await userRef.update({
      'creator.onboardingStatus': 'complete', 
    });
    console.log(`Updated onboarding status to complete for user ${userId}`);
    return true;
  } catch (error) {
    console.error(`Error updating onboarding status for user ${userId}:`, error);
    return false;
  }
}

exports.handler = async function(event, context) {
  console.log(`Received ${event.httpMethod} request:`, {
    queryParams: event.queryStringParameters,
    body: event.body ? '(has body data)' : '(no body data)'
  });
  
  // Accept both GET and POST requests for flexibility
  try {
    // Safely access userId to avoid null reference errors
    const userId = event.queryStringParameters?.userId;
    console.log('Extracted userId:', userId);
    
    if (!userId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ success: false, error: 'Missing userId parameter' })
      };
    }
    
    // In development without Firebase creds, just return success
    if (!process.env.FIREBASE_SECRET_KEY) {
      return {
        statusCode: 200,
        body: JSON.stringify({ 
          success: true,
          message: 'Development mode: Simulated successful onboarding completion' 
        })
      };
    }
    
    const success = await updateOnboardingStatus(userId);
    
    if (success) {
      return {
        statusCode: 200,
        body: JSON.stringify({ 
          success: true,
          message: 'Onboarding status updated to complete' 
        })
      };
    } else {
      return {
        statusCode: 500,
        body: JSON.stringify({ 
          success: false,
          error: 'Failed to update onboarding status' 
        })
      };
    }
  } catch (error) {
    console.error('Error handling onboarding completion:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error.message || 'Internal server error'
      })
    };
  }
};