const admin = require('firebase-admin');

if (admin.apps.length === 0) {
  admin.initializeApp({
    credential: admin.credential.cert({
      // Your service account details
      "type": "service_account",
      "project_id": "your-project-id",
      "private_key_id": process.env.FIREBASE_PRIVATE_KEY,
      "private_key": process.env.FIREBASE_SECRET_KEY.replace(/\\n/g, '\n'),
      "client_email": "your-firebase-adminsdk-email",
      "client_id": "your-client-id",
      "auth_uri": "https://accounts.google.com/o/oauth2/auth",
      "token_uri": "https://oauth2.googleapis.com/token",
      "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
      "client_x509_cert_url": "your-cert-url"
    })
  });
}

const db = admin.firestore();

const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const data = JSON.parse(event.body);
    const email = data.email;

    const docRef = db.collection('contacts').doc(); // Create a new document
    await docRef.set({ email });

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true })
    };
  } catch (error) {
    console.error('Error saving contact:', error);
    return { statusCode: 500, body: JSON.stringify({ error: 'Failed to save contact' }) };
  }
};

module.exports = { handler };
