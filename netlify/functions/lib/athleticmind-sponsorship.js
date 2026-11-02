const { createHash } = require('node:crypto');
const SOURCE = 'athleticmind-sponsorship-v1';
const CAMPAIGNS = Object.freeze({ general: { title: 'Student-athlete program access', approved: true } });
const fail = (message, status = 400) => Object.assign(new Error(message), { status });
function publicProfile(body) {
  if (body.publicDisplay !== true) return null;
  const clean = (value, max) => typeof value === 'string' ? value.normalize('NFKC').replace(/[\u0000-\u001f\u007f]/g, '').trim().replace(/\s+/g, ' ').slice(0, max) : '';
  const school = clean(body.school, 100);
  return { name: body.anonymous === true ? 'Anonymous supporter' : clean(body.name, 60) || 'Anonymous supporter', school, schoolKey: school.toLocaleLowerCase('en-US').replace(/[^\p{L}\p{N}]+/gu, ' ').trim(), message: clean(body.message, 300) };
}
function validate(body) {
  if (!body || !Number.isSafeInteger(body.amount) || body.amount < 500 || body.amount > 1000000) throw fail('Choose an amount from $5 to $10,000.');
  if (!CAMPAIGNS[body.campaign]?.approved) throw fail('Choose an available program.');
  if (!/^[a-f0-9-]{36}$/.test(body.requestId || '')) throw fail('Invalid checkout request.');
  const frequency = body.frequency || 'once';
  if (!['once', 'monthly'].includes(frequency)) throw fail('Choose one-time or monthly giving.');
  if (frequency === 'monthly' && body.recurringConsent !== true) throw fail('Confirm your monthly giving authorization.');
  return { amount: body.amount, campaign: body.campaign, requestId: body.requestId, frequency, profile: publicProfile(body) };
}
function configuration(env) {
  const mode = env.ATHLETICMIND_SPONSOR_MODE;
  const live = mode === 'live';
  const keyName = live ? 'STRIPE_SECRET_KEY' : 'STRIPE_TEST_SECRET_KEY';
  if (!['test', 'live'].includes(mode) || !(live ? /^sk_live_/ : /^sk_test_/).test(env[keyName] || '') || !/^acct_[A-Za-z0-9]+$/.test(env.ATHLETICMIND_STRIPE_ACCOUNT_ID || '')) throw fail('Giving is not available.', 503);
  const origin = new URL(env.ATHLETICMIND_SPONSOR_ORIGIN);
  if (origin.origin !== env.ATHLETICMIND_SPONSOR_ORIGIN || (origin.protocol !== 'https:' && (live || !['localhost', '127.0.0.1'].includes(origin.hostname)))) throw fail('Giving configuration unavailable.', 503);
  const result = { mode, live, keyName, origin: origin.origin, account: env.ATHLETICMIND_STRIPE_ACCOUNT_ID, collection: live ? 'athleticmind-sponsorship-live' : 'athleticmind-sponsorship-test', firebaseMode: live ? 'prod' : 'dev' };
  if (live) {
    // This is a launch gate, not evidence of merchant approval. Set only after the recipient and terms are explicitly approved.
    if (env.ATHLETICMIND_SPONSOR_LIVE_APPROVED !== 'true') throw fail('Live giving has not been approved and configured.', 503);
    const recipient = env.ATHLETICMIND_SPONSOR_RECIPIENT_NAME?.trim();
    const termsVersion = env.ATHLETICMIND_SPONSOR_TERMS_VERSION?.trim();
    const supportEmail = env.ATHLETICMIND_SPONSOR_SUPPORT_EMAIL?.trim();
    if (!recipient || recipient.length > 120 || !termsVersion || termsVersion.length > 80 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(supportEmail || '')) throw fail('Approved recipient and payment terms are required.', 503);
    const termsURL = new URL(env.ATHLETICMIND_SPONSOR_TERMS_URL);
    const refundURL = new URL(env.ATHLETICMIND_SPONSOR_REFUND_URL);
    if ([termsURL, refundURL].some(url => url.protocol !== 'https:' || (url.origin !== origin.origin && url.href !== 'https://fitwithpulse.ai/terms') || url.username || url.password)) throw fail('Approved payment policy URLs are required.', 503);
    Object.assign(result, { recipient, termsVersion, supportEmail, termsURL: termsURL.href, refundURL: refundURL.href });
  }
  return result;
}
// Reuses Pulse's subscription Checkout contract. No catalog mutation is needed for an approved existing price.
async function monthlyLineItem({ env, client, config, amount }) {
  const priceId = env.ATHLETICMIND_SPONSOR_MONTHLY_PRICE_ID;
  if (priceId) {
    if (!/^price_[A-Za-z0-9]+$/.test(priceId)) throw fail('Monthly giving is temporarily unavailable.', 503);
    const price = await client.prices.retrieve(priceId, { expand: ['product'] });
    if (price.livemode !== config.live || price.active !== true || price.currency !== 'usd'
      || price.type !== 'recurring' || price.recurring?.interval !== 'month' || price.recurring?.interval_count !== 1
      || price.recurring?.usage_type !== 'licensed' || price.billing_scheme !== 'per_unit' || price.transform_quantity
      || !Number.isSafeInteger(price.unit_amount) || price.unit_amount <= 0
      || typeof price.product !== 'object' || price.product.deleted || price.product.active !== true) throw fail('Monthly giving is temporarily unavailable.', 503);
    if (config.live && !require('./athleticmind-giving-deployment').isDonationMonthlyPrice(price)) throw fail('A verified donation price is required for monthly giving.', 503);
    const quantity = amount / price.unit_amount;
    // Never round, silently substitute a different amount, or reuse a client-supplied price ID.
    if (!Number.isSafeInteger(quantity) || quantity < 1) throw fail('Monthly giving is not available for this exact amount. Your amount has not been changed or charged.', 409);
    return { price: price.id, quantity };
  }
  // Pulse coach-service checkout uses inline price_data for custom amounts. Live use creates catalog records,
  // so it remains gated under the user's no-new-products/prices instruction until specifically authorized.
  if (config.live && env.ATHLETICMIND_SPONSOR_ALLOW_NEW_PRICE_RECORDS !== 'true') throw fail('Monthly giving is awaiting activation. No payment has been created.', 503);
  return { quantity: 1, price_data: { currency: 'usd', unit_amount: amount, recurring: { interval: 'month' }, product_data: { name: `${config.live ? '' : 'TEST: '}AthleticMind monthly program contribution` } } };
}
// Cumulative snapshots, not additive event amounts: duplicates and out-of-order refunds cannot inflate totals.
async function record(db, eventId, payment, collection = 'athleticmind-sponsorship-test') {
  if (!['athleticmind-sponsorship-test', 'athleticmind-sponsorship-live'].includes(collection)) throw fail('Ledger unavailable.', 500);
  const root = db.collection(collection);
  const paymentRef = root.doc('ledger').collection('payments').doc(payment.id);
  const eventRef = root.doc('ledger').collection('events').doc(eventId);
  const totalRef = root.doc('totals');
  await db.runTransaction(async tx => {
    const group = payment.group || payment.id;
    const boardRef = root.doc('board').collection('supporters').doc(group);
    const [seen, previous, totals, board] = await Promise.all([tx.get(eventRef), tx.get(paymentRef), tx.get(totalRef), tx.get(boardRef)]);
    if (seen.exists) return;
    const old = previous.data() || { gross: 0, refunded: 0 };
    if (previous.exists && old.campaign !== payment.campaign) throw fail('Campaign mismatch.', 500);
    const gross = Math.max(old.gross, payment.gross);
    const refunded = Math.min(gross, Math.max(old.refunded, payment.refunded));
    const aggregate = totals.data() || { gross: 0, refunded: 0, payments: 0 };
    const profile = old.profile || payment.profile || null;
    const priorBoard = board.data() || { net: 0 };
    const net = priorBoard.net + gross - refunded - (old.gross - old.refunded);
    const schoolKey = profile?.schoolKey;
    const schoolRef = schoolKey ? root.doc('board').collection('schools').doc(createHash('sha256').update(schoolKey).digest('hex')) : null;
    const school = schoolRef ? (await tx.get(schoolRef)).data() || { name: profile.school, count: 0 } : null;
    if (profile) {
      tx.set(boardRef, { ...profile, net, updated: Math.max(priorBoard.updated || 0, payment.created || 0) });
      if (schoolRef) tx.set(schoolRef, { ...school, count: school.count + (net > 0 ? 1 : 0) - (priorBoard.net > 0 ? 1 : 0) });
    }
    tx.set(paymentRef, { campaign: payment.campaign, gross, refunded, profile, group });
    tx.set(totalRef, { gross: aggregate.gross + gross - old.gross, refunded: aggregate.refunded + refunded - old.refunded, payments: aggregate.payments + (previous.exists ? 0 : 1) });
    tx.set(eventRef, { processed: true });
  });
}
// Internal entry point: call only after the established webhook has verified the signature.
// The HTTP donation endpoint cannot supply a verified event or bypass signature validation.
async function processVerifiedEvent({ signed, client, database, config }) {
        if (signed.livemode !== config.live || signed.account) throw fail('Unexpected payment account or mode.');
        if (!['checkout.session.completed', 'checkout.session.async_payment_succeeded', 'charge.refunded', 'invoice.payment_succeeded', 'invoice.paid', 'payment_intent.succeeded'].includes(signed.type)) return false;
        let object = signed.data.object;
        if (signed.type === 'charge.refunded' && object.metadata?.source !== SOURCE && !object.invoice) object = await client.charges.retrieve(object.id);
        // Retrieve invoices using the pinned API version. Event payload versions may differ.
        let invoice = null;
        if (['invoice.payment_succeeded', 'invoice.paid'].includes(signed.type)) invoice = await client.invoices.retrieve(object.id);
        if (signed.type === 'charge.refunded' && object.invoice) invoice = await client.invoices.retrieve(typeof object.invoice === 'string' ? object.invoice : object.invoice.id);
        let metadata = invoice?.subscription_details?.metadata || object.metadata;
        if (invoice && metadata?.source !== SOURCE && invoice.subscription) {
          const subscription = await client.subscriptions.retrieve(typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription.id);
          if (subscription.livemode !== config.live) throw fail('Unexpected giving mode.');
          metadata = subscription.metadata;
        }
        if (metadata?.source !== SOURCE) return false;
        if (signed.type.startsWith('checkout.') && (object.mode === 'subscription' || object.payment_status !== 'paid')) return false;
        if (invoice && (!invoice.paid || invoice.livemode !== config.live || !invoice.payment_intent)) return false;
        const campaign = metadata.campaign;
        if (!CAMPAIGNS[campaign]?.approved) throw fail('Unknown campaign.');
        const paymentIntent = invoice ? invoice.payment_intent : signed.type === 'payment_intent.succeeded' ? object.id : object.payment_intent;
        const pi = await client.paymentIntents.retrieve(typeof paymentIntent === 'string' ? paymentIntent : paymentIntent?.id, { expand: ['latest_charge'] });
        const charge = pi.latest_charge;
        if (pi.livemode !== config.live || (!invoice && (pi.metadata?.source !== SOURCE || pi.metadata?.campaign !== campaign)) || pi.currency !== 'usd' || !charge?.paid || charge.livemode !== config.live || charge.currency !== 'usd' || !Number.isSafeInteger(charge.amount) || !Number.isSafeInteger(charge.amount_refunded) || charge.amount_refunded < 0 || charge.amount_refunded > charge.amount || charge.amount <= 0) throw fail('Payment verification failed.', 500);
        // Use only the explicit public profile saved by our checkout; never billing identity.
        const verifiedMetadata = invoice ? metadata : pi.metadata;
        let profile = null;
        if (verifiedMetadata.public_display === 'yes') profile = publicProfile({ name: verifiedMetadata.public_name, school: verifiedMetadata.public_school, message: verifiedMetadata.public_message, publicDisplay: true });
        const subscription = invoice?.subscription;
        await record(database, signed.id, { id: pi.id, campaign, gross: charge.amount, refunded: charge.amount_refunded, profile, group: (typeof subscription === 'string' ? subscription : subscription?.id) || pi.id, created: charge.created || 0 }, config.collection);

  return true;
}
function createHandler({ env, stripe, database, publishableKey }) {
  const reply = (statusCode, data, origin) => ({ statusCode, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...(origin ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' } : {}) }, body: JSON.stringify(data) });
  return async event => {
    let config;
    try { config = configuration(env); } catch { return reply(503, { error: 'Checkout is closed while the program is being prepared.' }); }
    const action = event.queryStringParameters?.action;
    const origin = event.headers?.origin;
    const cors = origin === config.origin ? origin : undefined;
    try {
      if (action !== 'webhook' && origin && !cors) return reply(403, { error: 'Origin unavailable.' });
      if (event.httpMethod === 'OPTIONS') return reply(204, {}, cors);
      const client = stripe();
      const account = await client.accounts.retrieve();
      if (account.id !== config.account) throw fail('Payment account does not match configuration.', 503);
      if (['checkout', 'payment-intent'].includes(action) && event.httpMethod === 'POST') {
        if (!cors) return reply(403, { error: 'Origin required.' });
        const body = JSON.parse(event.body || '{}');
        const input = validate(body);
        if (config.live && (body.termsAccepted !== true || body.termsVersion !== config.termsVersion)) throw fail('Please review and accept the current payment terms.');
        const metadata = { ...(config.live ? { terms_version: config.termsVersion, terms_accepted: 'yes', recipient: config.recipient } : {}), source: SOURCE, request_id: input.requestId, campaign: input.campaign, public_display: input.profile ? 'yes' : '', public_name: input.profile?.name || '', public_school: input.profile?.school || '', public_message: input.profile?.message || '', recurring_consent: input.frequency === 'monthly' ? 'monthly-v1' : '' };
        if (action === 'payment-intent') {
          if (input.frequency !== 'once') throw fail('Monthly giving is not available through one-time checkout. No payment has been created.', 409);
          const publicKey = typeof publishableKey === 'function' ? publishableKey(config.mode) : '';
          if (!(config.live ? /^pk_live_/ : /^pk_test_/).test(publicKey)) throw fail('Payment form is unavailable.', 503);
          // A direct platform charge: no connected account, transfer, product, price, customer or saved payment method.
          const registered = config.live ? await require('./athleticmind-reconciliation').findRegisteredIntent({ db: database(), config, client, input }) : null;
          const intent = registered || await client.paymentIntents.create({
            amount: input.amount, currency: 'usd', payment_method_types: ['card'],
            description: 'AthleticMind program contribution to Pulse Intelligence Labs, Inc.', metadata,
          }, { idempotencyKey: `${SOURCE}:intent:${config.mode}:${input.requestId}` });
          if (intent.livemode !== config.live || intent.amount !== input.amount || intent.currency !== 'usd'
            || !/^pi_[A-Za-z0-9]+$/.test(intent.id) || !intent.client_secret?.startsWith(`${intent.id}_secret_`)) throw fail('Payment form is unavailable.', 502);
          if (config.live) await require('./athleticmind-reconciliation').registerIntent({ db: database(), config, intent, input });
          return reply(200, { clientSecret: intent.client_secret, publishableKey: publicKey, amount: intent.amount, mode: config.mode }, cors);
        }
        if (config.live && input.frequency !== 'monthly') throw fail('Use the secure one-time payment form.', 503);
        const recurringItem = input.frequency === 'monthly' ? await monthlyLineItem({ env, client, config, amount: input.amount }) : null;
        const session = await client.checkout.sessions.create({ mode: input.frequency === 'monthly' ? 'subscription' : 'payment', payment_method_types: ['card'], line_items: [recurringItem || { quantity: 1, price_data: { currency: 'usd', unit_amount: input.amount, product_data: { name: `${config.live ? '' : 'TEST: '}${CAMPAIGNS[input.campaign].title}` } } }], metadata, ...(input.frequency === 'monthly' ? { subscription_data: { metadata } } : { payment_intent_data: { metadata } }), success_url: `${config.origin}/sponsor?result=success&session_id={CHECKOUT_SESSION_ID}`, cancel_url: `${config.origin}/sponsor?result=cancel`, ...(config.live ? { custom_text: { submit: { message: `Recipient: ${config.recipient}. Terms: ${config.termsURL}. Refund policy: ${config.refundURL}. Support: ${config.supportEmail}.` } } } : {}), ...(input.frequency === 'once' ? { submit_type: 'pay' } : {}) }, { idempotencyKey: `${SOURCE}:${config.mode}:${input.requestId}` });
        if (session.livemode !== config.live || !session.url?.startsWith('https://checkout.stripe.com/')) throw fail('Checkout unavailable.', 502);
        return reply(200, { url: session.url }, cors);
      }
      if (config.live && ['board', 'totals'].includes(action) && event.httpMethod === 'GET') {
        const snapshot = await require('./athleticmind-reconciliation').readSnapshot({ db: database(), client, config });
        if (snapshot.pending) return reply(202, snapshot, cors);
        return reply(200, action === 'totals' ? { mode: config.mode, currency: 'usd', net: snapshot.net, stale: snapshot.stale, verifiedAt: snapshot.verifiedAt, refreshing: snapshot.refreshing } : snapshot, cors);
      }
      if (action === 'board' && event.httpMethod === 'GET') {
        const root = database().collection(config.collection);
        const [supporters, schools, total] = await Promise.all([
          root.doc('board').collection('supporters').orderBy('updated', 'desc').limit(50).get(),
          root.doc('board').collection('schools').get(), root.doc('totals').get()
        ]);
        return reply(200, { mode: config.mode, net: (total.data()?.gross || 0) - (total.data()?.refunded || 0),
          supporters: supporters.docs.map(d => d.data()).filter(d => d.net > 0).map(({name, school, message, net}) => ({name, school, message, net})),
          schools: schools.docs.map(d => d.data()).filter(d => d.count > 0).sort((a,b) => b.count - a.count || a.name.localeCompare(b.name)) }, cors);
      }
      if (action === 'cancel' && event.httpMethod === 'POST') {
        if (!cors) throw fail('Origin required.', 403);
        const id = JSON.parse(event.body || '{}').session_id || '';
        if (!(config.live ? /^cs_live_[A-Za-z0-9]+$/ : /^cs_test_[A-Za-z0-9]+$/).test(id)) throw fail('Invalid giving session.');
        const session = await client.checkout.sessions.retrieve(id);
        if (session.livemode !== config.live || session.metadata?.source !== SOURCE || !session.subscription) throw fail('Recurring giving unavailable.', 404);
        const subscription = await client.subscriptions.retrieve(typeof session.subscription === 'string' ? session.subscription : session.subscription.id);
        if (subscription.livemode !== config.live || subscription.metadata?.source !== SOURCE) throw fail('Recurring giving unavailable.', 404);
        if (subscription.status !== 'canceled' && !subscription.cancel_at_period_end) {
          const updated = await client.subscriptions.update(subscription.id, { cancel_at_period_end: true }, { idempotencyKey: `${SOURCE}:cancel:${subscription.id}` });
          if (updated.cancel_at_period_end !== true && updated.status !== 'canceled') throw fail('Cancellation could not be confirmed. Please try again.', 502);
        }
        return reply(200, { canceled: true, mode: config.mode }, cors);
      }
      if (action === 'totals' && event.httpMethod === 'GET') {
        const totals = (await database().collection(config.collection).doc('totals').get()).data();
        return reply(200, { mode: config.mode, currency: 'usd', net: totals ? totals.gross - totals.refunded : 0 }, cors);
      }
      if (action === 'status' && event.httpMethod === 'GET') {
        const id = event.queryStringParameters?.session_id || '';
        if (!(config.live ? /^cs_live_[A-Za-z0-9]+$/ : /^cs_test_[A-Za-z0-9]+$/).test(id)) throw fail('Invalid giving session.');
        const session = await client.checkout.sessions.retrieve(id);
        if (session.livemode !== config.live || session.metadata?.source !== SOURCE) throw fail('Session unavailable.', 404);
        let schedule = {};
        if (session.subscription) {
          const plan = await client.subscriptions.retrieve(typeof session.subscription === 'string' ? session.subscription : session.subscription.id);
          const item = plan.items?.data?.[0];
          if (plan.livemode !== config.live || plan.metadata?.source !== SOURCE || plan.items?.data?.length !== 1
            || item.price?.currency !== 'usd' || item.price?.recurring?.interval !== 'month') throw fail('Giving schedule unavailable.', 404);
          schedule = { recurring: true, amount: item.price.unit_amount * item.quantity, interval: 'month', cancelAtPeriodEnd: !!plan.cancel_at_period_end,
            nextPaymentAt: plan.status === 'canceled' || plan.cancel_at_period_end ? null : plan.current_period_end };
        }
        return reply(200, { paid: session.payment_status === 'paid', mode: config.mode, ...schedule }, cors);
      }
      if (action === 'webhook' && event.httpMethod === 'POST') {
        if (!env.ATHLETICMIND_SPONSOR_WEBHOOK_SECRET) throw fail('Webhook unavailable.', 503);
        let signed;
        try { signed = client.webhooks.constructEvent(Buffer.from(event.body || '', event.isBase64Encoded ? 'base64' : 'utf8'), event.headers?.['stripe-signature'], env.ATHLETICMIND_SPONSOR_WEBHOOK_SECRET); } catch { throw fail('Invalid webhook signature.'); }
        await processVerifiedEvent({ signed, client, database: database(), config });
        return reply(200, { received: true });
      }
      return reply(405, { error: 'Method unavailable.' }, cors);
    } catch (error) { return reply(error.status || (error instanceof SyntaxError ? 400 : 500), { error: error.status ? error.message : 'Unable to complete this request. Please try again.' }, cors); }
  };
}
module.exports = { publicProfile, SOURCE, CAMPAIGNS, validate, configuration, record, createHandler, processVerifiedEvent, monthlyLineItem };
