# Competitive Brief: Analyze Apple Search Ads versus Organic Quality

## Question

How does Apple Search Ads compare with Organic on Macra's source-level funnel quality across starts, paywall views, CTA progression, `af_initiated_checkout`, trial starts, cancels, and checkout-to-trial conversion, and should the team increase, hold, or refine ASA focus?

## Input Artifacts

- **AppsFlyer aggregate CSV filename/path used for the comparison:** `2026-06-25 AppsFlyer aggregate CSV`, as named in `docs/agents/macra-operating-runbook.md`. The exact uploaded CSV filesystem path is **Unverified** in the repo — there is no checked-in raw CSV file with a more specific path or filename to cite safely. Source path: `docs/agents/macra-operating-runbook.md`
- **Exact Scoreboard source-split surface used for the comparison:** `Macra Scoreboard` at `/admin/emailSequences` → `scoreboard` tab, documented in `docs/agents/macra-operating-runbook.md` and referenced again in `docs/research/publish-a-daily-macra-kpi-snapshot-from-scoreboard-experiments-p-health-evidence-2026-06-25.md`. Source paths: `docs/agents/macra-operating-runbook.md`; `docs/research/publish-a-daily-macra-kpi-snapshot-from-scoreboard-experiments-p-health-evidence-2026-06-25.md`
- **Exact Scoreboard query/export identifier available in-repo:** Firestore collection query on `appsflyer-aggregate-periods` with `where('product', '==', 'macra')`, rendered by the Macra scoreboard code in `src/pages/admin/emailSequences.tsx`. This is the most exact export/query reference present in the codebase for the source split used to build the comparison. Source path: `src/pages/admin/emailSequences.tsx`
- **Exact source-level funnel metrics input used for this read:** the `Current Data Read` tables in `docs/agents/macra-operating-runbook.md`, which enumerate source-split counts and rates for `Onboarding starts`, `Paywall reached`, `Paywall CTA pressed`, `af_initiated_checkout`, `Trial starts`, and the derived rates `Start to trial` and `af_initiated_checkout to trial` for `Organic` and `Apple Search Ads`. Source path: `docs/agents/macra-operating-runbook.md`

## Active Experiment

- **Active experiment surface to refresh before funnel decisions:** `/admin/experiments`, as named in the Macra operating runbook and implemented in the admin experiments surface. Source paths: `docs/agents/macra-operating-runbook.md`; `src/pages/admin/experiments.tsx`
- **Active `variant_a` identifier:** `variant_a` on the `macra-experiments/macra_paywall_onboarding` experiment. The runbook states the live config should be `variant_a`, and the experiments tooling shows `variant_a` as the enabled variant. Source paths: `docs/agents/macra-operating-runbook.md`; `src/pages/admin/experiments.tsx`; `scripts/setMacraExperimentFlow.js`
- **Active `variant_a` label / posture being refreshed:** `Monthly + annual, both with trial`, described in the runbook as the live config and in the experiments tooling as the only enabled live variant. Source paths: `docs/agents/macra-operating-runbook.md`; `src/pages/admin/experiments.tsx`; `scripts/setMacraExperimentFlow.js`
- **Refresh caveat before using variant performance:** the runbook explicitly notes that saved `/admin/experiments` result snapshots can be stale and that the first operational task is to backfill/refresh experiment results before using variant performance for decisions. Source path: `docs/agents/macra-operating-runbook.md`

## ASA vs Organic Funnel Table

| Source | starts | paywall | CTA | af_initiated_checkout | trial starts | cancels | checkout-to-trial |
|---|---:|---:|---:|---:|---:|---:|---:|
| Organic | 406 | 350 | 253 | 79 | 2 | 65 | 2.5% |
| Apple Search Ads | 127 | 98 | 64 | 15 | 3 | 9 | 20.0% |

Source: `docs/agents/macra-operating-runbook.md` ("Current Data Read" tables for the 2026-06-25 AppsFlyer aggregate CSV surfaced through the Macra Scoreboard source split at `/admin/emailSequences`, scoreboard tab)

## Recommendation

**Verdict: `refine`** Apple Search Ads focus.

- Apple Search Ads has the strongest current **post-checkout quality signal** in the source split: `3` of `5` total trial starts and `20.0%` checkout-to-trial versus organic at `2.5%`. That is strong enough to protect and study, but not strong enough to justify blind scaling because the absolute sample is still tiny (`15` ASA checkouts). Source: `docs/agents/macra-operating-runbook.md`; `docs/research/publish-a-daily-macra-kpi-snapshot-from-scoreboard-experiments-p-health-evidence-2026-06-25.md`
- Apple Search Ads is **not outperforming organic at the upper funnel**. Organic beats ASA on starts (`406` vs `127`), paywall (`350` vs `98`), CTA (`253` vs `64`), and every early conversion step before checkout. That means the current ASA edge looks more like downstream intent quality than broad funnel superiority, so the right move is to refine keyword/creative/source matching instead of simply buying more traffic. Source: `docs/agents/macra-operating-runbook.md`
- The system-level **guardrail is still stressed**: the aggregate read shows `74` StoreKit purchase cancels overall, including `9` tied to Apple Search Ads and `65` to organic. Even though ASA looks less risky than organic on the visible cancel burden, the broader checkout/trial trust layer is not healthy enough to support an "increase" decision yet. Source: `docs/agents/macra-operating-runbook.md`; `docs/ops/macra-operating-snapshot-2026-06-25.md`

## Sources

- _To be populated with the named AppsFlyer aggregate CSV artifact._
- _To be populated with the named Scoreboard source-split artifact._
