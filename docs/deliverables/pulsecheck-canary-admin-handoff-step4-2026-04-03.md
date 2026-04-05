# PulseCheck Canary Admin Handoff Artifact — Step 4

## Scope

Completed only the current step: created the initial admin handoff artifact in the real PulseCheck membership collections so the first org/team admin slot is reserved before activation.

## Why This Shape Was Chosen

At this step there is still no verified external owner email and no redeemed activation user id yet. Writing a fully claimed admin membership would be false. Writing nothing would leave the handoff untracked in source-of-truth collections.

So the handoff was modeled as a **reserved pending admin principal** in the actual membership collections:

- organization membership role: `org-admin`
- team membership role: `team-admin`
- principal id: `pending-admin:marcus-filly`
- handoff state: `reserved-pending-activation`

This keeps the admin slot explicit without pretending activation has already occurred. `Marcus Filly` remains the named external owner from the canary brief, while owner email remains Unverified pending direct confirmation. [SOT: LEAD-0007, EVID-0004] [SOT: LEAD-0007, EVID-0005]

## Firestore Artifacts Created

### Organization membership

- **Collection:** `pulsecheck-organization-memberships`
- **Document ID:** `revival-strength-functional-bodybuilding_pending-admin:marcus-filly`
- **organizationId:** `revival-strength-functional-bodybuilding`
- **userId:** `pending-admin:marcus-filly`
- **role:** `org-admin`
- **status:** `active`

### Team membership

- **Collection:** `pulsecheck-team-memberships`
- **Document ID:** `revival-strength-functional-bodybuilding--persist_pending-admin:marcus-filly`
- **organizationId:** `revival-strength-functional-bodybuilding`
- **teamId:** `revival-strength-functional-bodybuilding--persist`
- **userId:** `pending-admin:marcus-filly`
- **role:** `team-admin`
- **permissionSetId:** `pulsecheck-team-admin-v1`
- **title:** `Reserved External Admin`
- **rosterVisibilityScope:** `team`
- **onboardingStatus:** `pending-profile`

## Handoff Metadata Written

Both membership docs include `handoffMetadata`:

- `state: "reserved-pending-activation"`
- `handoffKey: "marcus-filly"`
- `targetOwnerName: "Marcus Filly"`
- `targetOwnerEmail: ""` intentionally blank pending confirmation
- `sourceBriefPath: "docs/pulsecheck/canary-target-brief.md"`
- `selectedTargetLeadId: "LEAD-0007"`
- `selectedTargetEvidenceIds: ["EVID-0004", "EVID-0005"]`
- `reservedBy: "scripts/seedPulseCheckCanaryAdminHandoff.js"`

## Code Added

### `src/lib/server/pulsecheck/provisionOrganizationAndTeam.js`

Extended the shared hierarchy module with:

- membership collection constants
- `seedInitialPulseCheckAdminHandoff(...)`
- deterministic reserved principal generation for external owner handoff
- transaction-based seeding of both org and team admin membership docs

### `scripts/seedPulseCheckCanaryAdminHandoff.js`

Standalone canary wrapper that seeds the initial admin handoff artifact and verifies readback from both membership collections.

### Membership type support

Added optional `handoffMetadata` typing so the runtime can read these reserved admin artifacts without schema drift.

## Verification Performed

Ran:

- `node scripts/seedPulseCheckCanaryAdminHandoff.js`

Then queried both membership collections and confirmed:

- exactly one organization membership exists for the canary org handoff principal
- exactly one team membership exists for the canary team handoff principal
- org membership role is `org-admin`
- team membership role is `team-admin`
- team permission set is `pulsecheck-team-admin-v1`
- team membership is linked to the correct `organizationId` and `teamId`
- handoff metadata marks the reservation as pending activation, not claimed

## Source-of-Truth Cross-Check

- `Marcus Filly` as the named external owner is supported by the canary brief and public-site evidence. [SOT: LEAD-0007, EVID-0004]
- `Persist` as the first team remains supported by the canary brief and public-site evidence. [SOT: LEAD-0007, EVID-0004] [SOT: LEAD-0007, EVID-0005]
- Owner email remains **Unverified** and was intentionally not fabricated in the membership docs. [SOT: LEAD-0007, EVID-0004]
- No collaboration commitment is implied by this reservation artifact. Collaboration interest remains **not confirmed**. [SOT: LEAD-0007, EVID-0004]
