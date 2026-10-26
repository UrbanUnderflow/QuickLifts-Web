# Institutional email and SMS authentication

The entry flow collects institutional email and phone, then verifies a Firebase SMS code. It never asks for a password. The phone form is integrated into the existing login surface. Alternate methods appear only for a program whose saved sign-in configuration permits standard methods; phone-only programs show no provider buttons, password, or magic-link choice. The one-time email connection flow remains available after an existing-account collision, solely to connect a phone to the kept UID.

## Identity and account preservation

- Firebase's verified phone identity and UID own the account. The institutional email is reference data, stored as `email` and `institutionalEmail` on a new profile, with `institutionalEmailVerified: false`.
- A reference email is not added to Firebase Auth or `signInEmails` and does not verify institutional affiliation or grant organization, coach, health, clinical or research access.
- `complete-phone-auth` accepts a recent phone-provider ID token, checks revocation, checks the actual Auth record and creates a minimal profile transactionally. Existing profiles are never overwritten during sign-in.
- Phone verification uses a separate Auth session. Only after profile validation/enrollment does the verified identity enter the primary client session. iOS receives a server-signed custom token so its User object belongs to the primary Auth instance; web and Android transfer their SDK session. The dev signer uses the existing configured impersonation authority for IAM signBlob, with an explicit matching project and target service account; no key or permission is created. Failed enrollment cannot publish a new empty app session.
- An existing Auth email cannot be claimed using SMS plus a typed email. The user opens that existing account through an email link once, then connects phone in Settings. `/PulseCheck/login?phoneSetup=1` returns to shared Settings. Email-link login checks the account in a secondary session and refuses to create an app account for a reference-only email.
- A reference-email collision on another phone account requires its existing sign-in method or support; it never merges accounts or changes ownership. A new number links only while signed into the kept account and after SMS verification.
- Codes are single-use. A failed first enrollment removes a newly created temporary Auth user only after confirming no app profile was committed. Connecting later requests a fresh code.
- Native account deletion supports fresh SMS reauthentication and the existing server-owned closure/retention process, without requiring a password.

## Clients and configuration

Web surfaces: PulseCheck login, coach login, shared sign-in modal, shared Settings, athlete profile Settings and coach dashboard Settings. iOS and Android share the same Firebase project, UID and backend. PulseCheck and AthleticMind use their own registered app identities.

US and Canada SMS regions are enabled in production (`quicklifts-dd3f1`) and development (`quicklifts-dev-01`), as requested on 2026-10-26. All clients accept ten national digits, optional leading 1 or +1, and formatting, and normalize to +1 automatically. Other international prefixes and extensions are rejected. Firebase’s US/Canada allowlist enforces destination countries; +1 alone does not establish country. Phone auth and email-link auth are enabled; existing password sign-in remains available. reCAPTCHA, APNs verification and Android app verification remain enabled. No production fictional phone numbers or verification bypass were added.

Web uses compact reCAPTCHA to fit mobile layouts. iOS explicitly forwards APNs tokens, silent auth notifications and callback URLs because Firebase delegate swizzling is disabled. Android uses `PhoneAuthOptions` with the foreground Activity, supports automatic verification and manual codes, and forwards the explicit Firebase environment to account setup.

The Firebase billing API is not accessible to the current service credential. Enabling the provider is verified configuration, not evidence of real SMS delivery or billing readiness. Physical-device SMS, Play-installed app verification and APNs/reCAPTCHA fallback still require release-device verification. Native builds do not update App Store or Play installations.

## Verification

- `node --test tests/api/pulsecheck/phone-token-signing.runtime.test.cjs` checks signer/project isolation and reuse. Production signing and development IAM signing were also checked without creating any Firebase Auth account.
- `node --test tests/api/pulsecheck/phone-auth-profile.runtime.test.cjs` tests email reference behavior, recent/revoked ownership validation, duplicate prevention, immutable existing profiles, legal acceptance and idempotency.
- `tests/api/pulsecheck/phone-auth.emulator.test.cjs` uses isolated `demo-phone-auth` Auth/Firestore emulators at 9099/8087. Its browser SDK bundle checks new phone signup, UID transfer/session refresh, existing coach/baseline preservation and a safe existing-account connection after a failed duplicate enrollment. It sends no SMS.
- `node tests/e2e/phone-auth-local.cjs` tests the actual form with an offline verification adapter. No real account or message is created.
- `node tests/e2e/pulsecheck-baseline-login-local.cjs` covers existing and newly completed sign-in return paths.
- Native policy tests cover US/Canada national entry, optional +1, and rejection of unsupported international numbers, extensions and malformed values. iOS/Android UI checks inspect the institutional email/phone form without sending SMS.

Phone changes must be released independently of the held baseline/clinical checkpoint. A hosted build and live validation are required before production promotion. No protected answers, clinical contacts or routing settings are changed by this feature.

## Provisioned sign-in policy

Organization configuration stores `signInPolicy: { mode: "institution-phone" | "standard", emailDomains: ["umes.edu"] }`. A phone-only policy requires at least one exact institutional domain. Legacy organizations without the field retain standard authorization behavior. Creation, resume and configuration updates validate and preserve the setting. Athletes and coaches inherit it from their organization; it grants no membership or staff capability.

`program-sign-in-policy` returns only public method/domain configuration before sign-in, using a known organization context or institution domain. An authenticated call validates the UID’s actual active memberships, independently of the supplied public lookup context. Native restored sessions and social/email sign-in paths must pass that check. Web canonical-account checks, coach dashboard API authorization, baseline API, team-code, team-invite and admin activation enforce the policy. Phone-only joins can use the server-stored institutional reference email alongside the phone-verified identity, instead of requiring a Firebase Auth email claim. Existing invitation target, token, role, lifecycle and consent checks remain.

For iOS, the server-issued phone handoff token includes `pulse_phone_auth: true`; an unmarked custom token is not a phone session. The emulator checks that the marker survives primary-token refresh. Firestore team membership authorization also requires a phone session for a phone-only organization. These database rules must be released together with the program configuration controls. Never replace deployed rules with an unrelated checkpoint; preserve the current rules and apply/verify the scoped policy hook.

The public form starts with institutional email and phone, without explanatory identity/reference copy. Web uses the existing rounded inputs and lime action; native uses the existing brand/appearance tokens and embeds the fields in its login card. Linking and deletion retain separate confirmation surfaces.
