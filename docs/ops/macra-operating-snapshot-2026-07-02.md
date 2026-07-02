# Macra Operating Snapshot - 2026-07-02

## Context

- **Operating system:** Macra Trial-Start Operating System
- **Snapshot date:** 2026-07-02
- **Status:** Step 2 funnel counts and source split populated from read-only Scoreboard / AppsFlyer / purchase-log / user-state sources; experiment freshness and guardrails remain pending follow-up steps.
- **Primary metric:** qualified onboarding start to trial start
- **Primary guardrail:** no onboarding/paywall changes while experiment data is stale
- **Default posture:** refresh active `variant_a` experiment results before making funnel decisions.

Source surfaces to refresh:

- Macra Scoreboard: `/admin/emailSequences`
- Experiment surface: `/admin/experiments`
- Purchase logs: `/admin/purchaseLogs` and `/admin/macraPurchaseLogs`
- Cancel reasons: `/admin/macraCancelReasons`
- AppsFlyer imports: `appsflyer-scoreboards/macra`, `appsflyer-aggregate-periods`, `appsflyer-macra-raw-rows`, `appsflyer-macra-users`
- User / retargeting state: `users.macraEmailSequenceState`

## Funnel Counts

### Observed Facts

Read-only refresh run: `2026-07-02T00:13:18Z`.

Source coverage:

- Firestore `appsflyer-scoreboards/macra` exists.
- Scoreboard `updatedAt`: `2026-06-27T08:48:20.605Z`.
- Scoreboard aggregate CSV coverage: `2026-05-23` through `2026-06-25`.
- Latest scoreboard run id visible in Firestore: `macra-appsflyer-csv-period-1782550099524-6ebef9b5`.
- Firestore `appsflyer-aggregate-periods` returned `20` Macra docs.
- Latest aggregate-period doc found: `appsflyer-aggregate-periods/macra_2026-06-21_2026-06-27`, with `trialStarts = 6`, `uploadedRows = 199`, and `excludedFromRangeRollups = false`.
- No Firestore `appsflyer-aggregate-periods` docs cover `2026-06-29`, `2026-06-30`, `2026-07-01`, or `2026-07-02`.
- Firestore `appsflyer-macra-raw-rows` returned `0` rows for `eventDate >= 2026-06-29` and `eventDate <= 2026-07-02`.

Latest reliable full-funnel AppsFlyer aggregate period remains stale:

| Metric | Count | Source | Freshness |
| --- | ---: | --- | --- |
| Macra onboarding started | 811 | Firestore `appsflyer-aggregate-periods/macra_2026-05-27_2026-06-25`, `summary.events.byName.macra_onboarding_started` | Stale, period ends `2026-06-25` |
| Paywall reached | 997 | Firestore `appsflyer-aggregate-periods/macra_2026-05-27_2026-06-25`, `summary.events.byName.macra_onboarding_paywall_reached` | Stale, period ends `2026-06-25` |
| Paywall CTA pressed | 1474 | Firestore `appsflyer-aggregate-periods/macra_2026-05-27_2026-06-25`, `summary.events.byName.macra_paywall_primary_button_pressed` | Stale, period ends `2026-06-25` |
| Checkout starts | 142 `af_initiated_checkout`; 93 `macra_subscription_web_checkout_started` | Firestore `appsflyer-aggregate-periods/macra_2026-05-27_2026-06-25`, `summary.events.byName` | Stale, period ends `2026-06-25` |
| Trial starts | 5 | Firestore `appsflyer-aggregate-periods/macra_2026-05-27_2026-06-25`, `summary.events.byName.af_start_trial` and `trialStarts` | Stale, period ends `2026-06-25` |
| Purchases / subscribes | 3 `af_purchase`; 3 `af_subscribe` | Firestore `appsflyer-aggregate-periods/macra_2026-05-27_2026-06-25`, `summary.events.byName` | Stale, period ends `2026-06-25` |
| Purchase cancels / failures | 112 `macra_subscription_purchase_cancelled`; 14 `macra_subscription_purchase_failed`; 2 `macra_subscription_web_checkout_failed` | Firestore `appsflyer-aggregate-periods/macra_2026-05-27_2026-06-25`, `summary.events.byName` | Stale, period ends `2026-06-25` |

