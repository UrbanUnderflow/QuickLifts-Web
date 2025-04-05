const { db, admin } = require('./config/firebase');

// Define the notification sender function
async function sendCustomNotification(fcmToken, title, body, customData) {
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

// Cloud Function to handle HTTP request
exports.handler = async (event) => {
  try {
    const { fcmToken, title, body, data } = JSON.parse(event.body || '{}');
    
    if (!fcmToken) {
      return {
        statusCode: 400,
        body: JSON.stringify({ success: false, message: 'Missing FCM token.' })
      };
    }

    if (!title || !body) {
      return {
        statusCode: 400,
        body: JSON.stringify({ success: false, message: 'Missing notification title or body.' })
      };
    }

    const result = await sendCustomNotification(fcmToken, title, body, data || {});
    return {
      statusCode: 200,
      body: JSON.stringify(result)
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, message: error.message })
    };
  }
};