// Import necessary modules
const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
if (admin.apps.length === 0) {
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
    }),
  });
}

const db = admin.firestore();

async function addEmailToMailingList(email) {
  const emailRef = db.collection("mailingList").doc();
  await emailRef.set({ email });
}

// Handler function for Netlify
exports.handler = async (event) => {
  try {
    const email = event.queryStringParameters.email; // Get email from query string
    if (!email) {
      return { statusCode: 400, body: JSON.stringify({ success: false, message: "Missing email parameter" }) };
    }

    await addEmailToMailingList(email); // Add email to Firestore

    // Return a success response
    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, message: "Email added to mailing list successfully." })
    };
  } catch (error) {
    console.error(error); // Logging the error for debugging purposes
    return { statusCode: 500, body: JSON.stringify({ success: false, error: error.message }) };
  }
};
