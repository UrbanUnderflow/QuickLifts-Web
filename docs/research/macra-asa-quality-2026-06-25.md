# Competitive Brief: Analyze Apple Search Ads versus Organic Quality

## Question

How does Apple Search Ads compare with Organic on Macra's source-level funnel quality across starts, paywall views, CTA progression, `af_initiated_checkout`, trial starts, cancels, and checkout-to-trial conversion, and should the team increase, hold, or refine ASA focus?

## Data Inputs

- **AppsFlyer aggregate input:** `2026-06-25 AppsFlyer aggregate CSV` — this is the exact artifact name preserved in `docs/agents/macra-operating-runbook.md` for the source-level funnel read used in this analysis. The exact uploaded CSV filename is **Unverified** in the repo, so I am not laundering a guessed filename into fact. The runbook ties this aggregate import to the Macra AppsFlyer ingestion/aggregate surfaces `appsflyer-aggregate-periods` and `appsflyer-scoreboards`. Source: `docs/agents/macra-operating-runbook.md`
- **Scoreboard source-split input:** `Macra Scoreboard` → `/admin/emailSequences` → `scoreboard` tab. This is the exact admin surface named in the runbook and in the prior KPI evidence memo as the source split used to compare `Organic` versus `Apple Search Ads`. Source: `docs/agents/macra-operating-runbook.md`; `docs/research/publish-a-daily-macra-kpi-snapshot-from-scoreboard-experiments-p-health-evidence-2026-06-25.md`
- **Query/export identifier for the Scoreboard aggregate read:** Firestore collection query on `appsflyer-aggregate-periods` with `where('product', '==', 'macra')`, rendered by the Macra scoreboard surface in `src/pages/admin/emailSequences.tsx`. This is the most exact machine-readable identifier present in the repo for the aggregate source split backing the scoreboard read. Source: `src/pages/admin/emailSequences.tsx`

## Source Split Table

| Source | starts | paywall | CTA | af_initiated_checkout | trial starts | cancels | checkout-to-trial |
|---|---:|---:|---:|---:|---:|---:|---:|
| Organic | 406 | 350 | 253 | 79 | 2 | 65 | 2.5% |
| Apple Search Ads | 127 | 98 | 64 | 15 | 3 | 9 | 20.0% |

Source: `docs/agents/macra-operating-runbook.md` ("Current Data Read" tables for the 2026-06-25 AppsFlyer aggregate CSV surfaced through the Macra Scoreboard source split at `/admin/emailSequences`, scoreboard tab)

## ASA vs Organic Quality Analysis

### Organic

- Organic is the clear **volume leader** at the top of the funnel, contributing `406` starts versus `127` from Apple Search Ads, plus higher raw counts at paywall (`350`) and CTA (`253`). If the question were pure reach, organic wins comfortably. Source: `docs/agents/macra-operating-runbook.md`; `docs/research/publish-a-daily-macra-kpi-snapshot-from-scoreboard-experiments-p-health-evidence-2026-06-25.md`
- Organic also looks **cleaner before checkout** on funnel continuity: start→paywall is `86.2%` versus `77.2%` for Apple Search Ads, paywall→CTA is `72.3%` versus `65.3%`, and CTA→`af_initiated_checkout` is `31.2%` versus `23.4%`. That suggests weaker early-funnel mechanics are not the main problem for organic traffic. Source: `docs/agents/macra-operating-runbook.md`
- The quality break happens **after checkout initiation**. Organic converts only `2` trial starts from `79` `af_initiated_checkout` events, or `2.5%` checkout-to-trial, which is dramatically weaker than Apple Search Ads at the same stage. This is the strongest disconfirming signal against the idea that organic is the healthier source overall. Source: `docs/agents/macra-operating-runbook.md`; `docs/research/publish-a-daily-macra-kpi-snapshot-from-scoreboard-experiments-p-health-evidence-2026-06-25.md`
- Organic also carries the heavier visible **cancel burden** in the current source split: `65` StoreKit purchase cancels versus `9` for Apple Search Ads. Without a person-level denominator, cancel rate should be interpreted carefully, but the absolute cancel load is still a trust-risk signal attached more heavily to organic traffic in this read. Source: `docs/agents/macra-operating-runbook.md`; `docs/ops/macra-operating-snapshot-2026-06-25.md`

### Apple Search Ads

- Apple Search Ads trails organic on **raw volume** and on the earlier funnel steps: `127` starts, `98` paywall reaches, and `64` CTA presses versus organic's `406`, `350`, and `253`. It is not outperforming because it delivers more traffic or because the upper funnel is universally cleaner. Source: `docs/agents/macra-operating-runbook.md`
- Apple Search Ads also underperforms organic on **pre-checkout continuity** with `77.2%` start→paywall, `65.3%` paywall→CTA, and `23.4%` CTA→`af_initiated_checkout`, all below organic. That matters because it rules out the lazy conclusion that ASA is simply better at every stage. Source: `docs/agents/macra-operating-runbook.md`
- Where Apple Search Ads clearly overperforms is **post-checkout conversion quality**: `3` trial starts from `15` `af_initiated_checkout` events, or `20.0%` checkout-to-trial, versus organic's `2.5%`. That is the strongest current signal that ASA traffic is materially higher intent or better matched once users cross the checkout threshold. Source: `docs/agents/macra-operating-runbook.md`; `docs/research/publish-a-daily-macra-kpi-snapshot-from-scoreboard-experiments-p-health-evidence-2026-06-25.md`
- Apple Search Ads shows a lower visible **cancel burden** in this aggregate read (`9` cancels vs `65` organic), but that should be treated as directional rather than definitive cancel-rate proof until person-level reconciliation confirms denominator alignment across sources. Even with that caveat, ASA is currently the less alarming source on cancel risk. Source: `docs/agents/macra-operating-runbook.md`; `docs/ops/macra-operating-snapshot-2026-06-25.md`

## Recommendation

_To be populated with exactly one verdict — `increase`, `hold`, or `refine` — plus supporting bullets tied to the documented funnel metrics and cancel behavior._

## Sources

- _To be populated with the named AppsFlyer aggregate CSV artifact._
- _To be populated with the named Scoreboard source-split artifact._
