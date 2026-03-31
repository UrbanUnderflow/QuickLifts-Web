# PulseCheck Athletic Trainer Role Spec

Status: Draft
Owner: PulseCheck
Last updated: 2026-03-31

## Summary

PulseCheck needs a new explicit team role, `athletic-trainer`, that sits between the performance lane and the clinical lane.

Athletic trainers should:

- operate as real adult team members inside PulseCheck
- see the full performance and team-support surface
- interact with athletes through PulseCheck
- receive Tier 2 escalations
- have AuntEdna-connected clinical access

They should not replace the clinician role. Tier 3 remains clinician-only.

This spec defines the product model, data model, onboarding flow, permission posture, AuntEdna bridge behavior, escalation behavior, and rollout plan for that role.

## Current State

### Current team membership roles

The current provisioning model already supports these team membership roles:

- `team-admin`
- `coach`
- `performance-staff`
- `support-staff`
- `clinician`
- `athlete`

Source:

- `/Users/tremainegrant/Documents/GitHub/QuickLifts-Web/src/api/firebase/pulsecheckProvisioning/types.ts`

### Current adult invite UI

The current post-activation adult invite dropdown exposes:

- `Secondary Admin`
- `Coach`
- `Performance Staff`
- `Support Staff`

It does not currently expose `Clinician`, even though `clinician` is already a valid system role.

Source:

- `/Users/tremainegrant/Documents/GitHub/QuickLifts-Web/src/pages/PulseCheck/post-activation.tsx`

### Current clinician provisioning model

Provisioning already contains an explicit clinician lane:

- organization-level `defaultClinicianBridgeMode`
- team-level `defaultClinicianProfileId` and related default clinician fields
- clinician profile records
- clinician onboarding invite links
- a dedicated PulseCheck clinician onboarding route
- a clinician-specific permission set

Sources:

- `/Users/tremainegrant/Documents/GitHub/QuickLifts-Web/src/api/firebase/pulsecheckProvisioning/types.ts`
- `/Users/tremainegrant/Documents/GitHub/QuickLifts-Web/src/api/firebase/pulsecheckProvisioning/service.ts`
- `/Users/tremainegrant/Documents/GitHub/QuickLifts-Web/src/pages/admin/pulsecheckProvisioning.tsx`
- `/Users/tremainegrant/Documents/GitHub/QuickLifts-Web/src/pages/PulseCheck/clinician-onboarding/[token].tsx`

### Current escalation posture

- Tier 2 is currently described as a consent-based escalation into a clinical pathway.
- Tier 3 is currently described as a mandatory escalation into AuntEdna clinicians.

This is no longer sufficient. Tier 2 now needs to route to athletic trainers and clinicians. Tier 3 remains clinician-only.

## Problem

PulseCheck currently has a gap between staff-facing performance support and clinician-facing AuntEdna routing.

Athletic trainers are not well represented by any existing role:

- `performance-staff` gives performance access, but no explicit clinical bridge
- `support-staff` gives support posture, but no explicit clinical bridge
- `clinician` is too clinical and not the right operational identity for athletic trainers

Without an explicit `athletic-trainer` role, the system cannot cleanly model:

- who receives Tier 2 escalation
- who can operate in both the performance and clinical-adjacent lane
- who should be granted AuntEdna access without being treated as a clinician

## Decision

PulseCheck will add a new explicit team membership role:

- `athletic-trainer`

This role is a hybrid staff role with:

- full PulseCheck performance/team access
- athlete interaction privileges
- access to Tier 2 escalation workflows
- AuntEdna-connected clinical access through an explicit bridge

This role does not change the clinician role.

- `clinician` remains the explicit clinical ownership lane
- `athletic-trainer` is a hybrid team role with clinical-system access

## Role Definition

### Athletic Trainer role intent

An athletic trainer is a team operator who:

- monitors athlete readiness and support posture
- participates in performance and recovery workflows
- can follow up with athletes inside PulseCheck
- can receive and act on consent-based safety escalations
- can open the associated clinical lane in AuntEdna when the workflow requires it

### Athletic Trainer role boundaries

An athletic trainer is not:

- a team admin by default
- the default Tier 3 escalation destination
- a replacement for the team’s default clinician profile

### Permission posture

Athletic trainers should have:

- full team roster visibility by default, with support for scoped assignment if the team wants it
- PulseCheck athlete interaction permissions comparable to performance/support staff
- visibility into performance, readiness, and support surfaces
- visibility into Tier 2 escalation events
- access to AuntEdna via a role-specific bridge

Athletic trainers should not automatically receive:

- org admin privileges
- team provisioning privileges
- clinician-only Tier 3 routing

## Escalation Behavior

### Tier 2

Tier 2 should route to:

- athletic trainers
- clinicians

Tier 2 meaning:

- consent-based escalation
- normal programming pauses
- both the athletic-trainer lane and clinical lane become aware

Tier 2 expected system behavior:

