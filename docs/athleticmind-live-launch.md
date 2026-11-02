# PIL donation release — 2026-11-02

The user explicitly approved the donation backend/frontend release, shared webhook adapter and protected ledger. Stripe account configuration, credentials, webhook registrations, products and prices remain unchanged. No live payment is used for verification.

## Release scope

Based on production backend a4ebd8096ef7f95715bab2b286ded3e6a988412a. The readiness endpoint first shipped in f5412df6c56be940873e6841195af83103530f3d. The donation adapter uses the existing PIL server key and public key, direct platform PaymentIntents, and the existing signature-verified Stripe webhook. It does not route to trainers or provision memberships.

The public readiness endpoint uses existing server access for read-only account, webhook and catalog checks. Both the frontend and payment-creation endpoint fail closed if required account/webhook checks fail. Monthly giving additionally requires an existing semantically appropriate monthly donation price and exact amount compatibility. New catalog records are forcibly disabled in deployment settings. Missing catalog/read permissions do not justify changing Stripe configuration.

Public profiles require explicit consent; existing donors are never imported. Refunds reduce totals, duplicate webhooks are idempotent, renewals do not create additional school votes, and future scheduled payments are not collected totals. Optional text renders as text in React.

## Protected records

Production Firestore rules differed substantially from the repository. The deployed ruleset was preserved and only donation collection exclusions and recursive client-access denies were added. All eight tests passed against that exact production-derived source. Verified released ruleset: projects/quicklifts-dd3f1/rulesets/d24fcbd9-850e-4022-b721-ceeccb0d3e53. Previous: f3a19e49-75dc-466c-8b55-2b6b1a9c49e6. The repository rules change documents the same additive guards; the full repository rules file was not deployed.

## Verification and limits

37 focused unit/runtime checks pass. Eight emulator checks cover anonymous, athlete and admin ledger denial plus concurrent retry accounting. Frontend TypeScript, scoped lint and webpack production build pass. Existing test-mode one-time success, decline, idempotency and refunds were verified previously; all owned successful test payments were refunded. Local recurring fixtures verify consent, schedule, cancellation and refund accounting.

These tests do not establish successful live money movement or real webhook delivery. Production checks are read-only. Actual production availability is determined by the deployed readiness response; monthly remains closed without a suitable existing donation price. No live charge, new credentials, products, prices or webhook registration changes are authorized or performed.
