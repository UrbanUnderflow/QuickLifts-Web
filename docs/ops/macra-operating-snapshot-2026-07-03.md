# Macra Operating Snapshot - 2026-07-03

## Context

- **Operating system:** Macra Trial-Start Operating System
- **Snapshot date:** 2026-07-03
- **Status:** Funnel counts and source split populated from read-only Scoreboard, AppsFlyer import, purchase-log, and user-state reads; experiment freshness and guardrails pending follow-up steps.
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

Read-only refresh run: `2026-07-03T00:20:54Z`.

Scoreboard / AppsFlyer import freshness:

- Firestore `appsflyer-scoreboards/macra` exists.
- Scoreboard `updatedAt`: `2026-06-27T08:48:20.605Z`.
- Scoreboard `importedAt`: `2026-06-27T08:48:20.605Z`.
- Latest Scoreboard run id visible in Firestore: `macra-appsflyer-csv-period-1782550099524-6ebef9b5`.
- Firestore `appsflyer-aggregate-periods` returned `20` Macra docs.
- Latest aggregate-period doc found: `appsflyer-aggregate-periods/macra_2026-06-21_2026-06-27`, imported at `2026-06-27T08:48:19.998Z`.
- No Firestore `appsflyer-aggregate-periods` doc covers `2026-07-03`.
- Firestore `appsflyer-macra-raw-rows` returned `0` rows for `eventDate >= 2026-06-29` and `eventDate <= 2026-07-03`.

Latest persisted AppsFlyer full-funnel aggregate, not fresh for July 3:

| Metric | Count | Source | Freshness |
| --- | ---: | --- | --- |
| Macra onboarding starts | 826 | Firestore `appsflyer-aggregate-periods/macra_2026-06-21_2026-06-27`, `summary.events.byName.macra_onboarding_started` | Stale for July 3; period ends `2026-06-27` |
| Paywall reached | 1015 | Firestore `appsflyer-aggregate-periods/macra_2026-06-21_2026-06-27`, `summary.events.byName.macra_onboarding_paywall_reached` + `macra_paywall_viewed_standalone` | Stale for July 3; period ends `2026-06-27` |
| Paywall CTA pressed | 1553 | Firestore `appsflyer-aggregate-periods/macra_2026-06-21_2026-06-27`, CTA event bucket used by `/admin/emailSequences` | Stale for July 3; period ends `2026-06-27` |
| Checkout starts | 143 `af_initiated_checkout`; 93 `macra_subscription_web_checkout_started` | Firestore `appsflyer-aggregate-periods/macra_2026-06-21_2026-06-27`, `summary.events.byName` | Stale for July 3; period ends `2026-06-27`; do not add these without person-level dedupe |
| Trial starts | 6 | Firestore `appsflyer-aggregate-periods/macra_2026-06-21_2026-06-27`, trial event bucket used by `/admin/emailSequences` | Stale for July 3; period ends `2026-06-27` |
| Purchases / subscribes | 3 purchases; 3 subscribes | Firestore `appsflyer-aggregate-periods/macra_2026-06-21_2026-06-27`, purchase event bucket used by `/admin/emailSequences` | Stale for July 3; period ends `2026-06-27` |
| Purchase cancels / failures | 112 purchase cancels; 13 purchase failures; 2 web checkout failures | Firestore `appsflyer-aggregate-periods/macra_2026-06-21_2026-06-27`, `summary.events.byName` | Stale for July 3; period ends `2026-06-27` |

Fresh lower-funnel purchase-log read from Firestore `Macra-purchase-logs`:

| Date | Purchase-log rows | Trial-success rows | Successful rows | Canceled rows | Failed rows | Attempted rows | Source |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 2026-06-29 | 4 | 2 | 2 | 2 | 0 | 0 | Firestore `Macra-purchase-logs` |
| 2026-06-30 | 4 | 2 | 2 | 1 | 0 | 1 | Firestore `Macra-purchase-logs` |
| 2026-07-01 | 2 | 0 | 0 | 2 | 0 | 0 | Firestore `Macra-purchase-logs` |
| 2026-07-02 | 6 | 0 | 0 | 4 | 2 | 0 | Firestore `Macra-purchase-logs` |
| 2026-07-03 | 0 | 0 | 0 | 0 | 0 | 0 | Firestore `Macra-purchase-logs` at `2026-07-03T00:20:54Z` |

Fresh user-state read from Firestore `users` where `registrationEntryPoint == "macra"`:

| Date | Macra user docs created | Completed onboarding rows | User-source hints |
| --- | ---: | ---: | --- |
| 2026-06-29 | 19 | 17 | Missing on all 19 rows |
| 2026-06-30 | 18 | 17 | Missing on all 18 rows |
| 2026-07-01 | 22 | 17 | Missing on all 22 rows |
| 2026-07-02 | 23 | 19 | Missing on all 23 rows |
| 2026-07-03 | 0 | 0 | No rows at read time |

