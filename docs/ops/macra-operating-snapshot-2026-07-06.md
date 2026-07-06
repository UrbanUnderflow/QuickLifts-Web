# Macra Operating Snapshot - 2026-07-06

## Context

- **Operating system:** Macra Trial-Start Operating System
- **Snapshot date:** 2026-07-06
- **Read timestamp:** `2026-07-06T00:16:47.981Z`
- **Operating-time note:** The read occurred at **2026-07-05 20:16:47 EDT**, before the 2026-07-06 America/New_York operating day had started. Treat July 6 target-day zeros as pre-day / not-yet-observable, not as final July 6 performance.
- **Primary metric:** qualified onboarding start to trial start
- **Primary guardrail:** no onboarding/paywall/pricing/allocation/retargeting/Apple Search Ads changes while experiment data is stale, mostly inferred, or not decision-grade.
- **Default posture:** refresh active `variant_a` experiment results before making funnel decisions.

Source surfaces read for this step:

- Macra Scoreboard: `/admin/emailSequences`; Firestore `appsflyer-scoreboards/macra`
- AppsFlyer imports: Firestore `appsflyer-aggregate-periods`, `appsflyer-macra-raw-rows`, `appsflyer-macra-users`
- Purchase logs: `/admin/purchaseLogs`, `/admin/macraPurchaseLogs`; Firestore `Macra-purchase-logs`
- Experiments: `/admin/experiments`; Firestore `macra-experiments/macra_paywall_onboarding`, `macra-experiment-results/macra_paywall_onboarding`
- Cancel reasons: `/admin/macraCancelReasons`; Firestore `Macrafeedbackreason`
- User / retargeting state: Firestore `users` where `registrationEntryPoint == "macra"` plus Macra retargeting fields used by `/admin/emailSequences`

## Funnel Counts

### Observed Facts

Scoreboard / AppsFlyer import freshness:

- Firestore `appsflyer-scoreboards/macra` exists.
- Scoreboard `updatedAt`: `2026-06-27T08:48:20.605Z`.
- Scoreboard `importedAt`: `2026-06-27T08:48:20.605Z`.
- Latest Scoreboard run id visible in Firestore: `macra-appsflyer-csv-period-1782550099524-6ebef9b5`.
- Firestore `appsflyer-aggregate-periods` returned `20` Macra docs.
- Latest aggregate-period doc found: `appsflyer-aggregate-periods/macra_2026-06-21_2026-06-27`.
- No Firestore `appsflyer-aggregate-periods` doc covers `2026-07-06`.
- Firestore `appsflyer-macra-raw-rows` returned `0` rows for `eventDate >= 2026-07-02` and `eventDate <= 2026-07-06`.

Latest persisted AppsFlyer full-funnel aggregate, not fresh for July 6:

| Metric | Count | Source | Freshness |
| --- | ---: | --- | --- |
| Macra onboarding starts | 826 | Firestore `appsflyer-aggregate-periods/macra_2026-06-21_2026-06-27`, `summary.events.byName.macra_onboarding_started` | Stale for July 6; period ends `2026-06-27` |
| Paywall reached | 1001 onboarding paywall reached; 14 standalone paywall views | Firestore `appsflyer-aggregate-periods/macra_2026-06-21_2026-06-27`, paywall event bucket used by `/admin/emailSequences` | Stale for July 6; period ends `2026-06-27` |
| Paywall CTA pressed | 1553 | Firestore `appsflyer-aggregate-periods/macra_2026-06-21_2026-06-27`, `macra_paywall_primary_button_pressed` | Stale for July 6; period ends `2026-06-27` |
| Checkout starts | 143 `af_initiated_checkout`; 93 `macra_subscription_web_checkout_started` | Firestore `appsflyer-aggregate-periods/macra_2026-06-21_2026-06-27`, `summary.events.byName` | Stale for July 6; do not add these without person-level dedupe |
| Trial starts | 6 `af_start_trial` | Firestore `appsflyer-aggregate-periods/macra_2026-06-21_2026-06-27`, trial event bucket used by `/admin/emailSequences` | Stale for July 6; period ends `2026-06-27` |
| Purchases | 3 `af_purchase` | Firestore `appsflyer-aggregate-periods/macra_2026-06-21_2026-06-27`, purchase event bucket used by `/admin/emailSequences` | Stale for July 6; period ends `2026-06-27` |
| Subscribes | 3 `af_subscribe` | Firestore `appsflyer-aggregate-periods/macra_2026-06-21_2026-06-27`, subscribe event bucket used by `/admin/emailSequences` | Stale for July 6; period ends `2026-06-27` |
| Purchase cancels / failures | 112 purchase cancels; 13 purchase failures; 2 web checkout failures | Firestore `appsflyer-aggregate-periods/macra_2026-06-21_2026-06-27`, `summary.events.byName` | Stale for July 6; period ends `2026-06-27` |

