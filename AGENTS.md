# QuickLifts-Web Working Guide

## Shared preferences

Follow the global working agreements. Before writing or revising Pulse copy, athlete education, visual design, or Pulse-branded documents, read `/Users/tremainegrant/.codex/guides/pulse-writing-and-design.md`. That file is the canonical writing/design doctrine shared with PulseCheck. If unavailable, preserve existing copy and design, follow supplied references, and report the missing guide when it affects the work.

## Project navigation and investigation

- Work from this repository root. Inspect Git status and preserve unrelated changes.
- Start with the actual route and its dependencies: `src/pages/`, shared code in `src/lib/`, and server handlers in `netlify/functions/`. Confirm the current entry point before editing.
- Check `package.json` for current scripts. Tests are organized under `tests/unit/`, `tests/api/`, and `tests/e2e/`.
- For authentication or access failures, distinguish initialization, signed-in identity, selected Firebase environment, authorization lookup, and deployed behavior before changing permissions or declaring access restored.
- For cross-platform contracts, inspect the relevant native code and instructions in `../PulseCheck/`. Check payloads, persisted records, rules, and consuming clients when changing shared behavior.

## References to read when relevant

- Nora behavior or shared chat runtime: `../PulseCheck/docs/nora/NORA_CONTRACT.md`, `docs/nora-shared-runtime.md`, and `docs/nora-engagement-model.md`.
- Nora release or evaluation work: `docs/nora-release-checklist.md` and the applicable guides in `docs/nora-red-team/`.
- Onboarding, consent, or clinical handoff: `docs/deliverables/consent-flows-2026-09-09.md`, current consent content in `src/content/consents/defaults.json`, and the affected implementation/rules. The dated document records local work; verify current behavior and deployment separately.
- Browser verification: `tests/e2e/README.md`. Inspect test setup and effects before running against connected environments.

Keep participation, health authorization, optional research, and staff decisions distinct. Use explicit field ownership and authorization checks. Verify that PulseCheck and AuntEdna responsibilities match current contracts.

## Validation and completion

- Choose checks for the affected behavior. Available commands include `npm run typecheck`, targeted unit/API tests selected from `package.json`, and relevant browser tests.
- For Nora behavior changes, inspect `test:nora:engagement` and `test:nora:red-team`; for releases, follow the current release checklist. Passing local tests does not establish live or native behavior.
- Use `npm run lint` or scoped linting as appropriate. Run `npm run build` when the change requires production compilation verification. Documentation-only changes generally need link/content/diff review.
- For visible changes, inspect the rendered route and affected interaction when feasible. Report missing authentication, browser, or environment access as a verification gap.
- Confirm the deployment target and authorized scope before changing live resources. Inspect scripts before running migrations, backfills, write tests, or external delivery workflows.
- Check the scoped diff and report what changed, what was verified, and any remaining requested workflow step.
