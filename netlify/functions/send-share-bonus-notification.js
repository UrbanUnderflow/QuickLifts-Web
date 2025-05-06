// Notification function for sending share bonus notifications
const { admin, db, headers } = require('./config/firebase');

exports.handler = async (event, context) => {
  // Handle preflight OPTIONS request
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers,
      body: ""
    };
  }

  // Only allow POST
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: "Method not allowed" })
    };
  }

  try {
    // Parse request body
    const requestBody = JSON.parse(event.body);
    const { token, title, body, points } = requestBody;

    if (!token || !title || !body) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: "Missing required fields: token, title, and body are required"
        })
      };
    }

    // Access Firebase messaging
    const messaging = admin.messaging();

    // Create the notification message with custom data
    const message = {
      token: token,
      notification: {
        title: title,
        body: body,
      },
      data: {
        type: 'SHARE_BONUS',
        points: String(points || 5),
        timestamp: String(Math.floor(Date.now() / 1000))
      },
      apns: {
        payload: {
          aps: {
            alert: {
              title: title,
              body: body,
            },
            badge: 1,
            sound: 'default'
          },
        },
      },
      android: {
        priority: 'high',
        notification: {
          sound: 'default'
        }
      }
    };

    // Send the notification
    const response = await messaging.send(message);
    console.log('Successfully sent share bonus notification:', response);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        messageId: response
      })
    };

  } catch (error) {
    console.error('Error sending share bonus notification:', error);
    
    // Handle FCM token errors specifically for better client response
    if (error.code === 'messaging/registration-token-not-registered') {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'The provided registration token is invalid or not registered',
          code: error.code
        })
      };
    }

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error.message || 'Unknown server error',
        code: error.code || 'unknown'
      })
    };
  }
}; 