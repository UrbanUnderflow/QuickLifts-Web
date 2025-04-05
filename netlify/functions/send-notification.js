const { db, admin } = require('./config/firebase');

async function sendNotification(fcmToken, title, body, customData = {}) {
  const messaging = admin.messaging();

  const message = {
    token: fcmToken,
    notification: {
      title: title,
      body: body,
    },
    data: customData,
    apns: {
      payload: {
        aps: {
          alert: {
            title: title,
            body: body,
          },
          badge: 1,
        },
      },
    },
  };

  try {
    const response = await messaging.send(message);
    console.log('Successfully sent notification:', response);
    return { success: true, message: 'Notification sent successfully.' };
  } catch (error) {
    console.error('Error sending notification:', error);
    throw error;
  }
}

exports.handler = async (event) => {
  // Set CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  try {
    // For POST requests, parse the body
    const body = JSON.parse(event.body);
    console.log('Received request body:', body); // Debug log

    const { fcmToken, payload } = body;
    
    if (!fcmToken || !payload?.notification?.title || !payload?.notification?.body) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Missing required parameters: fcmToken, title, or body'
        })
      };
    }

    const result = await sendNotification(
      fcmToken, 
      payload.notification.title, 
      payload.notification.body,
      payload.data || {}
    );

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(result)
    };
  } catch (error) {
    console.error('Error processing request:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        success: false, 
        message: error.message 
      })
    };
  }
};