# Macra ASA Quality Read Plan - 2026-06-30

## Objective

Plan the remaining work for `docs/research/macra-asa-quality-2026-06-30.md`: separate Apple Search Ads from organic quality, use cancel reasons and paywall dismissal behavior, and propose exactly one lifecycle copy, proof, or offer change without making any live funnel, budget, pricing, retargeting, or experiment changes.

## Step Scope

This file is the research-and-plan artifact for step 1 only. It names the evidence to read, the calculations to verify, and the decision boundary for the next execution pass. It does not approve a paid acquisition change and does not update live spend, funnel copy, pricing, offers, retargeting, or experiment allocation.

## Source Artifacts To Use

- Target deliverable: `docs/research/macra-asa-quality-2026-06-30.md`
- Scoreboard / AppsFlyer freshness snapshot: `docs/ops/macra-operating-snapshot-2026-06-30.md`
- Saved ASA versus organic source split: `docs/research/macra-asa-quality-2026-06-25.md`, `docs/agents/macra-operating-runbook.md`, `.agent/macra/state.json`
- Cancel reasons: `/admin/macraCancelReasons`, Firestore `Macrafeedbackreason`, `.agent/macra/decisions.md`
- Paywall dismissal and checkout pressure: `.agent/macra/state.json`, `docs/ops/macra-operating-snapshot-2026-06-25.md`, `docs/ops/macra-operating-snapshot-2026-06-30.md`, Firestore `Macra-purchase-logs`
- Experiment freshness guardrail: `.agent/macra/state.json`, `/admin/experiments`, Firestore `macra-experiment-results/macra_paywall_onboarding`

## Known Facts Before Execution

- AppsFlyer Scoreboard aggregate CSV coverage ends on `2026-06-25`, so June 28-30 source-level movement is stale or unverified.
- The saved ASA versus organic split is small: Apple Search Ads has `3` trial starts from `127` starts, and organic has `2` trial starts from `406` starts.
- Apple Search Ads is stronger after checkout initiation in the saved split, but the signal is only `5` total trial starts.
- Firestore `Macrafeedbackreason` has been summarized as `69` production cancel-feedback rows led by price, not ready, need proof, something did not work, and Apple sheet confusion.
- Purchase-log pressure remains a guardrail: the June 30 operating snapshot records canceled and failed purchase rows around the same period as the small trial-start signal.
- Active `variant_a` exists, but `.agent/macra/state.json` says saved `/admin/experiments` results are stale from `2026-06-16` and still reflect retired hard-paywall context.

## Execution Plan For Next Step

1. Update the `ASA vs Organic Funnel Table` with the required `data date range` column while preserving the saved source-split metrics.
2. Populate `Cancel Reasons + Paywall Dismissal Readout` with 3-5 bullets that explicitly label observed facts versus inference.
3. Use cancel reasons and paywall drop-off to decide whether the next single test should be lifecycle copy, proof, or offer.
4. Fill `One Proposed Change` with exactly one structured change containing `targetSurface`, `changeType`, `proposedChange`, `expectedMetric`, `guardrailMetric`, and `operatorApprovalRequired: true`.
5. Keep `Paid Acquisition Recommendation` to exactly one verdict: `increase`, `hold`, or `refine`, supported by one concrete reason and the sample-size caveat.

## Paid Acquisition Decision Criteria

- **Increase** only if refreshed source-specific coverage confirms Apple Search Ads still outperforms organic on qualified onboarding start to trial start and does not increase checkout cancel or purchase-cancel pressure.
- **Hold** if Apple Search Ads outperforms organic in the saved split but the signal remains stale, low-sample, or missing June 28-30 source attribution.
- **Refine** if Apple Search Ads traffic is directionally stronger but the trust leak appears concentrated in paywall proof, checkout confusion, or source-message mismatch that should be fixed before more spend.

## Validation Plan

- Verify the target file contains the required sections and no stale section names.
- Verify the ASA table has exactly two rows: `Apple Search Ads` and `Organic`.
- Recompute `start-to-trial` as `trial starts / starts`.
- Recompute `checkout-to-trial` as `trial starts / af_initiated_checkout`.
- Confirm observed facts and inferences are labeled separately in the cancel and paywall dismissal readout.
- Confirm the proposed change is exactly one change and includes `operatorApprovalRequired: true`.
- Confirm the recommendation does not authorize live spend, pricing, funnel, retargeting, or experiment changes.
