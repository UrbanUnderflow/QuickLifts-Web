// netlify/functions/models/Subscription.js

const SubscriptionPlatform = {
  iOS: "ios",
  Web: "web",
};

const SubscriptionType = {
  unsubscribed: "Unsubscribed",
  beta: "Beta User",
  monthly: "Monthly Subscriber",
  annual: "Annual Subscriber",
  sweatEquityPartner: "Sweat Equity Partner",
  executivePartner: "Executive Partner",
};

module.exports = {
  SubscriptionPlatform,
  SubscriptionType,
}; 