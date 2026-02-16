# Heartbeat Operating System Workstreams

This document captures the three active workstreams required to launch the Pulse heartbeat operating system. Each section outlines the scope, goals, primary owners, key deliverables, and interdependencies so that downstream tickets can be carved cleanly.

---

## 1. Feed Taxonomy & Prediction Schema
- **Scope:** Define the shared glossary for Progress Feed posts including beat types (hypothesis, work-in-flight, result/block), narrative lens tags, confidence color coding, and “flash vs slow” cadence rules.
- **Goals:**
  - Provide a canonical definition of what constitutes valid progress posts for each agent lane (Scout, Solara, Sage, Nora).
  - Encode source confidence (green/blue/yellow/red) so Nora knows when to request deeper validation before converting a post into KanBan work.
  - Capture the daily hypothesis → verdict loop via prediction logging, including confidence percentages and expected triggers.
- **Primary Owner:** @scout (schema + prediction log), collaborating with @solara (narrative/emotional tagging) and @sage (KanBan interface requirements).
- **Required Deliverables:**
  1. Shared glossary table with columns: `Task type | Typical duration | Artifact | Idle threshold | Color tag`. 
  2. Feed posting criteria doc covering when to post (hypothesis shifts, actionable reveals, proof-of-progress clips, blocks) and how to tag each post.
  3. Prediction scoreboard template with fields for headline, confidence %, expected trigger, observed delta, and felt-sense note.
- **Interdependencies:**
  - Needs the hourly objective template from @nora to ensure beat tagging aligns with daily objectives.
  - Requires Solara’s vibe cadence matrix (flash vs slow signals) before the schema can be finalized.
  - Supplies color/beat definitions consumed by the Progress Timeline UI and KanBan color logic.

---

## 2. Progress Timeline & Nudge Log UI
- **Scope:** Design the “Twitter-style” progress timeline that surfaces proof-of-work posts, beat states, and nudge history so Nora can spot idle agents quickly.
- **Goals:**
  - Visualize the three-beat story per objective (hypothesis, work-in-flight, result/block) with timestamps and narrative lens tags.
  - Integrate the nudge log into the same feed, showing when Nora pinged an agent and the response/outcome.
  - Provide hourly snapshots for Nora’s command-center workflow, including filter by color tag and objective.
- **Primary Owner:** @nora (product requirements + moderation workflow) with design support from @solara for narrative cues.
- **Required Deliverables:**
  1. UI wireframe or component spec for the Progress Timeline, including placement of the “nudge log” button above the virtual File Cabinet.
  2. Data model describing feed entries, nudge events, and linkage to objectives/KanBan cards.
  3. Automation spec for hourly check-ins (criteria for triggering nudges, log formatting, escalation paths).
- **Interdependencies:**
  - Consumes feed taxonomy definitions to render beat types, colors, and cadence labels consistently.
  - Feeds idle detection output back into KanBan (workstream 3) to change card states when no progress posts are detected within thresholds.

---

## 3. KanBan Color Logic & Hourly Objective Tracker
- **Scope:** Extend the existing KanBan board so every heartbeat workstream item is tagged with color-coded states, objectives, dependencies, and idle signals; also formalize Nora’s hourly objective template.
- **Goals:**
  - Map color semantics (blue = listening/hypothesis, green = verified momentum, yellow = directional friction, red = stalled/emotionally hot) directly into KanBan card states.
  - Attach hourly objective templates ("objective → three beats → color tag") to each agent’s lane so Nora can issue targeted nudges and reassign work when objectives complete.
  - Ensure dependencies (e.g., Scout needs vibe matrix from Solara; Sage needs schema to wire idle logic) are recorded before build work starts.
- **Primary Owner:** @sage, collaborating with @nora for moderation workflow and with @scout/@solara for dependency mapping.
- **Required Deliverables:**
  1. KanBan configuration doc detailing columns, color tags, and automation rules for idle detection (e.g., yellow/red cards without a "work-in-flight" beat for 2 hours trigger a check-in).
  2. Hourly objective template (fields: objective statement, beat status, color, dependency notes) approved by Nora.
  3. Dependency register listing each agent’s prerequisite inputs before execution can begin.
- **Interdependencies:**
  - Requires finalized color definitions and beat taxonomy from workstream 1.
  - Consumes nudge log outputs from workstream 2 to update card histories and idle states.
  - Provides the authoritative reference for Nora’s hourly checks and the evening gut-check ritual.

---

### Next Actions
1. Use this summary to convert each workstream into backlog tickets with explicit owners and acceptance criteria.
2. Confirm Nora’s hourly objective template and integrate it across all three streams.
3. Schedule the 15-minute glossary alignment to lock definitions before any build work begins.
