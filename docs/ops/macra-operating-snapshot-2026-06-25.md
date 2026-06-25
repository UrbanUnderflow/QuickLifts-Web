# Macra Operating Snapshot — 2026-06-25

## Context

- **Operating system:** Macra Trial-Start Operating System
- **Snapshot date:** 2026-06-25
- **Purpose:** Daily operating artifact for funnel health, source quality, experiment freshness, trust guardrails, and the final operator decision.
- **Status:** Scaffold created; data population pending in subsequent steps.

## Funnel Counts

Source basis for this snapshot:

- Macra agent operating runbook current data read (`docs/agents/macra-operating-runbook.md`)
- 2026-06-25 AppsFlyer aggregate CSV summarized in that runbook
- Purchase/cancel proxy carried through the same operating read via StoreKit purchase cancel counts

Daily operating counts in the current source bundle:

- Onboarding starts: **533**
- Paywall views / paywall reached: **448**
- Paywall CTA pressed: **317**
- Purchase attempts / initiated checkout: **94**
- Trial starts: **5**
- Paid conversions (`purchase` / `subscribe` events): **3**
- Active trials: **5** _(current available proxy = trial starts in the active read; no separate active-trial source field surfaced in today’s snapshot inputs)_
- Cancellations / early churn: **74** StoreKit purchase cancels

Funnel conversion checkpoints from the same read:

- Start → paywall: **84.1%**
- Paywall → CTA: **70.8%**
- CTA → initiated checkout: **29.7%**
- Initiated checkout → trial: **5.3%**
- Start → trial: **0.9%**

## Source Split

Source basis:

- Organic vs Apple Search Ads split from the Macra AppsFlyer aggregate read in `docs/agents/macra-operating-runbook.md`
- Do **not** combine `macra_subscription_web_checkout_started` with `af_initiated_checkout` as unique checkout users without person-level dedupe

### Apple Search Ads

- Onboarding starts: **127**
- Paywall reached: **98**
- Paywall CTA pressed: **64**
- Initiated checkout: **15**
- Trial starts: **3**
- Purchases / subscribes: **3**
- StoreKit purchase cancels: **9**
- Start → trial: **2.4%**
- Checkout → trial: **20.0%**

### Organic

- Onboarding starts: **406**
- Paywall reached: **350**
- Paywall CTA pressed: **253**
- Initiated checkout: **79**
- Trial starts: **2**
- Purchases / subscribes: **0**
- StoreKit purchase cancels: **65**
- Start → trial: **0.5%**
- Checkout → trial: **2.5%**

### Retargeting

- No standalone retargeting funnel-count breakout surfaced in the current Scoreboard aggregate read.
- Treat retargeting as **not separately quantified** in this section until the retargeting-state source is pulled into later steps.

### Other / Unknown

- No separate other / unknown acquisition bucket surfaced in the current aggregate read.
- Current quantified source split is effectively **Organic + Apple Search Ads = Total** for the operating snapshot artifact.

## Experiment Freshness

> Fill from the current Macra Experiments artifact, especially active `variant_a` reads and last-refresh timing.

- Active experiments:
- Last refresh timestamp:
- Fresh vs stale assessment:
- Decision risk from stale reads:

## Guardrails

> Fill from cancel reasons, paywall dismissal behavior, retargeting pressure, user-state checks, and AppsFlyer coverage gaps.

- Cancel-signal guardrail:
- Paywall-dismissal guardrail:
- Retargeting-pressure guardrail:
- Event-semantics / trust guardrail:
- AppsFlyer coverage guardrail:

## Agent Findings

> Add exactly one explicit finding per operating input owner/source.

- **Scoreboard:**
- **Experiments:**
- **Purchase Logs:**
- **Cancel Reasons:**
- **Retargeting State:**
- **AppsFlyer Coverage:**

## Nora Decision

> Record the single operating decision for the day, including hold/increase/refine posture and the metric/guardrail expectation tied to that choice.

- Decision:
- Why now:
- Expected metric movement:
- Guardrail to watch next:
