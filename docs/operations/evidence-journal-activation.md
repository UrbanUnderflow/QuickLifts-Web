# Evidence journal activation

The journal API is always on. It is available wherever it is deployed, with no environment switch. Every request is authenticated and scoped to the signed-in owner.

## Required deployment order

1. Deploy and verify `firestore.rules` for both the default/development project `quicklifts-dev-01` and production `quicklifts-dd3f1` before, or together with, the API. Confirm that `pulsecheck-evidence-journals` is included in `isExplicitlyRuledCollection` to exclude it from the compatibility fallback and that its recursive match denies all client access. The API uses Admin SDK access and verifies the owner from their Firebase token.
2. Run the local evidence API tests and emulator rules tests; verify deployed rules match the reviewed rules and perform owner/other-account signed-in checks against the intended environment.
3. Deploy the API.
4. Verify create, list, type filters, revisit, reported use, delete, and cross-device assignment deduplication on the intended signed-in app release. Check that other athletes/coaches cannot retrieve an owner's entries.

Journal text stays in the private owner journal. Revisit/use records contain only the event kind and time. No journal text is sent to analytics or coaches. An entry reaches Nora only when the athlete shares it, or has turned on sharing for new entries, and then travels through Nora's normal chat pipeline.

Local checks do not establish deployment or live access behavior.
