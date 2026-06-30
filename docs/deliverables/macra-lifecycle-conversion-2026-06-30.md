# Macra lifecycle conversion read: event semantics and trust guardrails

## Research And Plan

This pass defines how the Macra lifecycle conversion read should be researched before any growth signal is scaled. It is a planning artifact only: no live onboarding, paywall, offer, pricing, retargeting, experiment allocation, or acquisition change is approved here.

### Research objective

Audit whether the current trial-start signal is trustworthy enough to inform one lifecycle conversion recommendation. The read must separate observed facts from inference, keep stale data labeled as stale, and use cancel reasons, paywall dismissal behavior, purchase or checkout context, retargeting state, and the durable Macra operating files before naming any copy, proof, or offer change.

### Source order

1. Read `/admin/macraCancelReasons` and its backing Firestore collection `Macrafeedbackreason` for user-stated cancellation and paywall-friction reasons.
2. Read paywall dismissal and funnel-drop evidence from `.agent/macra/state.json`, `docs/ops/macra-operating-snapshot-2026-06-25.md`, and any newer saved Macra operating snapshot if present.
3. Read `/admin/purchaseLogs` and Firestore collection `Macra-purchase-logs` to keep checkout initiation, purchase cancel, purchase failure, trial start, purchase success, and subscribe events separate.
4. Read retargeting configuration, eligibility, send, and suppression state from `src/pages/admin/emailSequences.tsx`, Firestore doc `email-sequence-config/macra-retargeting-v1`, recent `email-logs`, and named Macra retargeting lanes.
5. Read `.agent/macra/state.json`, `.agent/macra/progress.md`, and `.agent/macra/decisions.md` for the current metric, guardrails, stale `/admin/experiments` caveat, and Nora approval status.

### Planned analysis

- Treat cancel reasons as direct user feedback, not universal causation.
- Treat paywall dismissal as a behavioral signal that needs purchase-log and retargeting context before assigning cause.
- Treat checkout initiation as intent, not conversion.
- Treat trial start as the primary conversion signal for this lifecycle read.
- Treat retargeting eligibility and suppression as guardrail context before judging whether follow-up messaging is working.
- Keep the stale `/admin/experiments` snapshot from 2026-06-16 out of live funnel decisions unless it is refreshed or backfilled.

### Decision Log Plan

- Use `.agent/macra/decisions.md` as the approval boundary for this lifecycle read. The deliverable may recommend one proposed copy, proof, or offer change, but it must remain proposed-only unless Nora records approval there.
- Before any operational change is treated as shippable, require one decision-log row that names the owner, source evidence, expected metric movement, and guardrail. This matches the Macra operating contract in `.agent/macra/contract.md`.
- For this task, the research pass should only verify the decision-log requirement and identify the decision fields that later execution must preserve; it should not add a new live-change decision, change pricing, change retargeting behavior, or mark the proposed lifecycle change as approved.

### Step boundary

The next execution pass should add the trust guardrail read and, only after the evidence is assembled, name exactly one proposed copy, proof, or offer change with one metric and one guardrail. This research-and-plan pass stops before the recommendation section and before any decision-log approval row.

## KPI Snapshot Coverage

This daily Macra KPI snapshot must read the exact source artifacts below before making any lifecycle recommendation or treating a funnel signal as current:

- **Macra Scoreboard** - Saved Scoreboard coverage for the daily KPI chain from onboarding start through trial start and paid outcomes.
- **`/admin/experiments`** - Experiment surface for active `variant_a` freshness and any refreshed or backfilled result read.
- **`/admin/purchaseLogs`** - Admin purchase-log surface for checkout initiation, cancel, failure, trial-start, purchase, and subscribe status separation.
- **`/admin/macraCancelReasons`** - Admin cancel-reason surface for user-stated paywall and StoreKit friction.
- **Paywall dismissal signals** - Behavioral drop-off evidence between paywall reach, primary CTA, checkout initiation, and trial start.
- **Retargeting state** - Retargeting configuration, eligibility, suppression, send, and recovery-lane state.
- **AppsFlyer coverage** - AppsFlyer aggregate and import coverage dates used to decide whether Scoreboard and source-quality reads are fresh or stale.

