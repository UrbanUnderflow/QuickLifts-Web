# Monthly giving reuses Pulse billing

Local application candidate only. No Stripe account, credentials, products, prices, webhook settings or payment settings were changed in this follow-up. No provider mutations or backend push retry occurred. PIL remains recipient.

## Actual production implementation traced

- `create-checkout-session.js` and `create-athlete-checkout-session.js` pass existing prices to Checkout with subscription mode. The general athlete handler adds a 30-day trial and membership metadata; these behaviors must not leak into donations.
- `create-pulsecheck-athlete-app-subscription-intent.js` creates an incomplete subscription from an existing offer price, expands the first invoice PaymentIntent, and lets the client confirm it. Renewals use Stripe Billing rather than a separate scheduler.
- `manage-pulsecheck-athlete-subscription-offer.js` supports custom coach-team monthly amounts by creating a product if absent and creating a new monthly Price when the amount/version changes. Thus the existing Pulse app already performs catalog writes for custom pricing.
- `create-1on1-subscription-checkout.js` creates inline monthly price_data/product_data and routes invoices to a connected coach with a 3% fee. This routing is not reused for PIL donations.
- `create-pulsecheck-coach-service-subscription-checkout.js` creates inline monthly price_data/product_data using the server-calculated amount; its subscription remains on the platform account and uses an application ledger for coach settlement. Its Checkout pattern is suitable for donation adaptation, with donation metadata and no coach settlement.
- `stripe-webhook.js` already processes invoice.paid, subscription changes, and charge.refunded. Existing athlete handling retrieves subscriptions for metadata and refunds for the linked invoice. The donation dispatch now similarly resolves subscription metadata if an invoice/refund lacks a direct source tag.
- `cancel-user-stripe-subscription.js` verifies ownership, sets cancel_at_period_end with an idempotency key, retrieves the result, and updates state. Donation cancellation uses its private Checkout-session capability to identify only that donation plan, then verifies Stripe's cancellation result. It does not expose a general user/subscription cancellation endpoint.

## Implemented adaptation

1. An application-owned existing monthly price ID can be selected in server configuration. The adapter retrieves and verifies it: correct live/test mode, active USD per-unit licensed monthly price, monthly interval count one, active product, and no quantity transform. The client cannot choose or override it.
2. Quantity may exactly represent the donor amount. For example, an already-approved $1 monthly price can represent $25/month with quantity 25. $25.50 is rejected for that price, not rounded or changed. A compatible existing cent-denominated price could represent cents. We have not verified that either such price exists in the live account, and membership products are not automatically relabeled as donations.
3. The Pulse inline-price pattern is also implemented locally for arbitrary custom amounts. In live mode, it remains disabled unless a separate server-side authorization explicitly permits new product/price records. No such authorization or setting has been applied. Request-body flags cannot authorize it.
4. The donor UI now routes monthly giving to subscription Checkout and one-time giving to PaymentIntent/Elements. It preserves explicit monthly amount/frequency/cancellation consent and does not silently convert a recurring gift to one-time.
5. Confirmation retrieves the actual monthly amount, next payment date, and cancellation state. Renewals use invoice.paid. Duplicate events cannot double-count money; each plan receives one school shout-out across renewals. Refunds reduce net collected totals and remove fully refunded supporter votes. Future invoices never count as collected.
6. No athlete membership, trial, coach transfer, application fee or proration is introduced by donation checkout. Funds stay on the verified PIL platform account.

## Validation and limitations

34 synthetic unit/runtime tests pass, including existing Pulse payment regression tests. TypeScript and scoped ESLint pass. Production frontend build passes. Added cases exercise exact quantities, incompatible amounts, annual/test/transformed price rejection, live inline-price gating, consent, schedule, cancellation response, duplicate renewal delivery and invoice-based refund metadata recovery. This follow-up used mocked Stripe objects only; earlier genuine one-time test results remain separately documented in review/one-time-provider-results.json.

This corrects the previous broad statement that monthly giving was unsupported. The billing capability exists. The unverified points are the usable live price(s) and current webhook event subscriptions, not Stripe subscription support.

## Required release scope and exact potential Stripe authorization

The earlier production push remains denied. Automatic approval review said a new endpoint on the Pulse backend exceeds explicit frontend deployment approval and newly exercises live payment infrastructure. That denial has not been retried.

A fully scoped application-release approval would cover publishing the donation backend handler, existing-webhook donation dispatch, protected donation ledger rules, and donation frontend adapter, plus the read-only readiness check. It would use existing PIL credentials and routing, preserve all unrelated work, and make no live test charge. Existing webhook subscriptions would be verified before charging is enabled; missing subscriptions would be reported rather than altered.

If a suitable existing price can represent the requested amount exactly, no Stripe catalog change is necessary. Otherwise arbitrary-amount monthly giving using the existing Pulse pattern requires permission for Stripe to create a donation Product/Price as part of Checkout (or one approved reusable denomination price). This is the specific outstanding catalog action—not new credentials, a new Stripe account, a new webhook, or a new billing stack. Do not imply it is already authorized under the no-product/price-change restriction.

Browser check with synthetic local objects: confirmation displayed $25 USD each month and the next payment date. Cancel future monthly giving changed the schedule to no future monthly payment and showed cancellation confirmed. No Stripe API was called by this UI fixture. Both local servers were stopped afterward.
