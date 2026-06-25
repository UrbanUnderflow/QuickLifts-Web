# Macra Agent Operating Runbook

Last updated: 2026-06-25

## Mission

Macra's agent team exists to make the trial-start path repeatable without breaking trust.

The agents should operate the existing Macra admin surfaces, not build a parallel command center. The daily loop is:

1. Observe the current data.
2. Recommend one concrete action per agent.
3. Decide on at most one operational change.
4. Log the decision, expected metric movement, and guardrails.

## Source Of Truth Surfaces

Use these surfaces before proposing funnel changes:

| Surface | Path | Purpose |
| --- | --- | --- |
| Macra Scoreboard | `/admin/emailSequences`, scoreboard tab | Daily operating read across AppsFlyer CSV, retargeting, purchase logs, and recovery pools. |
| Experiments | `/admin/experiments` | Firestore-backed Macra paywall/onboarding variant config and saved result snapshots. |
| User Management | `/admin/users` and `/admin/userOnboarding` | User-level onboarding state, registration, and profile context. |
| Cancel Reasons | `/admin/macraCancelReasons` | Saved paywall cancellation reasons, plan, trigger, and raw funnel metadata. |
| Purchase Logs | `/admin/purchaseLogs` and `/admin/macraPurchaseLogs` | StoreKit/Stripe purchase attempts, successes, failures, cancellations, and selected reason metadata. |
| AppsFlyer ingestion | `netlify/functions/sync-macra-appsflyer-raw-data.ts` | Raw and aggregate AppsFlyer CSV/API import into `appsflyer-scoreboards`, `appsflyer-aggregate-periods`, `appsflyer-macra-raw-rows`, and `appsflyer-macra-users`. |
| Experiment config setter | `scripts/setMacraExperimentFlow.js` | Sets live `macra-experiments/macra_paywall_onboarding` config. Dry-run by default. |

## Current Data Read

The 2026-06-25 AppsFlyer aggregate CSV shows the active signal:

| Metric | Total | Organic | Apple Search Ads |
| --- | ---: | ---: | ---: |
| Onboarding starts | 533 | 406 | 127 |
| Paywall reached | 448 | 350 | 98 |
| Paywall CTA pressed | 317 | 253 | 64 |
| `af_initiated_checkout` | 94 | 79 | 15 |
| Trial starts | 5 | 2 | 3 |
| Purchase events | 3 | 0 | 3 |
| Subscribe events | 3 | 0 | 3 |
| StoreKit purchase cancels | 74 | 65 | 9 |

Important rates:

| Rate | Total | Organic | Apple Search Ads |
| --- | ---: | ---: | ---: |
| Start to paywall | 84.1% | 86.2% | 77.2% |
| Paywall to CTA | 70.8% | 72.3% | 65.3% |
| CTA to `af_initiated_checkout` | 29.7% | 31.2% | 23.4% |
| `af_initiated_checkout` to trial | 5.3% | 2.5% | 20.0% |
| Start to trial | 0.9% | 0.5% | 2.4% |

Interpretation: Apple Search Ads is not cleaner at every earlier step, but it is materially stronger after checkout. Treat this as a promising channel-quality signal, not proof of product-market fit.

Data caveat: `macra_subscription_web_checkout_started` also appears in AppsFlyer. Do not add it to `af_initiated_checkout` as unique checkout users unless a person-level dedupe confirms the events are not overlapping.

## Active Experiment Posture

Live config should be `variant_a`: monthly plus annual, both with trial.

Known issue: saved `/admin/experiments` result snapshots can be stale. The first operational task is to backfill/refresh experiment results before using variant performance for decisions.

## Agent Roles

Nora is Macra operator/CEO.
Owns daily scoreboard refresh, experiment result freshness, task prioritization, decision log, and cross-surface reconciliation.

Scout is growth/acquisition lead.
Owns Apple Search Ads versus organic quality, campaign/source hypotheses, keyword/creative ideas, and paid acquisition recommendations.

Solara is lifecycle/conversion lead.
Owns onboarding copy, paywall copy, retargeting emails, cancel-reason synthesis, proof/trust assets, and one copy/offer recommendation at a time.

Sage is product quality/trust lead.
Owns nutrition safety, age eligibility, activation quality, claims/compliance, and event semantics for trial, purchase, subscribe, cancellation, and checkout events.

## Daily Snapshot Template

Nora should publish one daily snapshot with:

- Coverage: AppsFlyer CSV/API date range, import time, and whether aggregate/raw/person-level docs are present.
- Funnel: starts, paywall reached, CTA, checkout, trial starts, purchases, subscribes.
- Source split: organic versus Apple Search Ads, with start-to-trial and checkout-to-trial.
- Guardrails: StoreKit cancel rate, checkout failure/cancel rate, under-18/missing-birthdate blocks, trial activation, paid conversion after trial, top cancel reasons.
- Experiment freshness: live config, result snapshot generatedAt, whether it reflects active `variant_a`.
- Recommendation queue: one proposed action from each agent, with Nora selecting zero or one change.

## Weekly Decision Template

Each weekly review should answer:

- Continue, promote, pause, or replace the active experiment?
- Increase ASA budget, hold, or refine keywords/creative first?
- What did trial starts do after the prior decision?
- What did paid conversion and cancel feedback do after the prior decision?
- Which guardrail moved in the wrong direction?
- What is the next single test?

## Decision Rules

- No random funnel changes while the signal is emerging.
- Do not act on stale experiment snapshots.
- Do not merge organic and ASA conclusions.
- Do not combine overlapping AppsFlyer checkout events without dedupe.
- Prefer one high-confidence change over five simultaneous guesses.
- Every operational change must have a decision-log entry before or immediately after the change.
- If trust/safety guardrails degrade, pause growth experiments before scaling spend.
