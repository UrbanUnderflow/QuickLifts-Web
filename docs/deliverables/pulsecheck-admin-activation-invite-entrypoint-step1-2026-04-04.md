# PulseCheck Admin Activation Invite Entrypoint — Step 1

## Scope

Completed the implementation layer for the current step: added the real server-side issuer and CLI surface that create the canonical admin-activation invite artifact for the canary organization once a confirmed recipient email is supplied.

## What Changed

### Shared server provisioning module

**File:** `src/lib/server/pulsecheck/provisionOrganizationAndTeam.js`

Added:

- `ADMIN_ACTIVATION_INVITES_COLLECTION = "adminActivationInvites"`
- `INVITE_LINKS_COLLECTION = "pulsecheck-invite-links"`
- `buildAdminActivationInviteId(...)`
- `buildPulseCheckAdminActivationUrl(...)`
- `issuePulseCheckAdminActivationInvite({ adminApp, input })`

The new issuer now:

1. validates that the target org and team exist and are linked correctly
2. refuses to issue an invite without a confirmed target email
3. revokes prior pending/admin-activation artifacts for the same org/team/email
4. writes the canonical Firestore record in `/adminActivationInvites/{inviteId}`
5. mirrors the live redeemable link into `/pulsecheck-invite-links/{token}` so the existing admin activation route can consume it
6. marks the organization and team as `ready-for-activation`
7. stamps the confirmed admin email back onto the org/team source-of-truth records

### Execution script

**File:** `scripts/createPulseCheckAdminActivationInvite.js`

Added a production CLI wrapper that calls the shared issuer and verifies readback from:

- `adminActivationInvites/{inviteId}`
- `pulsecheck-invite-links/{token}`
- `pulsecheck-organizations/{organizationId}`
- `pulsecheck-teams/{teamId}`

Usage:

```bash
node scripts/createPulseCheckAdminActivationInvite.js \
  --email=<confirmed-owner-email> \
  --name="Marcus Filly" \
  --organizationId=revival-strength-functional-bodybuilding \
  --teamId=revival-strength-functional-bodybuilding--persist
```

## Artifact Shape Now Issued

The canonical invite record created by the new server path includes:

- `organizationId`
- `teamId`
- `email`
- `role = org_admin`
- `teamRole = team_admin`
- `token`
- `activationUrl`
- `expiresAt`
- `status = pending`

This matches the required step output while also preserving compatibility with the existing admin redemption surface.

## Current Safety Gate

I checked the live canary Firestore state before issuing the invite and found:

- `pulsecheck-organizations/revival-strength-functional-bodybuilding.primaryCustomerAdminEmail = ""`
- `pulsecheck-teams/revival-strength-functional-bodybuilding--persist.defaultAdminEmail = ""`
- no documents currently exist in `/adminActivationInvites` for the canary org/team

Because the owner email is still blank in source-of-truth, the new issuer intentionally throws instead of fabricating a recipient. That is the correct production behavior: the system is now ready to create the real invite, but only after a confirmed admin address is provided.

## Why This Matters

Before this change, the canary had only a reserved membership handoff state. There was no owned path that produced the actual admin activation invite artifact required for external handoff.

After this change, step 1 is implemented in the real write layer. The remaining operational action is simply supplying the confirmed recipient email and running the issuer.

## Verification

Confirmed locally:

- `node -c src/lib/server/pulsecheck/provisionOrganizationAndTeam.js`
- `node -c scripts/createPulseCheckAdminActivationInvite.js`

Confirmed from Firestore readback before issuance:

- canary org exists
- canary team exists
- org/team are still missing a confirmed admin email
- `/adminActivationInvites` has no canary invite yet

## Source-of-Truth Cross-Check

- `Revival Strength / Functional Bodybuilding` remains the selected canary organization. [SOT: LEAD-0007, EVID-0004]
- `Persist` remains the initial team for the canary hierarchy. [SOT: LEAD-0007, EVID-0004] [SOT: LEAD-0007, EVID-0005]
- `Marcus Filly` remains the named external owner for the canary. [SOT: LEAD-0007, EVID-0004]
- A coach-owner email for Marcus Filly is still Unverified in source-of-truth and was therefore not fabricated into the invite artifact. [SOT: LEAD-0007, EVID-0004]