Fresh lower-funnel purchase-log read:

| Date | Purchase-log rows | Trial-success rows | Successful rows | Canceled rows | Failed rows | Attempted rows | Source |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 2026-06-29 | 4 | 2 | 2 | 2 | 0 | 4 | Firestore `Macra-purchase-logs` |
| 2026-06-30 | 4 | 2 | 2 | 1 | 0 | 4 | Firestore `Macra-purchase-logs` |
| 2026-07-01 | 2 | 0 | 0 | 2 | 0 | 2 | Firestore `Macra-purchase-logs` |
| 2026-07-02 | 0 | 0 | 0 | 0 | 0 | 0 | Firestore `Macra-purchase-logs` |

Fresh user-state read from Firestore `users` where `registrationEntryPoint == "macra"`:

| Date | Macra user docs created | Completed onboarding rows | User-source hints |
| --- | ---: | ---: | --- |
| 2026-06-29 | 19 | 18 | Missing on all 19 rows |
| 2026-06-30 | 18 | 17 | Missing on all 18 rows |
| 2026-07-01 | 22 | 17 | Missing on all 22 rows |
| 2026-07-02 | 0 | 0 | No rows at read time |

Fresh AppsFlyer rows in the target window:

| Date | Aggregate-period row | Raw rows | AppsFlyer starts | AppsFlyer checkout starts | AppsFlyer trial starts | AppsFlyer purchases |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 2026-06-29 | Missing | 0 | Unverified | Unverified | Unverified | Unverified |
| 2026-06-30 | Missing | 0 | Unverified | Unverified | Unverified | Unverified |
| 2026-07-01 | Missing | 0 | Unverified | Unverified | Unverified | Unverified |
| 2026-07-02 | Missing | 0 | Unverified | Unverified | Unverified | Unverified |

### Inference

The purchase logs show fresh lower-funnel activity through `2026-07-01`, including `2` trial-success rows on both `2026-06-29` and `2026-06-30`. The full funnel is still not refreshed because Scoreboard / AppsFlyer coverage does not include the target window. Treat onboarding-start, paywall, checkout, trial-start, purchase, and cancel counts from AppsFlyer as stale until imports catch up.

## Source Split

### Observed Facts

Fresh source split is unavailable for the target window because Firestore `appsflyer-aggregate-periods` has no docs covering `2026-06-29` through `2026-07-02`, and Firestore `appsflyer-macra-raw-rows` returned `0` rows for those dates.

Latest stale AppsFlyer aggregate source volume:

| Source | Starts | Checkout starts | Trial starts | Purchase cancels | Start-to-trial | Checkout-to-trial | Freshness |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Apple Search Ads | 127 | About 15 | 3 | 9 | 2.4% | About 20.0% | Stale saved operating split in `.agent/macra/state.json`, source AppsFlyer aggregate through `2026-06-25` |
| Organic | 406 | About 79 | 2 | 65 | 0.5% | About 2.5% | Stale saved operating split in `.agent/macra/state.json`, source AppsFlyer aggregate through `2026-06-25` |
| Retargeting | Not separately attributed | Not separately attributed | Not separately attributed | Not separately attributed | Unverified | Unverified | No fresh source attribution in target window |
| Other / unknown | Not separately attributed | Not separately attributed | Not separately attributed | Not separately attributed | Unverified | Unverified | No fresh source attribution in target window |

Latest AppsFlyer aggregate-period event-volume split:

