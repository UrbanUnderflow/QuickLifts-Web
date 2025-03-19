// Function to record a completed payment in Firestore

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
          "private_key_id": process.env.FIREBASE_PRIVATE_KEY_ALT,
          "private_key": process.env.FIREBASE_SECRET_KEY_ALT.replace(/\\n/g, '\n'),
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
  // Only accept POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ success: false, error: 'Method not allowed' })
    };
  }

  try {
    // Parse the request body
    const data = JSON.parse(event.body);
    const { challengeId, paymentId, userId, trainerId, amount } = data;
    
    console.log('Recording payment completion:', {
      challengeId,
      paymentId,
      userId,
      trainerId,
      amount
    });
    
    if (!challengeId || !paymentId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ success: false, error: 'Missing required parameters' })
      };
    }
    
    // Verify the challenge exists
    const challengeDoc = await db.collection('challenges').doc(challengeId).get();
    if (!challengeDoc.exists) {
      console.warn(`Challenge not found: ${challengeId}`);
      return {
        statusCode: 404,
        body: JSON.stringify({ success: false, error: 'Challenge not found' })
      };
    }
    
    // Create a payment record in Firestore
    const paymentRef = db.collection('payments').doc(paymentId);
    await paymentRef.set({
      paymentId,
      challengeId,
      userId: userId || 'anonymous',
      trainerId: trainerId || challengeDoc.data().ownerId,
      amount: amount || 0,
      status: 'completed',
      type: 'challenge_purchase',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    console.log('Payment record created in Firestore');
    
    // Add the user to the challenge participants
    if (userId) {
      const challengeRef = db.collection('challenges').doc(challengeId);
      await challengeRef.update({
        participants: admin.firestore.FieldValue.arrayUnion(userId)
      });
      console.log(`User ${userId} added to challenge participants`);
    } else {
      console.warn('No userId provided, skipping adding to participants');
    }
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: 'Payment recorded successfully'
      })
    };
  } catch (error) {
    console.error('Error recording payment:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error.message || 'An error occurred recording the payment'
      })
    };
  }
};

module.exports = { handler }; 