# Macra Lifecycle Conversion Read - 2026-07-02

## Step Scope

This artifact is the July 2 lifecycle/conversion read for Macra. This step only records source coverage for the matched lifecycle analysis. It does not approve or ship any live funnel, pricing, offer, proof, copy, retargeting, budget, acquisition, or experiment change.

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