## Source Quality Coverage

This source-quality pass must read the exact artifacts below before separating Apple Search Ads from organic or recommending `increase`, `hold`, or `refine` for paid acquisition. This section records coverage only; it does not authorize a spend, funnel, copy, pricing, offer, retargeting, or experiment change.

- **AppsFlyer imports** - Firestore `appsflyer-scoreboards/macra`, Firestore `appsflyer-aggregate-periods`, imported AppsFlyer CSV artifacts, and saved source-level rows used to split Apple Search Ads from organic.
- **Macra Scoreboard** - The Scoreboard surface under the Email Sequence admin view and saved Scoreboard aggregates used for onboarding start, paywall reach, checkout, trial, purchase, and subscribe counts.
- **`/admin/experiments`** - Required experiment surface for active `variant_a` freshness. The known stale `2026-06-16` retired hard-paywall snapshot must remain excluded from paid acquisition decisions unless refreshed or backfilled.
- **`/admin/purchaseLogs`** - Purchase-log surface and Firestore `Macra-purchase-logs` evidence for checkout initiation, purchase cancel, failure, trial success, purchase, and subscribe status.
- **`/admin/macraCancelReasons`** - Cancel-reason surface and Firestore `Macrafeedbackreason` evidence for price, readiness, proof, breakage, and Apple sheet confusion signals.
- **Paywall dismissal signals** - Behavioral source-quality context from paywall reach, paywall CTA, checkout initiation, purchase cancel, purchase failure, and trial-start drop-off.
- **Retargeting state** - Retargeting eligibility, suppression, send, open, click, checkout-start, trial-start, and paid-conversion state before treating follow-up behavior as source quality.

## Apple Search Ads Vs Organic

The saved source split is useful for direction, but it is low-sample and stale for June 30 decisioning. AppsFlyer/Scoreboard source-level coverage for this split is `2026-05-27` through `2026-06-25`, while the broader Scoreboard aggregate CSV coverage is `2026-05-23` through `2026-06-25`. June 28-30 source movement is not confirmed in the saved read.

| Source | Onboarding starts | Reached paywall | Checkout initiations | Trial starts | Purchases | Subscribes | AppsFlyer coverage dates |
| --- | ---: | --- | ---: | ---: | --- | --- | --- |
| Apple Search Ads | 127 | Not isolated in saved source split | 15 | 3 | Not isolated in saved source split | Not isolated in saved source split | `2026-05-27` through `2026-06-25` saved source split |
| Organic | 406 | Not isolated in saved source split | 79 | 2 | Not isolated in saved source split | Not isolated in saved source split | `2026-05-27` through `2026-06-25` saved source split |

Source notes: `.agent/macra/state.json` preserves the source split as `127` Apple Search Ads starts with `3` trials and `406` organic starts with `2` trials. `docs/research/macra-asa-quality-2026-06-30.md` preserves the matching checkout initiation counts: `15` for Apple Search Ads and `79` for organic. Reached-paywall, purchase, and subscribe counts are not safely isolated by source in the saved read, so they remain marked as unavailable rather than inferred.

## Daily KPI Snapshot

This snapshot records the latest saved Macra funnel read available for this deliverable. The funnel counts are useful as a baseline, but they are stale for June 30 decisioning unless newer AppsFlyer and Scoreboard coverage is refreshed.

