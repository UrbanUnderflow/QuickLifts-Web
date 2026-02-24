# Kanban Step 3 – Partnership-Led Community Growth Section Runbook (2026-02-21)

**Goal:** Ensure `project/kanban/board.md` contains:

- A section header: `## Partnership-Led Community Growth`
- 3–5 tickets under this section, each tagged with `NORTH_STAR: Partnership-Led Community Growth`
- Each NORTH_STAR ticket references at least one concrete artifact (code or config file) aligned with the Partnership-Led Community Growth North Star.

As of this audit, the board already satisfies this condition with **5** NORTH_STAR tickets.

---

## 1. Verify the section header

From the repo root:

```bash
cd /Users/noraclawdbot/Documents/GitHub/QuickLifts-Web
grep -n "## Partnership-Led Community Growth" project/kanban/board.md
```

Expected output (line number may differ):

```text
2:## Partnership-Led Community Growth
```

If no line is returned, insert the section header near the top of `project/kanban/board.md`:

```md
## Partnership-Led Community Growth

<!-- NORTH_STAR tickets go here -->
```

---

## 2. Verify NORTH_STAR tickets and artifacts

List all NORTH_STAR tickets under this section:

```bash
grep -n "NORTH_STAR: Partnership-Led Community Growth" project/kanban/board.md
```

For the 2026-02-21 audit, the board contains 5 such tickets:

1. **Harden partner onboarding API for time-to-first-round telemetry [BOARD-local-NS-API]**
   - `NORTH_STAR: Partnership-Led Community Growth`
   - Artifacts: `src/pages/api/partners/onboard.ts`

2. **Make partner dashboard the single pane of glass for time-to-first-round [BOARD-local-NS-DASHBOARD]**
   - `NORTH_STAR: Partnership-Led Community Growth`
   - Artifacts: `web/app/partners/dashboard.tsx`

3. **Codify partner playbooks as versioned config for all three lanes [BOARD-local-NS-PLAYBOOK]**
   - `NORTH_STAR: Partnership-Led Community Growth`
   - Artifacts: `config/partnerPlaybook.json`, `server/partners/playbookConfig.ts`

4. **Ship a branded surface for high-signal partner campaigns [BOARD-local-NS-CAMPAIGN-BANNER]**
   - `NORTH_STAR: Partnership-Led Community Growth`
   - Artifacts: `web/components/BrandCampaignBanner.tsx`

5. **Surface Partnership-Led lane in Virtual Office project management view [BOARD-local-NS-VO-PANEL]**
   - `NORTH_STAR: Partnership-Led Community Growth`
   - Artifacts: `src/pages/admin/projectManagement.tsx`, `src/components/virtualOffice/VirtualOfficeContent.tsx`

These tickets align with concrete artifacts in the repo and are already present at the top of `project/kanban/board.md`.

---

## 3. How to add tickets if the section is missing or incomplete

If there are fewer than 3 NORTH_STAR tickets, add new ones in this format under the `## Partnership-Led Community Growth` header:

```md
### <Concise ticket title> [BOARD-local-NS-<SUFFIX>]

STATUS: todo
PROJECT: Partnership-Led Community Growth
THEME: <Partnerships | Metrics | Foundations | Brand | Virtual Office>
ASSIGNEE: Nora ⚡️
LANE: meanings
COLOR: <green | yellow | blue | red | purple>
OBJECTIVE_CODE: NS-PARTNERSHIP-<CODE>
NORTH_STAR: Partnership-Led Community Growth
CREATED_AT: YYYY-MM-DD
UPDATED_AT: YYYY-MM-DD
NOTES: Describe the artifact(s) to create or modify, e.g. src/pages/api/partners/onboard.ts or web/components/BrandCampaignBanner.tsx.
```

Each ticket should:

- Clearly state the artifact(s) it will touch.
- Map back to at least one of the North Star key objectives (onboarding speed, retention, revenue, etc.).

---

## 4. Status for 2026-02-21 audit

For this specific audit date:

- The `## Partnership-Led Community Growth` header **exists**.
- There are **5** NORTH_STAR tickets under this section.
- Each ticket references one or more concrete artifacts:
  - `src/pages/api/partners/onboard.ts`
  - `web/app/partners/dashboard.tsx`
  - `config/partnerPlaybook.json`
  - `server/partners/playbookConfig.ts`
  - `web/components/BrandCampaignBanner.tsx`
  - `src/pages/admin/projectManagement.tsx`
  - `src/components/virtualOffice/VirtualOfficeContent.tsx`

Therefore, Step 3 is **satisfied** on the current `project/kanban/board.md`.
