# Pilot Outcome Rollout Runbook

## Purpose

This runbook governs rollout, backfill, validation, rollback, and observability for the PulseCheck pilot outcome system.

## Ownership

| Area | Owner Role | Primary Responsibilities |
| --- | --- | --- |
| Backend / Read Models | PulseCheck backend owner | Canonical event writers, snapshot generation, rollup recompute, repair jobs, manual recompute endpoint, ops alerts |
| iOS / Athlete App | PulseCheck iOS owner | Baseline completion payloads, optional PTT capture, trust/NPS prompts, survey submission flows |
| Admin Web | QuickLifts admin owner | Outcome dashboard controls, release settings, ops status surfaces, staff survey entry, staged rollout UX |
| Data / Analytics | Pilot analytics owner | Metric QA, denominator spot checks, trust/NPS sample interpretation, readout review, hypothesis interpretation |

## Handoff Points

- Backend to iOS:
  - `complete-pulsecheck-baseline` contract for optional trust disposition baseline payload.
  - `get-pilot-survey-prompt-state` and `record-pilot-survey-response` contracts.
- Backend to admin web:
  - rollup diagnostics contract in `pulsecheck-pilot-metrics.js`.
  - manual recompute endpoint and ops status docs.
- Admin web to analytics:
  - staged-rollout pilot selection.
  - low-sample interpretation and readout signoff.
- Analytics to backend:
  - denominator anomalies.
  - rollup drift reports.

## Release Stages

- `disabled`
  - Outcome cards are hidden for the pilot.
  - Engine-health and research surfaces remain visible.
  - Use for pre-launch hold or rollback.
- `staged`
  - Outcome cards are enabled for a controlled pilot only.
  - Required before broad rollout.
- `live`
  - Outcome cards are enabled for standard operational use.

## Backfill Policy

- Active pilots:
  - run a 30-day recompute before enabling outcome cards.
- Completed pilots that ended within 90 days:
  - run a manual recompute with an explicit lookback window up to 90 days.
- Older completed pilots:
  - treat as partial-history unless a dedicated historical backfill is approved.
- Forward-only metrics:
  - optional PTT trust disposition baseline.
  - any missing care timing milestones that were never written historically.

## Backfill Procedure

1. Confirm the target pilot and rollout stage.
2. Inspect current ops status in the pilot dashboard.
3. Trigger manual recompute from the pilot dashboard or `/.netlify/functions/recompute-pilot-outcome-rollups`.
4. Verify the `rollup_recompute` scope moved to `succeeded`.
5. Spot-check:
   - enrollment counts
   - adherence denominator
   - escalation counts and median minutes to handoff
   - athlete trust/NPS sample threshold behavior
6. If the pilot is staged for launch, keep rollout stage at `staged` until analytics signs off.

## Migration Validation Checklist

- [ ] One active pilot recomputed and validated against raw source collections
- [ ] One completed pilot recomputed and endpoint freeze verified
- [ ] One cohort-filtered view checked against rollup-by-cohort diagnostics
- [ ] One escalation case manually matched against care timing milestones
- [ ] One trust low-sample state verified in admin UI

## Observability

### Ops Status

- `pulsecheck-pilot-metric-ops/{pilotId}/scopes/rollup_recompute`
- `pulsecheck-pilot-metric-ops/{pilotId}/scopes/scheduled_rollup_repair`
- `pulsecheck-pilot-metric-ops/{pilotId}/alerts/*`

### What To Watch

- `rollup_recompute.status !== succeeded`
- `scheduled_rollup_repair.status !== succeeded`
- repeated `snapshot_sync` alerts
- repeated `baseline_completion`, `survey_write`, `assignment_event_write`, or `checkin_write` alerts
- escalation refresh warnings after care timing updates

## Rollback

If outcome data appears incorrect:

1. Set pilot rollout stage to `disabled`.
2. Capture the pilot id, visible issue, and last ops-status/error.
3. Run manual recompute once.
4. If still incorrect:
   - keep rollout disabled
   - compare raw truth vs rollup output
   - open a backend fix before re-enabling

## Staged Rollout Order

1. Choose one active pilot with enough survey/adherence volume.
2. Set rollout stage to `staged`.
3. Run manual recompute.
4. Perform analytics signoff.
5. Move to `live`.
6. Repeat for the next pilot.

## Pre-Live Signoff

- [ ] Rollout stage set correctly
- [ ] Manual recompute succeeded
- [ ] Scheduled repair shows healthy status
- [ ] Enrollment and adherence spot checks pass
- [ ] Escalation timing spot checks pass
- [ ] Trust/NPS low-sample behavior verified
- [ ] Hypothesis comparison slices look directionally sane

## Post-Live Review

- [ ] Re-check ops status within 24 hours
- [ ] Compare one day of rollup output to raw collections
- [ ] Confirm prompt cadence is behaving as expected in the athlete app
- [ ] Confirm no new alert bursts are accumulating in `pulsecheck-pilot-metric-ops`
