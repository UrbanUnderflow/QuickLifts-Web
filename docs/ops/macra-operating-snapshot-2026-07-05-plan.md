# Macra Operating Snapshot Plan - 2026-07-05

## Purpose

Plan the 2026-07-05 Macra daily operating snapshot before execution. Current runtime context is 2026-07-04 America/New_York, so this artifact defines the source map, query plan, freshness gates, decision-log frame, and validation checklist for the July 5 execution step without claiming July 5 observed outcomes yet.

This snapshot's decision-log recommendation is tied to: `Refresh active variant_a experiment results before making funnel decisions`.

## Required Output Artifact

- Target file: `docs/ops/macra-operating-snapshot-2026-07-05.md`
- Required sections:
  - `Funnel Counts`
  - `Source Split`
  - `Experiment Snapshot Freshness`
  - `Guardrails`
  - `Operator-Facing Update`
  - `Decision-Log Recommendation`
- Required decision-log follow-up: append a 2026-07-05 Nora row to `.agent/macra/decisions.md` during execution/validation, after the snapshot has source evidence.

## Source Surfaces

| Surface | Purpose | Evidence path / collection |
| --- | --- | --- |
| Macra Scoreboard | Topline AppsFlyer funnel and source coverage | `/admin/emailSequences`; Firestore `appsflyer-scoreboards/macra` |
| AppsFlyer aggregate periods | Persisted aggregate CSV coverage and event buckets | Firestore `appsflyer-aggregate-periods`, `product == "macra"` |
| AppsFlyer raw rows | Person/date-level import coverage where available | Firestore `appsflyer-macra-raw-rows` |
| AppsFlyer user attribution | User-level attribution and source hints where available | Firestore `appsflyer-macra-users` |
| Purchase logs | StoreKit/RevenueCat lower-funnel outcomes | `/admin/purchaseLogs`, `/admin/macraPurchaseLogs`; Firestore `Macra-purchase-logs` |
| Experiments | Active variant and saved result snapshot freshness | `/admin/experiments`; Firestore `macra-experiments/macra_paywall_onboarding`; Firestore `macra-experiment-results/macra_paywall_onboarding` |
| Cancel reasons | Paywall dismissal/cancel reason guardrails | `/admin/macraCancelReasons`; Firestore `Macrafeedbackreason` |
| User state / retargeting | Eligibility, onboarding completion, activation, and retargeting pressure | Firestore `users`; `users.macraEmailSequenceState`; retargeting fields used by `/admin/emailSequences` |

## Known Pre-Execution State

Observed in the July 4 snapshot:

- Latest persisted Scoreboard import run: `macra-appsflyer-csv-period-1782550099524-6ebef9b5`.
- Latest persisted AppsFlyer aggregate period: `appsflyer-aggregate-periods/macra_2026-06-21_2026-06-27`.
- AppsFlyer coverage was still not decision-grade for July 4: no aggregate-period doc covered `2026-07-04`, and raw rows returned `0` for the rolling target window.
- July 4 first-party user state had `2` Macra user docs and `1` completed onboarding row, but both rows had missing source hints.
- July 4 purchase logs had `0` rows at read time.
- `/admin/experiments` was no longer the old 2026-06-16 retired hard-paywall result, but the saved result snapshot was still generated `2026-06-25T10:08:00.102Z` with quality label `Mostly inferred assignments`.
- The July 5 execution must verify whether `/admin/experiments` has been refreshed again. If it has not, the first operating action remains refreshing/backfilling active `variant_a` before funnel decisions.

## Query Plan

Use the Firebase Admin SDK pattern from `.agent/workflows/firebase-admin.md` with `serviceAccountKey.json`. All reads are read-only unless the execution step explicitly posts an operator update or writes the decision log.

### 1. Scoreboard And AppsFlyer Coverage

Read:

- `appsflyer-scoreboards/macra`
- all `appsflyer-aggregate-periods` where `product == "macra"`
- `appsflyer-macra-raw-rows` with `eventDate >= "2026-07-01"` and `eventDate <= "2026-07-05"`

Record:

- Scoreboard `updatedAt` / `importedAt`
- latest import run id
- latest aggregate-period doc id, `periodStart`, `periodEnd`, `importedAt`
- whether any aggregate-period doc covers `2026-07-05`
- raw-row count for `2026-07-05`
- raw-row count for the rolling window `2026-07-01` through `2026-07-05`

Event buckets to report:

- onboarding starts: `macra_onboarding_started`
- paywall reach: `macra_onboarding_paywall_reached`, `macra_paywall_viewed_standalone`
- paywall CTA: the CTA event bucket used by `/admin/emailSequences`
- checkout starts: `af_initiated_checkout`, `macra_subscription_web_checkout_started`
- trial starts: `af_start_trial`, `start_trial`, `trial_started`, `macra_trial_started`
- purchases/subscribes: `af_purchase`, `af_subscribe`, `purchase`, `subscribe`, `macra_subscription_started`
- cancel/failure guardrails: `macra_subscription_purchase_cancelled`, `macra_subscription_purchase_failed`, `macra_subscription_web_checkout_failed`

