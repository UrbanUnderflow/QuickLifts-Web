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
      const endpoints = { data: [] };
      let starting_after;
      for (let page = 0; page < 10; page++) {
        const batch = await client.webhookEndpoints.list({ limit: 100, ...(starting_after ? { starting_after } : {}) });
        endpoints.data.push(...batch.data);
        if (!batch.has_more) break;
        if (!batch.data.length || page === 9) throw new Error('Incomplete webhook inventory');
        starting_after = batch.data.at(-1).id;
      }
      const existing = endpoints.data.filter(endpoint => endpoint.livemode === true && endpoint.status === 'enabled' && WEBHOOK_URLS.has(endpoint.url));
      const webhookCoverage = ['stripe-webhook', 'stripe-coach-webhook', 'stripe-deposit-webhook'].map(handler => {
        const urls = new Set([...WEBHOOK_URLS].map(url => url.replace(/stripe-webhook$/, handler)));
        return { handler, subscribedEvents: [...new Set(endpoints.data.filter(endpoint => endpoint.livemode === true && endpoint.status === 'enabled' && urls.has(endpoint.url)).flatMap(endpoint => endpoint.enabled_events || []))].sort() };
      });
      const delivers = name => existing.some(endpoint => endpoint.enabled_events?.includes('*') || endpoint.enabled_events?.includes(name));
      const missingEvents = ['payment_intent.succeeded', 'charge.refunded'].filter(name => !delivers(name));
      const configured = webhookCoverage.filter(item => ['stripe-webhook', 'stripe-deposit-webhook'].includes(item.handler)).some(item => item.subscribedEvents.includes('*') || item.subscribedEvents.includes('payment_intent.succeeded'));
      // Refunds are verified by bounded request-driven reads; no new webhook subscription is required.
      const invoiceDelivery = endpoints.data.some(endpoint => endpoint.livemode === true && endpoint.status === 'enabled' && WEBHOOK_URLS.has(endpoint.url)
        && (endpoint.enabled_events?.includes('*') || endpoint.enabled_events?.includes('invoice.paid')));
      const checkoutDelivery = delivers('checkout.session.completed');
      const monthlyReady = configured && invoiceDelivery && checkoutDelivery;
      return reply(200, { oneTimeReady: configured, monthlyReady, monthlyAmountIncrement: monthlyReady ? 1 : null,
        reason: configured ? 'existing_success_event_and_readthrough_refunds' : existing.length ? 'existing_webhook_missing_events' : 'existing_webhook_route_not_registered',
        webhookCoverage,
        subscribedEvents: [...new Set(existing.flatMap(endpoint => endpoint.enabled_events || []))].sort(),
        missingEvents, refundVerification: 'bounded_readthrough',
        monthlyReason: monthlyReady ? 'approved_donation_inline_prices' : !invoiceDelivery ? 'invoice_paid_not_enabled' : !checkoutDelivery ? 'checkout_completion_not_enabled' : 'one_time_prerequisites_unmet' });
    } catch { return reply(200, { oneTimeReady: false, monthlyReady: false, reason: 'payment_access_unavailable' }); }
  };
}
exports.createReadinessHandler = createReadinessHandler;
const productionHandler = createReadinessHandler({ env: process.env, stripe: () => require('stripe')(process.env.STRIPE_SECRET_KEY, { apiVersion: '2023-10-16', timeout: 4000, maxNetworkRetries: 0 }) });
let cached, pending, expiresAt = 0;
exports.handler = async event => {
  if (event.httpMethod !== 'GET') return productionHandler(event);
  if (cached && Date.now() < expiresAt) return cached;
  if (pending) return pending;
  pending = productionHandler(event).then(result => { cached = result; expiresAt = Date.now()+60000; return result; }).finally(() => { pending = null; });
  return pending;
};
