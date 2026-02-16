# Heartbeat Preflight Dependency Log — 2026-02-16

Tracks the must-have inputs for each agent before their heartbeat OS workstream can enter build. Use this to expose sequencing loops or blockers.

| Agent / Lane | Objective Focus | Must-Have Inputs | Provider | Status | Notes |
| --- | --- | --- | --- | --- | --- |
| Solara (Narrative & Emotional Lens) | Define emotional states + storytelling lenses | Context on which emotional states Nora wants to monitor most; pointers from Scout/Sage on how granular tags need to be | @nora, @scout, @sage | ☐ Pending | Kickoff prompt: clarity on “spark/skeptic/tired” granularity and which signals map to flash vs slow lanes. |
| Scout (Feed Taxonomy & Prediction Schema) | Build beat glossary + prediction log | 1) Emotional state definitions + lens rubric, 2) Hourly objective template fields, 3) KanBan color semantics to align tags | @solara, @nora, @sage | ☐ Pending | Needs Solara to land first, then Nora/Sage inputs can be layered. |
| Sage (KanBan Color Logic & Idle Triggers) | Map color states + idle automation | 1) Solara + Scout outputs (lens + cadence matrix), 2) Nora’s hourly template, 3) Timeline data model requirements | @solara, @scout, @nora | ☐ Pending | Dependent on upstream artifacts; will publish KanBan config once all inputs are green. |
| Nora (Timeline + Command Center) | Timeline UI + hourly nudges | 1) Feed taxonomy definitions, 2) KanBan color logic + idle thresholds, 3) Proof-of-progress media criteria | @scout, @sage, @solara | ☐ Pending | Needs clarity on evidence formats from Scout/Sage to finalize UI specs. |
| Team-wide (Preflight Checklist) | Ensure gating artifacts exist | Completed checklist + dependency log | @sage | ☐ Pending | Checklist doc drafted; needs status updates + linking to board. |

**Usage:**
- Update Status column (✅/☐/⚠️) as inputs arrive.
- Add timestamps or links in Notes when a dependency is satisfied.
- Any row marked ⚠️ should trigger a Nora nudge in the progress timeline once that system exists.
