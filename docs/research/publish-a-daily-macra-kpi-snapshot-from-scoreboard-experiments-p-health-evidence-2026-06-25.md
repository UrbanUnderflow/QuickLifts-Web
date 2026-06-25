# Publish a Daily Macra KPI Snapshot — Evidence Memo

**Date:** 2026-06-25  
**Owner:** Sage  
**Task:** Auto-assigned by Nora (task manager sweep)  
**Scope:** Build the daily evidence memo structure for Macra KPI reporting across Scoreboard, Experiments, purchase logs, cancel reasons, retargeting, and AppsFlyer coverage.

## Scoreboard

### Source surface used
- **Dashboard / report:** `Macra Scoreboard` in `/admin/emailSequences`, **scoreboard tab**.
- **Backing source named in runbook:** 2026-06-25 **AppsFlyer aggregate CSV** surfaced through the Macra Scoreboard operating read in `docs/agents/macra-operating-runbook.md`.
- **Relevant code surface:** `src/pages/admin/emailSequences.tsx`, which defines the Macra Scoreboard state and the AppsFlyer event buckets used in the scoreboard view, including:
  - `MACRA_APPSFLYER_PAYWALL_EVENT_NAMES`
  - `MACRA_APPSFLYER_PLAN_SELECTED_EVENT_NAMES`
  - `MACRA_APPSFLYER_CTA_EVENT_NAMES`
  - `MACRA_APPSFLYER_CHECKOUT_EVENT_NAMES`
  - `MACRA_APPSFLYER_PURCHASE_CANCEL_EVENT_NAMES`
  Source: `docs/agents/macra-operating-runbook.md`; `src/pages/admin/emailSequences.tsx`

### KPI extracts from the Scoreboard operating read
From the 2026-06-25 Macra operating read, the scoreboard-relevant AppsFlyer aggregate shows:

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

Important operating rates in the same scoreboard read:

| Rate | Total | Organic | Apple Search Ads |
| --- | ---: | ---: | ---: |
| Start to paywall | 84.1% | 86.2% | 77.2% |
| Paywall to CTA | 70.8% | 72.3% | 65.3% |
| CTA to `af_initiated_checkout` | 29.7% | 31.2% | 23.4% |
| `af_initiated_checkout` to trial | 5.3% | 2.5% | 20.0% |
| Start to trial | 0.9% | 0.5% | 2.4% |

Source: `docs/agents/macra-operating-runbook.md` (“Current Data Read” table, sourced from the 2026-06-25 AppsFlyer aggregate CSV and used by the Macra Scoreboard at `/admin/emailSequences`, scoreboard tab)

### Scoreboard evidence notes
1. The scoreboard read shows **reasonable upper-funnel continuity** through paywall reach (84.1% start → paywall overall), but the funnel becomes fragile after checkout initiation, with only **5 trial starts from 94 `af_initiated_checkout` events** overall. That is a classic activation-quality problem, not a simple top-of-funnel volume problem. Source: `docs/agents/macra-operating-runbook.md`
2. Organic traffic is currently **healthier before checkout** than Apple Search Ads on start → paywall (86.2% vs 77.2%) and paywall → CTA (72.3% vs 65.3%), but it collapses post-checkout with only **2.5% checkout → trial** versus **20.0% for Apple Search Ads**. This suggests downstream trust/commitment or traffic-quality differences, not just weaker landing performance. Source: `docs/agents/macra-operating-runbook.md`
3. The scoreboard guardrail signal is loud: **74 StoreKit purchase cancels** against **94 `af_initiated_checkout`** events in the same aggregate read. Even allowing for event-granularity caveats, the system should treat cancellation friction as a first-order operating issue in the daily snapshot. Source: `docs/agents/macra-operating-runbook.md`

## Experiments

### Source surface used
- **Dashboard / report:** `/admin/experiments`
- **Firestore config document:** `macra-experiments/macra_paywall_onboarding`
- **Results snapshot collection:** `macra-experiment-results`
- **Config setter script:** `scripts/setMacraExperimentFlow.js`

Source: `docs/agents/macra-operating-runbook.md`; `src/pages/admin/experiments.tsx`; `scripts/setMacraExperimentFlow.js`

### Experiment config extract
The live Macra experiment surface is defined as **Macra Paywall + Onboarding** with primary metric `paid_conversion` and assignment salt `macra-paywall-onboarding-2026-05`. The active variant posture is:

- `baseline` — retired long paywall control, disabled
- `variant_a` — **enabled, weight 100**, “Monthly + annual, both with trial”
- `variant_b` — Nora guided onboarding, disabled
- `variant_c` — retired hard paywall monthly, disabled

In both the admin surface and the setter script, `variant_a` is the only enabled variant and is described as the compact trial-prep + plan-selection flow showing **both monthly and annual**, each with a **3-day free trial**. Source: `src/pages/admin/experiments.tsx`; `scripts/setMacraExperimentFlow.js`

### Experiment results / metric definitions extract
The `/admin/experiments` page defines the saved result snapshot shape and the KPI fields that should be refreshed before any experiment decision is made. The result model includes:

- `assignments`
- `qualifiedUsers`
- `onboardingCompletions`
- `paywallViews`
- `valuePreviewViews`
- `pricingDisclosureViews`
- `trialConfidenceViews`
- `planSelections`
- `ctaTaps`
- `checkoutStarts`
- `appleCancels`
- `trialStarts`
- `paidConversions`
- `trialRate`
- `paidRate`
- `liftVsBaseline`

The page also names the AppsFlyer event groupings used to backfill experiment results, including:
- `af_start_trial`, `start_trial`, `trial_started`, `macra_trial_started` for trial-start evidence
- `af_subscribe`, `af_purchase`, `subscribe`, `purchase`, `macra_subscription_started` for paid-conversion evidence
- `af_initiated_checkout` and `macra_subscription_web_checkout_started` for checkout-start evidence

Source: `src/pages/admin/experiments.tsx`

### Experiment posture evidence notes
1. The experiment system is configured to optimize for **paid conversion**, but the runbook explicitly says the **saved `/admin/experiments` result snapshots can be stale** and that refreshing them is the **first operational task** before variant decisions. That means no variant conclusion should be treated as current evidence until the `macra-experiment-results` snapshot is regenerated. Source: `docs/agents/macra-operating-runbook.md`
2. The active experiment posture has already converged operationally on **`variant_a` only**. This is useful because it removes live allocation ambiguity, but it also means that experiment reporting right now is functioning more like **post-change outcome monitoring** than true multi-arm comparison. Source: `src/pages/admin/experiments.tsx`; `scripts/setMacraExperimentFlow.js`
3. The retired `variant_c` description is a critical historical signal: the admin surface and setter script both document that the **hard paywall monthly** flow converted at roughly **~1%** with **~95% Apple-sheet cancels**. Even though that is not the current live treatment, it is relevant engagement/retention evidence because it shows that removing trial softness or compressing plan choice too aggressively can break trust at the exact point where activation should happen. Source: `src/pages/admin/experiments.tsx`; `scripts/setMacraExperimentFlow.js`

## Purchase Logs

### Source surface used
- **Dashboard / report:** `/admin/macraPurchaseLogs`
- **Dataset / collection used for Macra:** `Macra-purchase-logs`
- **Related operating surface named in runbook:** `/admin/purchaseLogs` and `/admin/macraPurchaseLogs`
- **Relevant code surface:** `src/pages/admin/macraPurchaseLogs.tsx`

Source: `docs/agents/macra-operating-runbook.md`; `src/pages/admin/macraPurchaseLogs.tsx`

### Purchase-log schema evidence
The Macra purchase-log admin surface explicitly loads Macra records from the Firestore collection **`Macra-purchase-logs`** and summarizes them using these status buckets:

- `attempted`
- `success`
- `failed`
- `canceled` / `cancelled`

The same surface also exposes the fields needed to analyze conversion risk at the purchase boundary:

- `plan`
- `source`
- `failureReason`
- `errorDomain`
- `errorCode`
- `readableErrorCode`
- `errorDescription`
- `cancelReasonCode`
- `cancelReasonLabel`
- `cancelFeedbackTrigger`
- `cancelFeedbackMetadata`

It computes a **Resolved success rate** as:

- `success / (success + failed + canceled)`

and displays summary cards for:

- `Total logs`
- `Success`
- `Failed`
- `Canceled`
- `Attempted`
- `Resolved success rate`

Source: `src/pages/admin/macraPurchaseLogs.tsx`

### Purchase-log evidence notes
1. The Macra purchase-log surface is not just a receipt table; it is the canonical evidence surface for where conversion breaks at the transaction layer. Because it separately tracks `failed` versus `canceled`, Macra can distinguish **technical checkout failure** from **user-initiated abandonment**, which matters because those imply very different retention fixes. Source: `src/pages/admin/macraPurchaseLogs.tsx`
2. The purchase-log schema preserves **plan**, **channel/source**, and **cancel feedback metadata** on each row. That means the daily KPI snapshot can and should connect conversion outcomes to the specific monetization context users saw, rather than treating all purchase friction as one blob. Source: `src/pages/admin/macraPurchaseLogs.tsx`
3. The runbook explicitly places Purchase Logs in the core source-of-truth set for the daily Macra operating loop, alongside Scoreboard, Experiments, Cancel Reasons, and AppsFlyer ingestion. This means purchase outcomes are part of the primary operating evidence standard, not a secondary reconciliation step. Source: `docs/agents/macra-operating-runbook.md`

## Cancel Reasons

### Source surface used
- **Dashboard / report:** `/admin/macraCancelReasons`
- **Table / export used:** Firestore collection **`Macrafeedbackreason`**, enriched with `users/{userId}` profile context and exportable via the page’s **reason chart** payload.
- **Relevant code surface:** `src/pages/admin/macraCancelReasons.tsx`

Source: `docs/agents/macra-operating-runbook.md`; `src/pages/admin/macraCancelReasons.tsx`

