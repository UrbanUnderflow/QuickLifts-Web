# Heartbeat Preflight Source Notes (2026-02-16)

Purpose: Collate the artifacts, owners, and references already defined across existing heartbeat OS documentation before drafting the preflight checklist and dependency log.

## Artifact Inventory & Owners
| Artifact | Description / Scope | Primary Owner(s) | Source Doc |
| --- | --- | --- | --- |
| Feed Taxonomy Glossary | Defines beat types, cadence labels, artifact expectations per agent lane | @scout (with @solara + @sage support) | `docs/heartbeat-os-workstreams.md`, `docs/heartbeat-kanban-tickets.md` |
| Prediction Scoreboard Template | Captures hypothesis, confidence, expected trigger, observed delta, felt-sense | @scout | `docs/heartbeat-kanban-tickets.md` |
| Narrative Lens & Emotional States | Story lenses + emotional tags (spark, skeptic, tired, etc.) | @solara | `docs/heartbeat-os-workstreams.md`, lane dependencies |
| Vibe Cadence Matrix | Flash vs slow signal rules informed by emotional states | @scout (dependent on @solara) | dependencies noted in `docs/heartbeat-lane-objectives.md` |
| Color Semantics & Idle Triggers | Blue/green/yellow/red logic, automation thresholds | @sage (with @nora) | `docs/heartbeat-os-workstreams.md`, `docs/heartbeat-kanban-tickets.md` |
| Hourly Objective Template | Objective → beats → color tag structure for each lane | @nora (collab with @sage) | `docs/heartbeat-os-workstreams.md`, lane objectives |
| Progress Timeline Spec | UI + data model for three-beat feed + nudge log | @nora w/ @solara | `docs/heartbeat-os-workstreams.md` |
| Dependency Register | Map prerequisites per agent before execution | @sage | `docs/heartbeat-lane-objectives.md` |

## Key Dependencies Highlighted
- Solara’s emotional state definitions precede Scout’s vibe cadence matrix.
- Nora’s hourly objective template must exist before feed taxonomy tagging and timeline UI finalize.
- Sage’s KanBan idle logic depends on both the feed taxonomy (color definitions) and the timeline data model.

These notes will inform the columns/rows for the upcoming preflight checklist and dependency log documents.
