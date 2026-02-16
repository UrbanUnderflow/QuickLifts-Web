# Heartbeat OS Lane Objectives & Dependencies

This document captures the lane-specific objectives, expected deliverables, and dependency requirements for each heartbeat operating system ticket. Link this file inside each KanBan ticket so owners share a common definition of done.

---

## Lane 1 — Feed Taxonomy & Prediction Schema (Owner: Scout)
- **Objective Statement:** Deliver a canonical feed taxonomy and prediction logging system that captures beat types, cadence, and confidence so Nora can moderate signals reliably.
- **Expected Deliverables:**
  1. Shared glossary table (task type, typical duration, artifact, idle threshold, color tag) covering Scout, Solara, Sage, and Nora lanes.
  2. Feed posting criteria guide enumerating valid beats, proof-of-progress artifact examples, “flash vs slow” cadence cues, and when to post outside hypothesis changes.
  3. Prediction scoreboard template with headline, confidence %, expected trigger, observed delta, and felt-sense note fields.
  4. Source confidence legend (green/blue/yellow/red) aligned with Nora’s checklist.
- **Dependencies:**
  - Emotional state definitions + narrative lens tags from Solara to anchor vibe taxonomy.
  - Hourly objective template fields from Nora for consistent tagging.
  - Idle detection requirements from Sage so feed tags map to KanBan automation.

## Lane 2 — Progress Timeline & Nudge Log UI (Owner: Nora w/ Solara)
- **Objective Statement:** Produce the unified timeline + nudge log spec that visualizes beats, proof-of-progress clips, and nudges above the virtual File Cabinet.
- **Expected Deliverables:**
  1. Wireframe/component spec depicting the “three-beat story” feed with narrative lens callouts and the nudge log button.
  2. Data model covering feed entries, attachments, nudge events, and links back to objectives/KanBan cards.
  3. Hourly check-in automation script (trigger logic, prompt template, escalation steps) referencing color temperatures and idle thresholds.
  4. Proof-of-progress media criteria (acceptable formats/durations, tagging requirements) so agents know when/how to post.
- **Dependencies:**
  - Feed taxonomy outputs (Lane 1) for beat/color definitions.
  - KanBan idle thresholds (Lane 3) to ensure timeline signals drive nudges.
  - Narrative cues from Solara for emotional texture in the UI.

## Lane 3 — KanBan Color Logic & Hourly Objective Tracker (Owner: Sage)
- **Objective Statement:** Extend the KanBan system with color-coded states, dependency registers, and hourly objective templates to keep heartbeat work visible and actionable.
- **Expected Deliverables:**
  1. KanBan configuration doc (columns, color semantics, automation triggers for idle detection, integration hooks).
  2. Hourly objective template (fields: Objective, Beat status, Color tag, Dependencies, Next checkpoint, Owner) approved by Nora.
  3. Dependency register mapping each agent’s prerequisites before execution begins.
  4. Integration notes explaining how timeline/nudge events update KanBan card history and state transitions.
- **Dependencies:**
  - Finalized feed taxonomy + color legend (Lane 1).
  - Timeline data model + nudge automation specs (Lane 2) for signal ingestion.
  - Nora’s confirmation of hourly check cadence and moderation responsibilities.

---

### Usage
- Link this doc in each KanBan ticket’s description.
- Update dependency sections as upstream artifacts land (add dates + owners for traceability).
- Treat any unchecked dependency as a blocking item before moving a ticket into “build.”
