// Function to validate and fix email mismatches between Pulse profiles and Stripe accounts
const { db } = require('./config/firebase');
const Stripe = require('stripe');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
};

const handler = async (event) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  try {
    const { userId, fix = false } = event.queryStringParameters || {};

    if (userId) {
      // Check specific user
      return await validateSingleUser(userId, fix === 'true');
    } else {
      // Check all users with Stripe accounts
      return await validateAllUsers(fix === 'true');
    }

  } catch (error) {
    console.error('[ValidateUserStripeAccounts] Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error.message
      })
    };
  }
};

async function validateSingleUser(userId, shouldFix) {
  console.log(`[ValidateUserStripeAccounts] Checking user: ${userId}, fix: ${shouldFix}`);

  const userDoc = await db.collection('users').doc(userId).get();
  if (!userDoc.exists) {
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
  const pulseEmail = userData.email;
  
  const issues = [];
  const fixes = [];

  // Check creator account
  if (userData.creator?.stripeAccountId) {
    const creatorResult = await checkStripeAccount(
      userData.creator.stripeAccountId, 
      pulseEmail, 
      'creator', 
      userId,
      shouldFix
    );
    if (creatorResult.hasIssue) {
      issues.push(creatorResult);
      if (creatorResult.fixed) fixes.push(creatorResult);
    }
  }

  // Check winner account
  if (userData.winner?.stripeAccountId) {
    const winnerResult = await checkStripeAccount(
      userData.winner.stripeAccountId, 
      pulseEmail, 
      'winner', 
      userId,
      shouldFix
    );
    if (winnerResult.hasIssue) {
      issues.push(winnerResult);
      if (winnerResult.fixed) fixes.push(winnerResult);
    }
  }

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      success: true,
      userId: userId,
      pulseEmail: pulseEmail,
      totalIssues: issues.length,
      issues: issues,
      fixesApplied: fixes.length,
      fixes: fixes
    })
  };
}

async function validateAllUsers(shouldFix) {
  console.log(`[ValidateUserStripeAccounts] Checking all users, fix: ${shouldFix}`);

  const usersSnapshot = await db.collection('users').get();
  const allIssues = [];
  const allFixes = [];

  for (const userDoc of usersSnapshot.docs) {
    const userId = userDoc.id;
    const userData = userDoc.data();
    const pulseEmail = userData.email;

    if (!pulseEmail) continue; // Skip users without email

    // Check creator account
    if (userData.creator?.stripeAccountId) {
      const creatorResult = await checkStripeAccount(
        userData.creator.stripeAccountId, 
        pulseEmail, 
        'creator', 
        userId,
        shouldFix
      );
      if (creatorResult.hasIssue) {
        allIssues.push(creatorResult);
        if (creatorResult.fixed) allFixes.push(creatorResult);
      }
    }

    // Check winner account
    if (userData.winner?.stripeAccountId) {
      const winnerResult = await checkStripeAccount(
        userData.winner.stripeAccountId, 
        pulseEmail, 
        'winner', 
        userId,
        shouldFix
      );
      if (winnerResult.hasIssue) {
        allIssues.push(winnerResult);
        if (winnerResult.fixed) allFixes.push(winnerResult);
      }
    }
  }

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      success: true,
      totalUsers: usersSnapshot.size,
      totalIssues: allIssues.length,
      issues: allIssues,
      fixesApplied: allFixes.length,
      fixes: allFixes,
      summary: {
        emailMismatches: allIssues.filter(i => i.type === 'email_mismatch').length,
        payoutDisabled: allIssues.filter(i => i.type === 'payout_disabled').length,
        accountNotFound: allIssues.filter(i => i.type === 'account_not_found').length
      }
    })
  };
}

async function checkStripeAccount(stripeAccountId, expectedEmail, accountType, userId, shouldFix) {
  try {
    const account = await stripe.accounts.retrieve(stripeAccountId);
    
    const result = {
      userId: userId,
      accountType: accountType,
      stripeAccountId: stripeAccountId,
      expectedEmail: expectedEmail,
      actualEmail: account.email,
      payoutsEnabled: account.payouts_enabled,
      hasIssue: false,
      type: null,
      message: null,
      fixed: false,
      fixMessage: null
    };

    // Check for email mismatch
    if (account.email && account.email !== expectedEmail) {
      result.hasIssue = true;
      result.type = 'email_mismatch';
      result.message = `Email mismatch: Stripe(${account.email}) vs Pulse(${expectedEmail})`;
      
      if (shouldFix) {
        try {
          // Note: We cannot change the email of an existing Stripe account
          // This would require creating a new account or manual intervention
          result.fixMessage = 'EMAIL MISMATCH CANNOT BE AUTO-FIXED. Manual intervention required.';
          console.error(`[ValidateUserStripeAccounts] Cannot auto-fix email mismatch for ${userId} ${accountType} account`);
        } catch (fixError) {
          result.fixMessage = `Fix failed: ${fixError.message}`;
        }
      }
    }

    // Check if payouts are disabled
    if (!account.payouts_enabled) {
      result.hasIssue = true;
      result.type = 'payout_disabled';
      result.message = 'Payouts are not enabled on this Stripe account';
      
      if (shouldFix) {
        result.fixMessage = 'PAYOUT DISABLED - User must complete Stripe onboarding';
      }
    }

    return result;

  } catch (error) {
    return {
      userId: userId,
      accountType: accountType,
      stripeAccountId: stripeAccountId,
      expectedEmail: expectedEmail,
      hasIssue: true,
      type: 'account_not_found',
      message: `Stripe account not found or inaccessible: ${error.message}`,
      fixed: false,
      fixMessage: shouldFix ? 'ACCOUNT NOT FOUND - May need to be recreated' : null
    };
  }
}

module.exports = { handler };