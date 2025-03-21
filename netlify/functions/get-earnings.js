// Function to get a user's earnings data from Stripe

const Stripe = require('stripe');
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

// Initialize Stripe with better error handling
let stripe;
try {
  // Log environment variables for debugging (without exposing sensitive data)
  console.log('Environment variables available:', {
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY ? 'Set' : 'Not set',
    FIREBASE_SECRET_KEY_ALT: process.env.FIREBASE_SECRET_KEY_ALT ? 'Set' : 'Not set',
    FIREBASE_PRIVATE_KEY_ALT: process.env.FIREBASE_PRIVATE_KEY ? 'Set' : 'Not set',
    NODE_ENV: process.env.NODE_ENV
  });

  if (process.env.STRIPE_SECRET_KEY) {
    stripe = Stripe(process.env.STRIPE_SECRET_KEY);
    console.log('Stripe initialized successfully with API key');
  } else {
    console.warn('STRIPE_SECRET_KEY environment variable is missing');
  }
} catch (error) {
  console.error('Error initializing Stripe:', error);
}

const handler = async (event) => {
  // Only accept GET requests
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      body: JSON.stringify({ success: false, error: 'Method not allowed' })
    };
  }

  try {
    // Safely access userId to avoid null reference errors
    const userId = event.queryStringParameters?.userId;
    console.log('Received GET request for userId:', userId);
    
    if (!userId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ success: false, error: 'Missing userId parameter' })
      };
    }

    try {
      // Get user document from Firestore
      console.log('Fetching user document from Firestore...');
      const userDoc = await db.collection('users').doc(userId).get();
      
      if (!userDoc.exists) {
        console.warn(`User document not found for userId: ${userId}`);
        return {
          statusCode: 404,
          body: JSON.stringify({
            success: false,
            error: 'User not found'
          })
        };
      }

      const userData = userDoc.data();
      console.log('User data retrieved, checking for Stripe account...');
      
      // Check if user has a Stripe account
      if (!userData.creator || !userData.creator.stripeAccountId) {
        console.warn('User has no Stripe account.');
        return {
          statusCode: 400,
          body: JSON.stringify({ 
            success: false, 
            error: 'No Stripe account found for this user'
          })
        };
      }

      const connectedAccountId = userData.creator.stripeAccountId;
      console.log(`Found Stripe account: ${connectedAccountId}, retrieving data...`);
      
      try {
        // Start retrieving multiple pieces of data in parallel
        const [balance, payouts, transfers, roundPayments, legacyPayments, stripePayments] = await Promise.all([
          // Get account balance
          stripe.balance.retrieve({
            stripeAccount: connectedAccountId
          }).catch(err => {
            console.error('Error retrieving balance:', err);
            return { available: [], pending: [] };
          }),
          
          // Get recent payouts
          stripe.payouts.list({
            limit: 10,
            stripeAccount: connectedAccountId
          }).catch(err => {
            console.error('Error retrieving payouts:', err);
            return { data: [] };
          }),
          
          // Get transfers to the connected account
          stripe.transfers.list({
            destination: connectedAccountId,
            limit: 100
          }).catch(err => {
            console.error('Error retrieving transfers:', err);
            return { data: [] };
          }),
          
          // Get recent payment records from the new round-payments collection
          (async () => {
            try {
              const paymentsSnapshot = await db.collection('round-payments')
                .where('ownerId', '==', userId)
                .orderBy('createdAt', 'desc')
                .limit(20)
                .get();
                
              const paymentRecords = [];
              paymentsSnapshot.forEach(doc => {
                paymentRecords.push({...doc.data(), id: doc.id});
              });
              
              console.log(`Found ${paymentRecords.length} payment records in round-payments`);
              
              // Get challenge details for each payment
              const enrichedPayments = await Promise.all(
                paymentRecords.map(async payment => {
                  try {
                    // Get challenge title
                    if (payment.challengeId && !payment.challengeTitle) {
                      const challengeDoc = await db.collection('challenges')
                        .doc(payment.challengeId)
                        .get();
                        
                      if (challengeDoc.exists) {
                        const challengeData = challengeDoc.data();
                        return {
                          ...payment,
                          challengeTitle: challengeData.title || 'Fitness Round'
                        };
                      }
                    }
                    return payment;
                  } catch (err) {
                    console.error(`Error getting challenge data for payment ${payment.paymentId}:`, err);
                    return payment;
                  }
                })
              );
              
              return enrichedPayments;
            } catch (err) {
              console.error('Error retrieving payments from round-payments:', err);
              return [];
            }
          })(),
          
          // Also check the legacy payments collection
          (async () => {
            try {
              // Check for trainerId field in legacy collection
              const paymentsSnapshot = await db.collection('payments')
                .where('trainerId', '==', userId)
                .orderBy('createdAt', 'desc')
                .limit(20)
                .get();
                
              const paymentRecords = [];
              paymentsSnapshot.forEach(doc => {
                const data = doc.data();
                // Transform to match the new format
                paymentRecords.push({
                  ...data,
                  id: doc.id,
                  ownerId: data.trainerId, // Map trainerId to ownerId
                  ownerAmount: data.trainerAmount || (data.amount ? data.amount - (data.platformFee || 0) : 0),
                  source: 'legacy_payments'
                });
              });
              
              if (paymentRecords.length > 0) {
                console.log(`Found ${paymentRecords.length} legacy payment records that need migration`);
              }
              
              return paymentRecords;
            } catch (err) {
              console.error('Error retrieving payments from legacy payments:', err);
              return [];
            }
          })(),
          
          // ADDED: Also fetch payment intents directly from Stripe
          (async () => {
            try {
              console.log('Fetching charges directly from Stripe...');
              // List charges directly from Stripe that are related to this connected account
              const charges = await stripe.charges.list({
                limit: 20, 
                destination: connectedAccountId
              }).catch(err => {
                console.error('Error listing charges from Stripe:', err);
                return { data: [] };
              });
              
              console.log(`Found ${charges.data.length} charges in Stripe for this connected account`);
              
              // Convert the charges to our standard payment format
              return charges.data.map(charge => {
                return {
                  amount: charge.amount,
                  createdAt: { toDate: () => new Date(charge.created * 1000) },
                  challengeTitle: charge.description || 'Fitness Round',
                  status: charge.status,
                  paymentId: charge.id,
                  source: 'stripe',
                  ownerId: userId
                };
              });
            } catch (err) {
              console.error('Error fetching payments directly from Stripe:', err);
              return [];
            }
          })()
        ]);
        
        // Sync Stripe payments to Firestore if they're not already there
        await syncStripePaymentsToFirestore(stripePayments, userId, connectedAccountId);
        
        // Combine payments from all sources and remove duplicates
        // Priority: round-payments > legacy payments > direct Stripe
        // Identify uniqueness by paymentId
        const allPaymentIds = new Set();
        let allPayments = [];
        
        // First add round-payments (highest priority)
        roundPayments.forEach(payment => {
          allPaymentIds.add(payment.paymentId || payment.id);
          allPayments.push(payment);
        });
        
        // Then add legacy payments if they don't exist in round-payments
        legacyPayments.forEach(payment => {
          const paymentId = payment.paymentId || payment.id;
          if (!allPaymentIds.has(paymentId)) {
            allPaymentIds.add(paymentId);
            allPayments.push(payment);
          }
        });
        
        // Finally add direct Stripe payments if they don't exist in either collection
        stripePayments.forEach(payment => {
          const paymentId = payment.paymentId || payment.id;
          if (!allPaymentIds.has(paymentId)) {
            allPaymentIds.add(paymentId);
            allPayments.push(payment);
          }
        });
        
        console.log('Stripe data retrieved:', {
          balanceAvailable: balance.available.length,
          balancePending: balance.pending.length,
          payoutsCount: payouts.data.length,
          transfersCount: transfers.data.length,
          roundPaymentsCount: roundPayments.length,
          legacyPaymentsCount: legacyPayments.length,
          stripePaymentsCount: stripePayments.length,
          totalUniquePayments: allPayments.length
        });
        
        // Calculate total earned (from transfers to the connected account)
        const totalTransferred = transfers.data.reduce((sum, transfer) => sum + transfer.amount, 0) / 100;
        
        // Calculate available and pending balance
        const availableBalance = balance.available.reduce((sum, item) => sum + item.amount, 0) / 100;
        const pendingBalance = balance.pending.reduce((sum, item) => sum + item.amount, 0) / 100;
        
        // Calculate total earnings (transferred + available + pending)
        const totalEarned = totalTransferred + availableBalance;
        
        // Format payments data for the frontend
        const recentSales = allPayments.map(payment => {
          return {
            date: payment.createdAt?.toDate?.() 
              ? payment.createdAt.toDate().toISOString().split('T')[0] 
              : new Date().toISOString().split('T')[0],
            roundTitle: payment.challengeTitle || 'Fitness Round',
            amount: (payment.amount / 100) || 0,
            status: payment.status || 'completed',
            source: payment.source || 'firestore',
            id: payment.paymentId || payment.id || 'unknown'
          };
        });
        
        // Sort by date with newest first
        recentSales.sort((a, b) => new Date(b.date) - new Date(a.date));
        
        // Real data structure - all zeros is fine for new accounts
        const earningsData = {
          totalEarned: totalEarned || 0,
          pendingPayout: pendingBalance || 0,
          availableBalance: availableBalance || 0,
          roundsSold: allPayments.length || transfers.data.length || 0,
          recentSales: recentSales,
          lastUpdated: new Date().toISOString(),
          isNewAccount: transfers.data.length === 0 && allPayments.length === 0
        };
        
        console.log('Returning earnings data:', earningsData);
        
        return {
          statusCode: 200,
          body: JSON.stringify({
            success: true,
            earnings: earningsData,
            message: recentSales.length === 0 ? 'No transactions found yet' : undefined
          })
        };
        
      } catch (stripeError) {
        console.error('Error processing Stripe data:', stripeError);
        
        // Return empty data structure - no dummy data
        return {
          statusCode: 200,
          body: JSON.stringify({
            success: true,
            earnings: {
              totalEarned: 0,
              pendingPayout: 0,
              availableBalance: 0,
              roundsSold: 0,
              recentSales: [],
              lastUpdated: new Date().toISOString(),
              isNewAccount: true,
              accountId: connectedAccountId
            },
            message: 'Error retrieving Stripe data'
          })
        };
      }
    } catch (error) {
      console.error('Error getting earnings data:', error);
      
      return {
        statusCode: 500,
        body: JSON.stringify({
          success: false,
          error: error.message || 'Error retrieving user data',
        })
      };
    }
  } catch (error) {
    console.error('Error getting earnings data:', error);
    
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error.message || 'Internal server error'
      })
    };
  }
};

