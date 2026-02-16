# Heartbeat OS Workstreams — Research & Planning Notes (2026-02-16)

This plan consolidates the technical scope for the three heartbeat OS workstreams described in `docs/heartbeat-os-workstreams.md` so we have a single reference before deeper execution. Owners match the Feb 16 round-table assignments.

## 1. Feed Taxonomy & Prediction Schema (HB-01)
- **Goal:** Provide structured definitions so Progress Timeline + automation know how to tag beats, artifacts, idle thresholds, and predictions.
- **Inputs:**
  - `docs/heartbeat/shared-definitions-preflight.md` — color semantics, beat taxonomy, idle matrix.
  - `docs/heartbeat-kanban-tickets.md` — preliminary template notes.
  - `docs/heartbeat/2026-02-16-round-table-action-items.md` — deliverable list.
- **Planned Work:**
  1. Expand `src/api/firebase/feedTaxonomy/{types,service}.ts` to align with glossary (task type, duration, artifact requirement, idle thresholds, cadence).
  2. Add prediction scoreboard schema/API in `src/api/firebase/predictionScoreboard` (fields: objectiveCode, headline, confidence%, expected trigger, observed delta, felt-sense, status).
  3. Document usage patterns in `/docs/heartbeat/progress-timeline-usage.md` (link scoreboard entries to Progress Timeline + KanBan).
- **Owners:** Scout (primary), Solara (narrative cues), Sage (idle linkage).

## 2. Progress Timeline + Nudge Log UI (HB-02)
- **Goal:** Surface the three-beat story and nudge history inside `ProgressTimelinePanel.tsx`.
- **Inputs:**
  - Existing panel + service code (`src/components/virtualOffice/ProgressTimelinePanel.tsx`, `src/api/firebase/progressTimeline/service.ts`).
  - Nudge log service (`src/api/firebase/nudgeLog/service.ts`).
  - Hourly snapshot needs from automation plan.
- **Planned Work:**
  1. Ensure publish form captures objective code, lens tag, confidence color, artifact type (already scaffolded, verify final copy).
  2. Merge timeline + nudge feeds chronologically (Twitter-style cards) with badges for lane/channel/outcome.
  3. Render hourly snapshots (side rail) + expose datalist pills for lens rotation.
  4. Update `docs/heartbeat/progress-timeline-usage.md` with field checklist, QA steps, and dry-run instructions.
- **Owners:** Nora (UI + automation), Solara (lens prompts).

## 3. KanBan Color Logic + Hourly Automation (HB-03)
- **Goal:** Make `/src/pages/admin/projectManagement.tsx` the living source of objectives, colors, idle timers, and integrate hourly tracker.
- **Inputs:**
  - `laneMeta` definitions (Signals/Meanings) + Act I–III template.
  - `scripts/hourlyObjectiveTracker.js` automation spec.
  - `docs/heartbeat/kanban-lane-playbook.md` for hints messaging.
- **Planned Work:**
  1. Layout board as lane-first columns (Signals/Meanings) with Act-specific drop zones.
  2. Extend task forms to collect `objectiveCode`, `actOne/Two/Three`, `idleThresholdMinutes`, `lane`, `color`.
  3. Display objective code and three-beat snippet on every card; highlight idle status and allow Nora to log work beats.
  4. Automation script posts hourly snapshots + nudges (already drafted); document operations in `docs/heartbeat/hourly-objective-tracker.md` and wire npm script (`heartbeat:tracker`).
- **Owners:** Sage (KanBan + idle logic), Nora (hourly tracker), Scout/Solara (inputs for vibe + evidence cues).

## Pillar Narratives & Lens Rotation
- `docs/heartbeat/shared-definitions-preflight.md` locks the weekly lens playlist; Solara posts the weekly brief (Mon 8:45am ET) to the Progress Timeline.
- Pillar loops (Ops, Research, Brand, Automation) reference `docs/heartbeat/2026-02-16-round-table-action-items.md` for objective tracking.

## Next Steps
1. Confirm dependencies per the preflight checklist before moving each ticket to build.
2. Use this plan when updating the KanBan tickets (HB-01/02/03) so acceptance criteria remain traceable.
3. After execution, update this doc with actual completion timestamps and links to the final artifacts.