Fresh lower-funnel purchase-log read from Firestore `Macra-purchase-logs`:

| Date | Purchase-log rows | Trial-success rows | Successful rows | Canceled rows | Failed rows | Attempted rows | Source |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 2026-07-02 | 6 | 0 | 0 | 4 | 2 | 0 | Firestore `Macra-purchase-logs` |
| 2026-07-03 | 0 | 0 | 0 | 0 | 0 | 0 | Firestore `Macra-purchase-logs` |
| 2026-07-04 | 1 | 0 | 0 | 1 | 0 | 0 | Firestore `Macra-purchase-logs` |
| 2026-07-05 | 2 | 1 | 1 | 1 | 0 | 0 | Firestore `Macra-purchase-logs` |
| 2026-07-06 | 0 | 0 | 0 | 0 | 0 | 0 | Firestore `Macra-purchase-logs`; target day had not started in EDT at read time |

Fresh user-state read from Firestore `users` where `registrationEntryPoint == "macra"`:

| Date | Macra user docs created | Completed onboarding rows | User-source hints |
| --- | ---: | ---: | ---: |
| 2026-07-02 | 22 | 18 | 0 |
| 2026-07-03 | 10 | 6 | 0 |
| 2026-07-04 | 10 | 6 | 0 |
| 2026-07-05 | 7 | 3 | 0 |
| 2026-07-06 | 0 | 0 | 0 |

Fresh AppsFlyer rows in the July 6 target window:

| Date | Aggregate-period row | Raw rows | AppsFlyer starts | AppsFlyer checkout starts | AppsFlyer trial starts | AppsFlyer purchases |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| 2026-07-06 | Missing | 0 | Unverified | Unverified | Unverified | Unverified |

### Inference

The July 6 full funnel is not observable at this read. The operating day had not started in America/New_York, AppsFlyer / Scoreboard coverage still stops at `2026-06-27`, and no raw AppsFlyer rows cover the July 2-6 rolling window. Fresh first-party evidence does show July 5 movement: `7` Macra user docs, `3` completed onboarding rows, and `2` purchase-log rows including `1` trial-success row and `1` StoreKit cancel. That is useful as lower-funnel context, but it is not a refreshed July 6 source-quality read.

## Source Split

### Observed Facts

Fresh acquisition-source split is unavailable for July 6 because Firestore `appsflyer-aggregate-periods` has no doc covering `2026-07-06`, Firestore `appsflyer-macra-raw-rows` returned `0` rows for the rolling target window, and Firestore `users` has no usable source hints on the rolling Macra user rows.

Latest available AppsFlyer aggregate event-volume split:

| Aggregate period | Organic event volume | Apple Search Ads event volume | Source |
| --- | ---: | ---: | --- |
| `2026-06-21` through `2026-06-27` | 24167 | 6652 | Firestore `appsflyer-aggregate-periods/macra_2026-06-21_2026-06-27`, `summary.events.byMediaSource` |

Fresh purchase-log source field split, lower-funnel surface only:

| Date window | `subscription_required` rows | `onboarding_paywall` rows | Apple Search Ads | Organic | Notes |
| --- | ---: | ---: | ---: | ---: | --- |
| `2026-07-02` through `2026-07-06` | 5 | 4 | 0 attributed | 0 attributed | Purchase-log `source` names paywall surface, not acquisition source |
| `2026-07-06` only | 0 | 0 | 0 attributed | 0 attributed | No July 6 purchase-log rows at read time |

Fresh user-source hints:

| Date | Macra user docs created | Source hint status | Source |
| --- | ---: | --- | --- |
| 2026-07-02 | 22 | All missing | Firestore `users`, `registrationEntryPoint == "macra"` |
| 2026-07-03 | 10 | All missing | Firestore `users`, `registrationEntryPoint == "macra"` |
| 2026-07-04 | 10 | All missing | Firestore `users`, `registrationEntryPoint == "macra"` |
| 2026-07-05 | 7 | All missing | Firestore `users`, `registrationEntryPoint == "macra"` |
| 2026-07-06 | 0 | No target-day rows yet | Firestore `users`, `registrationEntryPoint == "macra"` |

