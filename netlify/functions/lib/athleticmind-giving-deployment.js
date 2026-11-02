// Application settings for the approved PIL donation release. Existing credential values are never changed.
const PIL_ACCOUNT = 'acct_1Sd8YLIkArZc741W';
const SOURCE = 'athleticmind-sponsorship-v1';
function deploymentEnv(env) {
  return { ...env, ATHLETICMIND_SPONSOR_MODE: 'live', ATHLETICMIND_STRIPE_ACCOUNT_ID: PIL_ACCOUNT,
    ATHLETICMIND_SPONSOR_ORIGIN: 'https://theathleticmind.ai', ATHLETICMIND_SPONSOR_LIVE_APPROVED: 'true',
    ATHLETICMIND_SPONSOR_RECIPIENT_NAME: 'Pulse Intelligence Labs, Inc.', ATHLETICMIND_SPONSOR_TERMS_VERSION: 'pil-existing-terms-2026-11-02',
    ATHLETICMIND_SPONSOR_TERMS_URL: 'https://fitwithpulse.ai/terms', ATHLETICMIND_SPONSOR_REFUND_URL: 'https://fitwithpulse.ai/terms',
    ATHLETICMIND_SPONSOR_SUPPORT_EMAIL: 'info@fitwithpulse.ai', ATHLETICMIND_SPONSOR_ALLOW_NEW_PRICE_RECORDS: 'false' };
}
function isDonationMonthlyPrice(price) {
  const product = price?.product;
  // A membership or coaching price is never repurposed merely because its arithmetic matches.
  const purpose = product?.name === 'AthleticMind monthly program contribution'
    || (product?.metadata?.source === SOURCE && [PIL_ACCOUNT, 'Pulse Intelligence Labs, Inc.'].includes(product.metadata.recipient));
  return !!purpose && price.livemode === true && price.active === true && price.currency === 'usd'
    && price.type === 'recurring' && price.recurring?.interval === 'month' && price.recurring?.interval_count === 1
    && price.recurring?.usage_type === 'licensed' && price.billing_scheme === 'per_unit' && !price.transform_quantity
    && Number.isSafeInteger(price.unit_amount) && price.unit_amount > 0 && product?.active === true && !product.deleted;
}
async function findDonationMonthlyPrice(client) {
  if (!client.prices?.list) return null;
  let starting_after;
  for (let page = 0; page < 10; page++) {
    const result = await client.prices.list({ active: true, type: 'recurring', limit: 100, expand: ['data.product'], ...(starting_after ? { starting_after } : {}) });
    const match = result.data.filter(isDonationMonthlyPrice).sort((a,b) => a.unit_amount - b.unit_amount)[0];
    if (match) return match;
    if (!result.has_more || !result.data.length) return null;
    starting_after = result.data.at(-1).id;
  }
  return null;
}
module.exports = { PIL_ACCOUNT, deploymentEnv, isDonationMonthlyPrice, findDonationMonthlyPrice };
