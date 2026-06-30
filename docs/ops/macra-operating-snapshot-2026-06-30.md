# Macra Operating Snapshot — 2026-06-30

## Context

- **Operating system:** Macra Trial-Start Operating System
- **Snapshot date:** 2026-06-30
- **Refresh run:** read-only Firestore/admin-source refresh at `2026-06-30T01:31:06Z` and purchase/user-state date-boundary check at `2026-06-30T01:41:01Z`
- **Primary metric:** qualified onboarding start to trial start
- **Primary guardrail:** checkout / purchase cancel pressure
- **Default posture:** no onboarding or paywall change during the 72-hour signal validation window unless something is broken

Source basis:

- Macra contract and runbook: `.agent/macra/contract.md`, `.agent/macra/runbook.md`
- Planning artifact: `docs/research/macra-operating-snapshot-2026-06-30-plan.md`
- Firestore collections read: `appsflyer-scoreboards/macra`, `appsflyer-aggregate-periods`, `appsflyer-macra-raw-rows`, `macra-experiments/macra_paywall_onboarding`, `macra-experiment-results/macra_paywall_onboarding`, `Macra-purchase-logs`, `Macrafeedbackreason`, `users`
- Admin/code anchors: `/admin/emailSequences`, `/admin/experiments`, `/admin/macraPurchaseLogs`, `/admin/macraCancelReasons`, `src/pages/admin/emailSequences.tsx`, `src/pages/admin/experiments.tsx`, `src/pages/admin/macraPurchaseLogs.tsx`, `src/pages/admin/macraCancelReasons.tsx`

## Coverage And Freshness

### Observed Facts

- `appsflyer-scoreboards/macra` exists.
- Scoreboard `updatedAt`: `2026-06-27T08:48:20.605Z`.
- Scoreboard aggregate CSV coverage: `2026-05-23` through `2026-06-25`.
- Latest saved AppsFlyer run id: `macra-appsflyer-csv-period-1782550099524-6ebef9b5`.
- `appsflyer-aggregate-periods` returned `20` Macra period docs, but no daily period rows for `2026-06-28`, `2026-06-29`, or `2026-06-30`.
- `appsflyer-macra-raw-rows` returned `0` rows for `eventDate >= 2026-06-28` and `eventDate <= 2026-06-30`.
- `appsflyer-import-runs` did not return recent run docs in the read used for this snapshot.

### Inference

AppsFlyer and the Macra Scoreboard are **stale for June 30 decisioning**. They can describe the prior saved aggregate through June 25, but they cannot confirm or reject source-level daily funnel movement for June 28-30.

## Last 3 Days Trial Pattern

The requested 2-trial-starts/day pattern is **not confirmed** from the refreshed source-of-truth read.

### Observed Facts

AppsFlyer / Scoreboard coverage:

| Date | AppsFlyer daily period row | AppsFlyer raw rows | AppsFlyer trial starts |
| --- | ---: | ---: | ---: |
| 2026-06-28 | Missing | 0 | Unverified |
| 2026-06-29 | Missing | 0 | Unverified |
| 2026-06-30 | Missing | 0 | Unverified |

Purchase-log cross-check from `Macra-purchase-logs`:

| Date | Purchase-log rows | Trial-success rows | Canceled rows | Failed rows |
| --- | ---: | ---: | ---: | ---: |
| 2026-06-27 | 3 | 1 | 2 | 0 |
| 2026-06-28 | 5 | 0 | 3 | 2 |
| 2026-06-29 | 4 | 2 | 2 | 0 |
| 2026-06-30 | 0 | 0 | 0 | 0 |

User-state cross-check from `users`:

| Date | Completed onboarding rows | Direct trial-start fields found |
| --- | ---: | ---: |
| 2026-06-27 | 17 | 0 |
| 2026-06-28 | 10 | 0 |
| 2026-06-29 | 18 | 0 |
| 2026-06-30 | 0 | 0 |

### Calculation

For the requested last three dates `2026-06-28`, `2026-06-29`, and `2026-06-30`, purchase logs show:

- `2026-06-28`: `0` trial-success rows
- `2026-06-29`: `2` trial-success rows
- `2026-06-30`: `0` trial-success rows as of the read

### Inference

There is a real June 29 purchase-log signal of **2 trial-success rows**, but there is not enough source coverage to call it a three-day 2/day pattern. The correct status is **single-day purchase-log signal, AppsFlyer unconfirmed**.

## Funnel Counts

### Observed Facts

The latest reliable Scoreboard / AppsFlyer funnel aggregate remains the saved read through June 25:

| Metric | Count |
| --- | ---: |
| Onboarding starts | 533 |
| Paywall reached | 448 |
| Paywall CTA pressed | 317 |
| Initiated checkout | 94 |
| Trial starts | 5 |
| Purchases | 3 |
| Subscribes | 3 |

Source: `.agent/macra/state.json`, `docs/agents/macra-operating-runbook.md`, `docs/ops/macra-operating-snapshot-2026-06-25.md`

### Inference

The June 30 snapshot cannot safely publish refreshed top-of-funnel counts from AppsFlyer because the latest Scoreboard coverage still ends on June 25. Purchase logs give a fresh lower-funnel read, but not a full refreshed funnel.

## Source Split

### Observed Facts

The latest saved source split remains the June 25 aggregate:

| Source | Starts | Trials | Start-to-trial | Checkout-to-trial |
| --- | ---: | ---: | ---: | ---: |
| Organic | 406 | 2 | 0.5% | 2.5% |
| Apple Search Ads | 127 | 3 | 2.4% | 20.0% |

Source: `.agent/macra/state.json`, `docs/agents/macra-operating-runbook.md`

### Inference

Apple Search Ads still looks directionally stronger in the saved aggregate, but no June 28-30 source split is available from AppsFlyer in this read. Do not increase, hold, or refine paid acquisition from June 30 daily data until AppsFlyer/Scoreboard coverage is refreshed.

## Experiment Freshness

### Observed Facts

Live experiment config from `macra-experiments/macra_paywall_onboarding`:

- Config exists.
- Config `updatedAt`: `2026-06-17T10:31:39.693Z`.
- Enabled live variant: `variant_a`.
- `variant_a` name: `Monthly + annual, both with trial`.
- `variant_a` weight: `100`.
- Baseline, `variant_b`, and `variant_c` are disabled at weight `0`.
- Primary metric in config: `paid_conversion`.

Saved result snapshot from `macra-experiment-results/macra_paywall_onboarding`:

- Results exist.
- Result `generatedAt`: `2026-06-25T10:08:00.102Z`.
- Result `updatedAt`: `2026-06-25T10:08:00.461Z`.
- Loaded users: `692`.
- Assigned users: `692`.
- Exact assignments: `95`.
- Inferred assignments: `597`.
- Quality label: `Mostly inferred assignments`.
- AppsFlyer aggregate validation trial starts: `7`.
- AppsFlyer aggregate validation events: `32,241`.
- AppsFlyer user docs in result inputs: `0`.

`variant_a` result row:

| Metric | Count / Rate |
| --- | ---: |
| Assignments | 692 |
| Qualified users | 503 |
| Paywall views | 692 |
| CTA taps | 40 |
| Checkout starts | 40 |
| Trial starts | 7 |
| Paid conversions | 3 |
| Apple cancels | 107 |
| Trial rate | 1.01% |
| Paid rate | 0.43% |

### Inference

The live experiment config is aligned to `variant_a`, but the saved results are not fresh enough for June 30 daily decisioning. The result is also mostly inferred, and its AppsFlyer user-doc input count is `0`, so it should be treated as **observe-only** until refreshed/backfilled against current Scoreboard and purchase-log state.

## Purchase Logs

### Observed Facts

Read target: `Macra-purchase-logs`.

- Rows scanned: `306` in the main read, then `1,200` latest rows in the date-boundary check.
- `2026-06-29` has `2` purchase-log success rows with trial-bearing plans:
  - monthly, `trialDays: 3`, created at `2026-06-29T21:44:11.666Z`
  - annual, `trialDays: 3`, created at `2026-06-29T16:23:20.047Z`
- `2026-06-28` has `3` canceled rows and `2` failed rows, with `0` trial-success rows.
- `2026-06-30` has `0` purchase-log rows as of the read.

### Inference

Purchase logs support a June 29 trial-success spike but do not support a stable 2/day pattern. The June 28 cancel/failure mix also says trust/checkout pressure is still present.

## Cancel Reasons

### Observed Facts

Read target: `Macrafeedbackreason`.

