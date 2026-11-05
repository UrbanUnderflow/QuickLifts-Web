# School contact completion

Local implementation, 2026-10-30. This note does not establish deployment or store release.

School athlete onboarding (persisted AthleticMind organization scope) requires an institutional email and mobile number regardless of Apple, Google, phone, or password sign-in. The contact email is stored separately from the authentication email. The institutional email is trimmed, lowercased, checked for syntax and length, and excludes Apple private relay addresses. Phone is stored in E.164 form with 10–15 digits. This collects contact details; it does not verify email ownership, school-domain membership, or phone ownership.

The atomic consent completion endpoint rejects missing or invalid contacts with `CONTACT_INCOMPLETE` before any writes. Successful completion stores both contacts on the team membership and user profile. Existing consent receipts and completed baseline evidence are preserved. Setup-only consent saving remains available without advancing enrollment. Web membership mapping includes both contact fields, and the signed-in homepage and access hub return school athletes with missing contacts to onboarding.

Coordinate server/web deployment with updated iOS and Android releases. Older native clients can submit completion without institutionalEmail and will be rejected by the updated endpoint for athletes without previously stored contacts. Do not deploy the new enforcement independently of the supported-client rollout or a deliberately configured compatibility strategy. Test a fresh Apple private-relay account and a previously completed account missing contacts on installed builds before claiming end-to-end completion.

Validation: contact-policy unit checks; Firestore-emulator atomic consent suite including unchanged-state assertions for missing email, Apple relay email, and blank phone, plus successful normalized contact persistence. Device and deployed-browser verification remain separate release checks.
