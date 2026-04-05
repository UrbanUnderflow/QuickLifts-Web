# PulseCheck Canary Team Entrypoint — Step 2

## Scope

Completed only the current step: extended the same non-legacy canary provisioning path so it now owns creation of the first team document as part of the shared canary builder, and updated the canary hierarchy wrapper to use that entrypoint instead of carrying a duplicated org/team payload.

## What Changed

### Shared server provisioning module

**File:** `src/lib/server/pulsecheck/provisionOrganizationAndTeam.js`

Added:

- `provisionPulseCheckCanaryOrganizationAndTeam({ adminApp, params })`

This function uses the existing shared canary builder:

- `buildCanaryProvisioningInput(params)`

and routes that into the non-legacy hierarchy write path:

- `provisionPulseCheckOrganizationAndTeam({ adminApp, input })`

That means the selected-target defaults for both the org and first team now come from one owned server path instead of from a hand-built wrapper payload.

### Canary wrapper script

**File:** `scripts/provisionPulseCheckCanaryHierarchy.js`

Removed the duplicated in-script org/team payload and replaced it with a thin call to:

- `provisionPulseCheckCanaryOrganizationAndTeam(...)`

## Team Defaults Now Owned By The Shared Canary Path

The shared canary entrypoint now owns the first team definition for the selected target:

- `teamId = revival-strength-functional-bodybuilding--persist`
- `displayName = Persist`
- `teamType = brand-athlete-group`
- `status = provisioning`
- `defaultInvitePolicy = admin-staff-and-coaches`
- `defaultClinicianProfileType = group`
- `defaultClinicianProfileSource = pulsecheck-local`
- `implementationMetadata.provisioningPath = pulsecheck-hierarchy`
- `implementationMetadata.routingDefaultsMode = organization-default-optional`
- `implementationMetadata.invitePosture = admin-staff-and-coaches`

This is the same team shell that already exists in Firestore, but now the shared canary entrypoint is the authoritative source for recreating or reconciling it.

## Why This Matters

Before this change, the org-only canary entrypoint lived in the server module, but the org+team canary wrapper still redefined the full team payload locally. That split ownership is exactly how provisioning drifts start.

After this change:

- the shared server module owns canary org defaults
- the shared server module owns canary team defaults
- the wrapper script is only an execution surface
- future admin/API entrypoints can reuse the same canary org+team path without copying the payload again

## Verification

Ran:

- `node scripts/provisionPulseCheckCanaryHierarchy.js`

Confirmed readback result:

- `organizationId = revival-strength-functional-bodybuilding`
- `teamId = revival-strength-functional-bodybuilding--persist`
- `teamCreated = false` on rerun
- `teamStatus = provisioning`
- `teamInvitePolicy = admin-staff-and-coaches`
- `teamRoutingDefaultsMode = organization-default-optional`

Readback also confirmed the existing team document still contains the expected `teamType`, invite posture, and routing-default metadata.

## Source-of-Truth Cross-Check

- `Revival Strength / Functional Bodybuilding` is the selected canary organization. [SOT: LEAD-0007, EVID-0004]
- `Persist` is the first team to provision. [SOT: LEAD-0007, EVID-0004] [SOT: LEAD-0007, EVID-0005]
- `Marcus Filly` is the named external owner. [SOT: LEAD-0007, EVID-0004]
- Owner email remains **Unverified** and was not fabricated in this entrypoint. [SOT: LEAD-0007, EVID-0004]
- Collaboration interest remains **not confirmed**. [SOT: LEAD-0007, EVID-0004]