### Cancel-reason schema evidence
The Macra cancel-reason admin surface loads cancellation feedback from **`Macrafeedbackreason`** and enriches each row with user context from the `users` collection. The exported chart/report includes:

- `reason`
- `reasonLabel`
- `trigger`
- `source`
- `selectedPlanId`
- `selectedPlanPeriod`
- `surface`
- `app`
- `metadata`
- `user.subscriptionType`
- `user.registrationEntryPoint`
- `user.hasCompletedMacraOnboarding`
- `user.macraPaywallCancelFeedbackCount`

The page also computes reason-level summaries across production responses:

- `Production responses`
- `Unique users`
- `Top reason`
- per-reason `% of responses`
- per-reason `uniqueUsers`
- per-reason `topPlanLabel`

Source: `src/pages/admin/macraCancelReasons.tsx`

### Cancel-reason evidence notes
1. The cancel-reason surface is structurally able to separate **why users backed out** (`reason`, `reasonLabel`) from **when/how they backed out** (`trigger`, `surface`, `source`) and **what offer they were considering** (`selectedPlanId`, `selectedPlanPeriod`). That is exactly the evidence needed to tell whether Macra has a price problem, a trust problem, or a timing problem at the paywall. Source: `src/pages/admin/macraCancelReasons.tsx`
2. Because the cancel-reason export enriches responses with `user.hasCompletedMacraOnboarding` and `user.registrationEntryPoint`, the team can connect cancellation behavior to onboarding completion state and acquisition path. That matters for trial-start retention because a cancellation pattern coming from partially onboarded users implies different remediation than a pattern coming from fully activated users. Source: `src/pages/admin/macraCancelReasons.tsx`
3. The runbook explicitly lists Cancel Reasons as a required source-of-truth surface and expects the daily snapshot to include **top cancel reasons** as guardrails. So cancellation feedback is not anecdotal voice-of-customer data; it is a first-class operating input for whether the trial-start system is trustworthy enough to scale. Source: `docs/agents/macra-operating-runbook.md`

## Retargeting

_To be populated with cited re-engagement and retargeting-state evidence._

## AppsFlyer Coverage

_To be populated with cited AppsFlyer import and event-coverage evidence._

## Findings

1. **Activation quality is the main bottleneck, not raw volume.** The Scoreboard read shows 533 onboarding starts and 448 paywall reaches, but only 5 trial starts. That means the sharpest drop is occurring after intent has already been expressed, which is a retention-risk signal because low-quality trial starts often begin with shaky trust at the purchase boundary. Source: `docs/agents/macra-operating-runbook.md`
2. **Source quality diverges after checkout, not before.** Organic users outperform Apple Search Ads in early funnel continuity, but Apple Search Ads materially outperforms organic on checkout → trial (20.0% vs 2.5%). That pattern suggests Macra should separate acquisition conclusions by source and inspect whether organic users are hitting more trust friction, weaker motivation, or noisier intent at checkout. Source: `docs/agents/macra-operating-runbook.md`
3. **StoreKit cancellation pressure is big enough to deserve daily guardrail status.** With 74 StoreKit purchase cancels in the same read window as 94 `af_initiated_checkout` events, cancellation behavior is not a side metric. It is part of the operating core for trial-start quality and should be read alongside starts, CTAs, and trials every day. Source: `docs/agents/macra-operating-runbook.md`
4. **The experiment surface is structurally capable of measuring the right funnel moments, but the evidence can expire.** `/admin/experiments` explicitly tracks `paywallViews`, `planSelections`, `checkoutStarts`, `trialStarts`, and `paidConversions`, yet the runbook warns the saved result snapshots can be stale. The operational risk is making product decisions off an old snapshot that no longer reflects active `variant_a`. Source: `src/pages/admin/experiments.tsx`; `docs/agents/macra-operating-runbook.md`
5. **Historical evidence argues against reintroducing a hard paywall stance.** The documented retirement note for `variant_c` (~1% conversion, ~95% Apple-sheet cancels) suggests that harsher monetization framing can degrade the activation moment badly enough to poison trial-start quality. Source: `src/pages/admin/experiments.tsx`; `scripts/setMacraExperimentFlow.js`
6. **Macra already has the instrumentation to separate transaction failure from voluntary abandonment, so the next retention read should stop lumping them together.** The `Macra-purchase-logs` surface distinguishes `failed` from `canceled/cancelled` and preserves error fields plus cancel-reason fields on the same purchase records. That means one daily KPI snapshot can isolate whether trial-start loss is being driven by broken checkout mechanics, user hesitation, or both. Source: `src/pages/admin/macraPurchaseLogs.tsx`
7. **Cancellation feedback can be tied back to onboarding and offer context, which makes it a usable retention-risk predictor rather than just qualitative noise.** The `Macrafeedbackreason` export includes selected plan, trigger, source, onboarding completion, and registration entry point, so repeated patterns there should be treated as evidence about trial-start trust quality and not merely post-hoc comments. Source: `src/pages/admin/macraCancelReasons.tsx`

## Recommended Intervention

_To be populated with one evidence-backed intervention tied to the strongest cross-source pattern._
