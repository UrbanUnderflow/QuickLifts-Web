# Macra Event Semantics & Trust Audit: Trial Signal Verification

**Date:** 2026-06-30  
**Owner:** Sage  
**Status:** Scaffold created for event-semantics execution  
**Task:** Verify that `af_start_trial`, `af_purchase`, `af_subscribe`, `purchase_cancelled`, `web_checkout_started`, and StoreKit cancel are cleanly separated, and flag any tracking ambiguity that could make the reported 2/day trial-start signal look stronger or weaker than reality.

## Operating Context

### Observed operating facts

- Macra's operating mission is to make the trial-start path repeatable without breaking user trust. The primary metric is **qualified onboarding start to trial start**. Source: `.agent/macra/contract.md`
- The required guardrails for this audit are Apple purchase cancels, checkout failure or checkout cancel rate, under-18 and missing-birthdate blocks, trial activation after start, paid conversion after trial, and cancel reasons including price, not ready, need more proof, and something broke. Source: `.agent/macra/contract.md`; `.agent/macra/state.json`
- Sage's role in the Macra operating model is product quality and trust: event semantics, age eligibility, activation quality, nutrition safety, claims/compliance, and whether conversion gains are coming from the right users. Source: `.agent/macra/contract.md`; `.agent/macra/runbook.md`
- The approved operating loop is observe, separate facts/calculations/inference, recommend one action or no action, name the primary metric and guardrail, and log decisions in `.agent/macra/decisions.md`. Source: `.agent/macra/contract.md`
- Agents may prepare analysis and documentation, but must not change pricing, live paywall configuration, Apple Search Ads budget, experiment allocation, eligibility rules, or retargeting behavior without operator approval. Source: `.agent/macra/contract.md`

### Stale or incomplete context

- **Stale saved run:** the durable Macra state records the latest saved run as **2026-05-27 through 2026-06-25**, sourced from an AppsFlyer aggregate report aligned with the saved Macra Scoreboard. Because the task is dated 2026-06-30, this run is stale context and should not be treated as a current same-day read. Source: `.agent/macra/state.json`; `.agent/macra/progress.md`
- **Stale AppsFlyer/Scoreboard coverage:** the June 30 progress log says AppsFlyer/Scoreboard coverage is stale through **2026-06-25**, so the June 28-30 source split and full funnel cannot be confirmed from AppsFlyer yet. Source: `.agent/macra/progress.md`
- The stale saved run recorded 533 unique onboarding starts, 448 reached paywall, 317 paywall primary CTA presses, 94 initiated checkouts, 5 trial starts, 3 purchases, and 3 subscribes. It also recorded start-to-paywall at 84.1%, paywall-to-CTA at 70.8%, CTA-to-checkout at 29.7%, and checkout-to-trial at 5.3%. Source: `.agent/macra/state.json`
- The same stale saved run split trial starts by source: organic produced 2 trials from 406 starts, while Apple Search Ads produced 3 trials from 127 starts. The stored interpretation says Apple Search Ads is outperforming organic on conversion quality, but this is an early signal and **not proof of product-market fit**. Source: `.agent/macra/state.json`; `.agent/macra/progress.md`
- **Stale experiment context:** the active experiment is recorded as `variant_a`, configured as monthly plus annual with trial, but the saved `/admin/experiments` results snapshot is marked stale from **2026-06-16** and still reflects a retired hard-paywall configuration. Source: `.agent/macra/state.json`; `.agent/macra/progress.md`; `.agent/macra/decisions.md`
- **Partially confirmed trial-success context:** the June 30 progress log cross-checked `Macra-purchase-logs` and found 2 trial-success rows on 2026-06-29, with 0 on 2026-06-28 and 0 on 2026-06-30 as of the read. This is purchase-log evidence, not refreshed AppsFlyer source-split evidence. Source: `.agent/macra/progress.md`
- **Inferred experiment-result risk:** Nora's June 30 decision row says the operating snapshot evidence included experiment results generated on **2026-06-25** and mostly inferred. That keeps experiment evidence in the stale/incomplete bucket until refreshed. Source: `.agent/macra/decisions.md`
- Nora's logged decision is that the first operational task is refreshing/backfilling `/admin/experiments` results for active `variant_a` before decisions are made from experiment evidence. Source: `.agent/macra/decisions.md`

### Source-of-truth surfaces for this audit

The Macra runbook requires recommendations to use source-of-truth surfaces before proposing funnel changes: the Macra Scoreboard under the Email Sequence surface, `/admin/experiments`, `/admin/purchaseLogs`, `/admin/macraCancelReasons`, AppsFlyer CSV imports, retargeting state and email sequence state, and Firestore docs or committed artifacts when they are the source of a calculation. Source: `.agent/macra/runbook.md`

For this specific event-semantics audit, the runbook assigns Sage to audit `af_start_trial`, `af_purchase`, `af_subscribe`, `purchase_cancelled`, `web_checkout_started`, and StoreKit cancel; check age eligibility and activation-quality signals; and flag ambiguity that could make the team scale a misleading signal. Source: `.agent/macra/runbook.md`

### Decision-log context

- On 2026-06-29, Nora logged that agents should stay in observe/recommend/decide/log posture before changing the funnel. The guardrail was to avoid random funnel changes while the trial-start signal is early. Source: `.agent/macra/decisions.md`
- On 2026-06-29, Nora logged that refreshing/backfilling `/admin/experiments` for active `variant_a` is the first operational task because the experiment snapshot is stale. Source: `.agent/macra/decisions.md`
- On 2026-06-30, Solara logged a **proposed-only** 72-hour validation for one paywall copy change, explicitly with no live change without Nora approval. That decision cites cancellation and purchase-log pressure, including 161 canceled rows in `Macra-purchase-logs`, and sets StoreKit purchase cancels plus cancel-feedback volume as guardrails. Source: `.agent/macra/decisions.md`
- On 2026-06-30, Nora logged a no-change decision for the 72-hour signal validation window: do not change onboarding, paywall, pricing, experiment allocation, retargeting behavior, or Apple Search Ads spend until coverage is refreshed and the signal is validated. Source: `.agent/macra/progress.md`; `.agent/macra/decisions.md`

### Inference for the event-semantics audit

The reported 2/day trial-start signal should be treated as **unverified** until the audit identifies its exact source artifact, date range, user identifier, timestamp field, and dedupe behavior. The durable context currently available to this file supports a stale saved AppsFlyer/Scoreboard run through 2026-06-25, purchase-log evidence of 2 trial-success rows on 2026-06-29, and a known stale or inferred `/admin/experiments` snapshot. This audit should not present 2/day as settled current truth until later sections connect it to fresh AppsFlyer, Scoreboard, purchase-log, or Firestore evidence. Source: `.agent/macra/state.json`; `.agent/macra/progress.md`; `.agent/macra/runbook.md`; `.agent/macra/decisions.md`

### Step 2 status

Complete. This section now cites `.agent/macra/contract.md`, `.agent/macra/state.json`, `.agent/macra/progress.md`, `.agent/macra/decisions.md`, and `.agent/macra/runbook.md`; it explicitly labels stale Scoreboard/AppsFlyer coverage through 2026-06-25 and stale or inferred `/admin/experiments` evidence.

## Audit Research Plan

### Research question

Can Macra count the reported trial-start growth signal without overstating real user progress, or do event overlap, stale source coverage, age eligibility, activation quality, purchase cancellation, and decision-log gaps make the signal unsafe to scale?

### Audience and decision this plan supports

This plan is for Nora's Macra operating decision: whether the team can use the current trial-start signal to make funnel, pricing, experiment-allocation, retargeting, or Apple Search Ads decisions. The default answer before execution is **no change / no scale** until the execute step proves that trial starts are current, deduped, eligible, activated, and not offset by cancellation pressure. Source: `.agent/macra/contract.md`; `.agent/macra/decisions.md`; `.agent/macra/runbook.md`

### Evidence map for the execute step

