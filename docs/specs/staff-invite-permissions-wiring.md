# Spec — Wire up Staff invites + permissions (coach dashboard)

**Owner surface:** `src/pages/coach/dashboard-v2.tsx` → `StaffSection` (and the `CoachDashboardShell` that hosts it).
**Goal:** Make the Staff tab's invite modal + permission checkboxes real — persist staff/invites, send the invite email, and gate dashboard features on the granted permissions. Keep the `/coach/dashboard-v2-demo` walkthrough working (demo stays local-state, **no writes**).

## TL;DR / approach

**Do NOT invent a new `staff` collection.** A full PulseCheck provisioning model already exists and is the source of truth for team members + invites. Staff = `pulsecheck-team-memberships` with non-athlete roles; invites = `pulsecheck-invite-links` (`inviteType: 'team-access'`); emails already go out via the existing Mailgun plumbing. The job is to **extend** that model with a `staffCapabilities` field, **thread it** invite → redeem → membership, **connect** `StaffSection` to the existing service methods on live, and **gate** features on the current coach's capabilities.

The three UI checkboxes are the authoritative model. Persist them verbatim as `staffCapabilities`, and derive the legacy `teamMembershipRole` / `operatingRole` / `rosterVisibilityScope` for backward-compat (report routing, iOS, etc.).

## The capability model (UI is already built)

In `dashboard-v2.tsx` (already shipped):
```ts
type StaffPermission = 'administrative' | 'coaching' | 'athletic_trainer';
```
- **administrative** → update the schedule, train Nora. NO athlete data.
- **coaching** → athlete insights, reports, coaching curriculum, check-in data.
- **athletic_trainer** → the medical peek: Tier 3 escalation detail.

Multi-select; a person can hold several.

### Capability → existing-model derivation (write all of these on the membership)

| `staffCapabilities` includes | `teamMembershipRole` (legacy, single) | `operatingRole` | `rosterVisibilityScope` |
|---|---|---|---|
| `coaching` (± others) | `coach` | `admin-plus-coach` if also `administrative`, else `admin-plus-coach` | `team` |
| `athletic_trainer` only (no coaching) | `performance-staff` | `admin-plus-support-staff` if also `administrative`, else `admin-plus-support-staff` | `team` |
| `administrative` only | `team-admin` | `admin-only` | `none` |

> `operatingRole` enum is `'admin-only' | 'admin-plus-coach' | 'admin-plus-support-staff'` and `rosterVisibilityScope` is `'team' | 'assigned' | 'none'` (see `src/api/firebase/pulsecheckProvisioning/types.ts:33-34`). These derived fields exist only so existing report-routing / iOS gating keeps working. **New dashboard gating must key off `staffCapabilities` directly**, not the derived role.

Put the derivation in one pure helper so invite-create, redeem, and access-update all agree:
```ts
// src/api/firebase/pulsecheckProvisioning/staffCapabilities.ts (new)
export function deriveMembershipAccessFromCapabilities(caps: StaffPermission[]): {
  teamMembershipRole, operatingRole, rosterVisibilityScope
}
```

## Implementation steps

