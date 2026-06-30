# Macra Event Semantics & Trust Audit: Trial Signal Verification

**Date:** 2026-06-30  
**Owner:** Sage  
**Status:** Scaffold created for event-semantics execution  
**Task:** Verify that `af_start_trial`, `af_purchase`, `af_subscribe`, `purchase_cancelled`, `web_checkout_started`, and StoreKit cancel are cleanly separated, and flag any tracking ambiguity that could make the reported 2/day trial-start signal look stronger or weaker than reality.

## Source Context

_Pending Step 2 population._

Required source artifacts for this section:

- `.agent/macra/contract.md`
- `.agent/macra/state.json`
- `.agent/macra/progress.md`
- `.agent/macra/decisions.md`
- `.agent/macra/runbook.md`

This section must separate current operating facts from stale context, including the saved 2026-06-25 run and stale `/admin/experiments` snapshot.

## af_start_trial

_Pending Step 3 population._

Required source artifacts to inspect:

- `netlify/functions/sync-macra-appsflyer-raw-data.ts`
- `src/pages/admin/experiments.tsx`
- `src/pages/admin/emailSequences.tsx`

This section must define whether `af_start_trial` is trial-start evidence, how it is grouped, and what user/date/unit caveats apply.

## af_purchase

_Pending Step 3 population._

Required source artifacts to inspect:

- `netlify/functions/sync-macra-appsflyer-raw-data.ts`
- `src/pages/admin/experiments.tsx`
- `src/pages/admin/emailSequences.tsx`

This section must define whether `af_purchase` is paid-conversion evidence, trial-start evidence, or a post-trial monetization signal.

## af_subscribe

_Pending Step 3 population._

Required source artifacts to inspect:

- `netlify/functions/sync-macra-appsflyer-raw-data.ts`
- `src/pages/admin/experiments.tsx`
- `src/pages/admin/emailSequences.tsx`

This section must define whether `af_subscribe` is distinct from `af_purchase`, whether it can double count the same user journey, and how it should be reconciled.

## purchase_cancelled

_Pending Step 3 population._

Required source artifacts to inspect:

- `netlify/functions/sync-macra-appsflyer-raw-data.ts`
- `src/pages/admin/emailSequences.tsx`
- `src/pages/admin/macraPurchaseLogs.tsx`
- `src/pages/admin/macraCancelReasons.tsx`

This section must define whether `purchase_cancelled` decreases trial-start trust, reverses purchase-boundary progression, or merely annotates a cancelled transaction.

## web_checkout_started

_Pending Step 3 population._

Required source artifacts to inspect:

- `netlify/functions/sync-macra-appsflyer-raw-data.ts`
- `src/pages/admin/experiments.tsx`
- `src/pages/admin/emailSequences.tsx`
- `src/pages/admin/macraPurchaseLogs.tsx`

This section must define whether `web_checkout_started` is upstream intent, checkout evidence, or trial-start evidence, and whether it overlaps with `af_initiated_checkout`.

## StoreKit cancel

_Pending Step 3 population._

Required source artifacts to inspect:

- `/admin/purchaseLogs`
- `/admin/macraPurchaseLogs`
- `src/pages/admin/macraPurchaseLogs.tsx`
- `src/pages/admin/macraCancelReasons.tsx`
- `.agent/macra/state.json`

This section must define how StoreKit cancel differs from AppsFlyer `purchase_cancelled`, whether the two can collide, and how cancellation timing affects the 2/day signal.

## Signal Separation Matrix

_Pending Step 4 population._

| Event | Trigger | Source system | User identifier | Timestamp field | Dedupe key | Effect on qualified onboarding-start-to-trial-start metric |
| --- | --- | --- | --- | --- | --- | --- |
| `af_start_trial` | Pending | Pending | Pending | Pending | Pending | Pending |
| `af_purchase` | Pending | Pending | Pending | Pending | Pending | Pending |
| `af_subscribe` | Pending | Pending | Pending | Pending | Pending | Pending |
| `purchase_cancelled` | Pending | Pending | Pending | Pending | Pending | Pending |
| `web_checkout_started` | Pending | Pending | Pending | Pending | Pending | Pending |
| StoreKit cancel | Pending | Pending | Pending | Pending | Pending | Pending |

## Tracking Ambiguities

_Pending Step 5 population._

This section must include ambiguities that could make the reported 2/day trial-start signal look stronger or weaker than reality, including:

- possible double counting between `af_start_trial` and subscription or purchase events
- checkout-start inflation from `web_checkout_started`
- cancellation timing conflicts between `purchase_cancelled` and StoreKit cancel
- stale or aggregate-only source data that cannot prove user-level trial starts

## Trust Verdict

_Pending Step 6 population._

This section must end with:

- pass/fail criteria for counting a valid Macra trial start
- the primary metric protected
- the guardrail most likely to catch misleading growth
- one recommendation or an explicit no-change recommendation

