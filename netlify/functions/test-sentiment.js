exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    console.log('Test sentiment function called');
    console.log('Event:', JSON.stringify(event, null, 2));
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        message: 'Test sentiment function is working',
        timestamp: new Date().toISOString(),
        method: event.httpMethod,
        body: event.body,
        env: {
          hasHuggingFaceKey: !!process.env.HUGGING_FACE_API_KEY,
          nodeVersion: process.version
        }
      })
    };
  } catch (error) {
    console.error('Test sentiment error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: error.message,
        stack: error.stack
      })
    };
  }
};
