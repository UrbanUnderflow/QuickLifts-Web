# Evidence journal activation

The API is disabled unless `PULSECHECK_EVIDENCE_JOURNAL_ENABLED=true`. This switch is independent of curriculum enrollment and curriculum flags. Disabled requests return 503 before authentication or data access.

## Required deployment order

1. Keep the evidence switch off while deploying the API and clients.
2. Deploy and verify `firestore.rules` for both the default/development project `quicklifts-dev-01` and production `quicklifts-dd3f1`. Confirm that `pulsecheck-evidence-journals` is included in `isExplicitlyRuledCollection` to exclude it from the compatibility fallback and that its recursive match denies all client access. The API uses Admin SDK access and verifies the owner from their Firebase token.
3. Run the local evidence API tests and emulator rules tests; verify deployed rules match the reviewed rules and perform owner/other-account signed-in checks against the intended environment.
4. Enable `PULSECHECK_EVIDENCE_JOURNAL_ENABLED=true` only after both environments' privacy rules have been verified. Deploy/restart the API as required by its host.
5. Verify create, list, revisit, reported use, delete, and cross-device assignment deduplication on the intended signed-in app release. Check that other athletes/coaches cannot retrieve an owner's entries.

Journal text stays in the private owner journal. Revisit/use records contain only the event kind and time. No journal text is sent to analytics, coaches, or Nora automatically. Turning the switch off blocks new API reads and writes without deleting saved records.

Local checks do not establish deployment or live access behavior.
