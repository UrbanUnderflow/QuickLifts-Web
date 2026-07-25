# PulseCheck coach service payments

PulseCheck coach services use Stripe PaymentIntents and destination charges. The athlete pays the fixed server-side price, Stripe routes the coach share to the coach’s connected account, and Pulse keeps a 3% application fee.

## Service catalog

- One-on-one video: $50.00
- Video posing session: $50.00

The catalog lives in `netlify/functions/lib/pulsecheck-coach-services.js`. Mobile clients send a service id and never control the amount.

## Required Stripe configuration

Configure these Netlify environment variables for the matching live and test accounts:

- `STRIPE_SECRET_KEY`
- `STRIPE_TEST_SECRET_KEY`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_TEST_STRIPE_PUBLISHABLE_KEY`
- `STRIPE_WEBHOOK_SECRET`

The existing `stripe-webhook` endpoint must receive:

- `payment_intent.succeeded`
- `payment_intent.payment_failed`
- `charge.refunded`

Payment verification also runs through the authenticated confirmation endpoint, so the athlete can continue to scheduling as soon as Stripe confirms the PaymentIntent. The webhook remains the durable fallback if the app closes after payment.

## Required Apple Pay configuration

The iOS target uses merchant id `merchant.com.fitwithpulse.pulsecheck`.

Before release:

1. Register that merchant id for the PulseCheck Apple developer team.
2. Create its Apple Pay payment processing certificate through Stripe.
3. Refresh the PulseCheck provisioning profiles so the Apple Pay entitlement is included.
4. Confirm the merchant is enabled in the Stripe live and test configurations.

Stripe PaymentSheet hides Apple Pay on devices or builds where Apple Pay is unavailable. Credit card payment remains available.

## Firestore records

`pulsecheck-coach-service-orders/{orderId}` is the payment and earnings ledger. A booking may only be written after the order reaches `paid`. Scheduling updates the order to `booked` and writes `activeBooking` to the matching `coach-athlete-conversations` document so both people see the pinned booking card.

The coach Earnings tab reads paid and booked service orders for the signed-in coach. Failed and refunded orders are excluded from earned totals.
