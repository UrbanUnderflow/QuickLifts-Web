# University outreach safety boundary

This patch is a supervised-operation baseline. It does not implement Gmail OAuth, automated Gmail sending, reply detection, prospect deduplication, or a new outreach engine.

## Behavior

- University list normalization is a display projection. Ordinary owner/shared saves apply only intentional view edits to the stored representation; unchanged stage configuration, archived records, future fields and history stay intact. Legacy records with missing/duplicate IDs fail closed when an edit cannot be mapped safely, and need a separately reviewed repair.
- University Brevo direct delivery and sequence creation/save/send/resume are blocked using verified stored list identities. Existing owner reads, pause and delivery-evidence review remain available. Due university jobs are skipped without rewriting queue records or consuming the eligible delivery batch limit. Unknown or inconsistent list identities also cannot send. Verified non-university templates keep their existing transport.
- `/PipeListsQueue?listId=synthetic-list` reads stored status through the existing owner-only GET endpoint. It never mounts the workspace, initializes profiles, saves lists, sends, resumes, pauses or refreshes provider tracking. It inspects one explicitly selected list and is not proof of an empty global queue. Existing signed-in owner access is required; this patch grants no new access.
- PipeLists pages, API routes and schedulers are disabled outside verified production. Build metadata generates a gitignored provenance marker consumed by Next and scheduled functions. Runtime site identity must match that marker. Preview builds sharing production credentials remain blocked. The development runbook proxy to production is removed. Other product routes retain their existing application shell. Shared Brevo callbacks identified as PipeLists, and opaque callbacks that cannot be classified safely, are rejected in nonproduction before client initialization or lookup. Clearly identified unrelated callbacks retain existing service behavior: this is not whole-site isolation, so never replay those against production-connected preview services.

## Explicit stage migration

The normal page lifecycle never calls `/api/pipelists/stage-migration`.

An existing authenticated owner may request a POST preview with:

```json
{ "action": "preview", "listId": "synthetic-list" }
```

The read-only preview returns a target schema version, exact snapshot fingerprint, changes, and before/after copies for both personal and existing protected records. Review the exact scope and obtain separate approval before applying any real migration. Code deployment alone is not migration approval.

Apply requires `action: "apply"`, the same list ID, `approved: true`, `targetVersion: 1`, and `expectedFingerprint` copied from the approved preview. A changed snapshot rejects the apply and requires a new preview. Missing/duplicate record IDs, mismatched ownership and newer schemas fail closed. Re-previewing an already migrated list is a no-op.

The migration adds missing stage definitions, preserves existing custom stage fields and unknown stages, retains the `cold-email-sent` ID, and maps legacy `won`/`closed-won` assignments to `pilot-active` only in the explicitly reviewed migration. It does not infer that a call or later email occurred. Personal and protected copies update in one transaction with exact before/after snapshots in `pipeListStageMigrations`. Those snapshots support a separately reviewed rollback; never overwrite subsequent edits with an old backup.

## Rollout checklist

1. Keep this as a reviewable branch/draft PR until the release owner approves merging and deployment. Do not treat passing focused tests as a passed release gate.
2. Confirm the current deploy-preview/branch-deploy configuration and verify provenance generation in the actual Netlify build output. An isolated synthetic bundle test is not live deployment verification.
3. Before approved deployment, inventory the existing university queue under the established owner identity. Skipping future dispatch cannot recall a provider-accepted message or cancel an already running old deployment. Reconcile pending/uncertain claims separately.
4. Close older workspace sessions before any separately approved migration. Version/fingerprint checks protect the migration transaction; they cannot stop an already deployed old client from writing later. No Firestore permissions were expanded by this patch.
5. Review and approve a scoped migration preview, snapshot/rollback plan and protected-copy differences. Do not migrate all lists merely because a template changed.
6. Use the already approved business-email workflow and verified manual CRM evidence for supervised outreach. No email, self-test, queue mutation or migration is authorized by these instructions alone.

## Isolated validation

All added fixtures use synthetic data and mocked services. The pull-request-only PipeLists Safety workflow runs the synthetic suites and typecheck with read-only repository permissions and no service secrets. Do not point them at production or use live authentication. Useful commands:

```sh
npm run test:pipelists:safety
NODE_OPTIONS=--max-old-space-size=4096 npm run typecheck
```

The browser fixture files `tests/ui/pipelists-email-sequence.test.cjs` and `tests/ui/pipelists-queue.test.cjs` replace Firebase/API activity before bundling and block external requests. They still require an available supported Chromium sandbox. Rendered jsdom checks do not replace layout/screenshot QA.
