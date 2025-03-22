// Function to record a completed payment in Firestore

const admin = require('firebase-admin');
const { db } = require('./config/firebase');

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
    const { challengeId, paymentId, buyerId, ownerId, amount } = data;
    
    console.log('Recording payment completion:', {
      challengeId,
      paymentId,
      buyerId,
      ownerId,
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
    let challengeOwnerId = null;
    let challengeTitle = 'Round';
    
    if (challengeDoc.exists) {
      const challengeData = challengeDoc.data();
      challengeOwnerId = challengeData.ownerId;
      challengeTitle = challengeData.title || challengeTitle;
      console.log(`Challenge found: ${challengeId}, owner:`, challengeOwnerId, 'title:', challengeTitle);
    } else {
      // Try to find in sweatlist-collection
      const sweatlistQuery = await db.collection('sweatlist-collection').where('challenge.id', '==', challengeId).limit(1).get();
      
      if (!sweatlistQuery.empty) {
        const sweatlistDoc = sweatlistQuery.docs[0];
        const sweatlistData = sweatlistDoc.data();
        
        if (sweatlistData.ownerId) {
          challengeOwnerId = sweatlistData.ownerId;
        } else if (sweatlistData.challenge && sweatlistData.challenge.ownerId) {
          challengeOwnerId = sweatlistData.challenge.ownerId;
        }
        
        // Get title from sweatlist collection
        if (sweatlistData.challenge && sweatlistData.challenge.title) {
          challengeTitle = sweatlistData.challenge.title;
        }
        
        console.log(`Challenge found in sweatlist: ${challengeId}, owner:`, challengeOwnerId, 'title:', challengeTitle);
      } else {
        console.warn(`Challenge not found: ${challengeId}`);
        return {
          statusCode: 404,
          body: JSON.stringify({ success: false, error: 'Challenge not found' })
        };
      }
    }
    
    // Get the effective owner ID to store in the payment record
    let effectiveOwnerId = null;
    
    if (ownerId) {
      // If ownerId is provided in the request, use it
      effectiveOwnerId = Array.isArray(ownerId) && ownerId.length > 0 ? ownerId[0] : ownerId;
    } else if (challengeOwnerId) {
      // Otherwise use the owner ID from the challenge
      effectiveOwnerId = Array.isArray(challengeOwnerId) && challengeOwnerId.length > 0 ? 
        challengeOwnerId[0] : challengeOwnerId;
    }
    
    console.log('Effective owner ID for payment record:', effectiveOwnerId);
    
    // Create a payment record in Firestore
    const paymentRef = db.collection('payments').doc(paymentId);
    await paymentRef.set({
      paymentId,
      challengeId,
      challengeTitle,
      buyerId: buyerId || 'anonymous',
      ownerId: effectiveOwnerId,
      amount: amount || 0,
      status: 'completed',
      type: 'challenge_purchase',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    console.log('Payment record created in Firestore with challenge title:', challengeTitle);
    
    // We're not adding the user to challenge participants as you have another system for this
    
    return {
      statusCode: 200,
      body: JSON.stringify({ 
        success: true,
        paymentDetails: {
          id: paymentId,
          challengeId,
          challengeTitle,
          amount: amount || 0
        }
      })
    };
  } catch (error) {
    console.error('Error completing payment:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, error: error.message || 'Unknown error' })
    };
  }
};

module.exports = { handler }; 