- PulseCheck marks the event as consent-based elevated risk
- PulseCheck notifies the athletic-trainer bridge recipients for that team
- PulseCheck notifies the clinician route for that team
- AuntEdna access is available to the connected athletic trainers and clinicians

### Tier 3

Tier 3 should route to:

- clinicians only

Tier 3 meaning:

- mandatory escalation
- clinician-owned safety event
- athletic trainers may remain operationally aware in PulseCheck if policy allows, but they are not the primary clinical destination

Tier 3 expected system behavior:

- PulseCheck triggers the mandatory escalation path
- AuntEdna clinician routing is used as the destination of record
- athletic trainers do not become the destination of record for Tier 3

## Data Model Changes

### 1. Extend team role enum

Add `athletic-trainer` to `PulseCheckTeamMembershipRole`.

Current file:

- `/Users/tremainegrant/Documents/GitHub/QuickLifts-Web/src/api/firebase/pulsecheckProvisioning/types.ts`

Resulting role set:

- `team-admin`
- `coach`
- `performance-staff`
- `support-staff`
- `athletic-trainer`
- `clinician`
- `athlete`

### 2. Add a dedicated permission set

Add a new permission set id:

- `pulsecheck-athletic-trainer-v1`

Current mapping location:

- `/Users/tremainegrant/Documents/GitHub/QuickLifts-Web/src/api/firebase/pulsecheckProvisioning/service.ts`

Required behavior:

- automatic default assignment on invite redemption
- visible in team workspace permission management
- separate from `pulsecheck-performance-staff-v1`
- separate from `pulsecheck-clinician-v1`

### 3. Add role priority handling

Any role-priority or “primary operating membership” logic must include `athletic-trainer`.

Current location:

- `/Users/tremainegrant/Documents/GitHub/QuickLifts-Web/src/api/firebase/pulsecheckProvisioning/service.ts`

Recommended ordering:

- `team-admin`
- `coach`
- `performance-staff`
- `support-staff`
- `athletic-trainer`
- `clinician`
- `athlete`

This can be adjusted later, but `athletic-trainer` must be explicit.

### 4. Add clinical-access bridge records for member-level access

The current clinician model is mostly team-level and clinician-profile-driven.

Athletic trainers need something else:

- a member-level AuntEdna access bridge

Recommended new collection:

- `pulsecheck-auntedna-member-bridges`

Recommended fields:

- `id`
- `organizationId`
- `teamId`
- `teamMembershipId`
- `userId`
- `role`
- `targetEmail`
- `pulseCheckPermissionSetId`
- `auntEdnaProfileId`
- `auntEdnaExternalUserId`
- `bridgeStatus`
- `syncStatus`
- `createdAt`
- `updatedAt`

Recommended role values for this bridge:

- `clinician`
- `athletic-trainer`

Recommended status values:

- `pending-invite`
- `pending-sync`
- `active`
- `revoked`
- `sync-failed`

## Invite and Onboarding Model

### Adult team invite UI

The adult invite dropdown should explicitly include:

- `Secondary Admin`
- `Coach`
- `Performance Staff`
- `Support Staff`
- `Athletic Trainer`
- `Clinician`

Current file:

- `/Users/tremainegrant/Documents/GitHub/QuickLifts-Web/src/pages/PulseCheck/post-activation.tsx`

### Team invite redemption

`team-access` invite redemption should support `athletic-trainer` exactly like the other adult roles:

- create or update the team membership
- assign the role
- assign `pulsecheck-athletic-trainer-v1`
- set onboarding status
- route the user into `member-setup`

Current locations:

- `/Users/tremainegrant/Documents/GitHub/QuickLifts-Web/src/pages/PulseCheck/team-invite/[token].tsx`
- `/Users/tremainegrant/Documents/GitHub/QuickLifts-Web/src/api/firebase/pulsecheckProvisioning/service.ts`
- `/Users/tremainegrant/Documents/GitHub/QuickLifts-Web/src/pages/api/pulsecheck/team-invite/redeem.ts`

### Member setup

Athletic trainers should complete the normal member setup flow first:

- title
- notification preferences
- team membership activation

Then, if their role is `athletic-trainer`, they should complete a second-step AuntEdna bridge setup.

Current member setup entry:

- `/Users/tremainegrant/Documents/GitHub/QuickLifts-Web/src/pages/PulseCheck/member-setup`

### AuntEdna bridge onboarding for athletic trainers

Athletic trainers need the same class of workflow that clinicians have today:

- PulseCheck-side onboarding handoff
- link generation
- bridge record creation
- eventual AuntEdna SSO or onboarding continuation

Recommended near-term implementation:

- add a new invite type: `athletic-trainer-onboarding`
- add a new route: `/PulseCheck/athletic-trainer-onboarding/[token]`
- create a member bridge record tied to the team membership

Recommended longer-term refactor:

- generalize `clinician-onboarding` into a unified `clinical-access-onboarding`
- support role-aware variants for `clinician` and `athletic-trainer`

