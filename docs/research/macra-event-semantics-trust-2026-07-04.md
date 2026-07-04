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

### Observed facts

- The durable Macra state records the active experiment as `variant_a`, configured as **monthly + annual, both with trial**. It also carries a known issue: the saved `/admin/experiments` results snapshot was stale from **2026-06-16** and still reflected a retired hard-paywall configuration. Source: `.agent/macra/state.json`
- The Macra progress log names stale `/admin/experiments` results as the most urgent data issue because live config is now `variant_a`, while the saved result context had been tied to the retired hard-paywall read. Source: `.agent/macra/progress.md`
- Nora's decision log says the first operational task is refreshing/backfilling `/admin/experiments` results for active `variant_a`, with the guardrail **do not decide from stale variant data**. Source: `.agent/macra/decisions.md`
- Nora's later no-change decision keeps onboarding, paywall, pricing, experiment allocation, retargeting, and Apple Search Ads spend frozen during validation because AppsFlyer/Scoreboard coverage ends **2026-06-25**, purchase logs only confirm 2 trial-success rows on **2026-06-29**, and experiment results generated **2026-06-25** are mostly inferred. Source: `.agent/macra/decisions.md`; `.agent/macra/progress.md`
- `/admin/experiments` is backed by Firestore `macra-experiments/macra_paywall_onboarding` for live config and `macra-experiment-results/macra_paywall_onboarding` for saved results. The admin implementation defines those collection/doc IDs and includes a `Refresh results` action that writes a new snapshot with `generatedAt`, assignment counts, `qualityLabel`, aggregate validation, data input counts, and `configSnapshot`. Source: `src/pages/admin/experiments.tsx`; Firestore `macra-experiments/macra_paywall_onboarding`; Firestore `macra-experiment-results/macra_paywall_onboarding`
- Read-only Firestore check on 2026-07-04 found the live config exists, was updated at **2026-06-17T10:31:39.693Z**, uses primary metric `paid_conversion`, and assigns `variant_a` weight `100` while `baseline`, `variant_b`, and `variant_c` each have weight `0`. Source: Firestore `macra-experiments/macra_paywall_onboarding`; `src/pages/admin/experiments.tsx`
- The saved result snapshot exists and was generated at **2026-06-25T10:08:00.102Z** / updated at **2026-06-25T10:08:00.461Z**. Its `configSnapshot` reflects active `variant_a` with weight `100`, so it is not the old 2026-06-16 retired hard-paywall snapshot. Source: Firestore `macra-experiment-results/macra_paywall_onboarding`
- The saved result quality is **Mostly inferred assignments**: 692 loaded users, 692 assigned users, 95 exact assignments, 597 inferred assignments, and 0 unknown assignments. Source: Firestore `macra-experiment-results/macra_paywall_onboarding`
- The result inputs are uneven: 288 purchase logs, 692 profiles/onboarding users, 32,241 AppsFlyer aggregate events, and **0 AppsFlyer user docs**. The aggregate validation records 7 AppsFlyer trial starts and notes that AppsFlyer aggregate data can validate top-line volume but cannot split by variant unless event metadata includes the variant. Source: Firestore `macra-experiment-results/macra_paywall_onboarding`
- The `variant_a` result row records 503 qualified users, 692 onboarding completions, 692 paywall views, 40 checkout starts, 107 Apple cancels, 7 trial starts, 3 paid conversions, 95 exact assignments, and 597 inferred assignments. Source: Firestore `macra-experiment-results/macra_paywall_onboarding`

### Inference

The active `variant_a` result context is **partially refreshed, not decision-fresh**. It has moved beyond the stale 2026-06-16 retired hard-paywall snapshot because the current saved result snapshot was generated on 2026-06-25 and its config snapshot matches active `variant_a`. But this audit did **not** create a new July 4 results refresh/backfill, and the saved result is still nine days old on 2026-07-04, mostly inferred, and missing AppsFlyer user-doc inputs for variant-level source validation. Treat `/admin/experiments` as observe-only evidence until a fresh active-`variant_a` snapshot is generated and reconciled with current AppsFlyer/Scoreboard coverage, purchase logs, cancel reasons, eligibility, and activation-quality guardrails. Source: `.agent/macra/state.json`; `.agent/macra/progress.md`; `.agent/macra/decisions.md`; `src/pages/admin/experiments.tsx`; Firestore `macra-experiments/macra_paywall_onboarding`; Firestore `macra-experiment-results/macra_paywall_onboarding`

### Freshness verdict

**Fail for funnel decisioning.** Active `variant_a` results were verified as refreshed past the 2026-06-16 retired hard-paywall snapshot, but they were **not refreshed in this Step 2 execution** and remain stale/incomplete for July 4 decisions. No onboarding, paywall, pricing, experiment allocation, retargeting, or Apple Search Ads decision should use this snapshot as a winner call.

Primary metric protected: `qualified_onboarding_start_to_trial_start`.

Guardrail: stale-source risk plus mostly inferred experiment assignments, missing AppsFlyer user-doc variant split, Apple purchase cancels, checkout failure/cancel pressure, age eligibility, activation quality, paid conversion after trial, and cancel reasons.

### Step 2 status

Complete. This section now cites `/admin/experiments`, Firestore `macra-experiments/macra_paywall_onboarding`, Firestore `macra-experiment-results/macra_paywall_onboarding`, `.agent/macra/state.json`, `.agent/macra/progress.md`, and `.agent/macra/decisions.md`; it explicitly records that active `variant_a` results are past the 2026-06-16 hard-paywall snapshot but still fail July 4 funnel-decision freshness.

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