| Aggregate period | Organic event volume | Apple Search Ads event volume | Source |
| --- | ---: | ---: | --- |
| `2026-05-27` through `2026-06-25` | 23596 | 6634 | Firestore `appsflyer-aggregate-periods/macra_2026-05-27_2026-06-25`, `summary.events.byMediaSource` |
| `2026-06-21` through `2026-06-27` | 24167 | 6652 | Firestore `appsflyer-aggregate-periods/macra_2026-06-21_2026-06-27`, `summary.events.byMediaSource` |

Fresh user-source hints:

| Date | Macra user docs created | Source hint status | Source |
| --- | ---: | --- | --- |
| 2026-06-29 | 19 | All missing | Firestore `users`, `registrationEntryPoint == "macra"` |
| 2026-06-30 | 18 | All missing | Firestore `users`, `registrationEntryPoint == "macra"` |
| 2026-07-01 | 22 | All missing | Firestore `users`, `registrationEntryPoint == "macra"` |
| 2026-07-02 | 0 | No rows at read time | Firestore `users`, `registrationEntryPoint == "macra"` |

### Inference

The stale saved split still suggests Apple Search Ads had stronger conversion quality than Organic through `2026-06-25`, but there is no fresh source-attributed evidence for `2026-06-29` through `2026-07-02`. Do not change Apple Search Ads spend, organic assumptions, or retargeting behavior from this Step 2 read.

## Experiment Snapshot Freshness

### Observed Facts

Pending read-only refresh from `/admin/experiments`.

| Field | Value | Source |
| --- | --- | --- |
| Experiment id | `macra_paywall_onboarding` | `/admin/experiments` |
| Live active variant | Pending | Firestore experiment config |
| Live config updated at | Pending | Firestore experiment config |
| Result snapshot generated at | Pending | Firestore experiment result snapshot |
| Result quality label | Pending | Firestore experiment result snapshot |
| Reflects active `variant_a`? | Pending | Compare config and result snapshot |
| Still stale from 2026-06-16 retired hard-paywall read? | Pending | `/admin/experiments` result snapshot |

### Inference

Pending. If `/admin/experiments` is still stale or not clearly refreshed to active `variant_a`, the first operating action is refresh/backfill before recommending any onboarding or paywall change.

## Guardrails

### Observed Facts

Pending read-only refresh from `/admin/macraCancelReasons`, `/admin/purchaseLogs`, user-state / retargeting state, and AppsFlyer coverage.

| Guardrail | Current status | Source | Freshness |
| --- | --- | --- | --- |
| Apple purchase cancels | Pending | `/admin/purchaseLogs`, AppsFlyer imports | Pending |
| Checkout failure / checkout cancel rate | Pending | `/admin/purchaseLogs`, AppsFlyer imports | Pending |
| Under-18 blocks | Pending | User state / retargeting state | Pending |
| Missing-birthdate blocks | Pending | User state / retargeting state | Pending |
| Trial activation after start | Pending | User state, purchase logs, AppsFlyer imports | Pending |
| Paid conversion after trial | Pending | Purchase logs, AppsFlyer imports | Pending |
| Cancel reasons: price / not ready / need proof / something broke | Pending | `/admin/macraCancelReasons` | Pending |

### Inference

Pending. Treat guardrails as unverified until the source read is complete.

## Operator-Facing Update

Pending post or record after source values and experiment freshness are populated.

Draft update structure:

> Macra Update - 2026-07-02: refreshed funnel/source read is pending. The operating recommendation remains refresh active `variant_a` experiment results before making onboarding/paywall decisions. No live funnel changes should be made while experiment data is stale.

## Decision-Log Recommendation

Pending append to `.agent/macra/decisions.md`.

Recommendation to record:

- **Owner:** Nora
- **Recommendation:** Refresh active `variant_a` experiment results before making funnel decisions.
- **Expected metric movement:** experiment decision quality
- **Guardrail:** no onboarding/paywall changes while experiment data is stale
- **Evidence:** this snapshot after source data and experiment freshness are populated.
