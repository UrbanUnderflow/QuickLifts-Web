# Macra Event Semantics & Trust Audit

**Date:** 2026-06-25  
**Owner:** Sage  
**Task:** Audit Macra event semantics and trust guardrails  
**Scope:** Review event definitions, blocking rules, cancellation semantics, and trust guardrails that affect whether Macra trial-start growth signals are safe to scale.

## af_start_trial

### Source artifacts
- `netlify/functions/sync-macra-appsflyer-raw-data.ts`
- `src/pages/admin/experiments.tsx`
- `docs/agents/macra-operating-runbook.md`

### Observed semantics
The AppsFlyer import function includes `af_start_trial` in the default Macra event allowlist and stores it into the Macra aggregate and raw-row collections. In the experiment admin surface, `af_start_trial` is one of the canonical event names counted in the **trial-start evidence set**, alongside `start_trial`, `trial_started`, and `macra_trial_started`.

That means `af_start_trial` is treated in the operating system as a **trial-start signal**, not merely a checkout-intent signal.

Source: `netlify/functions/sync-macra-appsflyer-raw-data.ts`; `src/pages/admin/experiments.tsx`

### Trust note
Because `af_start_trial` is grouped with multiple synonymous trial-start events in the experiment surface, it is operationally important but not uniquely authoritative on its own. The team should treat it as evidence of trial start only in the context of the full event-group mapping.

Source: `src/pages/admin/experiments.tsx`

## af_purchase

### Source artifacts
- `netlify/functions/sync-macra-appsflyer-raw-data.ts`
- `src/pages/admin/experiments.tsx`

### Observed semantics
The AppsFlyer import layer explicitly includes `af_purchase` in the Macra event allowlist. The experiment admin surface counts `af_purchase` inside the **paid-conversion evidence set**, alongside `af_subscribe`, `subscribe`, `purchase`, and `macra_subscription_started`.

This means `af_purchase` is being interpreted in Macra operations as one of the accepted signals for a **paid conversion outcome** after the funnel has already progressed beyond trial intent.

Source: `netlify/functions/sync-macra-appsflyer-raw-data.ts`; `src/pages/admin/experiments.tsx`

### Trust note
`af_purchase` is not modeled as a distinct Macra-only terminal state. It is one member of a broader paid-conversion bundle, which means reporting should avoid pretending it is the sole definition of a successful paid state.

Source: `src/pages/admin/experiments.tsx`

## af_subscribe

### Source artifacts
- `netlify/functions/sync-macra-appsflyer-raw-data.ts`
- `src/pages/admin/experiments.tsx`

### Observed semantics
The AppsFlyer import function also includes `af_subscribe` in the Macra event allowlist. In `/admin/experiments`, `af_subscribe` is grouped together with `af_purchase`, `subscribe`, `purchase`, and `macra_subscription_started` as evidence for **paid conversion**.

Operationally, `af_subscribe` is therefore treated as another accepted route into the same paid-conversion bucket rather than a fully separate business outcome.

Source: `netlify/functions/sync-macra-appsflyer-raw-data.ts`; `src/pages/admin/experiments.tsx`

### Trust note
Because `af_subscribe` and `af_purchase` both land in the same paid-conversion grouping, the team should be careful not to double-tell the story by implying they represent separate end states unless deduped at the user level.

Source: `src/pages/admin/experiments.tsx`

## purchase_cancelled

### Source artifacts
- `netlify/functions/sync-macra-appsflyer-raw-data.ts`
- `src/pages/admin/emailSequences.tsx`
- `docs/agents/macra-operating-runbook.md`

### Observed semantics
The Macra AppsFlyer import layer includes `macra_subscription_purchase_cancelled` in the event allowlist. The Scoreboard/admin email-sequences surface treats cancellation as a first-class monitored event by defining a dedicated cancellation event set under `MACRA_APPSFLYER_PURCHASE_CANCEL_EVENT_NAMES`.

The runbook’s operating read also surfaces StoreKit purchase cancels as part of the daily KPI picture, showing that cancellation is not a backend-only detail but a visible operating guardrail.

Source: `netlify/functions/sync-macra-appsflyer-raw-data.ts`; `src/pages/admin/emailSequences.tsx`; `docs/agents/macra-operating-runbook.md`

### Trust note
`purchase_cancelled` semantics are clearly intended to mean **reversal/abandonment pressure at the purchase boundary**, not successful activation. Any topline trial-start read that ignores cancellation volume risks overstating durable intent.

Source: `docs/agents/macra-operating-runbook.md`

## web_checkout_started

### Source artifacts
- `netlify/functions/sync-macra-appsflyer-raw-data.ts`
- `src/pages/admin/experiments.tsx`
- `docs/agents/macra-operating-runbook.md`

### Observed semantics
The AppsFlyer import layer includes `macra_subscription_web_checkout_started` in the Macra event allowlist. The experiment admin surface also counts it alongside `af_initiated_checkout` in the **checkout-start evidence set**.

The runbook explicitly treats checkout start as an operational KPI, but warns that `af_initiated_checkout` and `macra_subscription_web_checkout_started` should not be combined as if they are unique starts without person-level dedupe.

Source: `netlify/functions/sync-macra-appsflyer-raw-data.ts`; `src/pages/admin/experiments.tsx`; `docs/agents/macra-operating-runbook.md`

### Trust note
`web_checkout_started` is a **high-intent signal**, not proof of trial start. It sits upstream of `af_start_trial` and is explicitly subject to overlap with other checkout events.

Source: `docs/agents/macra-operating-runbook.md`

## StoreKit cancel

_To be populated with cited StoreKit cancellation semantics and relationship to purchase/trial progression._

## age eligibility

_To be populated with cited age-eligibility rules, enforcement points, and blocking behavior._

## missing birthdate blocks

_To be populated with cited birthdate requirement behavior and whether missing birthdate blocks trial progression or only annotates it._

## trial activation

### Source artifacts
- `src/pages/admin/emailSequences.tsx`
- `docs/agents/macra-operating-runbook.md`
- `src/pages/admin/users.tsx`

### Observed semantics
Macra distinguishes between a **trial start** and a **trial user who still needs activation or recovery handling**. The email-sequences/Scoreboard surface includes a dedicated recovery sequence named `macra-trial-no-activation-24h-v1`, which implies that a user can have entered trial state while still failing to activate in the desired way.

On the user-state side, `/admin/users` exposes fields such as `hasCompletedMacraOnboarding` and `macraOnboardingCompletedAt`, which are relevant to whether a trial user has progressed into a more complete activated state.

The runbook also explicitly separates growth-signal review from trust/quality review, reinforcing that raw trial starts are not the same thing as fully trustworthy activation.

Source: `src/pages/admin/emailSequences.tsx`; `src/pages/admin/users.tsx`; `docs/agents/macra-operating-runbook.md`

### Trust note
For Macra operations, “trial activation” behaves like a **post-trial-start quality state**, not a synonym for `af_start_trial`. That distinction matters because the team could otherwise scale a funnel that produces nominal trials without producing genuinely activated users.

Source: `src/pages/admin/emailSequences.tsx`; `docs/agents/macra-operating-runbook.md`

## Ambiguities

_To be populated with cited mismatches, overlaps, or undefined transitions that could make the team scale a misleading signal._

## Trust Guardrails

_To be populated with concrete pass/fail rules for when a Macra trial start should count as valid and trustworthy._
