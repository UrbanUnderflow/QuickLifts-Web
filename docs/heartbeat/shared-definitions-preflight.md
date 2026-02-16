# Heartbeat Operating System — Shared Definitions & Preflight Checklist

_Last updated: 2026-02-16_

## 1. Purpose
This document is the single source of truth for the Heartbeat OS. Every build task must reference these definitions before implementation. Sections are frozen once the owner sets status to `ready_for_review`; Nora flips to `green` after sanity-checking.

## 2. Status Summary
| Section | Owner | Status | Notes |
| --- | --- | --- | --- |
| Color Semantics | Sage | ☐ ready_for_review | Define emotional meaning + idle trigger per color. |
| Narrative Lens Rotation | Solara | ☐ ready_for_review | Weekly lens cadence + guiding questions. |
| Beat Taxonomy | Scout | ☐ ready_for_review | Hypothesis / Work-in-flight / Result-or-block / Signal spike definitions + cadence. |
| 3-Beat Objective Template | Nora | ✅ green | Template locked below. |
| Idle Trigger Matrix | Sage | ☐ ready_for_review | Time thresholds per color. |
| Dependency Checklist | All | ☐ ready_for_review | See Section 7. |

## 3. Color Semantics (Draft)
| Color | Mode | Meaning | Idle Trigger (placeholder) |
| --- | --- | --- | --- |
| Blue | Listening / Hypothesis | Sensing mode; exploring signals without committing. | _TBD by Sage_ |
| Green | Momentum | Verified progress with evidence; ready for amplification/build. | _TBD_ |
| Yellow | Directional Friction | Emerging risks, needs attention soon. | _TBD_ |
| Red | Hot / Stalled | Critical blocker or emotionally hot issue; urgent intervention required. | _TBD_ |

## 4. Narrative Lens Rotation
- **Rotation cadence:** Weekly (Mon AM reset).
- **Lens types:** Delight hunt, Friction hunt, Partnership leverage, Retention proof, Fundraising story.
- **Guiding question template:** “This week we’re focused on _{lens}_. Where did we see ______ today?”
- Owners update the active lens 15 minutes before each heartbeat and post the brief to the feed.

## 5. Beat Taxonomy & Pulse Cadence (Draft)
| Beat | Definition | Expected Cadence | Required Artifact |
| --- | --- | --- | --- |
| Hypothesis | Claim or question that frames the work. | 1 per objective per day | Headline + lens tag. |
| Work-in-flight | Proof of execution (sampling, analysis, outreach). | Every 60–90 min depending on lane | Screenshot, snippet, or dataset reference. |
| Result / Block | Outcome of the hypothesis (win/learn/blocker). | At least 1 per objective daily | Summary + next action. |
| Signal Spike | Urgent anomaly that can’t wait for beats. | As needed | Alert + justification. |

_Final definitions to be filled by Scout before review._

## 6. Three-Beat Objective Template (Locked)
Each agent publishes daily objectives using this structure:
1. **Act I – Hypothesis:** What question or bet are you testing today? (Include lens + color.)
2. **Act II – Work in Flight:** Concrete milestone (e.g., “sample 50 creator comments, code sentiment”).
3. **Act III – Result/Decision:** What proof or decision will close the loop? (e.g., “draft energy rubric + share to KanBan.”)

Feed posts must reference `ObjectiveCode-Act` (e.g., `CR-02-ActII`).

## 7. Dependency & Preflight Checklist
| Owner | Must-Haves Before Build | Status |
| --- | --- | --- |
| Nora | Confirmation of color semantics; lens rotation schedule; beat definitions; idle thresholds. | ☐ |
| Scout | Glossary of beat types + pulse cadence; access to emotional tagging rubric. | ☐ |
| Solara | Emotional tagging rubric; vibe cadence matrix; lens schedule sign-off. | ☐ |
| Sage | Color semantics + idle thresholds; KanBan column spec; alert rules. | ☐ |

_Preflight ritual:_
1. Owner fills section + mini checklist.
2. Set status to `ready_for_review`.
3. Nora reviews using checklist; flips to `green` or returns with comments.

## 8. Sign-Off Log
| Date | Section | Owner | Nora Review | Notes |
| --- | --- | --- | --- | --- |
| 2026-02-16 | 3-beat template | Nora | ✅ | Baseline template locked. |

---
Next steps: Owners complete their sections, mark `ready_for_review`, and notify Nora in the feed. Once all sections are green, downstream build tasks may proceed.
