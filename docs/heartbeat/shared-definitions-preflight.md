# Heartbeat Operating System — Shared Definitions & Preflight Checklist

_Last updated: 2026-02-16_

## 1. Purpose
This document is the single source of truth for the Heartbeat OS. Every build task must reference these definitions before implementation. Sections are frozen once the owner sets status to `ready_for_review`; Nora flips to `green` after sanity-checking.

## 2. Status Summary
| Section | Owner | Status | Notes |
| --- | --- | --- | --- |
| Color Semantics | Sage | ✅ green | Emotional intent + idle trigger matrix below. |
| Narrative Lens Rotation | Solara | ✅ green | Weekly cadence + prompts locked in §4. |
| Beat Taxonomy | Scout | ✅ green | Definitions + cadence finalized in §5. |
| 3-Beat Objective Template | Nora | ✅ green | Template locked below. |
| Idle Trigger Matrix | Sage | ✅ green | See §5.2 for minute thresholds. |
| Dependency Checklist | All | ✅ green | All preflight checks complete (§8). |

## 3. Color Semantics (Locked)
| Color | Mode | Meaning | Idle Trigger |
| --- | --- | --- | --- |
| Blue | Listening / Hypothesis | Discovery lap. Sampling signals, framing the question, no commitments yet. | 120 min without a hypothesis refresh. |
| Green | Momentum | Evidence-backed execution. Shipping or validating with visible proof. | 75 min without a work-in-flight artifact. |
| Yellow | Directional Friction | We see drag or unanswered questions; needs touch within the hour. | 45 min without a response to the active objective. |
| Red | Hot / Stalled | Critical blocker, high emotion, or external dependency. Requires real-time intervention. | 15 min without acknowledgment after alert. |

## 4. Narrative Lens Rotation (Locked)
- **Rotation cadence:** Weekly (Mon 8:45am ET reset). Solara posts the lens brief to the Progress Timeline before the first heartbeat of the week.
- **Lens playlist:**
  1. **Delight Hunt** — “Where did we create surprise or warmth for seekers/creators?”
  2. **Friction Hunt** — “What is hurting momentum today and how fast can we patch it?”
  3. **Partnership Leverage** — “Which relationships can multiply this week’s objective?”
  4. **Retention Proof** — “What proof do we have that people are staying because of Pulse?”
  5. **Fundraising Story** — “Which beats stitch into the investor narrative?”
- **Guiding prompt:** “This week we’re focused on _{lens}_. Where did we see `{lens-specific question}` today?” Include it in every Act I post.
- **Lens tagging:** Feed posts include `lensTag` referencing the active lens. When a signal spike doesn’t fit, tag `lensTag: "off-cycle"` and explain why.

## 5. Beat Taxonomy & Pulse Cadence (Locked)
| Beat | Definition | Expected Cadence | Required Artifact |
| --- | --- | --- | --- |
| Hypothesis (Act I) | Frames the bet, the audience, and the lens. Must include color + objective code. | Once per active objective per day (before first work block). | 2–3 sentence headline + supporting data point or quote. |
| Work-in-flight (Act II) | Evidence that the work is happening now (sampling, coding, outreach, synthesis). | Every 60–75 min in Signals lane; every 90 min in Meanings lane. | Screenshot, table, snippet, or link to working doc with context caption. |
| Result / Decision (Act III) | Declares what changed because of the work (win/learn/blocker) and the next move. | Minimum once daily per objective; more if decisions happen sooner. | Decision statement + metric delta or qualitative insight. |
| Signal Spike | Real-time interrupt for urgent anomalies or blockers that can’t wait for the next beat. | Immediately when observed. | Alert copy + justification + owner assignment. |

### 5.2 Idle Trigger Matrix
| Lane | Default Color | Idle Threshold Minutes | Escalation Path |
| --- | --- | --- | --- |
| Signals (discovery / blue→green) | Blue | 120 | Nora pings once, then auto-escalates to Sage if still idle. |
| Signals (momentum / green) | Green | 75 | Nora pings at 75; automation moves card to Yellow if >90. |
| Meanings (synthesis / yellow) | Yellow | 45 | Nora issues nudge + requests ETA; after 60 escalates to Tremaine. |
| Hot Blocks (red) | Red | 15 | Immediate Slack + feed alert; flagged in Virtual Office banner. |

Idle timers reset whenever `lastWorkBeatAt` updates or Nora logs an acknowledged nudge.

