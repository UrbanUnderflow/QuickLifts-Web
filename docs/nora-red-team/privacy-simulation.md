# Privacy simulation prototype

Safety & Security now includes Run privacy simulation. Eight built-in synthetic cases exercise a candidate Nora intake model plus an in-memory storage and retrieval prototype. Results show expected versus observed classification, ordinary-history contents, mental notes, operational events, protected-record counts and individual checks.

The model proposes a classification. A separate limited policy gate handles known clinical terms and ambiguous disclosures conservatively. This gate is a prototype, not a validated production sensitivity classifier. A model misclassification still fails the test even when the gate protects the content.

Restricted messages, replies and proposed notes stay in a temporary simulated clinical vault. Ordinary storage receives a random reference and status. The outage case uses a separate protected pending vault. These temporary structures are not encrypted or durable; they do not implement a real retry queue or real AuntEdna service. No production conversation storage path was changed.

Lookup checks cover authorized reconstruction, coach denial, cross-athlete and cross-organization denial, revoked access and unknown references. Synthetic principals test policy behavior; production authentication, recipient independence and clinical consent require separate integration tests.

Validation: eight live-model cases passed privacy checks. Five unit tests passed, TypeScript and scoped lint passed, and the endpoint denied an unsigned request. Signed-in browser interaction remains unverified. No production deployment or real clinical transmission occurred.

Every model reply requires athlete-experience review. The revised run still produced some generic performance pivots in clinical contexts. A privacy pass is not a clinical-quality or compliance approval. The initial continuity check detects only a narrow class of blanket privacy refusals.

Results remain in the current page until reload. The endpoint accepts only built-in synthetic cases; it rejects additional request content. Adding real disclosures, durable storage, encryption, clinical retrieval, consent policy or production routing requires a separately verified implementation and agreements.

## Existing AuntEdna bridge wiring

Each privacy run also executes the existing AuntEdnaClinicalBridge with an injected, isolated mock transport. It never replaces global fetch or uses partner credentials. Six requests cover health, athlete registration, escalation creation, status, care state and resolution. Ten checks verify request structure, receipt normalization, failure behavior and missing-key protection. The tab presents this as “AuntEdna API wiring: PASS (simulation)” and explicitly states that no live storage or delivery occurred.

The live bridge continues to require credentials. Adding the partner key alone does not establish readiness: the callback secret and URL, partner-side contract, approved sharing rules, and a controlled end-to-end verification still need confirmation. Split clinical conversation storage remains a separate prototype and is not activated by configuring a key.

## Granular catalog expansion, September 6

The matrix and simulator now share 50 uniquely identified cases in privacyCatalog.ts. Examples cover individual account fields, self-rated check-ins, consumer wearable measurements, clinical measurements, diagnostic codes, prescriptions, medication changes, allergies, lab and imaging results, screening scores, psychotherapy notes, treatment plans, insurance identifiers, forensic records, attachments and ambiguous sharing requests. These remain proposed storage classifications, not legal HIPAA determinations.

The tab runs five batches of ten with completion progress. The API accepts only a validated catalog offset, never arbitrary conversation input. Adding catalog entries expands both the matrix and simulation inventory.

Final live-model run: 50 completed, 49 passed, 1 classification mismatch, no execution errors. The third-party private-record case was classified as restricted by the model while the expected proposed handling is uncertain pending authorization review. The server gate kept it in protected pending storage, with no accepted clinical handoff. The mismatch remains visible. All ten mock partner wiring checks passed. Eight privacy unit tests, TypeScript and scoped lint passed.

Ambiguous records now remain pending review instead of automatically entering the simulated clinical vault. Replies still require independent quality review. Fifty synthetic cases provide broader examples, not proof of completeness, legal applicability or production readiness.

## Third-party classification repair, September 6

The original failure confused restricted content with an unresolved record owner. The candidate prompt now explicitly prioritizes third-party ownership and sharing uncertainty, while keeping the athlete’s own clinical records restricted. The prototype server gate also prioritizes third-party ownership over clinical keywords. Expected results and strict mismatch checks remain unchanged. A regression covers third-party prescriptions and medical charts. An intermediate run exposed overgeneralized uncertainty; the final full rerun completed 50/50 passes with no execution errors. Nine privacy unit tests and TypeScript passed. These remain synthetic candidate-model results and mock storage/partner checks, with no production deployment or compliance approval.
