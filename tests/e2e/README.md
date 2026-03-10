# Playwright E2E Harness

This harness targets the Variant Registry build/publish flow.

## Safety defaults

- Playwright-launched app sessions force the **dev Firebase** project.
- Write-path tests are **disabled by default**.
- Authenticated registry smoke tests clone a temporary `[E2E]` namespaced variant fixture in the dev project and clean it up afterward.
- When write-path tests are enabled, published module ids are prefixed with the same `e2e-` namespace and deleted during cleanup.

## Common commands

```bash
npm run test:e2e:install
npm run test:e2e:auth
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

## Fixture lifecycle

For authenticated registry workflow tests, Playwright now:

1. Opens the Variant Registry in the dev Firebase project.
2. Deletes leftover docs in the current `PLAYWRIGHT_E2E_NAMESPACE`.
3. Clones the selected source variant into a temporary `[E2E] ...` fixture.
4. Runs build/preview/publish against the clone instead of the authored source variant.
5. Deletes the cloned variant, its history entries, and any namespaced `sim-modules` docs in a cleanup step.

This keeps the test from mutating authored variant records in the dev project.
