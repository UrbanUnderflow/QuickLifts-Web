// Function to create a test payment record in Firestore for testing

const admin = require('firebase-admin');

// Initialize Firebase Admin if not already initialized
if (admin.apps.length === 0) {
  try {
    // Check if we have the required environment variables
    if (!process.env.FIREBASE_SECRET_KEY_ALT) {
      console.warn('FIREBASE_SECRET_KEY_ALT environment variable is missing. Using dummy mode.');
      // In development, we'll just initialize with a placeholder
      admin.initializeApp({
        projectId: "quicklifts-dd3f1"
      });
    } else {
      // Initialize with the actual credentials
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
          "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-1qxb0@quicklifts-dd3f1.iam.gserviceaccount.com"
        })
      });
    }
    console.log('Firebase Admin initialized successfully');
  } catch (error) {
    console.error('Error initializing Firebase Admin:', error);
  }
}

const db = admin.firestore();

const handler = async (event) => {
  // Only accept POST requests for safety
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ success: false, error: 'Method not allowed' })
    };
  }

  try {
    // Parse the request body
    const data = JSON.parse(event.body || '{}');
    const { trainerId, amount = 2999, challengeId = 'test-challenge' } = data;
    
    console.log('Creating test payment for trainer:', trainerId);
    
    if (!trainerId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ success: false, error: 'Missing trainerId parameter' })
      };
    }
    
    // Create a unique payment ID
    const paymentId = `test_payment_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    
    // Create a payment record in Firestore
    const paymentRef = db.collection('payments').doc(paymentId);
    const paymentData = {
      paymentId,
      challengeId,
      userId: `test_user_${Date.now()}`,
      trainerId,
      amount,
      status: 'completed',
      type: 'challenge_purchase',
      challengeTitle: 'Test Fitness Round',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    
    await paymentRef.set(paymentData);
    
    console.log('Test payment record created in Firestore:', paymentId);
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: 'Test payment record created',
        paymentId,
        paymentData
      })
    };
  } catch (error) {
    console.error('Error creating test payment:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error.message || 'An error occurred creating the test payment'
      })
    };
  }
};

module.exports = { handler }; 