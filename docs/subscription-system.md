## Pulse Subscription System (Web + iOS)

This document describes the complete subscription system across the Pulse Web app and the iOS app, including the shared Firestore model, data flows from Stripe and RevenueCat, runtime checks, backfills, and admin tools.

### Goals
- Drive access by a canonical Firestore record at `subscriptions/{userId}`.
- Grant access if the subscription record has a non-expired latest expiration derived from the append-only `plans` array.
- If the record is expired/missing, refresh from providers (RevenueCat for iOS, Stripe for web) and re-check.
- Maintain an append-only plan history for audit/debug. Never edit an existing plan entry.

---

## Firestore Data Model (Append-only Plans)

Collection: `subscriptions`
- Document ID: `userId`
- Example document:

```json
{
  "userId": "abc123",
  "username": "tester32",
  "userEmail": "tester32@gmail.com",
  "platform": "ios" | "web",
  "plans": [
    {
      "type": "pulsecheck-monthly",
      "expiration": 1733533200,
      "createdAt": 1730090400,
      "updatedAt": 1732678800,
      "platform": "web",
      "productId": "price_..."
    },
    {
      "type": "pulsecheck-annual",
      "expiration": 1765069200,
      "createdAt": 1732678800,
      "updatedAt": 1732678800,
      "platform": "ios",
      "productId": "pc_1y"
    }
  ],
  "createdAt": 1730090400,
  "updatedAt": 1732678800
}
```

Notes:
- `plans` is append-only. If a new expiration for the same plan type occurs, a new entry is appended. If expiration is identical to the latest of that type, do nothing.
- `username` and `userEmail` are denormalized for search.
- All timestamps in the document are Unix seconds.

Latest expiration logic (shared):
- If `plans` is empty → state is "unknown"; trigger provider syncs to rebuild.
- Else compute `latest = max(plans[*].expiration)` and state is `latest > now`.

---

## Provider Writes → Firestore (Append-only Plans)

Stripe (Web):
- Writers upsert `subscriptions/{userId}` and append to `plans`:
  - `netlify/functions/verify-subscription.js` (checkout completion) → append `{ type, expiration, productId, platform: 'web' }`.
  - `netlify/functions/verify-subscription-simple.js` → same as above.
  - `netlify/functions/stripe-webhook.js` → on `customer.subscription.created/updated` append if expiration changed; on `deleted` no plan append.
  - `netlify/functions/sync-stripe-subscription.js` → on-demand sync; append latest `{ type, expiration }`.

RevenueCat (iOS):
- `netlify/functions/sync-revenuecat-subscription.js` → on-demand sync to fetch latest entitlement expiration and append to `plans` with `{ type (pc_1w/pc_1m/pc_1y → pulsecheck-*), expiration, platform: 'ios' }`.

Legacy Backfills (Deprecated):
- Any tooling referencing `expirationHistory` is deprecated. Use provider syncs to rebuild `plans` instead.

---

## Runtime Access Checks (Plans)

### Web
- `src/api/firebase/subscription/service.ts`
  - `getStatus(userId)`: reads `plans` on `subscriptions/{userId}`, computes latest expiration.
  - `ensureActiveOrSync(userId)`: if inactive/unknown → calls both syncs in parallel:
    - `/.netlify/functions/sync-revenuecat-subscription`
    - `/.netlify/functions/sync-stripe-subscription`
    then re-reads and computes status again.
- `src/components/AuthWrapper.tsx` uses `ensureActiveOrSync()` when a user is unsubscribed/unknown.

### iOS
- `SubscriptionStatusService.swift`
  - `fetchActiveState(userId)` computes active/expired/unknown from `subscriptions/{userId}` using the same latest-expiration rule.
- `SplashLoader.swift`
  - On boot, checks `subscriptions/{userId}`. If expired → calls both Netlify syncs via `CloudFunctionsService` and re-checks after a short delay.
- `PurchaseService.swift`
  - Continues to manage RevenueCat-driven purchase events; the canonical access check honors the shared subscription record.

---

## Admin Tools

### Subscriptions Admin Page
Path: `/admin/subscriptions`
- Table fields: subscription ID (doc id), user ID, username, email, platform, type, status, Active (tri-state), Latest Expiration.
- Filters: search by id/user/plan, username, status, platform.
- Row actions: View details → shows latest computation, expiration history, and action buttons.
- Page actions:
  - Refresh
  - Backfill User Fields (denormalize `username`/`userEmail` for all docs)

### Netlify Functions Index
- `/.netlify/functions/sync-revenuecat-subscription`
- `/.netlify/functions/sync-stripe-subscription`
- `/.netlify/functions/migrate-expiration-history`
- `/.netlify/functions/backfill-subscription-user-fields`

---

## Operational Guidance (Plans)

When a user reports access issues:
1. Check `subscriptions/{userId}` in Firestore. If `plans` is empty, run a targeted sync:
   - POST `sync-revenuecat-subscription` with `{ userId }` (iOS users)
   - POST `sync-stripe-subscription` with `{ userId }` (web users)
2. Confirm that `plans` now contains a recent expiration and `updatedAt` moved forward.
3. On the web app, the next page load will re-check and grant access if active. iOS boot will do the same.

