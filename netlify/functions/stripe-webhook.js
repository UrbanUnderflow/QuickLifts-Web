const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const axios = require('axios');

exports.handler = async (event) => {
  const sig = event.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_ENDPOINT_SECRET;
  let stripeEvent;

  try {
    stripeEvent = stripe.webhooks.constructEvent(event.body, sig, endpointSecret);
  } catch (err) {
    console.error(`⚠️  Webhook signature verification failed.`, err.message);
    return {
      statusCode: 400,
      body: `Webhook Error: ${err.message}`,
    };
  }

  const eventType = stripeEvent.type;
  const eventObject = stripeEvent.data.object;
  
  let message;

  switch (eventType) {
    case 'invoice.payment_succeeded':
      const customer = await stripe.customers.retrieve(eventObject.customer);
      message = {
        text: `🎉 A new subscription was purchased by ${customer.email}!`,
      };
      break;

    // Add cases for all other event types you are listening to
    case 'charge.captured':
    case 'charge.dispute.closed':
    case 'charge.dispute.created':
    case 'charge.dispute.funds_reinstated':
    case 'charge.dispute.funds_withdrawn':
    case 'charge.dispute.updated':
    case 'charge.expired':
    case 'charge.failed':
    case 'charge.pending':
    case 'charge.refund.updated':
    case 'charge.refunded':
    case 'charge.succeeded':
    case 'charge.updated':
    case 'checkout.session.async_payment_failed':
    case 'checkout.session.async_payment_succeeded':
    case 'checkout.session.completed':
    case 'checkout.session.expired':
    case 'customer.bank_account.created':
    case 'customer.bank_account.deleted':
    case 'customer.bank_account.updated':
    case 'customer.card.created':
    case 'customer.card.deleted':
    case 'customer.card.updated':
    case 'customer.created':
    case 'customer.deleted':
    case 'customer.discount.created':
    case 'customer.discount.deleted':
    case 'customer.discount.updated':
    case 'customer.source.created':
    case 'customer.source.deleted':
    case 'customer.source.expiring':
    case 'customer.source.updated':
    case 'customer.subscription.created':
    case 'customer.subscription.deleted':
    case 'customer.subscription.paused':
    case 'customer.subscription.pending_update_applied':
    case 'customer.subscription.pending_update_expired':
    case 'customer.subscription.resumed':
    case 'customer.subscription.trial_will_end':
    case 'customer.subscription.updated':
    case 'customer.tax_id.created':
    case 'customer.tax_id.deleted':
    case 'customer.tax_id.updated':
    case 'customer.updated':
    case 'payment_link.created':
    case 'payment_link.updated':
    case 'payout.canceled':
    case 'payout.created':
    case 'payout.failed':
    case 'payout.paid':
    case 'payout.reconciliation_completed':
    case 'payout.updated':
    case 'subscription_schedule.aborted':
    case 'subscription_schedule.canceled':
    case 'subscription_schedule.completed':
    case 'subscription_schedule.created':
    case 'subscription_schedule.expiring':
    case 'subscription_schedule.released':
    case 'subscription_schedule.updated':
      message = {
        text: `Event received: ${eventType}`,
        event: JSON.stringify(eventObject, null, 2),
      };
      break;

    default:
      message = {
        text: `Unhandled event type: ${eventType}`,
        event: JSON.stringify(eventObject, null, 2),
      };
      break;
  }

  try {
    await axios.post("https://hooks.slack.com/services/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", message);
  } catch (err) {
    console.error('Error sending message to Slack:', err);
    return {
      statusCode: 500,
      body: 'Internal Server Error',
    };
  }

  return {
    statusCode: 200,
    body: 'Success',
  };
};