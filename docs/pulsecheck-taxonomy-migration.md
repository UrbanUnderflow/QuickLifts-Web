# Pulse Check Taxonomy Migration

This rollout keeps the legacy mental-training model running while the taxonomy becomes the new system of record.

## Data writes

- Keep writing legacy exercise completions to `mental-exercise-completions/{userId}/completions`.
- Write new canonical sim records to `sim-sessions/{userId}/sessions`.
- Store derived taxonomy profile and active program on `athlete-mental-progress/{athleteId}` under:
  - `taxonomyProfile`
  - `activeProgram`
  - `lastProfileSyncAt`
  - `profileVersion`
- Store taxonomy-aware daily state on `mental-check-ins/{userId}/check-ins` under `taxonomyState`.

## Backfill order

1. Backfill `taxonomyProfile` for existing athletes from baseline assessment, check-ins, and sim sessions.
2. Backfill `activeProgram` by prescribing from the derived taxonomy profile.
3. Map existing Kill Switch history into `sim-sessions` when raw round metrics exist.
4. Leave legacy `mprScore`, `currentPathway`, and curriculum documents in place until all major surfaces read the taxonomy profile.

## Compatibility rules

- `mprScore` remains for legacy cards and reports, but no new prescription logic should depend on it.
- Coach and athlete UIs should prefer `taxonomyProfile` and `activeProgram` when present.
- Legacy exercise recommendations can continue to flow, but the selected exercise should come from the taxonomy-driven `activeProgram` first.

## Validation checks

- Kill Switch completion creates both a legacy completion and a canonical sim session.
- Daily check-ins change `activeProgram` when readiness or modifier state changes.
- Coach roster cards show taxonomy bottlenecks without breaking existing pathway flows.
