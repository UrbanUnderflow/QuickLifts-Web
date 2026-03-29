/**
 * Environment Variable Status Check
 *
 * This function checks which environment variables are set and reports their status.
 * It doesn't try to load Firebase or any other libraries to avoid initialization errors.
 */

const { resolveFirebaseAdminCredential } = require('../../src/lib/server/firebase/credential-source');

const handler = async (event) => {
  try {
    const isLocalhost = event.headers.referer?.includes('localhost') || event.headers.origin?.includes('localhost');
    const prodCredential = resolveFirebaseAdminCredential({ mode: 'prod' });
    const devCredential = resolveFirebaseAdminCredential({ mode: 'dev' });
    
    // Check environment variables
    const results = {
      environment: isLocalhost ? 'development' : 'production',
      timestamp: new Date().toISOString(),
      firebaseAdmin: {
        production: {
          source: prodCredential.source,
          projectId: prodCredential.projectId || 'Not set',
          clientEmail: prodCredential.clientEmail ? `${prodCredential.clientEmail.substring(0, 5)}...` : 'Not set',
        },
        development: {
          source: devCredential.source,
          projectId: devCredential.projectId || 'Not set',
          clientEmail: devCredential.clientEmail ? `${devCredential.clientEmail.substring(0, 5)}...` : 'Not set',
        },
      },
      stripe: {
        liveKeyPresent: !!process.env.STRIPE_SECRET_KEY,
        testKeyPresent: !!process.env.STRIPE_TEST_SECRET_KEY
      }
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
