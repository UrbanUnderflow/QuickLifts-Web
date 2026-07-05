# Macra ASA Quality Read: Event Semantics and Trust Guardrails

## Question

How should Macra interpret the Apple Search Ads versus organic trial-start signal after auditing event semantics and trust guardrails, and should paid acquisition focus increase, hold, or refine before scaling?

## Data Date Range

- **Read timestamp:** `2026-07-04T00:15:45.769Z` from `docs/ops/macra-operating-snapshot-2026-07-04.md`.
- **Runtime caveat:** the July 4 snapshot notes the source runtime was still `2026-07-03` in `America/New_York`; treat July 4 target-date counts as early or unverified unless a source explicitly contains July 4 rows.
- **Latest Scoreboard / AppsFlyer import reference:** Firestore `appsflyer-scoreboards/macra`, latest Scoreboard run id `macra-appsflyer-csv-period-1782550099524-6ebef9b5`; Scoreboard `updatedAt` and `importedAt` are both `2026-06-27T08:48:20.605Z`.
- **Latest persisted AppsFlyer aggregate period:** Firestore `appsflyer-aggregate-periods/macra_2026-06-21_2026-06-27`; the period ends `2026-06-27` and is stale for July 4 decisioning.
- **Fresh July 4 source-attribution availability:** no Firestore `appsflyer-aggregate-periods` doc covers `2026-07-04`, and Firestore `appsflyer-macra-raw-rows` returned `0` rows for `eventDate >= 2026-06-30` and `eventDate <= 2026-07-04`.
- **Saved ASA versus Organic source-quality baseline used until fresh attribution exists:** `2026-05-27` through `2026-06-25`, from `.agent/macra/state.json`, `docs/research/macra-asa-quality-2026-06-25.md`, and `docs/research/macra-asa-quality-2026-06-30.md`.

## Source Inputs

- **Macra Scoreboard surface:** `/admin/emailSequences`; Firestore `appsflyer-scoreboards/macra`.
- **Exact AppsFlyer Scoreboard export/import reference:** Firestore `appsflyer-aggregate-periods/macra_2026-06-21_2026-06-27`, connected to Scoreboard run id `macra-appsflyer-csv-period-1782550099524-6ebef9b5`; source artifact is the latest persisted aggregate CSV import, with no July 4 aggregate or raw-row coverage.
- **Scoreboard source-level funnel metrics reference:** the saved Apple Search Ads versus Organic source split in `docs/research/macra-asa-quality-2026-06-25.md`, `docs/research/macra-asa-quality-2026-06-30.md`, and `.agent/macra/state.json`. This saved split has Apple Search Ads at `127` starts, `15` `af_initiated_checkout`, `3` trial starts, `9` cancels, `2.4%` start-to-trial, and `20.0%` checkout-to-trial; Organic at `406` starts, `79` `af_initiated_checkout`, `2` trial starts, `65` cancels, `0.5%` start-to-trial, and `2.5%` checkout-to-trial.
- **Active `variant_a` context:** Firestore `macra-experiments/macra_paywall_onboarding` has active intended variant `variant_a`, weight `100`, label `Monthly + annual, both with trial`; retired variants `baseline`, `variant_b`, and `variant_c` are each weight `0`. Source: `docs/ops/macra-operating-snapshot-2026-07-04.md`.
- **Experiment freshness caveat:** the July 4 snapshot says the experiment is no longer the old `2026-06-16` retired hard-paywall read, but it is still not decision-grade: Firestore `macra-experiment-results/macra_paywall_onboarding` was generated `2026-06-25T10:08:00.102Z`, has quality label `Mostly inferred assignments`, and depends on AppsFlyer aggregate validation that is not refreshed past `2026-06-27`.
- **Sample-size labels for the source-quality read:** Apple Search Ads = `Low sample: 3 trials`; Organic = `Low sample: 2 trials`; total saved source-split trial-start sample = `5` trials.

## Event Semantics Audit

_To be populated with event definitions and mismatch flags for `starts`, `af_initiated_checkout`, `trial starts`, `cancels`, `purchases`, and `subscribes` across AppsFlyer, Scoreboard, and purchase logs._

## Trust Guardrails

_To be populated with available guardrail reads for purchase cancels, checkout failure/cancel pressure, age or birthdate blocks, trial activation, paid conversion after trial, and cancel reasons._

## ASA vs Organic Funnel Table

_To be populated with the two-row Apple Search Ads versus Organic table and computed source-quality rates._

## Recommendation

_To be populated with exactly one recommendation of `increase`, `hold`, or `refine`, tied to funnel quality and trust guardrail status._

## Sources

_To be populated with the exact source artifacts used for the audit and recommendation._
