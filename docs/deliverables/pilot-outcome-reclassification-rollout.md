# Pilot Outcome Reclassification And Escalation Migration Rollout

## Scope

This rollout covers the pilot outcome survey reclassification pass for existing docs in:

- `pulsecheck-pilot-survey-responses`
- `pulsecheck-pilot-metric-events` for missing survey event backfill
- `pulsecheck-pilot-metric-rollups` via recompute after apply

The migration normalizes legacy survey docs into the canonical trust/NPS shape used by the pilot outcome dashboard and prompt logic.

This runbook also defines the ops lane for escalation classifier and disposition changes that can move:

- escalation tier counts
- active / resolved / declined status buckets
- median minutes to handoff initiated
- any downstream outcome slice that depends on escalation scope or care timing

Migration key:

- `pilot_outcome_survey_reclassification_v1`

Run audit path:

- `pulsecheck-pilot-metric-ops/{pilotId}/migrations/{runId}`

## What The Migration Does

For each survey response already attached to a pilot:

- normalizes `surveyKind` to `trust` or `nps`
- normalizes `respondentRole` to `athlete`, `coach`, or `clinician`
- normalizes `score` into the canonical `0-10` field
- fills missing pilot context fields when they can be resolved from athlete enrollment
- normalizes trust battery payloads into the canonical five-item structure
- backfills missing `survey_submitted` and `trust_submitted` / `nps_submitted` metric events
- recomputes pilot rollups after apply when requested

The migration does not delete docs or remove pre-existing events.

## Endpoints

### 1. Dry-run report

`POST /.netlify/functions/report-pilot-outcome-reclassification`

Example body:

```json
{
  "pilotId": "pilot_123",
  "sampleLimit": 20
}
```

What to review:

- `blockedCount`
- `applyReadyCount`
- `needsDocumentUpdateCount`
- `needsEventBackfillCount`
- `samples[].blockingReasons`
- `samples[].patchPreview`
- `opsGuidance.readiness`
- `opsGuidance.dryRunReviewChecklist`
- `opsGuidance.comparisonFields`

### 2. Apply migration

`POST /.netlify/functions/apply-pilot-outcome-reclassification`

Example body:

```json
{
  "pilotId": "pilot_123",
  "sampleLimit": 20,
  "recomputeRollups": true,
  "recomputeLookbackDays": 30
}
```

Expected response:

- `appliedCount`
- `appliedDocumentIds`
- `runId`
- `recompute.rollups`
- `opsGuidance.stagedValidationSteps`
- `opsGuidance.rollbackGuidance`

## Dry-run Review Guidance

Use the dry run as the release gate. For escalation classifier or disposition changes, do not move straight to apply unless these are true:

1. `blockedCount` is `0`, or every blocked row is understood and explicitly accepted.
2. The sample rows show the intended `surveyKind`, `respondentRole`, and pilot context patching without ambiguous rewrites.
3. You have a pilot-level baseline for escalation outcomes before apply:
   - `escalationsTotal`
   - `escalationsTier1`
   - `escalationsTier2`
   - `escalationsTier3`
   - `medianMinutesToCare`
   - escalation `statusCounts.active`
   - escalation `statusCounts.resolved`
   - escalation `statusCounts.declined`
4. If a classifier/disposition release is shipping in the same window, capture the before-state from the pilot dashboard before any apply or recompute.

Stop the rollout if any of these appear in the dry run:

- reclassification rows you cannot explain from the pilot context
- missing athlete or pilot context that would change denominator membership
- large expected swings in active vs resolved vs declined escalations without a corresponding classifier reason
- missing care timing on escalations that should still contribute to speed-to-care comparisons

## Rollout Steps