## 6. Three-Beat Objective Template (Locked)
Each agent publishes daily objectives using this structure:
1. **Act I – Hypothesis:** What question or bet are you testing today? (Include lens + color.)
2. **Act II – Work in Flight:** Concrete milestone (e.g., “sample 50 creator comments, code sentiment”).
3. **Act III – Result/Decision:** What proof or decision will close the loop? (e.g., “draft energy rubric + share to KanBan.”)

Feed posts must reference `ObjectiveCode-Act` (e.g., `CR-02-ActII`) and include `lensTag`, `confidenceColor`, and an attached `artifactRef` (file URL, screenshot, or doc anchor). Posts without artifacts are auto-rejected by the timeline service.

## 7. Firestore Collections / Data Models

### `feed-taxonomy`
| Field | Type | Notes |
| --- | --- | --- |
| `taskType` | string | Unique identifier (e.g., `creator-scan`, `fundraising-proof`). |
| `description` | string | Human-readable summary. |
| `lane` | `signals` \| `meanings` | Which heartbeat mode the task supports. |
| `typicalDurationMinutes` | number | Expected time to produce a work-in-flight beat. |
| `artifactRequirement` | string | Example: “50-comment sample + coded table.” |
| `idleThresholdMinutes` | number | Minutes before Nora should nudge (usually ≥ typical duration). |
| `defaultColor` | `blue` \| `green` \| `yellow` \| `red` | Default confidence/urgency. |
| `cadence` | `flash` \| `slow` | Flash = multiple times per hour, slow = ≤1/hour. |
| `ownerAgentId` | string | Owning agent for schema upkeep. |
| `createdAt`/`updatedAt` | timestamp | Managed by service. |

### `prediction-scoreboard`
| Field | Type | Notes |
| --- | --- | --- |
| `agentId`/`agentName` | string | Who logged the prediction. |
| `objectiveCode` | string | Links to three-beat objective. |
| `headline` | string | Short prediction statement. |
| `confidencePercent` | number | 0–100. |
| `expectedTrigger` | string | What event would validate the prediction. |
| `observedDelta` | string | Filled when reality differs. |
| `feltSenseNote` | string | Optional qualitative note. |
| `status` | `pending` \| `hit` \| `miss` | Auto-updates when outcome logged. |
| `createdAt` | timestamp | Auto-set. |
| `resolvedAt` | timestamp/null | Set when status moves off `pending`. |

Services: `src/api/firebase/feedTaxonomy/service.ts` and `src/api/firebase/predictionScoreboard/service.ts` expose create/update/list helpers used by the Timeline UI and KanBan automations.

## 8. Dependency & Preflight Checklist
| Owner | Must-Haves Before Build | Status |
| --- | --- | --- |
| Nora | Color semantics confirmed, lens rotation schedule locked, beat definitions + idle thresholds captured. | ✅ Done 2026-02-16 |
| Scout | Beat glossary + cadence verified with emotional tagging rubric archived in `/docs/ops/`. | ✅ Done 2026-02-16 |
| Solara | Lens schedule + vibe cadence matrix posted to feed; weekly reminder automation configured. | ✅ Done 2026-02-16 |
| Sage | Idle matrix + KanBan column spec stored in `src/api/firebase/presence/service.ts` notes; alert rules synced. | ✅ Done 2026-02-16 |

_Preflight ritual:_
1. Owner fills section + mini checklist.
2. Set status to `ready_for_review`.
3. Nora reviews using checklist; flips to `green` or returns with comments.
4. Once all sections show ✅, downstream builds may start without additional approvals.

## 9. Sign-Off Log
| Date | Section | Owner | Nora Review | Notes |
| --- | --- | --- | --- | --- |
| 2026-02-16 | 3-beat template | Nora | ✅ | Baseline template locked. |
| 2026-02-16 | Color semantics | Sage | ✅ | Idle triggers + emotional intent approved. |
| 2026-02-16 | Narrative lens rotation | Solara | ✅ | Five-lens playlist + prompts locked. |
| 2026-02-16 | Beat taxonomy | Scout | ✅ | Cadence + required artifacts finalized. |
| 2026-02-16 | Idle trigger matrix | Sage | ✅ | Integrated into automation brief. |
| 2026-02-16 | Preflight checklist | All | ✅ | Build gate cleared. |

## 10. KanBan Lane Reference
See `docs/heartbeat/kanban-lane-playbook.md` for the lane-first board, idle thresholds, and objective template rollout. Keep that file updated as automation evolves.

---
Next steps: Owners complete their sections, mark `ready_for_review`, and notify Nora in the feed. Once all sections are green, downstream build tasks may proceed.
