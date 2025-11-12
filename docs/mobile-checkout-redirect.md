# Mobile Stripe Checkout Redirect – Implementation & Troubleshooting

This doc captures what fixed mobile redirect issues (Safari and in‑app browsers) when launching Stripe Checkout from Pulse web.

## Summary of the Fix

1) Use a dedicated launcher page: `/checkout-redirect`.
   - Renders instantly and performs same‑tab navigation to a Netlify Function.
   - Provides a visible fallback button: “Continue to Payment”.

2) Use server‑side 302 redirects to Stripe:
   - `/.netlify/functions/create-athlete-checkout-session` (GET)
   - `/.netlify/functions/create-checkout-session` (GET)
   - The functions create a Checkout Session and immediately 302 to `session.url`.

3) Trigger navigation via real anchors on the calling pages (best for Safari):
   - `connect/[referralCode].tsx` and `/subscribe` now render `<a href="/checkout-redirect?...">` links.
   - JS `onClick` remains as a backup but the anchor alone is sufficient.

Why this works: Safari (and many in‑app browsers) aggressively block `window.open` after async work. Using a top‑level anchor + same‑tab server redirect avoids pop‑up blockers and about:blank flicker.

## How to Launch

```
/checkout-redirect?type=athlete&userId={USER_ID}&priceId={PRICE_ID}&email={EMAIL}&coachReferralCode={REF}
/checkout-redirect?type=subscribe&userId={USER_ID}&priceId={PRICE_ID}
```

The page forwards these parameters to the appropriate Netlify Function which 302‑redirects to Stripe.

## Debugging

- Append `&debug=1` to surface error details in function responses:
  - Example: `/.netlify/functions/create-athlete-checkout-session?userId=...&priceId=...&debug=1`
  - Only affects the JSON error body; no additional logging is exposed to users unless `debug=1` is present.

Common causes when a 500 is returned:
- Invalid or mismatched `priceId` for the mode (live vs test).
- Missing `STRIPE_SECRET_KEY` (live) or `STRIPE_TEST_SECRET_KEY` (test) on Netlify.
- Firestore access failures when looking up the user or coach (service account creds).

## File References

- `src/pages/checkout-redirect.tsx` – launcher page (same‑tab nav + fallback button).
- `src/pages/connect/[referralCode].tsx` – renders anchor link for athlete subscription.
- `src/pages/subscribe.tsx` – renders anchor links for monthly/yearly.
- `netlify/functions/create-athlete-checkout-session.js` – GET handler 302 to Stripe; supports `debug=1`.
- `netlify/functions/create-checkout-session.js` – GET handler 302 to Stripe; supports `debug=1`.

## Operational Notes

- Always prefer same‑tab navigation for mobile Checkout.
- Keep the anchor hrefs up‑to‑date; they are the primary trigger path.
- For critical incidents, temporarily expose a Stripe Payment Link as a last resort fallback.



