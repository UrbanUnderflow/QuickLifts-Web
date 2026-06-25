# Macra Decision Log

This log records Macra operating decisions made by the agent team. It is intentionally narrow: decision, why now, expected metric movement, guardrails, owner, and follow-up date.

## 2026-06-25 - Move OpenClaw Agent Team To Macra Operating Posture

Decision: Treat Macra as the active agent mission. Use existing Macra Scoreboard, Experiments, User Management, Cancel Reasons, Purchase Logs, and AppsFlyer ingestion surfaces as the operating system.

Why now: The latest AppsFlyer aggregate CSV shows 533 onboarding starts and 5 trial starts across the saved range, with Apple Search Ads producing 3 of 5 trials and a 20.0% `af_initiated_checkout` to trial rate versus 2.5% for organic.

Expected metric movement: Better decision quality first. Primary metric is qualified onboarding start to trial start. No funnel lift should be credited until experiment results are refreshed and the next change is isolated.

Guardrails: StoreKit purchase cancels, checkout failure/cancel rate, under-18 or missing-birthdate blocks, trial activation after start, paid conversion after trial, and cancel reasons such as price, not ready, need more proof, or something broke.

Owner: Nora.

Follow-up: Refresh `/admin/experiments` results for active `variant_a`, then publish the first daily Macra operating snapshot.

Status: Active.

## 2026-06-25 - First Operating Cycle

selectedAction: Hold Apple Search Ads spend at the current level and refine the paywall / checkout trust path before scaling. Do not approve a broader acquisition increase off the current `variant_a` read. Source: `docs/ops/macra-operating-snapshot-2026-06-25.md`

whyNow: The first daily snapshot shows the bottleneck is downstream, not top-of-funnel: **533 onboarding starts** became **317 paywall CTA presses**, **94 initiated checkouts**, and only **5 trial starts**, while **74 StoreKit purchase cancels** indicate trust or fit pressure. Apple Search Ads quality is directionally stronger than organic, but the snapshot explicitly says the active `variant_a` experiment layer is **mixed / operationally stale for decisioning**, so scaling acquisition now would amplify noise faster than value. Source: `docs/ops/macra-operating-snapshot-2026-06-25.md`

expectedMetricMovement:

guardrails:

owner:

followUpDate:

status: Pending remaining first-cycle fields.

## Template

Decision:

Why now:

Expected metric movement:

Guardrails:

Owner:

Follow-up date:

Status:
