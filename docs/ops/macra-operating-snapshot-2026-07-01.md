# Macra Operating Snapshot — 2026-07-01

## Context

- **Operating system:** Macra Trial-Start Operating System
- **Snapshot date:** 2026-07-01
- **Status:** Step 2 data populated from read-only Scoreboard / AppsFlyer / purchase-log / cancel-reason / user-state sources; experiment freshness remains pending for Step 3.
- **Step 2 refresh run:** `2026-07-01T00:12:43Z`
- **Runtime date note:** the local runtime context is still `2026-06-30` in `America/New_York`; `2026-07-01` rows are expected to be unavailable unless imported early.
- **Primary metric:** qualified onboarding start to trial start
- **Primary guardrail:** no onboarding/paywall changes while experiment data is stale
- **Default posture:** refresh active `variant_a` experiment results before making funnel decisions.

Source surfaces:

- Macra Scoreboard: `/admin/emailSequences`
- Experiment surface: `/admin/experiments`
- Purchase logs: `/admin/purchaseLogs` and `/admin/macraPurchaseLogs`
- Cancel reasons: `/admin/macraCancelReasons`
- AppsFlyer imports: `appsflyer-scoreboards/macra`, `appsflyer-aggregate-periods`, `appsflyer-macra-raw-rows`, `appsflyer-macra-users`
- User / retargeting state: `users.macraEmailSequenceState`

## Funnel Counts

### Observed Facts

Read-only source checks:

- Firestore `appsflyer-scoreboards/macra` exists.
- Scoreboard `updatedAt`: `2026-06-27T08:48:20.605Z`.
- Scoreboard aggregate CSV coverage: `2026-05-23` through `2026-06-25`.
- Latest AppsFlyer run id visible on the scoreboard: `macra-appsflyer-csv-period-1782550099524-6ebef9b5`.
- Firestore `appsflyer-aggregate-periods` returned `20` Macra docs, but no period rows for `2026-06-29`, `2026-06-30`, or `2026-07-01`.
- Firestore `appsflyer-macra-raw-rows` returned `0` rows for `eventDate >= 2026-06-29` and `eventDate <= 2026-07-01`.
- Firestore `Macra-purchase-logs` returned `310` latest rows in the read.
- Firestore `users` with `registrationEntryPoint == "macra"` returned `871` users in the read.

Latest reliable full-funnel Scoreboard aggregate remains the saved read through `2026-06-25`:

| Metric | Count | Source | Freshness |
| --- | ---: | --- | --- |
| Qualified onboarding starts | 533 | `.agent/macra/state.json`, `docs/agents/macra-operating-runbook.md`, prior Scoreboard aggregate | Stale, ends `2026-06-25` |
| Paywall reached | 448 | `.agent/macra/state.json`, `docs/agents/macra-operating-runbook.md`, prior Scoreboard aggregate | Stale, ends `2026-06-25` |
| Paywall CTA pressed | 317 | `.agent/macra/state.json`, `docs/agents/macra-operating-runbook.md`, prior Scoreboard aggregate | Stale, ends `2026-06-25` |
| Checkout starts | 94 | `.agent/macra/state.json`, `docs/agents/macra-operating-runbook.md`, prior Scoreboard aggregate | Stale, ends `2026-06-25` |
| Trial starts | 5 | `.agent/macra/state.json`, `docs/agents/macra-operating-runbook.md`, prior Scoreboard aggregate | Stale, ends `2026-06-25` |
| Purchases / subscribes | 3 purchases / 3 subscribes | `.agent/macra/state.json`, `docs/agents/macra-operating-runbook.md`, prior Scoreboard aggregate | Stale, ends `2026-06-25` |
| Purchase cancels / failures | See fresh purchase-log table below | Firestore `Macra-purchase-logs` | Fresh lower-funnel read |

Fresh purchase-log and user-state evidence:

| Date | Purchase-log rows | Trial-success rows | Canceled rows | Failed rows | Completed onboarding rows |
| --- | ---: | ---: | ---: | ---: | ---: |
| 2026-06-29 | 4 | 2 | 2 | 0 | 18 |
| 2026-06-30 | 4 | 2 | 1 | 0 | 17 |
| 2026-07-01 | 0 | 0 | 0 | 0 | 0 |

Fresh AppsFlyer rows in the target window:

| Date | AppsFlyer aggregate period row | AppsFlyer raw rows | AppsFlyer trial starts |
| --- | ---: | ---: | ---: |
| 2026-06-29 | Missing | 0 | Unverified |
| 2026-06-30 | Missing | 0 | Unverified |
| 2026-07-01 | Missing | 0 | Unverified |

### Inference

The purchase logs now show a lower-funnel signal of `2` trial-success rows on both `2026-06-29` and `2026-06-30`, but AppsFlyer/Scoreboard coverage is still stale through `2026-06-25`. The full funnel and source split cannot be treated as refreshed until AppsFlyer imports catch up.

## Source Split

### Observed Facts

Fresh source split is unavailable for the target window because AppsFlyer aggregate periods and raw rows are missing for `2026-06-29` through `2026-07-01`.

Latest saved source split remains the prior aggregate through `2026-06-25`:

