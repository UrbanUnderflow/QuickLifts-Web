# AthleticMind app distribution

Local implementation prepared on 2026-10-20. This web task changed no store listings, AppsFlyer configuration, production settings, invitations, or releases. Firebase registrations are tracked in the native release work.

## Configuration before web release

Set these public build-time variables only after the separate app registrations and published destinations are verified:

- `NEXT_PUBLIC_ATHLETICMIND_IOS_APP_STORE_URL`: verified AthleticMind App Store listing.
- `NEXT_PUBLIC_ATHLETICMIND_ANDROID_PLAY_STORE_URL`: verified AthleticMind Google Play listing.
- `NEXT_PUBLIC_ATHLETICMIND_ONELINK_URL`: dedicated AthleticMind AppsFlyer template URL (`https://<subdomain>.onelink.me/<template>`), configured for both new app identities and `https://fitwithpulse.ai` as an allowed web fallback origin.

The same iPhone variable must be available to Netlify functions for activation email delivery. Public links are configuration, not credentials. No sample listing identifiers are provided because the real registrations are pending.

## Routing contract

Persisted organization `productBrand` selects the installed app. Presentation `appBranding` never selects the app or changes permissions. Invite creation reads the organization; invite/offer, pilot-next-steps, and subscription-return pages resolve the organization before presenting downloads. Existing PulseCheck links remain the defaults for PulseCheck organizations.

AthleticMind uses `athleticmind://open` and the distinct `/AthleticMind/team-invite/<token>` universal-link path. That route reuses the existing invite handler and permission checks; new AthleticMind OneLink fallbacks use it. Checkout remains on the web-only `/PulseCheck/athlete-offer/<token>` path. The shared `/PulseCheck/open` bridge recognizes that scheme (or `productBrand=athleticmind`) and uses AthleticMind distribution only. This public routing hint does not authorize access. Wearable callback return sanitizers accept the AthleticMind scheme while retaining existing redirect restrictions.

When AthleticMind store URLs are missing or point at a known PulseCheck/legacy Pulse app, download controls show “coming soon” and have no destination. When its OneLink template is absent, new invites link to the invitation web page, preserving the token. This deliberately does not pretend that PulseCheck is the requested app. Release these web changes together with configured distribution to avoid interrupting existing university onboarding.

Activation email and push resolve pilot → organization → saved product brand on the server, ignoring caller-supplied app URLs. Missing organizations or missing/unrecognized productBrand block outreach. AthleticMind email uses its own `athleticmind-pilot-activation-v1` template (or branded fallback); PulseCheck template overrides are not reused. Email returns a configuration error until the AthleticMind iPhone listing is available. Push selects an installation for the resolved brand. No delivery was performed during this work.

## Rollout and verification

1. Complete both store apps, signing, OAuth clients, entitlements, notification delivery, and AppsFlyer destinations. Verify the Firebase app registrations created by the native release work.
2. Verify both app builds from the same source revision, including app coexistence and independent push-token registration.
3. Configure the URLs above and release web and native changes together.
4. Regenerate university share links. Existing shared PulseCheck OneLinks and previously sent messages retain their original external targets and cannot be repaired by this web change. Do not silently rewrite historical records.
5. Test new and existing accounts on iPhone and Android: invite before install, invite after install, checkout return, handoff, consent, wearable return, and activation outreach preview. A bare store link does not preserve deferred attribution, so verify the configured AthleticMind OneLink before broad enrollment.
6. Review university-specific saved instruction text and activation templates for references to the previous app. Supplied copy and custom saved records were preserved.

Validation: focused distribution and wearable-return tests run without live services. TypeScript validation is separate from rendered, signed-in, device, store, and production verification. These latter checks still require configured app identities and a release environment.

## Domain association

The local Apple app-site association now includes `ZG887P86D5.com.fitwithpulse.athleticmind` only for `/AthleticMind/team-invite/*`, preserving all existing entries. Signing, live domain delivery, and device association remain unverified. Android production association still requires the Play app-signing SHA-256 certificate; a debug fingerprint was not published.