| Date | Production rows | Unique users | Top reason | Trigger |
| --- | ---: | ---: | --- | --- |
| 2026-06-28 | 1 | 1 | Price felt too high | storekit_cancelled |
| 2026-06-29 | 0 | 0 | None observed | None observed |
| 2026-06-30 | 0 | 0 | None observed | None observed |

### Inference

Cancel feedback does not show a broad new break in the last-three-day read, but the one captured June 28 reason is price/trust adjacent and lines up with the purchase-log cancellation pressure. Keep the trust guardrail active.

## Retargeting State

### Observed Facts

Read target: `users` with `registrationEntryPoint == "macra"`, scanning `853` users for common `macraEmailSequenceState` date fields.

| Date | Sent users | Sent emails | Clicked/opened users | Checkout starts | Trial starts | Paid conversions | Under-18 blocks | Missing-birthdate blocks |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 2026-06-28 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| 2026-06-29 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| 2026-06-30 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

### Inference

This read did not find recent retargeting activity in the common user-state fields, but it should be treated as **limited**, not absolute. The fuller `/admin/emailSequences` retargeting scoreboard also depends on email logs and richer behavior reconstruction.

## Guardrails

- **AppsFlyer / Scoreboard freshness:** Not holding. Coverage ends June 25, so June 28-30 source-quality and funnel counts are stale/unverified.
- **Experiment freshness:** Not holding for decisioning. Results were generated June 25 and are mostly inferred, with no AppsFlyer user-doc split.
- **Checkout / purchase cancel pressure:** Watch. June 28 has `3` canceled and `2` failed purchase-log rows with `0` trial successes; June 29 has `2` trial successes but also `2` cancels.
- **Cancel reasons:** Watch. One June 28 production cancel reason says `Price felt too high`.
- **Retargeting pressure:** Unverified / limited. No recent direct state rows found, but the read is not a full email-log reconstruction.
- **Age / missing birthdate blocks:** No recent direct blocks found in this user-state scan.

## Agent Findings

- **Scoreboard:** The Scoreboard is not fresh enough for June 30 funnel decisions because AppsFlyer coverage still ends on June 25.
- **Experiments:** `variant_a` is live at 100%, but the result snapshot is stale for daily decisioning and mostly inferred; do not call a winner.
- **Purchase Logs:** The only confirmed 2-trial signal is June 29, not a three-day pattern.
- **Cancel Reasons:** A June 28 price-related cancel reason reinforces the checkout trust guardrail.
- **Retargeting State:** Recent retargeting activity was not found in the common user-state scan; treat recovery impact as unverified.
- **AppsFlyer Coverage:** AppsFlyer cannot confirm the last-three-day 2/day pattern because there are no June 28-30 daily period rows or raw rows in the read.

## PulseCommand Update

Posted as **Macra Update**, not a scale decision.

- Firestore command collection: `agent-commands`
- Command id: `Zig5W41vZd56Omg1BdPM`
- Operator push result: `sent=0`, `failed=0`, `reason=no_registered_operator_devices`

Message:

> Macra Update — June 30 snapshot: the 2-trial-starts/day pattern is not confirmed yet. AppsFlyer/Scoreboard coverage is stale through June 25, and purchase logs only confirm 2 trial-success rows on June 29, with 0 on June 28 and 0 on June 30 as of the read. `variant_a` remains live, but `/admin/experiments` results are June 25 and mostly inferred. Nora decision: no onboarding/paywall change during the 72-hour validation window. Next action is refreshing AppsFlyer/Scoreboard coverage and then backfilling experiment results before any funnel decision.

## Nora Decision

**Decision:** Do not change onboarding, paywall, pricing, experiment allocation, retargeting behavior, or Apple Search Ads spend from this June 30 read.

**Why:** The only fresh positive signal is two purchase-log trial-success rows on June 29. The requested 2/day pattern is not confirmed across June 28-30, AppsFlyer coverage is stale, and experiment results are not fresh enough for decisioning.

**Primary metric expected to move:** qualified onboarding start to trial start.

**Guardrail:** checkout / purchase cancel pressure, with cancel reasons and stale-source risk as decision blockers.

**Next operating action:** refresh AppsFlyer/Scoreboard coverage for June 28-30, then backfill `/admin/experiments` results for active `variant_a`.