/**
 * Syncs payments from Stripe to Firestore if they don't already exist
 * @param {Array} stripePayments - Array of payment data from Stripe
 * @param {string} ownerId - ID of the trainer/owner
 * @param {string} connectedAccountId - ID of the Stripe connected account
 */
async function syncStripePaymentsToFirestore(stripePayments, ownerId, connectedAccountId) {
  if (!stripePayments || stripePayments.length === 0) return;
  
  try {
    console.log(`Syncing ${stripePayments.length} Stripe payments to Firestore...`);
    
    let syncCount = 0;
    
    for (const payment of stripePayments) {
      const paymentId = payment.paymentId;
      
      // Check if this payment already exists in round-payments
      const existingDoc = await db.collection('round-payments').doc(paymentId).get();
      
      if (!existingDoc.exists) {
        // Also check legacy payments collection
        const legacyDoc = await db.collection('payments').doc(paymentId).get();
        
        if (!legacyDoc.exists) {
          // Payment doesn't exist in either collection, create it in round-payments
          const paymentData = {
            paymentId,
            amount: payment.amount,
            status: payment.status || 'succeeded',
            ownerId,
            stripeAccountId: connectedAccountId,
            challengeTitle: payment.challengeTitle || 'Fitness Round',
            createdAt: new Date(payment.createdAt.toDate()),
            updatedAt: new Date(),
            source: 'stripe_sync',
            currency: payment.currency || 'usd',
            // Calculate an approximate split (3% platform fee)
            platformFee: Math.round(payment.amount * 0.03),
            ownerAmount: Math.round(payment.amount * 0.97)
          };
          
          await db.collection('round-payments').doc(paymentId).set(paymentData);
          syncCount++;
        }
      }
    }
    
    if (syncCount > 0) {
      console.log(`Synced ${syncCount} new payments from Stripe to Firestore`);
    } else {
      console.log('No new payments needed to be synced to Firestore');
    }
  } catch (error) {
    console.error('Error syncing Stripe payments to Firestore:', error);
  }
}

module.exports = { handler }; 