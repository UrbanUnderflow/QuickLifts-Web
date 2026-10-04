const Stripe = require('stripe');
const { headers } = require('./config/firebase');
const { verifyFirebaseUser, resolveServerStripeMode } = require('./lib/pulsecheck-coach-services');
const { loadTeamInvoices } = require('./lib/pulsecheck-team-invoices');
exports.handler = async event => {
  const responseHeaders = { ...headers, 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: responseHeaders, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: responseHeaders, body: '{}' };
  try {
    const auth = await verifyFirebaseUser(event);
    let body;
    try { body = JSON.parse(event.body || '{}'); } catch { throw Object.assign(new Error('Invalid request.'), { statusCode: 400 }); }
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw Object.assign(new Error('Invalid request.'), { statusCode: 400 });
    const stripeMode = resolveServerStripeMode();
    const key = stripeMode === 'test' ? process.env.STRIPE_TEST_SECRET_KEY : process.env.STRIPE_SECRET_KEY;
    if (!key) throw Object.assign(new Error('Payment history is temporarily unavailable.'), { statusCode: 503 });
    const result = await loadTeamInvoices({ database: auth.app.firestore(), userId: auth.userId,
      teamId: body.teamId, cursor: body.cursor, stripe: new Stripe(key), stripeMode,
      firebaseMode: auth.app.name === 'pulsecheck-dev-admin' ? 'dev' : 'prod', cursorSecret: key });
    return { statusCode: 200, headers: responseHeaders, body: JSON.stringify(result) };
  } catch (error) {
    return { statusCode: error.statusCode || 500, headers: responseHeaders, body: JSON.stringify({ message: error.statusCode ? error.message : 'Your payment history could not be loaded. Please try again.' }) };
  }
};