Backfills:
- Use `migrate-expiration-history` to ingest historical Stripe invoice period ends.
- Use `backfill-subscription-user-fields` to populate `username`/`userEmail` across all docs.

---

## Data + Date Handling

- All dates in the subscription doc use Unix seconds (`number`) and follow existing `convertFirestoreTimestamp` semantics on web.
- On iOS, dates are serialized as `Double` (seconds) and parsed using `Date(timeIntervalSince1970:)` (see `iOS/QuickLifts/.../model-structure-ios` and Firestore date format rule).

---

## Security & Env

- No keys are hard-coded. Netlify functions read secrets from environment variables (Stripe, Firebase Admin, RevenueCat API key).
- Avoid modifying document IDs; the doc ID is the `userId` for consistency across platforms.

---

## Future Enhancements

- Add dry-run reports for the admin "Backfill User Fields" button.
- Add a Stripe-only sync trigger from the admin UI (per-user), in addition to the global backfill.
- Add optional provider tags to `expirationHistory` entries for provenance (e.g., `{ ts, source: 'stripe' | 'revenuecat' }`).

---

## Recent Additions & Changes (Changelog)

- Firestore `subscriptions/{userId}` standardized: document ID is the Firebase userId.
- New fields on subscription docs: `username`, `userEmail`, `status`, `trialEndDate`, `expirationHistory`.
- Web `subscriptionService.ensureActiveOrSync(userId)`: runs both Stripe and RevenueCat syncs in parallel then recomputes.
- Netlify functions:
  - `sync-revenuecat-subscription.js`: upgraded to RevenueCat API v2, supports multiple API keys (QuickLifts, PulseCheck), standardized docId = userId, logs raw responses for debugging, appends latest expiration.
  - `sync-stripe-subscription.js`: on-demand sync from Stripe, appends latest `current_period_end` and denormalized user fields.
  - `stripe-webhook.js`: ensures subscription doc upserts on Stripe events with `expirationHistory` updates.
  - `migrate-expiration-history.js`: migrates historical Stripe periods into `expirationHistory`.
  - `backfill-subscription-user-fields.js`: denormalizes `username` and `userEmail` for existing docs.
- Admin page `/admin/subscriptions`:
  - Search by username/email, improved table, tri-state Active column (Unknown/Active/Expired), backfill action.
- Payment page `/payment/[id]`:
  - Displays Pulse Subscription line item: Active (no charge) vs price when not subscribed.
  - Combined Checkout (round + optional subscription) via `create-round-checkout`.
- iOS (QuickLifts & PulseCheck):
  - `Subscription` model updated; services compute active state from Firestore and trigger web sync functions on boot when needed.

---

## Known Gaps / Shortcomings (To Revisit)

- RevenueCat V2 sync still returns 404 for some users despite valid iOS entitlements and correct Secret key. Hypotheses:
  - Project mismatch vs. SDK project (verify Secret key is from the same RC project as `appl_*` key in use).
  - Customer may exist under a different environment or identifier; need a confirmed lookup strategy from RC support (note: we currently query production only and use the Firebase userId).
  - Entitlement key naming differences; iOS uses `plus`. Confirm entitlement names in each RC project.
- Web function currently relies on the passed `userId` only; if RC stored a different `app_user_id`, lookup fails. We deferred storing any alternate IDs on `users/` by request.
- No provenance tags on `expirationHistory` entries yet.
- Stripe + RC conflicts not auto-resolved (we simply take the max expiration).
- Testing/dev ergonomics: better local env setup docs for Netlify function secrets.

---

---

## Flow Charts

### 1) Runtime Access Check (Web/iOS)

```mermaid
flowchart TD
  A[App load / protected route access] --> B{Read subscriptions/{userId}}
  B -->|No doc| C[State = Unknown]
  B -->|Doc found| D{Latest expiration?}
  D -->|None| C
  D -->|Exists| E{latest > now?}
  E -->|Yes| F[Grant Access]
  E -->|No| G[State = Expired]
  C --> H[Trigger Syncs in Parallel]
  G --> H
  H --> I[/sync-revenuecat-subscription/]
  H --> J[/sync-stripe-subscription/]
  I --> K[Update subscriptions/{userId}]
  J --> K
  K --> L{Re-read latest expiration}
  L -->|> now| F
  L -->|<= now| M[Deny / Require Subscribe]
```

Notes:
- Web calls both sync functions inside `ensureActiveOrSync()`.
- iOS calls both syncs on boot when the record is expired, then re-checks.

### 2) Provider Writes to Firestore

```mermaid
flowchart LR
  subgraph Stripe
    S1[checkout.session.completed
    verify-subscription.js]
    S2[verify-subscription-simple.js]
    S3[stripe-webhook.js
    subscription.created/updated/deleted]
    S4[sync-stripe-subscription.js
    (on-demand)]
  end

  subgraph RevenueCat
    R1[sync-revenuecat-subscription.js
    (on-demand)]
  end

  S1 --> FS[(subscriptions/{userId})]
  S2 --> FS
  S3 --> FS
  S4 --> FS
  R1 --> FS
```

Legend:
- All writers merge into `subscriptions/{userId}` and append to `plans` (append-only).