Important: do not add `af_initiated_checkout` and `macra_subscription_web_checkout_started` as unique checkout users unless a person-level dedupe proves they are not overlapping.

### 2. Purchase Logs

Read Firestore `Macra-purchase-logs` for:

- Target date: `2026-07-05`
- Rolling window: `2026-07-01` through `2026-07-05`

Group by date and status:

- total rows
- `success`
- trial-success rows
- `canceled`
- `failed`
- `attempted`

Also group by purchase-log `source`, but label it lower-funnel surface source unless it clearly maps to acquisition source. Existing source values like `subscription_required` and `onboarding_paywall` are not Apple Search Ads or Organic attribution.

### 3. User State

Read Firestore `users` where `registrationEntryPoint == "macra"` and group rows by created date for the same rolling window.

Record:

- Macra user docs created
- completed onboarding rows
- source-hint coverage
- under-18 or missing-birthdate blockers if fields are available
- trial activation / paid conversion state if fields are available
- retargeting state fields where present

### 4. Experiment Freshness

Read:

- Firestore `macra-experiments/macra_paywall_onboarding`
- Firestore `macra-experiment-results/macra_paywall_onboarding`

Record:

- live active variant and weights
- whether `variant_a` is the active intended variant
- config updated timestamp
- result snapshot generated timestamp
- result quality label
- whether the result snapshot reflects active `variant_a`
- whether the result snapshot is still stale relative to the July 5 operating read
- whether it is still the old 2026-06-16 retired hard-paywall read

Decision gate:

- If the snapshot is missing, stale, mostly inferred, or not clearly refreshed to active `variant_a`, the recommendation remains: refresh/backfill active `variant_a` experiment results before making funnel decisions.

### 5. Cancel Reasons And Guardrails

Read Firestore `Macrafeedbackreason` for recent production rows and summarize:

- total recent production responses
- top cancel reasons
- reason mix for price / not ready / need proof / something broke / Apple sheet confusion where labels allow it
- selected plan context if available
- trigger/source/surface context if available

Use purchase logs, user state, retargeting state, and AppsFlyer coverage to record:

- Apple purchase cancels
- checkout failures/cancels
- under-18 blocks
- missing-birthdate coverage
- trial activation after start
- paid conversion after trial
- source-attribution coverage gaps

## Snapshot Writing Plan

Create or update `docs/ops/macra-operating-snapshot-2026-07-05.md` with:

1. Context and source surfaces.
2. `Funnel Counts` with separate latest AppsFlyer aggregate counts, fresh purchase-log lower-funnel counts, user-state counts, and explicit stale/fresh labels.
3. `Source Split` with paid-vs-organic only if AppsFlyer attribution covers July 5; otherwise record the latest stale split and mark July 5 paid-vs-organic as unverified.
4. `Experiment Snapshot Freshness` with explicit stale/refreshed status for `macra_paywall_onboarding`.
5. `Guardrails` with cancel, failure, eligibility, activation, paid conversion, cancel-reason, retargeting-pressure, and source-coverage signals.
6. `Operator-Facing Update` with one concise Macra Update or explicit no-change decision.
7. `Decision-Log Recommendation` tied to refreshing active `variant_a` before funnel decisions if the experiment result is stale or not decision-grade.

## Validation Checklist

- File exists at `docs/ops/macra-operating-snapshot-2026-07-05.md`.
- Required sections are present exactly.
- Facts and inference are separated.
- Every metric row cites a source surface, Firestore collection/doc, or artifact path.
- AppsFlyer coverage dates are explicit.
- Any stale data is labeled stale and not used as fresh July 5 evidence.
- Checkout events are not double-counted without dedupe.
- Source split distinguishes acquisition attribution from purchase-log paywall-surface source.
- `.agent/macra/decisions.md` receives the July 5 Nora recommendation only after the snapshot evidence exists.
- If an operator update is posted, the Firestore doc id or artifact path is recorded in the snapshot.
- Commit and push only files changed for this task; do not touch unrelated local edits.

## Planned Recommendation Default

Unless `/admin/experiments` is clearly refreshed to active `variant_a` with decision-grade evidence, the July 5 recommendation should be:

- **Owner:** Nora
- **Recommendation:** Refresh active `variant_a` experiment results before making funnel decisions.
- **Expected metric movement:** experiment decision quality.
- **Guardrail:** no onboarding/paywall/pricing/allocation/retargeting/Apple Search Ads changes while experiment data is stale, mostly inferred, or not decision-grade.