Fresh AppsFlyer rows in the July 3 target window:

| Date | Aggregate-period row | Raw rows | AppsFlyer starts | AppsFlyer checkout starts | AppsFlyer trial starts | AppsFlyer purchases |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| 2026-07-03 | Missing | 0 | Unverified | Unverified | Unverified | Unverified |

### Inference

The July 3 full funnel is not refreshed because Scoreboard / AppsFlyer coverage stops at `2026-06-27` and no raw rows are present for the target date. The fresh purchase-log read shows lower-funnel activity through `2026-07-02` but `0` July 3 rows at read time, so do not infer a July 3 funnel trend or a fresh source-quality trend from AppsFlyer yet.

## Source Split

### Observed Facts

Fresh acquisition-source split is unavailable for July 3 because Firestore `appsflyer-aggregate-periods` has no doc covering `2026-07-03`, Firestore `appsflyer-macra-raw-rows` returned `0` rows for the target window, and Firestore `users` has no usable source hints for fresh Macra user rows.

Latest stale AppsFlyer aggregate source volume:

| Source | Starts | Checkout starts | Trial starts | Purchase cancels | Start-to-trial | Checkout-to-trial | Freshness |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Apple Search Ads | Unverified for July 3 | Unverified for July 3 | Unverified for July 3 | Unverified for July 3 | Unverified for July 3 | Unverified for July 3 | No fresh July 3 AppsFlyer attribution |
| Organic | Unverified for July 3 | Unverified for July 3 | Unverified for July 3 | Unverified for July 3 | Unverified for July 3 | Unverified for July 3 | No fresh July 3 AppsFlyer attribution |
| Retargeting | Unverified for July 3 | Unverified for July 3 | Unverified for July 3 | Unverified for July 3 | Unverified for July 3 | Unverified for July 3 | No fresh July 3 AppsFlyer attribution |
| Other / unknown | 0 fresh July 3 purchase-log rows at read time | 0 fresh July 3 purchase-log rows at read time | 0 fresh July 3 purchase-log rows at read time | 0 fresh July 3 purchase-log rows at read time | Unverified | Unverified | Firestore `Macra-purchase-logs` at `2026-07-03T00:20:54Z` |

Latest available AppsFlyer aggregate event-volume split:

| Aggregate period | Organic event volume | Apple Search Ads event volume | Source |
| --- | ---: | ---: | --- |
| `2026-05-27` through `2026-06-25` | 23596 | 6634 | Firestore `appsflyer-aggregate-periods/macra_2026-05-27_2026-06-25`, `summary.events.byMediaSource` |
| `2026-06-21` through `2026-06-27` | 24167 | 6652 | Firestore `appsflyer-aggregate-periods/macra_2026-06-21_2026-06-27`, `summary.events.byMediaSource` |

Fresh purchase-log source field split, lower-funnel only:

| Date window | `subscription_required` rows | `onboarding_paywall` rows | Apple Search Ads | Organic | Retargeting | Notes |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| `2026-06-29` through `2026-07-03` | 9 | 7 | 0 attributed | 0 attributed | 0 attributed | Purchase-log `source` names paywall surface, not acquisition source |
| `2026-07-03` only | 0 | 0 | 0 attributed | 0 attributed | 0 attributed | No July 3 purchase-log rows at read time |

Fresh user-source hints:

| Date | Macra user docs created | Source hint status | Source |
| --- | ---: | --- | --- |
| 2026-06-29 | 19 | All missing | Firestore `users`, `registrationEntryPoint == "macra"` |
| 2026-06-30 | 18 | All missing | Firestore `users`, `registrationEntryPoint == "macra"` |
| 2026-07-01 | 22 | All missing | Firestore `users`, `registrationEntryPoint == "macra"` |
| 2026-07-02 | 23 | All missing | Firestore `users`, `registrationEntryPoint == "macra"` |
| 2026-07-03 | 0 | No rows at read time | Firestore `users`, `registrationEntryPoint == "macra"` |

### Inference

The source split is still not decision-grade for July 3. The latest AppsFlyer aggregate continues to show Organic carrying most event volume and Apple Search Ads carrying the smaller paid bucket through `2026-06-27`, but there is no fresh July 3 Apple Search Ads vs Organic trial-start read. Do not change Apple Search Ads spend, organic assumptions, or retargeting behavior from this Step 2 read.

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

> Macra Update - 2026-07-03: refreshed funnel/source read is pending. The operating recommendation remains refresh active `variant_a` experiment results before making onboarding/paywall decisions. No live funnel changes should be made while experiment data is stale.

## Decision-Log Recommendation

Pending append to `.agent/macra/decisions.md`.

Recommendation to record:

- **Owner:** Nora
- **Recommendation:** Refresh active `variant_a` experiment results before making funnel decisions.
- **Expected metric movement:** experiment decision quality
- **Guardrail:** no onboarding/paywall changes while experiment data is stale
- **Evidence:** this snapshot after source data and experiment freshness are populated.