| Source | Starts | Checkout starts | Trial starts | Purchase cancels | Start-to-trial | Checkout-to-trial | Freshness |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Apple Search Ads | 127 | 15 | 3 | 9 | 2.4% | 20.0% | Stale, saved aggregate through `2026-06-25` |
| Organic | 406 | 79 | 2 | 65 | 0.5% | 2.5% | Stale, saved aggregate through `2026-06-25` |
| Retargeting | Not separately quantified in saved AppsFlyer split | Not separately quantified | Not separately quantified | Not separately quantified | Unverified | Unverified | Fresh user-state scan below only |
| Other / unknown | Not surfaced in saved split | Not surfaced | Not surfaced | Not surfaced | Unverified | Unverified | Not available |

Fresh retargeting/user-state scan from Firestore `users.macraEmailSequenceState`:

| Date | Retargeting sent users | Retargeting checkout starts | Retargeting trial starts | Under-18 blocks | Missing-birthdate blocks |
| --- | ---: | ---: | ---: | ---: | ---: |
| 2026-06-29 | 19 | 1 | 0 | 0 | 0 |
| 2026-06-30 | 12 | 0 | 0 | 0 | 0 |
| 2026-07-01 | 0 | 0 | 0 | 0 | 0 |

### Inference

The saved Apple Search Ads signal is still directionally stronger than Organic, but that is stale evidence. The fresh purchase-log signal cannot be safely attributed to Apple Search Ads, Organic, or Retargeting without refreshed AppsFlyer/user-level attribution. Do not make paid acquisition changes from this Step 2 read.

## Experiment Snapshot Freshness

### Observed Facts

Pending Step 3 refresh from `/admin/experiments`.

Required fields to populate:

| Field | Value | Source |
| --- | --- | --- |
| Experiment id | `macra_paywall_onboarding` | `/admin/experiments` |
| Live active variant | Pending | Firestore `macra-experiments/macra_paywall_onboarding` |
| Live config updated at | Pending | Firestore `macra-experiments/macra_paywall_onboarding` |
| Result snapshot generated at | Pending | Firestore `macra-experiment-results/macra_paywall_onboarding` |
| Result quality label | Pending | Firestore `macra-experiment-results/macra_paywall_onboarding` |
| Reflects active `variant_a`? | Pending | Compare config and result snapshot |
| Stale from 2026-06-16 retired hard-paywall read? | Pending | `/admin/experiments` result snapshot |

### Inference

Pending. If `/admin/experiments` is still stale or not clearly refreshed to active `variant_a`, the first operating action is refresh/backfill before recommending any funnel change.

## Guardrails

### Observed Facts

Read-only guardrail values from Step 2:

| Guardrail | Current status | Source | Freshness |
| --- | --- | --- | --- |
| Apple purchase cancels | Watch: purchase logs show `2` canceled rows on `2026-06-29`, `1` canceled row on `2026-06-30`, and `0` on `2026-07-01` as of the read. AppsFlyer cancel events are unavailable for these dates. | `Macra-purchase-logs`; AppsFlyer unavailable | Purchase logs fresh, AppsFlyer stale |
| Checkout failure / checkout cancel rate | Watch: `2026-06-29` has 4 purchase-log rows, 2 trial successes, and 2 cancels; `2026-06-30` has 4 rows, 2 trial successes, 1 cancel, and 1 attempt. | `Macra-purchase-logs` | Fresh lower-funnel read |
| Under-18 blocks | No blocks found in common `macraEmailSequenceState` fields for `2026-06-29` through `2026-07-01`. | `users.macraEmailSequenceState` | Fresh limited user-state scan |
| Missing-birthdate blocks | No blocks found in common `macraEmailSequenceState` fields for `2026-06-29` through `2026-07-01`. | `users.macraEmailSequenceState` | Fresh limited user-state scan |
| Trial activation after start | Not confirmed. User-state scan found `0` direct trial-start fields and `0` retargeting trial starts for `2026-06-29` through `2026-07-01`. | `users`, `users.macraEmailSequenceState` | Fresh but limited |
| Paid conversion after trial | Not confirmed from AppsFlyer for target dates; purchase logs show trial-success rows but no source-attributed paid-after-trial read in Step 2. | `Macra-purchase-logs`; AppsFlyer unavailable | Partial |
| Cancel reasons: price / not ready / need proof / something broke | No new production cancel-feedback rows found for `2026-06-29`, `2026-06-30`, or `2026-07-01` in the `500` most recent `Macrafeedbackreason` rows. | `Macrafeedbackreason` | Fresh limited read |

### Inference

No trust guardrail is conclusively broken in the fresh Step 2 lower-funnel read, but purchase-cancel pressure remains a watch item. The larger blocker is still data freshness: AppsFlyer/Scoreboard has not caught up, so the source split and full funnel are not decision-ready.

## Operator Update

Pending Step 5 post.

Draft update structure:

> Macra Update — 2026-07-01: refreshed funnel/source read is pending. The operating recommendation remains refresh active `variant_a` experiment results before making onboarding/paywall decisions. No live funnel changes should be made while experiment data is stale.

## Decision-Log Recommendation

Pending Step 4 append to `.agent/macra/decisions.md`.

Recommendation to record:

- **Owner:** Nora
- **Recommendation:** Refresh active `variant_a` experiment results before making funnel decisions.
- **Expected metric movement:** experiment decision quality
- **Guardrail:** no onboarding/paywall changes while experiment data is stale
- **Evidence:** this snapshot after Steps 2-3 populate refreshed source data and experiment freshness.
