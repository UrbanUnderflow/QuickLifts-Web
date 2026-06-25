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

Source basis:

- Macra experiment-health evidence bundle in `docs/research/publish-a-daily-macra-kpi-snapshot-from-scoreboard-experiments-p-health-evidence-2026-06-25.md`
- Macra operating runbook current read in `docs/agents/macra-operating-runbook.md`

Current freshness call:

- Active experiment family in scope: **`variant_a`**
- Last experiment snapshot used in the current operating bundle: **2026-06-25 research + runbook refresh**
- Fresh vs stale assessment: **Mixed / operationally stale for decisioning**
- Why mixed: the score bundle is fresh enough to describe top-of-funnel behavior today, but the experiment layer is **not fresh enough to approve a new funnel move with confidence** because the active `variant_a` read is still being interpreted through blended aggregate evidence rather than a clean, current, experiment-isolated scoreboard refresh.
- Decision risk from stale reads: **High enough to block expansion decisions** — especially any paid scaling or paywall copy winner call that assumes `variant_a` is a proven lift rather than an in-progress signal.

Practical freshness posture for today:

- Treat current experiment output as **observe-only**, not **ship-the-winner** evidence.
- Do **not** declare a winning funnel move from the current `variant_a` read until the experiment snapshot is refreshed against the latest scoreboard inputs and acquisition split.

## Guardrails

Source basis:

- Macra health evidence bundle in `docs/research/publish-a-daily-macra-kpi-snapshot-from-scoreboard-experiments-p-health-evidence-2026-06-25.md`
- Macra decision-log / risk brief in `docs/research/maintain-a-macra-decision-log-tying-every-operational-change-to--competitive-brief-2026-06-25.md`
- Current operating aggregate in `docs/agents/macra-operating-runbook.md`

- Cancel-signal guardrail: **Holding, but stressed.** The current source bundle shows **74 StoreKit purchase cancels**, with the burden materially heavier on organic traffic (**65 organic vs 9 Apple Search Ads**). That is not a stop-ship event by itself, but it is too large to ignore when trial starts are only **5**.
- Paywall-dismissal guardrail: **Partially observable, not fully green.** The current bundle gives a strong paywall drop pattern (**448 paywall reached → 317 CTA pressed → 94 initiated checkout**), which is enough to flag friction, but today’s source set does **not** give a fully segmented dismissal-reason artifact. Treat this as a caution flag rather than a cleared guardrail.
- Retargeting-pressure guardrail: **Not yet verified.** The current aggregate read does not provide a standalone retargeting-state breakout, so frequency / pressure cannot be marked safe from this step alone. Until the retargeting-state source is pulled in, assume pressure is **unverified** rather than acceptable.
- Event-semantics / trust guardrail: **Not holding cleanly enough to scale.** The operating bundle explicitly warns against combining `macra_subscription_web_checkout_started` with `af_initiated_checkout` as unique checkout users without person-level dedupe. That means checkout-stage event semantics are still noisy enough that scaling on raw checkout totals would overstate certainty.
- AppsFlyer coverage guardrail: **Partial coverage only.** AppsFlyer is good enough today to separate **Apple Search Ads vs Organic** at the aggregate level, but not good enough to support every source-state question in the operating system. Coverage is sufficient for directional source quality, insufficient for full retargeting and perfect checkout dedupe.

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
