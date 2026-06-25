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

## User State

### Source surfaces used
- **Dashboard / report:** `/admin/users`
- **Dashboard / report:** `/admin/userOnboarding`
- **Relevant code surfaces:**
  - `src/pages/admin/users.tsx`
  - `src/pages/admin/userOnboarding.tsx`

Source: `src/pages/admin/users.tsx`; `src/pages/admin/userOnboarding.tsx`

### User-state evidence
The admin user-management surface explicitly models Macra-relevant user state fields in the main user row shape, including:

- `subscriptionType`
- `registrationEntryPoint`
- `hasCompletedMacraOnboarding`
- `macraOnboardingCompletedAt`
- `macraNotificationPreferences`
- `macraEmailPreferences`
- `macraLatestPaywallCancelFeedback`
- `macraLatestPaywallCancelFeedbackAt`
- `macraPaywallCancelFeedbackCount`
- `macraProfile`
- `athleteSport`
- `athleteSportName`
- `athleteSportPosition`

The same surface also normalizes registration origin into operating buckets:

- `fit_with_pulse`
- `macra`
- `pulse_check`
- `pulse_ritual`
- `unknown`

and uses those values to segment users by origin tab in `/admin/users`.

Source: `src/pages/admin/users.tsx`

The dedicated onboarding-admin surface tracks recent onboarding link creation state via `onboarding-tokens` and displays:

- `userId`
- `email`
- `username`
- `token`
- `used`
- `createdAt`
- `expiresAt`
- `adminNotes`

That means the operating system already has a source for whether a provisioned user has merely been invited versus actually moving through onboarding.

Source: `src/pages/admin/userOnboarding.tsx`

### User-state evidence notes
1. The `/admin/users` surface already contains the fields needed to distinguish **acquisition origin**, **Macra onboarding completion**, **profile readiness**, and **paywall-cancel history** at the user level. That is important because retention analysis is weaker when these states are inferred from events alone instead of checked against user state. Source: `src/pages/admin/users.tsx`
2. `registrationEntryPoint` is normalized into explicit origin buckets, including `macra`, so Macra-origin user cohorts can be separated from other product entry paths in the admin surface before deeper funnel analysis is layered on top. Source: `src/pages/admin/users.tsx`
3. The `/admin/userOnboarding` surface makes onboarding-token lifecycle visible (`used`, `createdAt`, `expiresAt`), which matters because an apparent acquisition win is not the same thing as a reachable, activated user. Source: `src/pages/admin/userOnboarding.tsx`

## Retargeting

### Source surface used
- **Dashboard / report:** `Macra Scoreboard` in `/admin/emailSequences`, scoreboard tab
- **Retargeting state source in code:** `src/pages/admin/emailSequences.tsx`
- **Named sequence/report sources used by the scoreboard:**
  - `macra-web-offer-24h-v1`
  - `macra-paywall-cancel-trust-v1`
  - `macra-web-offer-proof-v1`
  - `macra-paywall-view-value-v1`
  - `macra-no-trial-7d-challenge-v1`
  - `macra-trial-no-activation-24h-v1`

Source: `docs/agents/macra-operating-runbook.md`; `src/pages/admin/emailSequences.tsx`

### Retargeting-state evidence
The Macra Scoreboard model includes user-level retargeting state directly in `MacraScoreboardSignals` and `MacraNextRetargetingEmail`. The surface tracks:

- `retargetingEmailSentAt`
- `retargetingEmailSentCount`
- `retargetingEmailSends[]`
- `stripeRetargetClickedAt`
- `webOfferSentAt`
- `webOfferOpenedAt`
- `webOfferCheckoutStartedAt`
- `webOfferConvertedAt`
- `webOfferTrialEndAt`
- `webOfferPaidAt`
- `nextRetargetingEmail.reason`
- `nextRetargetingEmail.status`
- `nextRetargetingEmail.canSendNow`

The scoreboard also classifies users into retargeting-relevant operating tiers:

- `high_intent_recovery`
- `serious_plan_completer`
- `trial_started`
- `paid`
- `onboarding_completer`
- `curiosity`
- `excluded`

Source: `src/pages/admin/emailSequences.tsx`

### Retargeting evidence notes
1. Retargeting in Macra is already modeled as a **state machine**, not a one-off email blast. The scoreboard knows whether a user was sent an offer, opened it, clicked back into checkout, converted, or still has a next email due. That means the daily KPI snapshot can identify whether recovery failure is due to **coverage gaps**, **message weakness**, or **post-click breakdown**. Source: `src/pages/admin/emailSequences.tsx`
2. The presence of dedicated steps like `macra-paywall-cancel-trust-v1` and `macra-trial-no-activation-24h-v1` shows the system already distinguishes **checkout hesitation** from **trial non-activation**. That is important for retention because those are different behavioral moments and should not be treated as the same lifecycle problem. Source: `src/pages/admin/emailSequences.tsx`
3. The runbook explicitly expects the Scoreboard to read across **retargeting, purchase logs, and recovery pools** in one place. So the retargeting state is part of the primary operating picture for trial-start repeatability, not a downstream CRM-only metric. Source: `docs/agents/macra-operating-runbook.md`

