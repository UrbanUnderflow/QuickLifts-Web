# Macra ASA Quality Read: Source Quality and Paid Acquisition Focus

## Question

How does Apple Search Ads compare with organic source quality on Macra trial-start conversion, and should paid acquisition focus increase, hold, or refine while the signal is still early?

## Data Date Range

- **Latest read-only Scoreboard check:** `2026-07-02T00:13:18Z`, from `docs/ops/macra-operating-snapshot-2026-07-02.md`.
- **Exact AppsFlyer Scoreboard aggregate CSV coverage window:** `2026-05-23` through `2026-06-25`, from Firestore `appsflyer-scoreboards/macra` as recorded in `docs/ops/macra-operating-snapshot-2026-06-30.md` and rechecked in `docs/ops/macra-operating-snapshot-2026-07-02.md`.
- **Latest saved source-split baseline used for Apple Search Ads versus organic:** `2026-05-27` through `2026-06-25`, from `.agent/macra/state.json` and the source-level funnel artifact `docs/research/macra-asa-quality-2026-06-25.md`.
- **Newest persisted AppsFlyer aggregate import checked:** `2026-06-21` through `2026-06-27`, Firestore `appsflyer-aggregate-periods/macra_2026-06-21_2026-06-27`, imported from `Aggregated performance report.csv`.
- **Target-window caveat:** `docs/ops/macra-operating-snapshot-2026-07-02.md` found no AppsFlyer aggregate-period docs covering `2026-06-29`, `2026-06-30`, `2026-07-01`, or `2026-07-02`, and Firestore `appsflyer-macra-raw-rows` returned `0` rows for that same window. This read cannot refresh source-level ASA versus organic movement beyond the saved baseline.

## Source Inputs

- **Scoreboard source-level funnel artifact:** Macra Scoreboard at `/admin/emailSequences` -> `scoreboard` tab, backed by Firestore `appsflyer-scoreboards/macra`, Firestore `appsflyer-aggregate-periods`, and the saved source-level funnel read in `docs/research/macra-asa-quality-2026-06-25.md`.
- **Latest available AppsFlyer / Scoreboard export references:** Firestore `appsflyer-scoreboards/macra` with aggregate CSV coverage `2026-05-23` through `2026-06-25`; latest visible Scoreboard run id `macra-appsflyer-csv-period-1782550099524-6ebef9b5`; Firestore `appsflyer-import-runs/macra-appsflyer-csv-period-1782550099524-6ebef9b5`, source `csv_upload`, import source `aggregate_csv_upload`, created `2026-06-27T08:48:20.136Z`, coverage `2026-06-21` through `2026-06-27`, rows `199`, events `30819`.
- **Newest aggregate-period artifact checked:** Firestore `appsflyer-aggregate-periods/macra_2026-06-21_2026-06-27`, imported from `Aggregated performance report.csv`; `docs/ops/macra-operating-snapshot-2026-07-02.md` records `trialStarts = 6`, `uploadedRows = 199`, and `excludedFromRangeRollups = false`.
- **ASA versus organic source split:** `docs/research/macra-asa-quality-2026-06-25.md`, `docs/agents/macra-operating-runbook.md`, and `.agent/macra/state.json` latest saved run, which preserve the saved Apple Search Ads versus organic split used for this June 30 read.
- **Cancel-reason source:** `/admin/macraCancelReasons`, backed by Firestore `Macrafeedbackreason`; `.agent/macra/decisions.md` records the 2026-06-30 Solara readout as `69` production cancel-feedback rows led by price, not ready, need proof, something did not work, and Apple sheet confusion.
- **Paywall dismissal source:** saved funnel drop-off between paywall reached, paywall CTA, `af_initiated_checkout`, and trial start from `.agent/macra/state.json`, `docs/ops/macra-operating-snapshot-2026-06-25.md`, and `docs/deliverables/macra-lifecycle-conversion-2026-06-30.md`; this source can quantify drop-off but does not identify every dismissal reason without linked cancel or purchase-log records.
- **Active experiment context:** `.agent/macra/state.json` records active `variant_a` as `monthly + annual, both with trial`.

## Access or Freshness Blockers

