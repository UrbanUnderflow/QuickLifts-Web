// Public availability only. Credentials, endpoint URLs, balances, prices and donor data never leave the server.
// This uses existing production access and performs no Stripe mutations.
const PIL_ACCOUNT = 'acct_1Sd8YLIkArZc741W';
const WEBHOOK_URLS = new Set([
  'https://fitwithpulse.ai/.netlify/functions/stripe-webhook',
  'https://quickliftsapp.netlify.app/.netlify/functions/stripe-webhook',
  // Existing aliases verified on the same Netlify backend; all serve this exact signed handler.
  ...['www.fitwithpulse.ai', 'eatwithmacra.ai', 'www.eatwithmacra.ai', 'pulsecheckmind.ai', 'www.pulsecheckmind.ai', 'pulseintelligencelabs.com', 'www.pulseintelligencelabs.com'].map(host => `https://${host}/.netlify/functions/stripe-webhook`),
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
      const existing = endpoints.data.filter(endpoint => endpoint.livemode === true && endpoint.status === 'enabled' && WEBHOOK_URLS.has(endpoint.url));
      const delivers = name => existing.some(endpoint => endpoint.enabled_events?.includes('*') || endpoint.enabled_events?.includes(name));
      const missingEvents = ['payment_intent.succeeded', 'charge.refunded'].filter(name => !delivers(name));
      const configured = missingEvents.length === 0;
      let monthlyPrice = null;
      let catalogReadable = true;
      try { monthlyPrice = await require('./lib/athleticmind-giving-deployment').findDonationMonthlyPrice(client); } catch { catalogReadable = false; /* No access expansion; keep monthly closed. */ }
      const invoiceDelivery = endpoints.data.some(endpoint => endpoint.livemode === true && endpoint.status === 'enabled' && WEBHOOK_URLS.has(endpoint.url)
        && (endpoint.enabled_events?.includes('*') || endpoint.enabled_events?.includes('invoice.paid')));
      const monthlyReady = !!(configured && invoiceDelivery && monthlyPrice);
      return reply(200, { oneTimeReady: configured, monthlyReady, monthlyAmountIncrement: monthlyReady ? monthlyPrice.unit_amount : null,
        reason: configured ? 'existing_payment_setup_verified' : existing.length ? 'existing_webhook_missing_events' : 'existing_webhook_route_not_registered',
        missingEvents, monthlyReason: !catalogReadable ? 'catalog_read_unavailable' : !monthlyPrice ? 'no_existing_donation_price' : !invoiceDelivery ? 'invoice_paid_not_enabled' : !configured ? 'one_time_prerequisites_unmet' : 'ready' });
    } catch { return reply(200, { oneTimeReady: false, monthlyReady: false, reason: 'payment_access_unavailable' }); }
  };
}
exports.createReadinessHandler = createReadinessHandler;
exports.handler = createReadinessHandler({ env: process.env, stripe: () => require('stripe')(process.env.STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' }) });