Near-term is safer because it avoids breaking the current clinician path.

## AuntEdna Integration Model

### Team-level clinical route

Keep the current team-level clinician route:

- team default clinician profile
- clinician bridge mode
- clinician onboarding invite

This remains the destination-of-record for clinician routing and Tier 3.

### Member-level clinical access bridge

Add a member-level bridge for roles that need AuntEdna access without being the default clinician destination.

Initial supported role:

- `athletic-trainer`

This bridge should:

- connect a specific team member to AuntEdna access
- store sync state
- allow role-aware auditing
- make it possible to show who is authorized to open the clinical lane

### Key distinction

The system must distinguish between:

- escalation destination
- clinical access recipient

For example:

- the team default clinician route is the escalation destination for Tier 3
- an athletic trainer may be a clinical access recipient without being the clinician-of-record

## Workspace and Permission UX

### Team workspace

The team workspace should:

- display `Athletic Trainer` as a first-class role label
- offer `Athletic Trainer` permission options
- show AuntEdna bridge status for athletic trainers
- allow admins to manage roster visibility for athletic trainers

Current file:

- `/Users/tremainegrant/Documents/GitHub/QuickLifts-Web/src/pages/PulseCheck/team-workspace.tsx`

### Permission options

Add a role-specific workspace permission option:

- `pulsecheck-athletic-trainer-v1`

Optional later split:

- `pulsecheck-athletic-trainer-full-v1`
- `pulsecheck-athletic-trainer-limited-v1`

First pass can ship with one role-specific permission set if that is faster.

## Demo and Product Copy Updates

The demo should reflect:

- Tier 2 routes to athletic trainers and clinicians
- Tier 3 routes to clinicians only

Current demo file:

- `/Users/tremainegrant/Documents/GitHub/QuickLifts-Web/src/components/pulsecheck/EscalationDiagram.tsx`

The team onboarding and workspace copy should also reflect:

- clinicians are explicit
- athletic trainers are explicit
- support/performance staff remain separate roles

## Implementation Plan

### Phase 1: Roles and permissions

- add `athletic-trainer` to team role types
- add `pulsecheck-athletic-trainer-v1`
- update permission mappings
- update role formatting and labels

### Phase 2: Adult invite UI

- add `Athletic Trainer`
- add `Clinician`
- update post-activation invite flow
- update invite redemption labels

### Phase 3: Member bridge model

- add `pulsecheck-auntedna-member-bridges`
- create athletic-trainer bridge records
- add onboarding link generation
- add bridge status reads

### Phase 4: Athletic trainer onboarding route

- add `/PulseCheck/athletic-trainer-onboarding/[token]`
- create PulseCheck-side handoff page
- prepare for future AuntEdna SSO continuation

### Phase 5: Escalation routing

- update Tier 2 routing logic to notify athletic trainers plus clinicians
- keep Tier 3 clinician-only
- update demo copy

### Phase 6: Workspace surfaces

- show athletic trainers in team workspace
- expose bridge status
- expose permission management

## Migration Plan

No destructive migration is required to introduce the role.

Required migration work:

- deploy new role enum support
- deploy permission-set mapping
- deploy invite UI updates
- create member bridge records only for new athletic-trainer invites at first

Optional backfill:

- if any current `performance-staff` or `support-staff` users are actually athletic trainers, add an admin migration tool to re-role them and create the associated member bridge

## Acceptance Criteria

- Admin can invite an `Athletic Trainer` from post-activation.
- Invite redemption creates a team membership with role `athletic-trainer`.
- Invite redemption assigns `pulsecheck-athletic-trainer-v1`.
- Athletic trainer completes normal member setup.
- Athletic trainer completes AuntEdna bridge onboarding.
- Team workspace displays `Athletic Trainer` correctly.
- Athletic trainer has PulseCheck team access plus AuntEdna-connected clinical access.
- Tier 2 routes to athletic trainers and clinicians.
- Tier 3 routes to clinicians only.
- Clinician routing continues to use the explicit clinician lane and team default clinician profile.

## Open Questions

- Should athletic trainers receive full AuntEdna chart access or a scoped subset?
- Should Tier 2 notify all athletic trainers on a team or only assigned athletic trainers?
- Should an athletic trainer ever be allowed to trigger clinician outreach directly from PulseCheck?
- Should athletic trainers have one fixed permission set or a full/limited split on day one?
- Should the clinician onboarding route be generalized now or after the athletic-trainer lane is live?

## Recommended First Pass

Ship the first pass with:

- new `athletic-trainer` role
- explicit `Clinician` and `Athletic Trainer` invite options
- new `pulsecheck-athletic-trainer-v1`
- new member-level AuntEdna bridge records
- new `athletic-trainer-onboarding` route
- Tier 2 routing to athletic trainers plus clinicians
- Tier 3 routing unchanged as clinician-only

Do not block the first pass on a full generalization of the clinician onboarding route.

That gives us a clean model quickly without destabilizing the current clinician provisioning lane.
