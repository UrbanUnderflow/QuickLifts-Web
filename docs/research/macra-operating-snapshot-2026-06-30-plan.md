# Macra Operating Snapshot Plan — 2026-06-30

## Task

Create `docs/ops/macra-operating-snapshot-2026-06-30.md` after refreshing the Macra operating surfaces for the 2026-06-30 daily read.

This file is the research and execution plan only. It does not claim that the 2026-06-30 data has already been refreshed.

## Operating Contract

Macra's current operating contract says every task must observe source-of-truth surfaces, record freshness, separate facts from inference, recommend one action or explicit no action, name the primary metric and guardrail, and log decisions in `.agent/macra/decisions.md` when the operating plan changes.

Source: `.agent/macra/contract.md`

The daily run requires Nora to confirm AppsFlyer coverage and Scoreboard freshness, refresh or flag `/admin/experiments`, create the daily snapshot, post one PulseCommand operator update, and update `.agent/macra/progress.md` / `.agent/macra/decisions.md` when the decision state changes.

Source: `.agent/macra/runbook.md`

## Known Facts Before Refresh

- The latest saved Macra aggregate read currently committed to the repo covers roughly `2026-05-27` through `2026-06-25`.
- That saved read contains `533` onboarding starts, `448` paywall reaches, `317` paywall CTA presses, `94` initiated checkouts, `5` trial starts, `3` purchases, and `3` subscribes.
- The saved source split shows Apple Search Ads with `127` starts and `3` trials, while Organic has `406` starts and `2` trials.
- The saved `/admin/experiments` result snapshot is known stale from `2026-06-16` and still reflects a retired hard-paywall configuration according to the Macra state file.
- The active experiment posture should be `variant_a`, configured as monthly plus annual, both with trial.

Sources: `.agent/macra/state.json`; `.agent/macra/progress.md`; `docs/agents/macra-operating-runbook.md`; `docs/ops/macra-operating-snapshot-2026-06-25.md`

## Current Unknowns To Resolve In Step 2

- Whether the "2 trial starts/day" pattern is present on each of `2026-06-28`, `2026-06-29`, and `2026-06-30`.
- Whether the 2026-06-30 AppsFlyer import is complete enough for a same-day decision, or whether the date should be labeled partial.
- Whether purchase logs confirm, contradict, or lag AppsFlyer trial-start counts for the last three days.
- Whether cancel reasons or StoreKit purchase cancels show a broken trust guardrail during the same 72-hour window.
- Whether retargeting send/open/click/checkout/trial state is sufficiently populated to separate lifecycle recovery from first-touch trial starts.
- Whether `/admin/experiments` has been refreshed since the stale `2026-06-16` snapshot and whether it reflects active `variant_a`.

## Refresh Plan

### 1. Scoreboard And AppsFlyer Coverage

Use the Macra Scoreboard source surfaced in `/admin/emailSequences`, backed by AppsFlyer imports.

Read targets:

- Firestore `appsflyer-scoreboards/macra`
- Firestore `appsflyer-aggregate-periods` where `product == "macra"`
- Firestore `appsflyer-macra-raw-rows` if the aggregate periods do not cover the last three days cleanly
- Import metadata from `appsflyer-import-runs` when needed for freshness and last successful pull

What to extract:

- Coverage start/end, import time, row counts, duplicate rows, and matched/unmatched customer user coverage.
- Daily `trialStarts` rows for `2026-06-28`, `2026-06-29`, and `2026-06-30`.
- Funnel counts for the snapshot date/range: onboarding starts, paywall reached, CTA pressed, checkout starts, trial starts, purchases, subscribes.
- Source split for Apple Search Ads vs Organic, with start-to-trial and checkout-to-trial calculations.

Code/source anchors: `src/pages/admin/emailSequences.tsx`; `netlify/functions/sync-macra-appsflyer-raw-data.ts`; `netlify/functions/scheduled-sync-macra-appsflyer.ts`

### 2. Experiments Freshness

Read targets:

- Firestore `macra-experiments/macra_paywall_onboarding`
- Firestore `macra-experiment-results/macra_paywall_onboarding`

What to extract:

- Live enabled variant(s), weights, and parameters.
- Result snapshot `generatedAt`, `loadedUsers`, `assignedUsers`, data input counts, and aggregate validation.
- Whether the saved result snapshot is fresh enough for decisioning on `2026-06-30`.

Freshness rule:

- Mark experiments stale if `generatedAt` is missing, earlier than the June 30 refresh, or if the result `configSnapshot` does not match active `variant_a` monthly plus annual with trial.
- If stale, the snapshot must say experiment data is observe-only and cannot justify onboarding or paywall changes.

Code/source anchor: `src/pages/admin/experiments.tsx`

### 3. Purchase Logs

Read target:

- Firestore `Macra-purchase-logs`, using the same source as `/admin/macraPurchaseLogs`.

