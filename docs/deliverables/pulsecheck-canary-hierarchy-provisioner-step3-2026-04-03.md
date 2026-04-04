# PulseCheck Canary Hierarchy Provisioner — Step 3

## Scope

Completed only the current step: added the owned non-legacy provisioning path that creates or verifies the canary organization and initial team together in one controlled transaction.

## Why This Step Was Needed

Steps 1 and 2 proved the org and team documents could be written, but they were still owned by separate ad hoc scripts. That is not a durable provisioning path. The system needed one authoritative function that can create both records together, enforce non-legacy posture, and reject attempts to claim legacy artifacts.

## What Was Added

### Shared server provisioning helper

**File:** `src/lib/server/pulsecheck/provisionOrganizationAndTeam.js`

Added `provisionPulseCheckOrganizationAndTeam(...)`, which:

1. normalizes and validates organization + team payloads together
2. derives deterministic ids when not explicitly supplied
3. rejects `legacySource`, `legacyCoachId`, and `legacy-coach-roster` provisioning metadata for this path
4. runs one Firestore transaction across:
   - `pulsecheck-organizations/{organizationId}`
   - `pulsecheck-teams/{teamId}`
5. preserves existing `createdAt` and original `provisionedAt` when the records already exist
6. behaves idempotently for re-runs against the same non-legacy canary records
7. rejects incompatible pre-existing legacy documents instead of silently mutating them

### Authenticated admin API entrypoint

**File:** `src/pages/api/admin/pulsecheck/provision-organization-and-team.ts`

Added an admin-only Next API route that calls the shared provisioner. This creates a real server-owned entrypoint for future internal dashboard or ops tooling use instead of requiring direct Firestore scripting.

### Combined canary wrapper script

**File:** `scripts/provisionPulseCheckCanaryHierarchy.js`

Added a canary-specific wrapper that calls the shared provisioner with the selected target:

- organization: `Revival Strength / Functional Bodybuilding`
- first team: `Persist`
- external owner: `Marcus Filly`

This script now exercises the same hierarchy-owned provisioning function that the admin API route uses. [SOT: LEAD-0007, EVID-0004] [SOT: LEAD-0007, EVID-0005]

## Verification Performed

Ran:

- `node scripts/provisionPulseCheckCanaryHierarchy.js`

Observed result:

- `organizationCreated: false`
- `teamCreated: false`
- `organizationId: revival-strength-functional-bodybuilding`
- `teamId: revival-strength-functional-bodybuilding--persist`
- `teamInvitePolicy: admin-staff-and-coaches`
- `teamRoutingDefaultsMode: organization-default-optional`

That proves the new owned path is idempotent and can safely re-run against the existing canary artifacts without duplicating records or drifting to a legacy path.

## Architectural Decision Captured

The runtime collections remain:

- `pulsecheck-organizations`
- `pulsecheck-teams`

The shared provisioner writes both collections in one transaction while keeping the team linked by `organizationId`. This avoids introducing a parallel nested collection path that the current product runtime does not consume.

## Safety / Guardrails Added

- Non-legacy path refuses legacy source fields.
- Existing legacy docs cannot be silently adopted by the hierarchy provisioner.
- Team linkage mismatch causes failure instead of overwrite.
- Deterministic ids keep the canary container stable across reruns.

## Source-of-Truth Cross-Check

- `Marcus Filly` as founder / named external owner is supported by the canary brief and public-site evidence. [SOT: LEAD-0007, EVID-0004]
- `Persist` as the initial team is supported by the canary brief and public-site evidence. [SOT: LEAD-0007, EVID-0004] [SOT: LEAD-0007, EVID-0005]
- Collaboration interest remains **not confirmed** and is not asserted otherwise here. [SOT: LEAD-0007, EVID-0004]
- Owner contact email remains **Unverified** and was not fabricated. [SOT: LEAD-0007, EVID-0004]
