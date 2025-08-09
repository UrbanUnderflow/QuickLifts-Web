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
    const accountTypeRaw = (event.queryStringParameters?.accountType || 'auto').toLowerCase();
    const accountType = ['creator', 'winner'].includes(accountTypeRaw) ? accountTypeRaw : 'auto';

    if (!userId) {
      return {
        statusCode: 400,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ success: false, error: 'Missing userId' }),
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
    // Single-account model: use creator if present, else winner, then backfill creator with the chosen id
    let accountId = null;
    if (accountType === 'creator') {
      accountId = userData?.creator?.stripeAccountId || userData?.winner?.stripeAccountId || null;
    } else if (accountType === 'winner') {
      accountId = userData?.winner?.stripeAccountId || userData?.creator?.stripeAccountId || null;
    } else { // auto
      accountId = userData?.creator?.stripeAccountId || userData?.winner?.stripeAccountId || null;
    }
    const username = userData?.username || 'me';

    if (!accountId) {
      return {
        statusCode: 400,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ success: false, error: 'No stripeAccountId on user. Run setup first.' }),
      };
    }

    // If we selected a winner account but creator is empty, backfill creator with this id
    try {
      if (accountId && (!userData.creator || !userData.creator.stripeAccountId)) {
        await db.collection('users').doc(userId).update({ 'creator.stripeAccountId': accountId });
      }
    } catch (bfErr) {
      console.warn('[CreateAccountUpdateLink] Backfill creator.stripeAccountId failed:', bfErr.message);
    }

    // Check current account state to choose link type
    const acct = await stripe.accounts.retrieve(accountId);
    const isRestricted = !!(
      acct?.requirements?.disabled_reason ||
      (Array.isArray(acct?.requirements?.currently_due) && acct.requirements.currently_due.length > 0) ||
      acct?.details_submitted !== true
    );
    const isValid = !!acct && !isRestricted;

    // Prefer account_update for active accounts, but gracefully fallback to onboarding if not allowed
    let linkType = isValid ? 'account_update' : 'account_onboarding';
    let link;
    try {
      link = await stripe.accountLinks.create({
        account: accountId,
        refresh_url: `${process.env.SITE_URL || 'https://fitwithpulse.ai'}/${accountType}/connect-account`,
        return_url: `${process.env.SITE_URL || 'https://fitwithpulse.ai'}/${username}/earnings?complete=true`,
        type: linkType,
      });
    } catch (err) {
      const message = err?.message || '';
      const notAllowed = message.includes('You cannot create `account_update` type Account Links');
      if (linkType === 'account_update' && notAllowed) {
        // Fallback to onboarding which is always permitted
        linkType = 'account_onboarding';
        link = await stripe.accountLinks.create({
          account: accountId,
          refresh_url: `${process.env.SITE_URL || 'https://fitwithpulse.ai'}/${accountType}/connect-account`,
          return_url: `${process.env.SITE_URL || 'https://fitwithpulse.ai'}/${username}/earnings?complete=true`,
          type: 'account_onboarding',
        });
      } else {
        throw err;
      }
    }

    // Persist for clients to reuse
    const update = {};
    update[`${accountType}.onboardingLink`] = link.url;
    update[`${accountType}.onboardingExpirationDate`] = link.expires_at;
    update[`${accountType}.onboardingStatus`] = isValid ? 'complete' : 'incomplete';
    update[`${accountType}.accountRestricted`] = !isValid;
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


