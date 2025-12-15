# Coach Team Invite Tracking (Coach Onboard Links)

This doc explains how **Pulse team invites** differ from **coach referral (kickback) links**, and how we store each one during signup.

## TL;DR (what to send)

- **Team-owned coach invite link (for Tre/team outreach)**:
  - `https://fitwithpulse.ai/coach-onboard?invite=TEAM_CODE`

- **Coach-to-coach referral link (kickback/connected coaches)**:
  - `https://fitwithpulse.ai/coach/sign-up?ref=COACH_REFERRAL_CODE`

> Important: `invite` and `ref` are intentionally separate so we don’t mix **team attribution** with **coach kickback attribution**.

## Last Updated

- 2025-12-15

## Parameters

### `invite` (team-owned attribution)

- **Where used**: `/coach-onboard?invite=...` → redirects CTA into `/sign-up?type=coach&invite=...`
- **Purpose**: attribute coach signups to **team outreach** (campaign/channel/person).
- **Examples**:
  - `invite=DEC_2025_OUTREACH`
  - `invite=IG_DM`
  - `invite=TREMAINE`

**Persistence**

- On successful coach signup, we store:
  - `users/{uid}.onboardInvite = { source: 'coach-onboard', code: <string>, capturedAt: <unix seconds> }`
- When the coach profile is created, we copy the same object onto:
  - `coaches/{uid}.onboardInvite`

### `ref` (coach referral / kickback)

- **Where used**: `/coach/sign-up?ref=...`
- **Purpose**: connect coach-to-coach via referral code (kickback / network graph).
- **Persistence**:
  - Stored temporarily in localStorage as `pulse_referring_coach_code`
  - Used to call `coachService.connectCoachToCoachByReferralCode(...)`

## Notes / conventions

- Use `invite` for anything **team-owned** (internal attribution).
- Use `ref` for anything **coach-owned** (referral/kickback).
- If you want attribution you can query directly on the coach doc, use `coaches/{uid}.onboardInvite.code`.


