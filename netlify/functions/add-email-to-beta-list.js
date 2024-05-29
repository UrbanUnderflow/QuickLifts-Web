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

async function addPartnerToBeta(email) {
    console.log(`Adding partner to beta with email: ${email}`);
    const partnerRef = db.collection('beta').doc();
    await partnerRef.set({
      email,
      'isApproved': true 
    });
    console.log('Partner added to beta successfully');
  }
  
  // Handler function for Netlify
  exports.handler = async (event) => {
    try {
      console.log('Received event:', event);
      const email = event.queryStringParameters.email;
      console.log(`Extracted email: ${email}`);
      if (!email) {
        return {
          statusCode: 400,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ success: false, message: 'Missing email parameter' }),
        };
      }
      await addPartnerToBeta(email);
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: true, message: 'Partner added to beta successfully.' }),
      };
    } catch (error) {
      console.error('Error adding partner to beta:', error);
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: error.message }),
      };
    }
  };