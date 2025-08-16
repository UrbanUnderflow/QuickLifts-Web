/**
 * Create Partner Profile
 * 
 * Creates a partner profile without subscription payment.
 * Partners get revenue sharing but don't pay subscription fees.
 */

const { db, headers } = require('./config/firebase');

// Generate a unique referral code
const generateReferralCode = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

// Generate a unique referral code
const generateUniqueReferralCode = async (attempts = 0) => {
  if (attempts > 10) {
    throw new Error('Unable to generate unique referral code after 10 attempts');
  }

  const code = generateReferralCode();
  
  // Check if code already exists
  const existingCoach = await db.collection('coaches')
    .where('referralCode', '==', code)
    .limit(1)
    .get();

  if (existingCoach.empty) {
    return code;
  } else {
    return generateUniqueReferralCode(attempts + 1);
  }
};

const handler = async (event) => {
  console.log(`[CreatePartnerProfile] Received ${event.httpMethod} request.`);

  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ message: 'Method Not Allowed' }),
    };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch (e) {
    console.error("[CreatePartnerProfile] Error parsing request body:", e);
    return { 
      statusCode: 400, 
      headers,
      body: JSON.stringify({ message: 'Invalid request body.' }) 
    };
  }

  const { 
    userId, 
    referralCode,
    userType
  } = body;

  if (!userId) {
    console.warn('[CreatePartnerProfile] Missing required parameters:', { userId: !!userId });
    return { 
      statusCode: 400, 
      headers,
      body: JSON.stringify({ 
        message: 'Missing required parameter: userId is required.' 
      }) 
    };
  }

  if (userType !== 'partner') {
    console.warn('[CreatePartnerProfile] Invalid userType:', userType);
    return { 
      statusCode: 400, 
      headers,
      body: JSON.stringify({ 
        message: 'This endpoint is only for partner profiles' 
      }) 
    };
  }

  console.log(`[CreatePartnerProfile] Creating partner profile for user: ${userId}`);

  try {
    // Check if partner already exists
    const existingPartner = await db.collection('coaches').doc(userId).get();
    if (existingPartner.exists) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          message: 'Partner profile already exists for this user' 
        })
      };
    }

    // Generate or validate referral code
    const finalReferralCode = referralCode || await generateUniqueReferralCode();

    // If custom referral code provided, check if it's unique
    if (referralCode) {
      const existingCode = await db.collection('coaches')
        .where('referralCode', '==', referralCode)
        .limit(1)
        .get();

      if (!existingCode.empty) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ 
            message: 'Referral code already exists. Please choose a different code.' 
          })
        };
      }
    }

    // Create partner profile in coaches collection
    const partnerData = {
      userId: userId,
      referralCode: finalReferralCode,

      stripeCustomerId: null, // Partners don't have Stripe customers
      subscriptionStatus: 'partner', // Special status for partners
      userType: 'partner',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Use batch to ensure atomicity
    const batch = db.batch();

    // Create partner profile
    const partnerRef = db.collection('coaches').doc(userId);
    batch.set(partnerRef, partnerData);

    // Update user role to coach (partners are a type of coach)
    const userRef = db.collection('users').doc(userId);
    batch.update(userRef, {
      role: 'coach',
      userType: 'partner',
      updatedAt: new Date()
    });



    // Execute all operations atomically
    await batch.commit();

    console.log(`[CreatePartnerProfile] Partner ${userId} successfully created with referral code: ${finalReferralCode}`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Partner profile created successfully',
        partnerId: userId,
        referralCode: finalReferralCode
      }),
    };

  } catch (error) {
    console.error('[CreatePartnerProfile] Error creating partner profile:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        message: error.message || 'Failed to create partner profile.' 
      }),
    };
  }
};

module.exports = { handler };
