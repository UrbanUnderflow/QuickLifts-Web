const admin = require('firebase-admin');

// Ensure Firebase Admin SDK is initialized only once
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
      client_x509_cert_url: "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-1qxb0%40quicklifts-dd3f1.iam.gserviceaccount.com"
    })
  });
}

// Define the Cloud Function handler
async function sendWorkoutNotification(fcmToken) {
  const messaging = admin.messaging();

  const message = {
    token: fcmToken,
    notification: {
      title: 'You have a new workout!',
      body: 'A new workout has been sent to you.',
    },
    apns: {
      payload: {
        aps: {
          alert: {
            title: 'You have a new workout!',
            body: 'A new workout has been sent to you.',
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
exports.handler = async (event, context) => {
  try {
    const fcmToken = event.queryStringParameters.fcmToken;
    if (!fcmToken) {
      return {
        statusCode: 400,
        body: 'Missing FCM token.'
      };
    }

    print(context)

    const result = await sendWorkoutNotification(fcmToken);
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

