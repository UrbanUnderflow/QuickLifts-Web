# Macra Operating Snapshot - 2026-07-05

## Context

- **Operating system:** Macra Trial-Start Operating System
- **Snapshot date:** 2026-07-05
- **Read timestamp:** `2026-07-05T00:19:49.518Z`
- **Operating-time note:** The read occurred at **2026-07-04 20:19:49 EDT**, before the 2026-07-05 America/New_York operating day had started. Treat target-day zeros as pre-day / not-yet-observable, not as final July 5 performance.
- **Primary metric:** qualified onboarding start to trial start
- **Primary guardrail:** no onboarding/paywall/pricing/allocation/retargeting/Apple Search Ads changes while experiment data is stale, mostly inferred, or not decision-grade.
- **Default posture:** refresh active `variant_a` experiment results before making funnel decisions.

Source surfaces read:

- Macra Scoreboard: `/admin/emailSequences`; Firestore `appsflyer-scoreboards/macra`
- AppsFlyer imports: Firestore `appsflyer-aggregate-periods`, `appsflyer-macra-raw-rows`, `appsflyer-macra-users`
- Purchase logs: `/admin/purchaseLogs`, `/admin/macraPurchaseLogs`; Firestore `Macra-purchase-logs`
- Experiments: `/admin/experiments`; Firestore `macra-experiments/macra_paywall_onboarding`, `macra-experiment-results/macra_paywall_onboarding`
- Cancel reasons: `/admin/macraCancelReasons`; Firestore `Macrafeedbackreason`
- User / retargeting state: Firestore `users` where `registrationEntryPoint == "macra"`

## Funnel Counts

### Observed Facts

Scoreboard / AppsFlyer import freshness:

- Firestore `appsflyer-scoreboards/macra` exists.
- Scoreboard `updatedAt`: `2026-06-27T08:48:20.605Z`.
- Scoreboard `importedAt`: `2026-06-27T08:48:20.605Z`.
- Latest Scoreboard run id visible in Firestore: `macra-appsflyer-csv-period-1782550099524-6ebef9b5`.
- Firestore `appsflyer-aggregate-periods` returned `20` Macra docs.
- Latest aggregate-period doc found: `appsflyer-aggregate-periods/macra_2026-06-21_2026-06-27`.
- No Firestore `appsflyer-aggregate-periods` doc covers `2026-07-05`.
- Firestore `appsflyer-macra-raw-rows` returned `0` rows for `eventDate >= 2026-07-01` and `eventDate <= 2026-07-05`.

Latest persisted AppsFlyer full-funnel aggregate, not fresh for July 5:

| Metric | Count | Source | Freshness |
| --- | ---: | --- | --- |
| Macra onboarding starts | 826 | Firestore `appsflyer-aggregate-periods/macra_2026-06-21_2026-06-27`, `summary.events.byName.macra_onboarding_started` | Stale for July 5; period ends `2026-06-27` |
| Paywall reached | 1001 onboarding paywall reached; 14 standalone paywall views | Firestore `appsflyer-aggregate-periods/macra_2026-06-21_2026-06-27`, paywall event bucket used by `/admin/emailSequences` | Stale for July 5; period ends `2026-06-27` |
| Paywall CTA pressed | 1553 | Firestore `appsflyer-aggregate-periods/macra_2026-06-21_2026-06-27`, `macra_paywall_primary_button_pressed` | Stale for July 5; period ends `2026-06-27` |
| Checkout starts | 143 `af_initiated_checkout`; 93 `macra_subscription_web_checkout_started` | Firestore `appsflyer-aggregate-periods/macra_2026-06-21_2026-06-27`, `summary.events.byName` | Stale for July 5; do not add these without person-level dedupe |
| Trial starts | 6 `af_start_trial` | Firestore `appsflyer-aggregate-periods/macra_2026-06-21_2026-06-27`, trial event bucket used by `/admin/emailSequences` | Stale for July 5; period ends `2026-06-27` |
| Purchases / subscribes | 3 purchases; 3 subscribes | Firestore `appsflyer-aggregate-periods/macra_2026-06-21_2026-06-27`, purchase event bucket used by `/admin/emailSequences` | Stale for July 5; period ends `2026-06-27` |
| Purchase cancels / failures | 112 purchase cancels; 13 purchase failures; 2 web checkout failures | Firestore `appsflyer-aggregate-periods/macra_2026-06-21_2026-06-27`, `summary.events.byName` | Stale for July 5; period ends `2026-06-27` |

