/**
 * Environment Status Check
 * 
 * A simple function to check if required environment variables are set.
 * This function has no external dependencies and should work even if Firebase initialization fails.
 */

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  // Check for required environment variables
  const envVars = {
    // Firebase variables
    FIREBASE_SECRET_KEY: !!process.env.FIREBASE_SECRET_KEY,
    FIREBASE_PRIVATE_KEY: !!process.env.FIREBASE_PRIVATE_KEY,
    FIREBASE_SECRET_KEY_ALT: !!process.env.FIREBASE_SECRET_KEY_ALT,
    
    // Stripe variables
    STRIPE_SECRET_KEY: !!process.env.STRIPE_SECRET_KEY,
    STRIPE_PUBLISHABLE_KEY: !!process.env.STRIPE_PUBLISHABLE_KEY,
    STRIPE_ENDPOINT_SECRET: !!process.env.STRIPE_ENDPOINT_SECRET,
    
    // Node environment
    NODE_ENV: process.env.NODE_ENV || 'not set'
  };

  // Detect environment (Netlify, local dev, etc.)
  const environment = process.env.NETLIFY ? 'Netlify' : 
                     (process.env.NODE_ENV === 'development' ? 'Local Development' : 'Unknown');

  // Check if we're running on Netlify
  const isNetlify = !!process.env.NETLIFY;

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      timestamp: new Date().toISOString(),
      environment,
      isNetlify,
      envVars,
      nodeVersion: process.version
    })
  };
}; 