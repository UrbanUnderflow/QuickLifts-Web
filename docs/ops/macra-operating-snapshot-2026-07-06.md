# Macra Operating Snapshot - 2026-07-06

## Context

- **Operating system:** Macra Trial-Start Operating System
- **Snapshot date:** 2026-07-06
- **Read timestamp:** Pending source read in the population step.
- **Operating-time note:** Scaffold created before source refresh. Do not treat any section below as observed July 6 performance until the source-read step records exact Firestore/admin evidence and timestamps.
- **Primary metric:** qualified onboarding start to trial start
- **Primary guardrail:** no onboarding/paywall/pricing/allocation/retargeting/Apple Search Ads changes while experiment data is stale, mostly inferred, or not decision-grade.
- **Default posture:** refresh active `variant_a` experiment results before making funnel decisions.

Source surfaces to read:

- Macra Scoreboard: `/admin/emailSequences`; Firestore `appsflyer-scoreboards/macra`
- AppsFlyer imports: Firestore `appsflyer-aggregate-periods`, `appsflyer-macra-raw-rows`, `appsflyer-macra-users`
- Purchase logs: `/admin/purchaseLogs`, `/admin/macraPurchaseLogs`; Firestore `Macra-purchase-logs`
- Experiments: `/admin/experiments`; Firestore `macra-experiments/macra_paywall_onboarding`, `macra-experiment-results/macra_paywall_onboarding`
- Cancel reasons: `/admin/macraCancelReasons`; Firestore `Macrafeedbackreason`
- User / retargeting state: Firestore `users` where `registrationEntryPoint == "macra"` plus Macra retargeting fields used by `/admin/emailSequences`

## Funnel Counts

### Observed Facts

Pending source read.

Required rows for the population step:

| Metric | Count | Source | Freshness |
| --- | ---: | --- | --- |
| Onboarding starts | Pending | `/admin/emailSequences`; AppsFlyer imports; Firestore user-state cross-check | Pending |
| Paywall reach | Pending | `/admin/emailSequences`; AppsFlyer imports | Pending |
| Paywall CTA | Pending | `/admin/emailSequences`; AppsFlyer imports | Pending |
| Checkout starts | Pending | AppsFlyer checkout event bucket; purchase-log cross-check | Pending |
| Trial starts | Pending | AppsFlyer trial event bucket; purchase-log trial-success cross-check | Pending |
| Purchases | Pending | AppsFlyer purchase event bucket; Firestore `Macra-purchase-logs` | Pending |
| Subscribes | Pending | AppsFlyer subscribe event bucket; Firestore `Macra-purchase-logs` | Pending |
| Purchase cancels / failures | Pending | AppsFlyer cancel/failure events; Firestore `Macra-purchase-logs` | Pending |

### Inference

Pending source read. Do not infer July 6 funnel movement until AppsFlyer coverage, purchase logs, and user-state reads are populated with exact timestamps.

## Source Split

### Observed Facts

Pending source read.

Required rows for the population step:

| Source | Onboarding starts | Checkout starts | Trial starts | Purchases / subscribes | Freshness | Evidence |
| --- | ---: | ---: | ---: | ---: | --- | --- |
| Apple Search Ads | Pending | Pending | Pending | Pending | Pending | AppsFlyer media-source split if available |
| Organic | Pending | Pending | Pending | Pending | Pending | AppsFlyer media-source split if available |
| Retargeting / lifecycle | Pending | Pending | Pending | Pending | Pending | Retargeting state and email-sequence fields if available |
| Other / unknown | Pending | Pending | Pending | Pending | Pending | User-state and AppsFlyer fallback attribution |

### Inference

Pending source read. If AppsFlyer attribution does not cover 2026-07-06, mark paid-vs-organic source quality as unverified and carry only the latest stale split with a stale label.

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
