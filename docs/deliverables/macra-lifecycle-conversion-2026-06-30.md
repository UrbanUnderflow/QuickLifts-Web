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

### Step boundary

The next execution pass should add the trust guardrail read and, only after the evidence is assembled, name exactly one proposed copy, proof, or offer change with one metric and one guardrail. This research-and-plan pass stops before the recommendation section.

## Variant A Freshness

`/admin/experiments` is the required experiment surface before this lifecycle read can inform a funnel decision. The refreshed active-variant record for the current Macra setup is `variant_a`, and `.agent/macra/state.json` names the live configuration as `monthly + annual, both with trial`, meaning monthly plus annual with trial.

The required caveat from `.agent/macra/state.json` is still live: the saved `/admin/experiments` results snapshot is stale from `2026-06-16` and still reflects the retired hard-paywall configuration. That stale hard-paywall read must not be treated as evidence for the current monthly-plus-annual-with-trial paywall state.

For this deliverable, active `variant_a` can be used as the current configuration context, but not as a refreshed outcome read unless `/admin/experiments` has been refreshed or backfilled against the current Scoreboard, purchase logs, cancel reasons, retargeting state, and AppsFlyer imports.

## Read Sources

This lifecycle recommendation uses the following exact read artifacts. Stale reads stay labeled as stale; they do not become current funnel evidence just because they are available.

- **Refreshed `/admin/experiments` results:** Required active `variant_a` outcome read for the current monthly-plus-annual-with-trial setup. If the only available `/admin/experiments` result is the `2026-06-16` retired hard-paywall snapshot, treat experiment results as not refreshed for decisioning.
- **`/admin/macraCancelReasons`:** Admin surface for Macra cancellation feedback, backed by Firestore collection `Macrafeedbackreason`, used to read user-stated friction before choosing a lifecycle intervention.
- **Paywall dismissal signals:** Paywall reached, primary CTA, checkout initiation, purchase cancel, purchase failure, and trial-start drop-off signals from saved Macra funnel reads and purchase-log context.
- **Retargeting state:** Retargeting configuration, eligibility, suppression, and send-state evidence from Macra email sequence state before deciding whether the first lifecycle fix belongs on paywall copy, proof, offer, or follow-up messaging.
- **`.agent/macra/state.json`:** Durable Macra operating state for active `variant_a`, current monthly-plus-annual-with-trial configuration, latest saved funnel run, primary metric, guardrails, and stale `/admin/experiments` caveat.

## Source Coverage

This deliverable audits Macra lifecycle conversion signals before scaling the growth signal. This step only records source coverage. It does not approve a live copy, proof, offer, pricing, funnel, retargeting, experiment allocation, or acquisition change.

### Required read surfaces

- **`/admin/macraCancelReasons`** - Admin surface for Macra paywall cancellation feedback. The backing source is Firestore collection `Macrafeedbackreason`, surfaced in `src/pages/admin/macraCancelReasons.tsx`. Use it for cancel reason, reason label, trigger, source, selected plan, selected plan period, surface, app, metadata, timestamp, and user-context fields.
- **Paywall dismissal signals** - Saved paywall funnel evidence is currently preserved in `.agent/macra/state.json` and `docs/ops/macra-operating-snapshot-2026-06-25.md`. These sources show the paywall chain from paywall reached to primary CTA, checkout initiation, and trial start. The saved read includes 448 paywall reaches, 317 paywall primary CTA presses, 94 initiated checkouts, and 5 trial starts for the 2026-05-27 through 2026-06-25 window.
- **Retargeting state** - Retargeting eligibility, suppression, send state, and lane behavior should be read from `src/pages/admin/emailSequences.tsx`, Firestore doc `email-sequence-config/macra-retargeting-v1`, recent `email-logs`, and relevant retargeting lanes such as `macra-paywall-cancel-trust-v1`, `macra-web-offer-24h-v1`, `macra-web-offer-proof-v1`, `macra-paywall-view-value-v1`, `macra-no-trial-7d-challenge-v1`, and `macra-trial-no-activation-24h-v1`.
- **Refreshed `variant_a` experiment results from `/admin/experiments`** - Required experiment read surface for the active monthly-plus-annual-with-trial configuration. If `/admin/experiments` has not been refreshed or backfilled against the current Scoreboard, purchase logs, cancel reasons, retargeting state, and AppsFlyer imports, treat the result read as missing for funnel decisions.
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

## Event Semantics

### Cancel reason

A cancel reason is explicit feedback captured after a paywall or purchase cancellation moment. It should be interpreted as directional trust-friction evidence tied to trigger, surface, plan, and user context. It is not a complete population survey and should not be used alone to claim why all users fail to start trials.

### Paywall dismissal

Paywall dismissal means the user reached a paywall state but did not continue cleanly through the next funnel step. It can reflect price concern, lack of proof, timing/readiness, unclear first value, source mismatch, Apple sheet confusion, or technical friction. It should be read with checkout and purchase logs before assigning cause.

### Checkout initiation

Checkout initiation means the user moved beyond paywall intent into a checkout or StoreKit attempt. It is stronger intent than paywall view or CTA press, but it is not a trial start and should not be counted as conversion. It should be paired with cancellation, failure, and success statuses.

### Trial start

Trial start is the first conversion signal that represents entry into the trial path. It must remain separate from checkout initiation, attempted purchase, purchase cancellation, purchase failure, purchase success, and subscribe events so the team does not scale a noisy proxy.

### Retargeting eligibility

Retargeting eligibility means a user qualifies for a lifecycle follow-up lane based on user state, timing, unresolved intent, and suppression rules. Eligibility is not a send, open, click, checkout, trial, or purchase event. It should be treated as a readiness state, not as evidence that the message worked.

### Retargeting suppression

Retargeting suppression means the system intentionally skipped a user because a rule blocked sending. Suppression can reflect under-18 state, incomplete onboarding, no rule due, missing email, claim block, historical trial/subscription, or another safety or timing condition. Suppression should be treated as a guardrail signal, not automatically as campaign underperformance.

## Trust Signal Read

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

## Proposed Change

Change exactly one surface: the Macra paywall proof block immediately before the primary plan CTA.

Replace broad value language with first-week expectation-setting copy that tells the user what they can judge during the trial before they commit. The copy should make the trial feel concrete without changing price, plan structure, eligibility, retargeting behavior, or experiment allocation.

Send-ready copy:

> Your first week is the proof. Start with a clear calorie and protein target, log enough meals for Macra to see your real routine, and use the trial to decide whether the guidance feels worth keeping.

Why this change: it addresses the strongest shared trust gap across price, not ready, and need proof feedback without creating a new offer or making a claim the current source coverage cannot support. It also keeps the adjustment small enough to validate against paywall-to-checkout behavior while Nora's 72-hour no-change restriction remains active.

## Metric And Approval Status

- **One metric this should move:** paywall primary CTA to initiated checkout rate.
- **Primary guardrail:** StoreKit purchase cancel count and `paywall_cancel_feedback` volume do not rise during the validation window.
- **Secondary guardrail:** do not treat checkout initiation as trial conversion; trial starts, paid conversion after trial, and cancel/failure rows still need separate reads.
- **Approval status:** proposed-only; no live funnel, offer, pricing, or retargeting change unless Nora logs approval in `.agent/macra/decisions.md`.
