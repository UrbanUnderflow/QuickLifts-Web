const fetch = require('node-fetch');

// Netlify function that proxies a request from the web app to the Firebase
// callable function generateGifForExerciseVideo. This avoids browser CORS
// issues by doing the cross-origin call server-side.

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: false, message: 'Method not allowed' }),
    };
  }

  try {
    const body = event.body ? JSON.parse(event.body) : {};
    const { videoId } = body;

    if (!videoId || typeof videoId !== 'string') {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, message: 'Missing or invalid videoId' }),
      };
    }

    // URL of the Firebase callable function (production)
    const firebaseUrl = 'https://us-central1-quicklifts-dd3f1.cloudfunctions.net/generateGifForExerciseVideo';

    // Callable protocol expects { data: {...} } as the JSON body
    const firebaseResponse = await fetch(firebaseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ data: { videoId } }),
    });

    const text = await firebaseResponse.text();
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = { raw: text };
    }

    if (!firebaseResponse.ok) {
      return {
        statusCode: firebaseResponse.status,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          message: 'Firebase function returned an error response',
          status: firebaseResponse.status,
          body: parsed,
        }),
      };
    }

    // For callable, the actual payload is usually in parsed.result or parsed.data
    const payload = parsed?.result || parsed?.data || parsed;

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        ...payload,
      }),
    };
  } catch (error) {
    console.error('[Netlify] Error proxying GIF generation:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: false,
        message: 'Failed to generate GIF via proxy.',
        error: error.message || String(error),
      }),
    };
  }
};



