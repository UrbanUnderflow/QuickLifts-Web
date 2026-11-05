# Communication retention policy review

Review of the recovered production source, November 4, 2026. This records existing product commitments and a proposed implementation approach. It does not adopt a new policy or change production.

## Existing commitments

- `src/pages/privacyPolicy.tsx`, Retention section: retain identifiable communication records only while reasonably needed for the product experience, active program, operational review and stated security/compliance purposes. No numeric SMS lifetime is specified.
- `src/pages/delete-account.tsx`, Data handling details: validated account deletion includes deletion or anonymization of associated messages, subject to specified legal/security/fraud/accounting/compliance exceptions.
- `src/content/consents/defaults.json`: participation, health-sharing and optional research choices remain separate; staff cannot accept an athlete's personal consent. These choices do not establish team-text opt-in.
- `docs/deliverables/consent-flows-2026-09-09.md`: append-only timestamped consent evidence. This is an evidence-integrity rule, not authorization for indefinite retention.
- `netlify/functions/lib/organization-lifecycle.js`: an existing 90-day restoration window precedes organization purge. It is not a 90-day rolling SMS retention policy.

## Minimal compatible approach

Continue the current necessity-based policy rather than inventing a numeric TTL. Keep operational SMS content separate from minimal consent and STOP evidence; enforce verified opt-in and immediately stop outgoing texts on withdrawal. Validated account deletion removes local SMS content and operational contact/routing/job data through bounded cleanup. Organization decommissioning immediately removes access and uses the existing restoration/purge lifecycle. Record any justified exception separately with an accountable owner and review date.

Before enabling the platform, the product owner should document (1) when ordinary messages cease to be operationally necessary and the corresponding review/deletion schedule; (2) the retention/disposition owner and schedule for consent evidence, opt-out hashes, deletion tombstones and any incident hold; and (3) the verified provider/backups deletion process. The current source does not answer those questions, so no new automatic expiry or evidence destruction is implemented.

Do not describe local cleanup as deleting recipients' device copies or all Twilio/provider records. Provider retention, current opt-outs and deletion capabilities must be verified after the existing account is accessible. Retaining an opt-out hash protects against renewed unwanted messages, but does not itself justify indefinite storage of message bodies, raw phone numbers or full profiles.

## Implemented boundaries

Self-service closure and legacy admin deletion both reach local SMS cleanup. Legacy admin deletion retains synchronous success/failure semantics and uses a separate SMS-only recovery job that can proceed only after Auth confirms the account is absent. It does not invoke full account closure. Failed/uncertain attempts retain SMS content and pause team texting pending operator review; no background process deletes or disables the account. Minimal consent/STOP/deletion evidence remains restricted pending documented disposition, not labeled permanently exempt.
