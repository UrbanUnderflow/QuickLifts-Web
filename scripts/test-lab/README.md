# Isolated athlete web and baseline Test Lab

This is a **local-only** harness. It never loads cloud service-account credentials and refuses production projects or non-loopback emulator hosts.

## Start

Run from QuickLifts-Web with Node and JDK 17 available:

```sh
node scripts/test-lab/prepare-emulators.cjs
```

The output provides a temporary `configPath`. Start Firebase with that file:

```sh
node_modules/.bin/firebase emulators:start --only auth,firestore --project demo-pulsecheck-ui --config <configPath>
```

Run the emulator command from a temporary working directory, using the absolute CLI path, to keep generated Firebase logs outside the repository. The preparation script copies the current canonical Firestore rules/indexes into a temporary directory and records the rules hash. It does not substitute permissive test rules.

In another terminal:

```sh
node scripts/test-lab/web-server.cjs --port 8787 --output-dir /tmp/athlete-test-lab-web
node scripts/test-lab/emulator-fixtures.cjs seed --run-id ios-no-membership --scenario no-membership --output /tmp/ui-lab-ios-no-membership.json
node scripts/test-lab/emulator-fixtures.cjs seed --run-id ios-baseline-required --scenario baseline-required --output /tmp/ui-lab-ios-baseline-required.json
```

Default ports: Auth 9099, Firestore 8080, local web 8787. Port 4400 belongs to the Firebase hub. Android emulator clients use `10.0.2.2` to reach host loopback services.

Fixture scenarios: `no-membership`, `existing-member`, `baseline-required`, `onboarding-required`. Every run should use a unique run ID. Manifests contain synthetic credentials and are created with mode 0600.

## Run and read evidence

```sh
node tests/e2e/athlete-test-lab-web.cjs --origin http://127.0.0.1:8787 --output-dir /tmp/athlete-web-run
node --test tests/e2e/athlete-test-lab-safety.test.cjs
node scripts/test-lab/emulator-fixtures.cjs readback --manifest /tmp/ui-lab-ios-baseline-required.json
```

The browser runner exercises the real baseline React components and Firebase Authentication emulator. Draft and skill saves use their actual validators/transaction helpers against the Firestore emulator. It independently reads the saved record after completion and reload. It covers Back/re-entry, draft persistence, rejected final save, lost response after commit, completion reconciliation, and no external browser traffic. It also runs existing synthetic invitation/onboarding and questionnaire-branch suites, with separate evidence labels.

Outputs include `results.json`, screenshots, video, a Playwright trace and logs. Results have `caseIds`, `status`, `platform`, `evidenceMode` and explicit proof boundaries. A missing local server is **blocked**, with nonzero exit code; it never silently skips.

## Native bridge and API boundary

`GET /__testlab/health` identifies the demo project. `POST /api/pulsecheck/baseline-session` validates an Auth emulator ID token and produces an emulator-only custom token. Browser Firebase Auth completes that token exchange. The native iOS/Android suite must prove the actual WKWebView/webview half; browser tests simulate the native message handler and say so.

Baseline endpoints are a **synthetic service adapter**, not execution of the production Next.js/Netlify baseline handlers. Completion is stored in an emulator Firestore record and a separate local ledger. These tests prove the UI, bridge protocol, validator use and persisted/reopened synthetic state; they do not prove clinical delivery, production API behavior, production rules deployment, check-ins or skill-training completion.

Readback endpoints:

- `/__testlab/readback?uid=<testUID>`: sanitized observed account and request events, baseline completion.
- `/__testlab/receipts?uid=<testUID>`: synthetic final-save receipt and event outcomes.
- `/__testlab/events`: sanitized request events, no credentials or answer payloads.
- `POST /__testlab/fault` with `{uid, mode}`: `none`, `fail-final-save-once`, `response-lost-once`.

Only `ui-lab-` accounts are accepted. Unknown service routes fail explicitly with 501. Outbound support/email/SMS actions are never delivered; the care-state adapter is read-only.

## Cleanup

```sh
node scripts/test-lab/emulator-fixtures.cjs cleanup --manifest <fixture.json>
```

Cleanup checks project, namespace, account identity and record ownership, then removes only manifest-owned data plus known UID-owned baseline draft/completion records. Use a new server output directory per run; the local ledger intentionally persists across app/browser relaunches during the run. Stop the local processes after the test job. Do not use real athlete data.

The local service also supports morning check-in persistence. `record-morning-checkin`
validates the level, recovery range, timezone and actual emulator membership, then
saves the canonical `pulsecheck-morning-checkins` record. Conversation creation is
explicitly unsupported. `submit-pulsecheck-checkin` saves an authenticated synthetic
check-in and returns an explicitly unknown state snapshot with no assignment; this
is save-contract coverage, not validation of the production planner or inference.
`/__testlab/receipts` independently reads the baseline completion record from
Firestore; `readback` also reads morning check-ins. Health reports hashes of the
actual loaded bundle, helpers and adapter source so evidence identifies the running
version. The web PR workflow runs the baseline suite with isolated emulators and
uploads evidence even on failure.

Optional `seed --training true` creates a namespaced synthetic published 4-7-8
breathing version, explicit audience and enrollment. It contains no earned progress
and no check-in. `/api/curriculum/plan` and `/api/curriculum/runtime` execute the
actual production read/issue/start/complete helpers against the emulators; the
runtime itself enforces a saved daily check-in and issued/started ownership before
completion. These are synthetic content publication fixtures, not evidence that a
real production program has been reviewed or published. Receipt reads actual
completion documents. Cleanup removes only the scoped state's owned assignments
and completion records. Session and journal routes remain unsupported.

### Saved baseline identity and phone-only accounts

`tests/e2e/baseline-account-identity-emulator.cjs` is invoked by the existing web
suite for BAS-01. It uses only the demo project and loopback services. It actually
sends and confirms an emulator verification code, verifies the resulting Auth
phone claim without an email, and checks that the baseline status reuses the
saved agreement name. A deliberately unrelated profile email is never treated
as verified identity. Canonical binding overrides forged submitted identity,
while an account with neither trusted contact cannot claim verification through
body fields. Both synthetic fixture namespaces are cleaned after the run.

The adapter invokes the production identity and submission validators. Its final
baseline write is an explicitly synthetic local ledger, not production API or
provider delivery proof. Restart a stale local adapter after active jobs finish
before running this contract; missing account identity must fail this smoke.
