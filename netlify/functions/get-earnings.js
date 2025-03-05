// Function to get a user's earnings data from Stripe

const Stripe = require('stripe');
const admin = require('firebase-admin');

if (admin.apps.length === 0) {
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
      "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-1qxb0%40quicklifts-dd3f1.iam.gserviceaccount.com",
      "universe_domain": "googleapis.com"
    })
  });
}

const db = admin.firestore();
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

// Dummy data for development or when Stripe API access fails
const dummyEarningsData = {
  totalEarned: 1250.00,
  pendingPayout: 450.00,
  roundsSold: 18,
  recentSales: [
    { date: '2023-12-20', roundTitle: 'Full Body Workout', amount: 35.00 },
    { date: '2023-12-18', roundTitle: 'Upper Body Strength', amount: 35.00 },
    { date: '2023-12-15', roundTitle: 'Core Challenge', amount: 35.00 },
    { date: '2023-12-12', roundTitle: 'Lower Body Focus', amount: 35.00 },
    { date: '2023-12-10', roundTitle: 'Full Body Workout', amount: 35.00 }
  ]
};

const handler = async (event) => {
  // Only accept GET requests
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      body: JSON.stringify({ success: false, error: 'Method not allowed' })
    };
  }

  try {
    const userId = event.queryStringParameters.userId;
    
    if (!userId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ success: false, error: 'Missing userId parameter' })
      };
    }

    // Get user document from Firestore
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      return {
        statusCode: 404,
        body: JSON.stringify({ success: false, error: 'User not found' })
      };
    }

    const userData = userDoc.data();
    
    // Check if user has a Stripe account
    if (!userData.creator || !userData.creator.stripeAccountId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ 
          success: false, 
          error: 'Stripe account not found for this user' 
        })
      };
    }

    // Get Stripe account balance
    const balance = await stripe.balance.retrieve({
      stripeAccount: userData.creator.stripeAccountId
    });

    // Get recent payouts
    const payouts = await stripe.payouts.list({
      limit: 10,
      stripeAccount: userData.creator.stripeAccountId
    });

    // Get recent payments
    const charges = await stripe.charges.list({
      limit: 5,
      stripeAccount: userData.creator.stripeAccountId
    });

    // Calculate total earned
    const totalEarned = balance.available.reduce((sum, item) => sum + item.amount, 0) / 100;
    const pendingPayout = balance.pending.reduce((sum, item) => sum + item.amount, 0) / 100;

    // Get workout rounds sold (this would need to be implemented based on your data structure)
    // For now, using a placeholder query
    const workoutsRef = await db.collection('workouts')
      .where('creatorId', '==', userId)
      .get();

    const roundsSold = workoutsRef.size || 0;

    // Format recent sales data (placeholder logic - adapt to your data structure)
    const recentSales = charges.data.map(charge => {
      return {
        date: new Date(charge.created * 1000).toISOString().split('T')[0],
        roundTitle: charge.description || 'Workout Round',
        amount: charge.amount / 100
      };
    });

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        earnings: {
          totalEarned,
          pendingPayout,
          roundsSold,
          recentSales: recentSales.length > 0 ? recentSales : dummyEarningsData.recentSales
        }
      })
    };
  } catch (error) {
    console.error('Error getting earnings data:', error);
    
    // In development, return dummy data on error
    if (process.env.NODE_ENV === 'development') {
      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          earnings: dummyEarningsData
        })
      };
    }
    
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error.message
      })
    };
  }
};

module.exports = { handler }; 