/**
 * Environment Variable Status Check
 *
 * This function checks which environment variables are set and reports their status.
 * It doesn't try to load Firebase or any other libraries to avoid initialization errors.
 */

const handler = async (event) => {
  try {
    const isLocalhost = event.headers.referer?.includes('localhost') || event.headers.origin?.includes('localhost');
    
    // Define required environment variables
    const requiredVars = {
      common: [
        'FIREBASE_SECRET_KEY',
        'FIREBASE_PRIVATE_KEY',
        'STRIPE_SECRET_KEY',
        'STRIPE_TEST_SECRET_KEY',
      ],
      production: [
        'FIREBASE_PROJECT_ID',
        'FIREBASE_CLIENT_EMAIL',
      ],
      development: [
        'DEV_FIREBASE_PROJECT_ID',
        'DEV_FIREBASE_CLIENT_EMAIL',
      ]
    };
    
    // Check environment variables
    const results = {
      environment: isLocalhost ? 'development' : 'production',
      timestamp: new Date().toISOString(),
      variables: {}
    };
    
    // Check common variables
    requiredVars.common.forEach(varName => {
      results.variables[varName] = process.env[varName] ? 'PRESENT' : 'MISSING';
    });
    
    // Check environment-specific variables
    const envVars = isLocalhost ? requiredVars.development : requiredVars.production;
    envVars.forEach(varName => {
      results.variables[varName] = process.env[varName] ? 'PRESENT' : 'MISSING';
    });
    
    // Add Firebase project details
    if (isLocalhost) {
      results.firebaseProject = {
        id: process.env.DEV_FIREBASE_PROJECT_ID || 'Not set',
        clientEmail: process.env.DEV_FIREBASE_CLIENT_EMAIL 
          ? process.env.DEV_FIREBASE_CLIENT_EMAIL.substring(0, 5) + '...' 
          : 'Not set'
      };
    } else {
      results.firebaseProject = {
        id: process.env.FIREBASE_PROJECT_ID || 'Not set',
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL 
          ? process.env.FIREBASE_CLIENT_EMAIL.substring(0, 5) + '...' 
          : 'Not set'
      };
    }
    
    // Add Stripe details (don't expose keys)
    results.stripe = {
      liveKeyPresent: !!process.env.STRIPE_SECRET_KEY,
      testKeyPresent: !!process.env.STRIPE_TEST_SECRET_KEY
    };
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: true,
        message: 'Environment check completed',
        data: results
      })
    };
  } catch (error) {
    console.error('[check-env] Error:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: false,
        message: 'Error checking environment variables',
        error: error.message
      })
    };
  }
};

module.exports = { handler }; 