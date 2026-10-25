# Institutional onboarding policy: local review

Status: local implementation only. No provider changes, OTP messages, policy activation, production deployment, or student changes have occurred.

## Configuration

The existing Provisioning organization workspace contains an Institution onboarding panel:
- Institutional email and verified phone required
- Exact approved email domains (up to 20, no wildcard or implicit subdomain matching)
- Explicit audience: coaches, or coaches and students after separate rollout review

Defaults preserve current behavior. The panel saves drafts only, behind `INSTITUTION_ONBOARDING_DRAFT_WRITES_ENABLED`. There is deliberately no activation endpoint. Drafts use the existing directly-denied private namespace, under `institution-onboarding-v1/drafts/{organizationId}`. The API reuses the same-project, revoked-token, verified-admin-email allowlist authorizer already used for curriculum administration. It creates no grants.

The independently gated active-policy reader uses `institution-onboarding-v1/active/{organizationId}` only when `INSTITUTION_ONBOARDING_ENFORCEMENT_ENABLED` is true. No active policy records or flags were created. Invalid active configuration fails closed. These flags are implementation gates, not instructions to turn the feature on.

## Implemented checks

Team invitation redemption reads active policy inside its transaction before any membership writes. The policy checks verified Firebase claims rather than browser/profile fields: exact institutional email domain, `email_verified`, linked `phone_number`, and no Google sign-in provider for restricted onboarding. Existing targeted-email, expiry, organization, team, role, and replay checks remain in place. A school domain alone never creates authorization. The invite page hides its Google button and handler for affected audiences, and describes the email/phone requirement. Existing users outside restricted onboarding retain their existing sign-in methods.

## Required completion before activation

1. Implement Firebase phone OTP and linking to an existing canonical UID. Never merge accounts based on typed institutional email or an unverified profile phone. A new phone-only account has no verified institutional email; completing mailbox verification remains necessary under the current targeted-email invitation model. Existing verified mailbox ownership can be reused.
2. Decide and approve how an organizer approves phone-to-person/team mapping for shared presentation entry. The QR is a nonsecret locator, never an individual invitation or staff access grant.
3. Complete restricted profile/setup writes through a server-owned flow. Existing `saveAdultMemberSetup` is a direct Firestore client transaction. Inspect deployed membership/profile rules and native/legacy writers before claiming old-client bypass prevention. A UI check or server preflight alone does not prevent direct writes.
4. Review any required Firestore changes separately. No rule changes are included here.
5. Preserve existing member access during rollout. Apply policy to new joining/setup, and offer signed-in account linking for existing users. Do not globally disable Google or silently migrate UIDs.
6. Resolve phone provider enabled state, authorized domains, SMS region policy, billing, abuse limits, recovery and changed-number handling. No configuration verification was possible with the expired Firebase CLI session. No refresh was attempted.
7. Complete authenticated baseline issuance/resume after setup, independent of recurring delivery enrollment. It must verify current membership and pilot, reuse unfinished invitations, and retain completed answers.
8. Test web first with synthetic auth fixtures. Native iOS/Android rollout and UMES onboarding require separate review. No current student flow is enabled under this draft.

## Verification

Synthetic unit coverage includes exact domains, lookalikes, unverified email, missing phone, Google versus phone sessions, audience isolation, organization isolation, disabled gates/no reads, anonymous API rejection, and draft-only writes. Existing coach survey tests remain applicable. TypeScript checks pass. Full build results are reported separately by the task; no live authentication was performed.
