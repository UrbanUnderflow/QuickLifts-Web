# Macra Operating Snapshot - 2026-07-04

## Context

- **Operating system:** Macra Trial-Start Operating System
- **Snapshot date:** 2026-07-04
- **Read timestamp:** `2026-07-04T00:15:45.769Z`
- **Runtime note:** Source runtime is still 2026-07-03 America/New_York, so July 4 is not fully observable yet. Treat target-date counts as early/unverified unless the source explicitly contains July 4 rows.
- **Primary metric:** qualified onboarding start to trial start
- **Primary guardrail:** no onboarding/paywall/pricing/allocation/retargeting/Apple Search Ads changes while experiment data is stale or not decision-grade.
- **Default posture:** refresh active `variant_a` experiment results before making funnel decisions.

Source surfaces read:

- Macra Scoreboard: `/admin/emailSequences`; Firestore `appsflyer-scoreboards/macra`
- AppsFlyer imports: Firestore `appsflyer-aggregate-periods`, `appsflyer-macra-raw-rows`, `appsflyer-macra-users`
- Purchase logs: `/admin/purchaseLogs`, `/admin/macraPurchaseLogs`; Firestore `Macra-purchase-logs`
- Experiments: `/admin/experiments`; Firestore `macra-experiments/macra_paywall_onboarding`, `macra-experiment-results/macra_paywall_onboarding`
- Cancel reasons: `/admin/macraCancelReasons`; Firestore `Macrafeedbackreason`
- User / retargeting state: Firestore `users`

## Funnel Counts

### Observed Facts

Scoreboard / AppsFlyer import freshness:

- Firestore `appsflyer-scoreboards/macra` exists.
- Scoreboard `updatedAt`: `2026-06-27T08:48:20.605Z`.
- Scoreboard `importedAt`: `2026-06-27T08:48:20.605Z`.
- Latest Scoreboard run id visible in Firestore: `macra-appsflyer-csv-period-1782550099524-6ebef9b5`.
- Firestore `appsflyer-aggregate-periods` returned `20` Macra docs.
- Latest aggregate-period doc found: `appsflyer-aggregate-periods/macra_2026-06-21_2026-06-27`.
- No Firestore `appsflyer-aggregate-periods` doc covers `2026-07-04`.
- Firestore `appsflyer-macra-raw-rows` returned `0` rows for `eventDate >= 2026-06-30` and `eventDate <= 2026-07-04`.

Latest persisted AppsFlyer full-funnel aggregate, not fresh for July 4:

| Metric | Count | Source | Freshness |
| --- | ---: | --- | --- |
| Macra onboarding starts | 826 | Firestore `appsflyer-aggregate-periods/macra_2026-06-21_2026-06-27`, `summary.events.byName.macra_onboarding_started` | Stale for July 4; period ends `2026-06-27` |
| Paywall reached | 1015 | Firestore `appsflyer-aggregate-periods/macra_2026-06-21_2026-06-27`, paywall event bucket used by `/admin/emailSequences` | Stale for July 4; period ends `2026-06-27` |
| Paywall CTA pressed | 1553 | Firestore `appsflyer-aggregate-periods/macra_2026-06-21_2026-06-27`, CTA event bucket used by `/admin/emailSequences` | Stale for July 4; period ends `2026-06-27` |
| Checkout starts | 143 `af_initiated_checkout`; 93 `macra_subscription_web_checkout_started` | Firestore `appsflyer-aggregate-periods/macra_2026-06-21_2026-06-27`, `summary.events.byName` | Stale for July 4; do not add these without person-level dedupe |
| Trial starts | 6 | Firestore `appsflyer-aggregate-periods/macra_2026-06-21_2026-06-27`, trial event bucket used by `/admin/emailSequences` | Stale for July 4; period ends `2026-06-27` |
| Purchases / subscribes | 3 purchases; 3 subscribes | Firestore `appsflyer-aggregate-periods/macra_2026-06-21_2026-06-27`, purchase event bucket used by `/admin/emailSequences` | Stale for July 4; period ends `2026-06-27` |
| Purchase cancels / failures | 112 purchase cancels; 13 purchase failures; 2 web checkout failures | Firestore `appsflyer-aggregate-periods/macra_2026-06-21_2026-06-27`, `summary.events.byName` | Stale for July 4; period ends `2026-06-27` |

