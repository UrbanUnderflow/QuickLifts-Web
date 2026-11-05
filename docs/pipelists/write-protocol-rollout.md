# PipeLists write protocol rollout

This patch is backward compatible until an administrator activates protocol 2 on selected documents. Client publication alone does not stop legacy clients. Do not restore audited records or transfer ownership until the server gate is deployed and verified.

## Contract

`writeProtocol: 2` and an integer `revision` identify an activated document. Clients cannot enable/disable the marker. Content writes increment the saved revision by exactly one in the same transaction. Clients merge against their saved baseline first; conflicting changes to the same field stop the write instead of choosing a later wall-clock timestamp. Omitted records are retained. Explicit `deletedAt`, `movedToListId`, and list archive markers preserve deletion/move intent. Intentional status downgrades remain supported.

The contract covers private workspace `lists`/`archivedLists`, shared `list` content, and lead-share `list`/`publicRead`. Existing authentication, stable owner envelopes, and invited-member checks remain required. Non-content updates can retain the current revision. Deleting an activated document is denied to prevent resetting the contract.

Administratively retired share documents contain only empty metadata, `retired: true`, and disabled public access. Client writes and deletion are denied, so stale tabs cannot recreate their payloads. Retire public, protected, and individual lead shares together. Existing owner paths may still read the empty metadata; no record data should remain in those documents.

## Deployment and activation

1. Publish the compatible client patch and verify the exact production commit.
2. Obtain the **currently deployed** Firestore rules and release identifier for the target project's default database. Back them up. Compare this narrow patch against that source, not an assumed repository snapshot. The initial service-account read returned HTTP 403; no live rules were changed.
3. Obtain action-time approval for the exact rules patch and authorized rules-management identity. Test the combined rules locally before deploying. Do not deploy unrelated local rule differences.
4. Deploy only the approved Firestore rules. Verify unmarked workspaces and unrelated sharing retain their existing behavior.
5. Back up full-fidelity affected state/share documents and their exact update timestamps. Administratively activate only the approved source/destination documents, starting each revision from a recorded integer. All clients with old code must reload; they will otherwise receive permission-denied on content writes in an activated workspace.
6. Verify a stale legacy write fails and a current transactional write succeeds on an approved synthetic/canary record before changing real records. Do not perform unapproved destructive live tests.
7. Re-read affected documents and use compare-and-swap guards. Verify destination ownership/read/edit access before retiring source copies. Preserve source tombstones and merge revisions under the destination account; retain metadata-only transfer markers under the old account.
8. Apply evidence-backed audit changes only after migration and enforcement verification. Do not infer status progression or change historical statuses as part of consolidation.

## Rollback

Keep the previous rules release plus full wire-value backups and checksums. Pause migration and writers first. Roll back only affected list entries and scoped share documents with update-time guards; never replace entire workspace documents after unrelated edits. Any protocol deactivation or retired-share reversal requires administrative access and the approved rollback scope. Reverting client code without first accounting for the activated gate would make older clients unable to save. Removing the gate before stopping stale writers would reintroduce the original risk.

## Validation

Run `npm run test:pipelists:safety`, `npm run typecheck`, scoped lint, and the optimized isolated build. Run `tests/unit/pipelists-write-protocol.emulator.test.cjs` against a **demo** Firestore emulator only. It tests legacy omission, forged newer timestamps, stale revision replay, intentional status downgrades and tombstones, opt-out/reset denial, retired shares/links, protected member writes, and unrelated access isolation.
