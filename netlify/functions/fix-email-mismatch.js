// Function to fix email mismatches between Pulse and Stripe accounts
const { db } = require('./config/firebase');
const Stripe = require('stripe');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
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

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ success: false, error: 'Method not allowed' })
    };
  }

  try {
    const { userId, fixMethod = 'create_new_account' } = JSON.parse(event.body);

    if (!userId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Missing userId'
        })
      };
    }

    // Get user data
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

    console.log(`[FixEmailMismatch] Processing user ${userId}, method: ${fixMethod}`);
    
    const results = {
      userId: userId,
      pulseEmail: pulseEmail,
      fixesApplied: [],
      errors: []
    };

    // Fix creator account if exists
    if (userData.creator?.stripeAccountId) {
      try {
        const creatorResult = await fixStripeAccount(
          userData.creator.stripeAccountId,
          pulseEmail,
          'creator',
          userId,
          fixMethod
        );
        results.fixesApplied.push(creatorResult);
      } catch (error) {
        results.errors.push({
          accountType: 'creator',
          error: error.message
        });
      }
    }

    // Fix winner account if exists
    if (userData.winner?.stripeAccountId) {
      try {
        const winnerResult = await fixStripeAccount(
          userData.winner.stripeAccountId,
          pulseEmail,
          'winner',
          userId,
          fixMethod
        );
        results.fixesApplied.push(winnerResult);
      } catch (error) {
        results.errors.push({
          accountType: 'winner',
          error: error.message
        });
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: `Fixed ${results.fixesApplied.length} accounts`,
        results: results
      })
    };

  } catch (error) {
    console.error('[FixEmailMismatch] Error:', error);
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

async function fixStripeAccount(stripeAccountId, expectedEmail, accountType, userId, fixMethod) {
  console.log(`[FixEmailMismatch] Fixing ${accountType} account ${stripeAccountId}`);

  // Check current account
  const currentAccount = await stripe.accounts.retrieve(stripeAccountId);
  
  if (currentAccount.email === expectedEmail) {
    return {
      accountType: accountType,
      action: 'no_fix_needed',
      message: 'Email already matches',
      stripeAccountId: stripeAccountId
    };
  }

  console.log(`[FixEmailMismatch] Email mismatch detected: Stripe(${currentAccount.email}) vs Pulse(${expectedEmail})`);

  if (fixMethod === 'create_new_account') {
    return await createNewStripeAccount(accountType, userId, expectedEmail, stripeAccountId);
  } else if (fixMethod === 'update_pulse_email') {
    return await updatePulseEmail(accountType, userId, currentAccount.email);
  } else {
    throw new Error(`Unknown fix method: ${fixMethod}`);
  }
}

async function createNewStripeAccount(accountType, userId, correctEmail, oldAccountId) {
  console.log(`[FixEmailMismatch] Creating new ${accountType} account with email: ${correctEmail}`);

  // Get user data for account creation
  const userDoc = await db.collection('users').doc(userId).get();
  const userData = userDoc.data();

  // Check if old account can be safely deleted (zero balance)
  let canDeleteOld = false;
  let oldAccountBalance = null;
  
  try {
    const balance = await stripe.balance.retrieve({ stripeAccount: oldAccountId });
    const hasBalance = balance.available.some(b => b.amount > 0) || balance.pending.some(b => b.amount > 0);
    canDeleteOld = !hasBalance;
    oldAccountBalance = balance;
  } catch (error) {
    console.warn(`[FixEmailMismatch] Could not check balance for old account ${oldAccountId}:`, error.message);
  }

  // Create new account with correct email
  const newAccount = await stripe.accounts.create({
    type: 'express',
    email: correctEmail,
    country: 'US',
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
      tax_reporting_us_1099_k: { requested: true },
      tax_reporting_us_1099_misc: { requested: true }
    },
    business_type: 'individual',
    business_profile: {
      product_description: accountType === 'creator' 
        ? 'Fitness training and workout programs'
        : 'Challenge winner prize money recipient',
      url: `https://fitwithpulse.ai/profile/${userData.username}`,
      mcc: '7991'
    },
    metadata: {
      platform: 'pulse',
      account_type: accountType,
      user_id: userId,
      username: userData.username,
      purpose: accountType === 'creator' ? 'creator_earnings' : 'prize_money',
      pulse_email: correctEmail,
      replaced_account: oldAccountId,
      fix_reason: 'email_mismatch'
    }
  });

  console.log(`[FixEmailMismatch] Created new account: ${newAccount.id}`);

  // Create onboarding link
  const accountLink = await stripe.accountLinks.create({
    account: newAccount.id,
    refresh_url: `https://fitwithpulse.ai/${accountType}/connect-account`,
    return_url: `https://fitwithpulse.ai/${accountType}/dashboard?complete=true`,
    type: "account_onboarding",
  });

  // Update user document
  const updateData = {};
  updateData[`${accountType}.stripeAccountId`] = newAccount.id;
  updateData[`${accountType}.onboardingStatus`] = 'incomplete';
  updateData[`${accountType}.onboardingLink`] = accountLink.url;
  updateData[`${accountType}.onboardingExpirationDate`] = accountLink.expires_at;
  updateData[`${accountType}.onboardingPayoutState`] = 'introduction';
  updateData[`${accountType}.emailFixed`] = true;
  updateData[`${accountType}.emailFixedAt`] = new Date();
  updateData[`${accountType}.oldAccountId`] = oldAccountId;

  await db.collection('users').doc(userId).update(updateData);

  // Try to delete old account if safe
  let deletionResult = null;
  if (canDeleteOld) {
    try {
      await stripe.accounts.delete(oldAccountId);
      deletionResult = { success: true, message: 'Old account deleted successfully' };
      console.log(`[FixEmailMismatch] Deleted old account: ${oldAccountId}`);
    } catch (deleteError) {
      deletionResult = { success: false, error: deleteError.message };
      console.warn(`[FixEmailMismatch] Could not delete old account ${oldAccountId}:`, deleteError.message);
    }
  } else {
    deletionResult = { 
      success: false, 
      message: 'Old account has balance - manual deletion required',
      balance: oldAccountBalance
    };
  }

  return {
    accountType: accountType,
    action: 'created_new_account',
    oldAccountId: oldAccountId,
    newAccountId: newAccount.id,
    onboardingLink: accountLink.url,
    oldAccountDeletion: deletionResult,
    message: `Created new ${accountType} account with correct email. User must complete onboarding.`
  };
}

async function updatePulseEmail(accountType, userId, stripeEmail) {
  console.log(`[FixEmailMismatch] Updating Pulse email to match Stripe: ${stripeEmail}`);

  // Update user email in Pulse
  await db.collection('users').doc(userId).update({
    email: stripeEmail,
    emailUpdatedReason: 'stripe_account_mismatch_fix',
    emailUpdatedAt: new Date()
  });

  return {
    accountType: accountType,
    action: 'updated_pulse_email',
    newEmail: stripeEmail,
    message: `Updated Pulse profile email to match Stripe account`
  };
}

module.exports = { handler };