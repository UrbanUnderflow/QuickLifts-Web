# PulseCheck Watch List Runbook

## Purpose

This runbook covers the new PulseCheck operating model where:

- `escalation` means a care incident or workflow object.
- `watch list` means an explicit operational restriction overlay.

Escalations do not suppress athlete experience by themselves. Only an active watch list with restriction flags can suppress surveys, assignments, nudges, or adherence days.

The admin UI should keep the labels internal and operational:

- `request` queues a review only.
- `apply` activates the restriction flags.
- `clear` removes the active restriction state.
- `reviewDueAt` is a follow-up date, not an automatic suppressor or auto-clear.
- `linkedIncidentIds` should point at visible care records, not replace escalation history.

## Pilot Scope

Use one pilot first:

- Pilot ID: `E3OQFOfme7VsaYgsK4sw`

Validate the pilot end to end before widening rollout to any other cohort.

## Permissions

Recommended operational permission model:

- `request` watch list: staff, clinician, coach, or admin.
- `apply` watch list: clinician or admin.
- `clear` watch list: clinician or admin.
- Read operational state: staff, clinician, coach, admin, and the athlete's own self-view where allowed.

The canonical writer should remain the watch-list backend path, with the admin UI only surfacing request/apply/clear actions rather than inventing a separate policy engine in the client.

If the team wants a stricter separation later, keep `request` available to broader staff and narrow `apply` / `clear` to clinicians and admins only.

## Watch List Workflow

1. A care incident is recorded as an escalation or review item.
2. A human reviews the incident.
3. If the athlete should continue normally, leave the escalation open or resolve it without applying watch list restrictions.
4. If the athlete needs operational restrictions, request and then apply the watch list.
5. Choose the minimum restriction flags needed:
   - `suppressSurveys`
   - `suppressAssignments`
   - `suppressNudges`
   - `excludeFromAdherence`
   - `manualHold`
6. Clear the watch list when the athlete returns to normal operating status.

Request state is informational only. It must not suppress anything until the watch list is actually applied.
Apply is the moment athlete-facing suppression begins. Clear removes the applied restriction state and restores normal flow for whichever flags were on.

## Review-Due Behavior

`reviewDueAt` is a human follow-up date, not an automatic suppressor.

- If the watch list is active and the review date is overdue, surface it as an admin follow-up item.
- If the watch list is only requested, the overdue date should still be visible but must not change athlete behavior.
- Do not auto-clear the watch list when the review date passes.
- Do not auto-escalate overdue watch list state into a different athlete experience without a human decision.
- Keep the restriction flags in effect until a clinician/admin clears or changes the watch list.

## Linked Incidents

Watch list state can reference incident ids for context and audit.

- Show linked incidents in the athlete drill-down as care records, not as suppression sources.
- Keep escalation history visible even when the watch list is cleared.
- Do not infer active restriction flags from linked incidents alone.

## Migration Steps

For the initial pilot migration:

1. Reclassify historical escalation records so false-positive support / coach-review cases are not treated as operational restrictions.
2. Keep escalation history intact for audit.
3. Create watch-list records only when there is an explicit reviewed restriction decision.
4. Recompute pilot rollups after the watch-list state is updated.
5. Verify that survey prompting, adherence, and dashboard counts reflect watch-list state rather than escalation presence.

Do not auto-convert old escalations into watch list state just because they are active.

## Feature Flag And Rollback

Recommended rollout control:

- Keep the watch-list flow limited to the target pilot until validation passes.
- Leave other pilots off the new operational restriction workflow until the pilot is stable.

Rollback guidance:

1. Stop applying new watch-list changes to the pilot.
2. Clear any active watch list if the restriction was only for the rollout test.
3. Preserve escalation history and audit docs.
4. Recompute rollups after clearing restrictions.
5. If the rollout caused confusion, keep the pilot in normal mode while the code is adjusted.

If the team later adds a formal feature flag, use it to gate watch-list application and prompt suppression separately from escalation tracking.

## Rollout Validation

For the pilot above, validate all of these before widening rollout:

- A plain escalation with no active watch list still allows survey prompts.
- `request` alone does not suppress surveys or adherence.
- `apply` with `suppressSurveys=true` blocks surveys only.
- `apply` with `excludeFromAdherence=true` excludes adherence days without changing escalation history.
- `apply` with `suppressAssignments=true` and `suppressNudges=true` blocks the intended surfaces only.
- `clear` restores normal prompting and denominator behavior.
- The admin dashboard shows `Care Escalations`, `Coach Review Flags`, and `Operational Watch List` as separate concepts.
- The pilot outcome rollups match the operational state document after recompute.

## Operational Checklist

- [ ] Permissions follow the agreed request/apply/clear roles.
- [ ] Review-due items are visible in admin.
- [ ] Historical false-positive escalations are reclassified.
- [ ] One pilot validates request/apply/clear.
- [ ] One pilot validates survey, assignment, nudge, and adherence behavior.
- [ ] Rollup recompute after watch-list changes succeeds.
- [ ] Rollback path is documented before rollout expands.
- [ ] Admin UI uses review-only wording for request state and operational wording for apply / clear.
