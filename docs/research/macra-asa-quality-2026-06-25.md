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

| Source | starts | af_initiated_checkout | trial starts | start-to-trial | checkout-to-trial |
|---|---:|---:|---:|---:|---:|
| Apple Search Ads | 127 | 15 | 3 | 2.4% | 20.0% |
| Organic | 406 | 79 | 2 | 0.5% | 2.5% |

Source: `docs/agents/macra-operating-runbook.md` ("Current Data Read" tables for the 2026-06-25 AppsFlyer aggregate CSV surfaced through the Macra Scoreboard source split at `/admin/emailSequences`, scoreboard tab). `start-to-trial` is computed from the same source-level counts as `trial starts / starts`.

## Recommendation

**Verdict: `refine`** Apple Search Ads focus.

Concrete reason: Apple Search Ads materially outperforms Organic on both core funnel quality rates — `start-to-trial` is `2.4%` vs `0.5%`, and `checkout-to-trial` is `20.0%` vs `2.5%` — but the underlying ASA sample is still small (`127` starts, `15` checkouts), so the right move is to refine and learn rather than scale aggressively. Source: `docs/agents/macra-operating-runbook.md`

## Sources

- _To be populated with the named AppsFlyer aggregate CSV artifact._
- _To be populated with the named Scoreboard source-split artifact._
