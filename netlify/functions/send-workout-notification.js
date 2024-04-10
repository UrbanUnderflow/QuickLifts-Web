const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp({
  credential: admin.credential.cert({
    "type": "service_account",
    "project_id": "quicklifts-dd3f1",
    "private_key_id": process.env.FIREBASE_PRIVATE_KEY,
    "private_key": process.env.FIREBASE_SECRET_KEY.replace(/\\n/g, '\n'),
    "client_email": "firebase-adminsdk-1qxb0@quicklifts-dd3f1.iam.gserviceaccount.com",
    "client_id": "111494077667496751062",
    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
    "token_uri": "https://oauth2.googleapis.com/token",
    "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
    "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-1qxb0%40quicklifts-dd3f1.iam.gserviceaccount.com",
    "universe_domain": "googleapis.com"
  })
});

// Initialize Cloud Messaging
const messaging = admin.messaging();

exports.sendWorkoutNotification = functions.https.onRequest(async (req, res) => {
    // Extract the FCM token from the query string
    const fcmToken = req.query.fcmToken;

    if (!fcmToken) {
        console.log('No FCM token provided.');
        return res.status(400).send('No FCM token provided.');
    }

    // Define the notification payload
    const payload = {
        notification: {
            title: 'You have a new workout!',
            body: 'A new workout has been sent to you.',
            // Optionally, add other properties like icon, click_action, etc.
        },
        token: fcmToken,
    };

    try {
        // Send the notification using the provided FCM token
        const response = await messaging.send(payload);
        console.log('Successfully sent notification:', response);
        return res.status(200).send({ success: true, message: 'Notification sent successfully.' });
    } catch (error) {
        console.error('Error sending notification:', error);
        return res.status(500).send({ success: false, error: error.message });
    }
});

