# Macra Lifecycle Conversion Read - 2026-07-02

## Step Scope

This artifact is the July 2 lifecycle/conversion read for Macra. It is being built stepwise from the refreshed operating snapshot and saved source coverage. It does not approve or ship any live funnel, pricing, offer, proof, copy, retargeting, budget, acquisition, or experiment change.

## Source Coverage

### Observed facts

- **Refreshed Scoreboard read:** `docs/ops/macra-operating-snapshot-2026-07-02.md` records a read-only refresh run at `2026-07-02T00:13:18Z` across Scoreboard, AppsFlyer, purchase logs, user state, and related Macra sources.
- **Scoreboard freshness:** The Macra Scoreboard source is `/admin/emailSequences`, backed by Firestore `appsflyer-scoreboards/macra`. The snapshot records Scoreboard `updatedAt` as `2026-06-27T08:48:20.605Z` and aggregate CSV coverage from `2026-05-23` through `2026-06-25`; this means the Scoreboard read is refreshed as an admin-source check, but the full-funnel CSV coverage is stale for July 2 decisioning.
- **AppsFlyer coverage window:** `docs/ops/macra-operating-snapshot-2026-07-02.md` reports that Firestore `appsflyer-aggregate-periods` returned `20` Macra docs and that the latest reliable full-funnel AppsFlyer aggregate used for funnel counts is `appsflyer-aggregate-periods/macra_2026-05-27_2026-06-25`. The same snapshot says no aggregate-period docs cover `2026-06-29`, `2026-06-30`, `2026-07-01`, or `2026-07-02`, and `appsflyer-macra-raw-rows` returned `0` rows for that target window.
- **`/admin/macraCancelReasons`:** The required cancel-reason surface is `/admin/macraCancelReasons`, backed by Firestore `Macrafeedbackreason`. The July 2 operating snapshot marks this guardrail read as pending, so current-day cancel-reason movement is unavailable for this step.
- **Paywall dismissal signals:** Paywall dismissal signals must be read from Scoreboard and AppsFlyer event coverage, including paywall reach, paywall primary CTA press, checkout initiation, trial start, purchase cancel, and purchase failure. The July 2 snapshot preserves stale full-funnel AppsFlyer counts through `2026-06-25` and fresh lower-funnel purchase-log rows through `2026-07-01`; it does not provide a fresh full-funnel paywall dismissal read for July 2.
- **Retargeting state:** Retargeting state must be read from user state, especially `users.macraEmailSequenceState`, plus relevant email-sequence state. The July 2 snapshot records fresh user-state rows for Macra users created from `2026-06-29` through `2026-07-02`, but marks guardrails for user-state / retargeting state as pending.
- **`/admin/experiments`:** The required experiment surface is `/admin/experiments`. `.agent/macra/state.json` still records the active experiment as `variant_a` with monthly and annual plans, both with trial, and warns that the saved `/admin/experiments` results snapshot is stale from `2026-06-16` and still reflects the retired hard-paywall configuration.
- **Purchase-log context:** Although not the core source named in this step, `docs/ops/macra-operating-snapshot-2026-07-02.md` includes fresh lower-funnel evidence from Firestore `Macra-purchase-logs`: `4` purchase-log rows on `2026-06-29`, `4` on `2026-06-30`, `2` on `2026-07-01`, and `0` on `2026-07-02` as of the read.

### Stale or unavailable sources

- **Stale full-funnel Scoreboard / AppsFlyer coverage:** Full-funnel onboarding, paywall, checkout, trial-start, purchase, and cancel counts should be treated as stale for July 2 because the latest reliable AppsFlyer aggregate period ends on `2026-06-25`.
- **Unavailable target-window AppsFlyer attribution:** AppsFlyer aggregate-period and raw-row coverage is unavailable for `2026-06-29` through `2026-07-02`, so source split and fresh acquisition quality are unverified.
- **Pending `/admin/macraCancelReasons` freshness:** The July 2 operating snapshot marks cancel-reason guardrail coverage as pending; do not treat cancel-reason patterns as freshly refreshed for the July 2 window until `/admin/macraCancelReasons` is read.
- **Pending retargeting guardrail read:** The July 2 operating snapshot marks retargeting/user-state guardrails as pending; do not infer lifecycle email pressure, suppression, or recovery effectiveness from this step alone.
- **Stale `/admin/experiments` state:** The current experiment result read remains stale unless `/admin/experiments` is refreshed or backfilled against active `variant_a`.