1. **AppsFlyer import and Scoreboard coverage.** Inspect `netlify/functions/sync-macra-appsflyer-raw-data.ts`, Firestore `appsflyer-scoreboards/macra`, `appsflyer-aggregate-periods`, `appsflyer-macra-raw-rows`, and `appsflyer-macra-users` to identify the latest imported date range, raw/person-level row availability, event timestamps, user identifiers, and dedupe fields. The current durable context says AppsFlyer/Scoreboard coverage is stale through 2026-06-25, so June 28-30 source split and full funnel remain unconfirmed until execution refreshes or verifies those surfaces. Source: `.agent/macra/state.json`; `.agent/macra/progress.md`; `src/pages/admin/emailSequences.tsx`; `netlify/functions/sync-macra-appsflyer-raw-data.ts`
2. **Event grouping in admin experiment logic.** Use `src/pages/admin/experiments.tsx` as the committed analytics map for trial-start, checkout-start, paid-conversion, Apple-cancel, cancel-feedback, and activation-quality event families. It groups `af_start_trial` with trial-start aliases, `af_subscribe` and `af_purchase` with paid-conversion aliases, `af_initiated_checkout` with `macra_subscription_web_checkout_started`, `macra_subscription_purchase_cancelled` as Apple cancel, and activation screen / primary actions as post-start quality. Source: `src/pages/admin/experiments.tsx`
3. **Scoreboard checkout and cancel families.** Use `src/pages/admin/emailSequences.tsx` to cross-check Scoreboard event families. It keeps checkout starts, purchase cancels, purchase failures, trial starts, and purchase events in separate AppsFlyer families, and it includes `macra_subscription_web_checkout_started` in the checkout family rather than the trial-start family. Source: `src/pages/admin/emailSequences.tsx`
4. **Purchase-log state.** Use `/admin/purchaseLogs`, `/admin/macraPurchaseLogs`, and Firestore `Macra-purchase-logs` to separate attempted, success, failed, and canceled purchase lifecycle rows from AppsFlyer aggregate events. The purchase-log admin surface defines the Macra source collection as `Macra-purchase-logs` and exposes `status`, `purchaseStatus`, `userId`, `email`, plan, source, platform, error, cancel reason, metadata, and created/updated timestamp fields. Source: `src/pages/admin/macraPurchaseLogs.tsx`; `.agent/macra/progress.md`; `.agent/macra/decisions.md`
5. **Cancel-reason trust pressure.** Use `/admin/macraCancelReasons` and Firestore `Macrafeedbackreason` to identify reasons that weaken a nominal trial-start signal, especially price, not ready, need more proof, something broke, and Apple sheet confusion. The admin surface reads `reason`, `reasonLabel`, `trigger`, `source`, selected plan fields, surface, app, demo flag, timestamp fields, metadata, and user context from `Macrafeedbackreason`. Source: `src/pages/admin/macraCancelReasons.tsx`; `.agent/macra/contract.md`; `.agent/macra/decisions.md`
6. **Age eligibility and missing-birthdate blocks.** Use `netlify/functions/utils/macraStripe.js`, `src/pages/admin/emailSequences.tsx`, and user/profile state to distinguish eligible users from `age_unverified` and `under_18` cases. `macraStripe.js` resolves Macra birthdate from `users/{userId}/macra/profile.birthdate` before root `users.birthdate`, marks missing or invalid age as `age_unverified`, and marks age below 18 as `under_18`. Source: `netlify/functions/utils/macraStripe.js`; `src/pages/admin/emailSequences.tsx`; `.agent/macra/contract.md`
7. **Activation quality after trial start.** Use `src/pages/admin/experiments.tsx` and `netlify/functions/schedule-macra-retargeting-email.ts` to treat trial activation as a post-start quality signal, not a synonym for trial start. The experiment map tracks `macra_trial_activation_screen_viewed` and `macra_trial_activation_primary_pressed`; retargeting logic can match active subscription/trial users who have no Macra activation yet as `trial_no_activation`. Source: `src/pages/admin/experiments.tsx`; `netlify/functions/schedule-macra-retargeting-email.ts`

### Execution plan

1. Build a signal table for `af_start_trial`, `af_purchase`, `af_subscribe`, `purchase_cancelled`, `web_checkout_started`, and StoreKit cancel with these fields: source artifact, source system, trigger, timestamp field, user identifier, dedupe key, metric effect, and confidence. Source: `.agent/macra/runbook.md`; `src/pages/admin/experiments.tsx`; `src/pages/admin/emailSequences.tsx`
2. Classify each signal as one of four effects on `qualified_onboarding_start_to_trial_start`: **counts toward**, **annotates**, **weakens**, or **reverses/blocks**. `af_start_trial` can count only after user-level dedupe and eligibility checks; checkout and web-checkout events annotate intent; purchase/subscription events are downstream paid-conversion evidence; cancel, failed, under-18, missing-birthdate, and no-activation signals weaken or block scaling confidence. Source: `.agent/macra/contract.md`; `src/pages/admin/experiments.tsx`; `src/pages/admin/emailSequences.tsx`; `netlify/functions/utils/macraStripe.js`
3. Reconcile AppsFlyer aggregate rows against person-level AppsFlyer rows and `Macra-purchase-logs` before reporting any current trial-start rate. If the source only supports stale aggregate coverage through 2026-06-25 or purchase-log-only rows on 2026-06-29, label the signal stale or partial instead of decision-fresh. Source: `.agent/macra/state.json`; `.agent/macra/progress.md`; `.agent/macra/decisions.md`
4. Read cancel reasons and purchase cancellations as guardrails, not as conversion events. Any increase in checkout starts or trial starts that also raises StoreKit cancel, purchase failure, `paywall_cancel_feedback`, price, proof, readiness, or broken-flow reasons should block scale recommendations. Source: `.agent/macra/contract.md`; `src/pages/admin/macraPurchaseLogs.tsx`; `src/pages/admin/macraCancelReasons.tsx`
5. Record every ambiguity in the `Ambiguities` section before making a recommendation, including stale `variant_a` results, `af_start_trial` versus `af_subscribe`, AppsFlyer purchase versus `/admin/purchaseLogs`, checkout starts without activation, StoreKit cancels after start, and age or birthdate blocks. Source: `.agent/macra/runbook.md`; `.agent/macra/decisions.md`

### Planned recommendation gate

The execute step should recommend **no scaling action** unless all of these pass: current AppsFlyer/Scoreboard coverage, fresh active-`variant_a` experiment evidence, user-level dedupe across AppsFlyer and purchase logs, eligibility confirmed for counted users, activation quality not materially missing after start, and cancellation/failure/cancel-reason guardrails not worsening. Primary metric: `qualified_onboarding_start_to_trial_start`. Guardrails: Apple purchase cancels, checkout failure/cancel rate, under-18 and missing-birthdate blocks, trial activation after start, paid conversion after trial, and cancel reasons. Source: `.agent/macra/contract.md`; `.agent/macra/state.json`; `.agent/macra/runbook.md`; `.agent/macra/decisions.md`

### Step 1 status

Complete. This research plan defines the audit question, audience, evidence map, execution sequence, metric effect classification, and no-scale gate required before event semantics can be used for funnel decisions.

## Daily KPI Snapshot

### Observed facts

- The latest durable KPI window is **2026-05-27 through 2026-06-25**, sourced from an AppsFlyer aggregate report aligned with the saved Macra Scoreboard. Source: `.agent/macra/state.json`
- That saved window records **533** unique onboarding starts, **448** users reaching paywall, **317** paywall primary CTA presses, **94** initiated checkouts, **5** trial starts, **3** purchases, and **3** subscribes. Source: `.agent/macra/state.json`; `.agent/macra/progress.md`
- The saved rates for that window are **84.1%** start-to-paywall, **70.8%** paywall-to-primary-CTA, **29.7%** CTA-to-checkout, and **5.3%** checkout-to-trial. Source: `.agent/macra/state.json`
- The saved source split is stale but directionally important: organic produced **2** trials from **406** starts, while Apple Search Ads produced **3** trials from **127** starts. Source: `.agent/macra/state.json`; `.agent/macra/progress.md`
- The June 30 progress log explicitly says AppsFlyer/Scoreboard coverage is stale through **2026-06-25**, so the June 28-30 source split and full funnel cannot be confirmed from AppsFlyer yet. Source: `.agent/macra/progress.md`
- Nora's June 30 decision log records a no-change validation window because AppsFlyer/Scoreboard coverage ends **2026-06-25**, purchase logs only confirm 2 trial-success rows on **2026-06-29**, and experiment results were generated **2026-06-25** and mostly inferred. Source: `.agent/macra/decisions.md`

### Inference

The daily KPI snapshot should be treated as **stale operating context**, not a decision-fresh daily read. It is useful for preserving the known funnel shape and source-quality hypothesis, but it should not trigger funnel, pricing, experiment allocation, retargeting, or Apple Search Ads changes until Scoreboard, AppsFlyer, and experiment coverage are refreshed for the current decision window. Source: `.agent/macra/state.json`; `.agent/macra/progress.md`; `.agent/macra/decisions.md`

## Scoreboard

### Observed facts

- The Macra runbook names the **Macra Scoreboard under the Email Sequence surface** as a source-of-truth surface before proposing funnel changes. Source: `.agent/macra/runbook.md`
- The Scoreboard implementation in `/admin/emailSequences` loads the AppsFlyer scoreboard summary from Firestore `appsflyer-scoreboards/macra`, aggregate periods from `appsflyer-aggregate-periods`, raw rows from `appsflyer-macra-raw-rows`, and person-level attribution from `appsflyer-macra-users`. Source: `src/pages/admin/emailSequences.tsx`
- The Scoreboard implementation supports range presets and defaults the Macra AppsFlyer scoreboard window to **7 days**. Source: `src/pages/admin/emailSequences.tsx`
- The durable saved Scoreboard-aligned read covers **2026-05-27 through 2026-06-25**. Source: `.agent/macra/state.json`
- The June 30 progress log marks Scoreboard coverage as stale through **2026-06-25**, meaning the June 28-30 full funnel cannot yet be confirmed from the Scoreboard/AppsFlyer path. Source: `.agent/macra/progress.md`

### Inference

The Scoreboard should remain the operating surface for the daily KPI snapshot, but this file should not treat the current Scoreboard coverage as fresh. Any June 30 funnel decision would need a refreshed Scoreboard read with the selected range, loaded timestamp, AppsFlyer aggregate coverage, and raw/person-level row availability recorded. Source: `.agent/macra/runbook.md`; `.agent/macra/progress.md`; `src/pages/admin/emailSequences.tsx`

