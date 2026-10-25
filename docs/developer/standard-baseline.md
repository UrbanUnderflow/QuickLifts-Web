# Standard baseline across iOS and web

The user-facing survey is `/PulseCheck/baseline`, backed by `/api/pulsecheck/baseline`. The existing CAU routes remain compatible aliases to the same standard questionnaire. The question set is shared across institutions; skill scenarios use the provisioned sport.

## Completion and eligibility

The authenticated UID owns the assignment, drafts and final combined submission in `pulsecheck-restricted-questionnaire-submissions`. Only a final combined record with `status: complete` and matching `externalId` satisfies the requirement. A saved mental-skills result or a membership's older baseline flag alone does not release the app blocker. Previously completed combined questionnaires remain valid.

Completed team entry onboarding with its participation/consent choices, or completed individual onboarding, creates a standard assignment on demand. A client polling before consent must continue into onboarding first. Explicit trusted assignments, including disabled assignments, remain authoritative. Staff-only accounts are excluded. Assignment creation is transactional and preserves an existing submission identity.

The iOS app checks the same authenticated status after onboarding/access and on foreground. Unknown or failed checks block training with retry, support and sign-out controls. Completion messages from the web view only trigger a server check. They cannot directly unlock training.

## Embedded sign-in and privacy

The embedded web view uses an isolated data store. A native Firebase ID token authorizes `/api/pulsecheck/baseline-session`, which mints a custom token for that same UID. Tokens never enter URLs. Navigation, native messages and token delivery are restricted to the exact baseline origin and paths. The ordinary web route uses normal account sign-in.

Health sharing remains an independent consent decision and requires a configured clinical destination. New standard assignments do not invent clinical configuration. Where health sharing is unavailable or declined, the existing performance-only path completes the requirement. Clinical answers remain at the clinical destination; the account keeps permitted performance data and receipt references.

A reserved submission retains its sharing choice across retries. If validation or authorization fails before reservation, the web client reloads status and restores editing. A save failure never becomes a successful completion.

## Release and validation

Publish the web/API changes before distributing the new iOS build. Neither a local build nor synthetic tests establish signed-in production or physical-device behavior.

Coverage includes authenticated account ownership, automatic assignment, combined versus skill-only completion, unavailable checks, consent and provider retries, resumed web completion, embedded sign-in messages, mobile layout, and actionable step validation.
