const admin = require('firebase-admin');

// Initialize Firebase Admin
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

/**
 * Creates sample promo codes for partner invitations
 */
async function createSamplePromoCodes() {
  console.log('Creating sample promo codes...');

  const promoCodes = [
    {
      code: 'PARTNER2024',
      type: 'partner',
      isActive: true,
      usageLimit: 50, // 50 partners can use this code
      usageCount: 0,
      description: 'General partner invitation code for 2024',
      createdBy: 'admin', // Replace with actual admin userId when available
      createdAt: new Date(),
      expiresAt: new Date('2024-12-31'), // Expires end of 2024
      metadata: {
        campaign: 'general_partnership',
        year: 2024
      }
    },
    {
      code: 'ELITE2024',
      type: 'partner',
      isActive: true,
      usageLimit: 10, // Limited to 10 elite partners
      usageCount: 0,
      description: 'Elite partner invitation code for high-profile coaches',
      createdBy: 'admin',
      createdAt: new Date(),
      expiresAt: new Date('2024-12-31'),
      metadata: {
        campaign: 'elite_partnership',
        tier: 'elite'
      }
    },
    {
      code: 'LAUNCH2024',
      type: 'partner',
      isActive: true,
      usageLimit: 25,
      usageCount: 0,
      description: 'Launch partnership code for early adopters',
      createdBy: 'admin',
      createdAt: new Date(),
      expiresAt: new Date('2024-06-30'), // Expires mid-2024
      metadata: {
        campaign: 'launch_partnership',
        early_adopter: true
      }
    }
  ];

  try {
    const batch = db.batch();

    for (const promoCode of promoCodes) {
      // Check if code already exists
      const existingCode = await db.collection('promoCodes')
        .where('code', '==', promoCode.code)
        .limit(1)
        .get();

      if (existingCode.empty) {
        const promoRef = db.collection('promoCodes').doc();
        batch.set(promoRef, promoCode);
        console.log(`✓ Queued promo code: ${promoCode.code}`);
      } else {
        console.log(`⚠️  Promo code already exists: ${promoCode.code}`);
      }
    }

    await batch.commit();
    console.log('🎉 All promo codes created successfully!');

    // Display the codes
    console.log('\n📋 Available Partnership Codes:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    for (const code of promoCodes) {
      console.log(`Code: ${code.code}`);
      console.log(`Description: ${code.description}`);
      console.log(`Usage Limit: ${code.usageLimit} uses`);
      console.log(`Expires: ${code.expiresAt.toLocaleDateString()}`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    }

  } catch (error) {
    console.error('❌ Error creating promo codes:', error);
  }
}

/**
 * Creates a single custom promo code
 */
async function createCustomPromoCode(codeData) {
  try {
    const promoRef = db.collection('promoCodes').doc();
    await promoRef.set({
      ...codeData,
      createdAt: new Date(),
      usageCount: 0
    });
    
    console.log(`✓ Custom promo code created: ${codeData.code}`);
  } catch (error) {
    console.error('❌ Error creating custom promo code:', error);
  }
}

// Check command line arguments
const action = process.argv[2];

if (action === 'sample') {
  createSamplePromoCodes();
} else if (action === 'custom') {
  // Example: node create-promo-codes.js custom TESTCODE partner 10 "Test code"
  const code = process.argv[3];
  const type = process.argv[4] || 'partner';
  const usageLimit = parseInt(process.argv[5]) || null;
  const description = process.argv[6] || 'Custom promo code';

  if (!code) {
    console.error('❌ Please provide a code: node create-promo-codes.js custom YOURCODE');
    process.exit(1);
  }

  createCustomPromoCode({
    code: code.toUpperCase(),
    type: type,
    isActive: true,
    usageLimit: usageLimit,
    description: description,
    createdBy: 'admin',
    expiresAt: new Date('2024-12-31'),
    metadata: {
      custom: true
    }
  });
} else {
  console.log('Usage:');
  console.log('  node create-promo-codes.js sample          - Create sample promo codes');
  console.log('  node create-promo-codes.js custom CODE     - Create a custom promo code');
  console.log('');
  console.log('Examples:');
  console.log('  node create-promo-codes.js sample');
  console.log('  node create-promo-codes.js custom COACH123 partner 5 "Special coach code"');
}
