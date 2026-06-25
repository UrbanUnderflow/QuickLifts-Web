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

_To be populated with funnel interpretation, quality read, and cancel-risk notes tied to the source artifacts._

### Apple Search Ads

_To be populated with funnel interpretation, quality read, and cancel-risk notes tied to the source artifacts._

## Recommendation

_To be populated with exactly one verdict — `increase`, `hold`, or `refine` — plus supporting bullets tied to the documented funnel metrics and cancel behavior._

## Sources

- _To be populated with the named AppsFlyer aggregate CSV artifact._
- _To be populated with the named Scoreboard source-split artifact._
