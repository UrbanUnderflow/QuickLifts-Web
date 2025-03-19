/**
 * Environment Variable Status Check
 *
 * This function checks which environment variables are set and reports their status.
 * It doesn't try to load Firebase or any other libraries to avoid initialization errors.
 */

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle OPTIONS request for CORS
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  // Environment variables to check (doesn't show actual values for security)
  const envVarStatus = {
    // Firebase variables
    FIREBASE_SECRET_KEY: !!process.env.FIREBASE_SECRET_KEY,
    FIREBASE_PRIVATE_KEY: !!process.env.FIREBASE_PRIVATE_KEY,
    FIREBASE_PRIVATE_KEY_ALT: !!process.env.FIREBASE_PRIVATE_KEY_ALT,
    FIREBASE_SECRET_KEY_ALT: !!process.env.FIREBASE_SECRET_KEY_ALT,
    
    // Stripe variables 
    STRIPE_SECRET_KEY: !!process.env.STRIPE_SECRET_KEY,
    STRIPE_PUBLISHABLE_KEY: !!process.env.STRIPE_PUBLISHABLE_KEY,
    STRIPE_ENDPOINT_SECRET: !!process.env.STRIPE_ENDPOINT_SECRET,
    
    // Next.js public values
    NEXT_PUBLIC_FIREBASE_API_KEY: !!process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: !!process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: !!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  };

  // Count how many are missing
  const missingVars = Object.entries(envVarStatus)
    .filter(([_, isSet]) => !isSet)
    .map(([name]) => name);

  // Environment info
  const environment = {
    nodeEnv: process.env.NODE_ENV || 'not set',
    isNetlify: !!process.env.NETLIFY,
    netlifyContext: process.env.CONTEXT || 'not set', // production, deploy-preview, branch-deploy
    nodeVersion: process.version,
    functionDirectory: process.env.LAMBDA_TASK_ROOT || 'not available'
  };

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      timestamp: new Date().toISOString(),
      allVarsSet: missingVars.length === 0,
      missingVarsCount: missingVars.length,
      missingVars: missingVars.length > 0 ? missingVars : [],
      environment,
      envVarStatus
    })
  };
}; 