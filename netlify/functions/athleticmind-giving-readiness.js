// Public availability only. Credentials, endpoint URLs, balances, prices and donor data never leave the server.
// This uses existing production access and performs no Stripe mutations.
const PIL_ACCOUNT = 'acct_1Sd8YLIkArZc741W';
const WEBHOOK_URLS = new Set([
  'https://fitwithpulse.ai/.netlify/functions/stripe-webhook',
  'https://quickliftsapp.netlify.app/.netlify/functions/stripe-webhook',
]);
function createReadinessHandler({ env, stripe }) {
  return async event => {
    const reply = (statusCode, data) => ({ statusCode, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify(data) });
    if (event.httpMethod !== 'GET') return reply(405, { error: 'Method unavailable.' });
    if (!/^sk_live_/.test(env.STRIPE_SECRET_KEY || '')) return reply(200, { oneTimeReady: false, monthlyReady: false, reason: 'payment_access_unavailable' });
    try {
      const client = stripe();
      const account = await client.accounts.retrieve();
      if (account.id !== PIL_ACCOUNT || account.charges_enabled !== true) return reply(200, { oneTimeReady: false, monthlyReady: false, reason: 'account_not_ready' });
      const endpoints = await client.webhookEndpoints.list({ limit: 100 });
      const configured = endpoints.data.some(endpoint => endpoint.livemode === true && endpoint.status === 'enabled'
        && WEBHOOK_URLS.has(endpoint.url)
        && ['payment_intent.succeeded', 'charge.refunded'].every(name => endpoint.enabled_events?.includes('*') || endpoint.enabled_events?.includes(name)));
      let monthlyPrice = null;
      try { monthlyPrice = await require('./lib/athleticmind-giving-deployment').findDonationMonthlyPrice(client); } catch { /* No access expansion; keep monthly closed. */ }
      const invoiceDelivery = endpoints.data.some(endpoint => endpoint.livemode === true && endpoint.status === 'enabled' && WEBHOOK_URLS.has(endpoint.url)
        && (endpoint.enabled_events?.includes('*') || endpoint.enabled_events?.includes('invoice.paid')));
      const monthlyReady = !!(configured && invoiceDelivery && monthlyPrice);
      return reply(200, { oneTimeReady: configured, monthlyReady, monthlyAmountIncrement: monthlyReady ? monthlyPrice.unit_amount : null,
        reason: configured ? 'existing_payment_setup_verified' : 'existing_webhook_unverified' });
    } catch { return reply(200, { oneTimeReady: false, monthlyReady: false, reason: 'payment_access_unavailable' }); }
  };
}
exports.createReadinessHandler = createReadinessHandler;
exports.handler = createReadinessHandler({ env: process.env, stripe: () => require('stripe')(process.env.STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' }) });
