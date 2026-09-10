# Athlete and staff onboarding consent flows

Implemented locally on September 9, 2026 across web, iOS and Android athlete onboarding, plus the web coach and staff onboarding routes.

## Decisions

- Program participation requires agreement to continue.
- Health authorization records acceptance, refusal or revocation independently. Refusal preserves ordinary program access. Routine clinical handoff checks the current authorization and the latest signer-owned evidence before reading conversation content for the transfer. The existing event-specific Tier 2 decision still applies. Tier 3 retains its separate safety basis.
- Optional research records willingness. Dataset eligibility also requires a configured study-specific consent and acceptance of the current research terms.
- Coaches and staff receive confidentiality, permitted-use and support-responsibility terms, with their own signature record.

Each decision includes the exact terms, version, typed signature name, client decision time and authenticated actor. Append-only consent events receive a server timestamp. User-owned evidence can be read by its signer; clients cannot update or delete it or submit it for another person. The mutable membership summary supports onboarding state. Copies can be saved from the consent interface.

Web and native entry flows place consent ahead of intake. Existing stored intake answers are retained while an athlete reviews updated consent.

## Provisioning

The team consent editor now supports participation, health authorization, research and staff categories. Research forms can be identified as the approved study-specific consent. Existing team customizations remain authoritative. Use Manage consents and the appropriate preset to apply the updated defaults to an existing team, then review its institution-specific wording and version before saving. No production team records were changed by this implementation.

Default content is in `src/content/consents/defaults.json`; native defaults mirror the athlete entries. The generic default wording is adapted to program-wide use; it is not an unmodified import of the CAU document. Institution-specific contacts and terms can be supplied through the team editor.

## Release and validation

Deploy the Firestore rules before releasing clients that append consent evidence, then deploy the web functions and UI and distribute native builds. Prior client versions do not implement the new optional-decision schema.

Validation: web TypeScript checks; focused consent/access/escalation tests; an isolated Firestore emulator test for evidence ownership and immutability; Android compilation and consent-policy unit tests; Swift syntax checks and isolated consent-model type checking; a local browser component preview for independent athlete decisions and staff-only terms.

Not verified: signed-in production persistence, live clinical-provider transfer, or full iOS application/device behavior. No production deployment was performed.