Fresh lower-funnel purchase-log read from Firestore `Macra-purchase-logs`:

| Date | Purchase-log rows | Trial-success rows | Successful rows | Canceled rows | Failed rows | Attempted rows | Source |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 2026-06-30 | 4 | 2 | 2 | 1 | 0 | 1 | Firestore `Macra-purchase-logs` |
| 2026-07-01 | 2 | 0 | 0 | 2 | 0 | 0 | Firestore `Macra-purchase-logs` |
| 2026-07-02 | 6 | 0 | 0 | 4 | 2 | 0 | Firestore `Macra-purchase-logs` |
| 2026-07-03 | 0 | 0 | 0 | 0 | 0 | 0 | Firestore `Macra-purchase-logs` |
| 2026-07-04 | 0 | 0 | 0 | 0 | 0 | 0 | Firestore `Macra-purchase-logs`; target date not fully observable at runtime |

Fresh user-state read from Firestore `users` where `registrationEntryPoint == "macra"`:

| Date | Macra user docs created | Completed onboarding rows | User-source hints |
| --- | ---: | ---: | --- |
| 2026-06-30 | 18 | 17 | Missing on all 18 rows |
| 2026-07-01 | 22 | 17 | Missing on all 22 rows |
| 2026-07-02 | 23 | 19 | Missing on all 23 rows |
| 2026-07-03 | 8 | 5 | Missing on all 8 rows |
| 2026-07-04 | 0 | 0 | No rows at read time |

Fresh AppsFlyer rows in the July 4 target window:

| Date | Aggregate-period row | Raw rows | AppsFlyer starts | AppsFlyer checkout starts | AppsFlyer trial starts | AppsFlyer purchases |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| 2026-07-04 | Missing | 0 | Unverified | Unverified | Unverified | Unverified |

### Inference

The July 4 full funnel is not refreshed because Scoreboard / AppsFlyer coverage stops at `2026-06-27`, and July 4 has no raw rows, purchase-log rows, or user rows at the read time. The most recent fresh first-party movement is July 3 user-state activity: `8` Macra user docs created and `5` completed onboarding rows. That is not enough to make a source-quality or funnel-change decision.

## Source Split

### Observed Facts

Fresh acquisition-source split is unavailable for July 4 because Firestore `appsflyer-aggregate-periods` has no doc covering `2026-07-04`, Firestore `appsflyer-macra-raw-rows` returned `0` rows for the rolling target window, and Firestore `users` has no usable source hints for fresh Macra user rows.

Latest available AppsFlyer aggregate event-volume split:

| Aggregate period | Organic event volume | Apple Search Ads event volume | Source |
| --- | ---: | ---: | --- |
| `2026-06-21` through `2026-06-27` | 24167 | 6652 | Firestore `appsflyer-aggregate-periods/macra_2026-06-21_2026-06-27`, `summary.events.byMediaSource` |

Fresh purchase-log source field split, lower-funnel surface only:

| Date window | `subscription_required` rows | `onboarding_paywall` rows | Apple Search Ads | Organic | Retargeting | Notes |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| `2026-06-30` through `2026-07-04` | 5 | 7 | 0 attributed | 0 attributed | 0 attributed | Purchase-log `source` names paywall surface, not acquisition source |
| `2026-07-04` only | 0 | 0 | 0 attributed | 0 attributed | 0 attributed | No July 4 purchase-log rows at read time |

Fresh user-source hints:

| Date | Macra user docs created | Source hint status | Source |
| --- | ---: | --- | --- |
| 2026-06-30 | 18 | All missing | Firestore `users`, `registrationEntryPoint == "macra"` |
| 2026-07-01 | 22 | All missing | Firestore `users`, `registrationEntryPoint == "macra"` |
| 2026-07-02 | 23 | All missing | Firestore `users`, `registrationEntryPoint == "macra"` |
| 2026-07-03 | 8 | All missing | Firestore `users`, `registrationEntryPoint == "macra"` |
| 2026-07-04 | 0 | No rows at read time | Firestore `users`, `registrationEntryPoint == "macra"` |

