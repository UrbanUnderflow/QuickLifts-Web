# Scoped consent remediation — October 18, 2026

> Current launch status: [launch-gate matrix](launch-gates.md). This document preserves the earlier audit/remediation evidence; consult the matrix for subsequent fixes and remaining release dependencies.
## Current result

Production membership rules and the four legacy PulseCheck team agreement corrections are deployed and read back exactly. The isolated web production build passed. Netlify published commit `99207139513b429a02136a92f6dbf4d0bfc66db6` in deployment `6ad4cdb9447fa430a064fcb1` at 09:56:31 ET; the site API confirms it is the active ready release. Both public consent routes serve the revised page code, and the escalation function starts and returns its expected 405 response to a non-mutating GET. Native fixes are compiled and committed locally; they have not been distributed or verified in authenticated device journeys.

This report supersedes the historical C01–C05 status in `consent-verification.md` only to the evidence level below. It does not close the other cohort-readiness findings.

## Changes and evidence

| Surface | Result | Evidence |
| --- | --- | --- |
| Membership privacy | Owner, platform admin and active scoped staff access; assigned staff limited to assigned athletes. Self-created staff grants and self-promotion denied. Existing staff profile completion preserved. | 13 isolated emulator cases against exact production candidate; final active rules source read back byte-for-byte. |
| Production rules | Narrow replacement of membership block and supporting helpers, preserving all unrelated deployed rules. | `remediation/rules-release-final-verified.json`; active ruleset `5de284e4-a7cf-4297-9305-09fadca19119`, SHA-256 `7aef610b87f1552d25a49e7d0704a863efee7bc870b8bc9e0e0f3c8ef5da666c`. |
| Team terms | Four exact legacy operational stock arrays replaced with the existing approved PulseCheck participation and optional health authorization stock, version `v1-pulsecheck`. | Atomic update with document-version preconditions; full before/after comparison proves only `requiredConsents` changed. `remediation/team-terms-before.json` and `team-terms-verified.json`. |
| Web | Exact receipt matching; failed authoritative reads block with retry; foreground/background refresh; stale submitted decisions rejected; completion persisted after consent success; permission-scoped roster queries. | 16 focused consent/access/parity tests; final isolated Next.js production build passed (305 static pages). |
| Routine server handoff | Current membership/team/organization/product/pilot terms independently resolved; absent, expired, declined, mismatched or ended routine authorization denied. Urgent routing remains separate. | 63 synthetic escalation runtime tests and 3 direct authorization-helper tests, no provider delivery. This does not fix the separate alternate clinical endpoint identified in the audit. |
| iOS | Read failures block; explicit verified program context; foreground refresh and full-document revision invalidation; fresh context before consent-bearing writes. | 21 extracted Swift assertions; full simulator build succeeded. Commit `a8a67e1`. |
| Android | Authoritative reads; invalidated forms on context updates; fresh pre-save checks; invite-followup read errors block. | 11 focused tests plus Kotlin compilation and debug APK assembly succeeded. Commit `a8a67e1`. |

Web source commits: `10d63f3f0` plus final TypeScript narrowing fixes; released candidate `99207139513b429a02136a92f6dbf4d0bfc66db6`. Test-only follow-up `eb3d97653` updates the existing missing-authorization regression expectation; runtime source is identical to the released candidate. Unrelated PipeLists working changes were excluded. Local rules remain intentionally different from production outside the narrowly deployed membership section.

## Live web verification

`remediation/web-release-verified.json` records the active published commit. `remediation/web-live-assets-verified.json` records the served page scripts and hashes for `/PulseCheck` and `/PulseCheck/athlete-onboarding`; both contain the new failed-verification retry UI. `remediation/web-function-smoke.json` records the safe GET smoke check. These prove deployed assets and function startup, not authenticated rendering, signer persistence, or care delivery. The test-only follow-up was pushed with Netlify’s documented [deployment-skip marker](https://docs.netlify.com/deploy/manage-deploys/manage-deploys-overview/) because it changes no runtime source.

## Corrected teams

- Track And Field — `XKZKHIiIXE8Au3zHuwvU`
- 4D Cycling Off-Road Race Team — `ampwEu8TXMXxmuWwFkYN`
- HyperCharge — `hnPbfVg2ygyIpxTmgyPV`
- Men's Basketball — `yFZLBov3S6TFRYwlbsbs`

Clark Atlanta remains AthleticMind. Organization product assignments, display branding, other team configuration, existing consent evidence and consent-event history were not changed by this remediation. No real athlete test accounts, consent submissions, notification sends or clinical deliveries were created.

## Remaining verification and limitations

1. Distribute the native fixes through the established release process, then verify current-version acceptance, optional decline, stale open form refresh, failed-read retry, save/reopen and account switching on isolated web/iOS/Android accounts. No suitable isolated athlete session was established; no Android device was connected. The available iOS simulator was not launched into an unknown signed-in account.
2. Consent writes still span event, membership and enrollment operations. The pre-save checks close ordinary stale-form paths but are not a transaction spanning configuration changes and all writes. A narrowly timed concurrent change or interrupted partial save still needs transaction/recovery work.
3. The original audit's other P1 findings remain open, including the alternate clinical endpoint, responder acknowledgement/rules compatibility, delivery retries, invitation sender/callback security, Android logout token cleanup and complete account/data closure. This is not broad cohort launch approval.

## Validation records

- Rules: `/tmp/consent-final-rules-tests.log` (13/13); earlier local-file differential check `/tmp/consent-remediation-local-rules-tests.log` (12/12 before adding the safe title-field regression).
- Web policy: `/tmp/consent-policy-tests.log` (16/16).
- Server: `/tmp/consent-escalation-tests.log` (63/63).
- iOS: `/tmp/ios-consent-refresh-tests.log`, `/tmp/ios-consent-build-final.log`.
- Android: `/tmp/android-consent-refresh-validation.log`.
- Web production build: `/tmp/consent-web-release-build.log`.