- The committed source-specific Apple Search Ads versus organic split is still based on only `5` total trial starts: `3` from Apple Search Ads and `2` from organic.
- Explicit source sample-size labels for this read: Apple Search Ads = `Low sample: 3 trials`; Organic = `Low sample: 2 trials`.
- The AppsFlyer / Scoreboard source coverage is stale for June 30 and July 2 decisioning: `docs/ops/macra-operating-snapshot-2026-07-02.md` says the Scoreboard aggregate CSV coverage ends `2026-06-25`, and no AppsFlyer aggregate-period or raw-row coverage confirms source-level funnel movement for `2026-06-29` through `2026-07-02`.
- The July 2 AppsFlyer pull refresh did not produce a newer artifact: `docs/ops/macra-appsflyer-refresh-attempt-2026-07-02.md` records `APPSFLYER_RAW_API_ACCESS_UNAVAILABLE`, AppsFlyer `400` responses because the current package does not include raw data reports, and no newer local aggregate CSV available for upload.
- The newest lower-funnel purchase-log signal can validate trial-success timing, but it does not cleanly attribute the latest successes to Apple Search Ads or organic in this document.
- `/admin/experiments` remains a stale-data risk for active `variant_a`: `.agent/macra/state.json` records that the saved `/admin/experiments` results snapshot is stale from `2026-06-16` and still reflects the retired hard-paywall configuration, so experiment output should not approve a live funnel, budget, or pricing move.

## ASA vs Organic Funnel Table

| Source | starts | af_initiated_checkout | trial starts | start-to-trial | checkout-to-trial | sample size label | data date range |
| --- | ---: | ---: | ---: | ---: | ---: | --- | --- |
| Apple Search Ads | 127 | 15 | 3 | 2.4% | 20.0% | Low sample: 3 trials | `2026-05-27` through `2026-06-25` saved source split |
| Organic | 406 | 79 | 2 | 0.5% | 2.5% | Low sample: 2 trials | `2026-05-27` through `2026-06-25` saved source split |

Calculation notes:
- `start-to-trial` = `trial starts / starts`.
- `checkout-to-trial` = `trial starts / af_initiated_checkout`.
- The latest two-success days are not used as source-specific evidence because purchase logs validated success timing but not acquisition source attribution.

## Source Quality Readout

- **Observed fact:** Firestore `Macrafeedbackreason` has `69` production cancel-feedback rows in the 2026-06-30 Solara readout, led by price, not ready, need proof, something did not work, and Apple sheet confusion. Source: `.agent/macra/decisions.md`; `/admin/macraCancelReasons`.
- **Observed fact:** The saved Scoreboard funnel drops from `448` paywall reaches to `317` paywall CTA presses to `94` initiated checkouts to `5` trial starts. That means the largest visible falloff is after CTA press but before trial start, not simply before the paywall CTA. Source: `.agent/macra/state.json`; `docs/ops/macra-operating-snapshot-2026-06-30.md`.
- **Observed fact:** Purchase logs remain a guardrail: the June 30 snapshot scanned `306` purchase-log rows, and the June 28 daily check found `3` canceled rows and `2` failed rows with `0` trial-success rows. Source: `docs/ops/macra-operating-snapshot-2026-06-30.md`; Firestore `Macra-purchase-logs`.
- **Inference:** The combined cancel and paywall-dropoff signal points first to copy/proof friction, not a price-cut test. Users are showing intent by pressing the CTA, but cancellation reasons still cluster around price, readiness, proof, breakage, and Apple sheet confusion, so the next test should make the first-week value and trial terms clearer before checkout.

## Paid Acquisition Posture

**Verdict: `hold` Apple Search Ads focus.**

One concrete reason: Apple Search Ads is materially stronger than organic on the saved source-quality baseline (`20.0%` checkout-to-trial and `2.4%` start-to-trial versus organic at `2.5%` and `0.5%`), but the evidence is only `3` Apple Search Ads trials from a stale source split and the newest two-success days are not source-attributed; increasing or refining spend before the signal survives refreshed, source-specific coverage would risk scaling an early attribution artifact.

Primary metric: qualified onboarding start to trial start, split by source.

Guardrail: Apple purchase cancels / checkout cancel pressure.

## Sources

- Firestore `appsflyer-aggregate-periods/macra_2026-06-21_2026-06-27`
- Firestore `Macra-purchase-logs`
- Firestore `Macrafeedbackreason`
- `/admin/macraCancelReasons`
- Firestore `macra-experiment-results/macra_paywall_onboarding`
- `docs/research/macra-asa-quality-2026-06-25.md`
- `.agent/macra/state.json`
- `.agent/macra/runbook.md`
