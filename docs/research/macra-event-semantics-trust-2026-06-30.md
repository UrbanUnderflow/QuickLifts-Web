# Macra Event Semantics & Trust Audit: Trial Signal Verification

**Date:** 2026-06-30  
**Owner:** Sage  
**Status:** Step 1 research plan  
**Task:** Verify that `af_start_trial`, `af_purchase`, `af_subscribe`, `purchase_cancelled`, `web_checkout_started`, and StoreKit cancel are cleanly separated, and flag any tracking ambiguity that could make the reported 2/day trial-start signal look stronger or weaker than reality.

## Research Question

Can Macra safely treat the reported 2/day trial-start signal as a clean trial-start signal, or could the current event grouping, aggregation, cancellation handling, or first-party/AppsFlyer reconciliation make that signal look stronger or weaker than the real user-level conversion state?

## Current Freshness Caveat

The durable Macra operating state currently records the latest saved run as **2026-05-27 through 2026-06-25**, sourced from an AppsFlyer aggregate report aligned with the saved Macra Scoreboard. That saved run records **5 trial starts**, **3 purchases**, and **3 subscribes**, not a directly verified 2/day trial-start pace.

For this audit, the 2/day signal is therefore treated as **unverified until Step 2 identifies its exact source artifact, date range, and unit of counting**.

Source: `.agent/macra/state.json`

## Source Map

### AppsFlyer import and storage

- **Source artifact:** `netlify/functions/sync-macra-appsflyer-raw-data.ts`
- **Collections named by the import path:** `appsflyer-scoreboards`, `appsflyer-aggregate-periods`, `appsflyer-macra-raw-rows`, `appsflyer-macra-users`, and `appsflyer-import-runs`
- **Relevant import allowlist:** includes `af_initiated_checkout`, `macra_subscription_purchase_cancelled`, `macra_subscription_web_checkout_started`, `af_start_trial`, `af_subscribe`, and `af_purchase`
- **Planned verification use:** confirm which event names can enter the Macra AppsFlyer pipeline and whether aggregate-period counts can be reconciled to raw/person-level rows.

Source: `netlify/functions/sync-macra-appsflyer-raw-data.ts`

### Experiment event grouping

- **Source artifact:** `src/pages/admin/experiments.tsx`
- **Trial-start evidence set:** `af_start_trial`, `start_trial`, `trial_started`, `macra_trial_started`
- **Paid-conversion evidence set:** `af_subscribe`, `af_purchase`, `subscribe`, `purchase`, `macra_subscription_started`
- **Checkout-start evidence set:** `af_initiated_checkout`, `macra_subscription_web_checkout_started`
- **Cancel evidence set:** `macra_subscription_purchase_cancelled`
- **Activation evidence set:** `macra_trial_activation_screen_viewed`, `macra_trial_activation_primary_pressed`
- **Planned verification use:** test whether trial starts, paid conversions, checkout starts, cancellations, and activation actions are separated in reporting or accidentally interpreted as interchangeable proof of progress.

Source: `src/pages/admin/experiments.tsx`

### Scoreboard reconciliation

- **Source artifact:** `src/pages/admin/emailSequences.tsx`
- **Relevant behavior:** the Scoreboard computes first-party qualified trial starts and AppsFlyer trial-start events, then displays trial starts using `Math.max(qualifiedTrialStarts, appsFlyerStartTrialEvents)`.
- **Relevant event sets:** checkout events include `af_initiated_checkout`, `macra_subscription_web_checkout_started`, and `macra_subscription_checkout_started`; purchase cancel events include both `macra_subscription_purchase_cancelled` and `macra_subscription_purchase_canceled`.
- **Planned verification use:** determine whether the displayed trial-start count is a deduped person count, an event count, or a protective max between sources. This is the highest-priority ambiguity for the 2/day signal.

Source: `src/pages/admin/emailSequences.tsx`

### Purchase and cancellation surfaces

- **Purchase surface:** `/admin/macraPurchaseLogs`
- **Source artifact:** `src/pages/admin/macraPurchaseLogs.tsx`
- **Dataset:** `Macra-purchase-logs`
- **Relevant states:** `attempted`, `success`, `failed`, `canceled`, `cancelled`
- **Relevant metadata:** `cancelReasonCode`, `cancelReasonLabel`, `cancelFeedbackTrigger`, and `cancelFeedbackMetadata`

Source: `src/pages/admin/macraPurchaseLogs.tsx`

- **Cancel-reason surface:** `/admin/macraCancelReasons`
- **Source artifact:** `src/pages/admin/macraCancelReasons.tsx`
- **Dataset:** `Macrafeedbackreason`
- **Planned verification use:** separate StoreKit or purchase-sheet cancellation pressure from completed trial and paid-conversion evidence.

Source: `src/pages/admin/macraCancelReasons.tsx`

### Macra operating contract

- **Source artifacts:** `.agent/macra/contract.md`, `.agent/macra/runbook.md`, `.agent/macra/state.json`
- **Primary metric:** qualified onboarding start to trial start
- **Guardrails:** Apple purchase cancels, checkout failure/cancel rate, under-18 or missing-birthdate blocks, trial activation after start, paid conversion after trial, and cancel reasons.
- **Planned verification use:** keep recommendations constrained to observe/recommend/log posture and avoid live funnel, budget, or pricing changes.