### Inference

The source split is not decision-grade for July 4. The latest stale AppsFlyer aggregate still shows Organic carrying most event volume and Apple Search Ads carrying the smaller paid bucket through `2026-06-27`, but there is no fresh July 4 Apple Search Ads vs Organic trial-start read. Do not change Apple Search Ads spend, organic assumptions, or retargeting behavior from this snapshot.

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

The experiment snapshot is no longer the old `2026-06-16` retired hard-paywall read, but it is still not fresh enough for July 4 funnel decisions. The saved result was generated `2026-06-25`, uses mostly inferred assignments, and depends on AppsFlyer aggregate validation that is not refreshed past `2026-06-27`. First operating action remains refreshing/backfilling active `variant_a` results before approving onboarding, paywall, pricing, allocation, retargeting, or Apple Search Ads changes.

## Guardrails

### Observed Facts

Purchase-log guardrails from Firestore `Macra-purchase-logs`, rolling window `2026-06-30` through `2026-07-04`:

| Guardrail | Current status | Source | Freshness |
| --- | --- | --- | --- |
| Apple purchase cancels / StoreKit cancels | 7 `storekit_cancelled` rows | Firestore `Macra-purchase-logs.failureReason` | Fresh through read time; no July 4 rows yet |
| Checkout failure / purchase failure | 2 `storekit_purchase_failed` rows | Firestore `Macra-purchase-logs.failureReason` | Fresh through read time; no July 4 rows yet |
| Successful/trial-success rows | 2 successful rows, both trial-success rows, all on 2026-06-30 | Firestore `Macra-purchase-logs` | Fresh through read time; no July 4 rows yet |
| Purchase-log plan mix | 9 annual/year rows, 2 monthly/month rows, 1 unknown row | Firestore `Macra-purchase-logs.plan` | Fresh through read time; no July 4 rows yet |

User-state guardrail hints from Firestore `users`, rolling window `2026-06-30` through `2026-07-04`:

| Guardrail | Current status | Source | Freshness |
| --- | --- | --- | --- |
| Under-18 blocks | 0 rows with explicit `age < 18` in the read | Firestore `users`, `registrationEntryPoint == "macra"` | Field availability limited |
| Missing-birthdate blocks / missing birthdate coverage | 71 rolling Macra user rows without a birthdate field detected | Firestore `users`, `registrationEntryPoint == "macra"` | Fresh through read time |
| Retargeting pressure | 0 rolling rows with detected retargeting-send fields in the summary read | Firestore `users` retargeting fields | Field availability limited |
| Trial activation after start | 0 rolling rows with detected trial-start activation fields in the summary read | Firestore `users`; purchase-log cross-check | Field availability limited |
| Paid conversion after trial | 0 rolling rows with detected paid/subscription fields in the summary read | Firestore `users`; purchase-log cross-check | Field availability limited |

Cancel-reason guardrails from Firestore `Macrafeedbackreason`, rolling window `2026-06-30` through `2026-07-04`:

| Field | Value | Source |
| --- | --- | --- |
| Total recent cancel-feedback rows | 1 | Firestore `Macrafeedbackreason` |
| Date coverage in rolling read | `2026-07-02`: 1 row | Firestore `Macrafeedbackreason` |
| Top reason | `I'm not ready yet`: 1 | Firestore `Macrafeedbackreason.reasonLabel` / `reason` |
| Trigger | `storekit_cancelled`: 1 | Firestore `Macrafeedbackreason.trigger` |
| Source | `subscription_required`: 1 | Firestore `Macrafeedbackreason.source` |
| Plan | `year`: 1 | Firestore `Macrafeedbackreason.selectedPlanPeriod` / `selectedPlanId` |

AppsFlyer coverage guardrail:

- No AppsFlyer aggregate-period doc covers `2026-07-04`.
- No raw AppsFlyer rows were found for `eventDate >= 2026-06-30` and `eventDate <= 2026-07-04`.
- Latest persisted aggregate period ends `2026-06-27`.

### Inference

