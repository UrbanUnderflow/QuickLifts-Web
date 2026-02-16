# Heartbeat OS KanBan Tickets

This backlog translation enumerates the three heartbeat operating-system workstreams as discrete KanBan tickets. Each ticket includes the objective, acceptance criteria, start criteria, ownership, and dependencies so it can be dropped directly into the board.

> Source context: See `docs/heartbeat-os-workstreams.md` for the underlying workstream summaries.

---

## Ticket 1 — Feed Taxonomy & Prediction Schema
- **Objective:** Ship a canonical Progress Feed taxonomy covering beat types, narrative lens tags, prediction logging, and confidence color rules so Nora can moderate posts without ambiguity.
- **Owner:** @scout (schema + prediction log) with collaborators @solara (narrative/emotional tagging) and @sage (integration requirements).
- **Acceptance Criteria:**
  1. Shared glossary table published in workspace with columns `Task Type | Typical Duration | Artifact | Idle Threshold | Color Tag` for every agent lane.
  2. Feed posting criteria documented (when to post, required tags, artifact examples, "flash vs slow" cadence cues).
  3. Prediction scoreboard template live with headline, confidence %, expected trigger, observed delta, and felt-sense note fields.
  4. Hourly objective template alignment with Nora confirmed so feed tags match objective format.
- **Start Criteria:**
  - Glossary template agreed upon by all agents.
  - Dependency list collected from @solara (vibe cadence matrix) and @sage (KanBan interface requirements).
- **Dependencies:**
  - Narrative lens + emotional tagging matrix from Solara.
  - Objective template + daily lens briefing cadence from Nora.
  - Idle detection signal requirements from Sage for downstream integration.

## Ticket 2 — Progress Timeline & Nudge Log UI
- **Objective:** Produce the combined Progress Timeline + Nudge Log specification so Nora can visualize beats, proof-of-progress clips, and nudges inside a single command-center view.
- **Owner:** @nora (product requirements + moderation workflow) with design partnership from @solara.
- **Acceptance Criteria:**
  1. Wireframe/component spec showing the timeline feed, beat states, narrative tags, and the "nudge log" control above the File Cabinet location.
  2. Data model describing feed entry structure (beat type, color, lens, attachment), nudge events, and linkage to objectives/KanBan cards.
  3. Automation rules for hourly check-ins documented (triggers, message format, escalation conditions, integration with feed color temperature).
  4. Proof-of-progress clip criteria defined (media formats, length, tagging) so agents know what qualifies as "work in flight" evidence.
- **Start Criteria:**
  - Feed taxonomy ticket has draft glossary + color definitions available for reference.
  - Nora confirms hourly objective template fields to embed in the UI.
- **Dependencies:**
  - Beat/Color definitions from Ticket 1.
  - Idle threshold expectations from Ticket 3 to ensure timeline signals map to KanBan updates.

## Ticket 3 — KanBan Color Logic & Hourly Objective Tracker
- **Objective:** Extend the KanBan system with color-coded states, dependency registers, and Nora’s hourly objective template so idle detection and narrative cues stay in sync with the heartbeat cadence.
- **Owner:** @sage, collaborating with @nora, @scout, and @solara.
- **Acceptance Criteria:**
  1. KanBan configuration doc detailing columns, color application rules (blue/listening, green/verified, yellow/friction, red/stalled), and automation triggers (e.g., yellow/red without "work in flight" beat for 2 hours → nudge).
  2. Hourly objective template finalized (fields: Objective statement, Beat status, Color tag, Dependencies, Next checkpoint) and adopted by all agents.
  3. Dependency register published enumerating prerequisite inputs for each agent before build work starts.
  4. Integration notes describing how timeline/nudge data updates KanBan card history and status.
- **Start Criteria:**
  - Color definitions + beat taxonomy from Ticket 1 locked.
  - Timeline data model outlines available so KanBan automation can subscribe to feed events.
- **Dependencies:**
  - Feed taxonomy outputs (Ticket 1).
  - Progress timeline data hooks (Ticket 2).
  - Nora’s hourly check-in automation requirements.

---

### Next Steps
1. Import these tickets into the KanBan tool under the "Heartbeat OS" initiative.
2. Tag each ticket with the appropriate color once the glossary is finalized.
3. Proceed to ownership confirmation and dependency documentation (steps 3-4 of the parent task).
