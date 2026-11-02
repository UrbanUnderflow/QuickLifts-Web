const { createHandler, configuration } = require('./lib/athleticmind-sponsorship');
const { deploymentEnv } = require('./lib/athleticmind-giving-deployment');
exports.handler = async event => {
  const env = deploymentEnv(process.env);
  let client;
  try {
    const config = configuration(env);
    client = require('stripe')(env[config.keyName], { apiVersion: '2023-10-16', timeout: 4000, maxNetworkRetries: 0 });
    const action = event.queryStringParameters?.action;
    if (event.httpMethod === 'POST' && ['payment-intent', 'checkout'].includes(action)) {
      const readiness = await require('./athleticmind-giving-readiness').handler({ httpMethod: 'GET' });
      const available = JSON.parse(readiness.body);
      if (!available.oneTimeReady || (action === 'checkout' && !available.monthlyReady)) throw new Error('Giving unavailable');
    }
    // Approved inline donation prices preserve the donor's exact amount; never reuse Pulse plans.
    env.ATHLETICMIND_SPONSOR_MONTHLY_PRICE_ID = '';
  } catch { return { statusCode: 503, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify({ error: 'Giving is temporarily unavailable.' }) }; }
  return createHandler({
  env,
  // Existing PIL publishable keys from src/utils/stripeKey.ts; these are public identifiers.
  publishableKey: mode => mode === 'live' ? 'pk_live_51Sd8YLIkArZc741WXCIF0xMlq4OUccnkkSsoJ3MqY9Wiu0xsAqRZeHdxijRnOa050a2k8WwqtVi6EsyhPZ6lfS5w00l9L49dzX' : 'pk_test_51Sd8YLIkArZc741WNSWroMed1dRRfjfA2bQBniDTFsiEiVKtbxGU5IhpR5u2HimyiR9OHqgvxgHFFrMjqxFl7YUC00WpY2G0dn',
  stripe: () => client,
  database: () => {
    const config = configuration(env);
    const { getNamedFirebaseAdminApp } = require('../../src/lib/server/firebase/app-registry');
    return getNamedFirebaseAdminApp({ mode: config.firebaseMode, appName: `athleticmind-sponsorship-${config.mode}`, runtime: 'netlify-function', allowApplicationDefault: false, failClosed: true }).firestore();
  },
})(event);
};
