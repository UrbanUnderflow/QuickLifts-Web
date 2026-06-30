# Macra Agent Runbook

## Source Of Truth

Use these surfaces before making a recommendation:
- Macra Scoreboard under the Email Sequence surface.
- `/admin/experiments`.
- `/admin/purchaseLogs`.
- `/admin/macraCancelReasons`.
- AppsFlyer CSV imports.
- Retargeting state and email sequence state.
- Firestore docs or committed artifacts when they are the source of a calculation.

## Daily Run

Nora:
1. Confirm AppsFlyer CSV coverage and Scoreboard freshness.
2. Refresh or flag `/admin/experiments` if the saved results are stale.
3. Create `docs/ops/macra-operating-snapshot-YYYY-MM-DD.md`.
4. Post a PulseCommand operator update with one decision or one explicit no-change decision.
5. Update `.agent/macra/progress.md` and `.agent/macra/decisions.md` when a decision changes the operating plan.

Scout:
1. Split Apple Search Ads and organic performance.
2. Compute start-to-trial and checkout-to-trial.
3. Recommend increase, hold, or refine.
4. Name one reason and one next measurement.

Solara:
1. Review cancel reasons, paywall dismissal, and retargeting state.
2. Propose exactly one copy, proof, or offer change.
3. Tie the change to a metric and guardrail.

Sage:
1. Audit event semantics for `af_start_trial`, `af_purchase`, `af_subscribe`, `purchase_cancelled`, `web_checkout_started`, and StoreKit cancel.
2. Check age eligibility and activation-quality signals.
3. Flag any ambiguity that could make the team scale a misleading signal.

## Weekly Run

Nora leads a weekly decision on whether the active experiment should continue, pause, or move to a new design. Scout brings source quality, Solara brings conversion/lifecycle evidence, and Sage brings trust/product-quality risk.

## Output Rules

Every Macra artifact must include:
- Data date range.
- Source surface or artifact path.
- Facts versus inference.
- One recommendation or an explicit no-change recommendation.
- Primary metric.
- Guardrail.
- Decision-log impact.
