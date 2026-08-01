// The coach profile uses the same authenticated, eligibility-checked Stripe
// Connect flow as the trainer onboarding page.
const { handler } = require('./create-connected-account');

module.exports = { handler };
