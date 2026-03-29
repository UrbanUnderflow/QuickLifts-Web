// Function to create a test payment record in Firestore for testing

const { admin } = require('./config/firebase');

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
