# PulseCheck Canary Org Entrypoint — Step 1

## Scope

Completed only the current step: added an explicit non-legacy canary organization provisioning entrypoint in the shared server provisioning module and moved the canary org script onto that owned path.

## What Changed

### Shared server module

**File:** `src/lib/server/pulsecheck/provisionOrganizationAndTeam.js`

Added:

- `buildCanaryProvisioningInput(params)`
- `upsertPulseCheckOrganization({ adminApp, input })`
- `provisionPulseCheckCanaryOrganization({ adminApp, params })`

This gives the codebase a specific canary org entrypoint instead of relying on an ad hoc script-local payload.

## Behavior of the New Entrypoint

`provisionPulseCheckCanaryOrganization(...)` now owns the org-level canary defaults for the selected target:

- `organizationId = revival-strength-functional-bodybuilding`
- `displayName = Revival Strength / Functional Bodybuilding`
- `organizationType = brand`
- `status = provisioning`
- `primaryCustomerAdminName = Marcus Filly`
- `defaultStudyPosture = operational`
- `defaultClinicianBridgeMode = optional`
- `implementationMetadata.provisioningPath = pulsecheck-hierarchy`
- `implementationMetadata.legacySignupPathUsed = false`
- `implementationMetadata.canaryTarget = true`
- `implementationMetadata.firstPlannedTeamName = Persist`

The canary payload also carries the downstream team defaults in the builder so later steps can reuse the same source-of-truth input, but this step only exercises the org write path.

## Why This Matters

Before this change, the canary org script built and wrote its own org payload directly. That meant the selected-target defaults lived partly in the script and partly in the shared provisioner.

Now the selected canary org configuration is centralized in the server provisioning module, which is the right dependency direction:

- shared module owns provisioning defaults
- script becomes a thin wrapper
- future admin/API surfaces can call the same entrypoint

## Verification

Ran:

- `node scripts/provisionPulseCheckCanaryOrganization.js`

Confirmed readback result:

- `organizationId = revival-strength-functional-bodybuilding`
- `organizationCreated = false` on rerun
- `organizationStatus = provisioning`
- `defaultClinicianBridgeMode = optional`
- `implementationPath = pulsecheck-hierarchy`

Readback also confirmed the Firestore org doc still contains the expected non-legacy canary metadata.

## Source-of-Truth Cross-Check

- `Revival Strength / Functional Bodybuilding` is the selected canary organization. [SOT: LEAD-0007, EVID-0004]
- `Marcus Filly` is the named external owner. [SOT: LEAD-0007, EVID-0004]
- `Persist` remains the planned first team. [SOT: LEAD-0007, EVID-0004] [SOT: LEAD-0007, EVID-0005]
- Owner email remains **Unverified** and was not fabricated in the provisioning entrypoint. [SOT: LEAD-0007, EVID-0004]
- Collaboration interest remains **not confirmed**. [SOT: LEAD-0007, EVID-0004]