| KPI | Value | Source / freshness |
| --- | ---: | --- |
| Onboarding starts | 533 | `.agent/macra/state.json`, saved AppsFlyer aggregate aligned with Macra Scoreboard, `2026-05-27` through `2026-06-25`. |
| Reached paywall | 448 | `.agent/macra/state.json`, saved AppsFlyer aggregate aligned with Macra Scoreboard, `2026-05-27` through `2026-06-25`. |
| Paywall CTA presses | 317 | `.agent/macra/state.json`, saved AppsFlyer aggregate aligned with Macra Scoreboard, `2026-05-27` through `2026-06-25`. |
| Checkout initiations | 94 | `.agent/macra/state.json`, saved AppsFlyer aggregate aligned with Macra Scoreboard, `2026-05-27` through `2026-06-25`. |
| Trial starts | 5 | `.agent/macra/state.json`, saved AppsFlyer aggregate aligned with Macra Scoreboard, `2026-05-27` through `2026-06-25`. |
| Purchases | 3 | `.agent/macra/state.json`, saved AppsFlyer aggregate aligned with Macra Scoreboard, `2026-05-27` through `2026-06-25`. |
| Subscribes | 3 | `.agent/macra/state.json`, saved AppsFlyer aggregate aligned with Macra Scoreboard, `2026-05-27` through `2026-06-25`. |
| Checkout cancels or failures | 161 canceled rows; 21 failed rows | `.agent/macra/decisions.md`, broader Firestore `Macra-purchase-logs` evidence base. Treat as guardrail context, not the same date window as the saved funnel. |
| Apple purchase cancels | Not separately isolated in the saved KPI snapshot | Use the 161 canceled `Macra-purchase-logs` rows as purchase-cancel pressure only; do not present them as Apple-only cancels without a refreshed `/admin/purchaseLogs` breakout. |
| AppsFlyer coverage dates | `2026-05-27` through `2026-06-25`; Scoreboard aggregate CSV coverage also noted as `2026-05-23` through `2026-06-25` | `.agent/macra/state.json` and `docs/ops/macra-operating-snapshot-2026-06-30.md`. June 28-30 AppsFlyer daily period and raw rows are unavailable in the saved read. |

## Variant A Freshness

### Facts

- **Admin surface:** `/admin/experiments`, backed by Firestore `macra-experiments/macra_paywall_onboarding` and `macra-experiment-results/macra_paywall_onboarding`.
- **Live config:** `docs/ops/macra-operating-snapshot-2026-06-30.md` records config `updatedAt` as `2026-06-17T10:31:39.693Z`, enabled live variant `variant_a`, `variant_a` name `Monthly + annual, both with trial`, weight `100`, and baseline / `variant_b` / `variant_c` disabled at weight `0`.
- **Saved result snapshot:** `docs/ops/macra-operating-snapshot-2026-06-30.md` records results `generatedAt` as `2026-06-25T10:08:00.102Z`, `updatedAt` as `2026-06-25T10:08:00.461Z`, loaded users `692`, assigned users `692`, exact assignments `95`, inferred assignments `597`, quality label `Mostly inferred assignments`, AppsFlyer aggregate validation trial starts `7`, AppsFlyer aggregate validation events `32,241`, and AppsFlyer user docs in result inputs `0`.
- **Active `variant_a` row:** Assignments `692`, qualified users `503`, paywall views `692`, CTA taps `40`, checkout starts `40`, trial starts `7`, paid conversions `3`, Apple cancels `107`, trial rate `1.01%`, and paid rate `0.43%`. Source: `docs/ops/macra-operating-snapshot-2026-06-30.md`.
- **Required stale caveat:** `.agent/macra/state.json` still says the saved `/admin/experiments` results snapshot is stale from `2026-06-16` and reflects the retired hard-paywall configuration; that caveat remains part of the decision boundary even though the June 30 operating snapshot found a newer June 25 saved result.

### Inference

The live config is aligned to active `variant_a` and the current monthly-plus-annual-with-trial setup, but the saved result read is still not strong enough for June 30 funnel decisioning. The June 25 result is newer than the retired `2026-06-16` hard-paywall caveat, but it remains observe-only because the assignments are mostly inferred and AppsFlyer user-doc input count is `0`. Do not use this section to approve a live paywall, pricing, offer, proof, copy, or retargeting change.

## Read Sources

This lifecycle recommendation uses the following exact read artifacts. Stale reads stay labeled as stale; they do not become current funnel evidence just because they are available.