## AppsFlyer Coverage

### Source surface used
- **Import / report used:** `netlify/functions/sync-macra-appsflyer-raw-data.ts`
- **App ID:** `id6463771067`
- **Named output collections:**
  - `appsflyer-scoreboards`
  - `appsflyer-aggregate-periods`
  - `appsflyer-macra-raw-rows`
  - `appsflyer-macra-users`
  - `appsflyer-import-runs`

Source: `docs/agents/macra-operating-runbook.md`; `netlify/functions/sync-macra-appsflyer-raw-data.ts`

### AppsFlyer coverage evidence
The AppsFlyer ingestion layer is designed to preserve both aggregate and person-linked evidence:

- aggregate scoreboard docs in `appsflyer-scoreboards`
- period-level snapshots in `appsflyer-aggregate-periods`
- raw event/install rows in `appsflyer-macra-raw-rows`
- user-level attribution/event aggregates in `appsflyer-macra-users`
- import-level run tracking in `appsflyer-import-runs`

The importer’s default Macra event coverage includes:

- `af_complete_registration`
- `macra_onboarding_started`
- `macra_onboarding_profile_completed`
- `macra_onboarding_paywall_reached`
- `macra_onboarding_completed`
- `macra_paywall_viewed_standalone`
- `macra_paywall_primary_button_pressed`
- `af_initiated_checkout`
- `macra_subscription_purchase_cancelled`
- `macra_paywall_cancel_feedback_submitted`
- `macra_subscription_web_checkout_started`
- `macra_subscription_web_checkout_returned`
- `af_start_trial`
- `af_subscribe`
- `af_purchase`

The importer summary structure explicitly tracks:

- `rows`
- `duplicateRows`
- `reports`
- install totals and splits
- event totals by name and media source
- revenue totals by event name and media source
- `matchedCustomerUserRows`
- `unmatchedRows`
- `importedUserDocs`
- `topMediaSources`
- `topCampaigns`
- `topEvents`

Source: `netlify/functions/sync-macra-appsflyer-raw-data.ts`

### AppsFlyer coverage notes
1. The AppsFlyer ingestion stack is strong enough to support both **daily topline reporting** and **person-level reconciliation**. Because it writes aggregate periods, raw rows, and user-linked aggregates, the team can inspect funnel rates without losing the ability to dedupe or audit edge cases later. Source: `netlify/functions/sync-macra-appsflyer-raw-data.ts`
2. Coverage is broad, but there is an explicit semantic hazard in the current read: both `af_initiated_checkout` and `macra_subscription_web_checkout_started` are tracked, and the runbook warns not to combine them as unique checkouts without person-level dedupe. That means checkout counts in the daily KPI snapshot must be labeled carefully, or the team risks overstating intent volume. Source: `docs/agents/macra-operating-runbook.md`; `netlify/functions/sync-macra-appsflyer-raw-data.ts`
3. The importer’s summary fields `matchedCustomerUserRows`, `unmatchedRows`, and `importedUserDocs` are part of the real coverage story. If unmatched rows rise, the growth signal can look healthy in aggregate while becoming less trustworthy for retention analysis at the user level. Source: `netlify/functions/sync-macra-appsflyer-raw-data.ts`

## Findings