### Step 2 status

Complete. This section now cites the Macra Scoreboard operating surface, the Scoreboard implementation path, the durable saved range, and the stale-through-2026-06-25 coverage caveat required before the KPI snapshot can be used for funnel decisions.

## Experiments

### Observed facts

- The active durable experiment state is `variant_a`, configured as **monthly + annual, both with trial**. Source: `.agent/macra/state.json`
- The durable state still carries a known issue: saved `/admin/experiments` results were stale from **2026-06-16** and still reflected the retired hard-paywall configuration, so the first task was to refresh/backfill experiment results before making decisions from variant data. Source: `.agent/macra/state.json`; `.agent/macra/progress.md`; `.agent/macra/decisions.md`
- `/admin/experiments` reads the live experiment from Firestore `macra-experiments/macra_paywall_onboarding` and saved results from `macra-experiment-results/macra_paywall_onboarding`. Source: `src/pages/admin/experiments.tsx`
- The default experiment definition marks `variant_a` as the active flow from **2026-06-16**, with monthly and annual plans both offering a 3-day trial, while the hard-paywall monthly `variant_c` is retired. Source: `src/pages/admin/experiments.tsx`
- Nora's June 30 decision log records experiment results generated **2026-06-25** and mostly inferred as part of the evidence for holding all funnel changes during the validation window. Source: `.agent/macra/decisions.md`

### Freshness verdict

`variant_a` is the active configuration, but experiment results are **not decision-fresh** for a June 30 funnel call. The old 2026-06-16 hard-paywall warning is still part of durable state, and the later 2026-06-25 result snapshot is still stale/inferred relative to the current operating date. Treat experiment evidence as a guardrail gap until `/admin/experiments` has a refreshed active-`variant_a` snapshot with clear assignment quality and current AppsFlyer validation. Source: `.agent/macra/state.json`; `.agent/macra/progress.md`; `.agent/macra/decisions.md`; `src/pages/admin/experiments.tsx`

### Step 2 status

Complete. This section now cites the active `variant_a` durable state, `/admin/experiments` Firestore collections and implementation path, and the stale/inferred experiment-result risk that blocks decision-fresh variant conclusions.

## Purchase Logs

### Observed facts

- `/admin/purchaseLogs` / `/admin/macraPurchaseLogs` reads Firestore `Macra-purchase-logs` for Macra purchase attempts, successes, failures, cancellations, and cancellation reasons. Source: `src/pages/admin/macraPurchaseLogs.tsx`
- The purchase-log row schema exposes `userId`, `email`, `status`, `purchaseStatus`, plan fields, source, error fields, cancel reason fields, metadata, `createdAt`, `createdAtEpoch`, `updatedAt`, and `updatedAtEpoch`. Source: `src/pages/admin/macraPurchaseLogs.tsx`
- The June 30 operating snapshot scanned `Macra-purchase-logs` and found 2 trial-bearing success rows on 2026-06-29, 0 trial-success rows on 2026-06-28, and 0 trial-success rows on 2026-06-30 as of the read. Source: `docs/ops/macra-operating-snapshot-2026-06-30.md`
- The same snapshot found 3 canceled and 2 failed rows on 2026-06-28, plus 2 canceled rows on 2026-06-29. Source: `docs/ops/macra-operating-snapshot-2026-06-30.md`

### Inference

Purchase logs provide the freshest lower-funnel evidence in the June 30 read, but they do not replace AppsFlyer/Scoreboard coverage for source split or full-funnel rates. The 2 trial-success rows on June 29 are a real signal, while the neighboring canceled/failed rows keep checkout trust pressure active.

## Cancel Reasons

### Observed facts

- `/admin/macraCancelReasons` reads Firestore `Macrafeedbackreason` for cancellation feedback with `userId`, `email`, `reason`, `reasonLabel`, `trigger`, `source`, selected plan fields, surface, app, demo flag, timestamp fields, metadata, and joined user context. Source: `src/pages/admin/macraCancelReasons.tsx`
- The June 30 operating snapshot found 1 production cancel-feedback row on 2026-06-28, with top reason `Price felt too high` and trigger `storekit_cancelled`; it found 0 rows on 2026-06-29 and 0 on 2026-06-30 as of the read. Source: `docs/ops/macra-operating-snapshot-2026-06-30.md`
- The decision log records a broader Solara evidence base of 69 production cancel-feedback rows led by price, not ready, need proof, something did not work, and Apple sheet confusion. Source: `.agent/macra/decisions.md`

### Inference

Cancel reasons are a trust guardrail, not a conversion event. Even sparse recent feedback matters because the reason category lines up with purchase cancellation and failed checkout pressure. A trial-start signal that rises while price, proof, readiness, breakage, or Apple sheet confusion persists should not be scaled.

## Retargeting

### Observed facts

- `/admin/emailSequences` defines Macra retargeting sequence IDs and state fields, including trial activation recovery and sent/open/click/conversion-style state. Source: `src/pages/admin/emailSequences.tsx`
- Retargeting execution logic includes a `trialActivation` rule that can match active subscription/trial users who have no Macra activation yet; it also suppresses already activated users, active users not yet due, active users without confirmed trial evidence, and historical trial/subscription users. Source: `netlify/functions/schedule-macra-retargeting-email.ts`
- The June 30 operating snapshot scanned 853 `registrationEntryPoint == "macra"` users for common `macraEmailSequenceState` fields and found no recent retargeting sends, opens/clicks, checkout starts, trial starts, paid conversions, under-18 blocks, or missing-birthdate blocks on June 28-30; it explicitly called the read limited, not absolute. Source: `docs/ops/macra-operating-snapshot-2026-06-30.md`

### Inference

Retargeting state is not a current proof of activation quality in the June 30 read. It is a monitoring surface for no-activation and recovery pressure, but the absence of recent rows in a limited user-state scan should not be treated as evidence that activation risk is clear.

## AppsFlyer Coverage

### Observed facts

- The AppsFlyer import function writes Macra summary data into `appsflyer-scoreboards/macra`, user attribution into `appsflyer-macra-users`, raw rows into `appsflyer-macra-raw-rows`, and aggregate periods into `appsflyer-aggregate-periods`. Source: `netlify/functions/sync-macra-appsflyer-raw-data.ts`
- The default Macra AppsFlyer event allowlist includes onboarding, paywall, checkout, purchase-cancel, web-checkout, trial, subscribe, and purchase events, including `af_initiated_checkout`, `macra_subscription_purchase_cancelled`, `macra_subscription_web_checkout_started`, `af_start_trial`, `af_subscribe`, and `af_purchase`. Source: `netlify/functions/sync-macra-appsflyer-raw-data.ts`
- The latest durable AppsFlyer aggregate coverage used for the KPI snapshot is **2026-05-27 through 2026-06-25**. Source: `.agent/macra/state.json`
- The stale AppsFlyer source split records organic at **406** starts and **2** trials, and Apple Search Ads at **127** starts and **3** trials. Source: `.agent/macra/state.json`
- The stored interpretation says Apple Search Ads is outperforming organic on conversion quality, but it is an early signal and **not proof of product-market fit**. Source: `.agent/macra/state.json`
- The June 30 progress log says June 28-30 source split and full funnel cannot be confirmed from AppsFlyer yet because AppsFlyer/Scoreboard coverage remains stale through **2026-06-25**. Source: `.agent/macra/progress.md`

### Inference

AppsFlyer remains the right source for source split and campaign-quality interpretation, but the current coverage is stale. The Apple Search Ads signal can be carried forward as a hypothesis, not as a spend-scaling conclusion, until AppsFlyer aggregate, raw-row, and person-level coverage are refreshed and reconciled with Scoreboard and purchase-log evidence. Source: `.agent/macra/state.json`; `.agent/macra/progress.md`; `netlify/functions/sync-macra-appsflyer-raw-data.ts`

### Step 2 status

Complete. This section now cites the AppsFlyer import destination collections, the default Macra event allowlist, the durable aggregate coverage window, and the stale source-split caveat that prevents spend-scaling conclusions.

## variant_a Experiment Freshness

### Verdict

**Status: partially refreshed but not decision-fresh.** The durable Macra state still warns that the saved `/admin/experiments` results snapshot was stale from **2026-06-16**, but a read-only Firestore check in this audit found a saved result snapshot generated on **2026-06-25T10:08:00.102Z** whose `configSnapshot` reflects active `variant_a`. This audit did **not** write a new June 30 backfill/refresh, so the result is no longer the 2026-06-16 hard-paywall snapshot, but it remains stale/incomplete for current funnel decisions because it is five days old and has mostly inferred assignments. Source: `.agent/macra/state.json`; `.agent/macra/progress.md`; Firestore `macra-experiment-results/macra_paywall_onboarding`; Firestore `macra-experiments/macra_paywall_onboarding`

### Active configuration facts

- The active experiment in durable state is `variant_a`, configured as **monthly + annual, both with trial**. Source: `.agent/macra/state.json`
- The `/admin/experiments` implementation uses Firestore collection `macra-experiments`, document `macra_paywall_onboarding`, and result snapshot collection `macra-experiment-results`. Source: `src/pages/admin/experiments.tsx`
- The default `/admin/experiments` config marks `variant_a` as enabled with weight `100`, named **Monthly + annual, both with trial**, while `variant_c` is retired with weight `0` and described as the hard-paywall monthly treatment that converted roughly 1% with about 95% Apple-sheet cancels. Source: `src/pages/admin/experiments.tsx`
- The read-only Firestore check found the live experiment config exists, was updated at **2026-06-17T10:31:39.693Z**, and currently has only `variant_a` enabled with weight `100`. Source: Firestore `macra-experiments/macra_paywall_onboarding`

### Result-refresh mechanics

- `/admin/experiments` loads both the live experiment config and the saved result snapshot by reading `macra-experiments/macra_paywall_onboarding` and `macra-experiment-results/macra_paywall_onboarding`. Source: `src/pages/admin/experiments.tsx`
- The results panel displays the saved snapshot's `generatedAt` timestamp and includes a **Refresh results** action. Source: `src/pages/admin/experiments.tsx`
- The backfill path writes a new `ExperimentResultsSnapshot` with `generatedAt`, `generatedBy`, assignment counts, variant rows, aggregate AppsFlyer validation, data input counts, and `configSnapshot` back to `macra-experiment-results/macra_paywall_onboarding`. Source: `src/pages/admin/experiments.tsx`

### Decision impact

- Nora's decision log already names refreshing/backfilling `/admin/experiments` for active `variant_a` as the first operational task because the experiment snapshot is stale from 2026-06-16. Source: `.agent/macra/decisions.md`
- Nora's 2026-06-30 no-change decision says no onboarding, paywall, pricing, experiment allocation, retargeting, or Apple Search Ads spend changes should happen during the validation window; the cited evidence includes stale AppsFlyer/Scoreboard coverage, purchase logs confirming only 2 trial-success rows on 2026-06-29, and mostly inferred experiment results generated 2026-06-25. Source: `.agent/macra/decisions.md`; `.agent/macra/progress.md`
- The Macra runbook explicitly says saved `/admin/experiments` result snapshots can be stale, the first operational task is to backfill/refresh experiment results before using variant performance for decisions, and the daily snapshot should include whether the result snapshot reflects active `variant_a`. Source: `docs/agents/macra-operating-runbook.md`

### Freshness conclusion

This audit has evidence that `/admin/experiments` was refreshed after the stale 2026-06-16 snapshot, but not evidence of a fresh June 30 refresh. The saved result snapshot generated on **2026-06-25T10:08:00.102Z** reflects active `variant_a`, loaded 692 onboarding users, assigned 692 users, and recorded 95 exact assignments, 597 inferred assignments, 0 unknown assignments, and quality label **Mostly inferred assignments**. It also recorded 288 purchase logs, 0 AppsFlyer user docs, 32,241 aggregate AppsFlyer events, and 7 AppsFlyer trial starts; the aggregate validation note says AppsFlyer aggregate data validates top-line event volume but cannot split by variant unless event metadata includes the variant. Source: Firestore `macra-experiment-results/macra_paywall_onboarding`

Because the saved result snapshot is five days old, mostly inferred, and not person-split by AppsFlyer variant metadata, this memo should treat `variant_a` performance as **refreshed after 2026-06-16 but still not decision-fresh**. No funnel decision should proceed from this evidence alone until a June 30-or-later refresh/backfill confirms active `variant_a` with acceptable assignment quality and current AppsFlyer/Scoreboard coverage. Source: Firestore `macra-experiment-results/macra_paywall_onboarding`; `.agent/macra/decisions.md`; `.agent/macra/progress.md`; `src/pages/admin/experiments.tsx`

### Step 1 refresh plan

1. In the execute step, read `macra-experiments/macra_paywall_onboarding` and `macra-experiment-results/macra_paywall_onboarding` using the Firebase Admin SDK service-account pattern documented for standalone scripts. Source: `.agent/workflows/firebase-admin.md`; `src/pages/admin/experiments.tsx`
2. Compare the result snapshot `generatedAt` and `configSnapshot` against the active `variant_a` config. The snapshot passes freshness only if it was generated after the stale 2026-06-16 result and its config snapshot reflects `variant_a` as the enabled, 100-weight treatment. Source: `.agent/macra/state.json`; `src/pages/admin/experiments.tsx`
3. If the snapshot is still stale, do **not** make a funnel decision from variant performance. Record stale status in this memo and leave live onboarding, paywall, pricing, experiment allocation, retargeting, and Apple Search Ads spend unchanged. Source: `.agent/macra/decisions.md`; `.agent/macra/progress.md`
4. If a later execute step refreshes/backfills results, record the generated timestamp, config snapshot, loaded users, assignment quality, data inputs, and aggregate validation before any funnel decision is considered. Source: `src/pages/admin/experiments.tsx`; `docs/agents/macra-operating-runbook.md`

### Step 2 execution result

The execute step performed a read-only Firebase Admin check of `macra-experiments/macra_paywall_onboarding` and `macra-experiment-results/macra_paywall_onboarding`. It did not write a new result snapshot or change live experiment configuration. Source: `.agent/workflows/firebase-admin.md`; Firestore `macra-experiments/macra_paywall_onboarding`; Firestore `macra-experiment-results/macra_paywall_onboarding`

Execution finding: active `variant_a` results were refreshed after the stale 2026-06-16 warning, with the saved result snapshot generated on **2026-06-25T10:08:00.102Z**, but they were **not refreshed during this audit step** and are **not fresh enough for a June 30 funnel decision**. Source: Firestore `macra-experiment-results/macra_paywall_onboarding`; `.agent/macra/decisions.md`

### Step 2 status

Complete. This section now cites `/admin/experiments`, `.agent/macra/state.json`, `.agent/macra/progress.md`, and `.agent/macra/decisions.md`; records the stale 2026-06-16 hard-paywall warning; records the later 2026-06-25 active-`variant_a` result snapshot; and states that `variant_a` is partially refreshed but still not decision-fresh for a June 30 funnel decision.

## Decision Log Contract

### Research question

How should this audit maintain the Macra decision log so every operational change is tied to evidence, an expected metric movement, and a guardrail, without turning analysis-only findings into unauthorized funnel changes?

### Observed decision-log structure

The Macra decision log uses one row per decision or proposed decision with these fields: Date, Owner, Decision, Evidence, Metric Expected To Move, and Guardrail. The log explicitly says rejected decisions should also be kept with the reason they were rejected. Source: `.agent/macra/decisions.md`

### Current decision-log facts

- Nora's 2026-06-29 posture decision requires agents to observe, recommend, decide, and log before changing the funnel. The metric is qualified onboarding start to trial start, and the guardrail is avoiding random funnel changes while the trial-start signal is early. Source: `.agent/macra/decisions.md`
- Nora's 2026-06-29 experiment decision says refreshing/backfilling `/admin/experiments` for active `variant_a` is the first operational task because the saved experiment snapshot is stale from 2026-06-16. Source: `.agent/macra/decisions.md`
- Solara's 2026-06-30 copy recommendation is proposed-only, not live. It is already tied to evidence from `Macrafeedbackreason`, `Macra-purchase-logs`, the saved paywall funnel, and retargeting config; the metric is paywall primary CTA to initiated checkout rate; the guardrail is StoreKit purchase cancels plus `paywall_cancel_feedback` volume. Source: `.agent/macra/decisions.md`
- Nora's 2026-06-30 no-change decision says not to change onboarding, paywall, pricing, experiment allocation, retargeting behavior, or Apple Search Ads spend during the 72-hour signal validation window. Its evidence is the June 30 operating snapshot, stale AppsFlyer/Scoreboard coverage ending 2026-06-25, purchase logs confirming only 2 trial-success rows on 2026-06-29, and mostly inferred experiment results generated 2026-06-25. Source: `.agent/macra/decisions.md`; `.agent/macra/progress.md`

### Step 1 plan

1. Treat this audit file as analysis until it produces either a concrete recommendation or an explicit no-change recommendation. Source: `.agent/macra/contract.md`; `.agent/macra/runbook.md`
2. Do **not** add a new `.agent/macra/decisions.md` row during the planning step, because this step does not make or propose an operational change. Source: `.agent/macra/contract.md`; `.agent/macra/decisions.md`
3. In the execution step, if the audit recommends a guardrail rule, tracking fix, refresh/backfill task, or no-change posture, add or update a decision-log row only when that recommendation becomes an operator decision or proposed decision. Source: `.agent/macra/contract.md`; `.agent/macra/runbook.md`; `.agent/macra/decisions.md`
4. Any future decision-log row from this audit must cite at least one source-of-truth surface named in the Macra contract or runbook, such as AppsFlyer CSV imports, Macra Scoreboard, `/admin/experiments`, `/admin/purchaseLogs`, `/admin/macraCancelReasons`, retargeting state, Firestore collection/doc IDs, or committed artifact paths. Source: `.agent/macra/contract.md`; `.agent/macra/runbook.md`
5. Any future decision-log row from this audit must name the expected metric movement and a guardrail. For this audit, the default metric is qualified onboarding start to trial start, and the default guardrails are Apple purchase cancels, checkout failure/cancel rate, under-18 or missing-birthdate blocks, trial activation after start, paid conversion after trial, and cancel reasons. Source: `.agent/macra/contract.md`; `.agent/macra/state.json`