- **Refreshed `/admin/experiments` results:** Required active `variant_a` outcome read for the current monthly-plus-annual-with-trial setup. If the only available `/admin/experiments` result is the `2026-06-16` retired hard-paywall snapshot, treat experiment results as not refreshed for decisioning.
- **`/admin/macraCancelReasons`:** Admin surface for Macra cancellation feedback, backed by Firestore collection `Macrafeedbackreason`, used to read user-stated friction before choosing a lifecycle intervention.
- **Paywall dismissal signals:** Paywall reached, primary CTA, checkout initiation, purchase cancel, purchase failure, and trial-start drop-off signals from saved Macra funnel reads and purchase-log context.
- **Retargeting state:** Retargeting configuration, eligibility, suppression, and send-state evidence from Macra email sequence state before deciding whether the first lifecycle fix belongs on paywall copy, proof, offer, or follow-up messaging.
- **`.agent/macra/state.json`:** Durable Macra operating state for active `variant_a`, current monthly-plus-annual-with-trial configuration, latest saved funnel run, primary metric, guardrails, and stale `/admin/experiments` caveat.

## Lifecycle Source Coverage

This lifecycle pass must read the exact artifacts below before choosing any copy, proof, or offer recommendation. This section records coverage only; it does not approve a live funnel, pricing, offer, proof, copy, retargeting, experiment, budget, or acquisition change.

- **`/admin/macraCancelReasons`** - Admin cancel-reason surface backed by Firestore `Macrafeedbackreason`, used for user-stated price, readiness, proof, breakage, and Apple sheet confusion signals.
- **paywall dismissal signals** - Saved funnel evidence between paywall reach, primary CTA, checkout initiation, purchase cancel, purchase failure, and trial start.
- **retargeting state** - Retargeting eligibility, suppression, send, open, click, checkout-start, trial-start, and paid-conversion state before deciding whether the lifecycle fix belongs on paywall proof or follow-up messaging.
- **`/admin/experiments`** - Active `variant_a` experiment surface, with the stale `2026-06-16` retired hard-paywall snapshot excluded from live decisioning unless refreshed or backfilled.
- **`.agent/macra/state.json`** - Durable operating state for the current Macra configuration, saved funnel run, source split, primary metric, guardrails, and stale-data caveats.

## Decision Source Coverage

This decision-log pass must tie any proposed operational change to source evidence, one expected metric, and guardrails before it can move beyond proposed-only status. This section names the required decision sources only; it does not approve a live funnel, pricing, offer, proof, copy, retargeting, experiment allocation, or acquisition change.

- **`/admin/macraCancelReasons`** - Required admin surface for user-stated cancellation and paywall-friction reasons before deciding whether the proposed change addresses price, readiness, proof, breakage, or Apple sheet confusion.
- **paywall dismissal signals** - Required behavioral evidence from paywall reach, primary CTA, checkout initiation, purchase cancel, purchase failure, and trial-start drop-off before naming the metric expected to move.
- **retargeting state** - Required recovery-context read for eligibility, suppression, send state, and lane behavior before deciding whether the operational change belongs on paywall proof copy or follow-up messaging.
- **`.agent/macra/state.json`** - Durable operating state for active `variant_a`, latest saved funnel run, primary metric, source split, guardrails, and stale-data caveats.
- **`.agent/macra/decisions.md`** - Required decision log for proposed-only and approved operational changes. Any shippable change must have a matching row with owner, evidence, expected metric movement, and guardrail.

## Source Coverage

This deliverable audits Macra lifecycle conversion signals before scaling the growth signal. This step only records source coverage. It does not approve a live copy, proof, offer, pricing, funnel, retargeting, experiment allocation, or acquisition change.

### Required read surfaces

