# Macra Operating Snapshot — 2026-06-25

## Context

- **Operating system:** Macra Trial-Start Operating System
- **Snapshot date:** 2026-06-25
- **Purpose:** Daily operating artifact for funnel health, source quality, experiment freshness, trust guardrails, and the final operator decision.
- **Status:** Scaffold created; data population pending in subsequent steps.

## Funnel Counts

> Fill from the current Macra Scoreboard artifact and the purchase-log source of truth.

- Trial starts:
- Paywall views:
- Purchase attempts:
- Paid conversions:
- Active trials:
- Cancellations / early churn:

## Source Split

> Fill from the Scoreboard + purchase-log source split, separating Apple Search Ads from organic and any other available source buckets.

- Apple Search Ads:
- Organic:
- Retargeting:
- Other / Unknown:

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