### Planning verdict

No decision-log row should be added by this research-plan step. The next step should complete the event-semantics evidence sections first, then decide whether the correct decision-log outcome is a proposed tracking/guardrail rule, a refresh/backfill task, or an explicit no-change recommendation.

### Step 2 execution check

I reviewed the current `.agent/macra/decisions.md` rows against the Macra operating contract. Each logged operational or proposed decision currently has an evidence field, an expected metric field, and a guardrail field:

- 2026-06-29 Nora posture decision: evidence is the AppsFlyer aggregate report, saved Macra Scoreboard, and stale `/admin/experiments` snapshot; metric is qualified onboarding start to trial start; guardrail is avoiding random funnel changes while the trial-start signal is early. Source: `.agent/macra/decisions.md`
- 2026-06-29 Nora experiment-refresh decision: evidence is the stale 2026-06-16 experiment snapshot; metric is experiment decision quality; guardrail is not deciding from stale variant data. Source: `.agent/macra/decisions.md`
- 2026-06-30 Solara proposed copy validation: evidence is `Macrafeedbackreason`, `Macra-purchase-logs`, the saved paywall funnel, and retargeting config; metric is paywall primary CTA to initiated checkout rate; guardrail is StoreKit purchase cancel count and `paywall_cancel_feedback` volume. Source: `.agent/macra/decisions.md`
- 2026-06-30 Nora no-change validation-window decision: evidence is `docs/ops/macra-operating-snapshot-2026-06-30.md`, stale AppsFlyer/Scoreboard coverage, purchase-log trial-success rows, and mostly inferred experiment results; metric is qualified onboarding start to trial start; guardrail is checkout / purchase cancel pressure and stale-source risk. Source: `.agent/macra/decisions.md`

Execution result: no `.agent/macra/decisions.md` edit is required for this step because the current operational decisions already tie evidence to expected metrics and guardrails, and this audit step does not introduce a new operator-approved change. Source: `.agent/macra/contract.md`; `.agent/macra/decisions.md`

### Step 2 status

Complete. This section now cites the Macra operating contract, durable state, progress log, decision log, and runbook; it records the current decision-log fields and labels stale Scoreboard, stale AppsFlyer, and stale /admin/experiments evidence as decision risks.

## Event Semantics

### Observed event families

The committed admin mappings keep Macra event families separated:

| Signal family | Event names / source rows | Metric effect | Primary evidence |
| --- | --- | --- | --- |
| Trial start | `af_start_trial`, `start_trial`, `trial_started`, `macra_trial_started` | Counts toward `qualified_onboarding_start_to_trial_start` only after eligibility, dedupe, freshness, and activation guardrails pass | `src/pages/admin/experiments.tsx`; `src/pages/admin/emailSequences.tsx` |
| Paid conversion | `af_subscribe`, `af_purchase`, `subscribe`, `purchase`, `macra_subscription_started` | Downstream paid-conversion evidence; does not replace trial-start evidence | `src/pages/admin/experiments.tsx`; `src/pages/admin/emailSequences.tsx` |
| Checkout start | `af_initiated_checkout`, `macra_subscription_web_checkout_started`, `macra_subscription_checkout_started` | Annotates high purchase intent; not trial evidence | `src/pages/admin/experiments.tsx`; `src/pages/admin/emailSequences.tsx` |
| Apple / purchase cancel | `macra_subscription_purchase_cancelled`, `macra_subscription_purchase_canceled`, `Macra-purchase-logs` canceled statuses, `Macrafeedbackreason` rows | Weakens or reverses purchase-boundary trust; blocks scale when rising | `src/pages/admin/emailSequences.tsx`; `src/pages/admin/macraPurchaseLogs.tsx`; `src/pages/admin/macraCancelReasons.tsx` |
| Activation quality | `macra_trial_activation_screen_viewed`, `macra_trial_activation_primary_pressed`, `trial_no_activation` retargeting rule | Confirms or weakens trial-start quality after nominal start | `src/pages/admin/experiments.tsx`; `netlify/functions/schedule-macra-retargeting-email.ts` |

### Execution finding

The growth signal is **not clean enough to scale** from the June 30 evidence alone. AppsFlyer/Scoreboard coverage is stale through 2026-06-25, the June 28-30 AppsFlyer daily rows/raw rows were missing in the operating snapshot, `/admin/experiments` results were generated on 2026-06-25 and mostly inferred, and `Macra-purchase-logs` only confirmed a single-day 2-trial-success signal on 2026-06-29. Source: `docs/ops/macra-operating-snapshot-2026-06-30.md`; `.agent/macra/decisions.md`; `src/pages/admin/experiments.tsx`

### Unit of truth

For this audit, the valid unit is a **qualified user journey**, not a raw event count. The AppsFlyer import stores raw rows in `appsflyer-macra-raw-rows`, user attribution in `appsflyer-macra-users`, aggregate periods in `appsflyer-aggregate-periods`, and the Scoreboard summary in `appsflyer-scoreboards/macra`; it derives raw-row event date/time, customer user ID, AppsFlyer ID, action count, media source, campaign, and stable raw row IDs. Source: `netlify/functions/sync-macra-appsflyer-raw-data.ts`

Observed facts: AppsFlyer row identity resolves `customerUserId` first and falls back to AppsFlyer ID; raw-row timestamp comes from event time, selected-timezone event time, install time, or row date; raw-row dedupe uses a stable raw row ID derived from upload/report context, event name, customer user ID or AppsFlyer ID, occurred-at time, install/media/campaign fields, aggregate action count, and row fallback. Source: `netlify/functions/sync-macra-appsflyer-raw-data.ts`

Inference: aggregate AppsFlyer rows can validate top-line event volume, but they cannot prove unique qualified trial starts unless reconciled to person-level AppsFlyer attribution, user state, purchase logs, and activation evidence. Source: `docs/ops/macra-operating-snapshot-2026-06-30.md`; `src/pages/admin/experiments.tsx`

## af_start_trial

| Field | Audit finding |
| --- | --- |
| Source artifact | AppsFlyer import, `/admin/experiments`, and Scoreboard/email sequence admin. Source: `netlify/functions/sync-macra-appsflyer-raw-data.ts`; `src/pages/admin/experiments.tsx`; `src/pages/admin/emailSequences.tsx` |
| Source system | AppsFlyer event import stored into `appsflyer-scoreboards/macra`, `appsflyer-aggregate-periods`, `appsflyer-macra-raw-rows`, and `appsflyer-macra-users`. Source: `netlify/functions/sync-macra-appsflyer-raw-data.ts` |
| Trigger | User starts a trial, represented by `af_start_trial` or aliases `start_trial`, `trial_started`, `macra_trial_started`. Source: `src/pages/admin/experiments.tsx`; `src/pages/admin/emailSequences.tsx` |
| Timestamp field | AppsFlyer raw row `event_time`, `event_time_selected_timezone`, `install_time`, `install_time_selected_timezone`, or row date fallback; experiment backfill also can use `trialStartDate`, `macraTrialStartedAt`, `macraEmailSequenceState.webOffer24hConvertedAt`, latest AppsFlyer trial event, latest trial-bearing purchase-log success, or root trial state. Source: `netlify/functions/sync-macra-appsflyer-raw-data.ts`; `src/pages/admin/experiments.tsx` |
| User identifier | Prefer `customerUserId`, then AppsFlyer ID for AppsFlyer rows; experiment backfill reconciles users by Firestore user ID, email, AppsFlyer attribution docs, and purchase logs. Source: `netlify/functions/sync-macra-appsflyer-raw-data.ts`; `src/pages/admin/experiments.tsx` |
| Dedupe key | Raw-row dedupe uses stable raw row ID; metric dedupe must collapse to one qualified user journey across AppsFlyer, user state, and purchase logs. Source: `netlify/functions/sync-macra-appsflyer-raw-data.ts`; `src/pages/admin/experiments.tsx` |
| Metric effect | Counts toward `qualified_onboarding_start_to_trial_start` only if the user is eligible, deduped, current-window, and not immediately contradicted by cancel/failure/no-activation guardrails. Source: `.agent/macra/contract.md`; `src/pages/admin/experiments.tsx` |

Observed fact: `af_start_trial` is the closest AppsFlyer event to trial-start truth, but the June 30 operating snapshot says AppsFlyer raw rows for 2026-06-28 through 2026-06-30 were missing and AppsFlyer trial starts for those dates were unverified. Source: `docs/ops/macra-operating-snapshot-2026-06-30.md`

Inference: a raw `af_start_trial` count is not enough for scaling; it must be reconciled to unique eligible users and activation quality before it becomes a clean growth signal.

## af_purchase

