// test-stripe-urls.js
// Simple function to test URL generation without creating accounts

const { headers } = require('./config/firebase');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, OPTIONS'
      },
      body: ''
    };
  }

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ success: false, error: 'Method not allowed' })
    };
  }

  try {
    // Test URL generation
    const baseUrl = process.env.SITE_URL || 'https://fitwithpulse.ai';
    const refreshUrl = `${baseUrl}/coach/profile`;
    const returnUrl = `${baseUrl}/coach/profile?complete=true`;
    
    console.log(`[TestStripeUrls] Testing URL generation:`, {
      baseUrl,
      refreshUrl,
      returnUrl,
      refreshUrlValid: refreshUrl.startsWith('http'),
      returnUrlValid: returnUrl.startsWith('http'),
      refreshUrlLength: refreshUrl.length,
      returnUrlLength: returnUrl.length
    });
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        urls: {
          baseUrl,
          refreshUrl,
          returnUrl,
          refreshUrlValid: refreshUrl.startsWith('http'),
          returnUrlValid: returnUrl.startsWith('http'),
          refreshUrlLength: refreshUrl.length,
          returnUrlLength: returnUrl.length
        },
        environment: {
          SITE_URL: process.env.SITE_URL,
          NODE_ENV: process.env.NODE_ENV
        }
      })
    };

  } catch (error) {
    console.error('[TestStripeUrls] Error:', error);
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
