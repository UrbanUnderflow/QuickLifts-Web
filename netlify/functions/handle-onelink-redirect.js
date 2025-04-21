const headers = {
  'Access-Control-Allow-Origin': '*', // Or restrict to specific origins if needed
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS' // Only GET and OPTIONS needed for this redirect
};

exports.handler = async function(event, context) {
  // Handle OPTIONS preflight request for CORS
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  // Only allow GET requests for the actual redirect
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405, // Method Not Allowed
      headers,
      body: JSON.stringify({ success: false, error: 'Method Not Allowed' })
    };
  }

  console.log("Handling OneLink redirect. Query params:", event.queryStringParameters);

  // --- Parameter Extraction (CRITICAL - Requires Testing/Verification) ---
  // You MUST test a real OneLink fallback redirect to confirm EXACTLY how AppsFlyer passes the parameters.
  // They might be passed directly as query parameters (as assumed below),
  // nested under standard AppsFlyer params like 'af_sub1', 'af_sub2', etc.,
  // or potentially under a key like 'deep_link_sub1'.
  // Adjust the parsing logic below based on your test results.
  const queryParams = event.queryStringParameters || {};

  // Attempt to get parameters (ADJUST KEYS BASED ON TESTING)
  const roundId = queryParams.roundId;       // Example: Or queryParams.deep_link_sub1 or queryParams.af_sub1
  const originalHostId = queryParams.id;     // Example: Or queryParams.deep_link_sub2 or queryParams.af_sub2
  const sharedById = queryParams.sharedBy;   // Example: Or queryParams.deep_link_sub3 or queryParams.af_sub3

  // --- Build Target URL ---
  const baseTargetUrl = 'https://fitwithpulse.ai/round-invitation/';
  let finalTargetUrl = 'https://fitwithpulse.ai/download-app/'; // Default fallback if roundId is missing

  if (roundId) {
    finalTargetUrl = `${baseTargetUrl}${roundId}`;
    const targetQueryParams = new URLSearchParams();

    // Append other relevant query parameters intended for your web page
    if (originalHostId) {
        targetQueryParams.append('id', originalHostId);
    }
    if (sharedById) {
        targetQueryParams.append('sharedBy', sharedById);
    }
    // Add any other parameters you need on the final web page
    // Example: targetQueryParams.append('utm_source', 'onelink_fallback');

    if (targetQueryParams.toString()) {
        finalTargetUrl += `?${targetQueryParams.toString()}`;
    }
    console.log(`Constructed target URL: ${finalTargetUrl}`);

  } else {
    console.log(`Missing roundId, redirecting to generic fallback URL: ${finalTargetUrl}`);
  }


  // --- Issue Redirect ---
  return {
    statusCode: 302, // Temporary Redirect
    headers: {
      ...headers, // Include CORS headers in the redirect response too
      'Location': finalTargetUrl,
      'Cache-Control': 'no-cache' // Prevent caching of the redirect itself
    },
    body: '' // Body is ignored by browsers on 302 redirects
  };
}; 