Fresh lower-funnel purchase-log read from Firestore `Macra-purchase-logs`:

| Date | Purchase-log rows | Trial-success rows | Successful rows | Canceled rows | Failed rows | Attempted rows | Source |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 2026-07-01 | 2 | 0 | 0 | 2 | 0 | 0 | Firestore `Macra-purchase-logs` |
| 2026-07-02 | 6 | 0 | 0 | 4 | 2 | 0 | Firestore `Macra-purchase-logs` |
| 2026-07-03 | 0 | 0 | 0 | 0 | 0 | 0 | Firestore `Macra-purchase-logs` |
| 2026-07-04 | 1 | 0 | 0 | 1 | 0 | 0 | Firestore `Macra-purchase-logs` |
| 2026-07-05 | 0 | 0 | 0 | 0 | 0 | 0 | Firestore `Macra-purchase-logs`; target day had not started in EDT at read time |

Fresh user-state read from Firestore `users` where `registrationEntryPoint == "macra"`:

| Date | Macra user docs created | Completed onboarding rows | User-source hints | Missing birthdate rows |
| --- | ---: | ---: | ---: | ---: |
| 2026-07-01 | 22 | 17 | 0 | 22 |
| 2026-07-02 | 22 | 18 | 0 | 22 |
| 2026-07-03 | 10 | 6 | 0 | 10 |
| 2026-07-04 | 9 | 6 | 0 | 9 |
| 2026-07-05 | 0 | 0 | 0 | 0 |

Fresh AppsFlyer rows in the July 5 target window:

| Date | Aggregate-period row | Raw rows | AppsFlyer starts | AppsFlyer checkout starts | AppsFlyer trial starts | AppsFlyer purchases |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| 2026-07-05 | Missing | 0 | Unverified | Unverified | Unverified | Unverified |

### Inference

The July 5 full funnel is not observable at this read. The operating day had not started in America/New_York, AppsFlyer / Scoreboard coverage still stops at `2026-06-27`, and no raw AppsFlyer rows cover the July 1-5 rolling window. The only fresh rolling evidence is first-party user and purchase-log activity through July 4, which is useful for guardrails but not enough to approve a funnel decision.

## Source Split

### Observed Facts

Fresh acquisition-source split is unavailable for July 5 because Firestore `appsflyer-aggregate-periods` has no doc covering `2026-07-05`, Firestore `appsflyer-macra-raw-rows` returned `0` rows for the rolling target window, and Firestore `users` has no usable source hints on the rolling Macra user rows.

Latest available AppsFlyer aggregate event-volume split:

| Aggregate period | Organic event volume | Apple Search Ads event volume | Source |
| --- | ---: | ---: | --- |
| `2026-06-21` through `2026-06-27` | 24167 | 6652 | Firestore `appsflyer-aggregate-periods/macra_2026-06-21_2026-06-27`, `summary.events.byMediaSource` |

Fresh purchase-log source field split, lower-funnel surface only:

| Date window | `subscription_required` rows | `onboarding_paywall` rows | Apple Search Ads | Organic | Notes |
| --- | ---: | ---: | ---: | ---: | --- |
| `2026-07-01` through `2026-07-05` | 6 | 3 | 0 attributed | 0 attributed | Purchase-log `source` names paywall surface, not acquisition source |
| `2026-07-05` only | 0 | 0 | 0 attributed | 0 attributed | No July 5 purchase-log rows at read time |

Fresh user-source hints:

| Date | Macra user docs created | Source hint status | Source |
| --- | ---: | --- | --- |
| 2026-07-01 | 22 | All missing | Firestore `users`, `registrationEntryPoint == "macra"` |
| 2026-07-02 | 22 | All missing | Firestore `users`, `registrationEntryPoint == "macra"` |
| 2026-07-03 | 10 | All missing | Firestore `users`, `registrationEntryPoint == "macra"` |
| 2026-07-04 | 9 | All missing | Firestore `users`, `registrationEntryPoint == "macra"` |
| 2026-07-05 | 0 | No target-day rows yet | Firestore `users`, `registrationEntryPoint == "macra"` |

### Inference

