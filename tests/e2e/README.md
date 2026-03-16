# Playwright E2E Harness

This harness targets the Variant Registry build/publish flow.

It also now includes a PulseCheck onboarding/workspace smoke suite for:

- internal provisioning surface load
- legacy roster migration surface load
- post-activation setup load
- team workspace roster/invite controls
- optional write-path legacy roster migration into a new PulseCheck org/team
- optional write-path legacy roster migration into an existing PulseCheck team
- optional write-path athlete invite create/revoke flow
- optional write-path adult invite redemption through member setup
- optional write-path athlete invite redemption through consent and baseline onboarding
- optional write-path assigned-athlete scope enforcement for a coach recipient
- optional write-path invite-policy matrix coverage across admin-only, admin-and-staff, and admin-staff-and-coaches
- optional write-path revoked-invite negative-path coverage
- optional write-path target-email mismatch coverage
- optional write-path admin-activation regeneration invalidation coverage
- optional write-path no-roster-visibility coverage for non-admin adults

## Safety defaults

- Playwright-launched app sessions force the **dev Firebase** project.
- Write-path tests are **disabled by default**.
- Authenticated registry smoke tests clone a temporary `[E2E]` namespaced variant fixture in the dev project and clean it up afterward.
- When write-path tests are enabled, published module ids are prefixed with the same `e2e-` namespace and deleted during cleanup.
- PulseCheck harness-seeded write fixtures also use the active `PLAYWRIGHT_E2E_NAMESPACE` and remove those records during cleanup.
- PulseCheck UI-created invite artifacts use unique `e2e-...@pulsecheck.test` identities and are revoked or torn down within the same test run.

## Common commands

```bash
npm run test:e2e:install
npm run test:e2e:auth
npm run test:e2e:smoke
npm run test:e2e:pulsecheck:full
npm run test:e2e:pulsecheck:write
npm run test:e2e -- --list
```

## Capture admin auth state

This opens a visible browser window, forces the app onto the dev Firebase project, and saves the authenticated browser state to:

```bash
.playwright/admin-storage-state.json
```

Run:

```bash
npm run test:e2e:auth
```

Then:

1. Log into the admin in the opened browser.
2. Wait until you can see the Variant Registry or admin area.
3. Return to the terminal and press Enter.

After that, `npm run test:e2e` will automatically reuse the saved state.

## Authenticated smoke run

Provide one of:

- `PLAYWRIGHT_STORAGE_STATE=/absolute/path/to/admin-storage-state.json`
- `PLAYWRIGHT_REMOTE_LOGIN_TOKEN=<custom-token>`

Then run:

```bash
PLAYWRIGHT_STORAGE_STATE=/absolute/path/to/admin-storage-state.json npm run test:e2e
```

## Opt-in write tests

Write-path publish tests are only enabled when:

```bash
PLAYWRIGHT_ALLOW_WRITE_TESTS=true
```

Optional namespace override:

```bash
PLAYWRIGHT_E2E_NAMESPACE=e2e-registry
```

Example:

```bash
PLAYWRIGHT_STORAGE_STATE=/absolute/path/to/admin-storage-state.json \
PLAYWRIGHT_ALLOW_WRITE_TESTS=true \
PLAYWRIGHT_E2E_NAMESPACE=e2e-registry \
npm run test:e2e
```

## PulseCheck workspace suite

The new PulseCheck suite can run as a read-only smoke test or, optionally, as a write test for athlete invite creation/revocation.

Required environment for team-specific coverage:

```bash
PLAYWRIGHT_PULSECHECK_ORG_ID=<firestore-org-id>
PLAYWRIGHT_PULSECHECK_TEAM_ID=<firestore-team-id>
```

Recommended namespace for write-path runs:

```bash
PLAYWRIGHT_E2E_NAMESPACE=e2e-pulsecheck
```

Read-only smoke run:

```bash
PLAYWRIGHT_STORAGE_STATE=/absolute/path/to/admin-storage-state.json \
PLAYWRIGHT_PULSECHECK_ORG_ID=<firestore-org-id> \
PLAYWRIGHT_PULSECHECK_TEAM_ID=<firestore-team-id> \
npm run test:e2e:smoke -- tests/e2e/pulsecheck-onboarding-workspace.spec.ts
```

The `test:e2e:smoke` command only executes tests tagged with `@smoke`, which keeps the run on the read-only route/render coverage defined in the system overview. Playwright-launched sessions still force the app onto the dev Firebase project.

Opt-in PulseCheck write-path and negative-path run:

```bash
PLAYWRIGHT_STORAGE_STATE=/absolute/path/to/admin-storage-state.json \
PLAYWRIGHT_PULSECHECK_ORG_ID=<firestore-org-id> \
PLAYWRIGHT_PULSECHECK_TEAM_ID=<firestore-team-id> \
PLAYWRIGHT_ALLOW_WRITE_TESTS=true \
npm run test:e2e -- tests/e2e/pulsecheck-onboarding-workspace.spec.ts
```

Full PulseCheck regression run:

```bash
PLAYWRIGHT_STORAGE_STATE=/absolute/path/to/admin-storage-state.json \
PLAYWRIGHT_PULSECHECK_ORG_ID=<firestore-org-id> \
PLAYWRIGHT_PULSECHECK_TEAM_ID=<firestore-team-id> \
PLAYWRIGHT_ALLOW_WRITE_TESTS=true \
npm run test:e2e:pulsecheck:full
```

This command runs the PulseCheck onboarding/workspace suite and the athlete-journey suite together against the dev Firebase project.

Explicit PulseCheck write-path run with namespaced cleanup:

```bash
PLAYWRIGHT_STORAGE_STATE=/absolute/path/to/admin-storage-state.json \
PLAYWRIGHT_PULSECHECK_ORG_ID=<firestore-org-id> \
PLAYWRIGHT_PULSECHECK_TEAM_ID=<firestore-team-id> \
PLAYWRIGHT_E2E_NAMESPACE=e2e-pulsecheck \
PLAYWRIGHT_ALLOW_WRITE_TESTS=true \
npm run test:e2e:pulsecheck:write
```

Cleanup model:

1. Harness-seeded PulseCheck fixtures use ids derived from `PLAYWRIGHT_E2E_NAMESPACE`.
2. Athlete-journey cleanup removes check-ins, completions, daily assignments, coach notifications, memberships, and seeded org/team records.
3. Legacy migration fixtures use namespaced ids and are removed through the E2E harness cleanup helpers.
4. UI-created invite links use unique test emails and are revoked or consumed during the same run instead of being left behind.

The write test creates a unique athlete invite from the team workspace and then revokes it during the same run.
It also covers negative-path protections for revoked links, wrong-email invite access, regenerated admin activation links, and `none` roster visibility behavior.
It now also covers legacy coach-roster migration from `coachAthletes` into PulseCheck org/team memberships using namespaced E2E fixtures and cleanup.

## Fixture lifecycle

For authenticated registry workflow tests, Playwright now:

1. Opens the Variant Registry in the dev Firebase project.
2. Deletes leftover docs in the current `PLAYWRIGHT_E2E_NAMESPACE`.
3. Clones the selected source variant into a temporary `[E2E] ...` fixture.
4. Runs build/preview/publish against the clone instead of the authored source variant.
5. Deletes the cloned variant, its history entries, and any namespaced `sim-modules` docs in a cleanup step.

This keeps the test from mutating authored variant records in the dev project.