| Field | Audit finding |
| --- | --- |
| Source artifact | AppsFlyer import, `/admin/experiments`, and Scoreboard/email sequence admin. Source: `netlify/functions/sync-macra-appsflyer-raw-data.ts`; `src/pages/admin/experiments.tsx`; `src/pages/admin/emailSequences.tsx` |
| Source system | AppsFlyer event import and paid-conversion event family. Source: `netlify/functions/sync-macra-appsflyer-raw-data.ts`; `src/pages/admin/experiments.tsx` |
| Trigger | Paid purchase or subscription-start event, grouped with `af_subscribe`, `subscribe`, `purchase`, and `macra_subscription_started`. Source: `src/pages/admin/experiments.tsx`; `src/pages/admin/emailSequences.tsx` |
| Timestamp field | AppsFlyer raw-row event time/date; experiment backfill can also infer paid conversion from subscription start fields, AppsFlyer paid events, active subscription flags, and non-trial purchase-log success. Source: `netlify/functions/sync-macra-appsflyer-raw-data.ts`; `src/pages/admin/experiments.tsx` |
| User identifier | `customerUserId` or AppsFlyer ID, reconciled to user ID where attribution docs exist. Source: `netlify/functions/sync-macra-appsflyer-raw-data.ts`; `src/pages/admin/experiments.tsx` |
| Dedupe key | Stable raw row ID for import dedupe; user-level paid-conversion dedupe required against `Macra-purchase-logs` and subscription state. Source: `netlify/functions/sync-macra-appsflyer-raw-data.ts`; `src/pages/admin/experiments.tsx` |
| Metric effect | Annotates downstream paid conversion after trial/purchase progression; does **not** count as trial start by itself. Source: `.agent/macra/contract.md`; `src/pages/admin/experiments.tsx` |

Observed fact: the latest durable saved run reports 3 purchases and 3 subscribes alongside 5 trial starts, but the June 30 snapshot could not refresh AppsFlyer purchase/subscription events for June 28-30. Source: `.agent/macra/state.json`; `docs/ops/macra-operating-snapshot-2026-06-30.md`

Inference: `af_purchase` is a monetization quality signal. It strengthens trust after a valid trial start, but using it as trial-start evidence would conflate two different stages.

## af_subscribe

| Field | Audit finding |
| --- | --- |
| Source artifact | AppsFlyer import, `/admin/experiments`, and Scoreboard/email sequence admin. Source: `netlify/functions/sync-macra-appsflyer-raw-data.ts`; `src/pages/admin/experiments.tsx`; `src/pages/admin/emailSequences.tsx` |
| Source system | AppsFlyer paid-conversion event family. Source: `netlify/functions/sync-macra-appsflyer-raw-data.ts`; `src/pages/admin/experiments.tsx` |
| Trigger | Subscription or paid conversion event grouped with `af_purchase`, `subscribe`, `purchase`, and `macra_subscription_started`. Source: `src/pages/admin/experiments.tsx`; `src/pages/admin/emailSequences.tsx` |
| Timestamp field | AppsFlyer raw-row event time/date; experiment backfill uses latest AppsFlyer paid event and subscription/purchase state for paid conversion. Source: `netlify/functions/sync-macra-appsflyer-raw-data.ts`; `src/pages/admin/experiments.tsx` |
| User identifier | `customerUserId` or AppsFlyer ID, reconciled to Firestore user ID where possible. Source: `netlify/functions/sync-macra-appsflyer-raw-data.ts` |
| Dedupe key | Stable raw row ID at import; one paid-conversion state per user journey after reconciling with `af_purchase` and purchase logs. Source: `netlify/functions/sync-macra-appsflyer-raw-data.ts`; `src/pages/admin/experiments.tsx` |
| Metric effect | Annotates paid conversion; does not count toward trial-start numerator. Source: `.agent/macra/contract.md`; `src/pages/admin/experiments.tsx` |

Observed fact: `af_subscribe` and `af_purchase` are grouped into the same paid-conversion evidence set in both experiment and Scoreboard code. Source: `src/pages/admin/experiments.tsx`; `src/pages/admin/emailSequences.tsx`

Inference: reporting `af_subscribe` and `af_purchase` as separate success endpoints without user-level dedupe can double-tell the same paid journey. They should be reconciled as a single downstream paid-conversion state.

## purchase_cancelled

| Field | Audit finding |
| --- | --- |
| Source artifact | AppsFlyer import, Scoreboard/email sequence admin, purchase-log admin, cancel-reason admin. Source: `netlify/functions/sync-macra-appsflyer-raw-data.ts`; `src/pages/admin/emailSequences.tsx`; `src/pages/admin/macraPurchaseLogs.tsx`; `src/pages/admin/macraCancelReasons.tsx` |
| Source system | AppsFlyer cancel event family and Firestore purchase/cancel feedback records. Source: `src/pages/admin/emailSequences.tsx`; `src/pages/admin/macraPurchaseLogs.tsx`; `src/pages/admin/macraCancelReasons.tsx` |
| Trigger | `macra_subscription_purchase_cancelled` or `macra_subscription_purchase_canceled`, plus canceled purchase-log statuses and cancel feedback triggered by StoreKit cancel. Source: `src/pages/admin/emailSequences.tsx`; `src/pages/admin/macraPurchaseLogs.tsx`; `src/pages/admin/macraCancelReasons.tsx` |
| Timestamp field | AppsFlyer event time/date; `Macra-purchase-logs.createdAt` / `createdAtEpoch` / `updatedAt`; `Macrafeedbackreason.capturedAt` / `createdAt`. Source: `netlify/functions/sync-macra-appsflyer-raw-data.ts`; `src/pages/admin/macraPurchaseLogs.tsx`; `src/pages/admin/macraCancelReasons.tsx` |
| User identifier | AppsFlyer `customerUserId` or AppsFlyer ID; purchase logs expose `userId` and `email`; cancel reasons expose `userId`, `email`, and joined user context. Source: `netlify/functions/sync-macra-appsflyer-raw-data.ts`; `src/pages/admin/macraPurchaseLogs.tsx`; `src/pages/admin/macraCancelReasons.tsx` |
| Dedupe key | Stable AppsFlyer raw row ID plus purchase/cancel feedback document IDs; for metric interpretation, collapse cancellation to a user and purchase attempt window. Source: `netlify/functions/sync-macra-appsflyer-raw-data.ts`; `src/pages/admin/macraPurchaseLogs.tsx` |
| Metric effect | Weakens or reverses purchase-boundary trust; blocks scale when cancellation rises alongside trial starts or checkout starts. Source: `.agent/macra/contract.md`; `docs/ops/macra-operating-snapshot-2026-06-30.md` |

Observed fact: June 28 had 3 canceled and 2 failed purchase-log rows with 0 trial-success rows; June 29 had 2 trial-success rows and 2 canceled rows. Source: `docs/ops/macra-operating-snapshot-2026-06-30.md`

Inference: `purchase_cancelled` is not a neutral annotation. It is a guardrail signal that can make growth look stronger than reality if the team reports checkouts/trials without cancellation pressure.

## web_checkout_started

| Field | Audit finding |
| --- | --- |
| Source artifact | AppsFlyer import, `/admin/experiments`, Scoreboard/email sequence admin, purchase-log admin. Source: `netlify/functions/sync-macra-appsflyer-raw-data.ts`; `src/pages/admin/experiments.tsx`; `src/pages/admin/emailSequences.tsx`; `src/pages/admin/macraPurchaseLogs.tsx` |
| Source system | AppsFlyer checkout event family and purchase-log attempted/started rows. Source: `src/pages/admin/experiments.tsx`; `src/pages/admin/emailSequences.tsx`; `src/pages/admin/macraPurchaseLogs.tsx` |
| Trigger | `macra_subscription_web_checkout_started`, grouped with `af_initiated_checkout` and `macra_subscription_checkout_started` as checkout intent. Source: `src/pages/admin/experiments.tsx`; `src/pages/admin/emailSequences.tsx` |
| Timestamp field | AppsFlyer event time/date; purchase logs use `createdAt`, `createdAtEpoch`, `updatedAt`, or `updatedAtEpoch`. Source: `netlify/functions/sync-macra-appsflyer-raw-data.ts`; `src/pages/admin/macraPurchaseLogs.tsx` |
| User identifier | AppsFlyer `customerUserId` or AppsFlyer ID; purchase logs expose `userId` and `email`. Source: `netlify/functions/sync-macra-appsflyer-raw-data.ts`; `src/pages/admin/macraPurchaseLogs.tsx` |
| Dedupe key | Stable raw row ID for AppsFlyer rows; user-level dedupe required across `af_initiated_checkout`, `macra_subscription_web_checkout_started`, and purchase-log attempted/started rows. Source: `netlify/functions/sync-macra-appsflyer-raw-data.ts`; `src/pages/admin/experiments.tsx` |
| Metric effect | Annotates high intent upstream of trial start; does not count as trial start. Source: `.agent/macra/contract.md`; `src/pages/admin/experiments.tsx` |

Observed fact: the June 25 operating snapshot explicitly warned not to combine `macra_subscription_web_checkout_started` with `af_initiated_checkout` as unique checkout users without person-level dedupe. Source: `docs/ops/macra-operating-snapshot-2026-06-25.md`

Inference: raw checkout-start growth could be a misleading scale signal if it is overlap or abandoned checkout rather than a unique eligible user reaching trial.

## StoreKit cancel

