# Macra Lifecycle Conversion Decision Read - 2026-07-04

## Step Scope

This artifact is the July 4 Solara lifecycle/conversion decision-read for Macra. It is being built stepwise. This research-and-plan step defines the source order, evidence boundaries, and decision-log plan before any proposed operational change is written. It does not approve or ship any live funnel, pricing, offer, proof, copy, retargeting, budget, acquisition, or experiment change.

## Research And Plan

### Objective

Maintain a Macra decision read that ties any later lifecycle operational change to source evidence, one expected metric, and explicit guardrails. The read must support exactly one proposed copy, proof, or offer change in a later step, but this planning step does not select or approve that change.

### Source order

1. Read `docs/ops/macra-operating-snapshot-2026-07-04.md` first for the latest Scoreboard, AppsFlyer, purchase-log, cancel-reason, experiment, and user-state freshness labels.
2. Cross-check `/admin/macraCancelReasons` via the committed snapshot evidence for Firestore `Macrafeedbackreason`, especially recent cancel-reason labels, triggers, source, plan period, and whether July 4 rows exist.
3. Read paywall dismissal signals from the latest persisted AppsFlyer and Scoreboard event buckets: paywall reached, paywall CTA pressed, checkout starts, trial starts, purchase cancels, purchase failures, and web checkout failures.
4. Read retargeting state from Firestore `users` and user retargeting fields as summarized in the July 4 operating snapshot, while preserving the field-availability caveat.
5. Cross-check `.agent/macra/state.json` for durable mission state, active variant, primary metric, latest saved run, and guardrails.
6. Cross-check `.agent/macra/decisions.md` before adding any later proposed-only row, so the row does not duplicate or conflict with Nora's existing no-change posture or Solara's earlier proposed paywall proof-copy row.

### Planned analysis

- Separate observed facts from inference in the later `Trust Signal Read`.
- Treat July 4 target-date data as early or unavailable unless the source explicitly contains July 4 rows, because the operating snapshot says the source runtime was still `2026-07-03` in `America/New_York`.
- Preserve the stale-source caveat: AppsFlyer and Scoreboard coverage remain stale for July 4, with the latest persisted AppsFlyer aggregate ending `2026-06-27`.
- Use first-party purchase-log and cancel-reason evidence for guardrail pressure, but do not treat it as a fresh full-funnel source-quality read.
- Delay the `.agent/macra/decisions.md` proposed-only Solara row until the later step names exactly one proposed operational change, one expected metric, and the matching guardrails.

### Step boundary

This research-and-plan step may create the deliverable and record source coverage. It must not add the July 4 Solara decision-log row, name a proposed operational change, or choose a target metric yet.

## Decision Source Coverage

### Observed facts

- **Runtime date caveat:** `docs/ops/macra-operating-snapshot-2026-07-04.md` records read timestamp `2026-07-04T00:15:45.769Z`, but also says the source runtime was still `2026-07-03` in `America/New_York`; July 4 target-date rows are therefore early or unavailable unless explicitly present in a source.
- **`/admin/macraCancelReasons`:** Required decision source for cancel-reason guardrails, backed by Firestore `Macrafeedbackreason`. The July 4 operating snapshot reports one recent rolling-window row in `Macrafeedbackreason`, dated `2026-07-02`, with top reason `I'm not ready yet`, trigger `storekit_cancelled`, source `subscription_required`, and plan period `year`. July 4 cancel-reason rows are unavailable at read time.
- **Paywall dismissal signals:** Required decision source for paywall reach, paywall CTA, checkout starts, trial starts, purchase cancels, and purchase failures. The July 4 operating snapshot records latest persisted AppsFlyer full-funnel coverage from Firestore `appsflyer-aggregate-periods/macra_2026-06-21_2026-06-27`: `826` onboarding starts, `1015` paywall reaches, `1553` paywall CTA presses, `143` `af_initiated_checkout` events, `93` web checkout-start events, `6` trial starts, `112` purchase cancels, `13` purchase failures, and `2` web checkout failures. This source is stale for July 4 because the period ends `2026-06-27`.
- **Retargeting state:** Required decision source for eligibility, suppression, already-contacted state, and lifecycle pressure. The July 4 operating snapshot reads Firestore `users` and reports `0` rolling-window rows with detected retargeting-send fields in the summary read. Field availability is limited, and July 4 user rows were `0` at read time, so retargeting state is not decision-grade for a live change.
- **`.agent/macra/state.json`:** Required durable operating state. It records Macra's primary metric as `qualified_onboarding_start_to_trial_start`, active experiment as `variant_a`, latest saved AppsFlyer / Scoreboard run as `2026-05-27` through `2026-06-25`, and guardrails including Apple purchase cancels, checkout failure or cancel rate, age and birthdate blocks, activation quality, paid conversion, and cancel reasons.
- **`.agent/macra/decisions.md`:** Required decision-log source. It currently includes Solara's `2026-06-30` proposed-only paywall proof-copy test and Nora's `2026-06-30` no-change decision during the validation window. It does not yet include a `2026-07-04` Solara proposed-only row; that row belongs to a later step after the proposed operational change is written.

### Stale or unavailable sources

- **July 4 AppsFlyer coverage unavailable:** `docs/ops/macra-operating-snapshot-2026-07-04.md` says no Firestore `appsflyer-aggregate-periods` doc covers `2026-07-04`, and Firestore `appsflyer-macra-raw-rows` returned `0` rows for `eventDate >= 2026-06-30` and `eventDate <= 2026-07-04`.
- **Scoreboard stale for July 4:** Firestore `appsflyer-scoreboards/macra` exists, but the July 4 operating snapshot records Scoreboard `updatedAt` and `importedAt` as `2026-06-27T08:48:20.605Z`; do not treat it as a fresh July 4 funnel read.
- **Paywall dismissal signals stale for July 4:** The latest persisted full-funnel AppsFlyer aggregate ends `2026-06-27`, so paywall dismissal behavior is directional background, not current-day proof.
- **Retargeting state limited:** The July 4 summary read found no detected retargeting-send fields in rolling user rows, but field availability is limited; treat retargeting eligibility, suppression, and already-contacted state as unverified for live decisioning.
- **Decision-log gap by design:** `.agent/macra/decisions.md` has no July 4 Solara row yet because this step is source coverage only. Do not append the proposed-only row until the single proposed operational change and matching metric are written.

### Step boundary

This decision source coverage does not recommend a copy, proof, or offer change. It only establishes which sources can and cannot support the later trust-signal read, proposed operational change, and decision-log row.
