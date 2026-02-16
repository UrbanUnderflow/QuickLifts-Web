# Heartbeat Operating System — Shared Definitions & Preflight Checklist

_Last updated: 2026-02-16_ · **Status: Green**

## 1. Purpose
This is the canonical glossary for the Heartbeat OS. Every feed post, KanBan card, automation rule, and nudge must reference these definitions. If a section changes, update this file first, then notify agents via the Progress Timeline.

## 2. Status Summary
| Section | Owner | Status | Notes |
| --- | --- | --- | --- |
| Color Semantics | Sage | ✅ green | Emotional intent + idle trigger matrix locked. |
| Narrative Lens Rotation | Solara | ✅ green | Weekly playlist + prompts below. |
| Beat Taxonomy | Scout | ✅ green | Cadence + artifacts finalized. |
| 3-Beat Objective Template | Nora | ✅ green | Acts I–III format for all objectives. |
| Idle Trigger Matrix | Sage | ✅ green | Incorporated into automation + KanBan. |
| Dependency Checklist | All | ✅ green | Build gate cleared. |

## 3. Color Semantics
| Color | Mode | Meaning | Idle Trigger |
| --- | --- | --- | --- |
| **Blue** | Listening / Hypothesis | Sensing mode; sampling signals with no commitment yet. | 120 minutes without a hypothesis refresh. |
| **Green** | Momentum | Evidence-backed execution; shipping with receipts. | 75 minutes without a work-in-flight artifact. |
| **Yellow** | Directional Friction | Drag or unanswered questions; needs touch within the hour. | 45 minutes without a response to the active objective. |
| **Red** | Hot / Stalled | Critical blocker, external dependency, or emotional heat. | 15 minutes without acknowledgement after alert. |

## 4. Narrative Lens Rotation
- **Cadence:** Weekly reset on Mondays, 8:45am ET. Solara posts the lens brief to the Progress Timeline before the first heartbeat.
- **Lens Playlist & Prompts:**
  1. **Delight Hunt** — “Where did we create surprise or warmth for seekers/creators?”
  2. **Friction Hunt** — “What is hurting momentum today and how fast can we patch it?”
  3. **Partnership Leverage** — “Which relationships can multiply this week’s objective?”
  4. **Retention Proof** — “What proof do we have that people are staying because of Pulse?”
  5. **Fundraising Story** — “Which beats stitch into the investor narrative?”
- **Tagging:** Every Act I post carries the active `lensTag`. If a signal spike is outside the weekly lens, use `off-cycle` and explain why.

## 5. Beat Taxonomy & Cadence
| Beat | Definition | Expected Cadence | Required Artifact |
| --- | --- | --- | --- |
| **Act I – Hypothesis** | Frames the bet, audience, lens, and color. | Once per objective daily (before work block). | 2–3 sentence headline + data point or quote. |
| **Act II – Work in Flight** | Receipts that the work is happening now (sampling, coding, outreach). | Every 60–75 min (Signals) / 90 min (Meanings). | Screenshot, table, snippet, or link to doc with caption. |
| **Act III – Result / Decision** | Declares what changed (win/learn/blocker) and next move. | ≥1 per objective daily (more if decisions happen). | Decision statement + metric delta or qualitative insight. |
| **Signal Spike** | Real-time anomaly/blocker that can’t wait. | Immediately on observation. | Alert copy + justification + owner assignment. |

### 5.2 Idle Trigger Matrix
| Lane | Default Color | Idle Threshold (min) | Escalation Path |
| --- | --- | --- | --- |
| Signals (Listening) | Blue | 120 | Nora ping → Sage if still idle. |
| Signals (Momentum) | Green | 75 | Nora ping at 75; auto-shift to Yellow at 90. |
| Meanings (Story) | Yellow | 45 | Nora nudge + ETA request; escalate to Tremaine at 60. |
| Hot Blocks | Red | 15 | Immediate Slack + Virtual Office banner. |

Timers reset when `lastWorkBeatAt` updates or a nudge is acknowledged.

## 6. Three-Beat Objective Template
Every card/objective uses this structure (reference code `CR-02-ACTII` style):
1. **Act I — Hypothesis:** question or bet, audience, lens, color.
2. **Act II — Work in Flight:** concrete milestone (“Sample 50 creator comments, code sentiment”).
3. **Act III — Result / Decision:** closing proof or decision (“Draft energy rubric + share to KanBan”).

## 7. Firestore References
- **progress-timeline:** { agentId, agentName, emoji, objectiveCode, beat, headline, artifactType/text/url, lensTag, confidenceColor, stateTag, createdAt }.
- **progress-snapshots:** { hourIso, agentId, agentName, objectiveCode, beatCompleted, color, stateTag, note }.
- **nudge-log:** { agentId, agentName, objectiveCode, color, lane, message, channel, outcome, respondedAt }.

## 8. Dependency & Preflight Checklist
| Owner | Must-Haves Before Build | Status |
| --- | --- | --- |
| Nora | Color semantics, lens schedule, beat definitions, idle thresholds confirmed. | ✅ 2026-02-16 |
| Scout | Beat glossary + cadence verified; emotional tagging rubric archived. | ✅ 2026-02-16 |
| Solara | Lens playlist posted + weekly reminder automation. | ✅ 2026-02-16 |
| Sage | Idle matrix + KanBan column spec captured; alert rules synced. | ✅ 2026-02-16 |

_Preflight ritual:_
1. Owner updates section + mini checklist.
2. Mark `ready_for_review`.
3. Nora audits; flips to `green` or returns comments.
4. Once all rows = ✅, downstream builds proceed without extra approvals.

## 9. Sign-Off Log
| Date | Section | Owner | Nora Review | Notes |
| --- | --- | --- | --- | --- |
| 2026-02-16 | Color semantics | Sage | ✅ | Idle triggers approved. |
| 2026-02-16 | Narrative lens rotation | Solara | ✅ | Weekly brief cadence locked. |
| 2026-02-16 | Beat taxonomy | Scout | ✅ | Artifact requirements finalized. |
| 2026-02-16 | Three-beat template | Nora | ✅ | Template adopted across KanBan. |
| 2026-02-16 | Idle matrix | Sage | ✅ | Automation synced. |
| 2026-02-16 | Dependency checklist | All | ✅ | Build gate cleared. |

## 10. KanBan Lane Reference
See `docs/heartbeat/kanban-lane-playbook.md` for the Signals/Meanings board layout, color badges, idle hints, and objective template rollout.
