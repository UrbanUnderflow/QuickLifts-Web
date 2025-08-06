const admin = require('firebase-admin');

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  try {
    console.log('[UpdatePrizeAssignment] Initializing Firebase Admin...');
    console.log('[UpdatePrizeAssignment] FIREBASE_PRIVATE_KEY:', process.env.FIREBASE_PRIVATE_KEY ? 'SET' : 'MISSING');
    console.log('[UpdatePrizeAssignment] FIREBASE_SECRET_KEY:', process.env.FIREBASE_SECRET_KEY ? 'SET' : 'MISSING');
    
    const secretKey = process.env.FIREBASE_SECRET_KEY?.replace(/\\n/g, '\n');
    console.log('[UpdatePrizeAssignment] Secret Key Preview:', secretKey ? secretKey.substring(0, 50) + '...' : 'MISSING');
    
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
      }),
    });
    console.log('[UpdatePrizeAssignment] Firebase Admin initialized successfully');
  } catch (initError) {
    console.error('[UpdatePrizeAssignment] Firebase Admin initialization failed:', initError);
    throw initError;
  }
}

const db = admin.firestore();

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json'
};

exports.handler = async (event, context) => {
  console.log('[UpdatePrizeAssignment] Function called');
  console.log('[UpdatePrizeAssignment] Method:', event.httpMethod);
  console.log('[UpdatePrizeAssignment] Body length:', event.body ? event.body.length : 0);
  
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    console.log('[UpdatePrizeAssignment] CORS preflight request');
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({})
    };
  }

  if (event.httpMethod !== 'POST') {
    console.log('[UpdatePrizeAssignment] Invalid method:', event.httpMethod);
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'Method not allowed'
      })
    };
  }

  try {
    let parsedBody;
    try {
      parsedBody = JSON.parse(event.body);
    } catch (parseError) {
      console.error('[UpdatePrizeAssignment] JSON Parse Error:', parseError);
      console.error('[UpdatePrizeAssignment] Raw body:', event.body);
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: `Invalid JSON: ${parseError.message}`
        })
      };
    }

    const { 
      assignmentId, 
      prizeAmount, 
      prizeStructure,
      description,
      customDistribution,
      updatedBy 
    } = parsedBody;

    console.log(`[UpdatePrizeAssignment] Updating assignment ${assignmentId} to $${prizeAmount}`);

    // Validation
    if (!assignmentId || prizeAmount === undefined || prizeAmount === null || prizeAmount <= 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Missing or invalid required fields: assignmentId, prizeAmount'
        })
      };
    }

    // Get the current assignment
    const assignmentDoc = await db.collection('challenge-prizes').doc(assignmentId).get();
    
    if (!assignmentDoc.exists) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Prize assignment not found'
        })
      };
    }

    const currentData = assignmentDoc.data();

    // Check if the assignment is already funded
    if (currentData.fundingStatus === 'funded') {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Cannot edit prize amount after funding. Please contact support for refunds.'
        })
      };
    }

    // Prepare update data
    const updateData = {
      prizeAmount: prizeAmount,
      updatedAt: new Date(),
      lastModifiedBy: updatedBy || 'admin'
    };

    // Add optional fields if provided
    if (prizeStructure) updateData.prizeStructure = prizeStructure;
    if (description !== undefined) updateData.description = description;
    if (customDistribution) updateData.customDistribution = customDistribution;

    // Update the prize assignment
    await db.collection('challenge-prizes').doc(assignmentId).update(updateData);

    console.log(`[UpdatePrizeAssignment] Successfully updated assignment ${assignmentId}`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Prize assignment updated successfully',
        assignmentId,
        newAmount: prizeAmount
      })
    };

  } catch (error) {
    console.error('[UpdatePrizeAssignment] Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error.message || 'Internal server error'
      })
    };
  }
};