| Field | Audit finding |
| --- | --- |
| Source artifact | `/admin/purchaseLogs`, `/admin/macraPurchaseLogs`, `/admin/macraCancelReasons`, Firestore `Macra-purchase-logs`, Firestore `Macrafeedbackreason`, and AppsFlyer cancel imports. Source: `src/pages/admin/macraPurchaseLogs.tsx`; `src/pages/admin/macraCancelReasons.tsx`; `src/pages/admin/emailSequences.tsx` |
| Source system | StoreKit/UI purchase lifecycle and cancellation feedback, with AppsFlyer cancel event overlap possible. Source: `src/pages/admin/macraPurchaseLogs.tsx`; `src/pages/admin/macraCancelReasons.tsx`; `src/pages/admin/emailSequences.tsx` |
| Trigger | User cancels or abandons StoreKit purchase sheet / purchase boundary; cancel feedback can capture reason and trigger such as `storekit_cancelled`. Source: `src/pages/admin/macraCancelReasons.tsx`; `docs/ops/macra-operating-snapshot-2026-06-30.md` |
| Timestamp field | Purchase logs: `createdAt`, `createdAtEpoch`, `updatedAt`, `updatedAtEpoch`; cancel feedback: `capturedAt` or `createdAt`; AppsFlyer: event time/date. Source: `src/pages/admin/macraPurchaseLogs.tsx`; `src/pages/admin/macraCancelReasons.tsx`; `netlify/functions/sync-macra-appsflyer-raw-data.ts` |
| User identifier | Purchase/cancel feedback `userId` and `email`; AppsFlyer `customerUserId` or AppsFlyer ID. Source: `src/pages/admin/macraPurchaseLogs.tsx`; `src/pages/admin/macraCancelReasons.tsx`; `netlify/functions/sync-macra-appsflyer-raw-data.ts` |
| Dedupe key | Document ID plus user/time-window reconciliation; StoreKit cancel and AppsFlyer `purchase_cancelled` can describe the same cancellation and should not be counted twice. Source: `src/pages/admin/macraPurchaseLogs.tsx`; `src/pages/admin/emailSequences.tsx` |
| Metric effect | Weakens or blocks scaling confidence; it can reverse purchase-boundary progress and should be paired against checkout/trial signals before counting growth as trustworthy. Source: `.agent/macra/contract.md`; `docs/ops/macra-operating-snapshot-2026-06-30.md` |

Observed fact: a June 28 production cancel-reason row said `Price felt too high` with trigger `storekit_cancelled`, while the same date had 3 canceled and 2 failed purchase-log rows and 0 trial-success rows. Source: `docs/ops/macra-operating-snapshot-2026-06-30.md`; `src/pages/admin/macraCancelReasons.tsx`

Inference: StoreKit cancel after a checkout attempt can make the funnel look healthier than it is if the team reports starts/checkouts without pairing cancellation timing and reason.

## age eligibility

### Observed facts

- The Macra contract names under-18 and missing-birthdate blocks as explicit guardrails. Source: `.agent/macra/contract.md`; `.agent/macra/state.json`
- `macraStripe.js` resolves birthdate from `users/{userId}/macra/profile.birthdate` before falling back to root `users.birthdate`; missing or invalid age returns `eligible: false` with reason `age_unverified`; age below the minimum returns `eligible: false` with reason `under_18`. Source: `netlify/functions/utils/macraStripe.js`
- `/admin/emailSequences` computes age from profile and root user birthdate fields, labels `under_18`, and describes Macra retargeting checkout as excluding missing-age and under-18 profiles. Source: `src/pages/admin/emailSequences.tsx`
- `/admin/experiments` only counts a user as qualified when onboarding is completed, age is present and at least 18, Macra profile exists, goal/macro quality checks pass, and paywall was reached. Source: `src/pages/admin/experiments.tsx`
- The June 30 operating snapshot did not find recent direct under-18 or missing-birthdate block rows in the common user-state scan for June 28-30, but explicitly labels that read limited. Source: `docs/ops/macra-operating-snapshot-2026-06-30.md`

### Progression effect

Age eligibility is a **hard validity requirement** for counting a qualified trial start. Under-18 and age-unverified users should not contribute to `qualified_onboarding_start_to_trial_start`, even if AppsFlyer or purchase logs show checkout/trial events. Missing birthdate is not a growth event; it is an eligibility gap that blocks confidence until resolved. Source: `.agent/macra/contract.md`; `netlify/functions/utils/macraStripe.js`; `src/pages/admin/experiments.tsx`

## Age Eligibility

See `age eligibility` above. The canonical audit finding is that age eligibility blocks qualified trial-start counting when a user is under 18 or age-unverified.

## activation-quality signals

### Observed facts

- `/admin/experiments` tracks `macra_trial_activation_screen_viewed` and `macra_trial_activation_primary_pressed` separately from `af_start_trial`; these are post-start quality events, not aliases for trial start. Source: `src/pages/admin/experiments.tsx`
- Retargeting logic treats an active subscription/trial user with no Macra activation as `trial_no_activation`, with skip reasons for already activated, active not confirmed trial, and trial activation not yet due. Source: `netlify/functions/schedule-macra-retargeting-email.ts`
- `/admin/experiments` counts onboarding completion, profile quality, realistic goals, macro target presence, paywall reach, trial starts, paid conversions, Apple cancels, and activation actions as separate result fields. Source: `src/pages/admin/experiments.tsx`
- The June 30 operating snapshot found no recent retargeting sends, opens, clicks, checkout starts, trial starts, paid conversions, under-18 blocks, or missing-birthdate blocks in common user-state fields for June 28-30, but marked the retargeting read limited. Source: `docs/ops/macra-operating-snapshot-2026-06-30.md`

### Progression effect

Activation quality **confirms or weakens** a nominal trial start. A user can start a trial but still need recovery if they do not reach meaningful Macra activation. That means the team should not scale on raw `af_start_trial` or purchase-log success rows unless activation screens/actions, onboarding quality, and no-activation recovery state are also monitored. Source: `src/pages/admin/experiments.tsx`; `netlify/functions/schedule-macra-retargeting-email.ts`; `.agent/macra/contract.md`

## Activation-Quality Signals

See `activation-quality signals` above. The canonical audit finding is that activation is a post-start quality guardrail, not a synonym for trial start.

## Activation and Eligibility Guardrails

| Guardrail | Effect on valid trial-start count | Evidence |
| --- | --- | --- |
| Under 18 | Blocks count | `.agent/macra/contract.md`; `netlify/functions/utils/macraStripe.js`; `src/pages/admin/experiments.tsx` |
| Missing or invalid birthdate | Blocks qualified count until age is verified | `.agent/macra/contract.md`; `netlify/functions/utils/macraStripe.js`; `src/pages/admin/emailSequences.tsx` |
| Completed onboarding / profile quality | Confirms qualification before trial-start count | `src/pages/admin/experiments.tsx` |
| Trial activation screen/action | Confirms post-start quality | `src/pages/admin/experiments.tsx` |
| Trial with no activation | Weakens start quality and triggers recovery logic | `netlify/functions/schedule-macra-retargeting-email.ts` |
| Purchase cancel / failed purchase / cancel feedback | Weakens or reverses purchase-boundary progress | `src/pages/admin/macraPurchaseLogs.tsx`; `src/pages/admin/macraCancelReasons.tsx`; `docs/ops/macra-operating-snapshot-2026-06-30.md` |

## Ambiguities

1. **The 2/day signal is not confirmed as a multi-day AppsFlyer trial-start pattern.** June 30 source-of-truth read found no AppsFlyer daily period rows or raw rows for June 28-30; purchase logs only show 2 trial-success rows on June 29. Source: `docs/ops/macra-operating-snapshot-2026-06-30.md`
2. **`af_start_trial` and paid conversion events occupy different stages.** `af_start_trial` is trial-start evidence; `af_subscribe` and `af_purchase` are paid-conversion evidence. Treating subscribe/purchase as trial starts would overstate the primary metric, while counting them separately without user-level dedupe could double-tell downstream success. Source: `src/pages/admin/experiments.tsx`; `src/pages/admin/emailSequences.tsx`
3. **AppsFlyer purchases and `/admin/purchaseLogs` can disagree.** AppsFlyer aggregate events validate event volume, but purchase logs hold StoreKit/Stripe lifecycle statuses such as attempted, success, failed, and canceled. A trial-success purchase-log row is not the same artifact as an AppsFlyer `af_start_trial` row. Source: `src/pages/admin/macraPurchaseLogs.tsx`; `netlify/functions/sync-macra-appsflyer-raw-data.ts`; `docs/ops/macra-operating-snapshot-2026-06-30.md`
4. **Checkout-start inflation is possible.** `macra_subscription_web_checkout_started`, `macra_subscription_checkout_started`, and `af_initiated_checkout` are grouped as checkout intent; prior operating guidance warns not to combine `macra_subscription_web_checkout_started` with `af_initiated_checkout` as unique checkout users without person-level dedupe. Source: `src/pages/admin/emailSequences.tsx`; `src/pages/admin/experiments.tsx`; `docs/ops/macra-operating-snapshot-2026-06-25.md`
5. **Checkout starts can happen without activation.** Retargeting logic explicitly handles active subscription/trial users with no activation as `trial_no_activation`, and experiment results separate activation screen/action events from trial-start events. Source: `netlify/functions/schedule-macra-retargeting-email.ts`; `src/pages/admin/experiments.tsx`
6. **StoreKit cancel can collide with AppsFlyer cancel.** `macra_subscription_purchase_cancelled` in AppsFlyer, canceled purchase-log rows, and cancel feedback rows can describe the same purchase-boundary failure unless deduped by user and time window. Source: `src/pages/admin/emailSequences.tsx`; `src/pages/admin/macraPurchaseLogs.tsx`; `src/pages/admin/macraCancelReasons.tsx`
7. **Age/birthdate blocks can make raw starts unqualified.** Under-18 and `age_unverified` users should be excluded from qualified trial-start counting, but not all analytics events carry eligibility state. Source: `.agent/macra/contract.md`; `netlify/functions/utils/macraStripe.js`; `src/pages/admin/experiments.tsx`
8. **Experiment evidence is still not decision-fresh.** `variant_a` is live, but June 30 snapshot says saved results were generated June 25, mostly inferred, and observe-only for decisioning. Source: `docs/ops/macra-operating-snapshot-2026-06-30.md`; `.agent/macra/decisions.md`

