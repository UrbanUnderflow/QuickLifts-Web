# PulseCheck Admin Activation Hierarchy Surface — Step 4

## Scope

Completed only the current step: updated the admin activation server surface so redemption resolves and claims the new hierarchy-backed org/team admin handoff artifacts instead of minting a parallel admin membership path.

## What Changed

### Server activation surface updated

**File:** `src/pages/api/pulsecheck/admin-activation/redeem.ts`

The admin activation redeem route already loaded the new hierarchy records from:

- `pulsecheck-organizations/{organizationId}`
- `pulsecheck-teams/{teamId}`

But it still had a subtle hierarchy bug: on redemption it always wrote fresh membership documents at:

- `pulsecheck-organization-memberships/${organizationId}_${userId}`
- `pulsecheck-team-memberships/${teamId}_${userId}`

That bypassed the reserved handoff artifacts created for the new hierarchy and would leave the pending admin reservation orphaned.

## Fix Applied

The redeem route now:

1. queries for the reserved org admin handoff membership for the target organization
2. queries for the reserved team admin handoff membership for the target `{organizationId, teamId}` pair
3. reuses those reserved membership document refs when present
4. rewrites the reserved placeholder principal into the real authenticated user
5. marks `handoffMetadata.state = claimed`
6. stamps claimed-by metadata on the handoff record
7. preserves granted/created timestamps when claiming an existing reserved artifact

If a reserved handoff membership does not exist, the route still falls back to creating the direct membership docs so the path remains safe for non-canary or older invites.

## Why This Matters

This fixes the actual hierarchy consumption issue.

Before:

- activation page resolved org/team correctly from the new hierarchy
- redeem route activated org/team correctly
- but membership redemption could fork state by creating a second admin record instead of claiming the reserved canary handoff artifact

After:

- activation page resolves the org/team container from the new hierarchy
- redeem route resolves the reserved admin-access artifact from the new hierarchy membership layer
- the first real admin claims the intended org/team container rather than creating a duplicate admin track

## Verification

Performed a compile-level sanity check on:

- `src/pages/api/pulsecheck/admin-activation/redeem.ts`

Reviewed the resulting diff to confirm the redeem route now:

- queries reserved hierarchy memberships using `handoffMetadata.state = reserved-pending-activation`
- reuses the reserved doc refs when present
- converts handoff metadata to `claimed`
- keeps org/team activation updates on the hierarchy collections

## Source-of-Truth Cross-Check

- `Revival Strength / Functional Bodybuilding` is the selected canary organization. [SOT: LEAD-0007, EVID-0004]
- `Persist` is the first team to provision. [SOT: LEAD-0007, EVID-0004] [SOT: LEAD-0007, EVID-0005]
- `Marcus Filly` is the named external owner and first admin handoff target. [SOT: LEAD-0007, EVID-0004]
- Owner email remains **Unverified** and this step does not fabricate one. [SOT: LEAD-0007, EVID-0004]
- Collaboration interest remains **not confirmed**. [SOT: LEAD-0007, EVID-0004]