- **`/admin/macraCancelReasons`** - Admin surface for Macra paywall cancellation feedback. The backing source is Firestore collection `Macrafeedbackreason`, surfaced in `src/pages/admin/macraCancelReasons.tsx`. Use it for cancel reason, reason label, trigger, source, selected plan, selected plan period, surface, app, metadata, timestamp, and user-context fields.
- **Paywall dismissal signals** - Saved paywall funnel evidence is currently preserved in `.agent/macra/state.json` and `docs/ops/macra-operating-snapshot-2026-06-25.md`. These sources show the paywall chain from paywall reached to primary CTA, checkout initiation, and trial start. The saved read includes 448 paywall reaches, 317 paywall primary CTA presses, 94 initiated checkouts, and 5 trial starts for the 2026-05-27 through 2026-06-25 window.
- **Retargeting state** - Retargeting eligibility, suppression, send state, and lane behavior should be read from `src/pages/admin/emailSequences.tsx`, Firestore doc `email-sequence-config/macra-retargeting-v1`, recent `email-logs`, and relevant retargeting lanes such as `macra-paywall-cancel-trust-v1`, `macra-web-offer-24h-v1`, `macra-web-offer-proof-v1`, `macra-paywall-view-value-v1`, `macra-no-trial-7d-challenge-v1`, and `macra-trial-no-activation-24h-v1`.
- **Refreshed `/admin/experiments`** - Required experiment read surface for active `variant_a` under the monthly-plus-annual-with-trial configuration. If `/admin/experiments` has not been refreshed or backfilled against the current Scoreboard, purchase logs, cancel reasons, retargeting state, and AppsFlyer imports, treat the result read as missing for funnel decisions.
- **`.agent/macra/state.json`** - Durable Macra operating state for active `variant_a`, latest saved AppsFlyer/Scoreboard read, source split, primary metric, and guardrail list.
- **`.agent/macra/decisions.md`** - Decision-log contract for whether this lifecycle read remains proposed-only or becomes an operator-approved change. Every operational change must tie the decision to evidence, one expected metric, and guardrails before anything ships.
- **Purchase and checkout context** - `/admin/purchaseLogs` and Firestore collection `Macra-purchase-logs` should be used to keep checkout initiation, checkout cancel, purchase cancel, purchase failure, trial start, and purchase success semantically separate.
- **AppsFlyer coverage** - Firestore doc `appsflyer-scoreboards/macra`, Firestore collection `appsflyer-aggregate-periods`, and related Macra AppsFlyer imports should be checked before treating paywall-event counts or source quality as current.

### Stale or missing coverage flags

- **Stale `/admin/experiments` caveat:** `.agent/macra/state.json` records active `variant_a`, but also says the saved `/admin/experiments` results snapshot is stale from 2026-06-16 and still reflects the retired hard-paywall configuration. Do not use that stale experiment snapshot to approve a live funnel move.
- **AppsFlyer recency caveat:** The durable saved run currently covers 2026-05-27 through 2026-06-25. Any June 28-30 source split, funnel read, or scaling conclusion remains unconfirmed unless newer AppsFlyer imports are pulled and reconciled.
- **Paywall dismissal caveat:** The saved funnel can show where users drop between paywall, CTA, checkout, and trial, but it does not by itself explain whether the drop is price concern, proof gap, readiness, technical friction, Apple sheet confusion, or source-quality mismatch.
- **Retargeting caveat:** Retargeting state must be read directly before judging pressure or recovery effectiveness. Missing retargeting breakout should be treated as unverified, not safe.
- **No live-action authorization:** This source-coverage step does not authorize live funnel, offer, pricing, retargeting, or acquisition changes.

## Event Source Coverage

This event-semantics pass must read the exact artifacts below before using any funnel event as evidence for scaling the Macra growth signal. This section records coverage only; it does not approve a live funnel, pricing, offer, proof, copy, retargeting, budget, acquisition, or experiment change.

- **`/admin/macraCancelReasons`** - Admin surface backed by Firestore `Macrafeedbackreason`, used for explicit user-stated cancellation, price, readiness, proof, breakage, and Apple sheet confusion reasons.
- **paywall dismissal signals** - Saved behavioral evidence from paywall reach, primary CTA press, checkout initiation, purchase cancel, purchase failure, and trial-start drop-off.
- **retargeting state** - Retargeting eligibility, suppression, send, open, click, checkout-start, trial-start, paid-conversion, under-18 block, and missing-birthdate block state before treating follow-up messaging as active recovery evidence.
- **`/admin/experiments`** - Required experiment surface for active `variant_a`; the stale `2026-06-16` retired hard-paywall snapshot must remain excluded from current event-semantics decisions unless refreshed or backfilled.
- **`/admin/purchaseLogs`** - Admin purchase-log surface and Firestore `Macra-purchase-logs` evidence used to keep checkout initiation, checkout cancel, purchase cancel, purchase failure, trial start, purchase, and subscribe events separate.
- **AppsFlyer coverage** - AppsFlyer imports, Firestore `appsflyer-scoreboards/macra`, and Firestore `appsflyer-aggregate-periods` used to verify source and event coverage dates before treating the growth signal as current.
- **`.agent/macra/state.json`** - Durable operating state for the latest saved funnel run, active configuration, source split, primary metric, guardrails, and stale-data caveats.