### Step boundary

This source-coverage step supports the later matched lifecycle read. It does not make a proposed copy, proof, or offer change, and it does not name a target metric yet.

## Matched Lifecycle Read

### Matched date range

The matched full-funnel Scoreboard / AppsFlyer read for this lifecycle pass is `2026-05-27` through `2026-06-25`, using Firestore `appsflyer-aggregate-periods/macra_2026-05-27_2026-06-25` as cited in `docs/ops/macra-operating-snapshot-2026-07-02.md`. The July 2 operating snapshot is a refreshed admin-source check, but it does not provide fresh AppsFlyer aggregate or raw-row coverage for `2026-06-29` through `2026-07-02`.

### Cancel reasons

- **Matched-window status:** The July 2 operating snapshot marks `/admin/macraCancelReasons` and Firestore `Macrafeedbackreason` guardrail coverage as pending, so there is no freshly matched cancel-reason read for `2026-05-27` through `2026-06-25` in this artifact.
- **Background evidence:** `.agent/macra/decisions.md` records the broader Solara evidence base as `69` production cancel-feedback rows in Firestore `Macrafeedbackreason`, led by price, not ready, need proof, something did not work, and Apple sheet confusion. Because that row is not a refreshed July 2 matched-window export, it should be treated as directional background rather than current-window proof.

### Paywall dismissal behavior

- **Matched-window event counts:** `docs/ops/macra-operating-snapshot-2026-07-02.md` cites stale full-funnel AppsFlyer counts for `2026-05-27` through `2026-06-25`: `811` Macra onboarding-start events, `997` paywall-reached events, `1474` paywall-primary-CTA events, `142` `af_initiated_checkout` events, `93` `macra_subscription_web_checkout_started` events, `5` trial starts, `3` purchases, and `3` subscribes.
- **Dismissal / friction context:** The same matched AppsFlyer period includes `112` `macra_subscription_purchase_cancelled` events, `14` `macra_subscription_purchase_failed` events, and `2` `macra_subscription_web_checkout_failed` events. These are friction signals after paywall or checkout intent, not proof of a single cause.
- **Interpretation boundary:** Paywall dismissal behavior can show where users stop moving through the funnel, but this matched read does not identify whether the cause was price, proof, readiness, Apple sheet confusion, source quality, or technical friction.

### Retargeting state

- **Matched-window status:** Fresh retargeting attribution is unavailable for the matched Scoreboard / AppsFlyer window. `docs/ops/macra-operating-snapshot-2026-07-02.md` lists Retargeting as not separately attributed for starts, checkout starts, trial starts, or purchase cancels.
- **Fresh user-state context outside the matched window:** The July 2 snapshot records fresh user-state rows for `2026-06-29` through `2026-07-02`, but all source hints are missing for `2026-06-29`, `2026-06-30`, and `2026-07-01`, with no rows at read time for `2026-07-02`. That read cannot be used as matched retargeting performance for `2026-05-27` through `2026-06-25`.
- **Guardrail status:** The July 2 operating snapshot marks user-state / retargeting guardrails as pending, so retargeting eligibility, suppression, already-contacted state, and recovery effectiveness remain unverified for this matched lifecycle read.

### Trial-start outcomes

- **Matched-window outcome:** The latest reliable matched AppsFlyer period shows `5` trial starts from the `2026-05-27` through `2026-06-25` full-funnel window, alongside `3` purchases and `3` subscribes.
- **Fresh lower-funnel context outside the matched window:** Firestore `Macra-purchase-logs` in the July 2 operating snapshot shows `2` trial-success rows on `2026-06-29`, `2` on `2026-06-30`, `0` on `2026-07-01`, and `0` on `2026-07-02` as of the read. These are useful lower-funnel guardrail signals, but they are not matched to fresh AppsFlyer or Scoreboard full-funnel coverage.
- **Decision boundary:** The matched read supports continued lifecycle analysis, but it does not support scaling a growth signal or shipping a copy, proof, offer, pricing, retargeting, budget, or acquisition change without refreshed AppsFlyer coverage and Nora approval.