### Inference

The source split is not decision-grade for July 6. The stale AppsFlyer aggregate still shows Organic carrying most event volume and Apple Search Ads carrying the smaller paid bucket through `2026-06-27`, but there is no fresh Apple Search Ads vs Organic read for July 6 and no user-source hint coverage in first-party rows. Do not change Apple Search Ads spend, organic assumptions, or retargeting behavior from this snapshot.

## Experiment Snapshot Freshness

### Observed Facts

Pending source read.

Required fields for the population step:

| Field | Value | Source |
| --- | --- | --- |
| Experiment id | Pending | Firestore `macra-experiments/macra_paywall_onboarding` |
| Active intended variant | Pending | Firestore `macra-experiments/macra_paywall_onboarding.variants` |
| Config updated at | Pending | Firestore `macra-experiments/macra_paywall_onboarding.updatedAt` |
| Result snapshot generated at | Pending | Firestore `macra-experiment-results/macra_paywall_onboarding.generatedAt` |
| Result quality label | Pending | Firestore `macra-experiment-results/macra_paywall_onboarding.qualityLabel` |
| Exact vs inferred assignments | Pending | Firestore `macra-experiment-results/macra_paywall_onboarding` |
| Whether refreshed to active `variant_a` | Pending | `/admin/experiments`; Firestore config and result comparison |
| Whether still stale from the retired hard-paywall snapshot | Pending | `/admin/experiments`; Firestore result metadata |

### Inference

Pending source read. If the saved experiment result is missing, stale, mostly inferred, or not clearly refreshed to active `variant_a`, the first operating action is refresh/backfill active `variant_a` before making any funnel decision.

## Guardrails

### Observed Facts

Pending source read.

Required rows for the population step:

| Guardrail | Current status | Source | Freshness |
| --- | --- | --- | --- |
| Apple purchase cancels / StoreKit cancels | Pending | Firestore `Macra-purchase-logs`; AppsFlyer cancel events | Pending |
| Checkout failures / cancels | Pending | Firestore `Macra-purchase-logs`; AppsFlyer checkout failure/cancel events | Pending |
| Under-18 blocks | Pending | Firestore `users`; eligibility fields | Pending |
| Missing-birthdate coverage | Pending | Firestore `users`; eligibility fields | Pending |
| Trial activation after start | Pending | Firestore `users`; purchase logs; AppsFlyer trial events | Pending |
| Paid conversion after trial | Pending | Firestore `users`; purchase logs; AppsFlyer purchase/subscribe events | Pending |
| Cancel-reason patterns | Pending | Firestore `Macrafeedbackreason` | Pending |
| Retargeting pressure | Pending | Firestore `users` retargeting state; `/admin/emailSequences` | Pending |
| AppsFlyer coverage | Pending | Firestore `appsflyer-scoreboards`, `appsflyer-aggregate-periods`, `appsflyer-macra-raw-rows` | Pending |

### Inference

Pending source read. Do not mark guardrails holding until cancel, failure, eligibility, activation, paid-conversion, retargeting, and attribution coverage are populated.

## Operator-Facing Update

Pending source read.

Required update frame:

> Macra Update - 2026-07-06: Pending source read. Record the latest Scoreboard/Appsflyer freshness, experiment-result freshness, purchase/cancel pressure, and the single Nora decision. If `/admin/experiments` is still stale or not decision-grade, first action is refresh/backfill active `variant_a` before any funnel change.

Posting status: pending. Record whether this update is posted externally or only captured in this artifact during the review/validation step.

## Decision-Log Recommendation

- **Owner:** Nora
- **Recommendation:** Refresh active `variant_a` experiment results before making funnel decisions.
- **Evidence:** Pending population from `docs/ops/macra-operating-snapshot-2026-07-06.md`, `/admin/experiments`, Firestore `macra-experiments/macra_paywall_onboarding`, Firestore `macra-experiment-results/macra_paywall_onboarding`, AppsFlyer imports, purchase logs, cancel reasons, and user state.
- **Expected metric movement:** experiment decision quality.
- **Guardrail:** no onboarding/paywall changes while experiment data is stale.
- **Decision-log impact:** append the July 6 Nora recommendation to `.agent/macra/decisions.md` during the decision-log step after this snapshot has source evidence.
