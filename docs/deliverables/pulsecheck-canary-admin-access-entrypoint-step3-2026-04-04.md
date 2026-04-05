# PulseCheck Canary Admin Access Entrypoint — Step 3

## Scope

Completed only the current step: added an explicit canary admin-access entrypoint in the shared server provisioning module and moved the canary admin handoff wrapper onto that owned path.

## What Changed

### Shared server provisioning module

**File:** `src/lib/server/pulsecheck/provisionOrganizationAndTeam.js`

Added:

- `buildCanaryAdminAccessInput(params)`
- `provisionPulseCheckCanaryAdminAccess({ adminApp, params })`

This builds the canary admin handoff target from the same selected-target canary source already used for org/team provisioning and routes it into the real membership-layer writer:

- `seedInitialPulseCheckAdminHandoff({ adminApp, input })`

### Canary admin wrapper script

**File:** `scripts/seedPulseCheckCanaryAdminHandoff.js`

Removed the duplicated hardcoded membership input and replaced it with a thin call to:

- `provisionPulseCheckCanaryAdminAccess(...)`

## Admin Access Artifact Owned By The Shared Canary Path

The shared canary admin-access entrypoint now owns the selected admin binding:

- `organizationId = revival-strength-functional-bodybuilding`
- `teamId = revival-strength-functional-bodybuilding--persist`
- `reserved userId = pending-admin:marcus-filly`
- org membership role = `org-admin`
- team membership role = `team-admin`
- team permission set = `pulsecheck-team-admin-v1`
- handoff state = `reserved-pending-activation`

Because owner email remains Unverified pending direct confirmation, the entrypoint intentionally reserves the first admin slot instead of pretending a redeemed real user already exists. `Marcus Filly` remains the named external owner from the canary brief. [SOT: LEAD-0007, EVID-0004] [SOT: LEAD-0007, EVID-0005]

## Why This Matters

Before this change, the low-level membership writer existed, but the canary wrapper still duplicated the selected target binding inline. That meant the admin handoff target could drift away from the org/team canary source.

After this change:

- the shared server module owns canary org defaults
- the shared server module owns canary team defaults
- the shared server module owns canary admin-access defaults
- the wrapper script is only an execution surface

That keeps all three provisioning layers aligned to one selected canary target.

## Verification

Ran:

- `node scripts/seedPulseCheckCanaryAdminHandoff.js`

Confirmed readback result:

- `organizationMembershipId = revival-strength-functional-bodybuilding_pending-admin:marcus-filly`
- `teamMembershipId = revival-strength-functional-bodybuilding--persist_pending-admin:marcus-filly`
- `organizationMembershipCreated = false` on rerun
- `teamMembershipCreated = false` on rerun
- org membership role remains `org-admin`
- team membership role remains `team-admin`
- team permission set remains `pulsecheck-team-admin-v1`

## Source-of-Truth Cross-Check

- `Revival Strength / Functional Bodybuilding` is the selected canary organization. [SOT: LEAD-0007, EVID-0004]
- `Persist` is the first team to provision. [SOT: LEAD-0007, EVID-0004] [SOT: LEAD-0007, EVID-0005]
- `Marcus Filly` is the named external owner and first admin handoff target. [SOT: LEAD-0007, EVID-0004]
- Owner email remains **Unverified** and was not fabricated in this entrypoint. [SOT: LEAD-0007, EVID-0004]
- Collaboration interest remains **not confirmed**. [SOT: LEAD-0007, EVID-0004]
