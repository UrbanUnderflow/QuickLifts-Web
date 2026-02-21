# Kanban Step 3 – Partnership-Led Section & Tickets Audit (2026-02-21)

**Step 3 requirement:**

> Insert a new section `## Partnership-Led Community Growth` into `project/kanban/board.md` and add 3–5 new tickets tagged with `NORTH_STAR: Partnership-Led Community Growth`, each describing a specific artifact to create or modify (for example, `web/app/partners/dashboard.tsx`, `web/components/BrandCampaignBanner.tsx`, `functions/computePartnerRetention.ts`).

## 1. Check for `## Partnership-Led Community Growth` section

From the top of `project/kanban/board.md`:

```md
# Kanban Board (Exported from Firestore kanbanTasks)

Exported At: 2026-02-20T23:08:17.003Z
## Partnership-Led Community Growth
```

The section header `## Partnership-Led Community Growth` already exists, immediately after the export header. No additional insertion is required.

## 2. Verify North-Star–tagged tickets and concrete artifacts

Under `## Partnership-Led Community Growth`, the board currently includes the following tickets (excerpted):

```md
### Harden partner onboarding API for time-to-first-round telemetry [BOARD-local-NS-API]

STATUS: todo
PROJECT: Partnership-Led Community Growth
THEME: Partnerships
ASSIGNEE: Nora ⚡️
LANE: meanings
COLOR: green
OBJECTIVE_CODE: NS-PARTNERSHIP-PIPELINE
NORTH_STAR: Partnership-Led Community Growth
CREATED_AT: 2026-02-20
UPDATED_AT: 2026-02-20
NOTES: Ensure src/pages/api/partners/onboard.ts reliably sets invitedAt and firstRoundCreatedAt and logs partner type so time-to-first-round can be measured per brand, gym, and runClub.

### Make partner dashboard the single pane of glass for time-to-first-round [BOARD-local-NS-DASHBOARD]

STATUS: todo
PROJECT: Partnership-Led Community Growth
THEME: Metrics
ASSIGNEE: Nora ⚡️
LANE: meanings
COLOR: yellow
OBJECTIVE_CODE: NS-PARTNERSHIP-DASHBOARD
NORTH_STAR: Partnership-Led Community Growth
CREATED_AT: 2026-02-20
UPDATED_AT: 2026-02-20
NOTES: Evolve web/app/partners/dashboard.tsx so partnership ops can see per-partner time-to-first-round, lane averages (brand/gym/runClub), and a clear "unblock next" list tied to the North Star.

### Codify partner playbooks as versioned config for all three lanes [BOARD-local-NS-PLAYBOOK]

STATUS: todo
PROJECT: Partnership-Led Community Growth
THEME: Foundations
ASSIGNEE: Nora ⚡️
LANE: meanings
COLOR: blue
OBJECTIVE_CODE: NS-PARTNERSHIP-PLAYBOOK
NORTH_STAR: Partnership-Led Community Growth
CREATED_AT: 2026-02-20
UPDATED_AT: 2026-02-20
NOTES: Treat config/partnerPlaybook.json and server/partners/playbookConfig.ts as the canonical partner onboarding playbook registry for brands, gyms, and run clubs; add fields needed for measurement against the Pulse-for-Communities narrative spine.

### Ship a branded surface for high-signal partner campaigns [BOARD-local-NS-CAMPAIGN-BANNER]

STATUS: todo
PROJECT: Partnership-Led Community Growth
THEME: Brand
ASSIGNEE: Nora ⚡️
LANE: signals
COLOR: red
OBJECTIVE_CODE: NS-PARTNERSHIP-CAMPAIGN
NORTH_STAR: Partnership-Led Community Growth
CREATED_AT: 2026-02-20
UPDATED_AT: 2026-02-20
NOTES: Design and implement web/components/BrandCampaignBanner.tsx to showcase co-branded challenges and campaigns sourced from tier-1 partners, wired to the partner playbook and dashboard telemetry.
```

These four tickets:

- Are scoped under the `## Partnership-Led Community Growth` section.
- Are explicitly tagged `NORTH_STAR: Partnership-Led Community Growth`.
- Reference **concrete artifacts**:
  - `src/pages/api/partners/onboard.ts`
  - `web/app/partners/dashboard.tsx`
  - `config/partnerPlaybook.json`
  - `server/partners/playbookConfig.ts`
  - `web/components/BrandCampaignBanner.tsx`

Additionally, the section contains further Partnership-Led tickets that support the same North Star, e.g.:

- `Partnership metrics: wire time-to-first-round into kanban & metrics` – metrics wiring.
- `Virtual Office: surface Partnership-Led Community Growth lane` – VO surfacing.
- `Partnership engine: verify partner onboarding pipeline end-to-end` – pipeline validation.

## 3. Step 3 outcome

The Step 3 requirements are already satisfied by the current `project/kanban/board.md`:

- The section header `## Partnership-Led Community Growth` is present near the top of the file.
- There are at least **four** tickets under this section tagged with `NORTH_STAR: Partnership-Led Community Growth`, each anchored to real artifacts in the codebase and config.

Because the section and tickets are already in place and correctly wired to concrete artifacts, no further edits to `project/kanban/board.md` were made for this step. This file serves as the audit record confirming that Step 3’s structural and North-Star alignment requirements have been fulfilled.
