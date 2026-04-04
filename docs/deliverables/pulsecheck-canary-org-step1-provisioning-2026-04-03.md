# PulseCheck Canary Org Provisioning — Step 1

## Scope

Completed only the current step: created the canary organization shell for the selected coach-led target in Firestore and tagged it as a PulseCheck hierarchy provision, not a legacy coach-signup artifact.

## Selected Target

The organization shell was provisioned for `Revival Strength / Functional Bodybuilding` with `Marcus Filly` as the named external owner and `Persist` recorded as the first planned team. This target and naming come from the locked canary brief. [SOT: LEAD-0007, EVID-0004] [SOT: LEAD-0007, EVID-0005]

## Firestore Artifact Created

- **Collection:** `pulsecheck-organizations`
- **Document ID:** `revival-strength-functional-bodybuilding`
- **Display name:** `Revival Strength / Functional Bodybuilding`
- **Status:** `provisioning`
- **Organization type:** `brand`
- **Primary customer admin name:** `Marcus Filly`
- **Primary customer admin email:** blank by design until direct confirmation
- **Default study posture:** `operational`
- **Default clinician bridge mode:** `optional`
- **Legacy source:** `null`

## Non-Legacy Implementation Metadata Written

The org document includes `implementationMetadata` with the fields below so downstream work can distinguish this record from legacy roster migration or retired coach-signup paths:

- `provisioningPath: "pulsecheck-hierarchy"`
- `legacySignupPathUsed: false`
- `canaryTarget: true`
- `selectedTargetLeadId: "LEAD-0007"`
- `selectedTargetEvidenceIds: ["EVID-0004", "EVID-0005"]`
- `sourceBriefPath: "docs/pulsecheck/canary-target-brief.md"`
- `firstPlannedTeamName: "Persist"`
- `ownerContactStatus: "pending-confirmation"`
- `provisionedBy: "scripts/provisionPulseCheckCanaryOrganization.js"`
- `notes: "Step 1 org shell only. Initial team, admin membership, and activation handoff remain pending."`

## Verification

Readback verification confirmed the document exists in Firestore with the expected non-legacy metadata and organization defaults immediately after the write.

Verified fields:

- `displayName = Revival Strength / Functional Bodybuilding`
- `status = provisioning`
- `legacySource = null`
- `implementationMetadata.provisioningPath = pulsecheck-hierarchy`
- `implementationMetadata.legacySignupPathUsed = false`
- `implementationMetadata.firstPlannedTeamName = Persist`

## Code / Automation Added

### `scripts/provisionPulseCheckCanaryOrganization.js`

Reusable standalone Firebase Admin script that:

1. Connects with the local service account
2. Refuses to overwrite an existing org doc
3. Writes the deterministic canary org document id
4. Reads the doc back and prints a verification summary

### `src/api/firebase/pulsecheckProvisioning/types.ts`

Added `PulseCheckOrganizationImplementationMetadata` so the org record can carry explicit provenance about hierarchy provisioning.

### `src/api/firebase/pulsecheckProvisioning/service.ts`

Added normalization + read/write support for `implementationMetadata` on organization records so the provisioning surface can carry the same metadata shape going forward.

## Constraints Kept

- No legacy coach-signup flow used.
- No fabricated owner email stored.
- No team, membership, or activation-link work was done yet; those remain for later steps.

## Source-of-Truth Cross-Check

- Target coach identity verified from the canary brief and public-source evidence. [SOT: LEAD-0007, EVID-0004]
- Initial team name `Persist` verified from the canary brief and public-source evidence. [SOT: LEAD-0007, EVID-0004] [SOT: LEAD-0007, EVID-0005]
- Owner contact detail remains **Unverified** until direct confirmation and is intentionally not asserted as fact. [SOT: LEAD-0007, EVID-0004]
