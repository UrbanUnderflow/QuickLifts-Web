# Macra Event Semantics & Trust Audit: variant_a Freshness Gate

**Date:** 2026-07-04  
**Owner:** Sage  
**Status:** Step 1 scaffold created; evidence population pending  
**Task:** Refresh active `variant_a` experiment-result context before any funnel decision, then audit `af_start_trial`, `af_purchase`, `af_subscribe`, `purchase_cancelled`, `web_checkout_started`, StoreKit cancel, age eligibility, and activation-quality signals for misleading growth risk.

## Operating Context

_Pending Step 2 population._

This section will cite the Macra operating contract, durable state, progress log, decision log, and runbook before interpreting any July 4 growth signal. It must separate observed facts from inference and label stale AppsFlyer, Scoreboard, and `/admin/experiments` evidence clearly.

Required source artifacts:

- `.agent/macra/contract.md`
- `.agent/macra/state.json`
- `.agent/macra/progress.md`
- `.agent/macra/decisions.md`
- `.agent/macra/runbook.md`
- latest available Scoreboard, AppsFlyer import, purchase-log, cancel-reason, user-state, and retargeting artifacts discovered during execution

## variant_a Experiment Freshness

_Pending Step 2 population._

This section will record whether active `variant_a` results were refreshed or remain stale from the 2026-06-16 retired hard-paywall snapshot. It must cite `/admin/experiments`, Firestore experiment/result documents when available, and the Macra durable state/progress/decision files.

Required fields to capture:

- active experiment id and active variant
- current variant configuration
- saved result snapshot timestamp
- whether the result reflects active `variant_a`
- assignment quality and inference risk
- AppsFlyer validation coverage
- pass/fail freshness verdict for funnel decisions

## af_start_trial

_Pending Step 3 population._

This section must define the source artifact, source system, trigger, timestamp field, user identifier, dedupe key, and metric effect for `af_start_trial`.

## af_purchase

_Pending Step 3 population._

This section must define the source artifact, source system, trigger, timestamp field, user identifier, dedupe key, and metric effect for `af_purchase`.

## af_subscribe

_Pending Step 3 population._

This section must define the source artifact, source system, trigger, timestamp field, user identifier, dedupe key, and metric effect for `af_subscribe`, including whether it overlaps with `af_purchase` as a paid-conversion signal.

## purchase_cancelled

_Pending Step 3 population._

This section must define the source artifact, source system, trigger, timestamp field, user identifier, dedupe key, and metric effect for `purchase_cancelled`, including whether it weakens or reverses trial-start trust.

## web_checkout_started

_Pending Step 3 population._

This section must define the source artifact, source system, trigger, timestamp field, user identifier, dedupe key, and metric effect for `web_checkout_started`, including overlap with `af_initiated_checkout` and purchase-log checkout attempts.

## StoreKit cancel

_Pending Step 3 population._

This section must define how StoreKit cancel differs from AppsFlyer `purchase_cancelled`, whether those signals can collide, and how cancellation timing affects any reported trial-start pattern.

## age eligibility

_Pending Step 4 population._

This section must cite user-state and eligibility code paths for birthdate, missing-birthdate, age-unverified, and under-18 handling. It must state whether each signal blocks, confirms, weakens, or reverses a valid trial-start count.

## activation-quality signals

_Pending Step 4 population._

This section must cite trial activation fields/events, onboarding quality state, `/admin/macraCancelReasons`, and retargeting/no-activation recovery logic. It must state whether each signal confirms or weakens a valid trial-start count.

## Ambiguities

_Pending Step 5 population._

This section must list every mismatch that could distort the growth signal, including stale `variant_a` results, `af_start_trial` versus `af_subscribe`, AppsFlyer purchase versus `/admin/purchaseLogs`, checkout starts without activation, StoreKit cancels after start, and age or birthdate blocks.

## Funnel Decision Gate

_Pending Step 6 population._

This section must end with a pass/fail rule: no Macra funnel decision can proceed unless `/admin/experiments` has fresh active `variant_a` results and event semantics pass trust guardrails for source freshness, user-level dedupe, eligibility, activation quality, purchase cancel pressure, checkout failure/cancel rate, paid conversion after trial, and cancel reasons.

### Step 1 status

Complete. This scaffold contains the required July 4 sections and leaves evidence population to the later steps rather than presenting stale data as current truth.