The strongest current guardrail signal is still trust/checkout friction, not scale readiness: recent first-party purchase logs show more cancels/failures than successes in the rolling window, while AppsFlyer attribution is stale and July 4 is not observable yet. Missing birthdate coverage is also a measurement gap for eligibility guardrails. Do not scale acquisition or make funnel changes until AppsFlyer coverage and experiment results are refreshed.

## Paywall Dismissal And Cancel Signals

### Observed Facts

This section isolates the lifecycle/copy/proof/offer inputs from the broader guardrail table so the snapshot can support exactly one proposed lifecycle intervention.

| Signal | Current read | Source | Freshness |
| --- | --- | --- | --- |
| StoreKit / purchase cancels | 7 `storekit_cancelled` rows in the `2026-06-30` through `2026-07-04` rolling read | Firestore `Macra-purchase-logs.failureReason` | Fresh through read time; no July 4 rows yet |
| Purchase failures | 2 `storekit_purchase_failed` rows in the rolling read | Firestore `Macra-purchase-logs.failureReason` | Fresh through read time; no July 4 rows yet |
| Cancel-feedback volume | 1 recent cancel-feedback row in the rolling read | Firestore `Macrafeedbackreason` | Fresh through read time; no July 4 rows yet |
| Top cancel reason | `I'm not ready yet`: 1 | Firestore `Macrafeedbackreason.reasonLabel` / `reason` | Thin sample; treat as directional only |
| Cancel trigger | `storekit_cancelled`: 1 | Firestore `Macrafeedbackreason.trigger` | Thin sample; treat as directional only |
| Cancel source | `subscription_required`: 1 | Firestore `Macrafeedbackreason.source` | Thin sample; treat as directional only |
| Plan context | `year`: 1 | Firestore `Macrafeedbackreason.selectedPlanPeriod` / `selectedPlanId` | Thin sample; treat as directional only |

### Inference

The current lifecycle signal is too thin for a live paywall or offer change, but it is enough to shape a proposed-only intervention lane. The strongest observed pattern is hesitation/trust at the purchase boundary: StoreKit cancels dominate recent purchase-log friction, and the only recent cancel-feedback reason is "I'm not ready yet." The execution steps should therefore prefer one reassurance/proof-oriented lifecycle copy proposal over a pricing or acquisition change, and keep it proposed-only while experiment results and AppsFlyer coverage remain stale or not decision-grade.

## Operator-Facing Update

Recorded operator-facing update for this snapshot:

> Macra Update - 2026-07-04: July 4 is not fully observable from the current runtime. The Scoreboard/Appsflyer import is still stale through `2026-06-27`, with no July 4 aggregate or raw rows. First-party logs show no July 4 purchase rows yet, while the rolling window shows StoreKit cancel friction and one "I'm not ready yet" cancel reason. Recommendation frame: prepare exactly one reassurance/proof-oriented lifecycle copy proposal from paywall-dismissal and cancel evidence, but do not ship any live funnel change while experiment results and AppsFlyer coverage are stale or not decision-grade.

Posting status: recorded in this artifact during execution. No external operator message was sent in this step.

## Decision-Log Recommendation

- **Owner:** Nora
- **Recommendation:** Use cancel reasons and paywall dismissal behavior to propose one reassurance/proof-oriented lifecycle copy change at a time; keep it proposed-only until experiment results and AppsFlyer coverage are decision-grade.
- **Evidence:** `docs/ops/macra-operating-snapshot-2026-07-04.md`; `/admin/experiments`; Firestore `macra-experiment-results/macra_paywall_onboarding` generated at `2026-06-25T10:08:00.102Z`; Firestore `appsflyer-aggregate-periods/macra_2026-06-21_2026-06-27`; Firestore `Macra-purchase-logs`; Firestore `Macrafeedbackreason`.
- **Expected metric movement:** qualified onboarding start to trial start.
- **Guardrail:** no live funnel change if `/admin/experiments` is still stale or not decision-grade; StoreKit purchase cancels, checkout failures, and negative cancel-feedback volume must not rise.
- **Decision-log impact:** append the July 4 Nora recommendation to `.agent/macra/decisions.md` during the review/validation step after this snapshot is verified.
