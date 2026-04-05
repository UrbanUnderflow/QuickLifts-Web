# Partnership Lead Source of Truth (SOT)

This document is the canonical store for partnership lead facts, status, and evidence.

Any lead claim in a deliverable must cite this file with:

`[SOT: LEAD-####, EVID-####]`

If a claim is not backed by an entry here, it must be written as `Unverified` (not as fact).

## Rules

1. This file overrides all legacy synthesis docs.
2. Every claim about interest, readiness, blockers, or status must map to at least one `LEAD` ID and one `EVID` ID.
3. Add evidence first, then write the claim.
4. If evidence is disputed, keep the claim as `Unverified` until resolved.

## Status Vocabulary

- `CONFIRMED_INTEREST`: Direct statement from the lead (or authorized rep) that they want to collaborate.
- `NO_CONFIRMED_INTEREST`: No verified statement of collaboration interest exists.
- `UNVERIFIED`: Mentioned in notes, but no primary evidence has been logged.
- `DISPROVEN`: Prior claim has been shown incorrect by verified evidence.

## Lead Registry

| Lead ID | Company | Segment | Stage | Interest Status | Last Verified (UTC) | Owner | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| LEAD-0001 | FitWell | Fitness | Discovery | UNVERIFIED | 2026-02-19 | Sage | Imported from legacy synthesis docs. Primary evidence not yet logged. |
| LEAD-0002 | PulseFit | Fitness | Discovery | NO_CONFIRMED_INTEREST | 2026-02-19 | Sage | Corrected. Do not claim collaboration interest without new evidence. |
| LEAD-0003 | HealthSync | Wellness | Discovery | UNVERIFIED | 2026-02-19 | Sage | Imported from legacy synthesis docs. Primary evidence not yet logged. |
| LEAD-0004 | WellnessLife | Wellness | Discovery | UNVERIFIED | 2026-02-19 | Sage | Imported from legacy synthesis docs. Primary evidence not yet logged. |
| LEAD-0005 | WearTech | Wearables | Discovery | UNVERIFIED | 2026-02-19 | Sage | Imported from legacy synthesis docs. Primary evidence not yet logged. |
| LEAD-0006 | MoveWear | Wearables | Discovery | UNVERIFIED | 2026-02-19 | Sage | Imported from legacy synthesis docs. Primary evidence not yet logged. |
| LEAD-0007 | Revival Strength / Functional Bodybuilding | Coach-led fitness organization | Discovery | NO_CONFIRMED_INTEREST | 2026-04-04 | Scout | Public website confirms Marcus Filly as founder, shows a multi-coach Persist program, and publishes an official media inquiries form plus support email; no verified collaboration interest logged. |

## Evidence Log

| Evidence ID | Date (UTC) | Lead ID | Source Type | Source Location | Summary | Entered By | Verification |
| --- | --- | --- | --- | --- | --- | --- | --- |
| EVID-0001 | 2026-02-19 | LEAD-0002 | Operator correction | Chat instruction in this thread | User confirmed PulseFit has not expressed interest in collaborating. | Codex | CONFIRMED_BY_OWNER |
| EVID-0002 | 2026-02-19 | LEAD-0001 | Legacy document import | docs/synthesis/strategic_partnerships_prospect_brief.md | Legacy file states "ongoing integration discussions." Source evidence not attached. | Codex | UNVERIFIED_IMPORT |
| EVID-0003 | 2026-02-19 | LEAD-0003 | Legacy document import | docs/synthesis/prospect_qualification.md | Legacy file includes readiness/compliance claims without primary source links. | Codex | UNVERIFIED_IMPORT |
| EVID-0004 | 2026-04-04 | LEAD-0007 | Public website | https://functional-bodybuilding.com/pages/about | Official about page identifies Marcus Filly as founder of Functional Bodybuilding and lists multiple Persist coaches under Revival Strength copyright. | Scout | PUBLIC_SOURCE |
| EVID-0005 | 2026-04-04 | LEAD-0007 | Public website | https://functional-bodybuilding.com/pages/persist | Official Persist page describes an active training program with structured participation options, supporting use of Persist as the initial team construct. | Scout | PUBLIC_SOURCE |
| EVID-0006 | 2026-04-04 | LEAD-0007 | Public website | https://functional-bodybuilding.com/pages/contact | Official contact page instructs visitors to email support@functional-bodybuilding.com for support questions and to use the media inquiries form for podcasts and collaborations. | Scout | PUBLIC_SOURCE |
| EVID-0007 | 2026-04-04 | LEAD-0007 | Public website | https://functional-bodybuilding.com/pages/media-inquiries | Official media inquiries page states the form should be used for media or podcast appearances, quotes, or collaboration requests and that the team will respond. | Scout | PUBLIC_SOURCE |

## Interaction Log

| Interaction ID | Date (UTC) | Lead ID | Channel | Participants | Interaction Summary | Evidence ID | Confidence |
| --- | --- | --- | --- | --- | --- | --- | --- |
| INT-0001 | 2026-02-19 | LEAD-0002 | Internal review | User + Codex | Corrected false claim that PulseFit expressed collaboration interest. | EVID-0001 | High |

## Entry Template

Add new rows using this pattern:

1. Add or update `LEAD-####` row in Lead Registry.
2. Add `EVID-####` row with exact source location.
3. Add `INT-####` row if this came from a specific conversation or meeting.
4. Only after steps 1-3, use the claim in deliverables with `[SOT: LEAD-####, EVID-####]`.

## Deliverable Citation Examples

- `PulseFit currently has no confirmed collaboration interest on record. [SOT: LEAD-0002, EVID-0001]`
- `FitWell integration discussion status is still unverified. [SOT: LEAD-0001, EVID-0002]`

## Change Log

- 2026-02-19: Initial source-of-truth file created to prevent lead-data hallucinations.
