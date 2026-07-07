# Macra Operating Read - 2026-07-07

Generated: `2026-07-07T11:54:03.689Z`

## Operator Summary

Macra is not decision-grade today: AppsFlyer/Scoreboard coverage ends 2026-06-27; import latest CSV before reading source quality.

Action: `refresh_data_first`

## Source Freshness

- Scoreboard coverage: 2026-05-23 through 2026-06-27
- Scoreboard imported: 2026-06-27T08:48:20.605Z
- Freshness: stale (10 day lag)
- Experiment: active variant_a; results generated 2026-06-25T10:08:00.102Z; quality Mostly inferred assignments; decision-grade no

## Latest AppsFlyer Funnel

Aggregate period: 2026-06-21 through 2026-06-27

| Metric | Count |
| --- | ---: |
| Onboarding starts | 826 |
| Paywall reached | 1001 |
| Paywall CTA pressed | 1553 |
| af_initiated_checkout | 143 |
| Web checkout started | 93 |
| Trial starts | 6 |
| Purchases | 3 |
| Subscribes | 3 |

Media-source event volume: Apple Search Ads: 6652, organic: 24167

## Rolling Lower Funnel (2026-07-01 through 2026-07-07)

- Purchase logs: 11
- Purchase statuses: {"success":1,"canceled":8,"failed":2}
- Cancel reasons: 2
- Cancel-reason mix: {"wrong_plan":1,"not_ready":1}
- Macra user docs: 74
- Completed onboarding rows: 53

## System Health

- PulseCommand push successes: 0
- PulseCommand push failures: 68
- Macra tasks by status: {"done":4,"needs-review":11}
- Stale active Macra tasks: 0

## Blockers

- AppsFlyer/Scoreboard coverage ends 2026-06-27; import latest CSV before reading source quality.
- Experiment results are not decision-grade (Mostly inferred assignments, generated 2026-06-25T10:08:00.102Z).
- PulseCommand push delivery is failing; check Firebase/APNs credentials for the iOS app.

## Recommended Next Steps

- Import the latest AppsFlyer CSV and refresh the Macra Scoreboard.
- Backfill `/admin/experiments` so `variant_a` results are current and not mostly inferred.
- Repair PulseCommand APNs/FCM credentials so operator updates reach the iPhone.
- Do not change onboarding, paywall, pricing, retargeting, or Apple Search Ads until the stale source blockers clear.

