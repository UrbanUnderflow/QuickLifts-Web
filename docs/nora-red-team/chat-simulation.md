# Chat Simulation

The Nora Testing console includes a Chat Simulation tab beside Scenarios. It contains a conversation composer and a response review log. Every successful reply has a separate grading attempt with a 1–10 usefulness score, reason, exact supporting quote, suggested improvement and protection concern. Invalid or failed grades remain unscored. These are advisory AI reviews and require human judgment.

This is candidate Nora using the privacy reply guidance, not the production chat handler. It has no live tools, clinical retrieval, message delivery or account updates. Use fictional examples only. The endpoint requires Nora testing authorization, bounds input to 16 turns and 4,000 characters per message, and rejects injected system-role messages. Free-text user content remains untrusted; the synthetic-only flag is not a clinical-data detector.

History lives in component memory across tab switches and clears on reload or New conversation. Each request sends history to the authorized model bridge; replies and reviews request store:false. No transcript persistence was added by this feature. Provider and infrastructure retention are separate concerns, so this must not receive real clinical disclosures.

Validation: twelve unit tests passed, TypeScript passed, unauthenticated endpoint access returned 403, and a real model smoke test returned a reply plus a verified separate review. Signed-in browser interaction remains unverified because the local preview is signed out. No deployment performed.

The broader fifty-case usefulness improvement remains in progress. The latest full privacy rerun after reply changes had 47 passes and 3 flagged cases (outage, coach connection and assault disclosure). Earlier 50/50 results predate those reply changes. A high usefulness score does not override privacy findings or approve release.

## Local tester and hosted development checks

Opt-in NORA_LOCAL_TESTING=true enables a dedicated local testing surface at the Nora Testing route only during development, on loopback with a matching Origin. The server binds to loopback. It creates a real Firebase synthetic tester session in quicklifts-dev-01 using an HTTP-only, SameSite=Strict session cookie. The account has no global admin role. Local identity is accepted only by the chat simulation and storage probe endpoints. The model call uses the existing hosted model bridge with a server-held synthetic runner credential; no production athlete records are queried by these endpoints. This remains a hosted model call, not fully offline testing.

The deployed development rules were updated using the authorized Firebase CLI account: exclude Nora testing collections from permissive fallback and exclude the synthetic local tester from general signed-in access. Production rules were unchanged. The narrow deployment script preserves the live source, checks for concurrent changes and retains before/after snapshots. Existing public data rules remain public; this is not a full development database audit.

Verified: automatic local browser entry without a login modal; authenticated chat reply plus review; all five real Firebase probe checks passed (write/read, update/read, anonymous denial, direct tester denial, cleanup). TypeScript and four relevant local-session/chat tests passed. The Firebase probe explicitly does not establish real Nora transcript persistence, clinical storage separation, or delivery. Those broader integration checks remain separate work; chat history is still page-local.

## Nora Chat Actions, local prototype

Local Chat Simulation includes registry-matched practice buttons and meal offers. Practice uses seeded existing ExercisePlayer modules in preview mode. It records an in-page completion message; it does not save athlete completion. Keyword matching is deliberately limited and suppresses exercise shortcuts for chest/breathing complaints and crisis language. Full contextual action planning and exercise suitability review remain separate work.

Food mentions can offer Log meal / Not now. Declining suppresses further meal offers for that conversation. The editable form uses the existing Meal serializer and the canonical users/{synthetic-tester}/mealLogs path in development Firebase, requiring confirmed portions and nutrition values. A stable card ID prevents duplicate creates on retries. Saved cards support edits, read-back verification, and JPEG/PNG/WebP uploads under 300 KB, stored as data-image content in the existing image field. This is a prototype image format requiring cross-client review before rollout. No other user's photos are reused; the fallback is an icon placeholder. No generated image service or approved shared-photo catalog was introduced.

The local chat endpoint reads the five most recent synthetic meals as context for later turns. It does not load photos into the model. Meal-save and practice events appear in the UI; practice completion has no durable store. The current response grader evaluates prose, not the full action lifecycle. The base authenticated console keeps actions disabled until the production action authorization and storage path are integrated.

Validation: six action/review unit tests passed. Real development canonical meal create/read/edit passed. TypeScript passed. No production deployment. Browser exercise completion and cross-device meal image rendering remain unverified.
