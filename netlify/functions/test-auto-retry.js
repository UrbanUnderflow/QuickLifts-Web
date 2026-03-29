const { admin } = require('./config/firebase');

exports.handler = async (event, context) => {
  try {
    // Call the auto-retry function
    const response = await fetch(`${process.env.URL}/.netlify/functions/auto-retry-pending-payouts`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    
    const result = await response.json();
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        success: true,
        message: 'Manual auto-retry test completed',
        result
      })
    };
    
  } catch (error) {
    console.error('[TestAutoRetry] Error:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        success: false,
        error: error.message
      })
    };
  }
};
