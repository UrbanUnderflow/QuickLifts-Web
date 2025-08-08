// Creates a fresh Stripe Account Link for onboarding/update so users can edit their payout info any time
// Usage: GET /.netlify/functions/create-account-update-link?userId=...&accountType=creator|winner

const Stripe = require('stripe');
const { db } = require('./config/firebase');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event) => {
  // CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
      },
      body: '',
    };
  }

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ success: false, error: 'Method not allowed' }),
    };
  }

  try {
    const userId = event.queryStringParameters?.userId;
    const accountType = (event.queryStringParameters?.accountType || 'creator').toLowerCase();

    if (!userId || !['creator', 'winner'].includes(accountType)) {
      return {
        statusCode: 400,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ success: false, error: 'Missing userId or invalid accountType' }),
      };
    }

    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      return {
        statusCode: 404,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ success: false, error: 'User not found' }),
      };
    }

    const userData = userDoc.data();
    const accountId = userData?.[accountType]?.stripeAccountId;
    const username = userData?.username || 'me';

    if (!accountId) {
      return {
        statusCode: 400,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ success: false, error: 'No stripeAccountId on user. Run setup first.' }),
      };
    }

    // Check current account state to choose link type
    const acct = await stripe.accounts.retrieve(accountId);
    const isValid = !!acct && !acct.restricted && acct.details_submitted === true;
    const linkType = isValid ? 'account_update' : 'account_onboarding';

    const link = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${process.env.SITE_URL || 'https://fitwithpulse.ai'}/${accountType}/connect-account`,
      return_url: `${process.env.SITE_URL || 'https://fitwithpulse.ai'}/${username}/earnings?complete=true`,
      type: linkType,
    });

    // Persist for clients to reuse
    const update = {};
    update[`${accountType}.onboardingLink`] = link.url;
    update[`${accountType}.onboardingExpirationDate`] = link.expires_at;
    update[`${accountType}.onboardingStatus`] = isValid ? 'complete' : 'incomplete';
    await db.collection('users').doc(userId).update(update);

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-store',
      },
      body: JSON.stringify({ success: true, link: link.url, linkType, accountId }),
    };
  } catch (error) {
    console.error('[CreateAccountUpdateLink] Error:', error);
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-store',
      },
      body: JSON.stringify({ success: false, error: error.message }),
    };
  }
};


