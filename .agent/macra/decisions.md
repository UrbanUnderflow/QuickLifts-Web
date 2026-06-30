# Macra Decision Log

| Date | Owner | Decision | Evidence | Metric Expected To Move | Guardrail |
| --- | --- | --- | --- | --- | --- |
| 2026-06-29 | Nora | Put agents into observe, recommend, decide, log posture before changing the funnel. | AppsFlyer aggregate report, saved Macra Scoreboard, stale `/admin/experiments` snapshot. | Qualified onboarding start to trial start. | Avoid random funnel changes while trial-start signal is early. |
| 2026-06-29 | Nora | First operational task is refreshing/backfilling `/admin/experiments` results for active `variant_a`. | Experiment results snapshot is stale from 2026-06-16 and reflects retired hard-paywall configuration. | Experiment decision quality. | Do not decide from stale variant data. |
| 2026-06-30 | Solara | Proposed-only for 72-hour validation: test one paywall copy change that makes the first-week Macra experience concrete before checkout. No live change without Nora approval. | Firestore `Macrafeedbackreason`: 69 production cancel-feedback rows, led by price, not ready, need proof, something did not work, and Apple sheet confusion; Firestore `Macra-purchase-logs`: 306 rows with 161 canceled, 110 attempted, 21 failed, 14 success; saved paywall funnel: 317 CTA presses to 94 checkouts to 5 trials; retargeting config enabled but latest scan sent 0. | Paywall primary CTA to initiated checkout rate. | StoreKit purchase cancel count and `paywall_cancel_feedback` volume do not rise during the 72-hour validation window. |
| 2026-06-30 | Nora | Do not change onboarding, paywall, pricing, experiment allocation, retargeting behavior, or Apple Search Ads spend during the 72-hour signal validation window. | `docs/ops/macra-operating-snapshot-2026-06-30.md`: AppsFlyer/Scoreboard coverage ends 2026-06-25; purchase logs only confirm 2 trial-success rows on 2026-06-29; experiment results generated 2026-06-25 and mostly inferred. | Qualified onboarding start to trial start. | Checkout / purchase cancel pressure and stale-source risk. |

## Entry Format

Use one row per decision or proposed decision. Keep rejected decisions too, with the reason they were rejected.
