# Local Machine Setup Runbook

This is the central handoff doc for getting QuickLifts-Web running on a new machine without copying local browser state or secret files out of band.

Use this document when you want another machine to:

- run the Next app locally
- run Playwright against the dev Firebase project
- mint Playwright bootstrap auth from Google Cloud Secret Manager
- run local scripts or server-side flows that depend on Firebase Admin credentials

This document intentionally lists secret names, env keys, and verification commands, but it does not contain actual secret values.

## Fastest Cross-Machine Handoff

If the new machine does not already have GCP access or local env configured, use the encrypted setup bundle flow first.

On the source machine:

```bash
export SETUP_BUNDLE_PASSPHRASE='<ask-owner-for-passphrase>'
npm run machine:setup:export
```

That writes an encrypted bundle to:

```bash
.setup/local-machine-setup.bundle.enc.json
```

Move that encrypted file to the new machine using a secure transfer method such as:

- `scp`
- AirDrop
- a private cloud drive/folder you control
- a password manager secure document

Do not commit the bundle into the repo, paste it into markdown, or embed it inside `systemOverview.tsx`.

On the destination machine:

```bash
export SETUP_BUNDLE_PASSPHRASE='<ask-owner-for-passphrase>'
npm run machine:setup:import
npm run test:e2e:bootstrap:check
npm run test:e2e:auth
source .playwright/bootstrap.env
```

The passphrase should not be stored in the repo, docs, or bundle metadata.
The receiving agent should ask the human operator for the passphrase at setup time.

What the encrypted bundle can carry:

- local `.env.local` values that are present on the source machine
- a resolved `PLAYWRIGHT_BOOTSTRAP_JSON` payload so the new machine does not need initial Secret Manager access just to get started
- optional Google application credentials content when `GOOGLE_APPLICATION_CREDENTIALS` points to a readable file on the source machine

Do not commit `.setup/` or `.local-secrets/`. They are local-only and gitignored.

### Current Bundle Location On The Source Machine

If the bundle has already been generated on the source machine, the default path is:

```bash
.setup/local-machine-setup.bundle.enc.json
```

That path is the handoff artifact the destination machine should receive first.

## Core Principle

Do not copy these between machines:

- `.playwright/admin-storage-state.json`
- service-account JSON files
- raw private keys pasted into markdown

Instead:

- give the new machine access to the real secret sources
- let the repo generate local state files on that machine

## What The New Machine Needs

### 1. Repo + Runtime Basics

- Clone `QuickLifts-Web`
- Install dependencies with `npm install`
- Install Playwright browser binaries with `npm run test:e2e:install`

### 2. Frontend Firebase Env For Local App Runs

These are required for the local Next app and local Playwright runs that target the dev Firebase project:

```bash
NEXT_PUBLIC_DEV_FIREBASE_API_KEY
NEXT_PUBLIC_DEV_FIREBASE_AUTH_DOMAIN
NEXT_PUBLIC_DEV_FIREBASE_PROJECT_ID
NEXT_PUBLIC_DEV_FIREBASE_STORAGE_BUCKET
NEXT_PUBLIC_DEV_FIREBASE_MESSAGING_SENDER_ID
NEXT_PUBLIC_DEV_FIREBASE_APP_ID
```

Production public Firebase env usually also lives in `.env.local`:

```bash
NEXT_PUBLIC_FIREBASE_API_KEY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
NEXT_PUBLIC_FIREBASE_PROJECT_ID
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
NEXT_PUBLIC_FIREBASE_APP_ID
```

Recommended local verification:

```bash
node env-check.js
```

### 3. Google Cloud Secret Manager Access For Playwright Bootstrap

Preferred env keys:

```bash
GOOGLE_SECRET_MANAGER_PROJECT_ID
PLAYWRIGHT_BOOTSTRAP_SECRET_NAME
```

Preferred auth model:

```bash
gcloud auth login
gcloud auth application-default login
gcloud config set project <gcp-project-id>
export GOOGLE_SECRET_MANAGER_PROJECT_ID=<gcp-project-id>
export PLAYWRIGHT_BOOTSTRAP_SECRET_NAME=PLAYWRIGHT_E2E_ADMIN_BOOTSTRAP
```

Required IAM:

- Grant the machine identity `roles/secretmanager.secretAccessor`
- Prefer granting it on the specific bootstrap secret, not the whole project

Verification:

```bash
gcloud secrets versions access latest --secret=$PLAYWRIGHT_BOOTSTRAP_SECRET_NAME --project=$GOOGLE_SECRET_MANAGER_PROJECT_ID
```

### 4. Firebase Admin Credentials For Local Server/Script Work

Playwright bootstrap does not only read Secret Manager. It also mints a Firebase custom token, so the new machine must be able to initialize Firebase Admin successfully.

Accepted credential patterns in this repo include:

```bash
FIREBASE_SERVICE_ACCOUNT
```

or:

```bash
FIREBASE_PROJECT_ID
FIREBASE_CLIENT_EMAIL
FIREBASE_SECRET_KEY
```

Some local dev flows also reference:

```bash
DEV_FIREBASE_PROJECT_ID
DEV_FIREBASE_CLIENT_EMAIL
DEV_FIREBASE_SECRET_KEY
```

Fallback machine credential keys that may also be used in some environments:

```bash
GOOGLE_APPLICATION_CREDENTIALS
GCP_SECRET_MANAGER_SERVICE_ACCOUNT_JSON
FIREBASE_PRIVATE_KEY
FIREBASE_PRIVATE_KEY_1
FIREBASE_PRIVATE_KEY_2
FIREBASE_PRIVATE_KEY_3
FIREBASE_PRIVATE_KEY_4
```

### 5. Guest Google Calendar Import OAuth For Group Meet Guests

Only add these if the machine will test the guest-side Group Meet calendar import flow:

```bash
GOOGLE_GUEST_CALENDAR_CLIENT_ID
GOOGLE_GUEST_CALENDAR_CLIENT_SECRET
GOOGLE_GUEST_CALENDAR_REDIRECT_URI
GOOGLE_GUEST_CALENDAR_ENCRYPTION_KEY
```

This contract is separate from the existing admin-side Group Meet scheduling setup.

Use the admin-side Google Calendar service-account / delegated-user setup for host final-event creation only.
Use these guest OAuth envs for invite-scoped free/busy import suggestions only.

Do not reuse `GOOGLE_CALENDAR_SERVICE_ACCOUNT_JSON` or the admin scheduling identity for the guest import path.

### 6. Optional Broader App Integrations

These are not required just to get local Playwright bootstrap working, but they may be needed if the new machine also needs to exercise broader product surfaces locally:

```bash
NEXT_PUBLIC_OPENAI_API_KEY
BREVO_MARKETING_KEY
BREVO_API_KEY
BREVO_SENDER_EMAIL
BREVO_SENDER_NAME
OURA_CLIENT_ID
OURA_CLIENT_SECRET
OURA_REDIRECT_URI
OURA_SCOPES
STRIPE_SECRET_KEY
STRIPE_TEST_SECRET_KEY
STRIPE_WEBHOOK_SECRET
STRIPE_WEBHOOK_SECRET_COACH
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
NEXT_PUBLIC_TEST_STRIPE_PUBLISHABLE_KEY
STRIPE_PRICE_ATHLETE_MONTHLY
STRIPE_PRICE_ATHLETE_ANNUAL
STRIPE_PRICE_COACH_MONTHLY
STRIPE_PRICE_COACH_ANNUAL
STRIPE_PRODUCT_ATHLETE
STRIPE_PRODUCT_COACH
SITE_URL
```

If the goal is only "run Playwright on another machine," you do not need to block on every key in this section.
If the goal includes testing Group Meet invite sends or preview-email flows locally, the Brevo keys in this section do need to come over to the machine.
If the goal includes testing the guest Google Calendar import flow locally, the guest Google envs in the previous section do need to come over to the machine.

## Playwright Bootstrap Secret

Recommended secret payload:

```json
{
  "adminEmail": "admin@example.com",
  "nextPath": "/admin/systemOverview#variant-registry",
  "pulseCheckOrganizationId": "<org-id>",
  "pulseCheckTeamId": "<team-id>",
  "namespace": "e2e-pulsecheck"
}
```

Notes:

- `adminEmail` or `adminUid` is required
- `pulseCheckOrganizationId` and `pulseCheckTeamId` are optional, but useful for workspace suites
- `namespace` is optional, but useful for namespaced fixture cleanup

## One-Time Verification Flow On A New Machine

Run this in `QuickLifts-Web`:

```bash
npm install
npm run test:e2e:install
node env-check.js
npm run test:e2e:bootstrap:check
```

If the bootstrap check passes:

```bash
npm run test:e2e:auth
source .playwright/bootstrap.env
npm run test:e2e:smoke -- tests/e2e/pulsecheck-onboarding-workspace.spec.ts
```

## What `npm run test:e2e:bootstrap:check` Verifies

The check script validates:

- local dev Firebase public env is present
- the Playwright bootstrap source is configured
- Google Cloud Secret Manager can be read
- the bootstrap secret parses correctly
- the bootstrap admin user exists
- Firebase Admin can mint the custom token used by Playwright bootstrap

If it fails, it should tell you exactly what is missing.

## Generated Local Files

These files are safe to generate locally and should stay local:

- `.playwright/admin-storage-state.json`
- `.playwright/bootstrap.env`
- `.setup/local-machine-setup.bundle.enc.json`
- `.local-secrets/google-application-credentials.json`

These are generated from real credentials and bootstrap config on the current machine.

## Related Docs

Use these together:

- `System Overview -> Playwright -> Cross-Machine Bootstrap`
- `System Overview -> Playwright -> GCP Access Setup`
- [tests/e2e/README.md](/Users/tremainegrant/Documents/GitHub/QuickLifts-Web/tests/e2e/README.md)
- [docs/AGENT_ONBOARDING.md](/Users/tremainegrant/Documents/GitHub/QuickLifts-Web/docs/AGENT_ONBOARDING.md)

## Copy/Paste Prompt For Another Machine

```text
Set up QuickLifts-Web on this machine using docs/testing/local-machine-setup.md and the Playwright Testing Strategy doc in System Overview. If this machine is brand new, first request the encrypted setup bundle and ask the human operator for the setup-bundle passphrase. Do not assume the passphrase is stored anywhere in the repo or docs. Import the bundle, run node env-check.js, then npm run test:e2e:bootstrap:check, then npm run test:e2e:auth, source .playwright/bootstrap.env if it exists, and finish with a safe Playwright smoke run. If anything fails, report exactly which env key, IAM role, secret, credential, or passphrase step is missing.
```
