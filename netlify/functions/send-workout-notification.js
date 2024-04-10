const functions = require('firebase-functions');
const admin = require('firebase-admin');

// Ensure Firebase Admin SDK is initialized only once
if (admin.apps.length === 0) {
  admin.initializeApp({
    credential: admin.credential.cert({
      type: "service_account",
      project_id: "quicklifts-dd3f1",
      private_key_id: process.env.FIREBASE_PRIVATE_KEY,
      private_key: process.env.FIREBASE_SECRET_KEY.replace(/\\n/g, '\n'),
      client_email: "firebase-adminsdk-1qxb0@quicklifts-dd3f1.iam.gserviceaccount.com",
      client_id: "111494077667496751062",
      auth_uri: "https://accounts.google.com/o/oauth2/auth",
      token_uri: "https://oauth2.googleapis.com/token",
      auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
      client_x509_cert_url: "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-1qxb0%40quicklifts-dd3f1.iam.gserviceaccount.com"
    })
  });
}

const messaging = admin.messaging();

// Define the Cloud Function handler
const sendWorkoutNotificationHandler = async (req, res) => {
    const fcmToken = req.query.fcmToken;

    if (!fcmToken) {
        console.log('No FCM token provided.');
        return res.status(400).send('No FCM token provided.');
    }

    const payload = {
        notification: {
            title: 'You have a new workout!',
            body: 'A new workout has been sent to you.'
        },
        token: fcmToken,
    };

    try {
        const response = await messaging.send(payload);
        console.log('Successfully sent notification:', response);
        res.status(200).send({ success: true, message: 'Notification sent successfully.' });
    } catch (error) {
        console.error('Error sending notification:', error);
        res.status(500).send({ success: false, error: error.message });
    }
};

// Export the function
exports.sendWorkoutNotification = functions.https.onRequest(sendWorkoutNotificationHandler);


