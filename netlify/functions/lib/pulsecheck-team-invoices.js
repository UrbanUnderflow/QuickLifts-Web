const crypto = require('node:crypto');
const { loadTeamBilling } = require('./pulsecheck-team-billing');
const fail = (message, statusCode = 403) => Object.assign(new Error(message), { statusCode });
const idOf = value => typeof value === 'string' ? value : value?.id;
const stripeUrl = (value, hosts) => {
  try { const url = new URL(value); return url.protocol === 'https:' && hosts.includes(url.hostname) && !url.username && !url.password ? url.href : null; }
  catch { return null; }
};

async function loadTeamInvoices({ database, userId, teamId, stripe, stripeMode, firebaseMode = 'prod', cursor, cursorSecret }) {
  const context = await loadTeamBilling({ database, userId, teamId });
  if (!context.isTeamAthlete) throw fail('Team membership is required.');
  let subscriptionId = context.entitlement?.stripeSubscriptionId;
  if (!subscriptionId) {
    const record = (await database.collection('subscriptions').doc(userId).get()).data() || {};
    if (record.pulseCheckTeamId === context.team.id) subscriptionId = record.stripeSubscriptionId;
  }
  if (!subscriptionId) return { invoices: [], nextCursor: null };
  const matches = sub => sub?.metadata?.userId === userId && sub.metadata.pulsecheckTeamId === context.team.id
    && (sub.metadata.pulsecheckFirebaseMode || 'prod') === firebaseMode
    && sub.livemode === (stripeMode === 'live');
  const anchor = await stripe.subscriptions.retrieve(subscriptionId);
  if (!matches(anchor) || !idOf(anchor.customer)) throw fail('Your subscription could not be verified.');
  const customers = [idOf(anchor.customer)];
  // Checkout can create a new customer on restart. Discover earlier subscriptions by
  // server-owned metadata, then verify their identity/environment again before use.
  const escapeSearch = value => String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  const query = `metadata['userId']:'${escapeSearch(userId)}' AND metadata['pulsecheckTeamId']:'${escapeSearch(context.team.id)}'`;
  let searchPage;
  let searched = 0;
  do {
    const found = await stripe.subscriptions.search({ query, limit: 100, ...(searchPage ? {page:searchPage} : {}) });
    for (const sub of found.data) {
      const customerId = idOf(sub.customer);
      if (matches(sub) && customerId && !customers.includes(customerId)) customers.push(customerId);
    }
    searchPage = found.has_more ? found.next_page : null;
    if (found.has_more && (!searchPage || ++searched >= 10)) throw fail('Your payment history is temporarily unavailable.', 503);
  } while (searchPage);
  if (customers.length > 50) throw fail('Your payment history is temporarily unavailable.', 503);
  const scope = JSON.stringify([userId, context.team.id, stripeMode, firebaseMode]);
  const signature = value => crypto.createHmac('sha256', cursorSecret).update(`${scope}:${value}`).digest('base64url');
  let positions = {};
  if (cursor != null) {
    if (typeof cursor !== 'string' || cursor.length > 16384) throw fail('Invalid payment history cursor.', 400);
    const [encoded, mac, extra] = cursor.split('.');
    const expected = signature(encoded || '');
    if (extra || !mac || mac.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(expected))) throw fail('Invalid payment history cursor.', 400);
    let decoded;
    try { decoded = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')); }
    catch { throw fail('Invalid payment history cursor.', 400); }
    if (!decoded || Array.isArray(decoded) || typeof decoded !== 'object' || Object.entries(decoded).some(([customer, position]) =>
      !customers.includes(customer) || !position || typeof position.done !== 'boolean' || (position.after != null && !/^in_[a-zA-Z0-9]+$/.test(position.after)))) throw fail('Invalid payment history cursor.', 400);
    positions = decoded;
  }
  // Merge customer streams before applying the page boundary, so restarted
  // subscriptions retain a single newest-first timeline without missing invoices.
  const pages = await Promise.all(customers.map(async customer => ({ customer,
    page: positions[customer]?.done ? {data:[],has_more:false} : await stripe.invoices.list({ customer, limit: 20,
      ...(positions[customer]?.after ? {starting_after:positions[customer].after} : {}) })
  })));
  const ordered = pages.flatMap(({customer,page}) => page.data.map(invoice => ({customer,invoice})))
    .sort((a,b) => b.invoice.created - a.invoice.created);
  const selected = ordered.slice(0,20);
  for (const {customer,invoice} of selected) positions[customer] = {after:invoice.id,done:false};
  for (const {customer,page} of pages) {
    if (!page.has_more && !ordered.slice(20).some(entry => entry.customer === customer))
      positions[customer] = {after:positions[customer]?.after || null,done:true};
  }
  const subscriptions = new Map([[subscriptionId, anchor]]);
  const invoices = [];
  for (const {customer,invoice} of selected) {
    const subId = idOf(invoice.parent?.subscription_details?.subscription || invoice.subscription);
    if (!subId || idOf(invoice.customer) !== customer || invoice.livemode !== (stripeMode === 'live') || invoice.status === 'draft') continue;
    if (!subscriptions.has(subId)) subscriptions.set(subId, await stripe.subscriptions.retrieve(subId));
    const sub = subscriptions.get(subId);
    if (!matches(sub) || idOf(sub.customer) !== customer) continue;
    invoices.push({ id: invoice.id, number: invoice.number || null, created: invoice.created,
      currency: invoice.currency, amountPaid: invoice.amount_paid, amountDue: invoice.amount_due, total: invoice.total,
      status: invoice.status, hostedInvoiceUrl: stripeUrl(invoice.hosted_invoice_url, ['invoice.stripe.com']),
      invoicePdf: stripeUrl(invoice.invoice_pdf, ['pay.stripe.com', 'invoice.stripe.com']) });
  }
  const hasMore = pages.some(({customer}) => !positions[customer]?.done);
  const encoded = hasMore && Buffer.from(JSON.stringify(positions)).toString('base64url');
  return { invoices, nextCursor: encoded ? `${encoded}.${signature(encoded)}` : null };
}
module.exports = { loadTeamInvoices };
