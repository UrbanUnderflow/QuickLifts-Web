// Returns monthly transaction details for a coach (connected Stripe account)
// Query: ?userId=...&month=YYYY-MM

const Stripe = require('stripe');
const { db, headers } = require('./config/firebase');

let stripe;
try {
  if (process.env.STRIPE_SECRET_KEY) {
    stripe = Stripe(process.env.STRIPE_SECRET_KEY);
  }
} catch (_) {}

function startEndForMonth(monthKey) {
  // monthKey expected YYYY-MM
  const [yStr, mStr] = (monthKey || '').split('-');
  const y = parseInt(yStr, 10);
  const m = parseInt(mStr, 10); // 1-12
  if (!y || !m || m < 1 || m > 12) return null;
  const start = new Date(y, m - 1, 1, 0, 0, 0, 0);
  const end = new Date(y, m, 1, 0, 0, 0, 0); // first of next month
  return { start, end };
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'GET, OPTIONS' } };
  }

  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers, body: JSON.stringify({ success: false, error: 'Method not allowed' }) };
  }

  try {
    const userId = event.queryStringParameters?.userId;
    const monthKey = event.queryStringParameters?.month; // YYYY-MM
    if (!userId || !monthKey) {
      return { statusCode: 400, headers, body: JSON.stringify({ success: false, error: 'Missing userId or month' }) };
    }

    const range = startEndForMonth(monthKey);
    if (!range) {
      return { statusCode: 400, headers, body: JSON.stringify({ success: false, error: 'Invalid month format (YYYY-MM)' }) };
    }

    // Only allow statements for completed months (before current month)
    const now = new Date();
    if (range.end > now) {
      return { statusCode: 400, headers, body: JSON.stringify({ success: false, error: 'Statement available after month ends' }) };
    }

    // Fetch the user's connected account
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      return { statusCode: 404, headers, body: JSON.stringify({ success: false, error: 'User not found' }) };
    }
    const data = userDoc.data();
    const accountId = data?.creator?.stripeAccountId;
    if (!accountId || !stripe) {
      return { statusCode: 400, headers, body: JSON.stringify({ success: false, error: 'Stripe account missing or Stripe not configured' }) };
    }

    // Query payment intents for the month
    const gte = Math.floor(range.start.getTime() / 1000);
    const lt = Math.floor(range.end.getTime() / 1000);
    const intents = await stripe.paymentIntents.list({
      created: { gte, lt },
      limit: 100,
      stripeAccount: accountId
    });

    // Map to statement lines (succeeded only)
    const transactions = (intents.data || [])
      .filter(pi => pi.status === 'succeeded')
      .map(pi => ({
        id: pi.id,
        date: new Date(pi.created * 1000).toISOString().split('T')[0],
        amount: (pi.amount || 0) / 100,
        description: pi.description || (pi.metadata?.roundTitle || 'Fitness Program'),
        buyerEmail: pi.metadata?.buyerEmail || '',
        buyerId: pi.metadata?.buyerId || pi.metadata?.userId || 'anonymous'
      }))
      .sort((a, b) => new Date(b.date) - new Date(a.date));

    const total = transactions.reduce((s, t) => s + t.amount, 0);

    return {
      statusCode: 200,
      headers: { ...headers, 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ success: true, month: monthKey, total, count: transactions.length, transactions })
    };
  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ success: false, error: e.message || 'Internal error' }) };
  }
};


