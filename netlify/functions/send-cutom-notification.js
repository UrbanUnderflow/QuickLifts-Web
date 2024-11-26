const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
if (admin.apps.length === 0) {
  admin.initializeApp({
    credential: admin.credential.cert({
      type: "service_account",
      project_id: "quicklifts-dd3f1",
      private_key_id: process.env.FIREBASE_PRIVATE_KEY_ALT,
      private_key: process.env.FIREBASE_SECRET_KEY_ALT.replace(/\\n/g, '\n'),
      client_email: "firebase-adminsdk-1qxb0@quicklifts-dd3f1.iam.gserviceaccount.com",
      client_id: "111494077667496751062",
      auth_uri: "https://accounts.google.com/o/oauth2/auth",
      token_uri: "https://oauth2.googleapis.com/token",
      auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
      client_x509_cert_url: "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-1qxb0@quicklifts-dd3f1.iam.gserviceaccount.com"
    })
  });
}

exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ message: 'OK' })
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ 
        success: false, 
        message: 'Method not allowed'
      })
    };
  }

  try {
    console.log('Request body:', event.body); // Debug log
    const { fcmToken, payload } = JSON.parse(event.body || '{}');

    if (!fcmToken || !payload) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Missing required parameters: fcmToken or payload',
          received: { fcmToken, payload }
        })
      };
    }

    const message = {
      token: fcmToken,
      notification: payload.notification,
      data: payload.data,
      apns: {
        payload: {
          aps: {
            alert: {
              title: payload.notification.title,
              body: payload.notification.body,
            },
            badge: 1,
          },
        },
      },
    };

    const response = await admin.messaging().send(message);
    console.log('Successfully sent notification:', response);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Notification sent successfully',
        messageId: response
      })
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        message: error.message || 'Internal server error'
      })
    };
  }
};