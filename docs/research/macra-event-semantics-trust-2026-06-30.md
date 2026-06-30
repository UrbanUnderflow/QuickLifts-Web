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

## Decision Log Maintenance Plan

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

## activation-quality signals

_Pending Step 4 population._

Required source artifacts to inspect:

- trial activation fields and events
- onboarding completion state
- `/admin/macraCancelReasons` entries that imply trust or product-quality failure after checkout
- any retargeting or recovery logic for trial users who have not activated

This section must define whether a user moved from nominal trial start into a trustworthy activation state.

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

## Trust Guardrails

_Pending Step 6 population._

This section must end with:

- pass/fail criteria for counting a valid Macra trial start
- guardrails for purchase cancels, checkout failure/cancel rate, age/birthdate blocks, activation after start, paid conversion after trial, and cancel reasons
- at least one cited ambiguity that could make the growth signal misleading
