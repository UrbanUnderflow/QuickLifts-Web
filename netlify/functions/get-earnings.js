// Function to get a user's earnings data from Stripe

const Stripe = require('stripe');
const { db, headers } = require('./config/firebase');

console.log('Starting get-earnings function initialization...');

// Initialize Stripe with better error handling
let stripe;
try {
  // Log environment variables for debugging (without exposing sensitive data)
  console.log('Environment variables available:', {
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY ? 'Set' : 'Not set',
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
      headers,
      body: JSON.stringify({ success: false, error: 'Method not allowed' })
    };
  }

  try {
    // Check if db is available
    if (!db) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          success: false, 
          error: 'Firebase database is not available. Configuration error.' 
        })
      };
    }
    
    // Safely access userId to avoid null reference errors
    const userId = event.queryStringParameters?.userId;
    console.log('Received GET request for userId:', userId);
    
    if (!userId) {
      return {
        statusCode: 400,
        headers,
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
          headers,
          body: JSON.stringify({
            success: false,
            error: 'User not found'
          })
        };
      }

      const userData = userDoc.data();
      console.log('User data retrieved, checking for Stripe account...');
      console.log('User document data:', {
        hasCreator: !!userData.creator,
        hasStripeAccount: !!(userData.creator && userData.creator.stripeAccountId),
        stripeAccountId: userData.creator?.stripeAccountId || 'Not found'
      });
      
      // Check if user has a Stripe account
      if (!userData.creator || !userData.creator.stripeAccountId) {
        console.warn('User has no Stripe account.');
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ 
            success: false, 
            error: 'No Stripe account found for this user'
          })
        };
      }

      const connectedAccountId = userData.creator.stripeAccountId;
      console.log(`Found Stripe account: ${connectedAccountId}, retrieving data...`);
      
      try {
        console.log('About to retrieve balance from Stripe for connected account:', connectedAccountId);
        
        // First, let's try to get just the balance to see if that's working
        try {
          const balanceResult = await stripe.balance.retrieve({
            stripeAccount: connectedAccountId
          });
          
          console.log('SUCCESS! Balance retrieved successfully:', JSON.stringify(balanceResult, null, 2));
          console.log('Available balance:', balanceResult.available);
          console.log('Pending balance:', balanceResult.pending);
          
          // Log individual available balance items
          if (balanceResult.available && balanceResult.available.length > 0) {
            balanceResult.available.forEach((item, index) => {
              console.log(`Available balance item ${index}:`, {
                amount: item.amount,
                currency: item.currency,
                amountInDollars: item.amount / 100
              });
            });
          } else {
            console.log('No available balance items found');
          }
          
          // Log individual pending balance items
          if (balanceResult.pending && balanceResult.pending.length > 0) {
            balanceResult.pending.forEach((item, index) => {
              console.log(`Pending balance item ${index}:`, {
                amount: item.amount,
                currency: item.currency,
                amountInDollars: item.amount / 100
              });
            });
          } else {
            console.log('No pending balance items found');
          }
        } catch (balanceError) {
          console.error('ERROR retrieving balance:', balanceError);
          console.error('Balance error details:', {
            message: balanceError.message,
            type: balanceError.type,
            stack: balanceError.stack,
            params: balanceError.params
          });
        }
        
        // Continue with the rest of the data retrieval
        console.log('Starting parallel data retrieval from Stripe...');
        
        // Start retrieving multiple pieces of data in parallel - but with strict limits to avoid timeouts
        const [balance, payouts, transfers, roundPayments, stripeCharges] = await Promise.all([
          // Get account balance
          stripe.balance.retrieve({
            stripeAccount: connectedAccountId
          }).catch(err => {
            console.error('Error retrieving balance:', err);
            return { available: [], pending: [] };
          }),
          
          // Get recent payouts - reduced limit
          stripe.payouts.list({
            limit: 5, // Reduced from 10
            stripeAccount: connectedAccountId
          }).catch(err => {
            console.error('Error retrieving payouts:', err);
            return { data: [] };
          }),
          
          // Get transfers to the connected account - reduced limit
          stripe.transfers.list({
            destination: connectedAccountId,
            limit: 20 // Reduced from 100
          }).catch(err => {
            console.error('Error retrieving transfers:', err);
            return { data: [] };
          }),
          
          // Get recent payment records from the round-payments collection
          (async () => {
            try {
              console.log(`Querying Firestore round-payments collection for ownerId: ${userId}`);
              const paymentsSnapshot = await db.collection('round-payments')
                .where('ownerId', '==', userId)
                .orderBy('createdAt', 'desc')
                .limit(10) // Reduced from 20
                .get();
                
              const paymentRecords = [];
              paymentsSnapshot.forEach(doc => {
                paymentRecords.push({...doc.data(), id: doc.id});
              });
              
              console.log(`Found ${paymentRecords.length} payment records in round-payments with ownerId`);
              if (paymentRecords.length > 0) {
                console.log('Sample payment record:', JSON.stringify(paymentRecords[0], null, 2));
              }
              
              return paymentRecords;
            } catch (err) {
              console.error('Error retrieving payments from round-payments:', err);
              return [];
            }
          })(),
          
          // Get charges directly from Stripe - reduced limit
          stripe.charges.list({
            limit: 5,
            destination: connectedAccountId
          }).catch(err => {
            console.error('Error listing charges from Stripe:', err);
            return { data: [] };
          })
        ]);
        
        console.log('All Stripe data retrieved successfully');
        console.log('Stripe balance:', {
          availableCount: balance.available.length,
          pendingCount: balance.pending.length,
          sample: balance.available.length > 0 ? balance.available[0] : 'No available balance'
        });
        
        console.log('Stripe payouts:', {
          count: payouts.data.length,
          sample: payouts.data.length > 0 ? payouts.data[0].id : 'No payouts found'
        });
        
        console.log('Stripe transfers:', {
          count: transfers.data.length,
          sample: transfers.data.length > 0 ? transfers.data[0].id : 'No transfers found'
        });
        
        console.log('Stripe charges:', {
          count: stripeCharges.data.length,
          sample: stripeCharges.data.length > 0 ? stripeCharges.data[0].id : 'No charges found'
        });
        
        // Convert stripe charges to our format
        const stripePayments = stripeCharges.data.map(charge => {
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
        
        // Combine payments from all sources and remove duplicates
        // Priority: round-payments > direct Stripe
        // Identify uniqueness by paymentId
        const allPaymentIds = new Set();
        let allPayments = [];
        
        // First add round-payments with ownerId (highest priority)
        roundPayments.forEach(payment => {
          allPaymentIds.add(payment.paymentId || payment.id);
          allPayments.push(payment);
        });
        
        // Add direct Stripe payments if they don't exist in the collection
        stripePayments.forEach(payment => {
          const paymentId = payment.paymentId || payment.id;
          if (!allPaymentIds.has(paymentId)) {
            allPaymentIds.add(paymentId);
            allPayments.push(payment);
          }
        });
        
        console.log('Data retrieved:', {
          balanceAvailable: balance.available.length,
          balancePending: balance.pending.length,
          payoutsCount: payouts.data.length,
          transfersCount: transfers.data.length,
          roundPaymentsCount: roundPayments.length,
          stripePaymentsCount: stripePayments.length,
          totalUniquePayments: allPayments.length
        });
        
        // Calculate total earned (from transfers to the connected account)
        const totalTransferred = transfers.data.reduce((sum, transfer) => sum + transfer.amount, 0) / 100;
        console.log('Total transferred amount:', totalTransferred);
        
        // Calculate available and pending balance
        const availableBalance = balance.available.reduce((sum, item) => sum + item.amount, 0) / 100;
        const pendingBalance = balance.pending.reduce((sum, item) => sum + item.amount, 0) / 100;
        console.log('Available balance:', availableBalance);
        console.log('Pending balance:', pendingBalance);
        
        // Calculate total earnings (transferred + available + pending)
        const totalEarned = totalTransferred + availableBalance;
        console.log('Total earned:', totalEarned);
        
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
        
        // Limit to 10 sales to keep response size manageable
        const limitedSales = recentSales.slice(0, 10);
        
        // Real data structure - all zeros is fine for new accounts
        const earningsData = {
          totalEarned: totalEarned || 0,
          pendingPayout: pendingBalance || 0,
          availableBalance: availableBalance || 0,
          roundsSold: allPayments.length || transfers.data.length || 0,
          recentSales: limitedSales,
          lastUpdated: new Date().toISOString(),
          isNewAccount: transfers.data.length === 0 && allPayments.length === 0
        };
        
        console.log('Returning earnings data with', limitedSales.length, 'recent sales');
        console.log('Final earnings data:', JSON.stringify(earningsData, null, 2));
        
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            earnings: earningsData,
            message: limitedSales.length === 0 ? 'No transactions found yet' : undefined
          })
        };
        
      } catch (stripeError) {
        console.error('Error processing Stripe data:', stripeError);
        console.error('Stripe error details:', {
          message: stripeError.message,
          type: stripeError.type,
          code: stripeError.code,
          statusCode: stripeError.statusCode
        });
        
        // Return empty data structure - no dummy data
        return {
          statusCode: 200,
          headers,
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
      console.error('Error details:', error.message, error.stack);
      
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          success: false,
          error: error.message || 'Error retrieving user data',
        })
      };
    }
  } catch (error) {
    console.error('Error getting earnings data:', error);
    console.error('Error details:', error.message, error.stack);
    
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

module.exports = { handler }; 