# PulseCheck Activation Proof Path Contract

## Question

What exact source-of-truth path proves the canary is successful, and what has to be true before we can honestly say the container is ready for downstream invites?

## Method note

This pass used a fallback research path after diagnosing an environment/tooling issue:

- `rg`/ripgrep is not installed on this machine
- earlier failure was operational, not analytical: the task runner error was triggered while narrating intermediate progress, not because the proof-path research was wrong
- verification in this pass relied on `grep`, `python3`, direct file reads, and existing Firestore-facing code paths instead of retrying the missing-tool workflow

That fallback was sufficient for Step 1 because this step is a contract-definition and source-of-truth mapping task, not a dependency-installation task.

## Short answer

The canary is **not complete** when the org and team shells merely exist, and it is **not complete** when an activation link has merely been generated.

The proof path only closes when all of the following are true in source-of-truth collections and product surfaces:

1. the admin activation invite exists and is redeemed
2. the external coach holds **claimed** org-admin membership in `pulsecheck-organization-memberships`
3. the external coach holds **claimed** team-admin membership in `pulsecheck-team-memberships`
4. the organization and team are both moved to `active`
5. the team-admin membership is completed far enough through post-activation setup to unlock downstream invite creation, especially athlete invites
6. the downstream invite surfaces can create valid invite-link artifacts against the same org/team container

That is the difference between **narrative progress** and **proof**.

---

## Source-of-truth collections in the proof path

### 1) Organization container
- **Collection:** `pulsecheck-organizations`
- **Role in proof:** confirms the org shell exists and whether it is still provisioning, ready for activation, or active

### 2) Team container
- **Collection:** `pulsecheck-teams`
- **Role in proof:** confirms the initial team exists, is linked to the org, carries the right invite policy, and is active after redemption

### 3) Activation artifact
- **Collection:** `pulsecheck-invite-links`
- **Invite type:** `admin-activation`
- **Role in proof:** this is the canonical activation artifact; success requires it to move from `active` to `redeemed`

### 4) Organization admin membership
- **Collection:** `pulsecheck-organization-memberships`
- **Role in proof:** this is the org-scoped authority artifact; success requires the external coach to hold `role = org-admin`

### 5) Team admin membership
- **Collection:** `pulsecheck-team-memberships`
- **Role in proof:** this is the team-scoped authority artifact; success requires the external coach to hold `role = team-admin` with the admin permission set and post-activation readiness

---

## Canonical activation state machine

## A. Provisioned but not activation-ready

### Organization
- `pulsecheck-organizations/{organizationId}` exists
- `status = provisioning`

### Team
- `pulsecheck-teams/{teamId}` exists
- `organizationId` points at the org
- `status = provisioning`

### Reserved admin handoff
- reserved org membership exists in `pulsecheck-organization-memberships`
- reserved team membership exists in `pulsecheck-team-memberships`
- `handoffMetadata.state = reserved-pending-activation`

This is a valid **pre-activation** checkpoint, but it is not proof of completion.

## B. Activation link issued

`pulseCheckProvisioningService.createAdminActivationLink(...)` writes an invite doc and promotes both containers to activation-ready:

- `pulsecheck-invite-links/{token}`
  - `inviteType = admin-activation`
  - `status = active`
  - `organizationId = <org>`
  - `teamId = <team>`
- `pulsecheck-organizations/{organizationId}`
  - `status = ready-for-activation`
- `pulsecheck-teams/{teamId}`
  - `status = ready-for-activation`

This proves the system is ready to hand off. It still does **not** prove the external coach actually owns the container.

## C. Activation redeemed

`POST /api/pulsecheck/admin-activation/redeem` is the canonical claiming path.

On redemption, the route:

1. validates the active `admin-activation` invite
2. enforces target-email match when present
3. resolves the org and team from the invite
4. looks for reserved membership artifacts with `handoffMetadata.state = reserved-pending-activation`
5. reuses those reserved docs when present instead of forking a new admin track
6. rewrites the reserved principal to the authenticated user
7. marks org and team `status = active`
8. marks the invite `status = redeemed`

### Required post-redeem source-of-truth shape

#### Invite link
`pulsecheck-invite-links/{token}`
- `inviteType = admin-activation`
- `status = redeemed`
- `redeemedByUserId` populated
- `redeemedByEmail` populated
- `redeemedAt` populated

#### Organization membership
`pulsecheck-organization-memberships/{membershipId}`
- `organizationId = <org>`
- `userId = <real authenticated uid>`
- `email = <coach email>`
- `role = org-admin`
- `status = active`
- `grantedByInviteToken = <token>`
- `handoffMetadata.state = claimed`

#### Team membership
`pulsecheck-team-memberships/{membershipId}`
- `organizationId = <org>`
- `teamId = <team>`
- `userId = <real authenticated uid>`
- `email = <coach email>`
- `role = team-admin`
- `permissionSetId = pulsecheck-team-admin-v1`
- `rosterVisibilityScope = team`
- `onboardingStatus = pending-profile` initially
- `grantedByInviteToken = <token>`
- `handoffMetadata.state = claimed`

#### Organization document
`pulsecheck-organizations/{organizationId}`
- `status = active`
- `activatedByUserId` populated
- `activatedByEmail` populated
- `activatedAt` populated

#### Team document
`pulsecheck-teams/{teamId}`
- `status = active`
- `activatedByUserId` populated
- `activatedByEmail` populated
- `activatedAt` populated
- `defaultAdminUserIds` includes the redeemed user id

This is the minimum valid **activation proof**.

---

## Why activation proof is still not enough for invite readiness

There is one important downstream gate in the product surface:

### Athlete invites are blocked until post-activation setup is saved

