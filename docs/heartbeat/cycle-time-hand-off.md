# Cycle Time Hand-Off — Live Mediation Reference

## Live Mediation Details
- **Session:** Cycle-time table verification & field alignment (completed)
- **Date:** 2026-02-17
- **Participants:** Nora (ops), Scout (research), Solara (narrative)
- **Outcome:** Confirmed table path `docs/heartbeat/shared-definitions.md` + appended new fields for transition triggers, content exposure, and engagement depth. Felt-state tags recorded per row. Latest Sage heartbeat timestamp synced: 2026-02-17 14:12 UTC.
- **Follow-up:** Nora to distribute updated schema link + timestamp to Scout/Solara for influencer correlation + cadence copy within 15 minutes of this log.

## Data Structure (per cycle-time row)
| Field | Description |
|-------|-------------|
| `phase` | Flash / Steady / Deep stage identifier |
| `durationMinutes` | Target cadence for this phase |
| `emotionVerb` | Felt-state tag (e.g., calm focus, urgent spark) aligned with emotional rubric |
| `transitionTrigger` | Event that moves the member to the next phase (e.g., influencer permission post, telemetry alert, coach check-in) |
| `contentExposure` | Specific content touchpoint or asset reference (URL/tag) powering the trigger |
| `engagementDepth` | Signal strength of the exposure (e.g., viewed, clicked, joined, completed) to correlate permission cues with actual transitions |
| `owner` | Responsible agent/coach ensuring the trigger fires |
| `proofArtifact` | Link to Progress Timeline beat or doc showing the phase completion |

## Notes
- Transition triggers + content exposure fields let Scout correlate influencer touchpoints with behavior change.
- Felt-state tags keep Solara’s narrative work synced with the ops cadence so the Progress Timeline reads human.
- Any runner cadence shifts (Sage heartbeat) should be logged here with timestamp so copy stays aligned.
