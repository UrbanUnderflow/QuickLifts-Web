# Hourly Objective Tracker Automation

_Last updated: 2026-02-16_

## What It Does
The tracker script keeps the heartbeat OS honest by:

1. Reading every active KanBan card (status ≠ `done`).
2. Posting an hourly snapshot for each objective into `progress-snapshots` so the Progress Timeline panel shows Act I/II/III status without relying on manual beats.
3. Issuing automated nudges whenever yellow/red cards miss their idle window (uses each card’s `idleThresholdMinutes`).
4. Resolving prior nudges once fresh work-beats land, so the nudge log reflects current attention.

Snapshots appear in the “Hourly Snapshots” rail; nudges stream inline in the main feed via `nudge-log`.

## Command
```
npm run heartbeat:tracker                       # normal run
npm run heartbeat:tracker -- --dry-run          # dry run through npm script
# or call node directly:
node scripts/hourlyObjectiveTracker.js
```
- `--dry-run` logs intended writes without touching Firestore (handy for local tests).
- Requires the same Firebase service-account env vars as other admin scripts (`FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_SECRET_KEY`).

## Logic Overview
| Aspect | Implementation |
| --- | --- |
| Snapshot cadence | Once per execution per objective/agent/hour. Doc ID = `{hour}-{agentId}-{objective}` so reruns in the same hour just update the note. |
| Beat selection | Maps KanBan status to the heartbeat beat (`todo → Hypothesis`, `in-progress → Work-in-flight`, `done → Result`). Red cards force `block`. Notes pull from the Act I/II/III fields with fallbacks to `description/notes`. |
| Objective formatting | Ensures every code ends with `-ACTI/II/III`. If the card lacks an `objectiveCode`, the script falls back to `KANBAN-<id>`. |
| Idle thresholds | Uses each card’s `idleThresholdMinutes`; defaults to 120m for Signals and 45m for Meanings when unset. |
| Nudge rules | Only fire for yellow/red cards beyond their idle limit. Creates `nudge-log` entries with `channel: automation` + pending outcome. Once the card shows activity (minutes < threshold), the script marks pending nudges as `acknowledged`. |
| Agent mapping | Resolves assignees like “Nora ⚡️” or “Sage” to canonical agent IDs/emojis so snapshots + nudges match the Virtual Office.

## Output
Example console output:
```
Snapshot logged for Nora · CR-04-ACTII (work-in-flight)
Nudge issued for Run Club Launch (CR-04-ACTII).
Resolved pending nudge abc123.
Hourly objective tracker complete.
Snapshots written: 3
Nudges issued: 1
Nudges resolved: 1
Tasks skipped (unknown agent): 0
```

## Operational Notes
- Add this script to cron/LaunchAgent (hourly) or trigger manually when auditing the board.
- If a card’s assignee doesn’t map to a known agent ID, it’s skipped—update the KanBan entry or extend `AGENT_DIRECTORY` in the script.
- Because snapshot doc IDs are deterministic, rerunning within the same hour simply refreshes the note instead of duplicating entries.
- Pending nudges remain visible in the feed until the script observes the card back under its idle limit, providing lightweight evidence that Nora saw the recovery.