## Event Semantics

### Cancel reason

A cancel reason is explicit feedback captured after a paywall or purchase cancellation moment. It should be interpreted as directional trust-friction evidence tied to trigger, surface, plan, and user context. It is not a complete population survey and should not be used alone to claim why all users fail to start trials.

### Paywall dismissal

Paywall dismissal means the user reached a paywall state but did not continue cleanly through the next funnel step. It can reflect price concern, lack of proof, timing/readiness, unclear first value, source mismatch, Apple sheet confusion, or technical friction. It should be read with checkout and purchase logs before assigning cause.

### Checkout initiation

Checkout initiation means the user moved beyond paywall intent into a checkout or StoreKit attempt. It is stronger intent than paywall view or CTA press, but it is not a trial start and should not be counted as conversion. It should be paired with cancellation, failure, and success statuses.

### Checkout cancel or failure

Checkout cancel or failure means the user entered a checkout path but did not reach a successful trial, purchase, or subscribe state. A cancel should be treated as user-aborted intent, while a failure should be treated as technical, payment, StoreKit, or processing friction until the purchase-log status and error context prove otherwise. Neither status should be blended into paywall dismissal or counted as trial conversion.

### Apple purchase cancel

Apple purchase cancel means the iOS or StoreKit purchase sheet was dismissed or canceled before a successful trial or purchase state. It is a high-intent trust guardrail, not proof that the user rejected Macra overall. Read it with selected plan, cancel reason, Apple sheet confusion, purchase-log status, and paywall context before assigning cause.

### Trial start

Trial start is the first conversion signal that represents entry into the trial path. It must remain separate from checkout initiation, attempted purchase, purchase cancellation, purchase failure, purchase success, and subscribe events so the team does not scale a noisy proxy.

### Retargeting eligibility

Retargeting eligibility means a user qualifies for a lifecycle follow-up lane based on user state, timing, unresolved intent, and suppression rules. Eligibility is not a send, open, click, checkout, trial, or purchase event. It should be treated as a readiness state, not as evidence that the message worked.

### Retargeting suppression

Retargeting suppression means the system intentionally skipped a user because a rule blocked sending. Suppression can reflect under-18 state, incomplete onboarding, no rule due, missing email, claim block, historical trial/subscription, or another safety or timing condition. Suppression should be treated as a guardrail signal, not automatically as campaign underperformance.

## Cancel Reasons And Paywall Dismissals

### Facts

- `.agent/macra/decisions.md` records `69` production cancel-feedback rows in Firestore `Macrafeedbackreason`, led by price, not ready, need proof, something did not work, and Apple sheet confusion.
- `docs/ops/macra-operating-snapshot-2026-06-30.md` reports one production `Macrafeedbackreason` row on `2026-06-28`; the top reason was `Price felt too high`, triggered by `storekit_cancelled`.
- `.agent/macra/state.json` preserves the saved paywall chain for `2026-05-27` through `2026-06-25`: `448` paywall reaches, `317` paywall primary CTA presses, `94` initiated checkouts, and `5` trial starts.
- `.agent/macra/decisions.md` records the broader purchase-log context as `306` Firestore `Macra-purchase-logs` rows: `161` canceled, `110` attempted, `21` failed, and `14` success.
- The saved paywall dismissal behavior can show where users drop between paywall reach, CTA, checkout, and trial, but it does not by itself identify whether the cause was price, proof, readiness, Apple sheet confusion, or technical failure.

### Inference

- The clearest lifecycle leak is after paywall intent and before trial start: users are pressing the paywall CTA and some are reaching checkout, but trial starts remain low.
- Price is a real trust objection, but the surrounding cancel-reason pattern points to broader uncertainty, especially readiness, need for proof, breakage, and Apple sheet confusion.
- The most defensible next lifecycle move should reduce proof and expectation friction before checkout, not introduce a discount or multiple simultaneous offer tests.

## Trust Signal Read

### Facts

