const admin = require('firebase-admin');

// Ensure Firebase Admin SDK is initialized only once
if (admin.apps.length === 0) {
  admin.initializeApp({
    credential: admin.credential.cert({
      type: "service_account",
      project_id: "your-project-id", // Replace with your Firebase project ID
      private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
      private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      client_email: "your-firebase-adminsdk-email@your-project-id.iam.gserviceaccount.com",
      client_id: "your-client-id",
      auth_uri: "https://accounts.google.com/o/oauth2/auth",
      token_uri: "https://oauth2.googleapis.com/token",
      auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
      client_x509_cert_url: "your-x509-cert-url"
    })
  });
}

// Cloud Function to handle HTTP request
exports.sendCustomNotification = async (req, res) => {
  const { fcmToken, title, body } = req.body;

  if (!fcmToken || !title || !body) {
    return res.status(400).send('Missing required notification parameters.');
  }

  const message = {
    token: fcmToken,
    notification: {
      title: title,
      body: body,
    },
    // Additional FCM options can be added here
  };

  try {
    const messaging = admin.messaging();
    const response = await messaging.send(message);
    console.log('Successfully sent notification:', response);
    res.status(200).send({ success: true, message: 'Notification sent successfully.' });
  } catch (error) {
    console.error('Error sending notification:', error);
    res.status(500).send({ success: false, message: error.message });
  }
};
