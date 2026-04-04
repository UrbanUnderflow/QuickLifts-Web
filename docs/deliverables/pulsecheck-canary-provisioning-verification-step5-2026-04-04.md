# PulseCheck Canary Provisioning Verification — Step 5

## Scope

Completed only the current step: verified the canary provisioning artifacts in Firestore and confirmed the org, team, and reserved admin handoff membership records all exist with the expected non-legacy hierarchy metadata and linkage.

## Verification Method

Ran a single readback script against the production Firestore source-of-truth collections:

- `pulsecheck-organizations`
- `pulsecheck-teams`
- `pulsecheck-organization-memberships`
- `pulsecheck-team-memberships`

Script:

- `scripts/verifyPulseCheckCanaryProvisioning.js`

Result:

- `ok: true`
- `failures: []`

## Verified Organization Artifact

**Document:** `pulsecheck-organizations/revival-strength-functional-bodybuilding`

Confirmed:

- document exists
- `displayName = Revival Strength / Functional Bodybuilding`
- `status = provisioning`
- `defaultClinicianBridgeMode = optional`
- `implementationMetadata.provisioningPath = pulsecheck-hierarchy`
- `implementationMetadata.legacySignupPathUsed = false`
- `implementationMetadata.canaryTarget = true`
- `implementationMetadata.firstPlannedTeamName = Persist`

This confirms the canary org exists and is explicitly marked as a non-legacy hierarchy provision. `Marcus Filly` remains the named external owner, and owner email remains Unverified pending direct confirmation. [SOT: LEAD-0007, EVID-0004] [SOT: LEAD-0007, EVID-0005]

## Verified Team Artifact

**Document:** `pulsecheck-teams/revival-strength-functional-bodybuilding--persist`

Confirmed:

- document exists
- `organizationId = revival-strength-functional-bodybuilding`
- `displayName = Persist`
- `teamType = brand-athlete-group`
- `status = provisioning`
- `defaultInvitePolicy = admin-staff-and-coaches`
- `implementationMetadata.provisioningPath = pulsecheck-hierarchy`
- `implementationMetadata.routingDefaultsMode = organization-default-optional`
- clinician profile fields are intentionally blank, matching inherit-from-org optional bridge posture

This confirms the initial team shell exists, points at the canary org, and carries the intended invite posture and routing-default mode. [SOT: LEAD-0007, EVID-0004] [SOT: LEAD-0007, EVID-0005]

## Verified Admin Handoff Artifacts

### Organization membership

**Document:** `pulsecheck-organization-memberships/revival-strength-functional-bodybuilding_pending-admin:marcus-filly`

Confirmed:

- document exists
- `organizationId = revival-strength-functional-bodybuilding`
- `userId = pending-admin:marcus-filly`
- `role = org-admin`
- `handoffMetadata.state = reserved-pending-activation`

### Team membership

**Document:** `pulsecheck-team-memberships/revival-strength-functional-bodybuilding--persist_pending-admin:marcus-filly`

Confirmed:

- document exists
- `organizationId = revival-strength-functional-bodybuilding`
- `teamId = revival-strength-functional-bodybuilding--persist`
- `userId = pending-admin:marcus-filly`
- `role = team-admin`
- `permissionSetId = pulsecheck-team-admin-v1`
- `onboardingStatus = pending-profile`
- `handoffMetadata.state = reserved-pending-activation`

This confirms the initial admin handoff artifact is present in both membership collections and linked to the correct organization and team.

## Dependency Truth

The canary container is now verified at the current pre-activation stage:

- org exists
- team exists
- reserved first-admin org membership exists
- reserved first-admin team membership exists
- team permission set is already scoped to the team-admin role
- all records point at the same org/team container

What remains outside this step is expected:

- the reserved admin principal is not yet a redeemed real user
- owner email is still Unverified pending direct confirmation
- activation state remains pending because redemption has not happened yet

## Source-of-Truth Cross-Check

- `Revival Strength / Functional Bodybuilding` is the selected canary organization. [SOT: LEAD-0007, EVID-0004]
- `Persist` is the first team to provision. [SOT: LEAD-0007, EVID-0004] [SOT: LEAD-0007, EVID-0005]
- `Marcus Filly` is the named external owner. [SOT: LEAD-0007, EVID-0004]
- Owner contact email remains **Unverified** and is intentionally blank in the Firestore handoff artifact. [SOT: LEAD-0007, EVID-0004]
- No collaboration commitment is implied; collaboration interest remains **not confirmed**. [SOT: LEAD-0007, EVID-0004]