1. Run the dry-run report for the pilot.
2. Stop if `blockedCount > 0` and review the sample rows first.
3. Export the affected pilot data before apply.
4. Record the current escalation baseline from the pilot dashboard before apply.
5. Apply the migration with `recomputeRollups: true`.
6. Verify the migration run document under `pulsecheck-pilot-metric-ops/{pilotId}/migrations/{runId}`.
7. Verify the pilot dashboard reads the refreshed trust/NPS numbers from `pulsecheck-pilot-metric-rollups/{pilotId}`.
8. Spot-check at least one migrated survey doc and confirm the matching metric events exist.
9. If escalation classifier/disposition logic is part of the same release, compare before/after escalation counts and speed-to-care on the same pilot before widening rollout.

## Staged Rollout Validation

Use staged rollout for one pilot first.

Validate in this order:

1. Dry run stays stable across two consecutive runs on the same pilot.
2. Apply returns the expected `appliedCount` and a successful rollup recompute.
3. Pilot dashboard after recompute still shows credible escalation totals and status buckets.
4. `medianMinutesToCare` does not move unexpectedly unless the classifier/disposition release intentionally changed the included escalation population.
5. Athlete, coach, and clinician trust/NPS cards still preserve low-sample behavior.

Escalation-specific comparison cues:

- If `statusCounts.active` jumps while `escalationsTotal` is flat, review disposition normalization before widening rollout.
- If `statusCounts.declined` collapses or spikes, review classifier/disposition mappings before widening rollout.
- If `medianMinutesToCare` becomes `null` on a pilot that still has care handoffs, stop and inspect care timing milestones.
- If tier mix changes sharply without a known classifier change, stop and inspect the migrated pilot before promoting from staged to live.

## Recommended Pre-apply Export

Export at minimum:

- `pulsecheck-pilot-survey-responses` filtered to `pilotId`
- `pulsecheck-pilot-metric-events` filtered to `pilotId`
- `pulsecheck-pilot-metric-rollups/{pilotId}`

## Rollback Guidance

There is no destructive delete in the apply path, but there is also no automated rollback function in this pass.

If rollback is required:

1. Use the pre-apply export as the source of truth.
2. Restore the affected survey docs for the pilot.
3. Remove any backfilled survey events created by the migration if they are not part of the restored export.
4. Restore or delete pilot rollup docs for the pilot.
5. Run `/.netlify/functions/recompute-pilot-outcome-rollups` for the pilot to rebuild the read model from restored source docs.

Use the migration run audit doc to identify:

- which survey response ids were changed
- whether rollups were recomputed
- which sample patches were proposed during the run

For escalation classifier or disposition rollback:

1. Revert the classifier/disposition config or code to the prior released version.
2. Re-run the dry-run report to confirm no new unexpected document rewrites are pending.
3. Restore any escalation records or derived fields changed by the release if you exported them.
4. Recompute pilot outcome rollups for the affected pilots.
5. Compare the restored pilot against the pre-rollout baseline:
   - `escalationsTotal`
   - tier split
   - active / resolved / declined buckets
   - `medianMinutesToCare`

Use disable outcomes on the pilot as the containment step if the classifier/disposition release creates operator confusion and the rollback is not immediate.

## Operational Notes

- The dry-run report is safe to run multiple times.
- The apply path is intended to be idempotent for already-canonical survey docs.
- Missing survey metric events are backfilled using the survey response id as the source document id, so repeat apply runs should not duplicate those events.
- Recompute after apply uses the existing manual pilot rollup recompute path, not a second rollup implementation.

## Coach / Staff Continuity Check

After any disposition-related rollout or reclassification, verify the coach/staff workflow continuity signal in the rollup diagnostics:

- `diagnostics.escalations.workflowContinuity.manualReviewRequired` should be `false`
- `diagnostics.escalations.workflowContinuity.coachWorkflowVisibleTotal` should match the active coach-review eligible count
- `diagnostics.escalations.workflowContinuity.samples` should show the affected items as `visibleToCoach: true` and `actionableToCoach: true`

If `manualReviewRequired` is `true`, pause rollout closeout and inspect the coach queue in the admin surface before proceeding.
- For escalation changes, staged rollout is the default. Promote to live only after the same pilot holds stable through dry run, apply, recompute, and before/after escalation comparison.
