# OpenClaw Runner Smoke Test – Requirements & Plan

_Last updated: 2026-02-11_

## Objective
Validate that the `agentRunner` can invoke OpenClaw via the `USE_OPENCLAW` flag without touching production resources. The smoke test should exercise the exact execution path (env detection → command spawn) but run a harmless no-op task.

## Scope
1. **Configuration sanity check**
   - Confirm required env vars: `USE_OPENCLAW=true`, `PROJECT_DIR` (path to repo), `OPENCLAW_BIN` (optional, default `openclaw`).
   - Ensure runner falls back gracefully if binary missing (clear error message).

2. **Smoke task**
   - Kanban task labelled "OpenClaw smoke test" assigned to Nora.
   - Runner should spawn `openclaw status --json` (or similar safe command) when executing a step.
   - Capture stdout/stderr to update execution step output.

3. **Logging & health signals**
   - Presence update should note "OpenClaw smoke" status.
   - Any failure should set execution step status to `failed` with error text.

4. **Disable destructive actions**
   - Only run read-only commands (`openclaw status`, `openclaw version`).
   - Provide TODO to extend to real task execution later.

## Acceptance criteria
- Runner can be started with `USE_OPENCLAW=true OPENCLAW_SMOKE_TEST=true`.
- When tasked, runner spawns `openclaw status --json` and logs success/failure.
- No modifications to repos/configs occur.
- Presence doc + kanban step both reflect smoke test completion.

## Implementation notes
- Add helper in `agentRunner` to detect `OPENCLAW_SMOKE_TEST` and override command list with safe status check.
- Write script `scripts/run-openclaw-smoke-test.md` (later) guiding manual trigger.

---
_Step 1 (analysis) complete. Implementation will integrate the smoke-test flow into agentRunner and documentation._
