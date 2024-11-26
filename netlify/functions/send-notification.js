const admin = require('firebase-admin');

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

async function sendNotification(fcmToken, title, body) {
  const messaging = admin.messaging();

  const message = {
    token: fcmToken,
    notification: {
      title: title,
      body: body,
    },
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
  try {
    const { fcmToken, title, body } = event.queryStringParameters;
    
    if (!fcmToken || !title || !body) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          message: 'Missing required parameters: fcmToken, title, or body'
        })
      };
    }

    const result = await sendNotification(fcmToken, title, body);
    return {
      statusCode: 200,
      body: JSON.stringify(result)
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        success: false, 
        message: error.message 
      })
    };
  }
};