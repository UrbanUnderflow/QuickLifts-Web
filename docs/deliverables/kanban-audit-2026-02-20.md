# Kanban Audit – Partnership-Led Community Growth (2026-02-20)

This note records the initial scan of the shared kanban board ahead of restructuring it around the **Partnership-Led Community Growth** north star.

## Scope

- Source file: `project/kanban/board.md`
- Focus:
  - Tickets with `STATUS: BLOCKED`
  - Tickets with `STATUS: IN_PROGRESS`
  - `UPDATED_AT` timestamps older than ~14 days (before 2026-02-06)

## High-Level Observations

- There are multiple tickets marked `STATUS: BLOCKED`.
  - Some blocked tickets are missing explicit `BLOCKED_REASON:` / `DEPENDENCY:` lines.
  - Several blocked tickets have `UPDATED_AT` older than 14 days, indicating they may be stale or under-specified.
- There are tickets marked `STATUS: IN_PROGRESS` with `UPDATED_AT` older than 14 days.
  - Some of these appear unrelated to the current Partnership-Led Community Growth north star and may need to be moved back to backlog or deferred.

## Plan – Audit & Unblock Toward Partnership-Led Community Growth

### 1. Normalize Blocked Tickets

**Goal:** Every blocked ticket clearly states why it is blocked and what it depends on, so it can be unblocked or explicitly deferred.

Planned actions:

- For each `STATUS: BLOCKED` ticket:
  - If missing `BLOCKED_REASON:`, add a one-line reason using existing notes (e.g., "Waiting on brand approval for assets", "API not implemented", "Partner data missing from lead source of truth").
  - If missing `DEPENDENCY:`, add a pointer to the blocking artifact, such as:
    - An API route (`src/pages/api/...`)
    - A config file (`config/partnerPlaybook.json`)
    - A UI entry point (`web/app/partners/dashboard.tsx`)
    - An external dependency (e.g., Figma link, partner confirmation)

### 2. Carve Out a Partnership-Led Community Growth Lane

**Goal:** Make the North Star visible on the board and ensure there is a focused lane of tickets that drive partnership outcomes directly.

Planned actions:

- Add a new section:
  
  ```md
  ## Partnership-Led Community Growth
  ```

- Seed this section with 3–5 concrete tickets, each tagged:

  ```md
  NORTH_STAR: Partnership-Led Community Growth
  ```

- Candidate tickets:
  - **Partners dashboard hardening** – expand `web/app/partners/dashboard.tsx` with additional filters/segmentations needed for partner pitches.
  - **Playbook config v1.1** – refine `config/partnerPlaybook.json` based on first partner feedback and add IDs/metadata needed for analytics.
  - **API coverage** – document and validate `/api/partners/onboard` behavior in `docs/` and ensure it supports upcoming partner flows.
  - **Partner demo bundle** – create a pre-configured set of seed partners and rounds for demos (tied into existing seeding scripts or fixtures).

### 3. Triage Stale In-Progress Work

**Goal:** Reduce cognitive load on the board by cleaning up stale `IN_PROGRESS` tickets that don’t serve the current mission.

Planned actions:

- For each `STATUS: IN_PROGRESS` ticket with `UPDATED_AT` older than 14 days:
  - If **aligned** to Partnership-Led Community Growth:
    - Keep it in progress but add a quick note if it is blocked on something small (e.g., "Waiting on brand list from Scout").
  - If **not aligned** to the North Star:
    - Either change status to `STATUS: BACKLOG` and move it under a backlog section, **or**
    - Add `DEFERRED_REASON:` explaining why it is paused (e.g., "Deferred until after Q2 partnership milestones").

### 4. Validate After Changes

**Goal:** Ensure the board reflects reality and is usable by all agents (Nora, Scout, Solara, Sage).

Planned validation checklist (after edits in future steps):

- Every `STATUS: BLOCKED` ticket has both `BLOCKED_REASON:` and `DEPENDENCY:`.
- `## Partnership-Led Community Growth` exists with at least 3 tickets referencing real files/endpoints.
- No `STATUS: IN_PROGRESS` ticket has `UPDATED_AT` older than 14 days without either:
  - Being moved to backlog, or
  - Being annotated with `DEFERRED_REASON:`.

---

This audit and plan will guide the next steps, where we directly edit `project/kanban/board.md` to:
- Enrich blocked tickets with explicit reasons/dependencies
- Add a dedicated North Star section with concrete partnership tasks
- Clean up stale in-progress items that don’t support the current mission.
