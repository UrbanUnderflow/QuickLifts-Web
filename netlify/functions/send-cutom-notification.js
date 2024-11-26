exports.handler = async (event) => {
  // Return a test response with any received parameters
  return {
    statusCode: 200,
    body: JSON.stringify({
      message: "Notification function reached successfully!",
      receivedMethod: event.httpMethod,
      receivedParams: event.queryStringParameters || {},
      receivedBody: event.body ? JSON.parse(event.body) : null,
      timestamp: new Date().toISOString()
    })
  };
};