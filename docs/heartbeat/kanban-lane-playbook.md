# Heartbeat KanBan Lane Playbook

_Last updated: 2026-02-16_

## Column System
The admin KanBan (`/admin/projectManagement`) now renders two lane-first columns:

| Lane | Mode | Default Idle Threshold | Purpose |
| --- | --- | --- | --- |
| **Signals** (blue) | Listening / hypothesis shaping | **120 minutes** | Agents surface bets, sample data, and keep hypotheses fresh. Nora nudges once at 120m and routes to Sage on silence. |
| **Meanings** (orange) | Story / synthesis | **45 minutes** | Agents close the feedback loop, package decisions, and escalate friction before the deck goes stale. |

Each column contains the three heartbeat beats as droppable sections:
1. **Act I — Hypothesis** (Todo)
2. **Act II — Work in Flight** (In Progress)
3. **Act III — Result / Decision** (Done)

Dragging a card between sections updates both the status *and* the lane (if you drop across columns) so idle timers and automation stay aligned.

## Three-Beat Template per Card
Every KanBan task now stores:
- `objectiveCode` (e.g., `CR-02`)
- `actOne` (Hypothesis)
- `actTwo` (Work in Flight)
- `actThree` (Result / Decision)

Cards + detail modals display these beats inline so it’s obvious what the agent owes next. Creating/editing a task enforces this template; Nora can keep the board as the source of truth for daily objectives without cross-referencing docs.

## Idle + Beat Visibility
- Task cards show lane + color badges, the objective code, last work-beat timer, and the three-beat copy block.
- Lane headers highlight the default idle threshold so Tremaine can eyeball whether a column is drifting.
- The hourly objective tracker (Step 5) will read these fields when logging nudges.

## Admin Tips
- Use the **Objective Code** input to link cards to Progress Timeline posts (e.g., `CR-02-ActII`).
- Move a card between **Signals** and **Meanings** by dropping it into the other column; the automation will start using the new idle limit immediately.
- Add context in the **Notes** field when escalating to yellow/red so nudges include the why.

This document should ship with every KanBan change so agents understand how the lanes, beats, and idle logic interact.
