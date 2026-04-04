---
coachIdentity: Marcus Filly — founder of Functional Bodybuilding
externalProfileUrl: https://functional-bodybuilding.com/pages/about
organizationName: Revival Strength / Functional Bodybuilding
firstTeamName: Persist
externalOwnerName: Marcus Filly
externalOwnerEmailOrHandle: Unverified public handle; use Marcus Filly pending direct owner confirmation
fitRationale: Coach-led training business with a named founder, an active flagship program, and visible multi-coach support structure [SOT: LEAD-0007, EVID-0004] [SOT: LEAD-0007, EVID-0005]
explicitNextStep: Provision the canary organization as "Revival Strength / Functional Bodybuilding" with an initial "Persist" team and route the first admin activation handoff to Marcus Filly after confirming the preferred owner email directly. [SOT: LEAD-0007, EVID-0004] [SOT: LEAD-0007, EVID-0005]
status: selected-target
owner: scout
lastUpdated: 2026-04-04
sourceOfTruthLead: LEAD-0007
sourceOfTruthEvidence:
  - EVID-0004
  - EVID-0005
---

# PulseCheck Canary Target Brief

## Status

This file locks the canary to one real external coach-led target so downstream provisioning, activation, and verification all operate against the same organization record.

## Canonical Fields

- **coachIdentity:** Marcus Filly — founder of Functional Bodybuilding. [SOT: LEAD-0007, EVID-0004]
- **externalProfileUrl:** <https://functional-bodybuilding.com/pages/about> [SOT: LEAD-0007, EVID-0004]
- **organizationName:** Revival Strength / Functional Bodybuilding (normalized organization record for the canary). The public site footer identifies the brand relationship as `Revival Strength © 2024 / Functional Bodybuilding`. [SOT: LEAD-0007, EVID-0004]
- **firstTeamName:** Persist (normalized initial team to provision). The public site uses `Persist` as the flagship training/program construct and lists multiple `Persist Coach` roles. [SOT: LEAD-0007, EVID-0004] [SOT: LEAD-0007, EVID-0005]
- **externalOwnerName:** Marcus Filly [SOT: LEAD-0007, EVID-0004]
- **externalOwnerEmailOrHandle:** Unverified public handle; use Marcus Filly as the named external owner until direct contact data is confirmed. [SOT: LEAD-0007, EVID-0004]
- **fitRationale:** Coach-led training business with a named founder, an active flagship program, and visible multi-coach support structure. [SOT: LEAD-0007, EVID-0004] [SOT: LEAD-0007, EVID-0005]
- **explicitNextStep:** Provision the canary organization as `Revival Strength / Functional Bodybuilding`, create the initial `Persist` team, and confirm Marcus Filly's preferred owner email before sending the first admin activation link. [SOT: LEAD-0007, EVID-0004] [SOT: LEAD-0007, EVID-0005]

## Fit Rationale

- **Named external coach-owner:** The public About page explicitly identifies Marcus Filly as the founder, giving the canary a clear human owner for org creation and later admin activation. [SOT: LEAD-0007, EVID-0004]
- **Observable active coaching structure:** The same public page lists multiple staff and coach roles, including several `Persist Platinum Coach` and `Persist Coach` entries, which is a stronger fit for an org-plus-team hierarchy than a solo-coach signup flow. [SOT: LEAD-0007, EVID-0004]
- **Clear first team candidate:** `Persist` already exists as a named training program on the public site, so it can be normalized into the first team without inventing a placeholder label or ambiguous routing target. [SOT: LEAD-0007, EVID-0005]
- **Audience and use-case alignment:** The Persist program is presented to adults balancing training with careers, kids, and life constraints, which signals an active coached population rather than a content-only audience. [SOT: LEAD-0007, EVID-0005]
- **Better match for the new hierarchy than legacy coach signup:** Because the public footprint shows one founder operating a branded program with multiple coaches beneath it, the organization-first PulseCheck model maps more naturally than a legacy single-coach path. [SOT: LEAD-0007, EVID-0004] [SOT: LEAD-0007, EVID-0005]

## Normalized Organization Record

| Field | Value | Source |
| --- | --- | --- |
| Target coach | Marcus Filly | [SOT: LEAD-0007, EVID-0004] |
| Public source URL | <https://functional-bodybuilding.com/pages/about> | [SOT: LEAD-0007, EVID-0004] |
| Normalized organization name | Revival Strength / Functional Bodybuilding | [SOT: LEAD-0007, EVID-0004] |
| Initial team to provision | Persist | [SOT: LEAD-0007, EVID-0004], [SOT: LEAD-0007, EVID-0005] |
| External owner | Marcus Filly | [SOT: LEAD-0007, EVID-0004] |
| Owner contact detail | Unverified pending direct confirmation | [SOT: LEAD-0007, EVID-0004] |
| Collaboration status | No confirmed collaboration interest on record | [SOT: LEAD-0007, EVID-0004] |

## Notes

- This selection is based on public-source evidence of a real coach-led organization and active program structure, not on any verified partnership or onboarding commitment. Current collaboration interest remains **not confirmed**. [SOT: LEAD-0007, EVID-0004]
- `Persist` is the cleanest initial team name for the canary because it already exists as a named program on the public site and maps naturally to the first team container. [SOT: LEAD-0007, EVID-0005]
- The owner email/handle must be confirmed directly before activation-link generation; this brief intentionally does not fabricate contact data.