The source split is not decision-grade for July 5. The stale AppsFlyer aggregate still shows Organic carrying most event volume and Apple Search Ads carrying the smaller paid bucket through `2026-06-27`, but there is no fresh Apple Search Ads vs Organic read for July 5 and no user-source hint coverage in first-party rows. Do not change Apple Search Ads spend, organic assumptions, or retargeting behavior from this snapshot.

## Experiment Snapshot Freshness

### Observed Facts

| Field | Value | Source |
| --- | --- | --- |
| Experiment id | `macra_paywall_onboarding` | Firestore `macra-experiments/macra_paywall_onboarding` |
| Config exists | Yes | Firestore `macra-experiments/macra_paywall_onboarding` |
| Config updated at | `2026-06-17T10:31:39.693Z` | Firestore `macra-experiments/macra_paywall_onboarding.updatedAt` |
| Primary metric | `paid_conversion` | Firestore `macra-experiments/macra_paywall_onboarding.primaryMetric` |
| Assignment salt | `macra-paywall-onboarding-2026-05` | Firestore `macra-experiments/macra_paywall_onboarding.assignmentSalt` |
| Active intended variant | `variant_a`, weight `100`, "Monthly + annual, both with trial" | Firestore `macra-experiments/macra_paywall_onboarding.variants` |
| Retired variants | `baseline`, `variant_b`, `variant_c`, each weight `0` | Firestore `macra-experiments/macra_paywall_onboarding.variants` |
| Result snapshot exists | Yes | Firestore `macra-experiment-results/macra_paywall_onboarding` |
| Result snapshot generated at | `2026-06-25T10:08:00.102Z` | Firestore `macra-experiment-results/macra_paywall_onboarding.generatedAt` |
| Result quality label | `Mostly inferred assignments` | Firestore `macra-experiment-results/macra_paywall_onboarding.qualityLabel` |
| Result loaded users | 692 | Firestore `macra-experiment-results/macra_paywall_onboarding.loadedUsers` |
| Result assigned users | 692 | Firestore `macra-experiment-results/macra_paywall_onboarding.assignedUsers` |
| Result exact assignments | 95 | Firestore `macra-experiment-results/macra_paywall_onboarding.exactAssignments` |
| Result inferred assignments | 597 | Firestore `macra-experiment-results/macra_paywall_onboarding.inferredAssignments` |
| Variant A result row | 692 assignments, 503 qualified users, 692 onboarding completions, 692 paywall views, 40 checkout starts, 107 Apple cancels, 7 trial starts, 3 paid conversions | Firestore `macra-experiment-results/macra_paywall_onboarding.variants` |
| AppsFlyer validation in result | 7 aggregate trial starts, 32241 aggregate events; cannot split by variant unless event metadata includes variant | Firestore `macra-experiment-results/macra_paywall_onboarding.aggregateValidation` |

### Inference

The experiment snapshot is not the old `2026-06-16` retired hard-paywall result, but it is still stale for July 5 decisioning. It was generated on `2026-06-25`, has a `Mostly inferred assignments` quality label, and depends on AppsFlyer validation that is not refreshed past `2026-06-27`. The first operating action remains refreshing/backfilling active `variant_a` before any onboarding, paywall, pricing, allocation, retargeting, or Apple Search Ads funnel decision.

## Guardrails

### Observed Facts

Purchase-log guardrails from Firestore `Macra-purchase-logs`, rolling window `2026-07-01` through `2026-07-05`:

| Guardrail | Current status | Source | Freshness |
| --- | --- | --- | --- |
| Apple purchase cancels / StoreKit cancels | 7 `storekit_cancelled` rows | Firestore `Macra-purchase-logs.failureReason` | Fresh through read time; no July 5 rows yet |
| Checkout failure / purchase failure | 2 `storekit_purchase_failed` rows | Firestore `Macra-purchase-logs.failureReason` | Fresh through read time; no July 5 rows yet |
| Successful/trial-success rows | 0 successful rows, 0 trial-success rows | Firestore `Macra-purchase-logs` | Fresh through read time; no July 5 rows yet |
| Purchase-log plan mix | 7 annual/year rows, 2 monthly/month rows | Firestore `Macra-purchase-logs.plan` | Fresh through read time; no July 5 rows yet |

User-state guardrail hints from Firestore `users`, rolling window `2026-07-01` through `2026-07-05`:

| Guardrail | Current status | Source | Freshness |
| --- | --- | --- | --- |
| Under-18 blocks | 0 rows with explicit `age < 18` in the read | Firestore `users`, `registrationEntryPoint == "macra"` | Field availability limited |
| Missing-birthdate blocks / missing birthdate coverage | 63 rolling Macra user rows without a birthdate field detected | Firestore `users`, `registrationEntryPoint == "macra"` | Fresh through read time |
| Retargeting pressure | 0 rolling rows with detected retargeting-send fields in the summary read | Firestore `users` retargeting fields | Field availability limited |
| Trial activation after start | 55 rolling rows with trial-like field text detected; not a verified trial-start count | Firestore `users`; text scan only | Not decision-grade |
| Paid conversion after trial | 1 rolling row with paid/subscription-like field text detected; not a verified paid conversion count | Firestore `users`; text scan only | Not decision-grade |

Cancel-reason guardrails from Firestore `Macrafeedbackreason`, rolling window `2026-07-01` through `2026-07-05`:

| Field | Value | Source |
| --- | --- | --- |
| Total recent cancel-feedback rows | 2 | Firestore `Macrafeedbackreason` |
| Date coverage in rolling read | `2026-07-02`: 1 row; `2026-07-04`: 1 row | Firestore `Macrafeedbackreason` |
| Top reasons | `I'm not ready yet`: 1; `I wanted a different plan`: 1 | Firestore `Macrafeedbackreason.reasonLabel` / `reason` |
| Trigger | `storekit_cancelled`: 2 | Firestore `Macrafeedbackreason.trigger` |
| Source | `subscription_required`: 2 | Firestore `Macrafeedbackreason.source` |
| Plan | `month`: 1; `year`: 1 | Firestore `Macrafeedbackreason.selectedPlanPeriod` / `selectedPlanId` |

AppsFlyer coverage guardrail:

- No AppsFlyer aggregate-period doc covers `2026-07-05`.
- No raw AppsFlyer rows were found for `eventDate >= 2026-07-01` and `eventDate <= 2026-07-05`.
- Latest persisted aggregate period ends `2026-06-27`.

### Inference

The guardrail posture is not safe for a funnel change. Rolling first-party logs still show cancellation pressure with no verified trial-success rows, cancel feedback remains trust/fit oriented, missing-birthdate coverage limits eligibility confidence, and AppsFlyer attribution is stale. The system should refresh experiment and AppsFlyer coverage before scaling or changing the funnel.

## Operator-Facing Update

Recorded operator-facing update for this snapshot:

> Macra Update - 2026-07-05: This is a pre-day snapshot taken at 2026-07-04 20:19:49 EDT, so July 5 target-day rows are not yet observable. Scoreboard / AppsFlyer coverage is still stale through `2026-06-27`, while `/admin/experiments` still shows active `variant_a` from config but only a `2026-06-25` mostly-inferred result snapshot. Rolling first-party evidence shows 9 purchase-log rows from July 1-4, including 7 StoreKit cancels and 2 purchase failures, plus 2 cancel-feedback rows. Recommendation: refresh/backfill active `variant_a` experiment results before making any funnel decision.

Posting status: recorded in this artifact during execution. External PulseCommand posting is handled in the review/validation step if required by the operator workflow.

## Decision-Log Recommendation

- **Owner:** Nora
- **Recommendation:** Refresh active `variant_a` experiment results before making funnel decisions.
- **Evidence:** `docs/ops/macra-operating-snapshot-2026-07-05.md`; `/admin/experiments`; Firestore `macra-experiments/macra_paywall_onboarding`; Firestore `macra-experiment-results/macra_paywall_onboarding` generated at `2026-06-25T10:08:00.102Z`; Firestore `appsflyer-aggregate-periods/macra_2026-06-21_2026-06-27`; Firestore `Macra-purchase-logs`; Firestore `Macrafeedbackreason`.
- **Expected metric movement:** experiment decision quality.
- **Guardrail:** no onboarding/paywall/pricing/allocation/retargeting/Apple Search Ads changes while `/admin/experiments` is stale, mostly inferred, or not decision-grade.
- **Decision-log impact:** appended the July 5 Nora recommendation to `.agent/macra/decisions.md` during this execution step after this snapshot was created.