What to extract:

- Attempts, successes, failures, cancels, trial-eligible successes, and any retargeting checkout source.
- Last-three-day counts for `2026-06-28`, `2026-06-29`, and `2026-06-30`.
- Evidence that trial starts are real purchase/subscription lifecycle events rather than duplicate AppsFlyer rows.

Code/source anchor: `src/pages/admin/macraPurchaseLogs.tsx`

### 4. Cancel Reasons

Read target:

- Firestore `Macrafeedbackreason`, using the same source as `/admin/macraCancelReasons`.

What to extract:

- Total production cancel-feedback rows in the refresh window.
- Top reason labels, unique users, selected plan/period, trigger, source, and screen-demo exclusions.
- Whether the reason mix suggests price, not ready, need more proof, something broke, or unclear value.

Code/source anchor: `src/pages/admin/macraCancelReasons.tsx`

### 5. Retargeting State

Read targets:

- `/admin/emailSequences` Macra Scoreboard retargeting counters.
- User docs with `macraEmailSequenceState`.
- Retargeting scheduler/email state from `schedule-macra-retargeting-email` and related email webhook state.

What to extract:

- Retargeting sent users, email send count, opened users, clicked users, checkout starts after send, trial starts after send, paid conversions after send, and no-tracked-behavior count.
- `webOffer24h` conversion, checkout, blocked, skipped, and eligibility states.
- Under-18 and missing-birthdate blocks surfaced through `webOffer24hBlockReason`.

Code/source anchors: `src/pages/admin/emailSequences.tsx`; `netlify/functions/schedule-macra-retargeting-email.ts`; `netlify/functions/create-macra-web-offer-checkout.js`

## Snapshot Structure For Step 2

Create `docs/ops/macra-operating-snapshot-2026-06-30.md` with these sections:

1. `Context`
2. `Coverage And Freshness`
3. `Last 3 Days Trial Pattern`
4. `Funnel Counts`
5. `Source Split`
6. `Experiment Freshness`
7. `Purchase Logs`
8. `Cancel Reasons`
9. `Retargeting State`
10. `Guardrails`
11. `Agent Findings`
12. `PulseCommand Update`
13. `Nora Decision`

Each section should label observed facts, calculations, and inference separately.

## Confirmation Criteria For The 2-Trial-Starts/Day Pattern

The pattern is confirmed only if the refreshed source shows all three rows below with adequate coverage:

| Date | Required observed trial starts | Source needed |
| --- | ---: | --- |
| 2026-06-28 | 2 | AppsFlyer daily period or raw-row rollup, cross-checked against purchase logs |
| 2026-06-29 | 2 | AppsFlyer daily period or raw-row rollup, cross-checked against purchase logs |
| 2026-06-30 | 2 | AppsFlyer daily period or raw-row rollup, labeled partial if same-day import is incomplete |

If any date is missing, partial, or contradicted by purchase logs, the snapshot should say the pattern is not yet confirmed.

## Default Decision Posture

Default decision for the June 30 snapshot:

**Do not change onboarding, paywall copy, pricing, experiment allocation, or Apple Search Ads spend during the 72-hour signal validation window unless a guardrail is broken.**

Reason:

- The saved experiment result state is known stale.
- The emerging trial-start pattern is small-sample and must be validated across clean daily coverage.
- Macra's operating contract requires avoiding live funnel changes from stale or incomplete evidence.

Primary metric:

- Qualified onboarding start to trial start.

Primary guardrail:

- Checkout cancel / purchase cancel pressure, with cancel reasons and trial activation as supporting trust checks.

Sources: `.agent/macra/contract.md`; `.agent/macra/state.json`; `.agent/macra/runbook.md`

## PulseCommand Plan

Post one PulseCommand **Macra Update** after the Step 2 refresh unless the data demands a material decision change.

Update content should include:

- Whether the 2-trial-starts/day pattern is confirmed, partial, or rejected.
- Whether AppsFlyer/Scoreboard coverage is fresh enough.
- Whether `/admin/experiments` remains stale.
- One default no-change recommendation for the 72-hour validation window.
- The primary metric and guardrail.

Escalate to a PulseCommand **Macra Decision** only if the refreshed data shows a broken guardrail or a required operating-plan change.

## Validation Checklist For Step 3

- Confirm `docs/ops/macra-operating-snapshot-2026-06-30.md` exists.
- Confirm the file cites every source artifact, Firestore collection/doc, admin surface, or calculation used.
- Confirm the last-three-day table explicitly covers `2026-06-28`, `2026-06-29`, and `2026-06-30`.
- Confirm stale experiment data is flagged if not refreshed.
- Confirm observed facts are separated from inference.
- Confirm there is exactly one Nora decision or explicit no-change decision.
- Confirm no live onboarding, paywall, price, budget, eligibility, retargeting, or experiment allocation change was made.