1. **Activation quality is the main bottleneck, not raw volume.** The Scoreboard read shows 533 onboarding starts and 448 paywall reaches, but only 5 trial starts. That means the sharpest drop is occurring after intent has already been expressed, which is a retention-risk signal because low-quality trial starts often begin with shaky trust at the purchase boundary. Source: `docs/agents/macra-operating-runbook.md`
2. **Source quality diverges after checkout, not before.** Organic users outperform Apple Search Ads in early funnel continuity, but Apple Search Ads materially outperforms organic on checkout → trial (20.0% vs 2.5%). That pattern suggests Macra should separate acquisition conclusions by source and inspect whether organic users are hitting more trust friction, weaker motivation, or noisier intent at checkout. Source: `docs/agents/macra-operating-runbook.md`
3. **StoreKit cancellation pressure is big enough to deserve daily guardrail status.** With 74 StoreKit purchase cancels in the same read window as 94 `af_initiated_checkout` events, cancellation behavior is not a side metric. It is part of the operating core for trial-start quality and should be read alongside starts, CTAs, and trials every day. Source: `docs/agents/macra-operating-runbook.md`
4. **The experiment surface is structurally capable of measuring the right funnel moments, but the evidence can expire.** `/admin/experiments` explicitly tracks `paywallViews`, `planSelections`, `checkoutStarts`, `trialStarts`, and `paidConversions`, yet the runbook warns the saved result snapshots can be stale. The operational risk is making product decisions off an old snapshot that no longer reflects active `variant_a`. Source: `src/pages/admin/experiments.tsx`; `docs/agents/macra-operating-runbook.md`
5. **Historical evidence argues against reintroducing a hard paywall stance.** The documented retirement note for `variant_c` (~1% conversion, ~95% Apple-sheet cancels) suggests that harsher monetization framing can degrade the activation moment badly enough to poison trial-start quality. Source: `src/pages/admin/experiments.tsx`; `scripts/setMacraExperimentFlow.js`
6. **Macra already has the instrumentation to separate transaction failure from voluntary abandonment, so the next retention read should stop lumping them together.** The `Macra-purchase-logs` surface distinguishes `failed` from `canceled/cancelled` and preserves error fields plus cancel-reason fields on the same purchase records. That means one daily KPI snapshot can isolate whether trial-start loss is being driven by broken checkout mechanics, user hesitation, or both. Source: `src/pages/admin/macraPurchaseLogs.tsx`
7. **Cancellation feedback can be tied back to onboarding and offer context, which makes it a usable retention-risk predictor rather than just qualitative noise.** The `Macrafeedbackreason` export includes selected plan, trigger, source, onboarding completion, and registration entry point, so repeated patterns there should be treated as evidence about trial-start trust quality and not merely post-hoc comments. Source: `src/pages/admin/macraCancelReasons.tsx`
8. **Macra’s recovery system is mature enough to target specific failure moments, so broad generic follow-up is the wrong next move.** The scoreboard tracks dedicated retargeting flows for paywall cancel trust, proof follow-up, paywall value, web offer recovery, and trial activation. That means the most evidence-aligned intervention is to strengthen the weakest trust breakpoint, not to send more undifferentiated messages. Source: `src/pages/admin/emailSequences.tsx`
9. **AppsFlyer coverage is wide, but the checkout layer still needs semantic discipline.** Because both `af_initiated_checkout` and `macra_subscription_web_checkout_started` are imported, and the runbook explicitly warns against combining them without person-level dedupe, Macra should treat checkout totals as a guarded measure rather than a single clean intent number. Source: `docs/agents/macra-operating-runbook.md`; `netlify/functions/sync-macra-appsflyer-raw-data.ts`

## Recommended Intervention

**Intervention:** Strengthen the **post-checkout trust recovery path** instead of changing acquisition or reworking the whole paywall again.

Specifically, prioritize one lifecycle intervention on the existing recovery rail:
- use the dedicated `macra-paywall-cancel-trust-v1` retargeting path for users who reached checkout or triggered Apple purchase cancellation,
- tighten the message around trial clarity, what happens during the 3-day free trial, and what the user can expect immediately after start,
- and judge it against guarded metrics rather than raw checkout volume alone.

### Why this is the strongest next move
- The Scoreboard shows that users are getting deep into the funnel (`533` starts, `448` paywall reaches, `317` CTAs, `94` checkout starts) but only `5` trial starts emerge. Source: `docs/agents/macra-operating-runbook.md`
- Apple Search Ads is materially stronger **after checkout** than organic (`20.0%` checkout → trial vs `2.5%`), which suggests the biggest problem is not pure top-of-funnel traffic quantity but what happens at the activation boundary. Source: `docs/agents/macra-operating-runbook.md`
- Purchase logs and cancel-reason surfaces already distinguish **technical failure**, **voluntary cancellation**, **trigger context**, and **selected plan context**, so Macra has enough instrumentation to target trust friction specifically. Source: `src/pages/admin/macraPurchaseLogs.tsx`; `src/pages/admin/macraCancelReasons.tsx`
- The retargeting system already has a named trust-recovery lane (`macra-paywall-cancel-trust-v1`), which is a better first intervention than inventing a new broad lifecycle program. Source: `src/pages/admin/emailSequences.tsx`
- Historical experiment evidence warns against reverting to harsher paywall pressure because the retired hard-paywall treatment produced roughly `~1%` conversion and `~95%` Apple-sheet cancels. Source: `src/pages/admin/experiments.tsx`; `scripts/setMacraExperimentFlow.js`

### Guardrails for this intervention
- Do **not** judge success by combining `af_initiated_checkout` and `macra_subscription_web_checkout_started` as if they were unique checkouts.
- Track impact on:
  - trial starts
  - checkout → trial conversion
  - StoreKit purchase cancels
  - cancel-feedback mix
  - paid conversion after trial

Source: `docs/agents/macra-operating-runbook.md`; `netlify/functions/sync-macra-appsflyer-raw-data.ts`
