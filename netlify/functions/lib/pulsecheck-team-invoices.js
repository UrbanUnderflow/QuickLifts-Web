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
  const customer = idOf(anchor.customer);
  const scope = JSON.stringify([userId, context.team.id, customer, stripeMode, firebaseMode]);
  const signature = value => crypto.createHmac('sha256', cursorSecret).update(`${scope}:${value}`).digest('base64url');
  let startingAfter;
  if (cursor != null) {
    if (typeof cursor !== 'string' || cursor.length > 512) throw fail('Invalid payment history cursor.', 400);
    const [encoded, mac, extra] = cursor.split('.');
    const expected = signature(encoded || '');
    if (extra || !mac || mac.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(expected))) throw fail('Invalid payment history cursor.', 400);
    startingAfter = Buffer.from(encoded, 'base64url').toString('utf8');
    if (!/^in_[a-zA-Z0-9]+$/.test(startingAfter)) throw fail('Invalid payment history cursor.', 400);
  }
  // Bound each request. A page can be empty when the customer has invoices for another team.
  const page = await stripe.invoices.list({ customer, limit: 20, ...(startingAfter ? { starting_after: startingAfter } : {}) });
  const subscriptions = new Map([[subscriptionId, anchor]]);
  const invoices = [];
  for (const invoice of page.data) {
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
  const last = page.data.at(-1)?.id;
  const encoded = last && Buffer.from(last).toString('base64url');
  return { invoices, nextCursor: page.has_more && encoded ? `${encoded}.${signature(encoded)}` : null };
}
module.exports = { loadTeamInvoices };
