# AuntEdna partner portal operations

The dedicated portal is `/developer/api/partner/auntedna` on `https://fitwithpulse.ai`. Its server authorization is bound to partner `auntedna` and the existing production key `pk_14ea32e13ebfda899720bb9768dd3400`. It does not enable snapshot delivery or change program eligibility.

## Credential storage and recovery

The partner password is a separately generated 32-byte random value. Its salted scrypt hash and credential version live in the existing server-only `partner-api-keys` document under `portal`. Only hashes of opaque session tokens are saved. The signing secret remains in the existing AES-256-GCM encrypted field.

The current portal password is held in the authorized operator's macOS login Keychain as **Pulse Partner Portal - AuntEdna Production**, account **chai-auntedna**. Retrieve it through Keychain Access and share it only through the agreed secure channel. Never write it in this document, a command argument, source, logs, or a plaintext handoff file.

## Revocation and rotation

Use the server-only `configurePartnerPortal` helper in `netlify/functions/lib/partner-portal.js` from an authorized production administration context to replace a password. Supply the generated password only in process memory and secure it in the approved secrets manager first. Configuration creates a new credential version and clears all existing sessions while preserving the API key and its permissions.

Use `disablePartnerPortal` to disable portal access and clear all sessions without revoking the signing key. Ordinary logout revokes the current session only. API key revocation, expiry, deletion, archival, or rotation blocks portal session and reveal requests immediately. Key rotation intentionally does not transfer portal access to the replacement key; explicitly review and update the bound key identity and configure its portal before restoring access.

## Session and response controls

The dedicated cookie is Secure, HttpOnly, SameSite=Strict, host-only, and expires within eight hours or at key expiry, whichever is sooner. Each reveal or copy makes an explicit same-origin POST and checks the current stored authorization. Secrets are absent from page HTML, SSR props, metadata responses, and listing APIs. Responses use no-store, and the portal bypasses analytics and application error instrumentation.

Successful partner login also grants the two existing documentation cookies. Documentation cookies and the shared documentation password never authorize portal access. Logout clears those cookies and the dedicated session cookie.

Login permits ten attempts per IP and one hundred across the partner per fifteen-minute window. Secret retrieval permits thirty requests per minute. Rate records use the existing server-only TTL collection. Audit entries contain operational identifiers only. Browser secrets hide after one minute, on backgrounding or page lifecycle changes, and at session expiry.

## Verification boundary

Focused synthetic tests cover wrong/shared passwords, foreign sessions, rate limits, logout, password rotation, portal disable, expired/revoked/rotating keys, response headers, and secret equality with encrypted storage. Production verification must use the real dedicated password from secure storage, avoid recording response bodies or revealed screenshots, and compare credentials only in memory. Do not revoke the live partner key merely to test a negative case.
