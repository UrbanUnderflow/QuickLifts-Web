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

_To be populated with cited conversion and purchase-flow evidence from purchase log sources._

## Cancel Reasons

_To be populated with cited churn and cancellation evidence from cancel-reason sources._

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

## Recommended Intervention

_To be populated with one evidence-backed intervention tied to the strongest cross-source pattern._
