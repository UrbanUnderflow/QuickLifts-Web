# Coordinated app and coach update source

The November 5, 2026 integration is prepared for GitHub review. App Store and Google Play submissions are held until all seven coordinated items are complete. A commit or push does not establish deployment, store approval or installed-device behavior.

Completed web source includes the coach SMS inbox and queue, external texting-consent handling with opt-out safeguards, pending-athlete preparation/listing, administrative baseline completion carry, and authenticated administrative-entry routing. Preparation creates no authentication account, active athlete membership, baseline answer or consent decision. Phone claims remain disabled by default, and this change adds no public claim endpoint.

Administrative-entry reuse requires a trusted applied move, exact membership provenance, an existing baseline and unchanged personal receipt evidence. Declines and revocations remain authoritative. It creates no destination acceptance or signature and grants no additional health-sharing authority. Ordinary joins and incomplete original setup continue through onboarding.

The native integration is maintained in the PulseCheck repository: required-update policies, splash version/build labels, team-code input, session recovery, administrative-entry routing, and the Nora playback/capture boundary. Nora pauses listening during playback and exposes **Interrupt Nora**; automatic spoken interruption is disabled. Physical speaker/Bluetooth and final integrated device checks remain required before submission.

Release work still requires production-context artifact verification, all prerender blobs, provider configuration and live roster/texting screenshots. The current site was verified locked on an older preview-context deployment. Site and account-level Netlify settings contained no Twilio or coach-communication configuration. No real message was sent. Do not activate sending without verifying the existing sender and webhooks. Do not enable a minimum app version before a working release is available to the affected users.

The private eleven-athlete staging allowlist, phone data, source survey and identity holds remain outside Git. No athlete has been staged by this source integration. Live roster completion is a separate release step.

Validation commands for the integrated web source:

```sh
node --import tsx --test tests/unit/coach-communications.test.ts tests/unit/coach-communications-external-consent.test.ts tests/unit/relocation-baseline-carry.test.ts tests/unit/pending-athletes-validation.test.ts tests/api/pulsecheck/administrative-entry.test.ts tests/unit/standard-baseline-assignment.test.ts tests/unit/health-baseline-policy.test.ts tests/unit/baseline-account-identity.test.ts
node --test netlify/functions/__tests__/account-closure.test.js netlify/functions/__tests__/delete-user-communications.test.js tests/api/pulsecheck/organization-lifecycle.runtime.test.cjs
node tests/e2e/coach-communications-local.cjs
npm run typecheck
```