- **Cancel reasons:** `.agent/macra/decisions.md` records `69` production cancel-feedback rows in Firestore `Macrafeedbackreason`, led by price, not ready, need proof, something did not work, and Apple sheet confusion. `docs/ops/macra-operating-snapshot-2026-06-30.md` also reports one production `Macrafeedbackreason` row on `2026-06-28`, with top reason `Price felt too high` and trigger `storekit_cancelled`.
- **Paywall dismissal behavior:** `.agent/macra/state.json` preserves the latest reliable saved funnel read for `2026-05-27` through `2026-06-25`: `448` paywall reaches, `317` paywall primary CTA presses, `94` initiated checkouts, and `5` trial starts. `.agent/macra/decisions.md` adds purchase-log pressure from `306` Firestore `Macra-purchase-logs` rows: `161` canceled, `110` attempted, `21` failed, and `14` success.
- **Retargeting state:** `.agent/macra/decisions.md` records retargeting config as enabled, but the latest scan sent `0`. `docs/ops/macra-operating-snapshot-2026-06-30.md` found no recent retargeting sends, opens, clicks, checkout starts, trial starts, paid conversions, under-18 blocks, or missing-birthdate blocks in common user-state fields for `2026-06-28` through `2026-06-30`.

### Inference

- The trust gap is strongest at the paywall-to-checkout moment, not in a confirmed retargeting recovery lane, because users show intent through paywall CTA and checkout starts while trial starts remain low.
- Price is a visible objection, but the pattern also includes readiness, proof, breakage, and Apple sheet confusion, so the next proposed change should make the first-week proof clearer instead of changing price or offer structure.
- Retargeting should remain guardrail context until eligibility, suppression, and send activity are refreshed; the current evidence supports a paywall proof-copy proposal more than a retargeting behavior change.

## Trust Guardrail Read

This section summarizes cancel reasons, paywall dismissal behavior, and retargeting state without treating any one signal as a complete explanation for trial-start movement.

### Facts

- `docs/ops/macra-operating-snapshot-2026-06-30.md` says AppsFlyer and Scoreboard coverage are stale for June 30 decisioning: the latest aggregate coverage ends on `2026-06-25`, and the read found no AppsFlyer daily period rows or raw rows for `2026-06-28`, `2026-06-29`, or `2026-06-30`.
- `.agent/macra/state.json` preserves the latest reliable funnel read for `2026-05-27` through `2026-06-25`: `533` onboarding starts, `448` paywall reaches, `317` paywall primary CTA presses, `94` initiated checkouts, and `5` trial starts.
- `docs/ops/macra-operating-snapshot-2026-06-30.md` reports that `Macra-purchase-logs` showed `0` trial-success rows on `2026-06-28`, `2` trial-success rows on `2026-06-29`, and `0` trial-success rows on `2026-06-30` as of the read. The same snapshot reports `3` canceled and `2` failed purchase-log rows on `2026-06-28`, plus `2` canceled rows on `2026-06-29`.
- `docs/ops/macra-operating-snapshot-2026-06-30.md` reports one production row in `Macrafeedbackreason` on `2026-06-28`; the top reason was `Price felt too high`, triggered by `storekit_cancelled`.
- `.agent/macra/decisions.md` records the broader Solara evidence base as `69` production cancel-feedback rows in Firestore `Macrafeedbackreason`, led by price, not ready, need proof, something did not work, and Apple sheet confusion.
- `.agent/macra/decisions.md` records the purchase-log evidence base as `306` rows from Firestore `Macra-purchase-logs`: `161` canceled, `110` attempted, `21` failed, and `14` success.
- `docs/ops/macra-operating-snapshot-2026-06-30.md` found no recent retargeting sends, opens, clicks, checkout starts, trial starts, paid conversions, under-18 blocks, or missing-birthdate blocks in the common user-state fields for `2026-06-28` through `2026-06-30`.
- `.agent/macra/decisions.md` records retargeting config as enabled, but the latest scan sent `0`.
- `.agent/macra/decisions.md` records Nora's active restriction: no onboarding, paywall, pricing, experiment allocation, retargeting behavior, or Apple Search Ads spend changes during the 72-hour validation window.

### Inference

