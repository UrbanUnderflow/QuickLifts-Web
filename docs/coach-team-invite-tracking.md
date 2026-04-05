# Coach Team Invite Tracking

This doc explains the canonical coach-led organization invite path and the legacy route cleanup that replaced the old coach referral-code flow.

## TL;DR (what to send)

- **Canonical coach invite link**:
  - `https://fitwithpulse.ai/sign-up?type=coach&invite=TEAM_CODE`

- **Legacy redirects still accepted temporarily**:
  - `/coach-onboard?invite=TEAM_CODE` → redirects to `/sign-up?type=coach&invite=TEAM_CODE`
  - `/coach/sign-up` → redirects to `/sign-up?type=coach&invite=...` when invite data exists, otherwise to `/PulseCheck/coach`
  - `/coach-invite/{referralCode}` and `/connect/{referralCode}` no longer provision access and now redirect into PulseCheck login with a retirement notice

> Important: team attribution now lives on PulseCheck org/team invite data. Legacy coach referral-code entrypoints are retired.

## Last Updated

- 2025-12-15

## Parameters

### `invite` (team-owned attribution)

- **Where used**: `/sign-up?type=coach&invite=...`
- **Purpose**: attribute coach signups to team outreach or campaign ownership while the old invite-code registry is being retired.
- **Examples**:
  - `invite=DEC_2025_OUTREACH`
  - `invite=IG_DM`
  - `invite=TREMAINE`

**Persistence**

- On successful coach signup, we store:
  - `users/{uid}.onboardInvite = { source: 'coach-onboard', code: <string>, capturedAt: <unix seconds> }`
- When the coach profile is created, we copy the same object onto:
  - `coaches/{uid}.onboardInvite`

## Notes / conventions

- Use `invite` for coach-led organization attribution during signup.
- Use PulseCheck team invites and admin activation links for downstream staff, coach, and athlete access.
- If you want attribution you can query directly on the coach doc, use `coaches/{uid}.onboardInvite.code`.

