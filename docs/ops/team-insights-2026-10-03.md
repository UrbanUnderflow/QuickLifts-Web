# Team insight reports

Implemented local coach/trainer weekly insight generation and archive in the Reports tab. Windows are completed Monday–Sunday UTC weeks. The server recomputes role-filtered facts and current sharing permissions before returning a saved narrative; a changed fingerprint invalidates it. AI receives aggregate allowlisted facts, not athlete names, journals, chats, or raw clinical records. Headline arithmetic is deterministic. AI interpretation includes fact references and remains a staff-reviewed interpretation, not a diagnosis or causal finding.

## Backfill

Clark Atlanta University / Volleyball (`GlKi00GszJxnSnY8eh80`), existing authorized admin/trainer viewer `RI6D2h6ygab46uxxxZwVkYpWU6B2`.

Activation and athlete membership began August 24, 2026. Backfilled both audiences for weeks ending August 30, September 6, 13, 20, and 27. Ten records in `coach-team-insight-reports`. Existing delivered report collections were untouched. Records are viewer-scoped, so another staff member generates their own permitted report.

Historical reconstruction uses currently authorized athletes, current sharing choices, and retained dated records. It is not an exact reconstruction of permissions or team composition at the original date. Current skill pins are excluded; historical skill labels require dated assignment labels. Missing data remains unavailable, and cohort minimums remain enforced.

The production rules change was applied to the fetched live rules only: explicitly exclude `coach-team-insight-reports` from the permissive fallback and deny client access. Exact deployed source was re-fetched and verified. The local rule file contains the equivalent change.

## Runtime and validation

- Uses existing `OPENAI_API_KEY` or `OPEN_AI_SECRET_KEY`; default model `gpt-4.1`, configurable through `TEAM_INSIGHT_MODEL`.
- Existing AI key configured in ignored local environment file. No secrets committed.
- Browser-checked coach/trainer sample layouts and audience switching.
- Real production aggregate generation and saved-record verification completed.
- Unit coverage includes authorization, sharing revocation, cached-data invalidation, baseline/citation validation, percentage scale, and duplicate week IDs.
- Website code has not been pushed or deployed. The new history appears in production only after application deployment.
- Generation is on demand. No email delivery or recurring automation added.

Backfill CLI: `node --import tsx scripts/backfillTeamInsights.ts --team=<team> --viewer=<authorized-staff-uid> --start=YYYY-MM-DD` previews periods; append `--apply` to write. Uses existing configured Firebase Admin and AI credentials. Re-running reuses valid AI reports and retries evidence-only reports.
