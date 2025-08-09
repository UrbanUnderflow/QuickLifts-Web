// Function to generate Stripe dashboard links for unified earnings (creator or winner accounts)

const Stripe = require('stripe');
const { db, headers } = require('./config/firebase');

console.log('Starting get-dashboard-link-unified function initialization...');

// Initialize Stripe
let stripe;
try {
  if (process.env.STRIPE_SECRET_KEY) {
    stripe = Stripe(process.env.STRIPE_SECRET_KEY);
    console.log('Stripe initialized successfully for unified dashboard links');
  } else {
    console.warn('STRIPE_SECRET_KEY environment variable is missing');
  }
} catch (error) {
  console.error('Error initializing Stripe:', error);
}

const handler = async (event) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
      },
      body: ''
    };
  }

  // Accept both GET and POST requests
  if (event.httpMethod !== 'GET' && event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ success: false, error: 'Method not allowed' })
    };
  }

  try {
    // Check if Stripe is available
    if (!stripe) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          success: false, 
          error: 'Stripe is not available. Configuration error.' 
        })
      };
    }

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

    // Extract parameters from either query string or request body
    let userId, accountType, preferredAccount;
    
    if (event.httpMethod === 'GET') {
      userId = event.queryStringParameters?.userId;
      accountType = event.queryStringParameters?.accountType; // 'creator', 'winner', or 'auto'
      preferredAccount = event.queryStringParameters?.preferredAccount;
    } else {
      const requestBody = JSON.parse(event.body || '{}');
      userId = requestBody.userId;
      accountType = requestBody.accountType || 'auto';
      preferredAccount = requestBody.preferredAccount;
    }

    console.log('Received unified dashboard link request:', {
      userId,
      accountType,
      preferredAccount,
      timestamp: new Date().toISOString()
    });

    if (!userId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, error: 'Missing userId parameter' })
      };
    }

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
    console.log('User data retrieved, checking for Stripe accounts...');
    
    const hasCreatorAccount = !!(userData.creator && userData.creator.stripeAccountId);
    const hasWinnerAccount = !!(userData.creator && userData.creator.stripeAccountId);
    
    console.log('Stripe accounts available:', {
      hasCreatorAccount,
      hasWinnerAccount,
      creatorAccountId: userData.creator?.stripeAccountId || 'none',
      winnerAccountId: userData.winner?.stripeAccountId || 'none'
    });

    if (!hasCreatorAccount && !hasWinnerAccount) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'No Stripe account found. Please complete account setup first.'
        })
      };
    }

    // Determine which account to use for dashboard link
    const selectedAccount = determineAccountForDashboard({
      accountType,
      preferredAccount,
      hasCreatorAccount,
      hasWinnerAccount,
      creatorAccountId: userData.creator?.stripeAccountId,
      winnerAccountId: userData.winner?.stripeAccountId,
      userData
    });

    console.log('Selected account for dashboard link:', selectedAccount);

    // Generate Stripe Express Dashboard login link
    const loginLink = await stripe.accounts.createLoginLink(selectedAccount.accountId);

    console.log('Dashboard link generated successfully');

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        url: loginLink.url,
        accountInfo: {
          type: selectedAccount.type,
          accountId: selectedAccount.accountId,
          description: selectedAccount.description
        },
        expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // Links expire in 1 hour
        timestamp: new Date().toISOString()
      })
    };

  } catch (error) {
    console.error('Error generating unified dashboard link:', error);
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

// Helper function to determine which account to use for dashboard link
function determineAccountForDashboard({ accountType, preferredAccount, hasCreatorAccount, hasWinnerAccount, creatorAccountId, winnerAccountId, userData }) {
  console.log('Determining account for dashboard link...', {
    accountType,
    preferredAccount,
    hasCreatorAccount,
    hasWinnerAccount
  });

  // If specific account type is requested
  if (accountType === 'creator' && hasCreatorAccount) {
    return {
      type: 'creator',
      accountId: creatorAccountId,
      description: 'Creator earnings account'
    };
  }

  if (accountType === 'winner' && hasWinnerAccount) {
    return {
      type: 'winner',
      accountId: winnerAccountId,
      description: 'Prize winnings account'
    };
  }

  // If specific account is preferred
  if (preferredAccount === 'creator' && hasCreatorAccount) {
    return {
      type: 'creator',
      accountId: creatorAccountId,
      description: 'Creator earnings account'
    };
  }

  if (preferredAccount === 'winner' && hasWinnerAccount) {
    return {
      type: 'winner',
      accountId: winnerAccountId,
      description: 'Prize winnings account'
    };
  }

  // Auto-select based on what's available and what has more activity
  if (hasCreatorAccount && hasWinnerAccount) {
    // Both accounts available - choose based on recent activity or balance
    
    // Check creator earnings status
    const creatorOnboarding = userData.creator?.onboardingStatus;
    const winnerOnboarding = userData.winner?.onboardingStatus;
    
    // Prefer complete onboarding status
    if (creatorOnboarding === 'complete' && winnerOnboarding !== 'complete') {
      return {
        type: 'creator',
        accountId: creatorAccountId,
        description: 'Creator earnings account (primary)'
      };
    }
    
    if (winnerOnboarding === 'complete' && creatorOnboarding !== 'complete') {
      return {
        type: 'winner',
        accountId: winnerAccountId,
        description: 'Prize winnings account (primary)'
      };
    }
    
    // If both are complete or both incomplete, prefer creator account (typically more activity)
    return {
      type: 'creator',
      accountId: creatorAccountId,
      description: 'Creator earnings account (primary)'
    };
  }

  // Single account available
  if (hasCreatorAccount) {
    return {
      type: 'creator',
      accountId: creatorAccountId,
      description: 'Creator earnings account'
    };
  }

  if (hasWinnerAccount) {
    return {
      type: 'winner',
      accountId: winnerAccountId,
      description: 'Prize winnings account'
    };
  }

  throw new Error('No valid Stripe account found for dashboard link generation');
}

module.exports = { handler }; 