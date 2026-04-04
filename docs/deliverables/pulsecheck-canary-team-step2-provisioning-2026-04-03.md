# PulseCheck Canary Team Provisioning — Step 2

## Scope

Completed only the current step: created the initial team shell for the selected canary organization and verified the actual Firestore document contents after write.

## Selected Target Context

The first team was provisioned under `Revival Strength / Functional Bodybuilding` and named `Persist`, matching the locked canary brief. `Marcus Filly` remains the named external owner for the canary, while contact email remains Unverified until direct confirmation. [SOT: LEAD-0007, EVID-0004] [SOT: LEAD-0007, EVID-0005]

## Collection Choice

The live PulseCheck runtime currently reads team truth from the flat `pulsecheck-teams` collection keyed by `organizationId`, not from a nested org subcollection. To avoid creating a parallel, unused team path that the app would ignore, the team shell was provisioned in the runtime collection the product already consumes.

Created artifact:

- **Collection:** `pulsecheck-teams`
- **Document ID:** `revival-strength-functional-bodybuilding--persist`
- **Linked organizationId:** `revival-strength-functional-bodybuilding`

## Team Defaults Written

- **displayName:** `Persist`
- **teamType:** `brand-athlete-group`
- **sportOrProgram:** `Coach-led training program`
- **siteLabel:** `Functional Bodybuilding / Persist`
- **status:** `provisioning`
- **defaultAdminName:** `Marcus Filly`
- **defaultAdminEmail:** blank by design until direct confirmation
- **defaultInvitePolicy:** `admin-staff-and-coaches`

### Commercial defaults

- `commercialModel: athlete-pay`
- `teamPlanStatus: inactive`
- `referralKickbackEnabled: false`
- `referralRevenueSharePct: 0`
- `revenueRecipientRole: team-admin`

### Routing defaults written

- `defaultClinicianProfileId: ""`
- `defaultClinicianExternalProfileId: ""`
- `defaultClinicianProfileName: ""`
- `defaultClinicianProfileType: "group"`
- `defaultClinicianProfileSource: "pulsecheck-local"`

The team intentionally inherits the organization's optional clinician-bridge posture until a concrete clinician profile is attached. That keeps the team shell honest: no fake clinician route, no silent legacy fallback.

## Team Implementation Metadata Written

The team document includes explicit non-legacy metadata so downstream tooling can tell this team came from the canary hierarchy path:

- `provisioningPath: "pulsecheck-hierarchy"`
- `legacySignupPathUsed: false`
- `canaryTarget: true`
- `selectedTargetLeadId: "LEAD-0007"`
- `selectedTargetEvidenceIds: ["EVID-0004", "EVID-0005"]`
- `sourceBriefPath: "docs/pulsecheck/canary-target-brief.md"`
- `routingDefaultsMode: "organization-default-optional"`
- `invitePosture: "admin-staff-and-coaches"`
- `provisionedBy: "scripts/provisionPulseCheckCanaryTeam.js"`
- `notes: "Initial canary team shell only. Team admin membership and activation handoff remain pending."`

## Verification

Readback verification confirmed:

- linked organization exists
- team document exists
- `organizationId` points at the canary org
- `teamType` is `brand-athlete-group`
- `defaultInvitePolicy` is `admin-staff-and-coaches`
- routing default fields are present and intentionally blank at the clinician-profile layer
- implementation metadata marks the team as a PulseCheck hierarchy provision, not a legacy signup artifact

## Code / Automation Added

### `scripts/provisionPulseCheckCanaryTeam.js`

Standalone Firebase Admin provisioning script that:

1. verifies the canary organization already exists
2. refuses to overwrite an existing team doc
3. writes the deterministic team shell id
4. reads the team back and prints the written defaults

### `src/api/firebase/pulsecheckProvisioning/types.ts`

Added `PulseCheckTeamImplementationMetadata` so team objects can carry non-legacy provenance, invite posture, and routing-default mode explicitly.

### `src/api/firebase/pulsecheckProvisioning/service.ts`

Added normalization and read/write support for `implementationMetadata` on team records.

## Source-of-Truth Cross-Check

- `Persist` as the first team is verified by the locked canary brief and public-site evidence. [SOT: LEAD-0007, EVID-0004] [SOT: LEAD-0007, EVID-0005]
- `Marcus Filly` as the named external owner is verified by the public About page evidence. [SOT: LEAD-0007, EVID-0004]
- Owner contact email remains **Unverified** and was not fabricated or asserted. [SOT: LEAD-0007, EVID-0004]