- The current positive conversion signal is not stable enough to scale. Purchase logs confirm a June 29 trial-start spike, but AppsFlyer and Scoreboard do not confirm a three-day pattern or a fresh source-quality read.
- The clearest lifecycle trust leak sits between paywall intent and checkout completion. Users are showing intent through paywall CTA and checkout attempts, but the saved funnel and purchase-log mix show meaningful drop-off before trial start.
- The friction pattern is not cleanly solved by discounting. Price appears in cancel feedback, but the surrounding signals also include not ready, need proof, something did not work, and Apple sheet confusion, so the safer first move is to make the trial's immediate value and first-week proof more concrete before asking for checkout.
- Retargeting cannot be treated as a recovery engine yet. The current read shows enabled configuration but no recent send activity in the scanned state, so the recommendation should modify the paywall proof moment first, not retargeting behavior.

## Retargeting State Read

### Facts

- `.agent/macra/decisions.md` records Macra retargeting config as enabled, but the latest scan sent `0`.
- `docs/ops/macra-operating-snapshot-2026-06-30.md` found no recent retargeting sends, opens, clicks, checkout starts, trial starts, paid conversions, under-18 blocks, or missing-birthdate blocks in the common user-state fields for `2026-06-28` through `2026-06-30`.
- `## Source Coverage` in this deliverable names the retargeting lanes that must be checked before treating follow-up messaging as active recovery evidence: `macra-paywall-cancel-trust-v1`, `macra-web-offer-24h-v1`, `macra-web-offer-proof-v1`, `macra-paywall-view-value-v1`, `macra-no-trial-7d-challenge-v1`, and `macra-trial-no-activation-24h-v1`.

### Inference

- Eligible, suppressed, and already-contacted user states are not confirmed well enough to make retargeting copy the first lifecycle change.
- Because the scan shows enabled configuration but no recent sends, the cleaner execution path is to keep the proposed change on the paywall proof surface where the saved funnel already shows intent and drop-off.
- Retargeting should remain guardrail context until Nora has a refreshed read of eligibility, suppression, and send state.

## Proposed Lifecycle Change

Change exactly one surface: the Macra paywall proof block immediately before the primary plan CTA.

Replace broad value language with first-week expectation-setting copy that tells the user what they can judge during the trial before they commit. The copy should make the trial feel concrete without changing price, plan structure, eligibility, retargeting behavior, or experiment allocation.

Send-ready copy:

> Your first week is the proof. Start with a clear calorie and protein target, log enough meals for Macra to see your real routine, and use the trial to decide whether the guidance feels worth keeping.

Why this change: it addresses the strongest shared trust gap across price, not ready, and need proof feedback without creating a new offer or making a claim the current source coverage cannot support. It also keeps the adjustment small enough to validate against paywall-to-checkout behavior while Nora's 72-hour no-change restriction remains active.

## Decision Log Execution

No live operational change is approved by this deliverable. The matching proposed decision is already recorded in `.agent/macra/decisions.md` on `2026-06-30` under Solara: proposed-only paywall copy test, evidence from `Macrafeedbackreason`, `Macra-purchase-logs`, saved paywall funnel counts, and retargeting state, expected movement in paywall primary CTA to initiated checkout rate, and guardrails on StoreKit purchase cancel count plus `paywall_cancel_feedback` volume.

The controlling operator decision is also recorded in `.agent/macra/decisions.md` on `2026-06-30` under Nora: no onboarding, paywall, pricing, experiment allocation, retargeting behavior, or Apple Search Ads spend changes during the 72-hour validation window. Therefore the execution state for this lifecycle read is proposed-only; no additional decision-log approval row should be added unless Nora approves a live change with owner, evidence, expected metric movement, and guardrail.

## Metric And Approval Boundary

- **One metric this should move:** paywall primary CTA to initiated checkout rate.
- **Primary guardrail:** StoreKit purchase cancel count and `paywall_cancel_feedback` volume do not rise during the validation window.
- **Secondary guardrail:** do not treat checkout initiation as trial conversion; trial starts, paid conversion after trial, and cancel/failure rows still need separate reads.
- **Approval status:** proposed-only; no live funnel, pricing, offer, proof, copy, or retargeting change may ship unless Nora logs approval in `.agent/macra/decisions.md`.
