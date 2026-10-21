# Team and cohort activation

## Invitation contract

`POST /api/pulsecheck/activation/resolve` is a read-only, pre-authentication preview.
Request: `{ "code": "<activation code, invite token, or supported full invite URL>" }`.
Development clients send `forceDevFirebase: true` or `x-pulsecheck-firebase-mode: dev`, consistent with existing invitation endpoints.

Successful response is a flat object:

```json
{
  "inviteToken": "canonical-invite-token",
  "organizationId": "organization-id",
  "organizationName": "University name",
  "teamId": "team-id",
  "teamName": "Volleyball",
  "cohortId": "cohort-id",
  "cohortName": "Fall cohort",
  "productBrand": "athleticmind"
}
```

Cohort fields are null when the invitation targets a team without a cohort. Names come from the current parent records. The response excludes recipient information, contact details, roster data, consent records, and membership permissions. It grants no membership. Authenticated redemption and existing consent/onboarding gates remain authoritative.

Errors return `{ "code": "...", "error": "..." }`. `INVITE_ROLE_UNSUPPORTED` (403) lets existing staff invite handlers retain their route. Manual athlete activation must not accept staff invitations. Invalid, expired, exhausted, revoked, cross-team, and ambiguous codes fail closed. A university name or ID does not choose a team automatically.

## QR and deferred links

Existing AppsFlyer OneLink remains the distribution mechanism. Generated links carry the canonical token in both `inviteToken` and `deep_link_sub2`. AppsFlyer UDL only returns `deep_link_value` and `deep_link_sub1` through `deep_link_sub10` for new users, so the custom `inviteToken` parameter alone is insufficient after installation.

The provisioning pilot and cohort rows expose **Activation QR** for existing reusable athlete invitations. The explicit action adds a stable activation code to older records and refreshes their deferred token parameter. It retains the canonical invitation, existing redemptions, and team/cohort scope. The QR PNG encodes the same invitation URL used for app-store routing and in-app scanning. Opaque shortened OneLinks must resolve through AppsFlyer on the client; the preview endpoint does not fetch arbitrary URLs.

## Release verification still required

- Deploy the preview API and native clients together.
- Configure AthleticMind's real iOS listing, Android listing, and dedicated OneLink through the existing `NEXT_PUBLIC_ATHLETICMIND_*` distribution settings. The local environment checked on October 21, 2026 had none of these three values. PulseCheck distribution remains configured separately.
- Verify associated domains/app links and the OneLink template with both installed apps and fresh store installations on physical devices.
- Prepare the actual UMES team/cohort QR in the signed-in provisioning workspace. No live invitations were created or upgraded during implementation.
- Confirm the fallback: scan that same QR inside the installed app or enter the activation code, then authenticate and complete onboarding.

Official reference: https://dev.appsflyer.com/hc/docs/dl_ios_unified_deep_linking

## Local native verification (October 21, 2026)

- iOS uses the existing AppsFlyer pending-invitation store and existing authenticated redemption. The first screen and welcome use the Clay Form login material, with video underneath. Returning-account login hides public registration; athletes without a program are routed to activation. Staff routes and the independent consent gates remain in place.
- Six Swift contract checks passed, including rejecting incomplete team/cohort previews. Full iOS source type checking passed. Xcode's build service stalled during its compiler probe; the existing target's actual Swift compiler and linker commands were run directly, followed by simulator signing/install. The updated app launched on iPhone Air. Entry rendering, returning-account/back navigation, and camera-unavailable fallback were checked in Simulator. This is simulator evidence, not a store build or device install-attribution test.
- Both Android brands passed debug unit suites and APK assembly. Four focused activation-routing tests passed, covering invite-gated registration, staff invite fallback, protected gates, and opaque OneLink routing. No Android device was available for camera/UI verification.
- Twenty web resolver/link tests and TypeScript checks passed. No production membership, invitation, distribution configuration, or database permissions were changed. The provisioning QR surface was source/typechecked but not inspected in a signed-in browser.