### 1. Types — add `staffCapabilities`
`src/api/firebase/pulsecheckProvisioning/types.ts`
- Add `staffCapabilities?: StaffPermission[]` (define/export `StaffPermission` here and re-import it in `dashboard-v2.tsx` so there's one definition) to:
  - `PulseCheckTeamMembership` (~line 729)
  - `PulseCheckInviteLink` (~line 636)
  - `CreatePulseCheckTeamAccessInviteInput` (~line 819)
  - `UpdatePulseCheckTeamMembershipAccessInput` (~line 881)

### 2. Service — persist + read capabilities
`src/api/firebase/pulsecheckProvisioning/service.ts`
- **`createTeamAccessInviteLink(input)`** (~line 2976): stamp `staffCapabilities` (and the derived `teamMembershipRole`) onto the invite-link doc. The reusable-link de-dupe key currently includes `teamMembershipRole` — leave that; capabilities ride along on the doc.
- **`team-invite/redeem.ts`** flow → wherever the membership doc is created on redeem, copy `staffCapabilities` from the invite link onto the new `pulsecheck-team-membership`, and write the derived `operatingRole` / `rosterVisibilityScope` via `deriveMembershipAccessFromCapabilities`.
- **`updateTeamMembershipAccess(input)`** (~line 3500): accept `staffCapabilities`, write it + re-derive the legacy fields. This is the "edit permissions on an existing staffer" path.
- **`revokeInviteLink(inviteId)`** (~line 3510) already exists — use it for "cancel pending invite".
- **Reads:** `listTeamMemberships(teamId)` (~line 1488) for active+invited staff; `listTeamInviteLinks(teamId)` (~line 1357) for pending invites. Map both into the existing `StaffRow` shape (`status: 'active' | 'invited'`, `permissions: staffCapabilities`).

Follow the established service conventions: `import { db } from '../config'`, `doc/getDoc/setDoc/updateDoc/collection/query/where/getDocs`, `serverTimestamp()`, singleton export. (Reference: `src/api/firebase/privacy/service.ts`, `src/api/firebase/coach/service.ts`.)

### 3. Email — reuse the activation/Mailgun path
The admin-activation invite already sends via Mailgun (`recordAdminActivationEmailResult` + the admin-activation send route; redeem at `src/pages/api/pulsecheck/admin-activation/redeem.ts`, team redeem at `src/pages/api/pulsecheck/team-invite/redeem.ts`). For "Send" in the modal:
- Create the invite link (`createTeamAccessInviteLink`) to get the `activationUrl`.
- Send the email through the **same** Mailgun route/template the admin activation uses (generalize it or add a `team-invite` send route mirroring it). Record the send with the existing email-result tracking + `pulsecheck-invite-activities`.
For "Copy link": just create/fetch the link and copy `activationUrl` — no email.

### 4. Wire `StaffSection` (replace local-only state on LIVE)
`dashboard-v2.tsx` `StaffSection` (~line 1392+):
- Add props: `teamId`, `organizationId`, `coachId`, `coachEmail` (thread from `CoachDashboardShell`; resolve the active team via `pulseCheckProvisioningService.listUserTeamMemberships(coachId)` → pick the team, same pattern as the earnings loader at ~line 735-760).
- **`isDemo === true`** → keep the current local-state behavior **unchanged** (demo writes nothing).
- **`isDemo === false`** →
  - On mount: load real staff (`listTeamMemberships` + `listTeamInviteLinks`) into `staff`.
  - `sendInvite()` → `createTeamAccessInviteLink({ organizationId, teamId, teamMembershipRole: derive(perms), staffCapabilities: perms, targetEmail, recipientName, createdByUserId, createdByEmail })` then trigger the email send; refresh list.
  - `copyLink()` → create/fetch link, copy real `activationUrl`.
  - (Optional, nice-to-have) per-card "Edit permissions" → `updateTeamMembershipAccess`; "Cancel invite" → `revokeInviteLink`.
- Keep all existing `data-*` hooks intact (`data-invite-trigger`, `data-invite-copylink`, `data-invite-modal`, `data-invite-perms`, `data-invite-copy`, `data-perm`, `data-staff-card`, `data-staff-perms`) — the **Nora training drives them**, so do not rename.

### 5. Gate features on the CURRENT coach's capabilities
`CoachDashboardShell` (props ~line 416-441):
- Resolve the signed-in coach's own membership for the active team and read its `staffCapabilities`. Add a prop/derived value, e.g. `viewerCapabilities: StaffPermission[]`.
- Gate the same way `earningsEnabled` filters nav (~line 458-461):
  - **No `coaching`** → hide/disable athlete insights, **Reports**, check-in data, coaching curriculum.
  - **No `athletic_trainer`** → hide **Tier 3 escalation detail** on the athlete card / alerts (the escalation-tier wiring already lives in `dashboard-v2.tsx` + `AthleteReadinessCard.tsx`; gate the Tier-3 detail reveal on this capability).
  - **administrative** → allow Schedule edits + Train Nora.
- A pure `team-admin` (administrative only) should land on a schedule/Train-Nora-capable view with athlete data hidden.
- **Demo (`isDemo`)**: grant all capabilities so the walkthrough shows everything.

> Cross-check against the existing memory rules: SI reports route to team-admin + coach + performance-staff (clinician via AuntEDNA); don't broaden report visibility beyond `coaching`. Keep escalation/Tier-3 gating consistent with the current escalation wiring.

### 6. Firestore rules + indexes
- `firestore.rules` (repo root): add/extend rules so a coach can read `pulsecheck-team-memberships` / `pulsecheck-invite-links` for **their** team, and only `team-admin`/`administrative` can create invites or update access. Follow the existing coach/team rule patterns in that file (468 lines).
- If you add any new composite query (e.g. invite-links by `teamId` + `inviteType` + `status`): **run `firebase firestore:indexes` to pull console-only indexes BEFORE editing `firestore.indexes.json`** (per project rule), then add the index and deploy.

## Acceptance criteria
1. `./node_modules/.bin/tsc --noEmit` clean.
2. **Demo** (`/coach/dashboard-v2-demo`) unchanged: invite modal + checkboxes + Nora training all work, **zero Firestore writes**, all `data-*` hooks intact.
3. **Live** Staff tab loads real active members + pending invites with their permission chips.
4. Inviting a member by email creates a `pulsecheck-invite-links` doc with `staffCapabilities`, sends a Mailgun email, and logs a `pulsecheck-invite-activities` event; the row appears as `Invited`.
5. Copy link copies a real `activationUrl`.
6. Redeeming the invite creates a `pulsecheck-team-membership` carrying `staffCapabilities` + derived legacy fields; the row flips to `Active`.
7. Gating verified: a `coaching`-less staffer can't see Reports/insights; an `athletic_trainer`-less staffer can't see Tier-3 escalation detail; an `administrative`-only staffer can edit Schedule + Train Nora but sees no athlete data.
8. Rules deployed; a coach can only read/write staff for their own team.

## Out of scope
- Changing the iOS redemption UX (the `team-invite` one-link already exists).
- Per-athlete `assigned` roster scoping (leave `rosterVisibilityScope: 'team'` for coaching staff).
- The Nora narration itself (already done; just don't break the `data-*` selectors).

## Key references
- Existing methods: `createTeamAccessInviteLink` (service.ts:2976), `updateTeamMembershipAccess` (:3500), `revokeInviteLink` (:3510), `listTeamMemberships` (:1488), `listTeamInviteLinks` (:1357), `listUserTeamMemberships` (:1476).
- Redeem routes: `src/pages/api/pulsecheck/team-invite/redeem.ts`, `.../admin-activation/redeem.ts`.
- Types: `PulseCheckTeamMembership` (~:729), `PulseCheckInviteLink` (~:636), `CreatePulseCheckTeamAccessInviteInput` (:819), `UpdatePulseCheckTeamMembershipAccessInput` (:881), role enums (:33-46).
- Gating precedent: `earningsEnabled` nav filter (dashboard-v2.tsx:458-461) + earnings eligibility loader (:735-760).
- Service-pattern reference: `src/api/firebase/privacy/service.ts`.