In `src/pages/PulseCheck/post-activation.tsx`:

- athlete invites require `membership.operatingRole`
- athlete invites require a non-empty `membership.title`
- the UI computes `canInviteAthletes = Boolean(membership?.operatingRole && membership?.title?.trim())`

And `pulseCheckProvisioningService.savePostActivationSetup(...)` stamps:

- `title`
- `operatingRole`
- `notificationPreferences`
- `onboardingStatus = profile-complete`
- `postActivationCompletedAt`

So if we stop at “activation redeemed,” the container is admin-owned but **not yet fully ready for athlete invites**.

That means the proof contract for “downstream invite readiness” has to include post-activation completion, not just membership claim.

---

## Invite-readiness contract

A canary container is **invite-ready** only when all activation-proof conditions are true **and** the claimed team-admin membership has been advanced to the post-activation-ready state.

### Required readiness fields on the claimed team-admin membership

`pulsecheck-team-memberships/{teamMembershipId}`
- `role = team-admin`
- `permissionSetId = pulsecheck-team-admin-v1`
- `title` is non-empty
- `operatingRole` is non-empty
- `onboardingStatus = profile-complete` or `complete`
- `postActivationCompletedAt` is populated

### Required readiness fields on the team
`pulsecheck-teams/{teamId}`
- `status = active`
- `defaultInvitePolicy` is set to the intended policy

### Required readiness behavior in product
- `/PulseCheck/post-activation` loads for the claimed admin context
- `/PulseCheck/team-workspace` loads for the claimed admin context
- an adult invite can be created from post-activation
- an athlete invite can be created from workspace/post-activation once the profile gate is satisfied

---

## What counts as final canary success

The canary should count as complete only when this chain is true end to end:

### Phase 1 — container exists
- org exists in `pulsecheck-organizations`
- team exists in `pulsecheck-teams`
- reserved org-admin membership exists
- reserved team-admin membership exists

### Phase 2 — activation handoff exists
- active `admin-activation` invite exists in `pulsecheck-invite-links`
- org and team are `ready-for-activation`

### Phase 3 — external coach claims control
- same invite is `redeemed`
- claimed org-admin membership exists for the real coach uid
- claimed team-admin membership exists for the real coach uid
- handoff state is `claimed`
- org is `active`
- team is `active`

### Phase 4 — container is ready for downstream invites
- claimed team-admin membership has non-empty `title`
- claimed team-admin membership has non-empty `operatingRole`
- team-admin `onboardingStatus` is `profile-complete` or `complete`
- downstream adult invite creation succeeds
- downstream athlete invite creation succeeds

If any one of those is missing, the canary is still incomplete.

---

## Evidence already present in the codebase

### Activation issuance
- `src/api/firebase/pulsecheckProvisioning/service.ts`
  - `createAdminActivationLink(...)`
  - sets invite `inviteType = admin-activation`
  - revokes matching older active links
  - moves org/team to `ready-for-activation`

### Activation redemption
- `src/pages/api/pulsecheck/admin-activation/redeem.ts`
  - validates the invite
  - claims reserved admin artifacts when present
  - writes org-admin and team-admin memberships
  - marks org/team active
  - marks invite redeemed

### Post-activation readiness gate
- `src/api/firebase/pulsecheckProvisioning/service.ts`
  - `savePostActivationSetup(...)`
  - stamps `title`, `operatingRole`, `onboardingStatus = profile-complete`, `postActivationCompletedAt`
- `src/pages/PulseCheck/post-activation.tsx`
  - blocks athlete invites until post-activation profile is saved

### Workspace + downstream invite surfaces
- `src/pages/PulseCheck/team-workspace.tsx`
  - team-admin permission surface
  - athlete invite controls
  - role-based roster visibility and permission options

### Existing e2e smoke coverage
- `tests/e2e/pulsecheck-onboarding-workspace.spec.ts`
  - post-activation surface loads
  - workspace surface loads
  - adult invite redemption works end to end
  - athlete invite redemption works end to end

---

## Recommended acceptance contract for the next execution step

For the execution/verification step, I would use this exact checklist:

### Activation proof checklist
- [ ] one `admin-activation` invite exists for the canary org/team and is redeemed
- [ ] org document is `active`
- [ ] team document is `active`
- [ ] org-admin membership belongs to the real coach uid/email
- [ ] team-admin membership belongs to the real coach uid/email
- [ ] team-admin membership carries `pulsecheck-team-admin-v1`
- [ ] both claimed membership artifacts reference the same org/team container
- [ ] reserved handoff artifact was claimed rather than bypassed when present

### Invite-readiness checklist
- [ ] claimed team-admin membership has `title`
- [ ] claimed team-admin membership has `operatingRole`
- [ ] claimed team-admin membership has `onboardingStatus = profile-complete` or `complete`
- [ ] post-activation surface loads in the claimed admin session
- [ ] workspace surface loads in the claimed admin session
- [ ] adult invite generation succeeds against the canary team
- [ ] athlete invite generation succeeds against the canary team

---

## Recommendation

Use **two separate labels** in status reporting:

1. **Activation Proven**
   - redeemed invite
   - claimed org/team admin memberships
   - org/team active

2. **Invite Ready**
   - activation proven
   - post-activation profile complete
   - downstream invite creation works

That split matches the actual product contract and prevents us from overstating progress.

## Bottom line

The proof path is:

`pulsecheck-invite-links (admin-activation)` → `pulsecheck-organization-memberships (org-admin)` + `pulsecheck-team-memberships (team-admin)` → `pulsecheck-organizations active` + `pulsecheck-teams active` → `team-admin profile-complete` → downstream invite creation succeeds.

Anything short of that is still an intermediate checkpoint, not canary success.