## Operational Change Rules

Every `.agent/macra/decisions.md` row must include date, owner, decision, evidence artifact, metric expected to move, and guardrail. Rejected decisions should remain in the log with the reason they were rejected. Source: `.agent/macra/decisions.md`

Live funnel, budget, pricing, experiment allocation, eligibility-rule, and retargeting changes require operator approval. This execution step makes an analysis recommendation only; it does not authorize a live change. Source: `.agent/macra/contract.md`; `.agent/macra/decisions.md`

If this audit becomes a decision-log row, the decision should be an explicit no-scale/no-change recommendation until event semantics, eligibility, activation, and source freshness pass. Expected metric: `qualified_onboarding_start_to_trial_start`. Guardrails: Apple purchase cancels, checkout failure/cancel rate, under-18 or missing-birthdate blocks, trial activation after start, paid conversion after trial, and cancel reasons. Source: `.agent/macra/contract.md`; `.agent/macra/state.json`; `.agent/macra/runbook.md`

## Trust Guardrails

### Pass/fail criteria for a valid Macra trial start

A Macra trial start passes the trust audit only when all of the following are true:

1. The trial-start signal comes from `af_start_trial` or an equivalent trial-start alias, or a trial-bearing successful purchase-log row, and is tied to a unique user. Source: `src/pages/admin/experiments.tsx`; `src/pages/admin/macraPurchaseLogs.tsx`
2. The event falls inside a current, verified source window; stale AppsFlyer/Scoreboard coverage through 2026-06-25 fails this criterion for June 28-30 decisions. Source: `docs/ops/macra-operating-snapshot-2026-06-30.md`
3. The user is eligible: age present, age at least 18, profile exists, onboarding completed, realistic goal/profile quality present, and paywall reached. Source: `src/pages/admin/experiments.tsx`; `netlify/functions/utils/macraStripe.js`
4. The trial is deduped against AppsFlyer raw rows, AppsFlyer user attribution, purchase logs, and subscription/user state. Source: `netlify/functions/sync-macra-appsflyer-raw-data.ts`; `src/pages/admin/experiments.tsx`
5. The start is not offset by same-window cancellation/failure pressure or cancel feedback that indicates price, proof, readiness, breakage, or Apple sheet confusion. Source: `.agent/macra/contract.md`; `.agent/macra/decisions.md`; `src/pages/admin/macraCancelReasons.tsx`
6. Activation quality is monitored after start via activation screen/action events or no-activation recovery state. Source: `src/pages/admin/experiments.tsx`; `netlify/functions/schedule-macra-retargeting-email.ts`

### Guardrail status on June 30 evidence

| Guardrail | Status | Evidence |
| --- | --- | --- |
| AppsFlyer / Scoreboard freshness | **Fail** | Coverage ends June 25; June 28-30 daily period/raw rows missing. Source: `docs/ops/macra-operating-snapshot-2026-06-30.md` |
| Experiment freshness | **Fail for decisioning** | `variant_a` results generated June 25, mostly inferred, observe-only. Source: `docs/ops/macra-operating-snapshot-2026-06-30.md`; `.agent/macra/decisions.md` |
| Purchase cancels / failures | **Watch / not green** | June 28 had 3 canceled and 2 failed rows with 0 trial successes; June 29 had 2 trial successes and 2 cancels. Source: `docs/ops/macra-operating-snapshot-2026-06-30.md` |
| Age / missing birthdate | **Required gate; recent direct blocks not found in limited scan** | Under-18 and age-unverified are explicit blockers in eligibility code; recent scan found no direct rows but was limited. Source: `netlify/functions/utils/macraStripe.js`; `docs/ops/macra-operating-snapshot-2026-06-30.md` |
| Activation after start | **Required / unverified for June 29 starts** | Activation actions are separate events, and retargeting has no-activation recovery logic; June 30 snapshot did not confirm activation for the 2 purchase-log successes. Source: `src/pages/admin/experiments.tsx`; `netlify/functions/schedule-macra-retargeting-email.ts`; `docs/ops/macra-operating-snapshot-2026-06-30.md` |
| Paid conversion after trial | **Downstream quality only** | `af_purchase` and `af_subscribe` are paid-conversion events, not trial-start replacements. Source: `src/pages/admin/experiments.tsx`; `src/pages/admin/emailSequences.tsx` |
| Cancel reasons | **Watch** | June 28 cancel feedback reported `Price felt too high` with trigger `storekit_cancelled`; broader decision-log evidence lists price, not ready, need proof, something did not work, and Apple sheet confusion. Source: `docs/ops/macra-operating-snapshot-2026-06-30.md`; `.agent/macra/decisions.md` |

## Funnel Decision Gate

**Gate rule:** no Macra funnel decision can proceed unless `/admin/experiments` has a fresh active-`variant_a` result snapshot, AppsFlyer/Scoreboard coverage is current for the decision window, trial starts are deduped at the user level across AppsFlyer and purchase logs, age eligibility passes, activation quality is monitored, and cancellation/failure/cancel-reason guardrails are not worsening. Source: `.agent/macra/contract.md`; `.agent/macra/runbook.md`; `docs/ops/macra-operating-snapshot-2026-06-30.md`

June 30 gate status: **Fail / hold.** The current evidence is stale or partial on AppsFlyer coverage, experiment freshness, last-three-day pattern confirmation, activation quality, and cancel pressure. The only fresh positive signal is 2 trial-bearing purchase-log success rows on June 29, which is not enough to scale. Source: `docs/ops/macra-operating-snapshot-2026-06-30.md`; `.agent/macra/decisions.md`

## Trust Verdict

**Recommendation: no scale / no live funnel change from this signal yet.**

Field observation: Macra has a real lower-funnel success signal on June 29, but it is not a clean growth signal. AppsFlyer/Scoreboard coverage is stale for June 28-30, the 2/day pattern is not confirmed, experiment results are mostly inferred and not decision-fresh, checkout/cancel pressure remains active, eligibility must be enforced before counting qualified starts, and activation quality is separate from nominal trial start.

Primary metric: `qualified_onboarding_start_to_trial_start`.

Primary guardrail: checkout / purchase cancel pressure, with supporting guardrails for under-18 or missing-birthdate blocks, activation after start, paid conversion after trial, and cancel reasons.

Decision-log impact: this execution supports Nora's existing no-change validation-window decision rather than creating a new live operational change. If logged later, it should be a proposed/no-change row referencing this memo and the June 30 operating snapshot. Source: `.agent/macra/decisions.md`; `docs/ops/macra-operating-snapshot-2026-06-30.md`

### Step 2 status

Complete. This execution filled the event semantics, age eligibility, activation-quality, ambiguity, operational-change, trust-guardrail, funnel-gate, and trust-verdict sections with cited evidence. It does not change live funnel, pricing, budget, eligibility, experiment allocation, or retargeting behavior.

## Decision Log Update

### Execution outcome

No new `.agent/macra/decisions.md` row was added during this execute step because this audit made no operator-approved live funnel, budget, pricing, experiment-allocation, eligibility-rule, or retargeting change. The execution result supports Nora's existing 2026-06-30 no-change validation-window decision: do not change onboarding, paywall, pricing, experiment allocation, retargeting behavior, or Apple Search Ads spend until AppsFlyer/Scoreboard coverage is refreshed and the signal is validated. Source: `.agent/macra/decisions.md`; `.agent/macra/progress.md`; `docs/ops/macra-operating-snapshot-2026-06-30.md`

If Nora turns this audit into a logged decision later, the recommended row should be a proposed/no-change guardrail decision referencing this memo, with expected metric `qualified_onboarding_start_to_trial_start` and guardrails for Apple purchase cancels, checkout failure/cancel rate, under-18 or missing-birthdate blocks, trial activation after start, paid conversion after trial, and cancel reasons. Source: `.agent/macra/contract.md`; `.agent/macra/state.json`; `.agent/macra/runbook.md`

### Step 2 status

Complete. Decision-log impact is recorded as analysis-only support for the existing no-change posture, not a new live operational change.

## Decision Log Updates

_Compatibility alias for prior audit scaffolds. See `Decision Log Update`._
