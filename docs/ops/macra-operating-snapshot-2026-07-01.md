# Macra Operating Snapshot — 2026-07-01

## Context

- **Operating system:** Macra Trial-Start Operating System
- **Snapshot date:** 2026-07-01
- **Status:** Scaffold created for Step 1; refreshed data population is pending in later steps.
- **Primary metric:** qualified onboarding start to trial start
- **Primary guardrail:** no onboarding/paywall changes while experiment data is stale
- **Default posture:** refresh active `variant_a` experiment results before making funnel decisions.

Source surfaces to refresh in later steps:

- Macra Scoreboard: `/admin/emailSequences`
- Experiment surface: `/admin/experiments`
- Purchase logs: `/admin/purchaseLogs` and `/admin/macraPurchaseLogs`
- Cancel reasons: `/admin/macraCancelReasons`
- AppsFlyer imports: `appsflyer-scoreboards/macra`, `appsflyer-aggregate-periods`, `appsflyer-macra-raw-rows`, `appsflyer-macra-users`
- User / retargeting state: `users.macraEmailSequenceState`

## Funnel Counts

### Observed Facts

Pending Step 2 refresh from `/admin/emailSequences`, AppsFlyer imports, purchase logs, and user state.

Required fields to populate:

| Metric | Count | Source | Freshness |
| --- | ---: | --- | --- |
| Qualified onboarding starts | Pending | Pending | Pending |
| Paywall reached | Pending | Pending | Pending |
| Paywall CTA pressed | Pending | Pending | Pending |
| Checkout starts | Pending | Pending | Pending |
| Trial starts | Pending | Pending | Pending |
| Purchases / subscribes | Pending | Pending | Pending |
| Purchase cancels / failures | Pending | Pending | Pending |

### Inference

Pending. Do not infer funnel health until the refreshed read is complete.

## Source Split

### Observed Facts

Pending Step 2 refresh from AppsFlyer and the Macra Scoreboard.

Required source rows:

| Source | Starts | Checkout starts | Trial starts | Purchase cancels | Start-to-trial | Checkout-to-trial | Freshness |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Apple Search Ads | Pending | Pending | Pending | Pending | Pending | Pending | Pending |
| Organic | Pending | Pending | Pending | Pending | Pending | Pending | Pending |
| Retargeting | Pending | Pending | Pending | Pending | Pending | Pending | Pending |
| Other / unknown | Pending | Pending | Pending | Pending | Pending | Pending | Pending |

### Inference

Pending. Keep Apple Search Ads and Organic separated; do not make acquisition decisions from blended source data.

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

Pending Step 2 refresh.

Required guardrail rows:

| Guardrail | Current status | Source | Freshness |
| --- | --- | --- | --- |
| Apple purchase cancels | Pending | `Macra-purchase-logs`, AppsFlyer cancel events | Pending |
| Checkout failure / checkout cancel rate | Pending | `Macra-purchase-logs` | Pending |
| Under-18 blocks | Pending | `users.macraEmailSequenceState`, checkout/web-offer state | Pending |
| Missing-birthdate blocks | Pending | `users.macraEmailSequenceState`, checkout/web-offer state | Pending |
| Trial activation after start | Pending | user state / retargeting state | Pending |
| Paid conversion after trial | Pending | purchase logs, AppsFlyer purchase/subscribe events | Pending |
| Cancel reasons: price / not ready / need proof / something broke | Pending | `Macrafeedbackreason` | Pending |

### Inference

Pending. If any guardrail is broken, pause funnel-change recommendations and record the blocker before proposing growth changes.

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