Source: `.agent/macra/contract.md`; `.agent/macra/runbook.md`; `.agent/macra/state.json`

## Planned Verification Matrix

| Signal | Source artifacts | Separation check | Risk to 2/day interpretation |
| --- | --- | --- | --- |
| `af_start_trial` | `netlify/functions/sync-macra-appsflyer-raw-data.ts`; `src/pages/admin/experiments.tsx`; `src/pages/admin/emailSequences.tsx` | Confirm it remains in the trial-start group only and is not counted as paid conversion or activation. | If aggregate events are not deduped to people, trial starts can look stronger than real qualified starts. |
| `af_purchase` | `netlify/functions/sync-macra-appsflyer-raw-data.ts`; `src/pages/admin/experiments.tsx` | Confirm it is paid-conversion evidence, not trial-start evidence. | If purchase is used as a proxy for trial start, the signal can inflate trial quality. |
| `af_subscribe` | `netlify/functions/sync-macra-appsflyer-raw-data.ts`; `src/pages/admin/experiments.tsx` | Confirm it is bundled with paid conversion and deduped against `af_purchase`/`purchase`. | If subscribe and purchase represent the same user journey, counting both separately can overstate conversion. |
| `purchase_cancelled` / StoreKit cancel | `netlify/functions/sync-macra-appsflyer-raw-data.ts`; `src/pages/admin/emailSequences.tsx`; `src/pages/admin/macraPurchaseLogs.tsx`; `src/pages/admin/macraCancelReasons.tsx` | Confirm cancellation is a negative guardrail and never success evidence. | If cancels are ignored, a trial-start signal can look cleaner than the purchase-boundary trust reality. |
| `web_checkout_started` | `netlify/functions/sync-macra-appsflyer-raw-data.ts`; `src/pages/admin/experiments.tsx`; `src/pages/admin/emailSequences.tsx` | Confirm it is upstream intent and not merged with `af_start_trial` without person-level dedupe. | If checkout intent is mistaken for trial start, the signal can look stronger than reality. |
| Trial activation | `src/pages/admin/experiments.tsx`; `src/pages/admin/emailSequences.tsx`; `src/pages/admin/users.tsx` | Confirm raw trial start is separated from activation screen/action and first meaningful product use. | If activation is not checked, Macra may scale nominal starts that do not become durable users. |

## Planned Audit Sections For Step 2

1. **Observed facts:** event groups, datasets, admin surfaces, date ranges, and known counts.
2. **Separation verdict:** whether each required signal is cleanly separated, partially separated, or ambiguous.
3. **2/day signal check:** source, date range, unit of count, and whether it is aggregate event count, deduped user count, first-party qualified count, or Scoreboard max.
4. **Ambiguities:** overlaps between checkout-start, trial-start, paid-conversion, cancellation, and activation states.
5. **Recommendation:** one evidence-backed recommendation, with primary metric and guardrail.

## Working Hypotheses To Test

### Hypothesis 1: trial-start counting may be protective but not person-deduped

The Scoreboard’s `Math.max(qualifiedTrialStarts, appsFlyerStartTrialEvents)` behavior may protect against undercounting when first-party user matching is incomplete, but it can also make a displayed trial-start number unsafe to treat as a deduped user count without raw/person-level validation.

Confidence: medium.  
Source: `src/pages/admin/emailSequences.tsx`

### Hypothesis 2: paid conversion is separated from trial start, but `af_purchase` and `af_subscribe` need dedupe

The experiment surface separates trial-start event names from paid-conversion event names, but `af_purchase` and `af_subscribe` live in the same paid-conversion bundle. They should be treated as alternative evidence for paid conversion unless person-level reconciliation proves they are separate users or separate lifecycle stages.

Confidence: high.  
Source: `src/pages/admin/experiments.tsx`

### Hypothesis 3: checkout-start overlap can make intent look like conversion

Both `af_initiated_checkout` and `macra_subscription_web_checkout_started` are checkout-start evidence, not trial-start evidence. They should not be added together as unique checkout starts without person-level dedupe, and they should never be used as proof of trial start.

Confidence: high.  
Source: `src/pages/admin/experiments.tsx`; `src/pages/admin/emailSequences.tsx`; `.agent/macra/state.json`

### Hypothesis 4: StoreKit cancellation is a guardrail, not a neutral annotation

Cancellation is modeled separately through AppsFlyer events, purchase-log status, and cancel-reason feedback. It should reduce trust in the purchase-boundary signal rather than sit beside trial-start reporting as a neutral diagnostic.

Confidence: high.  
Source: `netlify/functions/sync-macra-appsflyer-raw-data.ts`; `src/pages/admin/macraPurchaseLogs.tsx`; `src/pages/admin/macraCancelReasons.tsx`

## Step 1 Plan

Step 2 should execute the audit by reading the source artifacts above, then filling the final sections with cited facts and a single recommendation. The recommendation should not propose a live funnel, pricing, or budget change. It should focus on signal validity, likely by requiring the daily Macra snapshot to show three separate counts side by side:

1. AppsFlyer aggregate trial-start events.
2. Matched first-party qualified trial-start users.
3. Trial starts with activation evidence and no same-window StoreKit cancellation.

Primary metric to protect: qualified onboarding start to trial start.  
Primary guardrail to watch: Apple purchase cancels and trial activation after start.

## Files Planned For Step 2

- `docs/research/macra-event-semantics-trust-2026-06-30.md`
