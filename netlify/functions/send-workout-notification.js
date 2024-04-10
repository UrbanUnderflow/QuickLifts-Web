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
async function sendWorkoutNotification(fcmToken) {
  const payload = {
    notification: {
      title: 'You have a new workout!',
      body: 'A new workout has been sent to you.'
    }
  };

  try {
    const response = await messaging.sendToDevice(fcmToken, payload);
    console.log('Successfully sent notification:', response);
    return { success: true, message: 'Notification sent successfully.' };
  } catch (error) {
    console.error('Error sending notification:', error);
    throw error; // Rethrow the error to be caught by the calling function
  }
}

// Cloud Function to handle HTTP request
exports.sendNotification = functions.https.onRequest(async (req, res) => {
  try {
    const fcmToken = req.query.fcmToken;
    if (!fcmToken) {
      return res.status(400).send('Missing FCM token.');
    }

    const result = await sendWorkoutNotification(fcmToken);
    res.status(200).send(result);
  } catch (error) {
    res.status(500).send({ success: false, message: error.message });
  }
});

