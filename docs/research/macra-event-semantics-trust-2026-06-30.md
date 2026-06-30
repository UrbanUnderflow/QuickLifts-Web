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

_Pending Step 3 population._

This section must summarize `/admin/purchaseLogs` evidence for successful trials, purchase cancels, attempted purchases, failed purchases, and checkout quality.

## Cancel Reasons

_Pending Step 3 population._

This section must summarize `/admin/macraCancelReasons` evidence that affects trust, proof, price, readiness, or product-quality interpretation.

## Retargeting

_Pending Step 3 population._

This section must summarize retargeting state, email sequence state, and reachability gaps that affect trial-start quality.

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

_Pending Step 4 population._

This section must summarize how each event signal counts toward, annotates, or reverses the qualified onboarding-start-to-trial-start metric. Detailed event-level notes follow in the individual event sections.

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

## age eligibility

_Pending Step 4 population._

Required source artifacts to inspect:

- user-state collection and profile fields used by Macra
- eligibility code paths that compute age or block under-18 users
- missing-birthdate handling in onboarding, user management, or Macra admin surfaces

This section must define whether age eligibility is a hard blocker, a profile completeness requirement, or an annotation on the trial-start path.

## Age Eligibility

_Compatibility alias for the daily KPI snapshot section contract. See `age eligibility`._

## activation-quality signals

_Pending Step 4 population._

Required source artifacts to inspect:

- trial activation fields and events
- onboarding completion state
- `/admin/macraCancelReasons` entries that imply trust or product-quality failure after checkout
- any retargeting or recovery logic for trial users who have not activated

This section must define whether a user moved from nominal trial start into a trustworthy activation state.

## Activation-Quality Signals

_Compatibility alias for the daily KPI snapshot section contract. See `activation-quality signals`._

## Activation and Eligibility Guardrails

_Pending Step 5 population._

This section must summarize age eligibility, missing-birthdate blocks, trial activation fields, and other product-quality guardrails that can block, confirm, weaken, or reverse a valid trial-start count. Detailed notes follow in `age eligibility` and `activation-quality signals`.

## Ambiguities

_Pending Step 5 population._

This section must include mismatches that could make the reported 2/day trial-start signal look stronger or weaker than reality, including:

- overlap between `af_start_trial` and `af_subscribe`
- differences between AppsFlyer purchases and `/admin/purchaseLogs`
- checkout-start inflation from `web_checkout_started`
- checkout starts without activation
- StoreKit cancels after start
- under-18 or missing-birthdate blocks
- stale `/admin/experiments` results

## Operational Change Rules

_Pending Step 5 population._

This section must define the required fields for every `.agent/macra/decisions.md` row: date, owner, decision, evidence artifact, expected metric, and guardrail. It must also state that live funnel, budget, pricing, experiment allocation, eligibility, and retargeting changes require operator approval.

## Trust Guardrails

_Pending Step 6 population._

This section must end with:

- pass/fail criteria for counting a valid Macra trial start
- guardrails for purchase cancels, checkout failure/cancel rate, age/birthdate blocks, activation after start, paid conversion after trial, and cancel reasons
- at least one cited ambiguity that could make the growth signal misleading

## Funnel Decision Gate

_Pending Step 6 population._

This section must state the pass/fail rule for making a Macra funnel decision after the active `variant_a` experiment freshness check and event-semantics trust guardrails are complete.

## Trust Verdict

_Pending Step 6 population._

This section must give one pass/fail recommendation for whether the daily KPI snapshot is safe to use for Macra funnel decisions.

## Decision Log Update

_Pending Step 6 population._

This section must record the final decision-log outcome for this audit: either a proposed/no-change decision row added to `.agent/macra/decisions.md`, or the cited reason no decision-log row was required.

## Decision Log Updates

_Compatibility alias for prior audit scaffolds. See `Decision Log Update`._
