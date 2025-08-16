const admin = require('firebase-admin');

// Initialize Firebase Admin if not already initialized
if (admin.apps.length === 0) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

const db = admin.firestore();

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Content-Type': 'application/json',
};

/**
 * Validates a promo code for partner invitations
 * 
 * @param {string} code - The promo code to validate
 * @param {string} userId - The user attempting to use the code
 * @returns {Promise<{isValid: boolean, promoCode?: object, error?: string}>}
 */
async function validatePromoCodeForPartner(code, userId) {
  try {
    console.log(`[ValidatePromoCode] Validating code: ${code} for user: ${userId}`);
    
    // Query for the promo code by code field
    const promoCodeQuery = await db.collection('promoCodes')
      .where('code', '==', code.toUpperCase())
      .where('isActive', '==', true)
      .limit(1)
      .get();

    if (promoCodeQuery.empty) {
      console.log(`[ValidatePromoCode] No active promo code found for: ${code}`);
      return {
        isValid: false,
        error: 'Invalid or inactive promo code.'
      };
    }

    const promoCodeDoc = promoCodeQuery.docs[0];
    const promoCodeData = promoCodeDoc.data();
    
    console.log(`[ValidatePromoCode] Found promo code:`, {
      id: promoCodeDoc.id,
      type: promoCodeData.type,
      usageCount: promoCodeData.usageCount,
      usageLimit: promoCodeData.usageLimit
    });

    // Check if this is a partner-type promo code
    if (promoCodeData.type !== 'partner') {
      console.log(`[ValidatePromoCode] Promo code is not for partners: ${promoCodeData.type}`);
      return {
        isValid: false,
        error: 'This promo code is not valid for partner invitations.'
      };
    }

    // Check if it's expired
    if (promoCodeData.expiresAt && new Date(promoCodeData.expiresAt.toDate()) < new Date()) {
      console.log(`[ValidatePromoCode] Promo code is expired`);
      return {
        isValid: false,
        error: 'This promo code has expired.'
      };
    }

    // Check usage limits
    if (promoCodeData.usageLimit && promoCodeData.usageCount >= promoCodeData.usageLimit) {
      console.log(`[ValidatePromoCode] Promo code has reached usage limit`);
      return {
        isValid: false,
        error: 'This promo code has reached its usage limit.'
      };
    }

    // Check if user has already used this promo code
    const existingUsage = await db.collection('promoCodeUsage')
      .where('promoCodeId', '==', promoCodeDoc.id)
      .where('userId', '==', userId)
      .limit(1)
      .get();

    if (!existingUsage.empty) {
      console.log(`[ValidatePromoCode] User has already used this promo code`);
      return {
        isValid: false,
        error: 'You have already used this promo code.'
      };
    }

    console.log(`[ValidatePromoCode] Promo code is valid`);
    return {
      isValid: true,
      promoCode: {
        id: promoCodeDoc.id,
        ...promoCodeData
      }
    };

  } catch (error) {
    console.error('[ValidatePromoCode] Error validating promo code:', error);
    return {
      isValid: false,
      error: 'Error validating promo code. Please try again.'
    };
  }
}

/**
 * Records the usage of a promo code
 */
async function recordPromoCodeUsage(promoCodeId, userId, metadata = {}) {
  try {
    console.log(`[RecordPromoUsage] Recording usage for promoCode: ${promoCodeId}, user: ${userId}`);
    
    const batch = db.batch();
    
    // Create usage record
    const usageRef = db.collection('promoCodeUsage').doc();
    batch.set(usageRef, {
      promoCodeId: promoCodeId,
      userId: userId,
      usedAt: admin.firestore.FieldValue.serverTimestamp(),
      metadata: metadata
    });
    
    // Increment usage count on promo code
    const promoCodeRef = db.collection('promoCodes').doc(promoCodeId);
    batch.update(promoCodeRef, {
      usageCount: admin.firestore.FieldValue.increment(1)
    });
    
    await batch.commit();
    console.log(`[RecordPromoUsage] Successfully recorded usage`);
    
  } catch (error) {
    console.error('[RecordPromoUsage] Error recording usage:', error);
    throw error;
  }
}

exports.handler = async (event, context) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ message: 'Method not allowed' })
    };
  }

  try {
    const body = JSON.parse(event.body);
    const { code, userId, action = 'validate' } = body;

    if (!code || !userId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ message: 'Code and userId are required.' })
      };
    }

    if (action === 'validate') {
      const result = await validatePromoCodeForPartner(code, userId);
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(result)
      };
    } else if (action === 'use') {
      // First validate
      const validation = await validatePromoCodeForPartner(code, userId);
      
      if (!validation.isValid) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify(validation)
        };
      }
      
      // Then record usage
      await recordPromoCodeUsage(validation.promoCode.id, userId, {
        action: 'partner_signup',
        timestamp: new Date().toISOString()
      });
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          isValid: true,
          message: 'Promo code successfully used.',
          promoCode: validation.promoCode
        })
      };
    } else {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ message: 'Invalid action. Use "validate" or "use".' })
      };
    }

  } catch (error) {
    console.error('[ValidatePromoCode] Handler error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ message: 'Internal server error.' })
    };
  }
};

// Export validation function for use in other functions
module.exports = {
  validatePromoCodeForPartner,
  recordPromoCodeUsage
};
