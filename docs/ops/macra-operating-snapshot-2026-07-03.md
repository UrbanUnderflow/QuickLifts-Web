# Macra Operating Snapshot - 2026-07-03

## Context

- **Operating system:** Macra Trial-Start Operating System
- **Snapshot date:** 2026-07-03
- **Status:** Scaffold created; source values pending follow-up population.
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

Pending read-only refresh from `/admin/emailSequences`, `/admin/purchaseLogs`, and AppsFlyer imports.

| Metric | Count | Source | Freshness |
| --- | ---: | --- | --- |
| Qualified onboarding starts | Pending | `/admin/emailSequences`, AppsFlyer imports | Pending |
| Paywall reached | Pending | `/admin/emailSequences`, AppsFlyer imports | Pending |
| Paywall CTA pressed | Pending | `/admin/emailSequences`, AppsFlyer imports | Pending |
| Checkout starts | Pending | `/admin/purchaseLogs`, AppsFlyer imports | Pending |
| Trial starts | Pending | `/admin/purchaseLogs`, AppsFlyer imports | Pending |
| Purchases / subscribes | Pending | `/admin/purchaseLogs`, AppsFlyer imports | Pending |
| Purchase cancels / failures | Pending | `/admin/purchaseLogs`, AppsFlyer imports | Pending |

### Inference

Pending. Do not infer a fresh funnel trend until Scoreboard, purchase-log, and AppsFlyer coverage are reconciled.

## Source Split

### Observed Facts

Pending read-only refresh from AppsFlyer imports and user-level attribution where available.

| Source | Starts | Checkout starts | Trial starts | Purchase cancels | Start-to-trial | Checkout-to-trial | Freshness |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Apple Search Ads | Pending | Pending | Pending | Pending | Pending | Pending | Pending |
| Organic | Pending | Pending | Pending | Pending | Pending | Pending | Pending |
| Retargeting | Pending | Pending | Pending | Pending | Pending | Pending | Pending |
| Other / unknown | Pending | Pending | Pending | Pending | Pending | Pending | Pending |

### Inference

Pending. Do not change Apple Search Ads spend, organic assumptions, or retargeting behavior until the source split is refreshed and attribution coverage is clear.

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
