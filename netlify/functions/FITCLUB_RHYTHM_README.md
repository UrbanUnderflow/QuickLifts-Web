# FitClub Club Rhythm — daily drop, nightly recap, host broadcast

Server-side delivery for the FitClub "experience" layer. Three functions
share `lib/clubRhythm.js`.

## Functions

| File | Trigger | Purpose |
|------|---------|---------|
| `fitclub-daily-drop.ts` | scheduled `0 13 * * *` (UTC) | Morning "today's workout dropped" push to recap-enabled clubs that have programming. |
| `fitclub-nightly-recap.ts` | scheduled `0 2 * * *` (UTC) | Writes `clubs/{id}/recaps/{date}` and pushes the recap line — **only when X > 0**. Nora authors the line (`lib/clubRecapNarrator.ts`); falls back to the templated "X of Y showed up" if Claude errors. |
| `broadcast-club-announcement.ts` | HTTP POST | Reliable host-megaphone fan-out (replaces the iOS best-effort loop). |

Schedules self-register via `@netlify/functions` `schedule()` — no
`netlify.toml` entry needed (mirrors `send-weekly-review-checkin`).

## Safety gates (read before going live)

1. **Dry-run by default.** Both scheduled functions check
   `FITCLUB_RHYTHM_LIVE`. Until it's set to `true` in the Netlify env,
   they compute and log what they *would* send but deliver nothing.
   Watch the function logs for a cycle, confirm counts look right, then
   flip the flag.
2. **Host opt-in.** Both only touch clubs where
   `capabilities.recapEnabled == true` — the toggle in club settings
   (Manage → Features → "Daily drop & recap"). New/quiet clubs are off
   by default.
3. **No empty recaps.** The nightly recap skips any club with zero
   activity for the day, so a quiet club never gets a sad "0 of N".
4. **Broadcast is host-only.** `broadcast-club-announcement` verifies
   `fromUserId === club.creatorId` before sending.

## Data contract

- **Activity source (recap):** `clubs/{clubId}/dailyActivity/{yyyy-MM-dd}`
  with `activeMemberIds: string[]`. Written by iOS on workout finish
  (`ClubEventEngagementService.recordClubActivity`). Currently fires from
  the freeform/immersive completion path; extend to guided / run / bike
  completion paths for full coverage.
- **Recap artifact:** `clubs/{clubId}/recaps/{yyyy-MM-dd}` with
  `{ showedUp, totalMembers, dateKey, createdAt, recapText, authoredBy,
  streakDays }` — the club-home recap card (HAPPENING rail) reads this.
  `recapText` is Nora's line; `authoredBy` is `nora` | `template`;
  `streakDays` is consecutive active days (incl. today). iOS surfaces it
  via `ClubEventEngagementService.observeLatestRecap` for `dateKey` ==
  today or yesterday (member-local), so the card auto-retires.

- **Nora recap context:** the cron reads the prior day's recap (trend) and
  walks back through recap docs to compute the active-day streak, then
  hands `{ clubName, showedUp, totalMembers, weekday, yesterdayShowedUp,
  activeStreakDays }` to `narrateRecap`. Feature id `fitclubNightlyRecap`
  (Haiku 4.5, registered in `src/api/anthropic/featureRouting.ts`). Audit
  logged like every other Anthropic call. Never blocks the recap: any
  error → template line.
- **Push types** (handled in iOS `AppState` notification routing):
  `clubDailyDrop`, `clubDailyRecap`, `clubAnnouncement`.

## Go-live checklist

- [ ] Deploy functions to Netlify.
- [ ] Verify `broadcast-club-announcement` end-to-end (host posts an
      announcement → members get the push).
- [ ] Let the two scheduled crons run ≥1 cycle in dry-run; inspect logs.
- [ ] Set `FITCLUB_RHYTHM_LIVE=true` to enable real delivery.
- [ ] (Refinement) Per-club local-time scheduling — one cron that gates
      on each club's `timezoneIdentifier` instead of fixed UTC hours.
- [ ] (Refinement) Daily-drop should resolve the active challenge's
      movelist and name today's workout in the push body.
