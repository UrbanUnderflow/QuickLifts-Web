// Import necessary modules
const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
if (admin.apps.length === 0) { // Prevents reinitializing the app
  admin.initializeApp({
    credential: admin.credential.cert({
      "type": "service_account",
      "project_id": "quicklifts-dd3f1",
      "private_key_id": "a1032bd2be2a80a8121fb438108cd88ac8ab838f",
      "private_key": process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      "client_email": "firebase-adminsdk-1qxb0@quicklifts-dd3f1.iam.gserviceaccount.com",
      "client_id": "111494077667496751062",
      "auth_uri": "https://accounts.google.com/o/oauth2/auth",
      "token_uri": "https://oauth2.googleapis.com/token",
      "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
      "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-1qxb0%40quicklifts-dd3f1.iam.gserviceaccount.com",
      "universe_domain": "googleapis.com"
    })
  });
}

const db = admin.firestore();

// Handler function for Netlify
exports.handler = async (event) => {
  // Check for HTTP method
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    // Parse userId from the request body
    const { userId } = JSON.parse(event.body);
    if (!userId) {
      return { statusCode: 400, body: 'Missing userId' };
    }

    // Update the user document in Firestore
    const userRef = db.collection("users").doc(userId);
    await userRef.update({
      'creator.isOnBoardingCompleteForPayout': true
    });

    // Return a success response
    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, message: "Onboarding completion updated successfully." })
    };
  } catch (error) {
    console.error(error); // Logging the error for debugging purposes
    return { statusCode: 500, body: JSON.stringify({ success: false, error: error.message }) };
  }
};